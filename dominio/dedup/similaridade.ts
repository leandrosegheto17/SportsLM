// dominio/dedup/similaridade.ts — DOM-03 (TASK.md Lote 3)
//
// Coeficiente de Dice sobre trigramas de caracteres (ADR-009 passo 3) e o
// critério completo de equivalência entre dois itens de notícia (RN-16,
// ADR-009 passos 2 e 4). Módulo puro, sem I/O (GUARDRAILS.md §5) — o relógio
// nunca entra aqui: a janela de 12h compara `publicadoEm` de A com
// `publicadoEm` de B, nunca com "agora".

import { contarTokensFortesComuns, normalizarTitulo } from './normalizacao';

/** Limiar mínimo de Dice para considerar dois títulos equivalentes (ADR-009). */
export const LIMIAR_DICE = 0.82;

/** Quantidade mínima de tokens fortes em comum exigida (ADR-009 passo 4). */
export const MINIMO_TOKENS_FORTES_COMUNS = 2;

/** Janela máxima entre publicações, em milissegundos (RN-16/ADR-009: ≤ 12h). */
export const JANELA_MAXIMA_MS = 12 * 60 * 60 * 1000;

/** Gera os trigramas (janela deslizante de 3 caracteres) de um texto já
 * normalizado, com um espaço de preenchimento nas bordas para que início/fim
 * de palavra também participem da comparação. Retorna a lista completa
 * (multiconjunto — repetições contam), não um `Set`, porque o coeficiente de
 * Dice sobre multiconjunto é mais preciso que sobre conjunto. */
export function gerarTrigramas(textoNormalizado: string): readonly string[] {
  if (textoNormalizado.length === 0) {
    return [];
  }
  const preenchido = ` ${textoNormalizado} `;
  if (preenchido.length < 3) {
    return [preenchido];
  }
  const trigramas: string[] = [];
  for (let indice = 0; indice <= preenchido.length - 3; indice += 1) {
    trigramas.push(preenchido.slice(indice, indice + 3));
  }
  return trigramas;
}

function contarOcorrencias(trigramas: readonly string[]): Map<string, number> {
  const contagens = new Map<string, number>();
  for (const trigrama of trigramas) {
    contagens.set(trigrama, (contagens.get(trigrama) ?? 0) + 1);
  }
  return contagens;
}

/**
 * Coeficiente de Dice sobre multiconjuntos de trigramas:
 * `2 * |intersecção| / (|A| + |B|)`. Retorna 0 quando ambos os textos são
 * vazios (não há o que comparar) e 1 quando os textos normalizados são
 * idênticos e não-vazios.
 */
export function coeficienteDice(
  textoNormalizadoA: string,
  textoNormalizadoB: string,
): number {
  const trigramasA = gerarTrigramas(textoNormalizadoA);
  const trigramasB = gerarTrigramas(textoNormalizadoB);
  if (trigramasA.length === 0 && trigramasB.length === 0) {
    return 0;
  }
  if (trigramasA.length === 0 || trigramasB.length === 0) {
    return 0;
  }
  const contagensA = contarOcorrencias(trigramasA);
  const contagensB = contarOcorrencias(trigramasB);
  let intersecao = 0;
  for (const [trigrama, contagemA] of contagensA) {
    const contagemB = contagensB.get(trigrama);
    if (contagemB !== undefined) {
      intersecao += Math.min(contagemA, contagemB);
    }
  }
  return (2 * intersecao) / (trigramasA.length + trigramasB.length);
}

/** Item mínimo necessário para o cálculo de equivalência/agrupamento
 * (RN-16/ADR-009) — deliberadamente estrutural, não acoplado a `ItemNoticia`
 * inteiro, para servir tanto à ingestão (Lote 4) quanto ao cliente. */
export interface ItemParaDeduplicacao {
  readonly id: string;
  readonly fonteId: string;
  readonly titulo: string;
  readonly publicadoEm: string; // ISO 8601
}

/**
 * Critério completo de equivalência entre dois itens (RN-16, ADR-009):
 * fontes distintas (mesma fonte nunca agrupa), janela ≤ 12h, Dice ≥ 0,82 e
 * ≥ 2 tokens fortes em comum. Data inválida em `publicadoEm` nunca agrupa
 * ("na dúvida, não agrupar" — RN-16).
 */
export function saoEquivalentes(
  a: ItemParaDeduplicacao,
  b: ItemParaDeduplicacao,
): boolean {
  if (a.id === b.id) {
    return false;
  }
  if (a.fonteId === b.fonteId) {
    return false; // RN-16: mesma fonte nunca agrupa.
  }

  const instanteA = Date.parse(a.publicadoEm);
  const instanteB = Date.parse(b.publicadoEm);
  if (Number.isNaN(instanteA) || Number.isNaN(instanteB)) {
    return false; // na dúvida, não agrupar (RN-16).
  }
  if (Math.abs(instanteA - instanteB) > JANELA_MAXIMA_MS) {
    return false;
  }

  const tituloNormalizadoA = normalizarTitulo(a.titulo);
  const tituloNormalizadoB = normalizarTitulo(b.titulo);

  const dice = coeficienteDice(tituloNormalizadoA, tituloNormalizadoB);
  if (dice < LIMIAR_DICE) {
    return false;
  }

  const tokensFortesComuns = contarTokensFortesComuns(
    tituloNormalizadoA,
    tituloNormalizadoB,
  );
  return tokensFortesComuns >= MINIMO_TOKENS_FORTES_COMUNS;
}
