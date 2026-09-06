// app/armazenamento/telemetriaId.ts — apoio a UI-T03-02 (TASK.md Lote 9)
//
// "Desativar e apagar id" (UX-SPEC §3/T-03, RNF-07/ADR-012 regra 2): o
// identificador anônimo de telemetria vive em `sportslm.anonimo.v1` — chave
// já definida por ADR-012 ("UUID v4 gerado no dispositivo, guardado em
// `sportslm.anonimo.v1` [...] reiniciável por um botão nas configurações"),
// mesmo antes de `TEL-01` (módulo `telemetria`, Lote 12) existir.
//
// Este módulo NÃO gera identificador nem envia evento algum (isso é TEL-01,
// fora do escopo desta tarefa — Diretriz do Coordenador na atribuição de
// UI-T03-02: "não invente um mecanismo de telemetria aqui"). Ele só documenta
// a interface esperada e limpa a chave já convencionada, para que o botão de
// Configurações funcione corretamente:
// - hoje, é um no-op seguro (a chave nunca existiu, `TEL-01` ainda não
//   escreve nela);
// - quando `TEL-01` for implementado usando esta MESMA chave (a única
//   convenção já registrada, ADR-012), o botão passa a apagar de fato o
//   identificador salvo, sem precisar tocar em `Configuracoes.tsx` de novo.
//
// Mesmo padrão de `armazenamento/cenario.ts#limparCenario` (nunca lança,
// degrada em silêncio via `removerBrutoSemLancar`).

import { removerBrutoSemLancar } from './nucleo';

/** ADR-012, regra 2 — convenção já fixada, não uma decisão desta tarefa. */
export const CHAVE_ARMAZENAMENTO_ANONIMO = 'sportslm.anonimo.v1';

/**
 * Apaga o identificador anônimo local (ADR-012). Nunca lança; sem efeito
 * quando a chave não existe (caso atual, antes de `TEL-01`) ou quando o
 * `localStorage` está indisponível (modo memória).
 */
export function apagarIdentificadorAnonimo(
  armazenamento: Pick<Storage, 'removeItem'> | undefined = globalThis.localStorage,
): void {
  removerBrutoSemLancar(CHAVE_ARMAZENAMENTO_ANONIMO, armazenamento);
}
