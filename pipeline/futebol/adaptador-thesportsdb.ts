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
import { partidaSchema } from '../../dominio/tipos/futebol';
import type { LinhaClassificacao, Partida } from '../../dominio/tipos/futebol';
import {
  ID_PROVEDOR_THESPORTSDB,
  SENTINELA_ID_PENDENTE,
  type ClubeBase,
} from '../config/clubes';
import { criarEspacador, type Espacador } from './espacador-requisicoes';
import { planejarDias } from './planejar-dias';
import type {
  InconsistenciaClube,
  InconsistenciaPartida,
  InconsistenciaStatusPartidaDesconhecido,
} from './adaptador-football-data';
export type {
  InconsistenciaClubeSerieASemId,
  InconsistenciaPartidaInvalida,
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
  /** Id de liga numérico (ADR-022), exposto para o `eventsday` (COB-33). */
  idLiga?: number;
  /** Política de tabela (ADR-020 item 3): `nunca` = sem requisição, vazio;
   * `sempre` = consulta e falha em erro; `tentar` = consulta e trata "sem
   * tabela" (`table: null`, corpo vazio, 404) como classificação vazia. */
  politicaTabela: PoliticaTabelaTheSportsDB;
  /** Temporada no formato do provedor (`s=`), ex. `'2026'` — obrigatória
   * quando a política consulta a tabela (`lookuptable.php` exige `s`). */
  temporadaProvedor?: string;
  /** Nº de clubes configurados em `pontos-corridos`/`grupos`; base da
   * detecção de tabela parcial (ADR-024). Ausente = não avalia parcialidade. */
  clubesEsperados?: number;
}

export type PoliticaTabelaTheSportsDB = 'nunca' | 'sempre' | 'tentar';

/** Tabela do provedor com menos linhas mapeadas que clubes configurados —
 * publicada com `Competicao.tabelaParcial = true` (ADR-024), nunca `falha`. */
export interface InconsistenciaTabelaParcialProvedor {
  tipo: 'tabela-parcial-provedor';
  competicaoId: string;
  linhasMapeadas: number;
  clubesConfigurados: number;
  contexto: string;
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

/** Fase = `strGroup` como texto puro, aparado, ≤ 60; ilegível/vazio => null.
 * Nunca deriva de `intRound` (SPK-06, ADR-022). */
function normalizarFase(bruto: string | null | undefined): string | null {
  if (bruto === null || bruto === undefined) return null;
  const texto = bruto.replace(/<[^>]*>/g, '').trim();
  return texto === '' || texto.length > 60 ? null : texto;
}

const eventoProvedorSchema = z.object({
  idEvent: z.string(),
  dateEvent: z.string().nullable(),
  /** UTC `AAAA-MM-DDTHH:MM:SS`; preferido a `dateEventLocal` (SPK-08). */
  strTimestamp: z.string().nullable().optional(),
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

/** Prefere `strTimestamp` (UTC) a dateEvent/strTime quando bem formado. */
function normalizarPorTimestamp(evento: EventoProvedor): EventoProvedor {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(evento.strTimestamp ?? '');
  if (m === null) return evento;
  return { ...evento, dateEvent: m[1]!, strTime: m[2]! };
}

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

export type InconsistenciaPartidaTheSportsDB = InconsistenciaPartida;
export type InconsistenciaClassificacaoTheSportsDB =
  | InconsistenciaClube
  | InconsistenciaTabelaParcialProvedor;

function normalizarNome(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Só diagnóstico: o nome do provedor parece um clube da Série A sem id? */
function pareceClubeSerieA(nomeProvedor: string, clubes: ClubeBase[]): boolean {
  const alvo = normalizarNome(nomeProvedor);
  return clubes.some(
    (c) => normalizarNome(c.nome) === alvo || normalizarNome(c.nomeCurto) === alvo,
  );
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
  clubesEsperados?: number,
): {
  linhas: LinhaClassificacao[];
  inconsistencias: InconsistenciaClassificacaoTheSportsDB[];
  parcial: boolean;
} {
  const resposta = tabelaProvedorSchema.parse(respostaBruta);
  const indice = indiceClubesPorIdProvedor(clubes);
  const inconsistencias: InconsistenciaClassificacaoTheSportsDB[] = [];
  const linhas: LinhaClassificacao[] = [];

  for (const linha of resposta.table ?? []) {
    const clube = indice.get(linha.idTeam);
    if (clube === undefined) {
      // Externo à Série A: ignorado sem inconsistência (ADR-019 item 4).
      // Parece clube da Série A sem id: segue inconsistência.
      if (pareceClubeSerieA(linha.strTeam, clubes)) {
        inconsistencias.push({
          tipo: 'clube-nao-mapeado',
          competicaoId,
          idProvedor: linha.idTeam,
          nomeProvedorDiagnostico: linha.strTeam,
          contexto: `classificacao:posicao ${linha.intRank}`,
        });
      }
      continue;
    }

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

  const parcial =
    clubesEsperados !== undefined && linhas.length > 0 && linhas.length < clubesEsperados;
  if (parcial) {
    inconsistencias.push({
      tipo: 'tabela-parcial-provedor',
      competicaoId,
      linhasMapeadas: linhas.length,
      clubesConfigurados: clubesEsperados,
      contexto: 'classificacao:tabela-parcial',
    });
  }

  return { linhas, inconsistencias, parcial };
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
const STATUS_ENCERRADO = new Set(['FT', 'AET', 'PEN']);
const STATUS_EM_ANDAMENTO = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const STATUS_ADIADO = new Set(['PST', 'SUSP']);
const STATUS_CANCELADO = new Set(['CANC', 'ABD', 'AWD', 'WO']);

function dataJaPassou(evento: EventoProvedor, agora: Date): boolean {
  if (evento.dateEvent === null) return false;
  const hora =
    evento.strTime !== null && evento.strTime !== undefined && evento.strTime !== ''
      ? evento.strTime
      : '23:59:59';
  const instante = Date.parse(`${evento.dateEvent}T${hora}Z`);
  return !Number.isNaN(instante) && instante < agora.getTime();
}

/**
 * Status tolerantes (RF-22, CA-22.3/22.4): encerrado (FT/AET/PEN) com placar →
 * `finalizada` (nunca inferimos quem avançou); em andamento ou código
 * desconhecido com data passada → `aguardando-resultado` (sem placar parcial);
 * desconhecido com data futura → `agendada`. Só status ausente/vazio
 * (realmente ilegível) é descartado e registrado.
 */
function traduzirStatusEHorario(
  evento: EventoProvedor,
  agora: Date,
):
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
  const codigo = (evento.strStatus ?? '').trim().toUpperCase();
  const aguardando = {
    ok: true as const,
    status: 'aguardando-resultado' as const,
    horarioDefinido: true,
    placar: null,
  };

  if (codigo === '') return { ok: false };
  if (codigo === 'NS')
    return { ok: true, status: 'agendada', horarioDefinido, placar: null };
  if (STATUS_ENCERRADO.has(codigo)) {
    return temPlacarCompleto
      ? { ok: true, status: 'finalizada', horarioDefinido: true, placar }
      : aguardando;
  }
  if (STATUS_ADIADO.has(codigo)) {
    return { ok: true, status: 'adiada', horarioDefinido: false, placar: null };
  }
  if (STATUS_CANCELADO.has(codigo)) {
    return { ok: true, status: 'cancelada', horarioDefinido, placar: null };
  }
  if (STATUS_EM_ANDAMENTO.has(codigo)) return aguardando;
  return dataJaPassou(evento, agora)
    ? aguardando
    : { ok: true, status: 'agendada', horarioDefinido, placar: null };
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
  agora: Date = new Date(),
): {
  partidas: Partida[];
  inconsistencias: InconsistenciaPartidaTheSportsDB[];
  /** Partidas sem nenhum lado Série A — comportamento esperado (CA-21.2). */
  foraDoRecorte: number;
} {
  const resposta = eventosProvedorSchema.parse(respostaBruta);
  const indice = indiceClubesPorIdProvedor(clubes);
  const inconsistencias: InconsistenciaPartidaTheSportsDB[] = [];
  let foraDoRecorte = 0;
  const partidas: Partida[] = [];

  for (const bruto of resposta.events ?? []) {
    const evento = normalizarPorTimestamp(bruto);
    const traduzido = traduzirStatusEHorario(evento, agora);
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

    const mandante = indice.get(evento.idHomeTeam) ?? null;
    const visitante = indice.get(evento.idAwayTeam) ?? null;

    if (mandante === null && visitante === null) {
      const suspeito = [
        [evento.idHomeTeam, evento.strHomeTeam, 'mandante'],
        [evento.idAwayTeam, evento.strAwayTeam, 'visitante'],
      ].find(([, nome]) => pareceClubeSerieA(nome as string, clubes));
      if (suspeito !== undefined) {
        inconsistencias.push({
          tipo: 'clube-serie-a-sem-id',
          competicaoId,
          idProvedor: suspeito[0] as string,
          nomeProvedorDiagnostico: suspeito[1] as string,
          contexto: `partida:${evento.idEvent}:${suspeito[2]}`,
        });
      } else {
        foraDoRecorte += 1;
      }
      continue;
    }

    let externo: Partida['externo'];
    if (mandante === null || visitante === null) {
      const lado = mandante === null ? 'mandante' : 'visitante';
      const idExt = lado === 'mandante' ? evento.idHomeTeam : evento.idAwayTeam;
      const nomeExt = lado === 'mandante' ? evento.strHomeTeam : evento.strAwayTeam;
      if (pareceClubeSerieA(nomeExt, clubes)) {
        inconsistencias.push({
          tipo: 'clube-serie-a-sem-id',
          competicaoId,
          idProvedor: idExt,
          nomeProvedorDiagnostico: nomeExt,
          contexto: `partida:${evento.idEvent}:${lado}`,
        });
        continue;
      }
      externo = { lado, nome: nomeExt };
    }
    const mandanteId = mandante?.id ?? `externo-${evento.idHomeTeam}`;
    const visitanteId = visitante?.id ?? `externo-${evento.idAwayTeam}`;

    const candidata = {
      id: evento.idEvent,
      competicaoId,
      rodada: null, // TheSportsDB não separa rodada de forma confiável para mata-mata/grupos mistos
      fase: normalizarFase(evento.strGroup),
      mandanteId,
      visitanteId,
      dataHora: evento.dateEvent,
      horarioDefinido: traduzido.horarioDefinido,
      estadio: evento.strVenue ?? null,
      status: traduzido.status,
      placar: traduzido.placar,
      ...(externo === undefined ? {} : { externo }),
    };
    const validada = partidaSchema.safeParse(candidata);
    if (!validada.success) {
      inconsistencias.push({
        tipo: 'partida-invalida',
        competicaoId,
        idPartidaProvedor: evento.idEvent,
        motivo: validada.error.issues.map((x) => x.message).join('; '),
        contexto: `partida:${evento.idEvent}:externo`,
      });
      continue;
    }
    partidas.push(validada.data);
  }

  return { partidas, inconsistencias, foraDoRecorte };
}

// --- Porta ProvedorFutebol (ADR-006 item 1) — I/O de rede -----------------

/** Buscador HTTP injetável (testabilidade — resposta mockada do provedor).
 * Compatível com o `fetch` nativo do Node 22 (SDD §3). */
export type BuscadorHttp = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  /** Corpo cru — o provedor responde HTTP 200 com corpo vazio (0 bytes) em
   * `lookuptable` de algumas ligas (SPK-06); `.json()` cru lançaria. */
  text: () => Promise<string>;
  /** Opcional: usado só para citar `Retry-After` na mensagem de negação. */
  headers?: { get: (nome: string) => string | null };
}>;

export interface OpcoesAdaptadorTheSportsDB {
  clubes: ClubeBase[];
  buscar?: BuscadorHttp;
  baseUrl?: string;
  /** Espaçador de requisições (ADR-021); padrão: instância única por adaptador. */
  espacador?: Espacador;
  /** Relógio injetável (dias-alvo do eventsday); padrão: `new Date()`. */
  agora?: () => Date;
}

function erroHttp(resposta: Awaited<ReturnType<BuscadorHttp>>, contexto: string): Error {
  const retry = resposta.headers?.get('Retry-After') ?? null;
  const sufixo = retry !== null && /^\d+$/.test(retry) ? `, Retry-After ${retry}s` : '';
  // Nunca inclui o corpo da resposta na mensagem.
  return new Error(
    `TheSportsDB respondeu HTTP ${resposta.status} (${contexto}${sufixo})`,
  );
}

/** Falha de parse/validação do corpo vira mensagem estática: `SyntaxError` e
 * `ZodError` citam trecho do corpo do provedor (SEC-16-02). */
async function semVazarCorpo<T>(contexto: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (erro) {
    if (erro instanceof SyntaxError || erro instanceof z.ZodError) {
      throw new Error(`TheSportsDB respondeu corpo inválido (${contexto})`);
    }
    throw erro;
  }
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
  const espacador: Espacador =
    opcoes.espacador ??
    criarEspacador({
      maxPorJanela: 28,
      janelaMs: 60000,
      intervaloMinMs: 2200,
      agora: () => Date.now(),
      dormir: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
  const buscarEspacado = (url: string) => espacador.executar(() => buscar(url));

  return {
    id: ID_PROVEDOR_THESPORTSDB,
    // Plano gratuito (chave "123"): 30 requisições/minuto.
    orcamento: { porMinuto: 30, porExecucao: 60 },

    /** Teto do ADR-022: 2 âncoras + até 5 dias + tabela (1) conforme política. */
    custoEstimado(ref: RefCompeticaoTheSportsDB): number {
      return ref.politicaTabela === 'nunca' ? 7 : 8;
    },

    obterClassificacao(ref: RefCompeticaoTheSportsDB) {
      return semVazarCorpo(`classificação, liga ${ref.idLigaProvedor}`, async () => {
        const vazio = {
          linhas: [] as LinhaClassificacao[],
          inconsistencias: [] as InconsistenciaClassificacaoTheSportsDB[],
          parcial: false,
        };
        // Mata-mata: não existe "classificação" no domínio — sem requisição.
        if (ref.politicaTabela === 'nunca') return vazio;
        const resposta = await buscarEspacado(
          `${baseUrl}/lookuptable.php?l=${ref.idLigaProvedor}&s=${ref.temporadaProvedor ?? ''}`,
        );
        if (!resposta.ok) {
          if (ref.politicaTabela === 'tentar' && resposta.status === 404) return vazio;
          throw erroHttp(resposta, `classificação, liga ${ref.idLigaProvedor}`);
        }
        const texto = await resposta.text();
        if (texto.trim() === '') return vazio; // HTTP 200 com corpo vazio (SPK-06)
        return traduzirClassificacaoTheSportsDB(
          JSON.parse(texto) as unknown,
          ref.competicaoId,
          opcoes.clubes,
          ref.clubesEsperados,
        );
      });
    },

    obterPartidas(ref: RefCompeticaoTheSportsDB) {
      return semVazarCorpo(`partidas, liga ${ref.idLigaProvedor}`, async () => {
        // Serial (ADR-021): past -> next, cada uma pelo espaçador.
        const respostaPassadas = await buscarEspacado(
          `${baseUrl}/eventspastleague.php?id=${ref.idLigaProvedor}`,
        );
        if (!respostaPassadas.ok) {
          throw erroHttp(respostaPassadas, `partidas, liga ${ref.idLigaProvedor}`);
        }
        const corpoPassadas = await respostaPassadas.json();
        const respostaFuturas = await buscarEspacado(
          `${baseUrl}/eventsnextleague.php?id=${ref.idLigaProvedor}`,
        );
        if (!respostaFuturas.ok) {
          throw erroHttp(respostaFuturas, `partidas, liga ${ref.idLigaProvedor}`);
        }
        const corpoFuturas = await respostaFuturas.json();
        const lotes = [corpoPassadas, corpoFuturas];
        if (ref.idLiga !== undefined) {
          const dataDe = (corpo: unknown, ultimo: boolean): string | null => {
            const evs = eventosProvedorSchema.parse(corpo).events ?? [];
            const dias = evs
              .map((e) => normalizarPorTimestamp(e).dateEvent)
              .filter((d): d is string => d !== null)
              .sort();
            return (ultimo ? dias[dias.length - 1] : dias[0]) ?? null;
          };
          const dias = planejarDias({
            hoje: (opcoes.agora ?? (() => new Date()))(),
            ultimoEvento: dataDe(corpoPassadas, true),
            proximoEvento: dataDe(corpoFuturas, false),
            faixa: 1,
          });
          for (const dia of dias) {
            const r = await buscarEspacado(
              `${baseUrl}/eventsday.php?d=${dia}&l=${ref.idLiga}`,
            );
            if (!r.ok) throw erroHttp(r, `partidas do dia ${dia}, liga ${ref.idLiga}`);
            lotes.push(await r.json());
          }
        }
        const traduzidos = lotes.map((corpo) =>
          traduzirPartidasTheSportsDB(corpo, ref.competicaoId, opcoes.clubes),
        );
        const vistos = new Set<string>();
        const partidas: Partida[] = [];
        for (const t of traduzidos) {
          for (const p of t.partidas) {
            if (vistos.has(p.id)) continue;
            vistos.add(p.id);
            partidas.push(p);
          }
        }
        return {
          partidas,
          inconsistencias: traduzidos.flatMap((t) => t.inconsistencias),
          foraDoRecorte: traduzidos.reduce((a, t) => a + t.foraDoRecorte, 0),
        };
      });
    },
  };
}
