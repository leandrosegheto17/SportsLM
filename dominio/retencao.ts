// dominio/retencao.ts — ING-N-06 (TASK.md Lote 4)
//
// Componente `retencao` do pipeline de ingestão de notícias (SDD §2.1, §2.3):
// "Descarta item com mais de 7 dias fora dos 30 mais recentes de qualquer
// visão" (CA-15.8, RN-07), com teto de 60 itens por fonte (SDD §2.2). Módulo
// puro, sem I/O (GUARDRAILS.md §5): "agora" e a "data de corte" sempre
// entram por parâmetro, nunca `Date.now()`.
//
// Interpretação de "30 mais recentes de qualquer visão" (CA-15.8), registrada
// aqui por não haver definição formal de "visão" em nenhum artefato (não é
// lacuna que bloqueia a tarefa — é detalhe de implementação fundamentado
// diretamente no próprio SDD): SDD §2.2 justifica o teto de 60/fonte assim —
// "o feed mostra 30 itens das fontes não bloqueadas; se o usuário bloquear 4
// das 5, ainda precisam existir 30 itens da fonte restante". A pior "visão"
// possível é portanto a de uma única fonte restante (as demais 4
// bloqueadas): para que essa visão sempre tenha 30 itens disponíveis, cada
// fonte precisa reter, sozinha, os seus próprios 30 itens mais recentes,
// mesmo que tenham mais de 7 dias. Isso também cobre automaticamente a visão
// "geral" (todas as fontes não bloqueadas, RF-04): qualquer item que esteja
// entre os 30 mais recentes considerando todas as fontes juntas está,
// necessariamente, entre os 30 mais recentes da sua própria fonte (não pode
// haver 30 itens de outras fontes mais recentes que ele sem que ele já tenha
// caído fora do top-30 geral). Por isso a regra concreta implementada é:
// "por fonte, mantém o item se está dentro dos 7 dias OU está entre os 30
// mais recentes daquela fonte", com o teto de 60/fonte aplicado por cima
// (nunca mantém mais que 60 itens de uma mesma fonte, mesmo todos dentro dos
// 7 dias) — exatamente o dimensionamento do SDD §2.2 (≤ 300 itens totais).

import type { ItemNoticia } from './tipos/noticias';

/** RN-07: retenção padrão em dias (SDD §3.2, "a confirmar" no PRD-TECNICO, fixado no SDD). */
export const RETENCAO_DIAS = 7;

/** CA-15.8 / SDD §2.2: itens mais recentes de uma fonte que sobrevivem à retenção mesmo com mais de 7 dias. */
export const TOP_N_MAIS_RECENTES_POR_FONTE = 30;

/** SDD §2.2: teto duro de itens retidos por fonte (dimensionamento de `noticias.json`). */
export const TETO_ITENS_POR_FONTE = 60;

export interface OpcoesRetencao {
  /** RN-07, em dias. Padrão: `RETENCAO_DIAS` (7). */
  retencaoDias?: number;
  /** CA-15.8. Padrão: `TOP_N_MAIS_RECENTES_POR_FONTE` (30). */
  topNMaisRecentesPorFonte?: number;
  /** SDD §2.2. Padrão: `TETO_ITENS_POR_FONTE` (60). */
  tetoPorFonte?: number;
}

/** `Date.parse` de `publicadoEm`; data inválida vira "a mais antiga possível"
 * (nunca elegível por estar "dentro da retenção", nunca ocupa por engano uma
 * vaga de "mais recente") — mesma postura defensiva de `dominio/frescor.ts`,
 * "na dúvida, não favorece o item". Em uso normal `publicadoEm` já passou por
 * `normalizador-item` (ING-N-02) e é sempre uma data válida. */
function paraTimestamp(publicadoEm: string): number {
  const timestamp = Date.parse(publicadoEm);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

/** Mais recente primeiro; empate de data desempata por `id` (ordem estável e determinística). */
function compararMaisRecentePrimeiro(a: ItemNoticia, b: ItemNoticia): number {
  const diferenca = paraTimestamp(b.publicadoEm) - paraTimestamp(a.publicadoEm);
  if (diferenca !== 0) {
    return diferenca;
  }
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Aplica a retenção de RN-07/CA-15.8 a uma lista de itens de notícia.
 *
 * Por fonte (`fonteId`): mantém o item se ele está dentro de `retencaoDias`
 * de `agora` **ou** está entre os `topNMaisRecentesPorFonte` mais recentes
 * daquela fonte; em seguida, corta o resultado em `tetoPorFonte` (os mais
 * recentes primeiro) — nunca mantém mais que o teto de uma mesma fonte,
 * mesmo que todos estejam dentro da retenção.
 *
 * Função pura: não muta `itens`; preserva a ordem relativa de entrada no
 * retorno (é um filtro, não uma reordenação — a ordenação da tela é
 * responsabilidade de quem consome, RN-18).
 */
export function aplicarRetencao(
  itens: readonly ItemNoticia[],
  agora: Date,
  opcoes: OpcoesRetencao = {},
): ItemNoticia[] {
  const retencaoDias = opcoes.retencaoDias ?? RETENCAO_DIAS;
  const topN = opcoes.topNMaisRecentesPorFonte ?? TOP_N_MAIS_RECENTES_POR_FONTE;
  const teto = opcoes.tetoPorFonte ?? TETO_ITENS_POR_FONTE;

  const corteMs = agora.getTime() - retencaoDias * 86_400_000;

  const porFonte = new Map<string, ItemNoticia[]>();
  for (const item of itens) {
    const listaExistente = porFonte.get(item.fonteId);
    if (listaExistente === undefined) {
      porFonte.set(item.fonteId, [item]);
    } else {
      listaExistente.push(item);
    }
  }

  const idsAManter = new Set<string>();

  for (const listaDaFonte of porFonte.values()) {
    const ordenadaPorRecencia = [...listaDaFonte].sort(compararMaisRecentePrimeiro);

    const elegiveis: ItemNoticia[] = [];
    ordenadaPorRecencia.forEach((item, posicao) => {
      const dentroDaRetencao = paraTimestamp(item.publicadoEm) >= corteMs;
      const entreOsMaisRecentes = posicao < topN; // CA-15.8 / SDD §2.2
      if (dentroDaRetencao || entreOsMaisRecentes) {
        elegiveis.push(item);
      }
    });

    // Teto duro por fonte (SDD §2.2): corta sobre os já elegíveis, mais
    // recentes primeiro — nunca ultrapassa `tetoPorFonte` itens de uma
    // mesma fonte, mesmo que todos estivessem dentro da retenção.
    for (const item of elegiveis.slice(0, teto)) {
      idsAManter.add(item.id);
    }
  }

  return itens.filter((item) => idsAManter.has(item.id));
}
