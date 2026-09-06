// dominio/simulacao/tipos.ts — DOM-05 (TASK.md Lote 3)
//
// Tipos do motor de simulação (ADR-010, RN-14, RF-10/RF-11). Módulo puro,
// sem I/O (GUARDRAILS.md §5) — sem tipo de rede, `localStorage`, React nem
// relógio.

import type { Palpite } from '../tipos/estado-local';
import type { Partida } from '../tipos/futebol';

/** Resultado de uma partida do ponto de vista de um clube específico. */
export type ResultadoPartida = 'V' | 'E' | 'D';

/** Clube participante da simulação — o time do coração ou um rival (RN-11,
 * até 3 clubes no total) — com a pontuação já conquistada na competição até
 * o momento (ponto de partida do acumulado projetado). */
export interface ClubeNaSimulacao {
  id: string;
  pontosAtuais: number;
}

/**
 * Partida restante do Brasileirão relevante para algum dos clubes
 * comparados. Fronteira explícita do motor (ADR-010): não conhece outra
 * competição — a seleção de quais partidas entram aqui (por competição e por
 * clube comparado) é responsabilidade de quem monta a entrada, fora deste
 * módulo.
 *
 * Reaproveita os campos de `Partida` (SDD §5.2/DOM-01) que o motor precisa
 * para decidir se o resultado real já venceu o palpite (CA-11.6/ADR-010
 * item 4). `rodada` é obrigatória aqui (diferente de `Partida.rodada`, que é
 * nula em mata-mata) porque o Brasileirão é pontos-corridos — sempre há
 * rodada nesta fronteira.
 */
export interface PartidaRestante
  extends Pick<Partida, 'id' | 'mandanteId' | 'visitanteId' | 'status' | 'placar'> {
  rodada: number;
}

/**
 * Entrada do motor (ADR-010). `palpites` guarda **um único valor por id de
 * partida**, sempre da perspectiva do mandante — decisão de interpretação
 * registrada (TASK.md §6): é isso que torna o confronto direto uma "entrada
 * única espelhada" por construção (CA-11.4), já que o visitante deriva seu
 * resultado invertendo esse mesmo valor, nunca lendo uma segunda entrada que
 * pudesse contradizer a primeira. Ausência de chave para uma partida = sem
 * palpite (CA-11.3).
 */
export interface EntradaSimulacao {
  clubes: ClubeNaSimulacao[];
  partidasRestantes: PartidaRestante[];
  palpites: Record<string, Palpite>;
}

export interface EstatisticasClube {
  /** Pontuação acumulada projetada, rodada a rodada, a partir do ponto de
   * partida `pontosAtuais` (CA-11.2). */
  acumuladoPorRodada: { rodada: number; pontos: number }[];
  /** Pontuação final projetada: `pontosAtuais` + resultado real (partida
   * travada) ou palpite (partida em aberto) ou 0 (sem palpite) por partida
   * restante (CA-11.2/CA-11.3). */
  projetado: number;
  /** Teto teórico: `pontosAtuais` + resultado real (partida travada) ou 3
   * (partida em aberto, mesmo que já tenha palpite registrado — é o teto,
   * não o cenário escolhido) por partida restante (CA-11.3). */
  maximoPossivel: number;
  /** Nº de vitórias no cenário projetado — critério de desempate (CA-11.5). */
  vitoriasProjetadas: number;
}

/**
 * Saída do motor (ADR-010). `ordenacao`/`empateTecnico` cobrem **somente**
 * os clubes comparados (CA-11.10) — nunca a posição na tabela completa nem
 * os demais clubes do Brasileirão.
 */
export interface SaidaSimulacao {
  porClube: Record<string, EstatisticasClube>;
  /** Ids dos clubes de `entrada.clubes`, ordenados entre si (CA-11.10). */
  ordenacao: string[];
  /** Grupos (2+ clubes) empatados em pontos projetados **e** em vitórias
   * projetadas — "empate técnico" (CA-11.5). A ordem relativa dentro do
   * grupo, e a posição do grupo em `ordenacao`, seguem o desempate final
   * estável por id do clube (ADR-010 item 5). */
  empateTecnico: string[][];
}
