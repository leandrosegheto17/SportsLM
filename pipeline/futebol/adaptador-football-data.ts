// pipeline/futebol/adaptador-football-data.ts — ING-F-01 (TASK.md Lote 5)
//
// Adaptador de `football-data.org` (ADR-006): traduz a resposta do provedor
// para o domínio (`LinhaClassificacao`/`Partida`, SDD §5.2), casando clube
// SEMPRE por `idsProvedor['football-data']` — **nunca** por nome (CA-16.6,
// ADR-006 item 3: "casamento por nome é proibido — fonte clássica de erro
// silencioso"). Clube sem id mapeado (inclusive a sentinela
// `SENTINELA_ID_PENDENTE` de `pipeline/config/clubes.ts`, CFG-02) é
// descartado e registrado como inconsistência, nunca "adivinhado" por nome
// ou posição.
//
// Nota de decisão de detalhe (TASK.md §6): ADR-006 item 1 ilustra
// `ProvedorFutebol.obterClassificacao/obterPartidas` devolvendo só
// `Promise<LinhaClassificacao[]>`/`Promise<Partida[]>` — pseudocódigo para
// mostrar a forma da porta (Backend/adaptador), não um contrato TS literal a
// copiar campo a campo. Como o item 3 do mesmo ADR também exige *registrar*
// a inconsistência de clube não mapeado, e o domínio não tem onde carregar
// esse registro (GUARDRAILS.md §5: domínio é puro, sem side-channel de log),
// as funções deste módulo devolvem um objeto `{ linhas/partidas,
// inconsistencias }` — superconjunto da assinatura ilustrativa da porta, não
// uma reinterpretação da decisão em si (casar por id; descartar e registrar
// o que não casa). `ING-F-02` (`coletor-futebol`), que orquestra este
// adaptador, decide o que fazer com `inconsistencias` (log/estado de
// ingestão) — fora do escopo desta tarefa.
//
// Débito operacional conhecido (REFAT-02-01, ver TASK.md/QA-REPORT.md, Lote
// 2): hoje, `config/clubes-2026.json` tem 19 dos 20 clubes com
// `idsProvedor['football-data']` na sentinela `SENTINELA_ID_PENDENTE` — só o
// Flamengo (`1783`) tem id real confirmado. Este adaptador está correto e
// genérico (funciona assim que os ids reais forem preenchidos); com o dado
// de configuração de hoje, ele descarta (e registra) 19 dos 20 clubes em
// qualquer execução real — comportamento intencional de CA-16.6/ADR-006 item
// 3, não um bug deste módulo. Resolver os 19 ids pendentes não é escopo de
// ING-F-01 (ver nota em `pipeline/config/clubes.ts`).
//
// `pipeline/` faz I/O de rede — mora fora de `dominio/` (que é puro,
// GUARDRAILS.md §5). Token do provedor nunca é lido de `process.env` por
// este módulo: é responsabilidade de quem instancia o adaptador (ING-F-02)
// injetá-lo via `OpcoesAdaptadorFootballData.token`, mantendo este módulo
// testável sem tocar o ambiente (TASK.md §1, diretriz 12 — segredo só existe
// como variável de ambiente do job de CI).

import { z } from 'zod';
import type { LinhaClassificacao, Partida } from '../../dominio/tipos/futebol';
import {
  ID_PROVEDOR_FOOTBALL_DATA,
  SENTINELA_ID_PENDENTE,
  type ClubeBase,
} from '../config/clubes';

/** URL base da API v4 pública do provedor (ADR-006 item 4). */
export const BASE_URL_FOOTBALL_DATA = 'https://api.football-data.org/v4';

/**
 * Referência mínima a uma competição para consultar o provedor. O código de
 * competição do football-data.org (ex.: `'BSA'` para o Brasileirão Série A)
 * é específico deste adaptador — não faz parte do domínio nem de
 * `config/campeonatos-2026.json` (que guarda só o id de provedor genérico,
 * `"football-data-org"`, não o código de competição da API). Quem sabe o
 * código por competição é `ING-F-02`, que injeta aqui.
 */
export interface RefCompeticaoFootballData {
  /** Slug de domínio da competição, ex. `'brasileirao-serie-a'`. */
  competicaoId: string;
  /** Código de competição do provedor, ex. `'BSA'`. */
  codigoCompeticao: string;
}

/** Inconsistência de mapeamento de clube (CA-16.6, ADR-006 item 3). */
export interface InconsistenciaClube {
  tipo: 'clube-nao-mapeado';
  competicaoId: string;
  idProvedor: string | number;
  /** Nome do time segundo o provedor — só para diagnóstico humano; NUNCA
   * usado para casar com um clube (é exatamente o que CA-16.6/ADR-006 item 3
   * proíbem). */
  nomeProvedorDiagnostico: string;
  /** Onde a inconsistência ocorreu, ex. `'classificacao:posicao 7'` ou
   * `'partida:12345:mandante'`. */
  contexto: string;
}

// --- Schemas da resposta bruta do provedor -----------------------------
// Toda entrada externa passa por Zod antes de entrar no domínio (TASK.md §1,
// diretriz 6). Os schemas abaixo cobrem só os campos que este adaptador usa
// — não são um espelho completo da API do football-data.org.

const timeProvedorSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

export type TimeProvedor = z.infer<typeof timeProvedorSchema>;

const linhaTabelaProvedorSchema = z.object({
  position: z.number().int().min(1),
  team: timeProvedorSchema,
  playedGames: z.number().int().min(0),
  form: z.string().nullable().optional(),
  won: z.number().int().min(0),
  draw: z.number().int().min(0),
  lost: z.number().int().min(0),
  points: z.number().int().min(0),
  goalsFor: z.number().int().min(0),
  goalsAgainst: z.number().int().min(0),
  goalDifference: z.number().int(),
});

const standingsProvedorSchema = z.object({
  standings: z.array(
    z.object({
      type: z.enum(['TOTAL', 'HOME', 'AWAY']),
      group: z.string().nullable().optional(),
      table: z.array(linhaTabelaProvedorSchema),
    }),
  ),
});

export type StandingsProvedor = z.infer<typeof standingsProvedorSchema>;

/** Status de partida do football-data.org v4 (documentação pública da API). */
const STATUS_PARTIDA_PROVEDOR = [
  'SCHEDULED',
  'TIMED',
  'IN_PLAY',
  'PAUSED',
  'EXTRA_TIME',
  'PENALTY_SHOOTOUT',
  'FINISHED',
  'SUSPENDED',
  'POSTPONED',
  'CANCELLED',
  'AWARDED',
] as const;

type StatusPartidaProvedor = (typeof STATUS_PARTIDA_PROVEDOR)[number];

const placarProvedorSchema = z.object({
  home: z.number().int().nullable(),
  away: z.number().int().nullable(),
});

const partidaProvedorSchema = z.object({
  id: z.number().int(),
  utcDate: z.string(),
  status: z.enum(STATUS_PARTIDA_PROVEDOR),
  matchday: z.number().int().nullable().optional(),
  stage: z.string().nullable().optional(),
  homeTeam: timeProvedorSchema,
  awayTeam: timeProvedorSchema,
  score: z.object({ fullTime: placarProvedorSchema }),
  venue: z.string().nullable().optional(),
});

const matchesProvedorSchema = z.object({
  matches: z.array(partidaProvedorSchema),
});

export type MatchesProvedor = z.infer<typeof matchesProvedorSchema>;

// --- Casamento por id (CA-16.6, ADR-006 item 3) -------------------------

function indiceClubesPorIdProvedor(clubes: ClubeBase[]): Map<string, ClubeBase> {
  const indice = new Map<string, ClubeBase>();
  for (const clube of clubes) {
    const id = clube.idsProvedor[ID_PROVEDOR_FOOTBALL_DATA];
    if (id === undefined) continue; // clube não participa deste provedor
    if (id === SENTINELA_ID_PENDENTE) continue; // débito CFG-02/REFAT-02-01 — nunca casa
    indice.set(String(id), clube);
  }
  return indice;
}

function resolverClube(
  indice: Map<string, ClubeBase>,
  time: TimeProvedor,
  competicaoId: string,
  contexto: string,
  inconsistencias: InconsistenciaClube[],
): ClubeBase | null {
  const clube = indice.get(String(time.id));
  if (clube === undefined) {
    inconsistencias.push({
      tipo: 'clube-nao-mapeado',
      competicaoId,
      idProvedor: time.id,
      nomeProvedorDiagnostico: time.name,
      contexto,
    });
    return null;
  }
  return clube;
}

// --- Tradução de classificação ------------------------------------------

/** Converte o campo `form` do provedor (`"W,D,L,W,W"`, mais recente por
 * último — convenção football-data.org) para `ultimosCinco` (CA-10.1).
 * `form` ausente (comum no início de temporada) vira lista vazia — nunca
 * inventa resultado. */
function formParaUltimosCinco(form: string | null | undefined): ('V' | 'E' | 'D')[] {
  if (form === null || form === undefined || form.trim().length === 0) return [];
  const resultado: ('V' | 'E' | 'D')[] = [];
  for (const bruto of form.split(',')) {
    const item = bruto.trim();
    if (item === 'W') resultado.push('V');
    else if (item === 'D') resultado.push('E');
    else if (item === 'L') resultado.push('D');
    // qualquer outro token é ignorado silenciosamente (formato inesperado do
    // provedor) em vez de lançar — este campo é só um complemento visual
  }
  return resultado.slice(-5);
}

function calcularAproveitamento(pontos: number, jogos: number): number {
  if (jogos === 0) return 0; // evita divisão por zero antes da 1ª rodada
  return (pontos / (jogos * 3)) * 100;
}

/**
 * Traduz a resposta de `/competitions/<codigo>/standings` para
 * `LinhaClassificacao[]` (SDD §5.2). Só considera a tabela `type: 'TOTAL'`
 * (mando misto) — `HOME`/`AWAY` não fazem parte do modelo de domínio.
 */
export function traduzirClassificacao(
  respostaBruta: unknown,
  competicaoId: string,
  clubes: ClubeBase[],
): { linhas: LinhaClassificacao[]; inconsistencias: InconsistenciaClube[] } {
  const resposta = standingsProvedorSchema.parse(respostaBruta);
  const indice = indiceClubesPorIdProvedor(clubes);
  const inconsistencias: InconsistenciaClube[] = [];
  const linhas: LinhaClassificacao[] = [];

  for (const tabela of resposta.standings) {
    if (tabela.type !== 'TOTAL') continue;
    for (const linha of tabela.table) {
      const clube = resolverClube(
        indice,
        linha.team,
        competicaoId,
        `classificacao:posicao ${linha.position}`,
        inconsistencias,
      );
      if (clube === null) continue; // descartada (CA-16.6/ADR-006 item 3)

      linhas.push({
        competicaoId,
        grupo: tabela.group ?? null,
        posicao: linha.position,
        clubeId: clube.id,
        pontos: linha.points,
        jogos: linha.playedGames,
        v: linha.won,
        e: linha.draw,
        d: linha.lost,
        gp: linha.goalsFor,
        gc: linha.goalsAgainst,
        sg: linha.goalDifference,
        aproveitamento: calcularAproveitamento(linha.points, linha.playedGames),
        ultimosCinco: formParaUltimosCinco(linha.form),
      });
    }
  }

  return { linhas, inconsistencias };
}

// --- Tradução de partidas -------------------------------------------------

/**
 * Traduz status + placar do provedor para o par (`status`, `horarioDefinido`,
 * `placar`) do domínio.
 *
 * Convenção do football-data.org (documentação pública): `SCHEDULED` = só a
 * data está confirmada, horário ainda a definir; `TIMED` = horário de início
 * já confirmado — daí `horarioDefinido` (CA-08.8).
 *
 * Defensivo por decisão (CA-16.6, "nunca um palpite apresentado como
 * fato"): só marca `'finalizada'` quando o placar completo (`fullTime.home`
 * e `.away`) está presente; um `FINISHED`/`AWARDED` sem placar completo (que
 * seria, em si, uma inconsistência coberta por `ING-F-04`) cai para
 * `'aguardando-resultado'` em vez de expor um placar inventado.
 */
function traduzirStatusEHorario(
  status: StatusPartidaProvedor,
  placar: { home: number | null; away: number | null },
): { status: Partida['status']; horarioDefinido: boolean; placar: Partida['placar'] } {
  const temPlacarCompleto = placar.home !== null && placar.away !== null;
  const placarDominio: Partida['placar'] = temPlacarCompleto
    ? { mandante: placar.home as number, visitante: placar.away as number }
    : null;

  switch (status) {
    case 'SCHEDULED':
      return { status: 'agendada', horarioDefinido: false, placar: null };
    case 'TIMED':
      return { status: 'agendada', horarioDefinido: true, placar: null };
    case 'IN_PLAY':
    case 'PAUSED':
    case 'EXTRA_TIME':
    case 'PENALTY_SHOOTOUT':
    case 'SUSPENDED':
      // Em andamento/suspensa: partida "terminou" (no sentido de já ter
      // começado) sem resultado fechado ainda — CA-08.10.
      return { status: 'aguardando-resultado', horarioDefinido: true, placar: null };
    case 'FINISHED':
    case 'AWARDED':
      return temPlacarCompleto
        ? { status: 'finalizada', horarioDefinido: true, placar: placarDominio }
        : { status: 'aguardando-resultado', horarioDefinido: true, placar: null };
    case 'POSTPONED':
      return { status: 'adiada', horarioDefinido: false, placar: null };
    case 'CANCELLED':
      return { status: 'cancelada', horarioDefinido: false, placar: null };
  }
}

/**
 * Traduz a resposta de `/competitions/<codigo>/matches` para `Partida[]`
 * (SDD §5.2). Partida com mandante e/ou visitante não mapeado é descartada e
 * registrada (CA-16.6/ADR-006 item 3) — nunca meio-preenchida.
 */
export function traduzirPartidas(
  respostaBruta: unknown,
  competicaoId: string,
  clubes: ClubeBase[],
): { partidas: Partida[]; inconsistencias: InconsistenciaClube[] } {
  const resposta = matchesProvedorSchema.parse(respostaBruta);
  const indice = indiceClubesPorIdProvedor(clubes);
  const inconsistencias: InconsistenciaClube[] = [];
  const partidas: Partida[] = [];

  for (const partida of resposta.matches) {
    const mandante = resolverClube(
      indice,
      partida.homeTeam,
      competicaoId,
      `partida:${partida.id}:mandante`,
      inconsistencias,
    );
    const visitante = resolverClube(
      indice,
      partida.awayTeam,
      competicaoId,
      `partida:${partida.id}:visitante`,
      inconsistencias,
    );
    if (mandante === null || visitante === null) continue; // descartada

    const { status, horarioDefinido, placar } = traduzirStatusEHorario(
      partida.status,
      partida.score.fullTime,
    );

    partidas.push({
      id: String(partida.id),
      competicaoId,
      rodada: partida.matchday ?? null,
      // 'REGULAR_SEASON' é redundante com `rodada` no pontos-corridos — só
      // preserva `fase` quando o provedor sinaliza algo além disso (mata-mata/grupos).
      fase:
        partida.stage === undefined || partida.stage === 'REGULAR_SEASON'
          ? null
          : partida.stage,
      mandanteId: mandante.id,
      visitanteId: visitante.id,
      dataHora: partida.utcDate,
      horarioDefinido,
      estadio: partida.venue ?? null,
      status,
      placar,
    });
  }

  return { partidas, inconsistencias };
}

// --- Porta ProvedorFutebol (ADR-006 item 1) — I/O de rede -----------------

/** Buscador HTTP injetável (testabilidade — resposta mockada do provedor).
 * Compatível com o `fetch` nativo do Node 22 (SDD §3). */
export type BuscadorHttp = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface OpcoesAdaptadorFootballData {
  /** Token do provedor — injetado por quem orquestra (`ING-F-02`) a partir
   * de variável de ambiente do job de CI. Nunca hardcoded, nunca lido de
   * `process.env` por este módulo (TASK.md §1, diretriz 12). */
  token: string;
  /** Clubes base (CFG-02) usados para o casamento por id em todas as
   * chamadas deste adaptador. */
  clubes: ClubeBase[];
  buscar?: BuscadorHttp;
  baseUrl?: string;
}

/**
 * Fábrica do adaptador football-data.org (ADR-006 item 1/4). Devolve a porta
 * `ProvedorFutebol` com o superconjunto de retorno `{ dados, inconsistencias
 * }` documentado no topo do arquivo.
 */
export function criarAdaptadorFootballData(opcoes: OpcoesAdaptadorFootballData) {
  const buscar: BuscadorHttp = opcoes.buscar ?? ((url, init) => fetch(url, init));
  const baseUrl = opcoes.baseUrl ?? BASE_URL_FOOTBALL_DATA;
  const headers = { 'X-Auth-Token': opcoes.token };

  return {
    id: ID_PROVEDOR_FOOTBALL_DATA,
    // Plano gratuito: 10 requisições/minuto (ADR-006 item 4).
    orcamento: { porMinuto: 10 },

    async obterClassificacao(comp: RefCompeticaoFootballData) {
      const resposta = await buscar(
        `${baseUrl}/competitions/${comp.codigoCompeticao}/standings`,
        { headers },
      );
      if (!resposta.ok) {
        throw new Error(
          `football-data respondeu HTTP ${resposta.status} (classificação, ${comp.codigoCompeticao})`,
        );
      }
      const corpo = await resposta.json();
      return traduzirClassificacao(corpo, comp.competicaoId, opcoes.clubes);
    },

    async obterPartidas(comp: RefCompeticaoFootballData) {
      const resposta = await buscar(
        `${baseUrl}/competitions/${comp.codigoCompeticao}/matches`,
        { headers },
      );
      if (!resposta.ok) {
        throw new Error(
          `football-data respondeu HTTP ${resposta.status} (partidas, ${comp.codigoCompeticao})`,
        );
      }
      const corpo = await resposta.json();
      return traduzirPartidas(corpo, comp.competicaoId, opcoes.clubes);
    },
  };
}
