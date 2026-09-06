// dominio/campeonatos/ordenacao.ts — DOM-04 (TASK.md Lote 3)
//
// Ordenação da lista de campeonatos do painel do time (CA-07.4, RF-07):
// em-andamento (pela data do próximo jogo) → não-iniciado → eliminado →
// concluído → sem-dados. Módulo puro, sem I/O (GUARDRAILS.md §5) — nenhum
// `Date.now()`, a data "agora" nunca é necessária aqui (a ordenação usa só as
// datas de próximo jogo já calculadas por quem chama).
//
// Decisão de reaproveitamento registrada (TASK.md §6): `ParticipacaoClube`
// (DOM-01, `dominio/tipos/futebol.ts`) já define o enum de `status` usado
// aqui (`'nao-iniciado' | 'em-andamento' | 'eliminado' | 'concluido' |
// 'sem-dados'`) — reexportado como `StatusParticipacao` para não duplicar o
// literal. A ordenação não recebe `ParticipacaoClube`/`Competicao` inteiros
// porque "data do próximo jogo" não é campo de nenhum dos dois tipos do SDD
// §5.2 (é derivado de `Partida`, por quem monta a tela do painel, RF-07) —
// pediria import cruzado desnecessário; a assinatura abaixo pede só o mínimo
// que a regra de CA-07.4 precisa.

import type { ParticipacaoClube } from '../tipos/futebol';

export type StatusParticipacao = ParticipacaoClube['status'];

/** Prioridade de exibição de CA-07.4, menor = mais acima na lista. */
const PRIORIDADE_STATUS: Record<StatusParticipacao, number> = {
  'em-andamento': 0,
  'nao-iniciado': 1,
  eliminado: 2,
  concluido: 3,
  'sem-dados': 4,
};

/** Entrada mínima para ordenar um campeonato na lista do painel (CA-07.4). */
export interface CampeonatoOrdenavel {
  /** `Competicao.id` — só usado pelo chamador para casar de volta o resultado. */
  readonly id: string;
  readonly status: StatusParticipacao;
  /** ISO 8601 da data/hora do próximo jogo do time nesse campeonato, ou
   * `null` quando não há próximo jogo conhecido (sem jogos restantes, ou
   * status diferente de "em-andamento"). Só é usado para desempate dentro do
   * grupo "em-andamento" — irrelevante para os demais grupos. */
  readonly proximoJogoDataHora: string | null;
}

function compararDentroDeEmAndamento(
  a: CampeonatoOrdenavel,
  b: CampeonatoOrdenavel,
): number {
  // Campeonato "em andamento" sem próxima data conhecida (ex.: calendário
  // restante incompleto, CA-10.4) vai para o fim do próprio grupo, nunca para
  // o topo — não priorizamos incerteza sobre certeza.
  if (a.proximoJogoDataHora === null && b.proximoJogoDataHora === null) return 0;
  if (a.proximoJogoDataHora === null) return 1;
  if (b.proximoJogoDataHora === null) return -1;
  return Date.parse(a.proximoJogoDataHora) - Date.parse(b.proximoJogoDataHora);
}

/**
 * Ordena campeonatos para o painel do time (CA-07.4): em-andamento (pela
 * data do próximo jogo, mais próxima primeiro) → não-iniciado → eliminado →
 * concluído → sem-dados. Dentro de não-iniciado/eliminado/concluído/
 * sem-dados a ordem de entrada é preservada (ordenação estável) — CA-07.4 só
 * define critério de desempate para o grupo "em-andamento".
 *
 * Função pura: não muta a lista recebida.
 */
export function ordenarCampeonatos<T extends CampeonatoOrdenavel>(
  campeonatos: readonly T[],
): T[] {
  return [...campeonatos].sort((a, b) => {
    const prioridadeA = PRIORIDADE_STATUS[a.status];
    const prioridadeB = PRIORIDADE_STATUS[b.status];
    if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
    if (a.status === 'em-andamento') return compararDentroDeEmAndamento(a, b);
    return 0; // Array.prototype.sort é estável (ES2019+) — preserva a ordem de entrada.
  });
}
