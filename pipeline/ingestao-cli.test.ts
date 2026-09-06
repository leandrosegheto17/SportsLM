// pipeline/ingestao-cli.test.ts — REFAT-06-01 (TASK.md Refatoração Lote-6)
//
// Testa a lógica de orquestração de `npm run ingestao` (`executarIngestaoCompleta`)
// com os três pontos de entrada mockados — nunca toca disco/rede real (isso já
// é coberto pelos testes de `orquestrador.test.ts`/`gerador-snapshots.test.ts`
// de cada módulo). Cobre:
//   (a) ordem exata de chamada: notícias → futebol → snapshots, sequencial
//       (nunca em paralelo — ver nota de decisão em `ingestao-cli.ts`);
//   (b) resumo correto a partir dos resultados mockados;
//   (c) propagação de erro de cada um dos três passos, sem engolir nada.

import { describe, expect, it, vi } from 'vitest';

import { executarIngestaoCompleta, type DependenciasIngestaoCli } from './ingestao-cli';
import type { ResultadoFluxoNoticias } from './noticias/orquestrador';
import type { ResultadoFluxoFutebol } from './futebol/orquestrador';
import type { SnapshotsPublicados } from './publicacao/gerador-snapshots';

function resultadoNoticiasMock(
  itensPublicaveis: ResultadoFluxoNoticias['itensPublicaveis'] = [],
): ResultadoFluxoNoticias {
  return {
    itensPublicaveis,
    status: {
      geradoEm: '2026-09-06T12:00:00.000Z',
      fontes: {},
      distribuicaoClassificacao: {},
      gruposFormados: 0,
    },
    novoEstado: { itens: [], registrosPorFonte: {}, idsIngeridos: {} },
  };
}

function resultadoFutebolMock(
  futebol: ResultadoFluxoFutebol['status']['futebol'] = {},
  pausadoPorCota = false,
): ResultadoFluxoFutebol {
  return {
    novoEstado: { competicoes: {} },
    status: {
      geradoEm: '2026-09-06T12:00:00.000Z',
      futebol,
      provedores: {},
      pausadoPorCota,
    },
  };
}

function snapshotsMock(): SnapshotsPublicados {
  return {
    versao: {
      geradoEm: '2026-09-06T12:00:00.000Z',
      hashes: { noticias: 'a', futebol: 'b', catalogo: 'c', status: 'd' },
    },
    noticias: [],
    catalogoFontes: [],
    futebolBrasileirao: {
      competicao: {
        id: 'brasileirao-serie-a',
        nome: 'Brasileirão Série A',
        temporada: 2026,
        formato: 'pontos-corridos',
        janela: { inicio: '2026-01-01', fim: '2026-12-01' },
        provedor: 'football-data-org',
        ultimaAtualizacao: null,
      },
      classificacao: [],
      partidas: [],
      zonas: [],
    },
    futebolPorClube: {},
    configEsportes: [],
    configClubes: [],
    configCampeonatos: [],
    configZonas: null,
    statusIngestao: {
      geradoEm: '2026-09-06T12:00:00.000Z',
      fontes: {},
      distribuicaoClassificacao: {},
      gruposFormados: 0,
      futebol: {},
      provedores: {},
      pausadoPorCota: false,
    },
  };
}

describe('executarIngestaoCompleta', () => {
  it('chama notícias, depois futebol, depois snapshots, nesta ordem exata (sequencial)', async () => {
    const ordem: string[] = [];
    const deps: DependenciasIngestaoCli = {
      executarNoticias: vi.fn(async () => {
        ordem.push('noticias');
        return resultadoNoticiasMock();
      }),
      executarFutebol: vi.fn(async () => {
        ordem.push('futebol');
        return resultadoFutebolMock();
      }),
      gerarSnapshots: vi.fn(() => {
        ordem.push('snapshots');
        return snapshotsMock();
      }),
    };

    await executarIngestaoCompleta(deps);

    expect(ordem).toEqual(['noticias', 'futebol', 'snapshots']);
    expect(deps.executarNoticias).toHaveBeenCalledTimes(1);
    expect(deps.executarFutebol).toHaveBeenCalledTimes(1);
    expect(deps.gerarSnapshots).toHaveBeenCalledTimes(1);
  });

  it('nunca chama futebol antes de notícias terminar, mesmo que futebol resolva mais rápido', async () => {
    const ordem: string[] = [];
    const deps: DependenciasIngestaoCli = {
      executarNoticias: vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        ordem.push('noticias');
        return resultadoNoticiasMock();
      }),
      executarFutebol: vi.fn(async () => {
        // resolve "instantaneamente" — se a orquestração fosse `Promise.all`,
        // isto apareceria em `ordem` antes de 'noticias'.
        ordem.push('futebol');
        return resultadoFutebolMock();
      }),
      gerarSnapshots: vi.fn(() => {
        ordem.push('snapshots');
        return snapshotsMock();
      }),
    };

    await executarIngestaoCompleta(deps);

    expect(ordem).toEqual(['noticias', 'futebol', 'snapshots']);
  });

  it('monta o resumo a partir dos resultados de cada passo', async () => {
    const deps: DependenciasIngestaoCli = {
      executarNoticias: vi.fn(async () =>
        resultadoNoticiasMock([
          {
            id: 'a',
            fonteId: 'fonte-1',
            feedId: 'feed-1',
            titulo: 'Título',
            resumo: null,
            link: 'https://exemplo.com/a',
            publicadoEm: '2026-09-06T00:00:00.000Z',
            dataEstimada: false,
            esporte: 'futebol',
            origemClassificacao: 'lexico',
            grupoId: null,
            ingeridoEm: '2026-09-06T00:00:00.000Z',
          },
        ]),
      ),
      executarFutebol: vi.fn(async () =>
        resultadoFutebolMock(
          {
            'brasileirao-serie-a': {
              resultado: 'atualizada',
              ultimaAtualizacao: '2026-09-06T00:00:00.000Z',
            },
            'copa-do-brasil': { resultado: 'fora-da-janela', ultimaAtualizacao: null },
          },
          true,
        ),
      ),
      gerarSnapshots: vi.fn(() => snapshotsMock()),
    };

    const resumo = await executarIngestaoCompleta(deps);

    expect(resumo.noticias.itensPublicaveis).toBe(1);
    expect(resumo.futebol.competicoesAtualizadas).toBe(1);
    expect(resumo.futebol.competicoesTotal).toBe(2);
    expect(resumo.futebol.pausadoPorCota).toBe(true);
    expect(resumo.publicacao.arquivosGerados).toBeGreaterThan(0);
  });

  it('propaga erro de `executarNoticias` sem chamar futebol nem snapshots', async () => {
    const erro = new Error('falha simulada de notícias');
    const deps: DependenciasIngestaoCli = {
      executarNoticias: vi.fn(async () => {
        throw erro;
      }),
      executarFutebol: vi.fn(async () => resultadoFutebolMock()),
      gerarSnapshots: vi.fn(() => snapshotsMock()),
    };

    await expect(executarIngestaoCompleta(deps)).rejects.toThrow(
      'falha simulada de notícias',
    );
    expect(deps.executarFutebol).not.toHaveBeenCalled();
    expect(deps.gerarSnapshots).not.toHaveBeenCalled();
  });

  it('propaga erro de `executarFutebol` (ex.: FOOTBALL_DATA_API_TOKEN ausente) sem chamar snapshots', async () => {
    const erro = new Error('FOOTBALL_DATA_API_TOKEN não definido');
    const deps: DependenciasIngestaoCli = {
      executarNoticias: vi.fn(async () => resultadoNoticiasMock()),
      executarFutebol: vi.fn(async () => {
        throw erro;
      }),
      gerarSnapshots: vi.fn(() => snapshotsMock()),
    };

    await expect(executarIngestaoCompleta(deps)).rejects.toThrow(
      'FOOTBALL_DATA_API_TOKEN não definido',
    );
    expect(deps.gerarSnapshots).not.toHaveBeenCalled();
  });

  it('propaga erro de `gerarSnapshots` (ex.: `ErroPaletaInvalida` do PUB-01)', async () => {
    const erro = new Error('paleta inválida');
    const deps: DependenciasIngestaoCli = {
      executarNoticias: vi.fn(async () => resultadoNoticiasMock()),
      executarFutebol: vi.fn(async () => resultadoFutebolMock()),
      gerarSnapshots: vi.fn(() => {
        throw erro;
      }),
    };

    await expect(executarIngestaoCompleta(deps)).rejects.toThrow('paleta inválida');
  });
});
