/**
 * Retenção da tabela final de grupos (ADR-020 item 4, CA-20.3/CA-08.5).
 * Função pura: só `misto` com classificação nova vazia e anterior não vazia
 * retém as linhas anteriores; `mata-mata` nunca publica tabela; demais casos
 * publicam as novas (grupos vazio não retém — CA-16.6).
 */
import type { FormatoCampeonato } from '../../config/campeonatos.schema';
import type { LinhaClassificacao } from '../../dominio/tipos/futebol';

export function resolverTabelaPublicada(
  formato: FormatoCampeonato,
  linhasNovas: readonly LinhaClassificacao[],
  linhasAnteriores: readonly LinhaClassificacao[],
): LinhaClassificacao[] {
  if (formato === 'mata-mata') return [];
  if (formato === 'misto' && linhasNovas.length === 0 && linhasAnteriores.length > 0) {
    return [...linhasAnteriores];
  }
  return [...linhasNovas];
}
