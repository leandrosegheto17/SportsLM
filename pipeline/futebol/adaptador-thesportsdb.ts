// pipeline/futebol/adaptador-thesportsdb.ts — spike (ADR-006, decisão pendente)
//
// Adaptador do provedor gratuito TheSportsDB (v1 pública, chave "123"),
// avaliado como "candidato — spike SP-01" no ADR-006 para cobrir competições
// sem provedor hoje (`provedor: null` em `config/campeonatos-2026.json`):
// Copa do Brasil, Libertadores e estaduais. Segue a mesma porta
// `ProvedorFutebol` (ADR-006 item 1) e a mesma disciplina de
// `adaptador-football-data.ts` (ING-F-01): casamento de clube SEMPRE por
// `idsProvedor['thesportsdb']` — nunca por nome (CA-16.6) — e status de
// evento desconhecido é descartado e registrado, nunca "adivinhado".
//
// Confirmado nesta rodada (curl direto contra a API pública, 2026-09-07),
// contra o que o ADR-006 registrava como "não confirmado":
//   - `lookuptable.php` devolve tabela real e atual para os estaduais
//     testados (Paulista id 5767, Carioca id 5688) — inclusive múltiplos
//     grupos por `strGroup`, útil para os estaduais em fase de grupos.
//   - `eventspastleague.php`/`eventsnextleague.php` da Copa do Brasil
//     (id 4725) e da Libertadores (id 4501) trazem jogo passado de poucos
//     dias atrás e jogo futuro já agendado — dado corrente, não estático.
//   - Ainda NÃO confirmados: Mineiro e Pernambucano (não localizados nesta
//     rodada; podem ter outro id ou não ter cobertura) e Copa do Nordeste.
//
// Débito conhecido, registrado para o Coordenador decidir o próximo passo
// (mesmo padrão do débito de `clubes-2026.json` para football-data): nenhum
// clube tem `idsProvedor['thesportsdb']` mapeado ainda em
// `config/clubes-2026.json` — este adaptador está correto e testado contra
// fixtures reais, mas descarta (e registra) TODO clube em execução real até
// alguém preencher os ids reais de time do provedor (`idTeam`, capturáveis
// via `lookupteam.php`/`searchteams.php`). Sem isso, e sem
// `config/campeonatos-2026.json` apontar `"provedor": "thesportsdb"` para as
// competições cobertas, este módulo não está wireado à ingestão real
// (`coletor-futebol.ts`/`orquestrador.ts`) — é exatamente o próximo passo,
// não escopo deste spike.
//
// `pipeline/` faz I/O de rede — mora fora de `dominio/` (GUARDRAILS.md §5).

import { z } from 'zod';
import type { LinhaClassificacao, Partida } from '../../dominio/tipos/futebol';
import {
  ID_PROVEDOR_THESPORTSDB,
  SENTINELA_ID_PENDENTE,
  type ClubeBase,
} from '../config/clubes';
import type {
  InconsistenciaClube,
  InconsistenciaPartida,
  InconsistenciaStatusPartidaDesconhecido,
} from './adaptador-football-data';

/** URL base da API v1 pública, chave de demonstração gratuita "123" (ADR-006
 * spike SP-01) — 30 requisições/minuto, sem cadastro/token. */
export const BASE_URL_THESPORTSDB = 'https://www.thesportsdb.com/api/v1/json/123';

/**
 * Referência mínima a uma competição para consultar o provedor. `temTabela`
 * distingue competições de grupos/pontos-corridos (estaduais — têm tabela)
 * de mata-mata (Copa do Brasil, fases iniciais da Libertadores — não têm
 * "classificação" no sentido do domínio; `obterClassificacao` devolve lista
 * vazia sem chamar a API, em vez de forçar uma tradução sem sentido).
 */
export interface RefCompeticaoTheSportsDB {
  /** Slug de domínio da competição, ex. `'paulista'`. */
  competicaoId: string;
  /** Id de liga do provedor, ex. `'5767'` (Paulista) — string porque é assim
   * que a API devolve e espera (`l=`/`id=` na query). */
  idLigaProvedor: string;
  temTabela: boolean;
  /** Temporada no formato do provedor (`s=`), ex. `'2026'` — obrigatória só
   * quando `temTabela` é `true` (`lookuptable.php` exige `s`). */
  temporadaProvedor?: string;
}

// --- Schemas da resposta bruta do provedor -----------------------------
// TheSportsDB devolve todo campo numérico como STRING no JSON (ex.:
// `"intRank": "1"`) — `z.coerce.number()` normaliza antes de entrar no
// domínio, que espera `number` de verdade (SDD §5.2).

const linhaTabelaProvedorSchema = z.object({
  idTeam: z.string(),
  strTeam: z.string(),
  intRank: z.coerce.number().int().min(1),
  strGroup: z.string().nullable().optional(),
  strForm: z.string().nullable().optional(),
  intPlayed: z.coerce.number().int().min(0),
  intWin: z.coerce.number().int().min(0),
  intDraw: z.coerce.number().int().min(0),
  intLoss: z.coerce.number().int().min(0),
  intGoalsFor: z.coerce.number().int().min(0),
  intGoalsAgainst: z.coerce.number().int().min(0),
  intGoalDifference: z.coerce.number().int(),
  intPoints: z.coerce.number().int().min(0),
});

export type LinhaTabelaProvedor = z.infer<typeof linhaTabelaProvedorSchema>;

/** `table` vem `null` (não array vazio) quando o provedor não tem dado para
 * a liga/temporada consultada — tratado como "sem linhas", nunca como erro
 * (CA-07.2, mesma honestidade de `provedor: null`). */
const tabelaProvedorSchema = z.object({
  table: z.array(linhaTabelaProvedorSchema).nullable(),
});

const eventoProvedorSchema = z.object({
  idEvent: z.string(),
  dateEvent: z.string().nullable(),
  strTime: z.string().nullable().optional(),
  strStatus: z.string().nullable().optional(),
  strPostponed: z.string().nullable().optional(),
  strVenue: z.string().nullable().optional(),
  strGroup: z.string().nullable().optional(),
  idHomeTeam: z.string(),
  strHomeTeam: z.string(),
  idAwayTeam: z.string(),
  strAwayTeam: z.string(),
  intHomeScore: z.string().nullable(),
  intAwayScore: z.string().nullable(),
});

export type EventoProvedor = z.infer<typeof eventoProvedorSchema>;

/** `events` vem `null` quando não há jogo passado/futuro para a liga —
 * comum em competição fora de temporada. */
const eventosProvedorSchema = z.object({
  events: z.array(eventoProvedorSchema).nullable(),
});

// --- Casamento por id (CA-16.6, mesma regra do adaptador football-data) ---

function indiceClubesPorIdProvedor(clubes: ClubeBase[]): Map<string, ClubeBase> {
  const indice = new Map<string, ClubeBase>();
  for (const clube of clubes) {
    const id = clube.idsProvedor[ID_PROVEDOR_THESPORTSDB];
    if (id === undefined) continue;
    if (id === SENTINELA_ID_PENDENTE) continue;
    indice.set(String(id), clube);
  }
  return indice;
}

function resolverClube(
  indice: Map<string, ClubeBase>,
  idProvedor: string,
  nomeProvedorDiagnostico: string,
  competicaoId: string,
  contexto: string,
  inconsistencias: InconsistenciaPartida[],
): ClubeBase | null {
  const clube = indice.get(idProvedor);
  if (clube === undefined) {
    inconsistencias.push({
      tipo: 'clube-nao-mapeado',
      competicaoId,
      idProvedor,
      nomeProvedorDiagnostico,
      contexto,
    });
    return null;
  }
  return clube;
}

// --- Tradução de classificação ------------------------------------------

/**
 * Converte `strForm` (ex.: `"WWDWL"`, sem separador) para `ultimosCinco`.
 * Assunção NÃO confirmada pelo provedor (a documentação pública não declara
 * a ordem): assumimos "mais recente por último", pela mesma convenção do
 * football-data.org (`form`). Campo puramente cosmético (CA-10.1) — se a
 * ordem real for invertida, o pior efeito é mostrar a sequência de últimos 5
 * jogos ao contrário, nunca um placar ou posição errados.
 */
function formParaUltimosCinco(form: string | null | undefined): ('V' | 'E' | 'D')[] {
  if (form === null || form === undefined || form.trim().length === 0) return [];
  const resultado: ('V' | 'E' | 'D')[] = [];
  for (const letra of form.trim().toUpperCase()) {
    if (letra === 'W') resultado.push('V');
    else if (letra === 'D') resultado.push('E');
    else if (letra === 'L') resultado.push('D');
    // qualquer outro caractere é ignorado — nunca inventa um resultado
  }
  return resultado.slice(-5);
}

function calcularAproveitamento(pontos: number, jogos: number): number {
  if (jogos === 0) return 0;
  return (pontos / (jogos * 3)) * 100;
}

/**
 * Traduz a resposta de `lookuptable.php` para `LinhaClassificacao[]`
 * (SDD §5.2). `strGroup` vira `grupo` diretamente — o provedor já separa
 * grupo/fase de playoff nesse campo para os estaduais (confirmado no
 * Carioca: `"Carioca, Serie A 2026, Taca Guanabara, Group A"`).
 */
export function traduzirClassificacaoTheSportsDB(
  respostaBruta: unknown,
  competicaoId: string,
  clubes: ClubeBase[],
): { linhas: LinhaClassificacao[]; inconsistencias: InconsistenciaClube[] } {
  const resposta = tabelaProvedorSchema.parse(respostaBruta);
  const indice = indiceClubesPorIdProvedor(clubes);
  const inconsistencias: InconsistenciaClube[] = [];
  const linhas: LinhaClassificacao[] = [];

  for (const linha of resposta.table ?? []) {
    const clube = resolverClube(
      indice,
      linha.idTeam,
      linha.strTeam,
      competicaoId,
      `classificacao:posicao ${linha.intRank}`,
      inconsistencias,
    );
    if (clube === null) continue;

    linhas.push({
      competicaoId,
      grupo:
        linha.strGroup !== undefined && linha.strGroup !== '' ? linha.strGroup : null,
      posicao: linha.intRank,
      clubeId: clube.id,
      pontos: linha.intPoints,
      jogos: linha.intPlayed,
      v: linha.intWin,
      e: linha.intDraw,
      d: linha.intLoss,
      gp: linha.intGoalsFor,
      gc: linha.intGoalsAgainst,
      sg: linha.intGoalDifference,
      aproveitamento: calcularAproveitamento(linha.intPoints, linha.intPlayed),
      ultimosCinco: formParaUltimosCinco(linha.strForm),
    });
  }

  return { linhas, inconsistencias };
}

// --- Tradução de partidas -------------------------------------------------

/**
 * Status confirmados ao vivo nesta rodada (2026-09-07): `'NS'` (Not Started,
 * jogo futuro da Libertadores) e `'FT'` (Full Time, jogo já encerrado da
 * Copa do Brasil). TheSportsDB não publica uma lista oficial fechada de
 * códigos como o football-data.org — qualquer valor fora destes dois, ou
 * `strPostponed === 'yes'`, é tratado como "não confiamos no significado" e
 * a partida é descartada e registrada individualmente (mesma disciplina do
 * Bloqueio 008 em `adaptador-football-data.ts`), nunca invalidando as demais.
 */
function traduzirStatusEHorario(evento: EventoProvedor):
  | {
      ok: true;
      status: Partida['status'];
      horarioDefinido: boolean;
      placar: Partida['placar'];
    }
  | { ok: false } {
  if (evento.strPostponed === 'yes') {
    return { ok: true, status: 'adiada', horarioDefinido: false, placar: null };
  }

  const temPlacarCompleto = evento.intHomeScore !== null && evento.intAwayScore !== null;
  const placar: Partida['placar'] = temPlacarCompleto
    ? { mandante: Number(evento.intHomeScore), visitante: Number(evento.intAwayScore) }
    : null;
  const horarioDefinido = evento.strTime !== null && evento.strTime !== undefined;

  switch (evento.strStatus) {
    case 'NS':
      return { ok: true, status: 'agendada', horarioDefinido, placar: null };
    case 'FT':
      return temPlacarCompleto
        ? { ok: true, status: 'finalizada', horarioDefinido: true, placar }
        : {
            ok: true,
            status: 'aguardando-resultado',
            horarioDefinido: true,
            placar: null,
          };
    default:
      return { ok: false };
  }
}

/**
 * Traduz a resposta combinada de `eventspastleague.php`/`eventsnextleague.php`
 * para `Partida[]` (SDD §5.2). Segue a mesma ordem de descarte do adaptador
 * football-data: status desconhecido descarta a partida antes mesmo de
 * tentar casar clube.
 */
export function traduzirPartidasTheSportsDB(
  respostaBruta: unknown,
  competicaoId: string,
  clubes: ClubeBase[],
): { partidas: Partida[]; inconsistencias: InconsistenciaPartida[] } {
  const resposta = eventosProvedorSchema.parse(respostaBruta);
  const indice = indiceClubesPorIdProvedor(clubes);
  const inconsistencias: InconsistenciaPartida[] = [];
  const partidas: Partida[] = [];

  for (const evento of resposta.events ?? []) {
    const traduzido = traduzirStatusEHorario(evento);
    if (!traduzido.ok) {
      const inconsistencia: InconsistenciaStatusPartidaDesconhecido = {
        tipo: 'partida-status-desconhecido',
        competicaoId,
        idPartidaProvedor: Number(evento.idEvent),
        statusBrutoDiagnostico: evento.strStatus ?? '(ausente)',
        contexto: `partida:${evento.idEvent}:status`,
      };
      inconsistencias.push(inconsistencia);
      continue;
    }

    const mandante = resolverClube(
      indice,
      evento.idHomeTeam,
      evento.strHomeTeam,
      competicaoId,
      `partida:${evento.idEvent}:mandante`,
      inconsistencias,
    );
    const visitante = resolverClube(
      indice,
      evento.idAwayTeam,
      evento.strAwayTeam,
      competicaoId,
      `partida:${evento.idEvent}:visitante`,
      inconsistencias,
    );
    if (mandante === null || visitante === null) continue;

    partidas.push({
      id: evento.idEvent,
      competicaoId,
      rodada: null, // TheSportsDB não separa rodada de forma confiável para mata-mata/grupos mistos
      fase:
        evento.strGroup !== undefined && evento.strGroup !== '' ? evento.strGroup : null,
      mandanteId: mandante.id,
      visitanteId: visitante.id,
      dataHora: evento.dateEvent,
      horarioDefinido: traduzido.horarioDefinido,
      estadio: evento.strVenue ?? null,
      status: traduzido.status,
      placar: traduzido.placar,
    });
  }

  return { partidas, inconsistencias };
}

// --- Porta ProvedorFutebol (ADR-006 item 1) — I/O de rede -----------------

/** Buscador HTTP injetável (testabilidade — resposta mockada do provedor).
 * Compatível com o `fetch` nativo do Node 22 (SDD §3). */
export type BuscadorHttp = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface OpcoesAdaptadorTheSportsDB {
  clubes: ClubeBase[];
  buscar?: BuscadorHttp;
  baseUrl?: string;
}

/**
 * Fábrica do adaptador TheSportsDB (spike, ver nota de topo do arquivo).
 * Devolve o mesmo superconjunto `{ dados, inconsistencias }` do adaptador
 * football-data — compatível com `registrarProvedor` de `coletor-futebol.ts`
 * sem exigir mudança no orquestrador.
 */
export function criarAdaptadorTheSportsDB(opcoes: OpcoesAdaptadorTheSportsDB) {
  const buscar: BuscadorHttp = opcoes.buscar ?? ((url) => fetch(url));
  const baseUrl = opcoes.baseUrl ?? BASE_URL_THESPORTSDB;

  return {
    id: ID_PROVEDOR_THESPORTSDB,
    // Plano gratuito (chave "123"): 30 requisições/minuto.
    orcamento: { porMinuto: 30 },

    async obterClassificacao(ref: RefCompeticaoTheSportsDB) {
      if (!ref.temTabela) {
        // Mata-mata (Copa do Brasil, fases iniciais da Libertadores): não
        // existe "classificação" no domínio — devolve vazio sem gastar
        // requisição em vez de forçar uma tradução sem sentido.
        return { linhas: [], inconsistencias: [] };
      }
      const resposta = await buscar(
        `${baseUrl}/lookuptable.php?l=${ref.idLigaProvedor}&s=${ref.temporadaProvedor ?? ''}`,
      );
      if (!resposta.ok) {
        throw new Error(
          `TheSportsDB respondeu HTTP ${resposta.status} (classificação, liga ${ref.idLigaProvedor})`,
        );
      }
      const corpo = await resposta.json();
      return traduzirClassificacaoTheSportsDB(corpo, ref.competicaoId, opcoes.clubes);
    },

    async obterPartidas(ref: RefCompeticaoTheSportsDB) {
      const [respostaPassadas, respostaFuturas] = await Promise.all([
        buscar(`${baseUrl}/eventspastleague.php?id=${ref.idLigaProvedor}`),
        buscar(`${baseUrl}/eventsnextleague.php?id=${ref.idLigaProvedor}`),
      ]);
      if (!respostaPassadas.ok || !respostaFuturas.ok) {
        const status = !respostaPassadas.ok
          ? respostaPassadas.status
          : respostaFuturas.status;
        throw new Error(
          `TheSportsDB respondeu HTTP ${status} (partidas, liga ${ref.idLigaProvedor})`,
        );
      }
      const [corpoPassadas, corpoFuturas] = await Promise.all([
        respostaPassadas.json(),
        respostaFuturas.json(),
      ]);
      const passadas = traduzirPartidasTheSportsDB(
        corpoPassadas,
        ref.competicaoId,
        opcoes.clubes,
      );
      const futuras = traduzirPartidasTheSportsDB(
        corpoFuturas,
        ref.competicaoId,
        opcoes.clubes,
      );
      return {
        partidas: [...passadas.partidas, ...futuras.partidas],
        inconsistencias: [...passadas.inconsistencias, ...futuras.inconsistencias],
      };
    },
  };
}
