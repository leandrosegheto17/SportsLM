// pipeline/futebol/cobertura-ligas.integracao.test.ts — COB-31 (Lote 16.F)
//
// Portao de integracao ponta a ponta do pipeline de futebol multi-liga:
// `executarFluxoFutebol` (coleta -> adaptador TheSportsDB -> consistencia ->
// derivacao) + `construirSnapshots`, com o provedor mockado via `BuscadorHttp`
// alimentado pelas fixtures reais do SPK-06/SPK-08 (nenhuma rede real) e o
// espacador com relogio falso (ADR-021). Cobre ADR-022 (acumulo), ADR-023
// (participantes como candidatos) e ADR-024 (escopo parcial).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  criarAdaptadorTheSportsDB,
  type BuscadorHttp,
  type RefCompeticaoTheSportsDB,
} from './adaptador-thesportsdb';
import { criarEspacador } from './espacador-requisicoes';
import { registrarProvedor, type ProvedorRegistrado } from './coletor-futebol';
import {
  carregarCampeonatosDominio,
  estadoFutebolVazio,
  executarFluxoFutebol,
  type EstadoFutebol,
  type ResultadoFluxoFutebol,
} from './orquestrador';
import { carregarClubesSerieA2026, type ClubeBase } from '../config/clubes';
import {
  carregarEsportesConfig,
  construirSnapshots,
  type SnapshotsPublicados,
} from '../publicacao/gerador-snapshots';
import type { CampeonatoConfig } from '../../config/campeonatos.schema';
import type { Fonte } from '../../dominio/tipos/noticias';
import type { LinhaClassificacao, Partida } from '../../dominio/tipos/futebol';

// --- Fixtures ---------------------------------------------------------------

const DIR = join(__dirname, 'fixtures', 'thesportsdb');
const fx = (nome: string): string => readFileSync(join(DIR, nome), 'utf8');

const ID = {
  copa: '4725',
  lib: '4501',
  sul: '4724',
  paulista: '5767',
  carioca: '5688',
  mineiro: '5763',
  gaucho: '5691',
};

const CAMPEONATOS = carregarCampeonatosDominio();
const CLUBES = carregarClubesSerieA2026();
const idTsdb = (slug: string): string => {
  const v = CLUBES.find((c) => c.id === slug)?.idsProvedor['thesportsdb'];
  if (v === undefined) throw new Error(`fixture: sem id thesportsdb de ${slug}`);
  return String(v);
};

/** Evento sintetico derivado de um evento real do SPK-06 (mesmo formato de campos). */
function eventoSintetico(over: Record<string, unknown>): Record<string, unknown> {
  const base = (
    JSON.parse(fx('spk06-libertadores-past.json')) as {
      events: Record<string, unknown>[];
    }
  ).events[0];
  return { ...base, ...over };
}
const corpo = (events: unknown[] | null): string => JSON.stringify({ events });

/** Sul-Americana (sem fixture real no SPK-06): Botafogo jogou (FT) e joga em <48h. */
const SUL_PASSADO = corpo([
  eventoSintetico({
    idEvent: '9100001',
    idLeague: ID.sul,
    strLeague: 'Copa Sudamericana',
    strEvent: 'Botafogo vs Racing Club',
    strHomeTeam: 'Botafogo',
    strAwayTeam: 'Racing Club',
    idHomeTeam: idTsdb('botafogo'),
    idAwayTeam: '139999',
    strTimestamp: '2026-09-11T00:30:00',
    dateEvent: '2026-09-11',
    strTime: '00:30:00',
    intHomeScore: '2',
    intAwayScore: '0',
    strStatus: 'FT',
  }),
]);
const SUL_FUTURO = corpo([
  eventoSintetico({
    idEvent: '9100002',
    idLeague: ID.sul,
    strLeague: 'Copa Sudamericana',
    strEvent: 'Racing Club vs Botafogo',
    strHomeTeam: 'Racing Club',
    strAwayTeam: 'Botafogo',
    idHomeTeam: '139999',
    idAwayTeam: idTsdb('botafogo'),
    strTimestamp: '2026-09-19T23:00:00',
    dateEvent: '2026-09-19',
    strTime: '23:00:00',
    intHomeScore: null,
    intAwayScore: null,
    strStatus: 'NS',
  }),
]);
/** Botafogo tambem na Libertadores (ADR-023), alem do fixture real. */
const LIB_BOTAFOGO_FUTURO = eventoSintetico({
  idEvent: '9100003',
  strEvent: 'Botafogo vs Estudiantes de La Plata',
  strHomeTeam: 'Botafogo',
  strAwayTeam: 'Estudiantes de La Plata',
  idHomeTeam: idTsdb('botafogo'),
  idAwayTeam: '138000',
  strTimestamp: '2026-10-20T00:30:00',
  dateEvent: '2026-10-20',
  strTime: '00:30:00',
  intHomeScore: null,
  intAwayScore: null,
  strStatus: 'NS',
});

// --- Provedor mockado -------------------------------------------------------

interface Cenario {
  /** Sobrescritas por `endpoint:liga` -> corpo (string) ou status HTTP. */
  rotas?: Record<string, string | number>;
  /** Corpo de eventsday por `liga:AAAA-MM-DD`. */
  dias?: Record<string, string>;
}

function respostasPadrao(): Record<string, string> {
  const libNext = (
    JSON.parse(fx('spk06-libertadores-next.json')) as { events: unknown[] }
  ).events;
  return {
    [`past:${ID.copa}`]: fx('spk06-copa-do-brasil-past.json'),
    [`next:${ID.copa}`]: fx('spk06-copa-do-brasil-next.json'),
    [`table:${ID.copa}`]: fx('spk06-copa-do-brasil-tabela.json'), // corpo vazio
    [`past:${ID.lib}`]: fx('spk06-libertadores-past.json'),
    [`next:${ID.lib}`]: corpo([...libNext, LIB_BOTAFOGO_FUTURO]),
    [`table:${ID.lib}`]: fx('spk06-libertadores-tabela.json'), // corpo vazio
    [`past:${ID.sul}`]: SUL_PASSADO,
    [`next:${ID.sul}`]: SUL_FUTURO,
    [`past:${ID.paulista}`]: fx('spk06-paulista-past.json'),
    [`next:${ID.paulista}`]: fx('spk06-paulista-next.json'),
    [`table:${ID.paulista}`]: fx('spk06-paulista-tabela.json'), // tabela parcial
    [`past:${ID.carioca}`]: fx('spk06-carioca-past.json'), // PEN
    [`next:${ID.carioca}`]: fx('spk06-carioca-next.json'), // {"events":null}
    [`table:${ID.carioca}`]: '', // 200 + corpo vazio
  };
}

const DIAS_PADRAO: Record<string, string> = {
  [`${ID.lib}:2026-09-17`]: fx('spk08-libertadores-d0917.json'),
  [`${ID.lib}:2026-09-18`]: fx('spk08-libertadores-d0918.json'),
  [`${ID.copa}:2026-09-03`]: fx('spk08-copa-do-brasil-d0903.json'),
};

interface Ambiente {
  urls: string[];
  /** Instantes (ms, relogio falso) de cada requisicao ao provedor. */
  instantes: number[];
  provedores: Record<string, ProvedorRegistrado>;
}

function criarAmbiente(agora: Date, cenario: Cenario = {}): Ambiente {
  const urls: string[] = [];
  const instantes: number[] = [];
  let relogio = agora.getTime();
  const respostas = { ...respostasPadrao(), ...(cenario.rotas ?? {}) };
  const dias = { ...DIAS_PADRAO, ...(cenario.dias ?? {}) };

  const buscar: BuscadorHttp = (url) => {
    urls.push(url);
    instantes.push(relogio);
    const u = new URL(url);
    const endpoint = u.pathname.split('/').pop() ?? '';
    let chave = '';
    if (endpoint === 'eventspastleague.php')
      chave = `past:${u.searchParams.get('id') ?? ''}`;
    else if (endpoint === 'eventsnextleague.php')
      chave = `next:${u.searchParams.get('id') ?? ''}`;
    else if (endpoint === 'lookuptable.php')
      chave = `table:${u.searchParams.get('l') ?? ''}`;
    let texto: string | number | undefined;
    if (endpoint === 'eventsday.php') {
      texto =
        dias[`${u.searchParams.get('l') ?? ''}:${u.searchParams.get('d') ?? ''}`] ??
        corpo(null);
    } else {
      texto = respostas[chave] ?? (endpoint === 'lookuptable.php' ? '' : corpo(null));
    }
    if (typeof texto === 'number') {
      return Promise.resolve({
        ok: false,
        status: texto,
        json: () => Promise.reject(new Error('sem corpo')),
        text: () => Promise.resolve(''),
        headers: { get: () => null },
      });
    }
    const t = texto;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(t) as unknown),
      text: () => Promise.resolve(t),
    });
  };

  const espacador = criarEspacador({
    maxPorJanela: 28,
    janelaMs: 60000,
    intervaloMinMs: 2200,
    agora: () => relogio,
    dormir: (ms) => {
      relogio += ms;
      return Promise.resolve();
    },
  });
  const adaptadorTsdb = criarAdaptadorTheSportsDB({
    clubes: CLUBES,
    buscar,
    espacador,
    agora: () => agora,
  });
  const registroTsdb = registrarProvedor<RefCompeticaoTheSportsDB>(adaptadorTsdb, (c) => {
    const ref = c.refProvedor;
    if (ref === undefined) throw new Error(`sem refProvedor: ${c.id}`);
    const pol =
      c.formato === 'mata-mata' ? 'nunca' : c.formato === 'misto' ? 'tentar' : 'sempre';
    const completa =
      (c.formato === 'grupos' || c.formato === 'pontos-corridos') && c.clubes.length > 0;
    return {
      competicaoId: c.id,
      idLigaProvedor: ref.id,
      idLiga: Number(ref.id),
      politicaTabela: pol,
      ...(ref.temporada !== undefined ? { temporadaProvedor: ref.temporada } : {}),
      ...(completa ? { clubesEsperados: c.clubes.length } : {}),
    };
  });
  return {
    urls,
    instantes,
    provedores: { 'football-data-org': registroBrasileirao(), thesportsdb: registroTsdb },
  };
}

/** Brasileirao (football-data.org) mockado: 20 clubes, 1 rodada finalizada + 1 agendada. */
function registroBrasileirao(): ProvedorRegistrado {
  const clubes = CAMPEONATOS.find((c) => c.id === 'brasileirao-serie-a')?.clubes ?? [];
  const par = (l: readonly string[]): [string, string][] =>
    l.slice(0, l.length / 2).map((a, i) => [a, l[l.length - 1 - i] as string]);
  const mk = (n: number, fin: boolean, [m, v]: [string, string], i: number): Partida => ({
    id: `bsa-${String(n)}-${String(i)}`,
    competicaoId: 'brasileirao-serie-a',
    rodada: n,
    fase: null,
    mandanteId: m,
    visitanteId: v,
    dataHora: fin ? '2026-09-10T19:00:00-03:00' : '2026-09-19T19:00:00-03:00',
    horarioDefinido: true,
    estadio: null,
    status: fin ? 'finalizada' : 'agendada',
    placar: fin ? { mandante: 1, visitante: 1 } : null,
  });
  const partidas = [
    ...par(clubes).map((p, i) => mk(1, true, p, i)),
    ...par([...clubes].reverse()).map((p, i) => mk(2, false, p, i)),
  ];
  const linhas: LinhaClassificacao[] = clubes.map((clubeId, i) => ({
    competicaoId: 'brasileirao-serie-a',
    grupo: null,
    posicao: i + 1,
    clubeId,
    pontos: 1,
    jogos: 1,
    v: 0,
    e: 1,
    d: 0,
    gp: 1,
    gc: 1,
    sg: 0,
    aproveitamento: 100 / 3,
    ultimosCinco: ['E'],
  }));
  return registrarProvedor<{ competicaoId: string }>(
    {
      id: 'football-data-mock',
      orcamento: { porMinuto: 10 },
      obterClassificacao: () => Promise.resolve({ linhas, inconsistencias: [] }),
      obterPartidas: () => Promise.resolve({ partidas, inconsistencias: [] }),
    },
    (c: CampeonatoConfig) => ({ competicaoId: c.id }),
  );
}

// --- Auxiliares -------------------------------------------------------------

/** Config com o Paulista completado com RB Bragantino, que disputa o estadual no
 * provedor (fixture spk06-paulista-tabela) mas nao consta em `paulista.clubes`
 * de config/campeonatos-2026.json — com a config real o lote e descartado como
 * 'clube-fora-da-configuracao' (lacuna reportada pelo COB-31, ADR-023). */
const CAMPEONATOS_COM_BRAGANTINO_NO_PAULISTA: CampeonatoConfig[] = CAMPEONATOS.map((c) =>
  c.id === 'paulista' ? { ...c, clubes: [...c.clubes, 'rb-bragantino'] } : c,
);

const CICLO1 = new Date('2026-09-18T15:00:00Z'); // fora da janela dos estaduais
const CICLO_JANELA = new Date('2026-03-09T15:00:00Z'); // dentro da janela dos estaduais

const rodar = (
  agora: Date,
  amb: Ambiente,
  estadoAnterior: EstadoFutebol = estadoFutebolVazio(),
  campeonatos: readonly CampeonatoConfig[] = CAMPEONATOS,
): Promise<ResultadoFluxoFutebol> =>
  executarFluxoFutebol({
    campeonatos,
    provedores: amb.provedores,
    estadoAnterior,
    agora,
  });

const idsLiga = (urls: string[]): string[] => {
  const ordem: string[] = [];
  for (const u of urls) {
    const x = new URL(u);
    const id = x.searchParams.get('id') ?? x.searchParams.get('l') ?? '';
    if (id !== '' && !ordem.includes(id)) ordem.push(id);
  }
  return ordem;
};

const maxPorJanela = (instantes: number[], janelaMs: number): number => {
  let max = 0;
  for (const t of instantes) {
    max = Math.max(max, instantes.filter((x) => x >= t && x < t + janelaMs).length);
  }
  return max;
};

const fonte = (id: string): Fonte => ({
  id,
  nome: id,
  fixa: false,
  esportesCobertos: ['futebol'],
  termos: { url: null, verificadoEm: '2026-09-05', uso: 'nao-comercial' },
  frequenciaMaximaMin: 30,
  feeds: [],
  verificacao: { estado: 'verificada', em: '2026-09-05' },
});

function publicar(res: ResultadoFluxoFutebol, agora: Date): SnapshotsPublicados {
  return construirSnapshots({
    agora,
    itensNoticiasEstado: [],
    fontes: Array.from({ length: 10 }, (_, i) => fonte(`f${String(i)}`)),
    statusIngestaoBruto: res.status,
    competicoesFutebol: res.novoEstado.competicoes,
    campeonatosConfig: CAMPEONATOS,
    clubesBase: CLUBES as ClubeBase[],
    esportes: carregarEsportesConfig(),
    zonas: null,
  });
}

const st = (r: ResultadoFluxoFutebol, id: string): string | undefined =>
  r.status.futebol[id]?.resultado;

// --- Ciclo 1 (18/09/2026): estaduais fora da janela --------------------------

describe('COB-31 — ciclo 1 (2026-09-18, fixtures SPK-06/SPK-08)', () => {
  it('coleta ponta a ponta, isolamento, ordem RN-22, cota, snapshots e meta I-28', async () => {
    const amb = criarAmbiente(CICLO1);
    const res = await rodar(CICLO1, amb);

    // Estaduais e demais fora da janela: nenhuma requisicao (I-30 / PR-09).
    for (const id of [
      'paulista',
      'carioca',
      'mineiro',
      'gaucho',
      'supercopa-do-brasil',
    ]) {
      expect(st(res, id), id).toBe('fora-da-janela');
    }
    expect(idsLiga(amb.urls).sort()).toEqual([ID.copa, ID.lib, ID.sul].sort());
    // Sem cobertura: provedor null dentro da janela.
    expect(st(res, 'copa-do-nordeste')).toBe('fora-da-janela');

    // Ligas com dado: Brasileirao (outro provedor), Copa, Libertadores, Sul-Americana.
    for (const id of [
      'brasileirao-serie-a',
      'copa-do-brasil',
      'libertadores',
      'sul-americana',
    ]) {
      expect(st(res, id), `${id}: ${JSON.stringify(res.status.futebol[id])}`).toBe(
        'atualizada',
      );
    }

    // Ordem categoria (sem estado anterior): Libertadores, Sul-Americana, Copa.
    expect(idsLiga(amb.urls)).toEqual([ID.lib, ID.sul, ID.copa]);

    // <= 28 req/min com relogio falso; <= orcamento por execucao.
    expect(maxPorJanela(amb.instantes, 60000)).toBeLessThanOrEqual(28);
    expect(amb.urls.length).toBeLessThanOrEqual(60);

    // Corpo vazio em lookuptable (Libertadores/Copa nao consultam / vazio) => sem linhas, sem erro.
    expect(res.novoEstado.competicoes['libertadores']?.linhas).toEqual([]);

    // Botafogo em duas continentais sem erro (ADR-023).
    const botLib = res.novoEstado.competicoes['libertadores']?.participacoes.find(
      (p) => p.clubeId === 'botafogo',
    );
    const botSul = res.novoEstado.competicoes['sul-americana']?.participacoes.find(
      (p) => p.clubeId === 'botafogo',
    );
    expect(botLib?.status).toBe('em-andamento');
    expect(botSul?.status).toBe('em-andamento');

    // Adversario fora da Serie A mantido como `externo` (ADR-019), nunca id cru na UI.
    const sulPartidas = res.novoEstado.competicoes['sul-americana']?.partidas ?? [];
    expect(sulPartidas.length).toBe(2);
    expect(
      sulPartidas.every(
        (p) =>
          p.externo !== undefined ||
          p.mandanteId.startsWith('externo-') ||
          p.visitanteId.startsWith('externo-'),
      ),
    ).toBe(true);

    // Log por liga sem segredo/corpo.
    const log = (res.linhasLogPorLiga ?? []).join('\n');
    expect(log).not.toMatch(/thesportsdb\.com|idEvent|strEvent|token/i);

    // Snapshots validos (inclui COB-21) e status.json publicavel.
    const snap = publicar(res, CICLO1);
    expect(snap.statusIngestao).toBeDefined();
    const bot = snap.futebolPorClube['botafogo'] ?? [];
    expect(bot.map((c) => c.competicao.id)).toEqual(
      expect.arrayContaining([
        'libertadores',
        'sul-americana',
        'copa-do-brasil',
        'brasileirao-serie-a',
      ]),
    );
    // Adversario externo nunca vira id cru: todo lado `externo-` traz `externo.nome` (ADR-019).
    for (const camps of Object.values(snap.futebolPorClube)) {
      for (const camp of camps) {
        for (const pt of camp.partidas) {
          if (
            pt.mandanteId.startsWith('externo-') ||
            pt.visitanteId.startsWith('externo-')
          ) {
            expect(pt.externo?.nome ?? '').not.toBe('');
          }
        }
      }
    }
  });
});

// --- Ciclo dentro da janela dos estaduais (SPK-06) --------------------------

describe('COB-31 — estaduais dentro da janela (2026-03-09)', () => {
  it('tabela parcial (Paulista), PEN e ausencia de fase (Carioca), sem-dados-provedor e corpo vazio', async () => {
    const amb = criarAmbiente(CICLO_JANELA);
    const res = await rodar(
      CICLO_JANELA,
      amb,
      estadoFutebolVazio(),
      CAMPEONATOS_COM_BRAGANTINO_NO_PAULISTA,
    );

    // Paulista: tabela parcial retida (5 esperados na config, menos linhas mapeadas).
    const paulista = res.novoEstado.competicoes['paulista'];
    expect(st(res, 'paulista'), JSON.stringify(res.status.futebol['paulista'])).toBe(
      'atualizada',
    );
    expect(paulista?.competicao.tabelaParcial).toBe(true);
    expect(paulista?.linhas.length).toBeGreaterThan(0);
    expect(paulista?.linhas.length).toBeLessThan(6);
    expect(paulista?.linhas.length).toBeLessThan(paulista?.participacoes.length ?? 0);

    // Carioca (SPK-06): lookuptable com corpo vazio (HTTP 200) + jogo PEN. REFAT-16-02
    // (I-28, Bloqueio 013 opcao a): tabela vazia com partidas nao descarta o lote — as
    // partidas sao publicadas e a tabela fica "sem dados" (nunca `tabelaParcial`).
    expect(st(res, 'carioca')).toBe('atualizada');
    const carioca = res.novoEstado.competicoes['carioca'];
    expect(carioca?.linhas).toEqual([]);
    expect(carioca?.partidas.length).toBeGreaterThan(0);
    expect(carioca?.competicao.tabelaParcial).toBeUndefined();
    expect(res.status.futebol['carioca']?.ultimaAtualizacao).not.toBeNull();

    // Mineiro/Gaucho: provedor sem eventos nem tabela => sem-dados-provedor, sem ultimaAtualizacao.
    for (const id of ['mineiro', 'gaucho']) {
      expect(st(res, id), id).toBe('sem-dados-provedor');
      expect(res.status.futebol[id]?.ultimaAtualizacao).toBeNull();
      expect(
        res.novoEstado.competicoes[id]?.participacoes.every(
          (p) => p.status === 'sem-dados' || p.status === 'nao-iniciado',
        ),
      ).toBe(true);
    }

    // Sem cobertura de provedor (Baiano etc.): dentro da janela => sem-cobertura, nada omitido.
    expect(st(res, 'baiano')).toBe('sem-cobertura');
    expect(res.novoEstado.competicoes['baiano']).toBeDefined();

    // Estaduais + continentais + copa: dentro do orcamento e do limite por minuto.
    expect(maxPorJanela(amb.instantes, 60000)).toBeLessThanOrEqual(28);
    expect(amb.urls.length).toBeLessThanOrEqual(60);
  });
});

describe('COB-31 — PEN e ausencia de fase (Copa do Brasil, rodada 1, SPK-08)', () => {
  it('PEN vira finalizada com placar, sem fase e sem eliminar ninguem', async () => {
    // (a) Rodada 1 real (SPK-08): so jogos de times fora da Serie A (varios PEN) => nada a
    // publicar: sem-dados-provedor, sem carimbo e sem partida (ADR-022 recorte).
    const rodada1 = criarAmbiente(CICLO_JANELA, {
      rotas: {
        [`past:${ID.copa}`]: fx('spk08-copa-do-brasil-rodada1.json'),
        [`next:${ID.copa}`]: corpo(null),
      },
    });
    const r1 = await rodar(CICLO_JANELA, rodada1);
    expect(st(r1, 'copa-do-brasil')).toBe('sem-dados-provedor');
    expect(r1.status.futebol['copa-do-brasil']?.ultimaAtualizacao).toBeNull();
    expect(r1.novoEstado.competicoes['copa-do-brasil']?.partidas).toEqual([]);

    // (b) PEN com clube da Serie A (Palmeiras 2x2 externo), sem fase: finalizada com placar,
    // ninguem eliminado por inferencia (RN-17 / ADR-006 item 6).
    const pen = eventoSintetico({
      idEvent: '9100010',
      idLeague: ID.copa,
      strEvent: 'Palmeiras vs Externo FC',
      strHomeTeam: 'Palmeiras',
      strAwayTeam: 'Externo FC',
      idHomeTeam: idTsdb('palmeiras'),
      idAwayTeam: '139888',
      strTimestamp: '2026-03-04T23:00:00',
      dateEvent: '2026-03-04',
      strTime: '23:00:00',
      intHomeScore: '2',
      intAwayScore: '2',
      strStatus: 'PEN',
      strGroup: null,
      intRound: '0',
    });
    const amb = criarAmbiente(CICLO_JANELA, {
      rotas: { [`past:${ID.copa}`]: corpo([pen]), [`next:${ID.copa}`]: corpo(null) },
    });
    const res = await rodar(CICLO_JANELA, amb);
    const copa = res.novoEstado.competicoes['copa-do-brasil'];
    expect(
      st(res, 'copa-do-brasil'),
      JSON.stringify(res.status.futebol['copa-do-brasil']),
    ).toBe('atualizada');
    const partidas = copa?.partidas ?? [];
    expect(partidas).toHaveLength(1);
    expect(partidas[0]?.status).toBe('finalizada');
    expect(partidas[0]?.placar).toEqual({ mandante: 2, visitante: 2 });
    expect(partidas[0]?.fase ?? null).toBeNull();
    expect(copa?.participacoes.some((p) => p.status === 'eliminado')).toBe(false);
  });
});

// --- Acumulo, cota e isolamento --------------------------------------------

describe('COB-31 — acumulo entre ciclos, 429 e isolamento', () => {
  it('finalizada nunca regride e partida que some e mantida (ADR-022)', async () => {
    const r1 = await rodar(CICLO1, criarAmbiente(CICLO1));
    const antes = r1.novoEstado.competicoes['libertadores']?.partidas ?? [];
    const fin = antes.find((p) => p.status === 'finalizada');
    expect(fin).toBeDefined();

    // Ciclo 2: o provedor "esquece" tudo e devolve a mesma partida como agendada.
    const evt = (
      JSON.parse(fx('spk06-libertadores-past.json')) as {
        events: Record<string, unknown>[];
      }
    ).events[0] as Record<string, unknown>;
    const regredido = { ...evt, intHomeScore: null, intAwayScore: null, strStatus: 'NS' };
    const amb2 = criarAmbiente(CICLO1, {
      rotas: {
        [`past:${ID.lib}`]: corpo([regredido]),
        [`next:${ID.lib}`]: corpo(null),
      },
      dias: {
        [`${ID.lib}:2026-09-17`]: corpo(null),
        [`${ID.lib}:2026-09-18`]: corpo(null),
      },
    });
    const r2 = await rodar(new Date('2026-09-18T18:00:00Z'), amb2, r1.novoEstado);
    expect(st(r2, 'libertadores')).toBe('atualizada');
    const depois = r2.novoEstado.competicoes['libertadores']?.partidas ?? [];
    expect(depois.find((p) => p.id === fin?.id)?.status).toBe('finalizada');
    expect(depois.find((p) => p.id === fin?.id)?.placar).toEqual(fin?.placar);
    for (const p of antes)
      expect(
        depois.some((d) => d.id === p.id),
        p.id,
      ).toBe(true);
  });

  it('429 no meio: restantes pausado-por-cota, dado anterior mantido, outro provedor segue, RN-22 na ordem', async () => {
    const r1 = await rodar(CICLO1, criarAmbiente(CICLO1));
    const amb = criarAmbiente(CICLO1, { rotas: { [`past:${ID.lib}`]: 429 } });
    const r2 = await rodar(CICLO1, amb, r1.novoEstado);

    // Sul-Americana tem jogo em <= 48h => faixa 1, vai antes da Libertadores.
    expect(idsLiga(amb.urls)[0]).toBe(ID.sul);
    expect(st(r2, 'sul-americana')).toBe('atualizada');
    expect(st(r2, 'libertadores')).toBe('pausado-por-cota');
    expect(st(r2, 'copa-do-brasil')).toBe('pausado-por-cota');
    expect(r2.status.pausadoPorCota).toBe(true);
    expect(st(r2, 'brasileirao-serie-a')).toBe('atualizada');
    expect(r2.novoEstado.competicoes['libertadores']).toEqual(
      r1.novoEstado.competicoes['libertadores'],
    );
    expect(r2.novoEstado.competicoes['copa-do-brasil']).toEqual(
      r1.novoEstado.competicoes['copa-do-brasil'],
    );
  });

  it('isolamento: uma liga que lanca vira falha so dela; externo e demais ligas mantidos', async () => {
    const r1 = await rodar(CICLO1, criarAmbiente(CICLO1));
    const amb = criarAmbiente(CICLO1, {
      rotas: { [`past:${ID.sul}`]: '{ json quebrado' },
    });
    const r2 = await rodar(CICLO1, amb, r1.novoEstado);
    expect(st(r2, 'sul-americana')).toBe('falha');
    expect(r2.status.futebol['sul-americana']?.mensagemErro ?? '').not.toContain(
      'json quebrado'.repeat(3),
    );
    expect(st(r2, 'libertadores')).toBe('atualizada');
    expect(st(r2, 'copa-do-brasil')).toBe('atualizada');
    expect(r2.novoEstado.competicoes['sul-americana']).toEqual(
      r1.novoEstado.competicoes['sul-americana'],
    );
  });
});

// --- Eliminacao so com evidencia; meta I-28 ---------------------------------

describe('COB-31 — eliminacao so com evidencia e cobertura I-28', () => {
  it('jogo unico / PEN / empate nao eliminam ninguem (Copa do Brasil)', async () => {
    const r = await rodar(CICLO1, criarAmbiente(CICLO1));
    const copa = r.novoEstado.competicoes['copa-do-brasil'];
    expect(copa?.participacoes.some((p) => p.status === 'eliminado')).toBe(false);
  });

  it('mede a cobertura (pares clube-competicao com dado real nas fixtures)', async () => {
    // Uniao dos dois ciclos: janela de estaduais (marco) + janela de continentais/copa (setembro).
    const r1 = await rodar(CICLO1, criarAmbiente(CICLO1));
    const r2 = await rodar(
      CICLO_JANELA,
      criarAmbiente(CICLO_JANELA),
      r1.novoEstado,
      CAMPEONATOS_COM_BRAGANTINO_NO_PAULISTA,
    );
    const finais = r2.novoEstado.competicoes;
    let total = 0;
    let comDado = 0; // clube com partida/linha reais (status != sem-dados/nao-iniciado)
    let emLigaComLote = 0; // clube em liga cujo lote foi aceito (resultado atualizada)
    const porLiga: string[] = [];
    for (const c of CAMPEONATOS_COM_BRAGANTINO_NO_PAULISTA) {
      if (c.clubes.length === 0) continue;
      const parts = finais[c.id]?.participacoes ?? [];
      const ok = c.clubes.filter((clubeId) => {
        const p = parts.find((x) => x.clubeId === clubeId);
        return p !== undefined && p.status !== 'sem-dados' && p.status !== 'nao-iniciado';
      }).length;
      const ligaAtualizada =
        (finais[c.id]?.competicao.ultimaAtualizacao ?? null) !== null;
      total += c.clubes.length;
      comDado += ok;
      if (ligaAtualizada) emLigaComLote += c.clubes.length;
      porLiga.push(
        `${c.id}: ${String(ok)}/${String(c.clubes.length)}${ligaAtualizada ? '' : ' (sem lote)'}`,
      );
    }
    const pctLiga = (emLigaComLote / total) * 100;
    const pctClube = (comDado / total) * 100;
    console.log(
      `[COB-31] cobertura I-28 nas fixtures: pares em liga com lote aceito ${String(emLigaComLote)}/${String(total)} = ${pctLiga.toFixed(1)}%; ` +
        `pares com partida/linha real ${String(comDado)}/${String(total)} = ${pctClube.toFixed(1)}% | ${porLiga.join(' ; ')}`,
    );
    expect(total).toBeGreaterThan(0);
    expect(pctLiga).toBeGreaterThanOrEqual(80);
  });
});
