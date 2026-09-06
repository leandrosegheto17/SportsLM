// dominio/dedup/normalizacao.ts — DOM-03 (TASK.md Lote 3)
//
// Normalização de título e extração de "tokens fortes" para o critério de
// deduplicação (RN-16, ADR-009 passo 1 e passo 4). Módulo puro, sem I/O
// (GUARDRAILS.md §5).
//
// Decisão de detalhe registrada (TASK.md §6): ADR-009 (passo 1) cita
// `config/stopwords-pt-br.json` como origem da lista de stopwords. Esse
// arquivo não existe e não caberia em `config/` como configuração por
// temporada — é parte fixa do próprio algoritmo, não algo que muda por ano.
// Além disso, `dominio/` nunca importa de `config/` (SDD §2.1 — direção
// pipeline/config → domínio, nunca o contrário; mesma decisão já registrada
// em `dominio/tipos/esportes.ts` para DOM-01). Por isso a lista fica como
// constante deste módulo (`STOPWORDS_PT_BR`), com o mesmo papel funcional
// que o ADR previu. Lacuna de nomenclatura, não estrutural — não bloqueia
// DOM-03.

/** Lista fixa de stopwords pt-BR usada só para o cálculo de similaridade de
 * manchetes (ADR-009 passo 1/4) — não é configuração por temporada. */
export const STOPWORDS_PT_BR: ReadonlySet<string> = new Set([
  'a',
  'o',
  'as',
  'os',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'ao',
  'aos',
  'à',
  'às',
  'e',
  'ou',
  'que',
  'com',
  'por',
  'para',
  'pra',
  'sem',
  'sobre',
  'entre',
  'apos',
  'antes',
  'ate',
  'como',
  'mais',
  'menos',
  'muito',
  'muita',
  'seu',
  'sua',
  'seus',
  'suas',
  'se',
  'ja',
  'foi',
  'ser',
  'sao',
  'tem',
  'tem',
  'vai',
  'vao',
  'num',
  'numa',
  'pelo',
  'pela',
  'pelos',
  'pelas',
  'este',
  'esta',
  'esse',
  'essa',
  'isso',
  'isto',
  'nesta',
  'neste',
]);

/** Remove marcas diacríticas (acentos) de um texto já em NFD. */
function removerDiacriticos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normaliza um título para comparação de similaridade (ADR-009 passo 1):
 * minúsculas, remoção de diacríticos, remoção de pontuação, colapso de
 * espaços e remoção de stopwords pt-BR.
 */
export function normalizarTitulo(titulo: string): string {
  const semAcento = removerDiacriticos(titulo.toLowerCase());
  const somenteAlfanumerico = semAcento.replace(/[^a-z0-9\s]/g, ' ');
  const tokens = somenteAlfanumerico
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOPWORDS_PT_BR.has(token));
  return tokens.join(' ');
}

/**
 * "Tokens fortes" (ADR-009 passo 4): tokens com ≥ 4 caracteres do título já
 * normalizado (portanto já fora das stopwords).
 */
export function tokensFortes(tituloNormalizado: string): readonly string[] {
  if (tituloNormalizado.length === 0) {
    return [];
  }
  return tituloNormalizado.split(' ').filter((token) => token.length >= 4);
}

/** Quantidade de tokens fortes em comum entre dois títulos já normalizados. */
export function contarTokensFortesComuns(
  tituloNormalizadoA: string,
  tituloNormalizadoB: string,
): number {
  const conjuntoA = new Set(tokensFortes(tituloNormalizadoA));
  const conjuntoB = new Set(tokensFortes(tituloNormalizadoB));
  let contagem = 0;
  for (const token of conjuntoA) {
    if (conjuntoB.has(token)) {
      contagem += 1;
    }
  }
  return contagem;
}
