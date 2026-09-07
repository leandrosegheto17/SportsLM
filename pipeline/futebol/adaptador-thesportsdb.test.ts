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

import { describe, expect, it } from 'vitest';
import {
  criarAdaptadorTheSportsDB,
  traduzirClassificacaoTheSportsDB,
  traduzirPartidasTheSportsDB,
  type BuscadorHttp,
} from './adaptador-thesportsdb';
import { ID_PROVEDOR_THESPORTSDB, type ClubeBase } from '../config/clubes';

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
    const clubes = [clube('palmeiras', '134465')]; // Novorizontino ausente de propósito
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

  it('descarta e registra individualmente partida com status fora de NS/FT, sem afetar as demais', () => {
    const clubes = [
      clube('gremio', '134288'),
      clube('internacional', '134281'),
      clube('vasco', '134282'),
      clube('palmeiras', '134465'),
    ];
    const eventoComStatusDesconhecido = {
      events: [
        { ...EVENTO_PASSADO_COPA_DO_BRASIL_REAL.events[0], strStatus: 'ABD' },
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
        statusBrutoDiagnostico: 'ABD',
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

describe('criarAdaptadorTheSportsDB', () => {
  function buscadorFixo(mapa: Record<string, unknown>): BuscadorHttp {
    return async (url: string) => {
      const chave = Object.keys(mapa).find((k) => url.includes(k));
      if (chave === undefined) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => mapa[chave] };
    };
  }

  it('não chama a API para competição sem tabela (mata-mata) — devolve vazio direto', async () => {
    let chamadas = 0;
    const adaptador = criarAdaptadorTheSportsDB({
      clubes: [],
      buscar: async () => {
        chamadas += 1;
        return { ok: true, status: 200, json: async () => ({ table: [] }) };
      },
    });
    const resultado = await adaptador.obterClassificacao({
      competicaoId: 'copa-do-brasil',
      idLigaProvedor: '4725',
      temTabela: false,
    });
    expect(resultado).toEqual({ linhas: [], inconsistencias: [] });
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
      temTabela: true,
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
      temTabela: false,
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
      buscar: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    });
    await expect(
      adaptador.obterClassificacao({
        competicaoId: 'paulista',
        idLigaProvedor: '5767',
        temTabela: true,
        temporadaProvedor: '2026',
      }),
    ).rejects.toThrow('HTTP 503');
  });
});
