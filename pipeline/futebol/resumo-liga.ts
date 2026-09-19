/**
 * COB-18 (RNF-19) — resumo por liga: contagens e descartes. Função pura.
 * Não recebe nem emite corpo de resposta, token ou nomes do provedor.
 */
import type { InconsistenciaPartida } from './adaptador-football-data';

export type MotivoDescarte =
  | 'fora-do-recorte'
  | 'clube-serie-a-sem-id'
  | 'clube-nao-mapeado'
  | 'status-desconhecido'
  | 'nome-externo-invalido';

const MOTIVOS: readonly MotivoDescarte[] = [
  'fora-do-recorte',
  'clube-serie-a-sem-id',
  'clube-nao-mapeado',
  'status-desconhecido',
  'nome-externo-invalido',
];

export interface ResumoLiga {
  partidas: number;
  requisicoes: number;
  descartes: Record<MotivoDescarte, number>;
}

export interface EntradaResumoLiga {
  partidas: number;
  requisicoes: number;
  foraDoRecorte: number;
  inconsistencias: readonly InconsistenciaPartida[];
}

const MOTIVO_POR_TIPO: Record<InconsistenciaPartida['tipo'], MotivoDescarte> = {
  'clube-nao-mapeado': 'clube-nao-mapeado',
  'partida-status-desconhecido': 'status-desconhecido',
  'clube-serie-a-sem-id': 'clube-serie-a-sem-id',
  'partida-invalida': 'nome-externo-invalido',
};

export function montarResumoLiga(e: EntradaResumoLiga): ResumoLiga {
  const descartes = Object.fromEntries(MOTIVOS.map((m) => [m, 0])) as Record<MotivoDescarte, number>;
  descartes['fora-do-recorte'] = e.foraDoRecorte;
  for (const i of e.inconsistencias) descartes[MOTIVO_POR_TIPO[i.tipo]] += 1;
  return { partidas: e.partidas, requisicoes: e.requisicoes, descartes };
}

export function linhaLogLiga(a: {
  horario: Date;
  liga: string;
  resultado: string;
  resumo: ResumoLiga;
}): string {
  const d = MOTIVOS.map((m) => `${m}=${a.resumo.descartes[m]}`).join(' ');
  return `${a.horario.toISOString()} liga=${a.liga} resultado=${a.resultado} partidas=${a.resumo.partidas} requisicoes=${a.resumo.requisicoes} ${d}`;
}
