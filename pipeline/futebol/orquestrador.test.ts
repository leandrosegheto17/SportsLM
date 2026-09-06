// pipeline/futebol/orquestrador.test.ts — ING-F-05 (TASK.md Lote 5)
//
// Teste de integração de ponta a ponta do Fluxo 2 (SDD §2.4): liga
// ING-F-02 (coleta por prioridade/cota) → ING-F-04 (consistência) → ING-F-03
// (derivação de status/fase), com um provedor mockado (nenhuma chamada de
// rede real) registrado só para o Brasileirão — igual à configuração real de
// `config/campeonatos-2026.json` (`provedor: "football-data-org"` só na
// Série A, o resto `null`). Cobre especificamente:
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
  type EstadoFutebol,
} from './orquestrador';
import { registrarProvedor, type ProvedorFutebolPort } from './coletor-futebol';
import { carregarClubesSerieA2026 } from '../config/clubes';
import type { LinhaClassificacao, Partida } from '../../dominio/tipos/futebol';
import type { InconsistenciaClube } from './adaptador-football-data';

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

function criarProvedorMockBrasileirao(lote: {
  linhas: LinhaClassificacao[];
  partidas: Partida[];
}) {
  const inconsistencias: InconsistenciaClube[] = [];
  const adaptador: ProvedorFutebolPort<RefTeste> = {
    id: 'football-data-mock',
    orcamento: { porMinuto: 10 },
    obterClassificacao: async () => ({ linhas: lote.linhas, inconsistencias }),
    obterPartidas: async () => ({ partidas: lote.partidas, inconsistencias }),
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
      janela: { inicio: '2026-03-28', fim: '2026-12-06' },
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
    expect(resultado.status.futebol['brasileirao-serie-a']).toEqual({
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
