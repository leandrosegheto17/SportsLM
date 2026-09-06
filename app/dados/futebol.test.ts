// app/dados/futebol.test.ts — UI-T02-01 (TASK.md Lote 8)
//
// Prova que os schemas locais (`brasileiraoPublicoSchema`/
// `clubeFutebolPublicoSchema`) validam exatamente a forma publicada por
// `pipeline/publicacao/gerador-snapshots.ts` (PUB-02) — sem importar aquele
// módulo (faz I/O de `node:fs`/`node:crypto`, não pode entrar no bundle da
// SPA; ver comentário no topo de `futebol.ts`).

import { describe, expect, it } from 'vitest';
import {
  brasileiraoPublicoSchema,
  clubeFutebolPublicoSchema,
  urlFutebolClube,
  URL_FUTEBOL_BRASILEIRAO,
} from './futebol';

const competicao = {
  id: 'brasileirao-serie-a',
  nome: 'Brasileirão Série A',
  temporada: 2026,
  formato: 'pontos-corridos' as const,
  janela: { inicio: '2026-03-01', fim: '2026-12-01' },
  provedor: 'football-data-org',
  ultimaAtualizacao: '2026-09-05T10:00:00-03:00',
};

const linhaClassificacao = {
  competicaoId: 'brasileirao-serie-a',
  grupo: null,
  posicao: 6,
  clubeId: 'sao-paulo',
  pontos: 42,
  jogos: 23,
  v: 12,
  e: 6,
  d: 5,
  gp: 38,
  gc: 24,
  sg: 14,
  aproveitamento: 61.4,
  ultimosCinco: ['V', 'E', 'D', 'V', 'V'] as const,
};

const partida = {
  id: 'p1',
  competicaoId: 'brasileirao-serie-a',
  rodada: 24,
  fase: null,
  mandanteId: 'fluminense',
  visitanteId: 'sao-paulo',
  dataHora: '2026-09-13T16:00:00-03:00',
  horarioDefinido: true,
  estadio: 'Maracanã',
  status: 'agendada' as const,
  placar: null,
};

describe('brasileiraoPublicoSchema (/dados/futebol/brasileirao.json)', () => {
  it('valida um snapshot completo', () => {
    const resultado = brasileiraoPublicoSchema.safeParse({
      competicao,
      classificacao: [linhaClassificacao],
      partidas: [partida],
      zonas: [],
    });
    expect(resultado.success).toBe(true);
  });

  it('rejeita classificação com campo faltando', () => {
    const resultado = brasileiraoPublicoSchema.safeParse({
      competicao,
      classificacao: [{ ...linhaClassificacao, pontos: undefined }],
      partidas: [],
      zonas: [],
    });
    expect(resultado.success).toBe(false);
  });
});

describe('clubeFutebolPublicoSchema (/dados/futebol/clube/<slug>.json)', () => {
  const participacao = {
    competicaoId: 'brasileirao-serie-a',
    clubeId: 'sao-paulo',
    status: 'em-andamento' as const,
    faseAtual: null,
    resultadoFinal: null,
    resumo: null,
  };

  it('valida uma lista de campeonatos do clube', () => {
    const resultado = clubeFutebolPublicoSchema.safeParse([
      { competicao, participacao, partidas: [partida] },
    ]);
    expect(resultado.success).toBe(true);
  });

  it('aceita lista vazia (clube sem nenhum campeonato configurado)', () => {
    expect(clubeFutebolPublicoSchema.safeParse([]).success).toBe(true);
  });
});

describe('caminhos do contrato (SDD §2.2)', () => {
  it('URL_FUTEBOL_BRASILEIRAO é o caminho fixo do contrato', () => {
    expect(URL_FUTEBOL_BRASILEIRAO).toBe('/dados/futebol/brasileirao.json');
  });

  it('urlFutebolClube monta o caminho por slug', () => {
    expect(urlFutebolClube('sao-paulo')).toBe('/dados/futebol/clube/sao-paulo.json');
  });
});
