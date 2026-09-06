// dominio/simulacao/motor.ts — DOM-05 (TASK.md Lote 3)
//
// Motor de simulação puro e determinístico (ADR-010, RN-14, RF-10/RF-11).
// Módulo puro, sem I/O (GUARDRAILS.md §5): nenhuma chamada de rede,
// `localStorage`, React nem `Date.now()` — a função não precisa de relógio
// nenhum, já que "resultado real vence sempre" (ADR-010 item 4) é decidido
// pelo `status`/`placar` já presentes na entrada, nunca pela hora atual.

import type { Palpite } from '../tipos/estado-local';
import type {
  ClubeNaSimulacao,
  EntradaSimulacao,
  EstatisticasClube,
  PartidaRestante,
  ResultadoPartida,
  SaidaSimulacao,
} from './tipos';

const PONTOS_POR_RESULTADO: Record<ResultadoPartida, number> = {
  V: 3,
  E: 1,
  D: 0,
};

/** Resultado da perspectiva do mandante, a partir de um palpite (RN-14). */
function resultadoDoMandantePorPalpite(palpite: Palpite): ResultadoPartida {
  if (palpite === 'vitoria') return 'V';
  if (palpite === 'derrota') return 'D';
  return 'E';
}

/** Espelhamento do confronto direto (CA-11.4): o resultado do visitante é
 * sempre o inverso do resultado do mandante — nunca uma segunda entrada. */
function inverter(resultado: ResultadoPartida): ResultadoPartida {
  if (resultado === 'V') return 'D';
  if (resultado === 'D') return 'V';
  return 'E';
}

/** Partida com resultado real já ingerido (ADR-010 item 4/CA-11.6): o
 * palpite guardado para ela é descartado do cálculo, o resultado real
 * sempre vence. */
function estaTravada(partida: PartidaRestante): boolean {
  return partida.status === 'finalizada' && partida.placar !== null;
}

/** Resultado do mandante para a partida: travada usa o placar real; senão o
 * palpite guardado; sem palpite e sem placar real → `null` (sem palpite,
 * CA-11.3). */
function resultadoDoMandante(
  partida: PartidaRestante,
  palpites: Record<string, Palpite>,
): ResultadoPartida | null {
  if (estaTravada(partida)) {
    const placar = partida.placar;
    if (placar === null) return null; // inalcançável (estaTravada já checou), guarda de tipo
    if (placar.mandante > placar.visitante) return 'V';
    if (placar.mandante < placar.visitante) return 'D';
    return 'E';
  }
  const palpite = palpites[partida.id];
  if (palpite === undefined) return null;
  return resultadoDoMandantePorPalpite(palpite);
}

/** Resultado da partida do ponto de vista de `clubeId` (mandante ou
 * visitante), ou `null` se a partida está em aberto e sem palpite. */
function resultadoDoClube(
  partida: PartidaRestante,
  clubeId: string,
  palpites: Record<string, Palpite>,
): ResultadoPartida | null {
  const doMandante = resultadoDoMandante(partida, palpites);
  if (doMandante === null) return null;
  return clubeId === partida.mandanteId ? doMandante : inverter(doMandante);
}

function calcularEstatisticasClube(
  clube: ClubeNaSimulacao,
  partidasRestantes: PartidaRestante[],
  palpites: Record<string, Palpite>,
): EstatisticasClube {
  const partidasDoClube = partidasRestantes
    .filter((p) => p.mandanteId === clube.id || p.visitanteId === clube.id)
    .slice()
    .sort((a, b) => a.rodada - b.rodada);

  let projetado = clube.pontosAtuais;
  let maximoPossivel = clube.pontosAtuais;
  let vitoriasProjetadas = 0;
  const acumuladoPorRodada: { rodada: number; pontos: number }[] = [];

  for (const partida of partidasDoClube) {
    const resultado = resultadoDoClube(partida, clube.id, palpites);
    const travada = estaTravada(partida);

    // Projetado (CA-11.2/CA-11.3): sem palpite e sem resultado real conta 0.
    projetado += resultado === null ? 0 : PONTOS_POR_RESULTADO[resultado];
    acumuladoPorRodada.push({ rodada: partida.rodada, pontos: projetado });

    // Máximo possível (CA-11.3): partida travada soma o resultado real,
    // fixo; partida em aberto soma sempre o teto de 3 — é o teto teórico,
    // não o cenário do palpite escolhido (decisão de interpretação, TASK.md
    // §6: o texto do critério de aceite só especifica o caso "sem palpite").
    maximoPossivel += travada && resultado !== null ? PONTOS_POR_RESULTADO[resultado] : 3;

    if (resultado === 'V') vitoriasProjetadas += 1;
  }

  return { acumuladoPorRodada, projetado, maximoPossivel, vitoriasProjetadas };
}

/** Compara dois clubes para a ordenação de CA-11.10: projetado desc →
 * vitórias projetadas desc → id do clube asc (desempate final estável e
 * determinístico, ADR-010 item 5). */
function compararClubes(
  a: { id: string; stats: EstatisticasClube },
  b: { id: string; stats: EstatisticasClube },
): number {
  if (b.stats.projetado !== a.stats.projetado)
    return b.stats.projetado - a.stats.projetado;
  if (b.stats.vitoriasProjetadas !== a.stats.vitoriasProjetadas) {
    return b.stats.vitoriasProjetadas - a.stats.vitoriasProjetadas;
  }
  return a.id.localeCompare(b.id);
}

/** "Empate técnico" (CA-11.5): mesmo pontos projetados e mesmas vitórias
 * projetadas. Desempate por vitórias já resolvido antes de chegar aqui;
 * persistindo o empate nos dois critérios, marca como empate técnico. */
function empatamTecnicamente(a: EstatisticasClube, b: EstatisticasClube): boolean {
  return a.projetado === b.projetado && a.vitoriasProjetadas === b.vitoriasProjetadas;
}

/**
 * Motor de simulação (ADR-010, RN-14). Recebe o time e até 2 rivais com a
 * pontuação atual, as partidas restantes relevantes do Brasileirão e o
 * cenário de palpites; devolve a projeção **somente entre os clubes
 * comparados** (CA-11.10) — nunca a posição na tabela completa nem os
 * demais 17 clubes.
 */
export function simular(entrada: EntradaSimulacao): SaidaSimulacao {
  const estatisticas = entrada.clubes.map((clube) => ({
    id: clube.id,
    stats: calcularEstatisticasClube(clube, entrada.partidasRestantes, entrada.palpites),
  }));

  const porClube: Record<string, EstatisticasClube> = {};
  for (const { id, stats } of estatisticas) {
    porClube[id] = stats;
  }

  const ordenados = estatisticas.slice().sort(compararClubes);

  const empateTecnico: string[][] = [];
  let grupoAtual: (typeof estatisticas)[number][] = [];
  for (const atual of ordenados) {
    const primeiro = grupoAtual[0];
    if (primeiro === undefined || empatamTecnicamente(primeiro.stats, atual.stats)) {
      grupoAtual.push(atual);
    } else {
      if (grupoAtual.length > 1) empateTecnico.push(grupoAtual.map((c) => c.id));
      grupoAtual = [atual];
    }
  }
  if (grupoAtual.length > 1) empateTecnico.push(grupoAtual.map((c) => c.id));

  return {
    porClube,
    ordenacao: ordenados.map((c) => c.id),
    empateTecnico,
  };
}
