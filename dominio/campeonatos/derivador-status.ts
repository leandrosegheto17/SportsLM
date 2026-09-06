// dominio/campeonatos/derivador-status.ts — ING-F-03 (TASK.md Lote 5)
//
// Deriva o `status` (CA-07.1) e a `fase` de um clube numa competição a partir
// das partidas já coletadas (ADR-006, ponto 6 / P8), sem depender de o
// provedor expor fase/eliminação de forma explícita. Módulo puro, sem I/O
// (GUARDRAILS.md §5) — nenhum `Date.now()`; `agora` sempre entra por
// parâmetro (Diretriz #2 do TASK.md §1).
//
// Decisão de escopo registrada (TASK.md §6, desvio pequeno — não é lacuna do
// UX-SPEC nem mudança de contrato): esta tarefa calcula `status` e
// `faseAtual`, não `resultadoFinal` (texto livre como "Campeão"/"Vice",
// `ParticipacaoClube.resultadoFinal` de `dominio/tipos/futebol.ts`/DOM-01).
// Determinar "Campeão"/"Vice" exigiria inferir, a partir de mandante/
// visitante/placar da última partida, se o clube venceu a final — um palpite
// sobre o significado de uma fase, exatamente o que o ADR-006 (ponto 6)
// proíbe ("nunca um palpite apresentado como fato"). `resultadoFinal` fica
// para quem monta o `ParticipacaoClube` completo (ING-F-05/PUB-02, Lotes 5/6)
// combinando este `faseAtual` com qualquer sinal adicional que vierem a ter;
// aqui, o texto "eliminado na <fase>"/"concluído — <resultado>" de CA-07.1/
// CA-07.3 é responsabilidade de apresentação (usa `faseAtual` como insumo).
//
// Regra central (P8, ADR-006 ponto 6): "eliminado" só existe enquanto a
// competição segue ativa (`agora <= janela.fim`) — é a ausência de partida
// futura *durante* a competição que caracteriza eliminação. Uma vez que a
// janela da competição se encerra, a participação do clube (eliminado antes
// ou não) vira "concluído" — o card não fica "eliminado" para sempre depois
// que o campeonato inteiro terminou (SDD §2.5/CA-07.1 tratam "concluído" como
// o estado final de uma participação encerrada junto com a competição).
// "eliminado" só se aplica a formatos com eliminação (`mata-mata`, `grupos`,
// `misto`); `pontos-corridos` nunca elimina (RN da modalidade).
//
// Qualquer ambiguidade que impeça decidir com confiança o status ou a
// eliminação vira `sem-dados` — nunca um palpite (P8/ADR-006).

/** Status de partida relevantes para a derivação (subconjunto de
 * `Partida['status']` de `dominio/tipos/futebol.ts`/DOM-01). */
export type StatusPartidaParaDerivacao =
  | 'agendada'
  | 'aguardando-resultado'
  | 'finalizada'
  | 'adiada'
  | 'cancelada';

/** Entrada mínima de uma partida do clube na competição, já filtrada por quem
 * chama (ING-F-01/02) — só o clube e a competição em questão. */
export interface PartidaParaDerivacaoStatus {
  readonly fase: string | null;
  /** ISO 8601, ou `null` quando "data a definir" (CA-10.4). */
  readonly dataHora: string | null;
  readonly status: StatusPartidaParaDerivacao;
  readonly placar: { readonly mandante: number; readonly visitante: number } | null;
}

export type StatusCampeonato =
  | 'nao-iniciado'
  | 'em-andamento'
  | 'eliminado'
  | 'concluido'
  | 'sem-dados';

export interface StatusDerivado {
  readonly status: StatusCampeonato;
  /** Fase corrente (`em-andamento`) ou fase em que o clube foi eliminado
   * (`eliminado`) — `null` para os demais status (não iniciou, sem dados, ou
   * já concluído — texto de resultado é responsabilidade de outra camada). */
  readonly faseAtual: string | null;
}

/** Formatos de competição que admitem eliminação (SDD §5.2, `Competicao.formato`).
 * `pontos-corridos` nunca elimina — todos os clubes disputam até o fim. */
const FORMATOS_COM_ELIMINACAO = new Set(['mata-mata', 'grupos', 'misto']);

export interface EntradaDerivadorStatus {
  readonly formato: 'pontos-corridos' | 'grupos' | 'mata-mata' | 'misto';
  /** Janela de calendário da competição (SDD §5.2, `Competicao.janela`), ISO 8601. */
  readonly janela: { readonly inicio: string; readonly fim: string };
  /** Partidas do clube nesta competição, em qualquer ordem. */
  readonly partidas: readonly PartidaParaDerivacaoStatus[];
  readonly agora: Date;
}

const SEM_DADOS: StatusDerivado = { status: 'sem-dados', faseAtual: null };

function paraTimestamp(dataHora: string | null): number | null {
  if (dataHora === null) return null;
  const timestamp = Date.parse(dataHora);
  return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * Fase da última partida finalizada, por ordem cronológica (mais recente
 * primeiro). Só usa partidas com `dataHora` válida para decidir "qual é a
 * mais recente" — nunca desempata por posição no array (não é campo
 * ordenável garantido por ningém, ao contrário do que outras tarefas do
 * domínio assumem para listas já ordenadas por quem monta a tela). Se houver
 * mais de uma finalizada e nenhuma tiver `dataHora` conhecida, ou se houver
 * empate exato de horário entre finalizadas de fase diferente, a fase fica
 * ambígua (`undefined`) — o chamador decide se isso derruba o status inteiro
 * para `sem-dados` ou só deixa `faseAtual: null`.
 */
function obterUltimaFase(
  finalizadas: readonly PartidaParaDerivacaoStatus[],
): string | null | undefined {
  const [primeira, ...resto] = finalizadas;
  if (primeira === undefined) return null;
  if (resto.length === 0) return primeira.fase;

  const comData = finalizadas
    .map((p) => ({ fase: p.fase, timestamp: paraTimestamp(p.dataHora) }))
    .filter((p): p is { fase: string | null; timestamp: number } => p.timestamp !== null);

  if (comData.length === 0) {
    // Nenhuma finalizada tem data conhecida: só não é ambíguo se todas
    // concordam na mesma fase (não importa qual é "a última").
    const todasIguais = finalizadas.every((p) => p.fase === primeira.fase);
    return todasIguais ? primeira.fase : undefined;
  }

  const maisRecente = comData.reduce((atual, candidata) =>
    candidata.timestamp > atual.timestamp ? candidata : atual,
  );
  const empatadas = comData.filter((p) => p.timestamp === maisRecente.timestamp);
  const empateAmbiguo = empatadas.some((p) => p.fase !== maisRecente.fase);
  return empateAmbiguo ? undefined : maisRecente.fase;
}

/** Fase "corrente" para `em-andamento`: a da próxima partida pendente
 * conhecida (menor `dataHora`); se nenhuma pendente tem data conhecida, usa a
 * fase comum a todas (ou `null` se divergirem — sem palpite). */
function obterFaseCorrente(
  pendentes: readonly PartidaParaDerivacaoStatus[],
): string | null {
  const comData = pendentes
    .map((p) => ({ fase: p.fase, timestamp: paraTimestamp(p.dataHora) }))
    .filter((p): p is { fase: string | null; timestamp: number } => p.timestamp !== null);

  if (comData.length > 0) {
    const proxima = comData.reduce((atual, candidata) =>
      candidata.timestamp < atual.timestamp ? candidata : atual,
    );
    return proxima.fase;
  }

  const [primeira] = pendentes;
  if (primeira === undefined) return null;
  return pendentes.every((p) => p.fase === primeira.fase) ? primeira.fase : null;
}

/**
 * Deriva `status`/`faseAtual` de um clube numa competição a partir das
 * partidas já coletadas (ADR-006 ponto 6, P8) — comportamento padrão
 * enquanto SPK-02 não conclui (deriva sempre por partidas). Função pura,
 * nunca lança.
 */
export function derivarStatusCampeonato(entrada: EntradaDerivadorStatus): StatusDerivado {
  const inicioMs = Date.parse(entrada.janela.inicio);
  const fimMs = Date.parse(entrada.janela.fim);
  if (Number.isNaN(inicioMs) || Number.isNaN(fimMs)) return SEM_DADOS;

  const agoraMs = entrada.agora.getTime();
  const relevantes = entrada.partidas.filter((p) => p.status !== 'cancelada');

  if (relevantes.length === 0) {
    return agoraMs < inicioMs ? { status: 'nao-iniciado', faseAtual: null } : SEM_DADOS; // ambíguo: sem cobertura, calendário incompleto, ou já encerrado — não dá pra distinguir
  }

  // Dado inconsistente (finalizada sem placar) é sinal de ambiguidade para
  // este módulo — CA-16.6 (ING-F-04) é quem descarta o lote na origem; aqui,
  // na dúvida, nunca afirma um status a partir de dado incoerente.
  const finalizadaSemPlacar = relevantes.some(
    (p) => p.status === 'finalizada' && p.placar === null,
  );
  if (finalizadaSemPlacar) return SEM_DADOS;

  const pendentes = relevantes.filter(
    (p) =>
      p.status === 'agendada' ||
      p.status === 'aguardando-resultado' ||
      p.status === 'adiada',
  );
  const finalizadas = relevantes.filter((p) => p.status === 'finalizada');

  if (pendentes.length > 0) {
    return { status: 'em-andamento', faseAtual: obterFaseCorrente(pendentes) };
  }

  // Sem pendentes: só finalizadas restam (relevantes = pendentes ∪ finalizadas).
  if (agoraMs > fimMs) {
    // Competição encerrada: participação concluída, eliminado ou não.
    return { status: 'concluido', faseAtual: null };
  }

  if (!FORMATOS_COM_ELIMINACAO.has(entrada.formato)) {
    // `pontos-corridos` não elimina; sem partida futura e a competição ainda
    // não fechou a janela é ambíguo (calendário restante pode só estar
    // incompleto no provedor) — nunca presume "concluído" antes da hora.
    return SEM_DADOS;
  }

  const ultimaFase = obterUltimaFase(finalizadas);
  if (ultimaFase === undefined) return SEM_DADOS; // fase da eliminação ambígua (ADR-006 ponto 6)

  return { status: 'eliminado', faseAtual: ultimaFase };
}
