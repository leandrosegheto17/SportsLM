// pipeline/futebol/orquestrador.test.ts — ING-F-05 (TASK.md Lote 5)
//
// Teste de integração de ponta a ponta do Fluxo 2 (SDD §2.4): liga
// ING-F-02 (coleta por prioridade/cota) → ING-F-04 (consistência) → ING-F-03
// (derivação de status/fase), com um provedor mockado (nenhuma chamada de
// rede real) registrado só para o Brasileirão (`provedor: "football-data-org"`
// em `config/campeonatos-2026.json`). Desde SPK-01 (2026-09-17), Paulista e
// Carioca também têm provedor real (`"thesportsdb"`) — coberto à parte pelo
// describe "montarProvedoresPadrao" no fim deste arquivo, sem rede real
// (só a construção da referência por competição). Cobre especificamente:
//   (a) Brasileirão com os 20 clubes reais, gravando linhas/partidas/
//       participações coerentes para todos eles (CA-16.2);
//   (b) descarte de um lote inconsistente, mantendo o snapshot anterior
//       (SDD §2.4/CA-16.6) — nunca escreve por cima;
//   (c) a camada de I/O (`executarIngestaoFutebolEmDisco`) contra um
//       diretório de estado temporário, sem tocar `estado/` real.

import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  executarFluxoFutebol,
  executarIngestaoFutebolEmDisco,
  estadoFutebolVazio,
  carregarCampeonatosDominio,
  montarProvedoresPadrao,
  type EstadoFutebol,
} from './orquestrador';
import { registrarProvedor, type ProvedorFutebolPort } from './coletor-futebol';
import { carregarClubesSerieA2026 } from '../config/clubes';
import type { LinhaClassificacao, Partida } from '../../dominio/tipos/futebol';
import type {
  InconsistenciaClube,
  InconsistenciaPartida,
} from './adaptador-football-data';

const AGORA = new Date('2026-06-01T12:00:00-03:00');

const CAMPEONATOS = carregarCampeonatosDominio();
const BRASILEIRAO = CAMPEONATOS.find((c) => c.id === 'brasileirao-serie-a');
if (BRASILEIRAO === undefined) {
  throw new Error('fixture: brasileirao-serie-a ausente de config/campeonatos-2026.json');
}
const CLUBES_BRASILEIRAO = BRASILEIRAO.clubes; // 20 clubes reais (RN-04)

interface RefTeste {
  competicaoId: string;
}

/** Round-robin trivial: casa `clubes[i]` com `clubes[n-1-i]`. */
function parear(clubes: readonly string[]): [string, string][] {
  const pares: [string, string][] = [];
  for (let i = 0; i < clubes.length / 2; i++) {
    const a = clubes[i];
    const b = clubes[clubes.length - 1 - i];
    if (a !== undefined && b !== undefined) pares.push([a, b]);
  }
  return pares;
}

/** Monta um lote (linhas + partidas) coerente para o Brasileirão: uma rodada
 * já finalizada (empate 1-1 em todos os jogos) + uma rodada futura agendada —
 * garante que os 20 clubes apareçam em partidas passadas E futuras (CA-16.2:
 * "todas as rodadas restantes de todos os 20 clubes"). */
function loteBrasileiraoConsistente(): {
  linhas: LinhaClassificacao[];
  partidas: Partida[];
} {
  const rodada1 = parear(CLUBES_BRASILEIRAO); // finalizada, 1-1
  const rodada2 = parear([...CLUBES_BRASILEIRAO].reverse()); // agendada, futura

  const partidas: Partida[] = [
    ...rodada1.map(
      ([mandanteId, visitanteId], indice): Partida => ({
        id: `r1-${indice}`,
        competicaoId: 'brasileirao-serie-a',
        rodada: 1,
        fase: null,
        mandanteId,
        visitanteId,
        dataHora: '2026-04-01T19:00:00-03:00',
        horarioDefinido: true,
        estadio: null,
        status: 'finalizada',
        placar: { mandante: 1, visitante: 1 },
      }),
    ),
    ...rodada2.map(
      ([mandanteId, visitanteId], indice): Partida => ({
        id: `r2-${indice}`,
        competicaoId: 'brasileirao-serie-a',
        rodada: 2,
        fase: null,
        mandanteId,
        visitanteId,
        dataHora: '2026-10-01T19:00:00-03:00',
        horarioDefinido: true,
        estadio: null,
        status: 'agendada',
        placar: null,
      }),
    ),
  ];

  // Cada clube jogou exatamente 1 partida finalizada (empate 1-1): pontos=1,
  // jogos=1, v=0,e=1,d=0, gp=1,gc=1,sg=0 — aritmética e saldo válidos (ING-F-04).
  const linhas: LinhaClassificacao[] = CLUBES_BRASILEIRAO.map((clubeId, indice) => ({
    competicaoId: 'brasileirao-serie-a',
    grupo: null,
    posicao: indice + 1,
    clubeId,
    pontos: 1,
    jogos: 1,
    v: 0,
    e: 1,
    d: 0,
    gp: 1,
    gc: 1,
    sg: 0,
    aproveitamento: (1 / (1 * 3)) * 100,
    ultimosCinco: ['E'],
  }));

  return { linhas, partidas };
}

function criarProvedorMockBrasileirao(
  lote: {
    linhas: LinhaClassificacao[];
    partidas: Partida[];
  },
  opcoes: {
    inconsistenciasClassificacao?: InconsistenciaClube[];
    inconsistenciasPartidas?: InconsistenciaPartida[];
  } = {},
) {
  const inconsistenciasClassificacao = opcoes.inconsistenciasClassificacao ?? [];
  const inconsistenciasPartidas = opcoes.inconsistenciasPartidas ?? [];
  const adaptador: ProvedorFutebolPort<RefTeste> = {
    id: 'football-data-mock',
    orcamento: { porMinuto: 10 },
    obterClassificacao: async () => ({
      linhas: lote.linhas,
      inconsistencias: inconsistenciasClassificacao,
    }),
    obterPartidas: async () => ({
      partidas: lote.partidas,
      inconsistencias: inconsistenciasPartidas,
    }),
  };
  return registrarProvedor<RefTeste>(adaptador, (campeonato) => ({
    competicaoId: campeonato.id,
  }));
}

describe('executarFluxoFutebol — ponta a ponta com provedor mockado (SDD §2.4)', () => {
  it('produz Competicao/LinhaClassificacao/Partida/ParticipacaoClube coerentes para o Brasileirão com os 20 clubes (CA-16.2)', async () => {
    const lote = loteBrasileiraoConsistente();
    const registro = criarProvedorMockBrasileirao(lote);

    const resultado = await executarFluxoFutebol({
      campeonatos: CAMPEONATOS,
      provedores: { 'football-data-org': registro },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA,
    });

    const estadoBrasileirao = resultado.novoEstado.competicoes['brasileirao-serie-a'];
    expect(estadoBrasileirao).toBeDefined();
    expect(estadoBrasileirao?.competicao).toEqual({
      id: 'brasileirao-serie-a',
      nome: 'Campeonato Brasileiro Série A',
      temporada: 2026,
      formato: 'pontos-corridos',
      janela: { inicio: '2026-01-28', fim: '2026-12-02' },
      provedor: 'football-data-org',
      ultimaAtualizacao: AGORA.toISOString(),
    });

    // Todos os 20 clubes, todas as rodadas restantes (rodada 1 finalizada +
    // rodada 2 agendada) — CA-16.2, nada é filtrado/recortado.
    expect(estadoBrasileirao?.linhas).toHaveLength(20);
    expect(estadoBrasileirao?.partidas).toHaveLength(20); // 10 jogos por rodada × 2 rodadas
    expect(estadoBrasileirao?.participacoes).toHaveLength(20);

    for (const clubeId of CLUBES_BRASILEIRAO) {
      const participacao = estadoBrasileirao?.participacoes.find(
        (p) => p.clubeId === clubeId,
      );
      expect(participacao, `participação de ${clubeId}`).toBeDefined();
      // Tem 1 jogo finalizado + 1 agendado futuro → ainda em disputa.
      expect(participacao?.status).toBe('em-andamento');
      expect(participacao?.resumo).toEqual({
        jogos: 1,
        v: 0,
        e: 1,
        d: 0,
        gp: 1,
        gc: 1,
        sg: 0,
        pontos: 1,
        aproveitamento: (1 / 3) * 100,
        posicao: CLUBES_BRASILEIRAO.indexOf(clubeId) + 1,
      });

      // O clube aparece em pelo menos uma partida passada e uma futura.
      const partidasDoClube = estadoBrasileirao?.partidas.filter(
        (p) => p.mandanteId === clubeId || p.visitanteId === clubeId,
      );
      expect(partidasDoClube).toHaveLength(2);
      expect(partidasDoClube?.some((p) => p.status === 'finalizada')).toBe(true);
      expect(partidasDoClube?.some((p) => p.status === 'agendada')).toBe(true);
    }

    // Status: Brasileirão atualizado; demais competições (provedor: null no
    // arquivo real) aparecem como sem-cobertura ou fora-da-janela — nenhuma é
    // omitida (CA-07.2), e nenhuma delas fica sem entrada em `competicoes`.
    expect(resultado.status.futebol['brasileirao-serie-a']).toMatchObject({
      resultado: 'atualizada',
      ultimaAtualizacao: AGORA.toISOString(),
    });
    for (const campeonato of CAMPEONATOS) {
      expect(resultado.novoEstado.competicoes[campeonato.id]).toBeDefined();
      expect(resultado.status.futebol[campeonato.id]).toBeDefined();
    }
    const semCobertura = CAMPEONATOS.filter((c) => c.provedor === null);
    for (const campeonato of semCobertura) {
      expect(['sem-cobertura', 'fora-da-janela']).toContain(
        resultado.status.futebol[campeonato.id]?.resultado,
      );
      // Mesmo sem cobertura, CA-07.2 exige participação para os clubes
      // configurados — nunca omissão do campeonato inteiro.
      expect(resultado.novoEstado.competicoes[campeonato.id]?.participacoes.length).toBe(
        campeonato.clubes.length,
      );
    }

    expect(resultado.status.pausadoPorCota).toBe(false);
    expect(resultado.status.provedores['football-data-org']).toBe(2);
  });

  it('descarta o lote inconsistente e mantém o snapshot anterior (SDD §2.4/CA-16.6)', async () => {
    const loteBom = loteBrasileiraoConsistente();
    const registroBom = criarProvedorMockBrasileirao(loteBom);

    const primeiraExecucao = await executarFluxoFutebol({
      campeonatos: CAMPEONATOS,
      provedores: { 'football-data-org': registroBom },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA,
    });
    const estadoAnteriorBrasileirao =
      primeiraExecucao.novoEstado.competicoes['brasileirao-serie-a'];
    expect(estadoAnteriorBrasileirao?.linhas).toHaveLength(20);

    // Segunda execução: lote com pontos incoerentes (pontos != 3V+E) para
    // TODOS os clubes — inconsistência de aritmética (ING-F-04).
    const loteRuim = loteBrasileiraoConsistente();
    loteRuim.linhas = loteRuim.linhas.map((linha) => ({ ...linha, pontos: 999 }));
    const registroRuim = criarProvedorMockBrasileirao(loteRuim);
    const agoraSeguinte = new Date('2026-06-01T13:00:00-03:00');

    const segundaExecucao = await executarFluxoFutebol({
      campeonatos: CAMPEONATOS,
      provedores: { 'football-data-org': registroRuim },
      estadoAnterior: primeiraExecucao.novoEstado,
      agora: agoraSeguinte,
    });

    const estadoFinalBrasileirao =
      segundaExecucao.novoEstado.competicoes['brasileirao-serie-a'];
    // Snapshot idêntico ao da 1ª execução — o lote ruim nunca substituiu nada.
    expect(estadoFinalBrasileirao).toEqual(estadoAnteriorBrasileirao);
    expect(estadoFinalBrasileirao?.competicao.ultimaAtualizacao).toBe(
      AGORA.toISOString(),
    ); // não avançou para agoraSeguinte

    const status = segundaExecucao.status.futebol['brasileirao-serie-a'];
    expect(status?.resultado).toBe('inconsistente');
    expect(status?.motivosInconsistencia).toContain('linha-aritmetica-invalida');
    expect(status?.ultimaAtualizacao).toBe(AGORA.toISOString());
  });

  it('expõe inconsistenciasClube (classificacao + partidas) coletadas do lote — Bloqueio 009', async () => {
    const lote = loteBrasileiraoConsistente();
    const inconsistenciaClassificacao: InconsistenciaClube = {
      tipo: 'clube-nao-mapeado',
      competicaoId: 'brasileirao-serie-a',
      idProvedor: 1776,
      nomeProvedorDiagnostico: 'EC Bahia',
      contexto: 'classificacao:posicao 3',
    };
    const inconsistenciaPartidaClube: InconsistenciaClube = {
      tipo: 'clube-nao-mapeado',
      competicaoId: 'brasileirao-serie-a',
      idProvedor: 1837,
      nomeProvedorDiagnostico: 'SE Palmeiras',
      contexto: 'partida:123:mandante',
    };
    // Não é um clube não mapeado — não deve aparecer em `inconsistenciasClube`
    // (Bloqueio 008, fora do escopo do Bloqueio 009).
    const inconsistenciaStatusDesconhecido: InconsistenciaPartida = {
      tipo: 'partida-status-desconhecido',
      competicaoId: 'brasileirao-serie-a',
      idPartidaProvedor: 456,
      statusBrutoDiagnostico: '2026-08-29 20:30:00Z',
      contexto: 'partida:456:status',
    };
    const registro = criarProvedorMockBrasileirao(lote, {
      inconsistenciasClassificacao: [inconsistenciaClassificacao],
      inconsistenciasPartidas: [
        inconsistenciaPartidaClube,
        inconsistenciaStatusDesconhecido,
      ],
    });

    const resultado = await executarFluxoFutebol({
      campeonatos: CAMPEONATOS,
      provedores: { 'football-data-org': registro },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA,
    });

    expect(resultado.inconsistenciasClube).toEqual([
      inconsistenciaClassificacao,
      inconsistenciaPartidaClube,
    ]);
  });

  it('primeira execução com lote já inconsistente ainda garante participação para os 20 clubes (CA-07.2), sem Competicao.ultimaAtualizacao', async () => {
    const loteRuim = loteBrasileiraoConsistente();
    loteRuim.partidas = loteRuim.partidas.map((p) =>
      p.status === 'finalizada' ? { ...p, placar: null } : p,
    ); // finalizada sem placar — inconsistente (ING-F-04)
    const registro = criarProvedorMockBrasileirao(loteRuim);

    const resultado = await executarFluxoFutebol({
      campeonatos: CAMPEONATOS,
      provedores: { 'football-data-org': registro },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA,
    });

    const estado = resultado.novoEstado.competicoes['brasileirao-serie-a'];
    expect(estado?.competicao.ultimaAtualizacao).toBeNull();
    expect(estado?.linhas).toHaveLength(0);
    expect(estado?.partidas).toHaveLength(0);
    expect(estado?.participacoes).toHaveLength(20); // nunca omite clube (CA-07.2)
    expect(
      resultado.status.futebol['brasileirao-serie-a']?.motivosInconsistencia,
    ).toContain('partida-finalizada-sem-placar');
  });
});

describe('executarIngestaoFutebolEmDisco — camada de I/O', () => {
  let dirTemp: string;

  afterEach(() => {
    if (dirTemp !== undefined) rmSync(dirTemp, { recursive: true, force: true });
  });

  it('grava estado/futebol.json e mescla ingestao/status.json sem apagar chaves de notícias', async () => {
    dirTemp = mkdtempSync(join(tmpdir(), 'sportslm-futebol-'));
    const caminhoEstado = join(dirTemp, 'futebol.json');
    const caminhoStatus = join(dirTemp, 'ingestao', 'status.json');

    // Simula que ING-N-07 já rodou e gravou a porção de notícias no mesmo
    // arquivo — este orquestrador nunca pode apagar essas chaves.
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(join(dirTemp, 'ingestao'), { recursive: true });
    writeFileSync(
      caminhoStatus,
      JSON.stringify({
        geradoEm: '2026-06-01T00:00:00-03:00',
        fontes: { ge: { ultimaTentativa: null } },
        distribuicaoClassificacao: { futebol: 3 },
        gruposFormados: 1,
      }),
    );

    const clubes = carregarClubesSerieA2026();
    const lote = loteBrasileiraoConsistente();
    const registro = criarProvedorMockBrasileirao(lote);

    await executarIngestaoFutebolEmDisco({
      agora: AGORA,
      caminhoEstado,
      caminhoStatus,
      provedores: { 'football-data-org': registro },
    });
    void clubes; // só usado para confirmar que o carregador real não lança

    expect(existsSync(caminhoEstado)).toBe(true);
    const estadoGravado = JSON.parse(
      readFileSync(caminhoEstado, 'utf8'),
    ) as EstadoFutebol;
    expect(estadoGravado.competicoes['brasileirao-serie-a']?.linhas).toHaveLength(20);

    const statusGravado = JSON.parse(readFileSync(caminhoStatus, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(statusGravado['fontes']).toEqual({ ge: { ultimaTentativa: null } }); // preservado
    expect(statusGravado['futebol']).toBeDefined();
    expect(statusGravado['pausadoPorCota']).toBe(false);
  });

  it('lança erro claro quando FOOTBALL_DATA_API_TOKEN não está definido e nenhum provedor foi injetado', async () => {
    dirTemp = mkdtempSync(join(tmpdir(), 'sportslm-futebol-'));
    const tokenAnterior = process.env['FOOTBALL_DATA_API_TOKEN'];
    delete process.env['FOOTBALL_DATA_API_TOKEN'];
    try {
      await expect(
        executarIngestaoFutebolEmDisco({
          agora: AGORA,
          caminhoEstado: join(dirTemp, 'futebol.json'),
          caminhoStatus: join(dirTemp, 'status.json'),
        }),
      ).rejects.toThrow(/FOOTBALL_DATA_API_TOKEN/);
    } finally {
      if (tokenAnterior !== undefined) {
        process.env['FOOTBALL_DATA_API_TOKEN'] = tokenAnterior;
      }
    }
  });
});

describe('montarProvedoresPadrao (COB-05 — refProvedor da config)', () => {
  const clubes = carregarClubesSerieA2026();
  const registro = montarProvedoresPadrao(clubes, 'token-fake');

  function comp(id: string) {
    const c = CAMPEONATOS.find((x) => x.id === id);
    if (c === undefined) throw new Error(`fixture: ${id} ausente da config`);
    return c;
  }

  it('registra football-data-org e thesportsdb', () => {
    expect(Object.keys(registro).sort()).toEqual(['football-data-org', 'thesportsdb']);
  });

  it('constrói referência das 7 ligas TheSportsDB a partir de refProvedor', () => {
    const esperado: Record<string, [string, string, number | undefined]> = {
      'copa-do-brasil': ['nunca', '4725', undefined],
      libertadores: ['tentar', '4501', undefined],
      'sul-americana': ['tentar', '4724', undefined],
      paulista: ['sempre', '5767', comp('paulista').clubes.length],
      carioca: ['sempre', '5688', comp('carioca').clubes.length],
      mineiro: ['sempre', '5763', comp('mineiro').clubes.length],
      gaucho: ['sempre', '5691', comp('gaucho').clubes.length],
    };
    for (const [id, [politica, idLiga, esperados]] of Object.entries(esperado)) {
      const ref = registro['thesportsdb']?.construirReferencia(comp(id)) as Record<
        string,
        unknown
      >;
      expect(ref['competicaoId']).toBe(id);
      expect(ref['idLigaProvedor']).toBe(idLiga);
      expect(ref['idLiga']).toBe(Number(idLiga));
      expect(ref['politicaTabela']).toBe(politica);
      expect(ref['temporadaProvedor']).toBe('2026');
      expect(ref['clubesEsperados']).toBe(esperados);
    }
  });

  it('football-data.org lê o código de refProvedor (Brasileirão, sem mapa local)', () => {
    expect(registro['football-data-org']?.construirReferencia(BRASILEIRAO)).toEqual({
      competicaoId: 'brasileirao-serie-a',
      codigoCompeticao: 'BSA',
    });
  });

  it('lança erro nomeando a competição quando refProvedor está ausente', () => {
    const { refProvedor: _a, ...semRef } = comp('paulista');
    expect(() => registro['thesportsdb']?.construirReferencia(semRef)).toThrow(
      /paulista/,
    );
    const { refProvedor: _b, ...semRefFd } = BRASILEIRAO;
    expect(() => registro['football-data-org']?.construirReferencia(semRefFd)).toThrow(
      /brasileirao-serie-a/,
    );
  });

  it('não resta constante por competição no orquestrador', () => {
    const fonte = readFileSync(join(__dirname, 'orquestrador.ts'), 'utf8');
    expect(fonte).not.toMatch(
      /CODIGOS_COMPETICAO_FOOTBALL_DATA|REFS_COMPETICAO_THESPORTSDB/,
    );
  });
});

describe('executarFluxoFutebol — isolamento de falha por liga (COB-19, RNF-17)', () => {
  const ids = ['liga-a', 'liga-b', 'liga-c'];
  const campeonatos = ids.map((id) => ({ ...BRASILEIRAO, id }));

  function registroPorLiga(modo: 'ok' | 'zod' | 'rede') {
    const loteDe = (id: string) => {
      const l = loteBrasileiraoConsistente();
      return {
        linhas: l.linhas.map((x) => ({ ...x, competicaoId: id })),
        partidas: l.partidas.map((x) => ({ ...x, competicaoId: id })),
      };
    };
    const adaptador: ProvedorFutebolPort<RefTeste> = {
      id: 'mock-multi',
      orcamento: { porMinuto: 100 },
      obterClassificacao: async (ref) => {
        if (modo === 'rede' && ref.competicaoId === 'liga-b') {
          throw new Error('ECONNRESET');
        }
        return { linhas: loteDe(ref.competicaoId).linhas, inconsistencias: [] };
      },
      obterPartidas: async (ref) => {
        const partidas = loteDe(ref.competicaoId).partidas;
        if (modo === 'zod' && ref.competicaoId === 'liga-b') {
          return {
            partidas: partidas.map((p) => ({ ...p, estadio: 123 as unknown as string })),
            inconsistencias: [],
          };
        }
        return { partidas, inconsistencias: [] };
      },
    };
    return registrarProvedor<RefTeste>(adaptador, (c) => ({ competicaoId: c.id }));
  }

  for (const modo of ['zod', 'rede'] as const) {
    it(`falha (${modo}) na liga do meio isola só ela e preserva o estado anterior`, async () => {
      const base = await executarFluxoFutebol({
        campeonatos,
        provedores: { 'football-data-org': registroPorLiga('ok') },
        estadoAnterior: estadoFutebolVazio(),
        agora: new Date('2026-05-01T12:00:00-03:00'),
      });
      const anteriorB = base.novoEstado.competicoes['liga-b'];
      const r = await executarFluxoFutebol({
        campeonatos,
        provedores: { 'football-data-org': registroPorLiga(modo) },
        estadoAnterior: base.novoEstado,
        agora: AGORA,
      });
      expect(r.status.futebol['liga-b']?.resultado).toBe('falha');
      expect(r.status.futebol['liga-b']?.mensagemErro?.length).toBeLessThanOrEqual(200);
      expect(r.status.futebol['liga-a']?.resultado).toBe('atualizada');
      expect(r.status.futebol['liga-c']?.resultado).toBe('atualizada');
      expect(r.novoEstado.competicoes['liga-b']).toEqual(anteriorB);
    });
  }
});

describe('executarFluxoFutebol — integração COB-20 (retenção, sem-dados, participantes, resumo, RN-22)', () => {
  function registro(
    lote: () => {
      linhas: LinhaClassificacao[];
      partidas: Partida[];
      inconsistencias?: InconsistenciaPartida[];
    },
  ) {
    const adaptador: ProvedorFutebolPort<RefTeste> = {
      id: 'mock-cob20',
      orcamento: { porMinuto: 100 },
      obterClassificacao: async () => ({ linhas: lote().linhas, inconsistencias: [] }),
      obterPartidas: async () => ({
        partidas: lote().partidas,
        inconsistencias: lote().inconsistencias ?? [],
      }),
    };
    return registrarProvedor<RefTeste>(adaptador, (c) => ({ competicaoId: c.id }));
  }

  const AGORA_ATIVA = new Date('2026-05-01T12:00:00-03:00');

  it('provedor sem eventos nem tabela -> sem-dados-provedor e ultimaAtualizacao inalterada', async () => {
    const base = await executarFluxoFutebol({
      campeonatos: [BRASILEIRAO],
      provedores: { 'football-data-org': registro(() => loteBrasileiraoConsistente()) },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA_ATIVA,
    });
    const r = await executarFluxoFutebol({
      campeonatos: [BRASILEIRAO],
      provedores: { 'football-data-org': registro(() => ({ linhas: [], partidas: [] })) },
      estadoAnterior: base.novoEstado,
      agora: AGORA,
    });
    const s = r.status.futebol['brasileirao-serie-a'];
    expect(s?.resultado).toBe('sem-dados-provedor');
    expect(s?.ultimaAtualizacao).toBe(AGORA_ATIVA.toISOString());
    expect(r.novoEstado.competicoes['brasileirao-serie-a']).toEqual(
      base.novoEstado.competicoes['brasileirao-serie-a'],
    );
  });

  it('status expoe partidas, requisicoes e descartes', async () => {
    const r = await executarFluxoFutebol({
      campeonatos: [BRASILEIRAO],
      provedores: { 'football-data-org': registro(() => loteBrasileiraoConsistente()) },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA_ATIVA,
    });
    const s = r.status.futebol['brasileirao-serie-a'];
    expect(s?.partidas).toBe(20);
    expect(s?.requisicoes).toBe(2);
    expect(s?.descartes?.['fora-do-recorte']).toBe(0);
    expect(s?.participantesNaoConfigurados).toEqual([]);
  });

  it('participante fora da config aparece em participantesNaoConfigurados sem alterar a config', async () => {
    const antes = JSON.stringify(BRASILEIRAO);
    const r = await executarFluxoFutebol({
      campeonatos: [BRASILEIRAO],
      provedores: {
        'football-data-org': registro(() => {
          const l = loteBrasileiraoConsistente();
          return {
            ...l,
            partidas: l.partidas.map((p, i) =>
              i === 0 ? { ...p, mandanteId: 'clube-fantasma' } : p,
            ),
          };
        }),
      },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA_ATIVA,
    });
    expect(
      r.status.futebol['brasileirao-serie-a']?.participantesNaoConfigurados,
    ).toContain('clube-fantasma');
    expect(JSON.stringify(BRASILEIRAO)).toBe(antes);
  });

  it('liga misto com tabela nova vazia retem a tabela anterior', async () => {
    const misto = { ...BRASILEIRAO, id: 'liga-mista', formato: 'misto' as const };
    const cheio = () => {
      const l = loteBrasileiraoConsistente();
      return {
        linhas: l.linhas.map((x) => ({ ...x, competicaoId: 'liga-mista' })),
        partidas: l.partidas.map((x) => ({ ...x, competicaoId: 'liga-mista' })),
      };
    };
    const base = await executarFluxoFutebol({
      campeonatos: [misto],
      provedores: { 'football-data-org': registro(cheio) },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA_ATIVA,
    });
    const r = await executarFluxoFutebol({
      campeonatos: [misto],
      provedores: {
        'football-data-org': registro(() => ({ linhas: [], partidas: cheio().partidas })),
      },
      estadoAnterior: base.novoEstado,
      agora: AGORA,
    });
    expect(r.novoEstado.competicoes['liga-mista']?.linhas).toEqual(
      base.novoEstado.competicoes['liga-mista']?.linhas,
    );
    expect(r.novoEstado.competicoes['liga-mista']?.linhas.length).toBeGreaterThan(0);
  });

  it('ordena por faixa RN-22 usando partidas do estado anterior (jogo em <=48h primeiro)', async () => {
    const a = { ...BRASILEIRAO, id: 'liga-a' };
    const b = { ...BRASILEIRAO, id: 'liga-b' };
    const ordem: string[] = [];
    const adaptador: ProvedorFutebolPort<RefTeste> = {
      id: 'mock-ordem',
      orcamento: { porMinuto: 100 },
      obterClassificacao: async (ref) => {
        ordem.push(ref.competicaoId);
        return { linhas: [], inconsistencias: [] };
      },
      obterPartidas: async () => ({ partidas: [], inconsistencias: [] }),
    };
    const lote = loteBrasileiraoConsistente();
    const partidaProxima: Partida = {
      ...lote.partidas[0]!,
      id: 'prox',
      competicaoId: 'liga-b',
      status: 'agendada',
      placar: null,
      dataHora: new Date(AGORA.getTime() + 3600_000).toISOString(),
    };
    const estadoAnterior: EstadoFutebol = {
      competicoes: {
        'liga-b': {
          competicao: {
            id: 'liga-b',
            nome: b.nome,
            temporada: b.temporada,
            formato: b.formato,
            janela: b.janela,
            provedor: b.provedor,
            ultimaAtualizacao: null,
          },
          linhas: [],
          partidas: [partidaProxima],
          participacoes: [],
        },
      },
    };
    await executarFluxoFutebol({
      campeonatos: [a, b],
      provedores: {
        'football-data-org': registrarProvedor<RefTeste>(adaptador, (c) => ({
          competicaoId: c.id,
        })),
      },
      estadoAnterior,
      agora: AGORA,
    });
    expect(ordem).toEqual(['liga-b', 'liga-a']);
  });

  it('resumo por liga no resultado sem segredo nem corpo', async () => {
    const r = await executarFluxoFutebol({
      campeonatos: [BRASILEIRAO],
      provedores: { 'football-data-org': registro(() => loteBrasileiraoConsistente()) },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA_ATIVA,
    });
    const linha = r.linhasLogPorLiga?.[0] ?? '';
    expect(linha).toContain('liga=brasileirao-serie-a resultado=atualizada partidas=20 requisicoes=2');
    expect(linha).not.toMatch(/token|Bearer/i);
  });
});

describe('executarFluxoFutebol — COB-35 (acúmulo, tabela parcial, foraDoRecorte)', () => {
  const COPA = CAMPEONATOS.find((c) => c.id === 'copa-do-brasil')!;
  const PAULISTA = CAMPEONATOS.find((c) => c.id === 'paulista')!;
  const AGORA_ATIVA = new Date('2026-03-10T12:00:00-03:00');
  const [c1, c2, c3, c4] = COPA.clubes as [string, string, string, string];

  function jogo(id: string, m: string, v: string, over: Partial<Partida> = {}): Partida {
    return {
      id,
      competicaoId: COPA.id,
      rodada: null,
      fase: null,
      mandanteId: m,
      visitanteId: v,
      dataHora: '2026-03-11T19:00:00-03:00',
      horarioDefinido: true,
      estadio: null,
      status: 'agendada',
      placar: null,
      ...over,
    };
  }

  function reg(
    lote: () => {
      linhas?: LinhaClassificacao[];
      partidas: Partida[];
      parcial?: boolean;
      foraDoRecorte?: number;
    },
  ) {
    const adaptador: ProvedorFutebolPort<RefTeste> = {
      id: 'mock-cob35',
      orcamento: { porMinuto: 100 },
      obterClassificacao: async () => ({
        linhas: lote().linhas ?? [],
        inconsistencias: [],
        ...(lote().parcial !== undefined ? { parcial: lote().parcial! } : {}),
      }),
      obterPartidas: async () => ({
        partidas: lote().partidas,
        inconsistencias: [],
        ...(lote().foraDoRecorte !== undefined ? { foraDoRecorte: lote().foraDoRecorte! } : {}),
      }),
    };
    return registrarProvedor<RefTeste>(adaptador, (c) => ({ competicaoId: c.id }));
  }

  it('acumula partidas de liga TheSportsDB entre ciclos e finalizada não regride', async () => {
    const fin = jogo('A', c1, c2, {
      status: 'finalizada',
      placar: { mandante: 2, visitante: 0 },
      dataHora: '2026-03-09T19:00:00-03:00',
    });
    const c1r = await executarFluxoFutebol({
      campeonatos: [COPA],
      provedores: { thesportsdb: reg(() => ({ partidas: [fin] })) },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA_ATIVA,
    });
    const c2r = await executarFluxoFutebol({
      campeonatos: [COPA],
      provedores: {
        thesportsdb: reg(() => ({ partidas: [jogo('A', c1, c2), jogo('B', c3, c4)] })),
      },
      estadoAnterior: c1r.novoEstado,
      agora: AGORA_ATIVA,
    });
    const ps = c2r.novoEstado.competicoes[COPA.id]!.partidas;
    expect(ps.map((p) => p.id).sort()).toEqual(['A', 'B']);
    expect(ps.find((p) => p.id === 'A')?.status).toBe('finalizada');
  });

  it('partida que some do provedor é mantida (jogo A do ciclo 1, só B no ciclo 2)', async () => {
    const c1r = await executarFluxoFutebol({
      campeonatos: [COPA],
      provedores: { thesportsdb: reg(() => ({ partidas: [jogo('A', c1, c2)] })) },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA_ATIVA,
    });
    const c2r = await executarFluxoFutebol({
      campeonatos: [COPA],
      provedores: { thesportsdb: reg(() => ({ partidas: [jogo('B', c3, c4)] })) },
      estadoAnterior: c1r.novoEstado,
      agora: AGORA_ATIVA,
    });
    expect(c2r.novoEstado.competicoes[COPA.id]!.partidas.map((p) => p.id).sort()).toEqual([
      'A',
      'B',
    ]);
  });

  it('Brasileirão (football-data) fica fora da mescla: partida ausente some', async () => {
    const provedores = (l: () => ReturnType<typeof loteBrasileiraoConsistente>) => ({
      'football-data-org': registrarProvedor<RefTeste>(
        {
          id: 'm',
          orcamento: { porMinuto: 100 },
          obterClassificacao: async () => ({ linhas: l().linhas, inconsistencias: [] }),
          obterPartidas: async () => ({ partidas: l().partidas, inconsistencias: [] }),
        },
        (c) => ({ competicaoId: c.id }),
      ),
    });
    const a = await executarFluxoFutebol({
      campeonatos: [BRASILEIRAO],
      provedores: provedores(() => loteBrasileiraoConsistente()),
      estadoAnterior: estadoFutebolVazio(),
      agora: new Date('2026-05-01T12:00:00-03:00'),
    });
    const b = await executarFluxoFutebol({
      campeonatos: [BRASILEIRAO],
      provedores: provedores(() => {
        const x = loteBrasileiraoConsistente();
        return { ...x, partidas: x.partidas.slice(0, 10) };
      }),
      estadoAnterior: a.novoEstado,
      agora: new Date('2026-05-01T12:00:00-03:00'),
    });
    expect(b.novoEstado.competicoes['brasileirao-serie-a']!.partidas).toHaveLength(10);
  });

  it('parcial da coleta publica Competicao.tabelaParcial e passa na consistência', async () => {
    const [p1, p2] = PAULISTA.clubes as [string, string];
    const linha = (clubeId: string, posicao: number): LinhaClassificacao => ({
      competicaoId: PAULISTA.id,
      grupo: null,
      posicao,
      clubeId,
      pontos: 3,
      jogos: 1,
      v: 1,
      e: 0,
      d: 0,
      gp: 1,
      gc: 0,
      sg: 1,
      aproveitamento: 100,
      ultimosCinco: ['V'],
    });
    const parcial = await executarFluxoFutebol({
      campeonatos: [PAULISTA],
      provedores: {
        thesportsdb: reg(() => ({ linhas: [linha(p1, 1), linha(p2, 2)], partidas: [], parcial: true })),
      },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA_ATIVA,
    });
    expect(parcial.status.futebol[PAULISTA.id]?.resultado).toBe('atualizada');
    expect(parcial.novoEstado.competicoes[PAULISTA.id]!.competicao.tabelaParcial).toBe(true);

    const semMarca = await executarFluxoFutebol({
      campeonatos: [PAULISTA],
      provedores: { thesportsdb: reg(() => ({ linhas: [linha(p1, 1), linha(p2, 2)], partidas: [] })) },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA_ATIVA,
    });
    expect(semMarca.status.futebol[PAULISTA.id]?.resultado).toBe('inconsistente');
  });

  it('repassa foraDoRecorte do adaptador ao status por liga', async () => {
    const r = await executarFluxoFutebol({
      campeonatos: [COPA],
      provedores: {
        thesportsdb: reg(() => ({ partidas: [jogo('A', c1, c2)], foraDoRecorte: 7 })),
      },
      estadoAnterior: estadoFutebolVazio(),
      agora: AGORA_ATIVA,
    });
    expect(r.status.futebol[COPA.id]?.descartes?.['fora-do-recorte']).toBe(7);
  });
});

describe('paraDerivacao (COB-38)', () => {
  const base = {
    fase: 'Grupos',
    dataHora: '2026-05-01T20:00:00Z',
    status: 'finalizada',
    placar: { mandante: 1, visitante: 0 },
    mandanteId: 'flamengo',
    visitanteId: 'externo-x',
  } as unknown as Partida;

  it('clube mandante: adversário é o visitante', async () => {
    const { paraDerivacao } = await import('./orquestrador');
    const r = paraDerivacao(base, 'flamengo');
    expect(r.adversarioId).toBe('externo-x');
    expect(r.clubeEhMandante).toBe(true);
    expect(r.faseJogoUnico).toBeUndefined();
  });

  it('clube visitante: adversário é o mandante', async () => {
    const { paraDerivacao } = await import('./orquestrador');
    const r = paraDerivacao(base, 'externo-x');
    expect(r.adversarioId).toBe('flamengo');
    expect(r.clubeEhMandante).toBe(false);
  });
});
