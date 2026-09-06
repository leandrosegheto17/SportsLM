// app/armazenamento/preferencias.ts — UI-DS-09 (TASK.md Lote 7)
//
// Leitura/escrita de `Preferencias` (SDD §5.3/DOM-01) em `localStorage`,
// chave `sportslm.preferencias.v1` (ADR-005). Módulo de I/O — fica em
// `app/`, não em `dominio/` (SDD §2.1/GUARDRAILS.md §5); importa o schema
// Zod de `dominio/tipos/estado-local.ts` (DOM-01) para nunca confiar em
// conteúdo lido do `localStorage` sem validar antes (TASK.md Diretriz #6).
//
// CA-13.5 (nenhum dado pessoal): `Preferencias` só guarda ids de
// configuração do próprio produto (esporte, fonte, clube) e uma data-hora de
// atualização — nunca nome, e-mail, IP ou qualquer identificador do
// torcedor. Este módulo nunca adiciona campo além dos definidos em DOM-01.
//
// REFAT-09-01 (TASK.md Refatoração Lote-9): `Home`/`Configuracoes`/
// `EscolherTime` convivem montados simultaneamente (sem rota,
// `ProvedorSobreposicoes`), então uma mudança salva por uma tela precisa
// refletir nas demais sem remontagem (CA-02.1: "sem recarregar a página").
// Este módulo expõe um emissor mínimo (`assinarMudancasPreferencias`/
// `obterVersaoPreferencias`), acionado por `salvarPreferencias` — sem
// nenhuma biblioteca de estado global nova (Diretriz de Implementação #3):
// quem consome (`Home.tsx`) usa `useSyncExternalStore`, API nativa do React,
// para recalcular a leitura quando a "versão" muda. Este módulo continua
// sem importar React (é I/O puro, SDD §2.1) — a integração com hooks fica a
// cargo de quem consome.

import {
  type EsporteId,
  type Preferencias,
  preferenciasSchema,
} from '../../dominio/tipos';
import {
  armazenamentoEstaDisponivel,
  escreverBrutoSemLancar,
  lerBrutoSemLancar,
} from './nucleo';

export const CHAVE_ARMAZENAMENTO_PREFERENCIAS = 'sportslm.preferencias.v1';

/** Conjuntos de referências válidas na configuração corrente (CA-13.4):
 * quem chama este módulo é quem conhece o catálogo atual (esportes, fontes,
 * clubes da temporada) — este módulo não importa `config/` diretamente
 * (`dominio`/armazenamento não decidem o catálogo, só validam contra ele). */
export interface ReferenciasValidas {
  esportesValidos: ReadonlySet<EsporteId>;
  fontesValidas: ReadonlySet<string>;
  /** Clubes elegíveis na temporada corrente (RN-04/RN-12) — usado tanto para
   * `timeId` quanto para `rivais`. */
  clubesValidos: ReadonlySet<string>;
}

export interface ResultadoLeituraPreferencias {
  /** Preferências já com toda referência inválida descartada individualmente
   * (CA-13.4) — nunca o objeto inteiro descartado por causa de UM campo. */
  preferencias: Preferencias;
  /** Mensagens legíveis do que foi descartado, uma por referência inválida
   * (CA-13.4: "informar o que foi descartado"). Vazio quando nada foi
   * descartado. */
  descartes: string[];
  /** `true` quando o time salvo não pertence mais à lista de clubes válidos
   * da temporada corrente (RN-12) — o chamador aplica o fluxo de CA-06.5
   * (aviso de virada de temporada) e também deve limpar o cenário salvo
   * (`limparCenario`, `app/armazenamento/cenario.ts`), já que ele perde o
   * escopo junto com o time. */
  timeForaDaTemporada: boolean;
  /** `true` quando o `localStorage` está indisponível (modo memória,
   * CA-13.3/ADR-005 regra 4) — o chamador decide como informar o torcedor. */
  modoMemoria: boolean;
}

function criarPreferenciasPadrao(temporada: number, agora: Date): Preferencias {
  return {
    versaoEsquema: 1,
    temporada,
    favoritos: [],
    fontesBloqueadas: [],
    timeId: null,
    rivais: [],
    atualizadoEm: agora.toISOString(),
  };
}

/**
 * Lê e valida `Preferencias` do `localStorage` (CA-13.2 a CA-13.5).
 *
 * Ordem de validação (ADR-005 regra 2):
 * 1. Nada salvo ou `localStorage` indisponível ⇒ padrão vazio (CA-13.3).
 * 2. JSON inválido ou esquema estruturalmente incompatível (versão errada,
 *    tipo errado) ⇒ objeto inteiro descartado, padrão vazio — esquema
 *    incompatível não é "referência inválida", é dado não confiável.
 * 3. Esquema estruturalmente válido, mas referenciando fonte/clube/rival que
 *    não existe mais na configuração corrente ⇒ CA-13.4: cada referência
 *    inválida é removida individualmente, o resto é mantido.
 */
export function lerPreferencias(
  referencias: ReferenciasValidas,
  temporadaAtual: number,
  armazenamento:
    | Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
    | undefined = globalThis.localStorage,
  agora: Date = new Date(),
): ResultadoLeituraPreferencias {
  const modoMemoria = !armazenamentoEstaDisponivel(armazenamento);
  const padrao = criarPreferenciasPadrao(temporadaAtual, agora);

  if (modoMemoria) {
    return {
      preferencias: padrao,
      descartes: [],
      timeForaDaTemporada: false,
      modoMemoria: true,
    };
  }

  const bruto = lerBrutoSemLancar(CHAVE_ARMAZENAMENTO_PREFERENCIAS, armazenamento);

  if (bruto === null) {
    return {
      preferencias: padrao,
      descartes: [],
      timeForaDaTemporada: false,
      modoMemoria: false,
    };
  }

  let analisado: unknown;
  try {
    analisado = JSON.parse(bruto);
  } catch (erro) {
    console.warn(
      `SportsLM: "${CHAVE_ARMAZENAMENTO_PREFERENCIAS}" continha JSON inválido; iniciando onboarding.`,
      erro,
    );
    return {
      preferencias: padrao,
      descartes: [],
      timeForaDaTemporada: false,
      modoMemoria: false,
    };
  }

  const resultado = preferenciasSchema.safeParse(analisado);

  if (!resultado.success) {
    console.warn(
      `SportsLM: "${CHAVE_ARMAZENAMENTO_PREFERENCIAS}" não corresponde ao esquema; iniciando onboarding.`,
      resultado.error.issues,
    );
    return {
      preferencias: padrao,
      descartes: [],
      timeForaDaTemporada: false,
      modoMemoria: false,
    };
  }

  const salvas = resultado.data;
  const descartes: string[] = [];

  const favoritos = salvas.favoritos.filter((esporte) => {
    const valido = referencias.esportesValidos.has(esporte);
    if (!valido) {
      descartes.push(
        `esporte favorito "${esporte}" não existe mais na configuração atual`,
      );
    }
    return valido;
  });

  const fontesBloqueadas = salvas.fontesBloqueadas.filter((fonte) => {
    const valida = referencias.fontesValidas.has(fonte);
    if (!valida) {
      descartes.push(`fonte bloqueada "${fonte}" não existe mais na configuração atual`);
    }
    return valida;
  });

  const timeForaDaTemporada =
    salvas.timeId !== null && !referencias.clubesValidos.has(salvas.timeId);

  if (timeForaDaTemporada) {
    descartes.push(
      `time do coração "${salvas.timeId as string}" não está mais na Série A da temporada corrente (RN-12)`,
    );
  }

  const timeId = timeForaDaTemporada ? null : salvas.timeId;

  // RN-12/CA-06.5: perder o time descarta os rivais junto (o cenário, que
  // depende de temporada+time+rivais, é responsabilidade de
  // `app/armazenamento/cenario.ts` — o chamador aciona `limparCenario`
  // quando `timeForaDaTemporada` for `true`).
  const rivais = timeForaDaTemporada
    ? []
    : salvas.rivais.filter((rival) => {
        const valido = referencias.clubesValidos.has(rival);
        if (!valido) {
          descartes.push(`rival "${rival}" não existe mais na configuração atual`);
        }
        return valido;
      });

  const preferencias: Preferencias = {
    ...salvas,
    favoritos,
    fontesBloqueadas,
    timeId,
    rivais,
  };

  return { preferencias, descartes, timeForaDaTemporada, modoMemoria: false };
}

/**
 * Persiste `Preferencias` imediatamente (CA-13.1). Nunca lança — retorna
 * `false` (modo memória) quando o `localStorage` não aceitou a escrita, para
 * o chamador decidir se exibe o aviso de CA-13.3.
 *
 * REFAT-09-01: sempre notifica os assinantes (`notificarMudancaPreferencias`)
 * ao final, mesmo em modo memória — o valor mudou para a sessão corrente de
 * qualquer forma (mesmo racional já aplicado pelo estado local de
 * `Configuracoes.tsx`, que atualiza sua própria UI independente do retorno
 * de persistência); quem só lê de `localStorage` (`Home.tsx`) simplesmente
 * não verá a mudança em modo memória, limitação pré-existente e fora do
 * escopo deste achado.
 */
export function salvarPreferencias(
  preferencias: Preferencias,
  armazenamento: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): boolean {
  const persistiu = escreverBrutoSemLancar(
    CHAVE_ARMAZENAMENTO_PREFERENCIAS,
    JSON.stringify(preferencias),
    armazenamento,
  );
  notificarMudancaPreferencias();
  return persistiu;
}

/** Contador de versão incrementado a cada `salvarPreferencias` bem-sucedida
 * ou não (ver nota acima) — o valor em si não tem significado, só serve
 * para o React (`useSyncExternalStore`) saber quando recalcular. */
let versaoPreferencias = 0;
const ouvintesMudancaPreferencias = new Set<() => void>();

/** Assina mudanças de preferências — API compatível com o parâmetro
 * `subscribe` de `useSyncExternalStore`. Retorna a função de cancelamento. */
export function assinarMudancasPreferencias(ouvinte: () => void): () => void {
  ouvintesMudancaPreferencias.add(ouvinte);
  return () => {
    ouvintesMudancaPreferencias.delete(ouvinte);
  };
}

/** Snapshot atual da versão — API compatível com `getSnapshot`/
 * `getServerSnapshot` de `useSyncExternalStore`. */
export function obterVersaoPreferencias(): number {
  return versaoPreferencias;
}

function notificarMudancaPreferencias(): void {
  versaoPreferencias += 1;
  for (const ouvinte of ouvintesMudancaPreferencias) {
    ouvinte();
  }
}
