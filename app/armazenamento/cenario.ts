// app/armazenamento/cenario.ts — UI-DS-09 (TASK.md Lote 7)
//
// Leitura/escrita de `Cenario` (SDD §5.3/DOM-01, Should — RF-11/CA-11.9) em
// `localStorage`, chave `sportslm.cenario.v1` (ADR-005). Módulo de I/O —
// fica em `app/`, não em `dominio/` (SDD §2.1/GUARDRAILS.md §5).
//
// CA-13.5 (nenhum dado pessoal): `Cenario` só guarda o escopo
// (temporada:time:rivais-ordenados, todos ids de configuração), palpites por
// id de partida e ids de partidas travadas já vistas — nunca dado do
// torcedor.

import { type Cenario, cenarioSchema } from '../../dominio/tipos';
import {
  armazenamentoEstaDisponivel,
  criarEscritaComDebounce,
  escreverBrutoSemLancar,
  lerBrutoSemLancar,
  removerBrutoSemLancar,
} from './nucleo';

export const CHAVE_ARMAZENAMENTO_CENARIO = 'sportslm.cenario.v1';

/**
 * Escopo do cenário (ADR-005 regra 3): `temporada:time:rivais-ordenados`.
 * Trocar de time ou de rival muda o escopo por construção — não é preciso
 * varrer palpites órfãos, o cenário inteiro do escopo anterior deixa de
 * bater e é descartado na leitura seguinte (CA-06.3/CA-09.4).
 */
export function construirEscopoCenario(
  temporada: number,
  timeId: string,
  rivais: readonly string[],
): string {
  const rivaisOrdenados = [...rivais].sort();
  return `${temporada}:${timeId}:${rivaisOrdenados.join(',')}`;
}

export interface ResultadoLeituraCenario {
  /** `null` quando não há cenário salvo, o armazenamento está indisponível,
   * o dado salvo é inválido, ou o escopo salvo não bate mais com o escopo
   * atual (time/rivais trocaram) — em todos os casos o torcedor simplesmente
   * começa uma simulação nova (CA-11.9 Should, sem erro). */
  cenario: Cenario | null;
  /** `true` quando o `localStorage` está indisponível (modo memória) — a
   * tela informa que o cenário não será guardado, mas a simulação continua
   * funcionando na sessão (CA-11.9). */
  modoMemoria: boolean;
}

/** Lê e valida o cenário salvo, já filtrado pelo escopo atual. */
export function lerCenario(
  escopoAtual: string,
  armazenamento:
    | Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
    | undefined = globalThis.localStorage,
): ResultadoLeituraCenario {
  const modoMemoria = !armazenamentoEstaDisponivel(armazenamento);

  if (modoMemoria) {
    return { cenario: null, modoMemoria: true };
  }

  const bruto = lerBrutoSemLancar(CHAVE_ARMAZENAMENTO_CENARIO, armazenamento);

  if (bruto === null) {
    return { cenario: null, modoMemoria: false };
  }

  let analisado: unknown;
  try {
    analisado = JSON.parse(bruto);
  } catch (erro) {
    console.warn(
      `SportsLM: "${CHAVE_ARMAZENAMENTO_CENARIO}" continha JSON inválido; ignorando.`,
      erro,
    );
    return { cenario: null, modoMemoria: false };
  }

  const resultado = cenarioSchema.safeParse(analisado);

  if (!resultado.success) {
    console.warn(
      `SportsLM: "${CHAVE_ARMAZENAMENTO_CENARIO}" não corresponde ao esquema; ignorando.`,
      resultado.error.issues,
    );
    return { cenario: null, modoMemoria: false };
  }

  if (resultado.data.escopo !== escopoAtual) {
    // Escopo divergente = time/rivais trocaram (ADR-005 regra 3): o
    // cenário salvo não se aplica mais; nada aqui é "referência inválida"
    // individual (CA-13.4), é o objeto inteiro fora de escopo.
    return { cenario: null, modoMemoria: false };
  }

  return { cenario: resultado.data, modoMemoria: false };
}

/** Persiste o cenário imediatamente. Nunca lança — retorna `false` (modo
 * memória) quando não foi possível persistir (CA-11.9). */
export function salvarCenario(
  cenario: Cenario,
  armazenamento: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): boolean {
  return escreverBrutoSemLancar(
    CHAVE_ARMAZENAMENTO_CENARIO,
    JSON.stringify(cenario),
    armazenamento,
  );
}

/**
 * Fábrica de escrita do cenário com *debounce* de 250 ms (ADR-005 regra 1) —
 * uso pretendido pela grade de palpites (UI-T09-01), para não gravar a cada
 * tecla numa navegação por teclado. A leitura e a limpeza continuam
 * imediatas; só a escrita repetida da grade é adiada.
 */
export function criarSalvadorDeCenarioComDebounce(
  armazenamento: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
  atrasoMs = 250,
): (cenario: Cenario) => void {
  const escritaComDebounce = criarEscritaComDebounce(
    (valor) => escreverBrutoSemLancar(CHAVE_ARMAZENAMENTO_CENARIO, valor, armazenamento),
    atrasoMs,
  );

  return (cenario: Cenario) => {
    escritaComDebounce(JSON.stringify(cenario));
  };
}

/** Remove o cenário salvo — usado ao trocar de time/rival (CA-06.3/CA-09.4)
 * ou quando o time do coração sai da temporada corrente (RN-12). */
export function limparCenario(
  armazenamento: Pick<Storage, 'removeItem'> | undefined = globalThis.localStorage,
): void {
  removerBrutoSemLancar(CHAVE_ARMAZENAMENTO_CENARIO, armazenamento);
}
