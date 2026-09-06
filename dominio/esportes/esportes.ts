// dominio/esportes/esportes.ts — DOM-02 (TASK.md Lote 3)
//
// Helpers de esporte válido/inválido e de ordenação da Seção 2A do
// PRD-TECNICO (RN-06). Módulo puro, sem I/O (GUARDRAILS.md §5) — reaproveita
// o `EsporteId` canônico e a lista/ordem publicados por DOM-01
// (`dominio/tipos/esportes.ts`), sem duplicar os 15 ids (mesma lógica de
// reaproveitamento já registrada lá: `dominio/` nunca importa de `config/`,
// então isto importa de `../tipos/esportes`, módulo irmão dentro do próprio
// `dominio/`).
//
// Cobre:
// - CA-03.1: apresentar exatamente os 15 esportes da Seção 2A, na ordem.
// - CA-04.8: esporte fora do recorte (RN-06) nunca é exibido.

import { ESPORTE_IDS, esporteIdSchema } from '../tipos/esportes';
import type { EsporteId } from '../tipos/esportes';

/**
 * Os 15 esportes válidos (RN-06), na ordem exata da Seção 2A do PRD-TECNICO —
 * mesma fonte/ordem de `config/esportes.json` (CFG-01) e de `ESPORTE_IDS`
 * (DOM-01). Congelado para impedir mutação acidental por quem consome.
 */
export const ESPORTES_ORDENADOS: readonly EsporteId[] = Object.freeze([...ESPORTE_IDS]);

/** Posição (1-based, igual ao campo `ordem` de `config/esportes.json`) de
 * cada esporte válido na ordem da Seção 2A — evita redigitar a lista sempre
 * que algo precisar ordenar por RN-06. */
const ORDEM_POR_ID: ReadonlyMap<EsporteId, number> = new Map(
  ESPORTES_ORDENADOS.map((id, indice) => [id, indice + 1]),
);

/**
 * Type guard: `true` só para um dos 15 ids de `EsporteId` (RN-06). Qualquer
 * outro valor — incluindo os esportes excluídos com motivo na Seção 2A (ex.:
 * "handebol", "boxe", "ciclismo", "e-sports") ou um slug qualquer não
 * reconhecido — é inválido, isto é, "fora do recorte" (CA-04.8).
 */
export function ehEsporteValido(valor: string): valor is EsporteId {
  return esporteIdSchema.safeParse(valor).success;
}

/** Espelho de `ehEsporteValido`, nomeado pelo caso de uso de CA-04.8: um
 * esporte "fora do recorte" é qualquer valor que não é um dos 15 válidos da
 * Seção 2A (RN-06). */
export function ehEsporteForaDoRecorte(valor: string): boolean {
  return !ehEsporteValido(valor);
}

/**
 * Posição (1-based) de um esporte válido na ordem canônica da Seção 2A
 * (RN-06) — usada para ordenar qualquer coleção que referencie `EsporteId`
 * (ex.: favoritos do onboarding, RF-03) sem redigitar a lista. Lança para um
 * id fora do recorte: quem chama deve filtrar com `ehEsporteValido`/
 * `filtrarEsportesValidos` antes de pedir a posição.
 */
export function posicaoNaOrdemCanonica(esporte: EsporteId): number {
  const posicao = ORDEM_POR_ID.get(esporte);
  if (posicao === undefined) {
    throw new Error(
      `esporte fora do recorte (RN-06), sem posição na ordem canônica: ${String(esporte)}`,
    );
  }
  return posicao;
}

/**
 * Ordena qualquer coleção de itens que referenciam um esporte (por string)
 * pela ordem exata da Seção 2A (RN-06/CA-03.1) — não muta o array recebido.
 * Um item de esporte fora do recorte (CA-04.8) nunca deveria chegar até
 * aqui — normalmente já foi removido por `filtrarEsportesValidos` antes de
 * ordenar; por segurança, caso apareça, é jogado para o fim, preservando a
 * ordem relativa entre si (ordenação estável).
 */
export function ordenarPorEsporte<T>(
  itens: readonly T[],
  obterEsporte: (item: T) => string,
): T[] {
  const posicaoDoItem = (item: T): number => {
    const esporte = obterEsporte(item);
    return ehEsporteValido(esporte)
      ? posicaoNaOrdemCanonica(esporte)
      : Number.POSITIVE_INFINITY;
  };

  return [...itens].sort((a, b) => posicaoDoItem(a) - posicaoDoItem(b));
}

/**
 * Filtra uma coleção mantendo só os itens de esporte válido (um dos 15 da
 * Seção 2A) — implementa CA-04.8 ("esporte fora do recorte... SHALL não
 * exibi-lo") para qualquer lista que referencie esporte por string.
 */
export function filtrarEsportesValidos<T>(
  itens: readonly T[],
  obterEsporte: (item: T) => string,
): T[] {
  return itens.filter((item) => ehEsporteValido(obterEsporte(item)));
}
