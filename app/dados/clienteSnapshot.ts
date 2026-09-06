// app/dados/clienteSnapshot.ts — UI-DS-08 (TASK.md Lote 7)
//
// Núcleo de busca + cache + revalidação seletiva por hash (SDD §2.2), sem
// React — só I/O e estado em memória, para ser testável sem jsdom. O hook
// `useSnapshot.ts` é a casca fina que conecta isto a componentes React.
//
// Fica em `app/dados/`, não em `dominio/`, exatamente por fazer I/O (`fetch`):
// GUARDRAILS.md §5 proíbe rede dentro de `dominio/`.
//
// Estratégia de cache: uma entrada por URL (`Map<url, EntradaCache>`), cada
// uma lembrando o hash com que foi buscada pela última vez. A cada chamada de
// `garantir(url, chave, esquema)`: (1) busca `versao.json` — deduplicada por
// uma única promessa em voo, mesmo com N chamadores simultâneos; (2) compara
// o hash da `chave` pedida contra o hash usado da última vez que **esta**
// URL foi buscada; (3) só refaz o `fetch` da URL se o hash mudou (ou nunca
// buscou). "Sem sondagem cega" (SDD §2.2): nunca há polling de todos os
// arquivos — só a leitura periódica, pequena, de `versao.json`.

import type { z } from 'zod';
import { esquemaVersao, URL_VERSAO, type ChaveDeHash, type Versao } from './versao';

export interface EstadoSnapshot<T> {
  /** `null` até a primeira busca bem-sucedida; depois disso, o último dado válido —
   * nunca é limpo por uma falha de revalidação subsequente (mantém o anterior). */
  dados: T | null;
  /** `geradoEm` de `versao.json` no momento em que `dados` foi obtido. */
  geradoEm: string | null;
  /** `true` só até a primeira resolução (sucesso ou falha) desta URL. */
  carregando: boolean;
  /** Mensagem da última falha, se houver; `null` quando a última tentativa foi ok. */
  erro: string | null;
}

function estadoInicial<T>(): EstadoSnapshot<T> {
  return { dados: null, geradoEm: null, carregando: true, erro: null };
}

interface EntradaCache {
  hashUsado: string | null;
  estado: EstadoSnapshot<unknown>;
  ouvintes: Set<() => void>;
}

export interface OpcoesClienteSnapshot {
  /** Injeção de `fetch` para teste (GUARDRAILS.md — mesmo padrão de `tema.ts`
   * injetando `localStorage`). Padrão: `fetch` global do navegador. */
  buscar?: typeof fetch;
}

/**
 * Cliente de snapshots: uma instância por aplicação (`clienteSnapshotPadrao`
 * abaixo), reaproveitada por todo `useSnapshot` — é o que garante que N
 * componentes pedindo a mesma URL compartilhem uma única busca e um único
 * cache, em vez de um `fetch` por componente.
 */
export class ClienteSnapshot {
  private readonly buscar: typeof fetch;
  private versaoConhecida: Versao | null = null;
  private promessaVersao: Promise<Versao | null> | null = null;
  private readonly entradas = new Map<string, EntradaCache>();
  private readonly promessasEmAndamento = new Map<string, Promise<void>>();

  constructor(opcoes: OpcoesClienteSnapshot = {}) {
    this.buscar = opcoes.buscar ?? globalThis.fetch.bind(globalThis);
  }

  private entrada(url: string): EntradaCache {
    let entrada = this.entradas.get(url);
    if (!entrada) {
      entrada = { hashUsado: null, estado: estadoInicial(), ouvintes: new Set() };
      this.entradas.set(url, entrada);
    }
    return entrada;
  }

  /** Estado atual (síncrono) do snapshot de `url`, para leitura imediata pelo hook. */
  obterEstado<T>(url: string): EstadoSnapshot<T> {
    return this.entrada(url).estado as EstadoSnapshot<T>;
  }

  /** Assina mudanças de estado de `url`; devolve a função de cancelamento. */
  assinar(url: string, ouvinte: () => void): () => void {
    const entrada = this.entrada(url);
    entrada.ouvintes.add(ouvinte);
    return () => {
      entrada.ouvintes.delete(ouvinte);
    };
  }

  private notificar(url: string): void {
    for (const ouvinte of this.entrada(url).ouvintes) {
      ouvinte();
    }
  }

  /** Busca `versao.json` (SDD §2.2: `no-cache`), deduplicando chamadas concorrentes.
   * Falha (rede ou esquema inválido) mantém a última versão conhecida — nunca
   * quebra o snapshot já exibido; é descarte silencioso com aviso, mesma regra
   * das outras fronteiras de entrada externa (GUARDRAILS.md §4). */
  private async buscarVersao(): Promise<Versao | null> {
    if (this.promessaVersao) {
      return this.promessaVersao;
    }

    this.promessaVersao = (async () => {
      try {
        const resposta = await this.buscar(URL_VERSAO, { cache: 'no-cache' });
        if (!resposta.ok) {
          return this.versaoConhecida;
        }

        const bruto: unknown = await resposta.json();
        const resultado = esquemaVersao.safeParse(bruto);
        if (!resultado.success) {
          console.warn(
            'SportsLM: "versao.json" com formato inválido; mantendo a última versão conhecida.',
            resultado.error.issues,
          );
          return this.versaoConhecida;
        }

        this.versaoConhecida = resultado.data;
        return resultado.data;
      } catch (erro) {
        console.warn('SportsLM: falha ao buscar "versao.json".', erro);
        return this.versaoConhecida;
      }
    })();

    try {
      return await this.promessaVersao;
    } finally {
      this.promessaVersao = null;
    }
  }

  /**
   * Garante que o snapshot de `url` esteja atualizado com o hash da `chave`
   * correspondente em `versao.json` (§2.2). Rebusca `url` só quando: (a) é a
   * primeira vez que esta URL é pedida, ou (b) o hash de `chave` mudou desde
   * a última busca **desta** URL. Chamadas concorrentes para a mesma `url`
   * compartilham uma única execução.
   */
  async garantir<T>(
    url: string,
    chave: ChaveDeHash,
    esquema: z.ZodType<T>,
  ): Promise<void> {
    const emAndamento = this.promessasEmAndamento.get(url);
    if (emAndamento) {
      return emAndamento;
    }

    const promessa = this.executarGarantir(url, chave, esquema).finally(() => {
      this.promessasEmAndamento.delete(url);
    });
    this.promessasEmAndamento.set(url, promessa);
    return promessa;
  }

  private async executarGarantir<T>(
    url: string,
    chave: ChaveDeHash,
    esquema: z.ZodType<T>,
  ): Promise<void> {
    const entrada = this.entrada(url);
    const versao = await this.buscarVersao();
    const hashAtual = versao?.hashes[chave] ?? null;

    const primeiraBusca = entrada.hashUsado === null && entrada.estado.dados === null;
    const hashMudou = hashAtual !== null && hashAtual !== entrada.hashUsado;

    if (!primeiraBusca && !hashMudou) {
      // Nada mudou: não rebusca o arquivo (é o próprio critério de aceite).
      // Só sai do estado "carregando" inicial, se ainda estivesse nele.
      if (entrada.estado.carregando) {
        entrada.estado = { ...entrada.estado, carregando: false };
        this.notificar(url);
      }
      return;
    }

    try {
      const resposta = await this.buscar(url);
      if (!resposta.ok) {
        throw new Error(`HTTP ${String(resposta.status)} ao buscar ${url}`);
      }

      const bruto: unknown = await resposta.json();
      const resultado = esquema.safeParse(bruto);
      if (!resultado.success) {
        throw new Error(
          `esquema inválido em ${url}: ${JSON.stringify(resultado.error.issues)}`,
        );
      }

      entrada.hashUsado = hashAtual;
      entrada.estado = {
        dados: resultado.data,
        geradoEm: versao?.geradoEm ?? null,
        carregando: false,
        erro: null,
      };
    } catch (erro) {
      // Falha de revalidação preserva o último dado válido (degradação, não
      // tela quebrada) — só registra o erro ao lado do que já havia.
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.warn(`SportsLM: falha ao buscar/validar "${url}".`, erro);
      entrada.estado = { ...entrada.estado, carregando: false, erro: mensagem };
    }

    this.notificar(url);
  }
}

/** Instância única compartilhada por toda a SPA (uma busca/cache por URL,
 * não por componente). Testes usam `new ClienteSnapshot({ buscar })` isolado. */
export const clienteSnapshotPadrao = new ClienteSnapshot();
