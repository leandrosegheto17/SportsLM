// pipeline/futebol/adaptador-thesportsdb.test.ts — spike (ADR-006, decisão pendente)
//
// Testes com fixtures capturadas ao vivo da API pública do TheSportsDB
// (curl direto, 2026-09-07 — ver nota de topo de `adaptador-thesportsdb.ts`),
// não inventadas: tabela real do Paulista/Carioca (`lookuptable.php`) e
// eventos reais passado/futuro da Copa do Brasil/Libertadores
// (`eventspastleague.php`/`eventsnextleague.php`). `idTeam`/`idHomeTeam`
// usados nos clubes de teste são os ids reais devolvidos pelo provedor
// nessas respostas — não mockados/plausíveis, ao contrário do débito
// conhecido do adaptador football-data.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  criarAdaptadorTheSportsDB,
  traduzirClassificacaoTheSportsDB,
  traduzirPartidasTheSportsDB,
  type BuscadorHttp,
} from './adaptador-thesportsdb';
import { ID_PROVEDOR_THESPORTSDB, type ClubeBase } from '../config/clubes';
import { criarEspacador } from './espacador-requisicoes';

function clube(id: string, idProvedor: string): ClubeBase {
  return {
    id,
    nome: id,
    nomeCurto: id,
    sigla: 'XXX',
    corBase: '#000000',
    idsProvedor: { [ID_PROVEDOR_THESPORTSDB]: idProvedor },
  };
}

// Fixture real: `lookuptable.php?l=5767&s=2026` (Paulista), truncada às 2
// primeiras linhas — capturada ao vivo em 2026-09-07.
const TABELA_PAULISTA_REAL = {
  table: [
    {
      idStanding: '9762530',
      intRank: '1',
      idTeam: '141182',
      strTeam: 'Novorizontino',
      idLeague: '5767',
      strLeague: 'Brazilian Campeonato Paulista',
      strSeason: '2026',
      strGroup: 'Paulista A1: Regular season',
      strForm: 'LWDWW',
      intPlayed: '8',
      intWin: '5',
      intLoss: '2',
      intDraw: '1',
      intGoalsFor: '16',
      intGoalsAgainst: '10',
      intGoalDifference: '6',
      intPoints: '16',
      dateUpdated: '2026-06-12 11:35:00',
    },
    {
      idStanding: '9762531',
      intRank: '2',
      idTeam: '134465',
      strTeam: 'Palmeiras',
      idLeague: '5767',
      strLeague: 'Brazilian Campeonato Paulista',
      strSeason: '2026',
      strGroup: 'Paulista A1: Regular season',
      strForm: 'DWLWL',
      intPlayed: '8',
      intWin: '5',
      intLoss: '2',
      intDraw: '1',
      intGoalsFor: '8',
      intGoalsAgainst: '7',
      intGoalDifference: '1',
      intPoints: '16',
      dateUpdated: '2026-06-12 11:35:00',
    },
  ],
};

// Fixture real: `eventspastleague.php?id=4725` (Copa do Brasil) — jogo de
// 2026-09-03, capturado em 2026-09-07 (há 4 dias, não estático).
const EVENTO_PASSADO_COPA_DO_BRASIL_REAL = {
  events: [
    {
      idEvent: '2570522',
      dateEvent: '2026-09-03',
      strTime: '23:00:00',
      strStatus: 'FT',
      strPostponed: 'no',
      strVenue: 'Arena do Grêmio',
      strGroup: '',
      idHomeTeam: '134288',
      strHomeTeam: 'Grêmio',
      idAwayTeam: '134281',
      strAwayTeam: 'Internacional',
      intHomeScore: '3',
      intAwayScore: '1',
    },
  ],
};

// Fixture real: `eventsnextleague.php?id=4725` (Copa do Brasil) — jogo
// agendado para 2026-11-01, capturado em 2026-09-07.
const EVENTO_FUTURO_COPA_DO_BRASIL_REAL = {
  events: [
    {
      idEvent: '2599514',
      dateEvent: '2026-11-01',
      strTime: '21:00:00',
      strStatus: 'NS',
      strPostponed: 'no',
      strVenue: 'Estádio São Januário',
      strGroup: null,
      idHomeTeam: '134282',
      strHomeTeam: 'Vasco da Gama',
      idAwayTeam: '134465',
      strAwayTeam: 'Palmeiras',
      intHomeScore: null,
      intAwayScore: null,
    },
  ],
};

describe('traduzirClassificacaoTheSportsDB (fixture real — Paulista 2026)', () => {
  it('casa clube por idTeam do provedor e traduz os campos da linha', () => {
    const clubes = [clube('novorizontino', '141182'), clube('palmeiras', '134465')];
    const { linhas, inconsistencias } = traduzirClassificacaoTheSportsDB(
      TABELA_PAULISTA_REAL,
      'paulista',
      clubes,
    );
    expect(inconsistencias).toEqual([]);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toEqual({
      competicaoId: 'paulista',
      grupo: 'Paulista A1: Regular season',
      posicao: 1,
      clubeId: 'novorizontino',
      pontos: 16,
      jogos: 8,
      v: 5,
      e: 1,
      d: 2,
      gp: 16,
      gc: 10,
      sg: 6,
      aproveitamento: (16 / (8 * 3)) * 100,
      ultimosCinco: ['D', 'V', 'E', 'V', 'V'], // "LWDWW" → L=D, W=V, D=E
    });
  });

  it('registra clube não mapeado como inconsistência e descarta a linha (CA-16.6), sem afetar as demais', () => {
    const semId: ClubeBase = { ...clube('novorizontino', '0'), idsProvedor: {} };
    const clubes = [clube('palmeiras', '134465'), semId];
    const { linhas, inconsistencias } = traduzirClassificacaoTheSportsDB(
      TABELA_PAULISTA_REAL,
      'paulista',
      clubes,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.clubeId).toBe('palmeiras');
    expect(inconsistencias).toEqual([
      {
        tipo: 'clube-nao-mapeado',
        competicaoId: 'paulista',
        idProvedor: '141182',
        nomeProvedorDiagnostico: 'Novorizontino',
        contexto: 'classificacao:posicao 1',
      },
    ]);
  });

  it('devolve lista vazia (nunca erro) quando o provedor responde `table: null`', () => {
    const { linhas, inconsistencias } = traduzirClassificacaoTheSportsDB(
      { table: null },
      'sem-dados',
      [],
    );
    expect(linhas).toEqual([]);
    expect(inconsistencias).toEqual([]);
  });
});

describe('traduzirPartidasTheSportsDB (fixtures reais — Copa do Brasil 2026)', () => {
  it('traduz jogo finalizado com placar completo (status FT)', () => {
    const clubes = [clube('gremio', '134288'), clube('internacional', '134281')];
    const { partidas, inconsistencias } = traduzirPartidasTheSportsDB(
      EVENTO_PASSADO_COPA_DO_BRASIL_REAL,
      'copa-do-brasil',
      clubes,
    );
    expect(inconsistencias).toEqual([]);
    expect(partidas).toEqual([
      {
        id: '2570522',
        competicaoId: 'copa-do-brasil',
        rodada: null,
        fase: null,
        mandanteId: 'gremio',
        visitanteId: 'internacional',
        dataHora: '2026-09-03',
        horarioDefinido: true,
        estadio: 'Arena do Grêmio',
        status: 'finalizada',
        placar: { mandante: 3, visitante: 1 },
      },
    ]);
  });

  it('traduz jogo agendado sem placar (status NS)', () => {
    const clubes = [clube('vasco', '134282'), clube('palmeiras', '134465')];
    const { partidas, inconsistencias } = traduzirPartidasTheSportsDB(
      EVENTO_FUTURO_COPA_DO_BRASIL_REAL,
      'copa-do-brasil',
      clubes,
    );
    expect(inconsistencias).toEqual([]);
    expect(partidas).toEqual([
      {
        id: '2599514',
        competicaoId: 'copa-do-brasil',
        rodada: null,
        fase: null,
        mandanteId: 'vasco',
        visitanteId: 'palmeiras',
        dataHora: '2026-11-01',
        horarioDefinido: true,
        estadio: 'Estádio São Januário',
        status: 'agendada',
        placar: null,
      },
    ]);
  });

  it('descarta e registra individualmente partida com status ilegível (ausente), sem afetar as demais', () => {
    const clubes = [
      clube('gremio', '134288'),
      clube('internacional', '134281'),
      clube('vasco', '134282'),
      clube('palmeiras', '134465'),
    ];
    const eventoComStatusDesconhecido = {
      events: [
        { ...EVENTO_PASSADO_COPA_DO_BRASIL_REAL.events[0], strStatus: null },
        EVENTO_FUTURO_COPA_DO_BRASIL_REAL.events[0],
      ],
    };
    const { partidas, inconsistencias } = traduzirPartidasTheSportsDB(
      eventoComStatusDesconhecido,
      'copa-do-brasil',
      clubes,
    );
    expect(partidas).toHaveLength(1);
    expect(partidas[0]?.id).toBe('2599514');
    expect(inconsistencias).toEqual([
      {
        tipo: 'partida-status-desconhecido',
        competicaoId: 'copa-do-brasil',
        idPartidaProvedor: 2570522,
        statusBrutoDiagnostico: '(ausente)',
        contexto: 'partida:2570522:status',
      },
    ]);
  });

  it('marca `adiada` quando strPostponed é "yes", independente de strStatus', () => {
    const clubes = [clube('gremio', '134288'), clube('internacional', '134281')];
    const eventoAdiado = {
      events: [{ ...EVENTO_PASSADO_COPA_DO_BRASIL_REAL.events[0], strPostponed: 'yes' }],
    };
    const { partidas } = traduzirPartidasTheSportsDB(
      eventoAdiado,
      'copa-do-brasil',
      clubes,
    );
    expect(partidas[0]?.status).toBe('adiada');
    expect(partidas[0]?.placar).toBeNull();
  });
});

describe('traduzirPartidasTheSportsDB - status tolerantes (COB-07, RF-22)', () => {
  const clubes = [clube('gremio', '134288'), clube('internacional', '134281')];
  const AGORA = new Date('2026-09-18T12:00:00Z');
  const base = EVENTO_PASSADO_COPA_DO_BRASIL_REAL.events[0];
  const traduzir = (over: Record<string, unknown>) =>
    traduzirPartidasTheSportsDB(
      { events: [{ ...base, dateEvent: '2026-09-01', strPostponed: null, ...over }] },
      'copa-do-brasil',
      clubes,
      AGORA,
    );
  const placar = { intHomeScore: '1', intAwayScore: '1' };
  const semPlacar = { intHomeScore: null, intAwayScore: null };
  it.each([
    ['FT', placar, 'finalizada'],
    ['AET', placar, 'finalizada'],
    ['PEN', placar, 'finalizada'],
    ['FT', semPlacar, 'aguardando-resultado'],
    ['NS', semPlacar, 'agendada'],
    ['1H', semPlacar, 'aguardando-resultado'],
    ['HT', placar, 'aguardando-resultado'],
    ['PST', semPlacar, 'adiada'],
    ['CANC', semPlacar, 'cancelada'],
    ['XYZ', semPlacar, 'aguardando-resultado'],
  ])('%s -> %s', (strStatus, sc, esperado) => {
    const { partidas, inconsistencias } = traduzir({ strStatus, ...sc });
    expect(inconsistencias).toEqual([]);
    expect(partidas[0]?.status).toBe(esperado);
  });
  it('PEN empatado: finalizada com placar, sem campo de vencedor', () => {
    const p = traduzir({ strStatus: 'PEN', ...placar }).partidas[0];
    expect(p?.placar).toEqual({ mandante: 1, visitante: 1 });
    expect(Object.keys(p ?? {})).not.toContain('vencedor');
  });
  it('em andamento nunca expõe placar parcial', () => {
    expect(traduzir({ strStatus: '2H', ...placar }).partidas[0]?.placar).toBeNull();
  });
  it('desconhecido com data futura -> agendada', () => {
    const r = traduzir({ strStatus: 'XYZ', dateEvent: '2026-10-01', ...semPlacar });
    expect(r.partidas[0]?.status).toBe('agendada');
  });
  it('status vazio segue descartado e registrado', () => {
    const r = traduzir({ strStatus: '' });
    expect(r.partidas).toHaveLength(0);
    expect(r.inconsistencias).toHaveLength(1);
  });
});

describe('traduzirPartidasTheSportsDB - adversario fora da Serie A (COB-06, ADR-019)', () => {
  const base = EVENTO_PASSADO_COPA_DO_BRASIL_REAL.events[0]!;
  const ev = (o: Record<string, unknown>) => ({ events: [{ ...base, ...o }] });
  const gremio = clube('gremio', '134288');

  it('Serie A mandante x externo visitante: mantem com externo e id sintetico', () => {
    const r = traduzirPartidasTheSportsDB(
      ev({ idAwayTeam: '999', strAwayTeam: 'Time Da Roça' }),
      'copa-do-brasil',
      [gremio],
    );
    expect(r.inconsistencias).toEqual([]);
    expect(r.partidas[0]).toMatchObject({
      mandanteId: 'gremio',
      visitanteId: 'externo-999',
      externo: { lado: 'visitante', nome: 'Time Da Roça' },
    });
  });

  it('externo mandante x Serie A visitante', () => {
    const r = traduzirPartidasTheSportsDB(
      ev({ idHomeTeam: '777', strHomeTeam: 'Clube X' }),
      'copa-do-brasil',
      [clube('internacional', '134281')],
    );
    expect(r.partidas[0]).toMatchObject({
      mandanteId: 'externo-777',
      visitanteId: 'internacional',
      externo: { lado: 'mandante', nome: 'Clube X' },
    });
  });

  it('Serie A x Serie A: sem externo', () => {
    const r = traduzirPartidasTheSportsDB(
      EVENTO_PASSADO_COPA_DO_BRASIL_REAL,
      'copa-do-brasil',
      [gremio, clube('internacional', '134281')],
    );
    expect(r.partidas[0]?.externo).toBeUndefined();
    expect(r.foraDoRecorte).toBe(0);
  });

  it('externo x externo: descarta e conta fora-do-recorte, sem inconsistencia', () => {
    const r = traduzirPartidasTheSportsDB(
      ev({ idHomeTeam: '1', strHomeTeam: 'Alfa', idAwayTeam: '2', strAwayTeam: 'Beta' }),
      'copa-do-brasil',
      [gremio],
    );
    expect(r.partidas).toEqual([]);
    expect(r.inconsistencias).toEqual([]);
    expect(r.foraDoRecorte).toBe(1);
  });

  it('clube da Serie A sem id: descarta, registra diagnostico e nao vira externo', () => {
    const semId: ClubeBase = { ...clube('internacional', 'x'), idsProvedor: {} };
    semId.nome = 'Internacional';
    const r = traduzirPartidasTheSportsDB(ev({}), 'copa-do-brasil', [gremio, semId]);
    expect(r.partidas).toEqual([]);
    expect(r.foraDoRecorte).toBe(0);
    expect(r.inconsistencias).toEqual([
      {
        tipo: 'clube-serie-a-sem-id',
        competicaoId: 'copa-do-brasil',
        idProvedor: '134281',
        nomeProvedorDiagnostico: 'Internacional',
        contexto: 'partida:2570522:visitante',
      },
    ]);
  });

  it('nome externo invalido: descarta e registra', () => {
    const r = traduzirPartidasTheSportsDB(
      ev({ idAwayTeam: '999', strAwayTeam: '<b>x</b>' }),
      'copa-do-brasil',
      [gremio],
    );
    expect(r.partidas).toEqual([]);
    expect(r.inconsistencias[0]).toMatchObject({
      tipo: 'partida-invalida',
      idPartidaProvedor: '2570522',
    });
  });
});

describe('criarAdaptadorTheSportsDB', () => {
  function buscadorFixo(mapa: Record<string, unknown>): BuscadorHttp {
    return async (url: string) => {
      const chave = Object.keys(mapa).find((k) => url.includes(k));
      if (chave === undefined) {
        return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
      }
      return {
        ok: true,
        status: 200,
        json: async () => mapa[chave],
        text: async () => JSON.stringify(mapa[chave]),
      };
    };
  }

  it('não chama a API para competição sem tabela (mata-mata) — devolve vazio direto', async () => {
    let chamadas = 0;
    const adaptador = criarAdaptadorTheSportsDB({
      clubes: [],
      buscar: async () => {
        chamadas += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ table: [] }),
          text: async () => '{"table":[]}',
        };
      },
    });
    const resultado = await adaptador.obterClassificacao({
      competicaoId: 'copa-do-brasil',
      idLigaProvedor: '4725',
      politicaTabela: 'nunca' as const,
    });
    expect(resultado).toEqual({ linhas: [], inconsistencias: [], parcial: false });
    expect(chamadas).toBe(0);
  });

  it('obterClassificacao busca lookuptable.php e traduz para competição com tabela', async () => {
    const adaptador = criarAdaptadorTheSportsDB({
      clubes: [clube('novorizontino', '141182'), clube('palmeiras', '134465')],
      buscar: buscadorFixo({ 'lookuptable.php': TABELA_PAULISTA_REAL }),
    });
    const resultado = await adaptador.obterClassificacao({
      competicaoId: 'paulista',
      idLigaProvedor: '5767',
      politicaTabela: 'sempre' as const,
      temporadaProvedor: '2026',
    });
    expect(resultado.linhas).toHaveLength(2);
  });

  it('obterPartidas combina eventspastleague.php e eventsnextleague.php', async () => {
    const adaptador = criarAdaptadorTheSportsDB({
      clubes: [
        clube('gremio', '134288'),
        clube('internacional', '134281'),
        clube('vasco', '134282'),
        clube('palmeiras', '134465'),
      ],
      buscar: buscadorFixo({
        eventspastleague: EVENTO_PASSADO_COPA_DO_BRASIL_REAL,
        eventsnextleague: EVENTO_FUTURO_COPA_DO_BRASIL_REAL,
      }),
    });
    const resultado = await adaptador.obterPartidas({
      competicaoId: 'copa-do-brasil',
      idLigaProvedor: '4725',
      politicaTabela: 'nunca' as const,
    });
    expect(resultado.partidas).toHaveLength(2);
    expect(resultado.partidas.map((p) => p.status).sort()).toEqual([
      'agendada',
      'finalizada',
    ]);
  });

  it('lança erro com HTTP status quando o provedor responde erro (classificação)', async () => {
    const adaptador = criarAdaptadorTheSportsDB({
      clubes: [],
      buscar: async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
        text: async () => '',
      }),
    });
    await expect(
      adaptador.obterClassificacao({
        competicaoId: 'paulista',
        idLigaProvedor: '5767',
        politicaTabela: 'sempre' as const,
        temporadaProvedor: '2026',
      }),
    ).rejects.toThrow('HTTP 503');
  });
});

// --- COB-08: política de tabela, corpo vazio, tabela parcial (ADR-020/022/024)

const DIR_FIXTURES = join(__dirname, 'fixtures', 'thesportsdb');
const lerFixture = (nome: string): string =>
  readFileSync(join(DIR_FIXTURES, nome), 'utf8');

const CLUBES_PAULISTA_FIXTURE = [
  clube('novorizontino', '141182'),
  clube('palmeiras', '134465'),
  clube('bragantino', '134736'),
  clube('portuguesa', '134283'),
  clube('corinthians', '134284'),
];

function buscadorTexto(
  corpo: string,
  opcoes: { ok?: boolean; status?: number } = {},
): { buscador: BuscadorHttp; urls: string[] } {
  const urls: string[] = [];
  const buscador: BuscadorHttp = async (url) => {
    urls.push(url);
    return {
      ok: opcoes.ok ?? true,
      status: opcoes.status ?? 200,
      json: async () => JSON.parse(corpo) as unknown,
      text: async () => corpo,
    };
  };
  return { buscador, urls };
}

describe('obterClassificacao - política de tabela (COB-08)', () => {
  const ref = (
    politicaTabela: 'nunca' | 'sempre' | 'tentar',
    extra: { clubesEsperados?: number } = {},
  ) => ({
    competicaoId: 'paulista',
    idLigaProvedor: '5767',
    politicaTabela,
    temporadaProvedor: '2026',
    ...extra,
  });

  it('nunca = 0 requisições; sempre = 1', async () => {
    const a = buscadorTexto(lerFixture('spk06-paulista-tabela.json'));
    const ad = criarAdaptadorTheSportsDB({
      clubes: CLUBES_PAULISTA_FIXTURE,
      buscar: a.buscador,
    });
    await ad.obterClassificacao(ref('nunca'));
    expect(a.urls).toHaveLength(0);
    await ad.obterClassificacao(ref('sempre'));
    expect(a.urls).toHaveLength(1);
  });

  it.each(['spk06-libertadores-tabela.json', 'spk06-copa-do-brasil-tabela.json'])(
    'corpo vazio (%s) => vazio sem exceção, em sempre e tentar',
    async (arquivo) => {
      const corpo = lerFixture(arquivo);
      expect(corpo).toBe('');
      for (const politica of ['sempre', 'tentar'] as const) {
        const { buscador } = buscadorTexto(corpo);
        const ad = criarAdaptadorTheSportsDB({ clubes: [], buscar: buscador });
        await expect(ad.obterClassificacao(ref(politica))).resolves.toEqual({
          linhas: [],
          inconsistencias: [],
          parcial: false,
        });
      }
    },
  );

  it('tabela de 5 linhas do Paulista com 12 clubes => publicada, parcial e diagnóstico', async () => {
    const { buscador } = buscadorTexto(lerFixture('spk06-paulista-tabela.json'));
    const ad = criarAdaptadorTheSportsDB({
      clubes: CLUBES_PAULISTA_FIXTURE,
      buscar: buscador,
    });
    const r = await ad.obterClassificacao(ref('sempre', { clubesEsperados: 12 }));
    expect(r.linhas).toHaveLength(5);
    expect(r.parcial).toBe(true);
    expect(r.inconsistencias).toEqual([
      {
        tipo: 'tabela-parcial-provedor',
        competicaoId: 'paulista',
        linhasMapeadas: 5,
        clubesConfigurados: 12,
        contexto: 'classificacao:tabela-parcial',
      },
    ]);
  });

  it('tabela completa => parcial false, sem diagnóstico', async () => {
    const { buscador } = buscadorTexto(lerFixture('spk06-paulista-tabela.json'));
    const ad = criarAdaptadorTheSportsDB({
      clubes: CLUBES_PAULISTA_FIXTURE,
      buscar: buscador,
    });
    const r = await ad.obterClassificacao(ref('sempre', { clubesEsperados: 5 }));
    expect(r.parcial).toBe(false);
    expect(r.inconsistencias).toEqual([]);
  });

  it('tentar: com tabela / table null / tabela vazia => sem exceção', async () => {
    const comTabela = buscadorTexto(lerFixture('spk06-paulista-tabela.json'));
    const ad1 = criarAdaptadorTheSportsDB({
      clubes: CLUBES_PAULISTA_FIXTURE,
      buscar: comTabela.buscador,
    });
    expect((await ad1.obterClassificacao(ref('tentar'))).linhas).toHaveLength(5);
    for (const corpo of ['{"table":null}', '{"table":[]}']) {
      const { buscador } = buscadorTexto(corpo);
      const ad = criarAdaptadorTheSportsDB({ clubes: [], buscar: buscador });
      expect((await ad.obterClassificacao(ref('tentar'))).linhas).toEqual([]);
    }
  });

  it('tentar: HTTP 404 => vazio; 503 => lança', async () => {
    const nf = buscadorTexto('', { ok: false, status: 404 });
    const ad = criarAdaptadorTheSportsDB({ clubes: [], buscar: nf.buscador });
    expect((await ad.obterClassificacao(ref('tentar'))).linhas).toEqual([]);
    const err = buscadorTexto('', { ok: false, status: 503 });
    const ad2 = criarAdaptadorTheSportsDB({ clubes: [], buscar: err.buscador });
    await expect(ad2.obterClassificacao(ref('tentar'))).rejects.toThrow('HTTP 503');
  });

  it('linha externa ignorada sem inconsistência; Série A sem id segue inconsistência', () => {
    const semId: ClubeBase = { ...clube('corinthians', '0'), idsProvedor: {} };
    const clubes = [clube('palmeiras', '134465'), semId];
    const { linhas, inconsistencias } = traduzirClassificacaoTheSportsDB(
      JSON.parse(lerFixture('spk06-paulista-tabela.json')),
      'paulista',
      clubes,
    );
    expect(linhas.map((l) => l.clubeId)).toEqual(['palmeiras']);
    expect(inconsistencias).toHaveLength(1);
    expect(inconsistencias[0]).toMatchObject({
      tipo: 'clube-nao-mapeado',
      idProvedor: '134284',
    });
  });
});

describe('traduzirPartidasTheSportsDB - fase (COB-09, ADR-022)', () => {
  const clubes = [clube('vasco', '134282'), clube('palmeiras', '134465')];
  const base = EVENTO_FUTURO_COPA_DO_BRASIL_REAL.events[0];
  const fase = (extra: Record<string, unknown>) =>
    traduzirPartidasTheSportsDB(
      { events: [{ ...base, ...extra }] },
      'copa-do-brasil',
      clubes,
    ).partidas[0]?.fase;

  it('strGroup vazio/ausente => fase null, intRound ignorado', () => {
    expect(fase({ strGroup: '', intRound: '28' })).toBeNull();
    expect(fase({ strGroup: null, intRound: '150' })).toBeNull();
    expect(fase({ strGroup: undefined, intRound: '0' })).toBeNull();
  });

  it('strGroup preenchido vira fase aparada', () => {
    expect(fase({ strGroup: '  Grupo A  ', intRound: '21' })).toBe('Grupo A');
  });

  it('strGroup só com espaços ou acima de 60 => null', () => {
    expect(fase({ strGroup: '   ' })).toBeNull();
    expect(fase({ strGroup: 'x'.repeat(61) })).toBeNull();
  });

  it('remove marcação HTML (texto puro)', () => {
    expect(fase({ strGroup: '<b>Grupo B</b>' })).toBe('Grupo B');
  });
});

// --- COB-11: espaçador, serial, custo declarado, negação (ADR-021/022) -------

describe('criarAdaptadorTheSportsDB - espaçador e custo (COB-11)', () => {
  const refCopa = {
    competicaoId: 'copa-do-brasil',
    idLigaProvedor: '4725',
    politicaTabela: 'nunca' as const,
  };
  const refPaulista = (politicaTabela: 'sempre' | 'tentar') => ({
    competicaoId: 'paulista',
    idLigaProvedor: '5767',
    politicaTabela,
    temporadaProvedor: '2026',
  });
  const espacadorRapido = () =>
    criarEspacador({
      maxPorJanela: 28,
      janelaMs: 60000,
      intervaloMinMs: 0,
      agora: () => 0,
      dormir: async () => {},
    });
  const vazio = (corpo: string) => ({
    ok: true,
    status: 200,
    json: async () => JSON.parse(corpo) as unknown,
    text: async () => corpo,
  });

  it('serializa past -> next -> tabela, todos pelo espaçador', async () => {
    const log: string[] = [];
    const ad = criarAdaptadorTheSportsDB({
      clubes: [],
      espacador: {
        executar: async <T>(fn: () => Promise<T>): Promise<T> => {
          log.push('esp');
          return fn();
        },
      },
      buscar: async (url) => {
        log.push(/\/(\w+)\.php/.exec(url)![1]!);
        return vazio(url.includes('lookuptable') ? '{"table":null}' : '{"events":null}');
      },
    });
    await ad.obterPartidas(refPaulista('sempre'));
    await ad.obterClassificacao(refPaulista('sempre'));
    expect(log).toEqual([
      'esp', 'eventspastleague', 'esp', 'eventsnextleague', 'esp', 'lookuptable',
    ]);
  });

  it('chamadas concorrentes nunca sobrepõem requisições', async () => {
    let ativas = 0;
    let maxAtivas = 0;
    const ad = criarAdaptadorTheSportsDB({
      clubes: [],
      espacador: espacadorRapido(),
      buscar: async () => {
        ativas += 1;
        maxAtivas = Math.max(maxAtivas, ativas);
        await new Promise((r) => setTimeout(r, 1));
        ativas -= 1;
        return vazio('{"events":null}');
      },
    });
    await Promise.all([ad.obterPartidas(refCopa), ad.obterPartidas(refCopa)]);
    expect(maxAtivas).toBe(1);
  });

  it('20 chamadas com espaçador real e relógio falso levam >= 44 s simulados', async () => {
    let t = 0;
    const ad = criarAdaptadorTheSportsDB({
      clubes: [],
      espacador: criarEspacador({
        maxPorJanela: 28,
        janelaMs: 60000,
        intervaloMinMs: 2200,
        agora: () => t,
        dormir: async (ms) => {
          t += ms;
        },
      }),
      buscar: async () => vazio('{"events":null}'),
    });
    for (let i = 0; i < 10; i++) await ad.obterPartidas(refCopa); // 2 chamadas cada
    expect(t).toBeGreaterThanOrEqual(19 * 2200);
  });

  it('custoEstimado: teto 7 para nunca, 8 para sempre/tentar; orcamento declara porExecucao 60', () => {
    const ad = criarAdaptadorTheSportsDB({ clubes: [] });
    expect(ad.custoEstimado(refCopa)).toBe(7);
    expect(ad.custoEstimado(refPaulista('sempre'))).toBe(8);
    expect(ad.custoEstimado(refPaulista('tentar'))).toBe(8);
    expect(ad.orcamento).toEqual({ porMinuto: 30, porExecucao: 60 });
  });

  it.each([429, 502, 503])(
    'HTTP %i com Retry-After é detectável e não vaza o corpo',
    async (status) => {
      const ad = criarAdaptadorTheSportsDB({
        clubes: [],
        espacador: espacadorRapido(),
        buscar: async () => ({
          ok: false,
          status,
          headers: { get: (n: string) => (n.toLowerCase() === 'retry-after' ? '60' : null) },
          json: async () => ({ segredo: 'CORPO' }),
          text: async () => 'CORPO-SECRETO',
        }),
      });
      for (const chamada of [
        () => ad.obterPartidas(refCopa),
        () => ad.obterClassificacao(refPaulista('sempre')),
      ]) {
        const erro = (await chamada().catch((e: unknown) => e)) as Error;
        expect(erro).toBeInstanceOf(Error);
        expect(erro.message).toMatch(/HTTP (429|5\d\d)\b/);
        expect(erro.message).not.toContain('CORPO');
      }
    },
  );
});

describe('COB-33: eventsday (fixtures spk08)', () => {
  const lerFx = (n: string) => readFileSync(join(__dirname, 'fixtures', 'thesportsdb', n), 'utf8');
  const rapido = () =>
    criarEspacador({
      maxPorJanela: 1000,
      janelaMs: 60000,
      intervaloMinMs: 0,
      agora: () => 0,
      dormir: async () => {},
    });
  const ref = {
    competicaoId: 'copa-do-brasil',
    idLigaProvedor: '4725',
    idLiga: 4725,
    politicaTabela: 'nunca' as const,
  };

  it('serial past, next, dias; dia com 3 jogos; events:null = 0; dedupe por idEvent', async () => {
    const urls: string[] = [];
    const dia3 = lerFx('spk08-copa-do-brasil-d0903.json');
    const ad = criarAdaptadorTheSportsDB({
      clubes: [],
      espacador: rapido(),
      agora: () => new Date('2026-09-04T12:00:00Z'),
      buscar: async (url) => {
        urls.push(url);
        const corpo =
          url.includes('eventspastleague') || url.includes('eventsday.php?d=2026-09-03')
            ? dia3
            : '{"events":null}';
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(corpo) as unknown,
          text: async () => corpo,
        };
      },
    });
    const r = await ad.obterPartidas(ref);
    expect(urls[0]).toContain('eventspastleague');
    expect(urls[1]).toContain('eventsnextleague');
    expect(urls.some((u) => u.includes('eventsday.php?d=2026-09-03&l=4725'))).toBe(true);
    expect(urls.length).toBeLessThanOrEqual(7);
    const total = (JSON.parse(dia3) as { events: unknown[] }).events.length;
    // 3 eventos vindos da âncora e do dia: dedupe => contagem única
    expect(r.partidas.length + r.foraDoRecorte + r.inconsistencias.length).toBe(total * 2);
    expect(new Set(r.partidas.map((p) => p.id)).size).toBe(r.partidas.length);
  });
});
