// COB-16 (RF-22, CA-20.4): distingue "provedor cobre a liga" de "provedor
// respondeu vazio". Função pura; o orquestrador a consome (COB-20).

import type { LinhaClassificacao, Partida } from '../../dominio/tipos/futebol';

export interface DescarteLote {
  /** Ex.: `fora-do-recorte`. Qualquer descarte prova que havia eventos. */
  motivo: string;
}

export interface LoteColetado {
  linhas: readonly LinhaClassificacao[];
  partidas: readonly Partida[];
  descartes: readonly DescarteLote[];
}

export type ResultadoClassificadoLiga = 'atualizada' | 'sem-dados-provedor';

/** `sem-dados-provedor` (sem eventos nem tabela) não carimba `ultimaAtualizacao`. */
export function classificarResultadoLiga(lote: LoteColetado): ResultadoClassificadoLiga {
  const temDados =
    lote.linhas.length > 0 || lote.partidas.length > 0 || lote.descartes.length > 0;
  return temDados ? 'atualizada' : 'sem-dados-provedor';
}
