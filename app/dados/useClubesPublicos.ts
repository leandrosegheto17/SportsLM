// app/dados/useClubesPublicos.ts — UI-T02-01 (TASK.md Lote 8)
//
// Hook de leitura de `/dados/config/clubes-2026.json` (SDD §2.2) — arquivo de
// configuração por temporada, cache "longo", fora do contrato de
// revalidação por hash de `versao.json` (ver `app/dados/README.md`: "os
// arquivos de configuração de temporada [...] não passam por este hook"
// referindo-se a `useSnapshot`/UI-DS-08). Este módulo é o equivalente mínimo
// para arquivos de `config/*`: busca uma única vez por sessão (cache
// module-level, compartilhado entre instâncias, mesmo espírito de
// `ClienteSnapshot`), nunca revalida — o catálogo de clubes só muda na
// virada de temporada, fora do ciclo de vida da aba.
//
// Novo nesta tarefa: nenhuma infraestrutura equivalente existia ainda para
// `config/*.json` (só `useSnapshot`, dedicado aos 4 arquivos com hash em
// `versao.json`). Outras tarefas paralelas do Lote 8/9 que também precisam da
// lista de clubes com paleta derivada (ex.: UI-T01-02 "escolher time",
// UI-T04-01 "trocar time") podem reaproveitar este hook; se uma instância
// paralela já tiver criado algo equivalente, é refino de consolidação para o
// Coordenador, não conflito de contrato (o arquivo/schema de origem é o
// mesmo).

import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  clubesPublicosSchema,
  URL_CONFIG_CLUBES,
  type ClubePublico,
} from './configPublico';

export interface EstadoClubesPublicos {
  /** `null` até a primeira busca bem-sucedida. */
  clubes: ClubePublico[] | null;
  /** `true` só até a primeira resolução (sucesso ou falha). */
  carregando: boolean;
  erro: string | null;
}

interface EstadoInterno {
  atual: EstadoClubesPublicos;
  ouvintes: Set<() => void>;
  promessa: Promise<void> | null;
}

function estadoInicial(): EstadoClubesPublicos {
  return { clubes: null, carregando: true, erro: null };
}

const estadoGlobal: EstadoInterno = {
  atual: estadoInicial(),
  ouvintes: new Set(),
  promessa: null,
};

function notificar(): void {
  for (const ouvinte of estadoGlobal.ouvintes) {
    ouvinte();
  }
}

function garantir(buscar: typeof fetch): Promise<void> {
  if (estadoGlobal.atual.clubes !== null) {
    return Promise.resolve();
  }
  if (estadoGlobal.promessa) {
    return estadoGlobal.promessa;
  }

  estadoGlobal.promessa = (async () => {
    try {
      const resposta = await buscar(URL_CONFIG_CLUBES);
      if (!resposta.ok) {
        throw new Error(`HTTP ${String(resposta.status)} ao buscar ${URL_CONFIG_CLUBES}`);
      }

      const bruto: unknown = await resposta.json();
      const resultado = clubesPublicosSchema.safeParse(bruto);
      if (!resultado.success) {
        throw new Error(
          `esquema inválido em ${URL_CONFIG_CLUBES}: ${JSON.stringify(resultado.error.issues)}`,
        );
      }

      estadoGlobal.atual = { clubes: resultado.data, carregando: false, erro: null };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.warn(`SportsLM: falha ao buscar/validar "${URL_CONFIG_CLUBES}".`, erro);
      estadoGlobal.atual = { ...estadoGlobal.atual, carregando: false, erro: mensagem };
    } finally {
      estadoGlobal.promessa = null;
      notificar();
    }
  })();

  return estadoGlobal.promessa;
}

export interface OpcoesUseClubesPublicos {
  /** Injeção de `fetch` para teste; padrão é o `fetch` global do navegador. */
  buscar?: typeof fetch;
}

/** Lê e mantém em cache (por sessão de aba) o catálogo de clubes publicado
 * (com paleta derivada, ADR-017). Não faz polling nem revalida — cache
 * "longo" (SDD §2.2). */
export function useClubesPublicos(
  opcoes: OpcoesUseClubesPublicos = {},
): EstadoClubesPublicos {
  const buscar = opcoes.buscar ?? globalThis.fetch.bind(globalThis);

  const estado = useSyncExternalStore<EstadoClubesPublicos>(
    (ouvir) => {
      estadoGlobal.ouvintes.add(ouvir);
      return () => {
        estadoGlobal.ouvintes.delete(ouvir);
      };
    },
    () => estadoGlobal.atual,
    () => estadoGlobal.atual,
  );

  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  useEffect(() => {
    void garantir(buscarRef.current);
  }, []);

  return estado;
}

/** Reseta o cache module-level entre casos de teste — nunca usado em produção. */
export function resetarCacheClubesPublicosParaTeste(): void {
  estadoGlobal.atual = estadoInicial();
  estadoGlobal.promessa = null;
  estadoGlobal.ouvintes.clear();
}
