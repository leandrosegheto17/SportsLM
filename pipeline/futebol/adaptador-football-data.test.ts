// pipeline/futebol/adaptador-football-data.test.ts — ING-F-01 (TASK.md Lote 5)
//
// Testes com resposta mockada do provedor (football-data.org), verificando
// especificamente o casamento por id (CA-16.6/ADR-006 item 3) — nunca por
// nome — e a tradução de status/placar/classificação para o domínio.
//
// Nota (ver cabeçalho de `adaptador-football-data.ts`): os ids de provedor
// usados aqui para clubes além do Flamengo são MOCKADOS e plausíveis, não os
// ids reais do football-data.org — isso é aceitável para esta tarefa porque
// `config/clubes-2026.json` (CFG-02) ainda tem 19/20 clubes com
// `idsProvedor['football-data']` na sentinela `pendente-confirmacao`
// (REFAT-02-01, débito conhecido). O teste
// `carregarClubesSerieA2026 (configuração real)` abaixo documenta esse
// estado atual explicitamente, para que não passe despercebido quando os
// ids reais forem preenchidos.

import { describe, expect, it } from 'vitest';
import {
  criarAdaptadorFootballData,
  traduzirClassificacao,
  traduzirPartidas,
  type BuscadorHttp,
} from './adaptador-football-data';
import {
  carregarClubesSerieA2026,
  ID_PROVEDOR_FOOTBALL_DATA,
  type ClubeBase,
} from '../config/clubes';

const CLUBES_TESTE: ClubeBase[] = [
  {
    id: 'flamengo',
    nome: 'Clube de Regatas do Flamengo',
    nomeCurto: 'Flamengo',
    sigla: 'FLA',
    corBase: '#E2231A',
    idsProvedor: { [ID_PROVEDOR_FOOTBALL_DATA]: 1783 }, // id real (ADR-006, único confirmado)
  },
  {
    id: 'palmeiras',
    nome: 'Sociedade Esportiva Palmeiras',
    nomeCurto: 'Palmeiras',
    sigla: 'PAL',
    corBase: '#006437',
    idsProvedor: { [ID_PROVEDOR_FOOTBALL_DATA]: 1769 }, // id mockado plausível p/ teste
  },
  {
    id: 'corinthians',
    nome: 'Sport Club Corinthians Paulista',
    nomeCurto: 'Corinthians',
    sigla: 'COR',
    corBase: '#000000',
    idsProvedor: { [ID_PROVEDOR_FOOTBALL_DATA]: 1827 }, // id mockado plausível p/ teste
  },
];

function timeProvedor(id: number, name: string) {
  return { id, name };
}

describe('traduzirClassificacao', () => {
  it('casa clube por id do provedor e traduz os campos da linha (CA-10.1)', () => {
    const resposta = {
      standings: [
        {
          type: 'TOTAL',
          group: null,
          table: [
            {
              position: 1,
              team: timeProvedor(1783, 'CR Flamengo'),
              playedGames: 10,
              form: 'L,D,W,W,W',
              won: 7,
              draw: 2,
              lost: 1,
              points: 23,
              goalsFor: 20,
              goalsAgainst: 10,
              goalDifference: 10,
            },
            {
              position: 2,
              team: timeProvedor(1769, 'SE Palmeiras'),
              playedGames: 10,
              form: null,
              won: 6,
              draw: 2,
              lost: 2,
              points: 20,
              goalsFor: 15,
              goalsAgainst: 9,
              goalDifference: 6,
            },
          ],
        },
      ],
    };

    const { linhas, inconsistencias } = traduzirClassificacao(
      resposta,
      'brasileirao-serie-a',
      CLUBES_TESTE,
    );

    expect(inconsistencias).toEqual([]);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toEqual({
      competicaoId: 'brasileirao-serie-a',
      grupo: null,
      posicao: 1,
      clubeId: 'flamengo',
      pontos: 23,
      jogos: 10,
      v: 7,
      e: 2,
      d: 1,
      gp: 20,
      gc: 10,
      sg: 10,
      aproveitamento: (23 / 30) * 100,
      ultimosCinco: ['D', 'E', 'V', 'V', 'V'],
    });
    // `form` ausente (início de temporada) vira lista vazia, nunca inventada
    expect(linhas[1]?.ultimosCinco).toEqual([]);
    expect(linhas[1]?.clubeId).toBe('palmeiras');
  });

  it('CA-16.6/ADR-006 item 3: descarta e registra time cujo id não está mapeado — mesmo que o nome bata com um clube conhecido', () => {
    const resposta = {
      standings: [
        {
          type: 'TOTAL',
          group: null,
          table: [
            {
              // id diferente do configurado para Palmeiras (1769), mas nome idêntico —
              // prova que o casamento é por id, nunca por nome.
              position: 1,
              team: timeProvedor(999999, 'Sociedade Esportiva Palmeiras'),
              playedGames: 5,
              form: 'W,W,W,W,W',
              won: 5,
              draw: 0,
              lost: 0,
              points: 15,
              goalsFor: 10,
              goalsAgainst: 2,
              goalDifference: 8,
            },
          ],
        },
      ],
    };

    const { linhas, inconsistencias } = traduzirClassificacao(
      resposta,
      'brasileirao-serie-a',
      CLUBES_TESTE,
    );

    expect(linhas).toEqual([]);
    expect(inconsistencias).toEqual([
      {
        tipo: 'clube-nao-mapeado',
        competicaoId: 'brasileirao-serie-a',
        idProvedor: 999999,
        nomeProvedorDiagnostico: 'Sociedade Esportiva Palmeiras',
        contexto: 'classificacao:posicao 1',
      },
    ]);
  });

  it('ignora tabelas do tipo HOME/AWAY — só TOTAL vira LinhaClassificacao', () => {
    const resposta = {
      standings: [
        {
          type: 'HOME',
          group: null,
          table: [
            {
              position: 1,
              team: timeProvedor(1783, 'CR Flamengo'),
              playedGames: 5,
              form: null,
              won: 5,
              draw: 0,
              lost: 0,
              points: 15,
              goalsFor: 10,
              goalsAgainst: 2,
              goalDifference: 8,
            },
          ],
        },
      ],
    };
    const { linhas } = traduzirClassificacao(
      resposta,
      'brasileirao-serie-a',
      CLUBES_TESTE,
    );
    expect(linhas).toEqual([]);
  });

  it('jogos=0 não gera divisão por zero em aproveitamento', () => {
    const resposta = {
      standings: [
        {
          type: 'TOTAL',
          group: null,
          table: [
            {
              position: 1,
              team: timeProvedor(1783, 'CR Flamengo'),
              playedGames: 0,
              form: null,
              won: 0,
              draw: 0,
              lost: 0,
              points: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              goalDifference: 0,
            },
          ],
        },
      ],
    };
    const { linhas } = traduzirClassificacao(
      resposta,
      'brasileirao-serie-a',
      CLUBES_TESTE,
    );
    expect(linhas[0]?.aproveitamento).toBe(0);
  });

  it('lança (Zod) para resposta com formato inválido — nunca corrige heuristicamente (TASK.md §1, diretriz 6)', () => {
    expect(() =>
      traduzirClassificacao(
        { standings: 'não é array' },
        'brasileirao-serie-a',
        CLUBES_TESTE,
      ),
    ).toThrow();
  });

  it('débito conhecido (REFAT-02-01): com a configuração REAL de clubes-2026.json, só Flamengo casa hoje', () => {
    const clubesReais = carregarClubesSerieA2026();
    const resposta = {
      standings: [
        {
          type: 'TOTAL',
          group: null,
          table: [
            {
              position: 1,
              team: timeProvedor(1783, 'CR Flamengo'),
              playedGames: 1,
              form: null,
              won: 1,
              draw: 0,
              lost: 0,
              points: 3,
              goalsFor: 2,
              goalsAgainst: 0,
              goalDifference: 2,
            },
            {
              // Palmeiras real está com idsProvedor pendente-confirmacao —
              // qualquer id numérico do provedor é descartado até a confirmação.
              position: 2,
              team: timeProvedor(1769, 'SE Palmeiras'),
              playedGames: 1,
              form: null,
              won: 1,
              draw: 0,
              lost: 0,
              points: 3,
              goalsFor: 1,
              goalsAgainst: 0,
              goalDifference: 1,
            },
          ],
        },
      ],
    };

    const { linhas, inconsistencias } = traduzirClassificacao(
      resposta,
      'brasileirao-serie-a',
      clubesReais,
    );

    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.clubeId).toBe('flamengo');
    expect(inconsistencias).toHaveLength(1);
    expect(inconsistencias[0]?.contexto).toBe('classificacao:posicao 2');
  });
});

describe('traduzirPartidas', () => {
  const baseMatch = {
    id: 555,
    utcDate: '2026-04-05T20:00:00Z',
    matchday: 5,
    stage: 'REGULAR_SEASON',
    homeTeam: timeProvedor(1783, 'CR Flamengo'),
    awayTeam: timeProvedor(1769, 'SE Palmeiras'),
    venue: 'Maracanã',
  };

  it.each([
    ['SCHEDULED', false, 'agendada'],
    ['TIMED', true, 'agendada'],
    ['IN_PLAY', true, 'aguardando-resultado'],
    ['PAUSED', true, 'aguardando-resultado'],
    ['SUSPENDED', true, 'aguardando-resultado'],
    ['POSTPONED', false, 'adiada'],
    ['CANCELLED', false, 'cancelada'],
  ] as const)(
    'status do provedor %s -> status %s (horarioDefinido=%s)',
    async (statusProvedor, horarioDefinidoEsperado, statusEsperado) => {
      const resposta = {
        matches: [
          {
            ...baseMatch,
            status: statusProvedor,
            score: { fullTime: { home: null, away: null } },
          },
        ],
      };
      const { partidas } = traduzirPartidas(
        resposta,
        'brasileirao-serie-a',
        CLUBES_TESTE,
      );
      expect(partidas).toHaveLength(1);
      expect(partidas[0]?.status).toBe(statusEsperado);
      expect(partidas[0]?.horarioDefinido).toBe(horarioDefinidoEsperado);
      expect(partidas[0]?.placar).toBeNull();
    },
  );

  it('FINISHED com placar completo vira "finalizada" com o placar traduzido', () => {
    const resposta = {
      matches: [
        {
          ...baseMatch,
          status: 'FINISHED',
          score: { fullTime: { home: 2, away: 1 } },
        },
      ],
    };
    const { partidas } = traduzirPartidas(resposta, 'brasileirao-serie-a', CLUBES_TESTE);
    expect(partidas[0]?.status).toBe('finalizada');
    expect(partidas[0]?.placar).toEqual({ mandante: 2, visitante: 1 });
  });

  it('CA-16.6: FINISHED sem placar completo (inconsistência do provedor) cai para "aguardando-resultado" em vez de inventar placar', () => {
    const resposta = {
      matches: [
        {
          ...baseMatch,
          status: 'FINISHED',
          score: { fullTime: { home: 2, away: null } },
        },
      ],
    };
    const { partidas } = traduzirPartidas(resposta, 'brasileirao-serie-a', CLUBES_TESTE);
    expect(partidas[0]?.status).toBe('aguardando-resultado');
    expect(partidas[0]?.placar).toBeNull();
  });

  it('rodada e fase: REGULAR_SEASON vira fase nula (redundante com rodada); outra fase é preservada', () => {
    const respostaRegular = {
      matches: [
        {
          ...baseMatch,
          status: 'TIMED',
          score: { fullTime: { home: null, away: null } },
        },
      ],
    };
    const { partidas: regulares } = traduzirPartidas(
      respostaRegular,
      'brasileirao-serie-a',
      CLUBES_TESTE,
    );
    expect(regulares[0]?.rodada).toBe(5);
    expect(regulares[0]?.fase).toBeNull();

    const respostaMataMata = {
      matches: [
        {
          ...baseMatch,
          matchday: null,
          stage: 'SEMI_FINALS',
          status: 'TIMED',
          score: { fullTime: { home: null, away: null } },
        },
      ],
    };
    const { partidas: mataMata } = traduzirPartidas(
      respostaMataMata,
      'copa-do-brasil',
      CLUBES_TESTE,
    );
    expect(mataMata[0]?.rodada).toBeNull();
    expect(mataMata[0]?.fase).toBe('SEMI_FINALS');
  });

  it('CA-16.6/ADR-006 item 3: descarta e registra partida com mandante OU visitante não mapeado', () => {
    const resposta = {
      matches: [
        {
          ...baseMatch,
          homeTeam: timeProvedor(42424242, 'Time Desconhecido'),
          status: 'TIMED',
          score: { fullTime: { home: null, away: null } },
        },
      ],
    };
    const { partidas, inconsistencias } = traduzirPartidas(
      resposta,
      'brasileirao-serie-a',
      CLUBES_TESTE,
    );
    expect(partidas).toEqual([]);
    expect(inconsistencias).toEqual([
      {
        tipo: 'clube-nao-mapeado',
        competicaoId: 'brasileirao-serie-a',
        idProvedor: 42424242,
        nomeProvedorDiagnostico: 'Time Desconhecido',
        contexto: 'partida:555:mandante',
      },
    ]);
  });

  it('lança (Zod) para resposta com formato inválido', () => {
    expect(() =>
      traduzirPartidas(
        { matches: [{ id: 'não é número' }] },
        'brasileirao-serie-a',
        CLUBES_TESTE,
      ),
    ).toThrow();
  });
});

describe('criarAdaptadorFootballData', () => {
  function buscadorFixo(
    respostas: Record<string, { status: number; corpo: unknown }>,
  ): BuscadorHttp {
    const chamadas: { url: string; headers: Record<string, string> }[] = [];
    const buscar: BuscadorHttp = async (url, init) => {
      chamadas.push({ url, headers: init.headers });
      const chave = url.includes('/standings') ? 'standings' : 'matches';
      const resposta = respostas[chave];
      if (resposta === undefined) throw new Error(`sem mock para ${url}`);
      return {
        ok: resposta.status >= 200 && resposta.status < 300,
        status: resposta.status,
        json: async () => resposta.corpo,
      };
    };
    (buscar as unknown as { chamadas: typeof chamadas }).chamadas = chamadas;
    return buscar;
  }

  it('obterClassificacao busca a URL correta com o token no header e traduz a resposta', async () => {
    const buscar = buscadorFixo({
      standings: {
        status: 200,
        corpo: {
          standings: [
            {
              type: 'TOTAL',
              group: null,
              table: [
                {
                  position: 1,
                  team: timeProvedor(1783, 'CR Flamengo'),
                  playedGames: 1,
                  form: null,
                  won: 1,
                  draw: 0,
                  lost: 0,
                  points: 3,
                  goalsFor: 1,
                  goalsAgainst: 0,
                  goalDifference: 1,
                },
              ],
            },
          ],
        },
      },
      matches: { status: 200, corpo: { matches: [] } },
    });

    const chamadasRecebidas: { url: string; headers: Record<string, string> }[] = [];
    const buscarComEspiao: BuscadorHttp = async (url, init) => {
      chamadasRecebidas.push({ url, headers: init.headers });
      return buscar(url, init);
    };

    const adaptador = criarAdaptadorFootballData({
      token: 'token-de-teste',
      clubes: CLUBES_TESTE,
      buscar: buscarComEspiao,
    });

    expect(adaptador.id).toBe(ID_PROVEDOR_FOOTBALL_DATA);
    expect(adaptador.orcamento).toEqual({ porMinuto: 10 });

    const { linhas } = await adaptador.obterClassificacao({
      competicaoId: 'brasileirao-serie-a',
      codigoCompeticao: 'BSA',
    });

    expect(linhas[0]?.clubeId).toBe('flamengo');
    expect(chamadasRecebidas).toEqual([
      {
        url: 'https://api.football-data.org/v4/competitions/BSA/standings',
        headers: { 'X-Auth-Token': 'token-de-teste' },
      },
    ]);
  });

  it('obterPartidas busca a URL correta e traduz a resposta', async () => {
    const buscar = buscadorFixo({
      standings: { status: 200, corpo: { standings: [] } },
      matches: {
        status: 200,
        corpo: {
          matches: [
            {
              id: 1,
              utcDate: '2026-04-05T20:00:00Z',
              status: 'TIMED',
              matchday: 1,
              stage: 'REGULAR_SEASON',
              homeTeam: timeProvedor(1783, 'CR Flamengo'),
              awayTeam: timeProvedor(1769, 'SE Palmeiras'),
              score: { fullTime: { home: null, away: null } },
              venue: 'Maracanã',
            },
          ],
        },
      },
    });

    const adaptador = criarAdaptadorFootballData({
      token: 'token-de-teste',
      clubes: CLUBES_TESTE,
      buscar,
    });

    const { partidas } = await adaptador.obterPartidas({
      competicaoId: 'brasileirao-serie-a',
      codigoCompeticao: 'BSA',
    });
    expect(partidas).toHaveLength(1);
    expect(partidas[0]?.mandanteId).toBe('flamengo');
    expect(partidas[0]?.visitanteId).toBe('palmeiras');
  });

  it('CA-16.3/16.4: lança quando o provedor responde HTTP de erro (quem mantém dado anterior é o orquestrador, ING-F-02)', async () => {
    const buscar: BuscadorHttp = async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    const adaptador = criarAdaptadorFootballData({
      token: 'token-de-teste',
      clubes: CLUBES_TESTE,
      buscar,
    });
    await expect(
      adaptador.obterClassificacao({
        competicaoId: 'brasileirao-serie-a',
        codigoCompeticao: 'BSA',
      }),
    ).rejects.toThrow('HTTP 429');
  });
});
