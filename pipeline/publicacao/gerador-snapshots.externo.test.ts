// COB-21 (ADR-019) — `Partida.externo` preservado no snapshot por clube e orçamento de 25 KB (SDD §2.2).
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import {
  construirSnapshots,
  clubeFutebolPublicoSchema,
  type EntradaSnapshots,
} from './gerador-snapshots';
import type { CompeticaoEstado } from '../futebol/orquestrador';
import type { CampeonatoConfig } from '../../config/campeonatos.schema';
import type { ClubeBase } from '../config/clubes';
import type { Fonte } from '../../dominio/tipos/noticias';
import type { Partida } from '../../dominio/tipos/futebol';
import { carregarEsportesConfig } from './gerador-snapshots';

const ESPORTES = carregarEsportesConfig();

const AGORA = new Date('2026-09-18T12:00:00-03:00');

const clube = (id: string, sigla: string, cor: string): ClubeBase => ({
  id,
  nome: `Clube ${id}`,
  nomeCurto: id,
  sigla,
  corBase: cor,
  idsProvedor: {},
});
const FLA = clube('flamengo', 'FLA', '#E2231A');
const SPA = clube('sao-paulo', 'SPA', '#E30613');

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
const FONTES = Array.from({ length: 12 }, (_, i) => fonte(`f${String(i)}`));

const cfg = (
  id: string,
  categoria: CampeonatoConfig['categoria'],
  formato: CampeonatoConfig['formato'],
  clubes: string[],
): CampeonatoConfig => ({
  id,
  nome: id,
  temporada: 2026,
  categoria,
  formato,
  janela: { inicio: '2026-01-10', fim: '2026-12-06' },
  provedor: 'thesportsdb',
  clubes,
});

const CONFIGS: CampeonatoConfig[] = [
  {
    ...cfg('brasileirao-serie-a', 'brasileirao', 'pontos-corridos', [
      'flamengo',
      'sao-paulo',
    ]),
    provedor: 'football-data-org',
  },
  cfg('copa-do-brasil', 'copa-do-brasil', 'mata-mata', ['flamengo']),
  cfg('libertadores', 'continental', 'grupos', ['flamengo']),
  cfg('sul-americana', 'continental', 'grupos', ['flamengo']),
  cfg('carioca', 'estadual', 'grupos', ['flamengo']),
  cfg('paulista', 'estadual', 'grupos', ['sao-paulo']),
];

function partidaExterna(comp: string, n: number, mandanteFla: boolean): Partida {
  const idExt = `externo-${comp}-${String(n)}`;
  return {
    id: `${comp}-${String(n)}`,
    competicaoId: comp,
    rodada: n,
    fase: 'Fase de grupos',
    mandanteId: mandanteFla ? 'flamengo' : idExt,
    visitanteId: mandanteFla ? idExt : 'flamengo',
    dataHora: '2026-03-01T19:00:00-03:00',
    horarioDefinido: true,
    estadio: null,
    status: 'finalizada',
    placar: { mandante: 1, visitante: 0 },
    externo: {
      lado: mandanteFla ? 'visitante' : 'mandante',
      nome: `Adversário Externo ${String(n)}`,
    },
  };
}

function estado(
  comp: string,
  partidas: Partida[],
  clubeId = 'flamengo',
): CompeticaoEstado {
  const c = CONFIGS.find((x) => x.id === comp) as CampeonatoConfig;
  return {
    competicao: {
      id: c.id,
      nome: c.nome,
      temporada: 2026,
      formato: c.formato,
      janela: c.janela,
      provedor: c.provedor,
      ultimaAtualizacao: AGORA.toISOString(),
    },
    linhas: [],
    partidas,
    participacoes: [
      {
        competicaoId: comp,
        clubeId,
        status: 'em-andamento',
        faseAtual: null,
        resultadoFinal: null,
        resumo: null,
      },
    ],
  };
}

const BR_PARTIDA: Partida = {
  id: 'br1',
  competicaoId: 'brasileirao-serie-a',
  rodada: 1,
  fase: null,
  mandanteId: 'flamengo',
  visitanteId: 'sao-paulo',
  dataHora: '2026-04-01T19:00:00-03:00',
  horarioDefinido: true,
  estadio: null,
  status: 'finalizada',
  placar: { mandante: 2, visitante: 1 },
};

const COMPETICOES_BASE = {
  'brasileirao-serie-a': estado('brasileirao-serie-a', [BR_PARTIDA]),
};
const COMPETICOES_MISTAS = {
  ...COMPETICOES_BASE,
  'copa-do-brasil': estado('copa-do-brasil', [
    partidaExterna('copa-do-brasil', 1, true),
    partidaExterna('copa-do-brasil', 2, false),
  ]),
  libertadores: estado(
    'libertadores',
    Array.from({ length: 6 }, (_, i) =>
      partidaExterna('libertadores', i + 1, i % 2 === 0),
    ),
  ),
  'sul-americana': estado(
    'sul-americana',
    Array.from({ length: 6 }, (_, i) =>
      partidaExterna('sul-americana', i + 1, i % 2 === 0),
    ),
  ),
  carioca: estado(
    'carioca',
    Array.from({ length: 30 }, (_, i) => partidaExterna('carioca', i + 1, i % 2 === 0)),
  ),
  paulista: estado(
    'paulista',
    [{ ...partidaExterna('paulista', 1, true), mandanteId: 'sao-paulo' }],
    'sao-paulo',
  ),
};

const entrada = (
  competicoesFutebol: EntradaSnapshots['competicoesFutebol'],
): EntradaSnapshots => ({
  agora: AGORA,
  itensNoticiasEstado: [],
  fontes: FONTES,
  statusIngestaoBruto: undefined,
  competicoesFutebol,
  campeonatosConfig: CONFIGS,
  clubesBase: [FLA, SPA],
  esportes: ESPORTES,
  zonas: null,
});

const hash = (v: unknown): string =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');

describe('COB-21 — externo no snapshot por clube', () => {
  const snap = construirSnapshots(entrada(COMPETICOES_MISTAS));

  it('preserva `externo` válido nas competições mata-mata/mistas e no estadual', () => {
    const fla = clubeFutebolPublicoSchema.parse(snap.futebolPorClube['flamengo']);
    for (const id of ['copa-do-brasil', 'libertadores', 'sul-americana', 'carioca']) {
      const c = fla.find((x) => x.competicao.id === id);
      expect(c?.partidas.length).toBeGreaterThan(0);
      for (const p of c?.partidas ?? [])
        expect(p.externo?.nome).toMatch(/^Adversário Externo/);
    }
    expect(fla.find((x) => x.competicao.id === 'carioca')?.partidas).toHaveLength(30);
  });

  it('página do pior clube cabe em 25 KB comprimidos', () => {
    for (const id of ['flamengo', 'sao-paulo']) {
      const bytes = gzipSync(
        Buffer.from(JSON.stringify(snap.futebolPorClube[id], null, 2)),
      ).length;
      expect(bytes).toBeLessThanOrEqual(25 * 1024);
    }
  });

  it('brasileirao.json é idêntico ao de hoje (hash) e sem partida externa', () => {
    const base = construirSnapshots(entrada(COMPETICOES_BASE));
    expect(hash(snap.futebolBrasileirao)).toBe(hash(base.futebolBrasileirao));
    expect(snap.futebolBrasileirao.partidas.every((p) => p.externo === undefined)).toBe(
      true,
    );
  });

  it('partida externa nunca vaza para o snapshot de outro clube', () => {
    const spa = snap.futebolPorClube['sao-paulo'] ?? [];
    const ids = spa.flatMap((c) => c.partidas.map((p) => p.id));
    expect(ids).not.toContain('carioca-1');
    expect(ids).not.toContain('libertadores-1');
    expect(JSON.stringify(spa)).not.toContain('Adversário Externo 2');
  });
});
