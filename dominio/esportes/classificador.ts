// dominio/esportes/classificador.ts — ING-N-03 (TASK.md Lote 4)
//
// `classificador-esportes` (SDD §2.1, ADR-008): cascata de 4 níveis, sem IA,
// para decidir o `esporte` (`EsporteOuTriagem`) de um `ItemNoticia` recém
// ingerido (CA-15.4, CA-04.7, CA-04.8). Módulo puro, sem I/O
// (GUARDRAILS.md §5): recebe o item já normalizado e a configuração (léxico +
// mapa de categorias) já em mãos — quem lê `config/lexico-esportes.json` e
// `config/categorias-fonte.json` do disco é responsabilidade de quem chama
// (ex.: a orquestração de ING-N-07), não deste módulo.
//
// Cascata (ADR-008):
//   1. `esporteFixadoDoFeed` (ADR-007 `feed.esporteFixado`) → confiança alta,
//      não é inferência.
//   2. `<category>`/tag do item casa com `config/categorias-fonte.json` (por
//      fonte) → confiança alta.
//   3. Léxico ponderado sobre título+resumo: vence quem tem pontuação ≥ 2 E
//      vantagem ≥ 2 sobre o segundo colocado (empate ⇒ sem vencedor).
//   4. Sem vencedor: fonte multi-esporte → "geral"; fonte mono-esporte →
//      esporte da fonte.
//
// `fora-do-recorte` (CA-04.8) é tratado como mais um candidato do nível 3
// (léxico curto de esportes reconhecidos fora dos 15, ADR-008) — ganha a
// cascata como qualquer outro candidato, mas nunca cai no nível 1/2 (nenhum
// feed fica fixado num esporte fora do recorte, por construção de
// `EsporteId`/ADR-007).

import { esporteIdSchema } from '../tipos/esportes';
import type { EsporteId, EsporteOuTriagem } from '../tipos/esportes';

/** Peso do termo no léxico (ADR-008): 3 = nome do esporte/termo inequívoco,
 * 2 = entidade (clube, liga, sigla), 1 = termo ambíguo (nunca decide sozinho,
 * porque a regra de vitória exige pontuação ≥ 2). */
export type PesoLexico = 1 | 2 | 3;

export interface TermoLexico {
  /** Forma "crua" do termo, em pt-BR — a normalização (minúsculas, sem
   * acento/pontuação) acontece dentro deste módulo, não na configuração. */
  readonly termo: string;
  readonly peso: PesoLexico;
}

export interface EntradaLexicoEsporte {
  readonly esporte: EsporteId;
  readonly termos: readonly TermoLexico[];
}

export interface EntradaLexicoForaDoRecorte {
  /** Nome do esporte fora do recorte (ex.: "handebol") — só para
   * documentação/depuração; o resultado da classificação é sempre o literal
   * `'fora-do-recorte'`, nunca este nome. */
  readonly nome: string;
  readonly termos: readonly TermoLexico[];
}

/** `config/lexico-esportes.json` (ADR-008), já validado/carregado por quem
 * chama este módulo. */
export interface LexicoEsportes {
  readonly porEsporte: readonly EntradaLexicoEsporte[];
  readonly foraDoRecorte: readonly EntradaLexicoForaDoRecorte[];
}

/** `config/categorias-fonte.json` (ADR-008 nível 2): por fonte, um mapa de
 * categoria/tag do item (já normalizada — minúsculas, sem acento/pontuação,
 * ver `normalizarTexto`) para o `EsporteId` correspondente. */
export type MapaCategoriasPorFonte = Readonly<
  Record<string, Readonly<Record<string, EsporteId>>>
>;

export interface ItemParaClassificar {
  readonly fonteId: string;
  /** `feed.esporteFixado` do catálogo (ADR-007) — nível 1. */
  readonly esporteFixadoDoFeed: EsporteId | null;
  /** `<category>`/tag do item, forma crua (sem normalizar) — nível 2. */
  readonly categoria: string | null;
  readonly titulo: string;
  readonly resumo: string | null;
  /** `Fonte.esportesCobertos` — usado só no nível 4 (fonte mono-esporte). */
  readonly esportesCobertosPelaFonte: readonly EsporteId[];
}

export interface ResultadoClassificacao {
  readonly esporte: EsporteOuTriagem;
  readonly origemClassificacao:
    | 'feed-fixado'
    | 'categoria'
    | 'lexico'
    | 'nao-classificado';
}

/** Pontuação mínima para um candidato do léxico vencer (ADR-008). */
const PONTUACAO_MINIMA_VENCEDORA = 2;
/** Vantagem mínima sobre o segundo colocado para o léxico decidir (ADR-008). */
const VANTAGEM_MINIMA_VENCEDORA = 2;

/**
 * Normaliza texto para casamento de léxico/categoria (ADR-008): minúsculas,
 * remoção de acento (NFD), remoção de pontuação (mantém letra/número/espaço),
 * espaços colapsados. Usada tanto para o texto do item quanto para os termos
 * do léxico/chaves de categoria, para que o casamento seja simétrico.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '') // remove marcas de acento (NFD)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Escapa caractere especial de regex — usado para montar o casamento de
 * termo por palavra inteira a partir de um termo de configuração arbitrário. */
function escaparRegex(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * `true` se `termo` aparece em `textoNormalizado` como palavra(s) inteira(s)
 * — nunca como substring dentro de outra palavra (ADR-008: "surfe" não deve
 * casar dentro de "surfista"). Ambos os lados já devem ter passado por
 * `normalizarTexto` (ou serem normalizados aqui, no caso do termo).
 */
function contemTermo(textoNormalizado: string, termo: string): boolean {
  const termoNormalizado = normalizarTexto(termo);
  if (termoNormalizado === '') return false;
  const padrao = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaparRegex(termoNormalizado)}(?![\\p{L}\\p{N}])`,
    'u',
  );
  return padrao.test(textoNormalizado);
}

/** Soma os pesos dos termos de `termos` que aparecem em `textoNormalizado`
 * (cada termo conta no máximo uma vez, independente de repetição no texto). */
function pontuarTermos(textoNormalizado: string, termos: readonly TermoLexico[]): number {
  return termos.reduce(
    (soma, termo) =>
      contemTermo(textoNormalizado, termo.termo) ? soma + termo.peso : soma,
    0,
  );
}

interface Candidato {
  readonly label: EsporteOuTriagem;
  readonly pontuacao: number;
}

/**
 * Nível 3 da cascata (ADR-008): calcula a pontuação de cada um dos 15
 * esportes e do léxico curto de "fora do recorte" sobre título+resumo, e
 * devolve o vencedor só se pontuação ≥ 2 **e** vantagem ≥ 2 sobre o segundo
 * colocado — caso contrário, `null` (cai para o nível 4).
 */
function classificarPorLexico(
  item: Pick<ItemParaClassificar, 'titulo' | 'resumo'>,
  lexico: LexicoEsportes,
): EsporteOuTriagem | null {
  const texto = normalizarTexto(`${item.titulo} ${item.resumo ?? ''}`);

  const candidatosPorEsporte: Candidato[] = lexico.porEsporte.map((entrada) => ({
    label: entrada.esporte,
    pontuacao: pontuarTermos(texto, entrada.termos),
  }));

  const pontuacaoForaDoRecorte = lexico.foraDoRecorte.reduce(
    (maximo, entrada) => Math.max(maximo, pontuarTermos(texto, entrada.termos)),
    0,
  );

  const candidatos: Candidato[] = [
    ...candidatosPorEsporte,
    { label: 'fora-do-recorte' as const, pontuacao: pontuacaoForaDoRecorte },
  ].sort((a, b) => b.pontuacao - a.pontuacao);

  const primeiro = candidatos[0];
  const segundo = candidatos[1];
  if (primeiro === undefined) return null;

  const vantagem = primeiro.pontuacao - (segundo?.pontuacao ?? 0);
  if (
    primeiro.pontuacao >= PONTUACAO_MINIMA_VENCEDORA &&
    vantagem >= VANTAGEM_MINIMA_VENCEDORA
  ) {
    return primeiro.label;
  }
  return null;
}

/**
 * Nível 4 da cascata (ADR-008): sem vencedor no léxico. Fonte mono-esporte
 * (`esportesCobertosPelaFonte` com exatamente 1 item) herda o esporte da
 * fonte; qualquer outro caso (multi-esporte, ou catálogo malformado com 0
 * esportes cobertos) cai em `'geral'`.
 */
function classificarPorFonte(
  esportesCobertosPelaFonte: readonly EsporteId[],
): EsporteOuTriagem {
  if (esportesCobertosPelaFonte.length === 1) {
    const unico = esportesCobertosPelaFonte[0];
    if (unico !== undefined && esporteIdSchema.safeParse(unico).success) {
      return unico;
    }
  }
  return 'geral';
}

/**
 * Classifica um item de notícia num dos 15 esportes, `'geral'` ou
 * `'fora-do-recorte'` (CA-15.4/CA-04.7/CA-04.8), pela cascata de 4 níveis do
 * ADR-008. Função pura e determinística (RN-18): a mesma entrada produz
 * sempre a mesma saída.
 */
export function classificarEsporte(
  item: ItemParaClassificar,
  lexico: LexicoEsportes,
  categoriasPorFonte: MapaCategoriasPorFonte,
): ResultadoClassificacao {
  // Nível 1 — feed fixado (ADR-007).
  if (item.esporteFixadoDoFeed !== null) {
    return { esporte: item.esporteFixadoDoFeed, origemClassificacao: 'feed-fixado' };
  }

  // Nível 2 — categoria/tag do item vs. mapa de categorias da fonte.
  if (item.categoria !== null) {
    const mapaDaFonte = categoriasPorFonte[item.fonteId];
    if (mapaDaFonte !== undefined) {
      const chave = normalizarTexto(item.categoria);
      const esporte = mapaDaFonte[chave];
      if (esporte !== undefined) {
        return { esporte, origemClassificacao: 'categoria' };
      }
    }
  }

  // Nível 3 — léxico ponderado (inclui o léxico curto de "fora do recorte").
  const vencedorDoLexico = classificarPorLexico(item, lexico);
  if (vencedorDoLexico !== null) {
    return { esporte: vencedorDoLexico, origemClassificacao: 'lexico' };
  }

  // Nível 4 — sem vencedor: "geral" (multi-esporte) ou esporte da fonte
  // (mono-esporte).
  return {
    esporte: classificarPorFonte(item.esportesCobertosPelaFonte),
    origemClassificacao: 'nao-classificado',
  };
}
