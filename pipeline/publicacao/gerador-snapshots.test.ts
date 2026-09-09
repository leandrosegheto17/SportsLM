// pipeline/publicacao/gerador-snapshots.test.ts — PUB-02 (TASK.md Lote 6)
//
// Dois grupos de teste:
//   1. `construirSnapshots` (camada pura) a partir de estado mockado: cada
//      arquivo do contrato do SDD §2.2 é validado contra seu schema, incluindo
//      a prova de compatibilidade com `esquemaVersao` de `app/dados/versao.ts`
//      (UI-DS-08) pedida pela descrição da tarefa; determinismo (mesma
//      entrada ⇒ mesmo hash) é verificado chamando a função duas vezes com um
//      clone profundo da mesma entrada.
//   2. `gerarSnapshotsEmDisco` (camada de I/O) contra a configuração REAL do
//      repositório (`config/*.json`, mesma disciplina de
//      `pipeline/futebol/orquestrador.test.ts`) e um estado interno
//      construído em diretório temporário — confirma que todos os arquivos
//      do contrato são gravados nos caminhos certos, que ausência de
//      `config/zonas-2026.json` real não gera `config/zonas-2026.json`
//      publicado (CA-18.2), e que rodar duas vezes com o mesmo estado produz
//      bytes idênticos (pré-condição para "publica só se o hash mudou").

import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  construirSnapshots,
  gerarSnapshotsEmDisco,
  versaoPublicaSchema,
  catalogoFontesPublicoSchema,
  noticiasPublicasSchema,
  brasileiraoPublicoSchema,
  clubeFutebolPublicoSchema,
  clubePublicoSchema,
  campeonatoPublicoSchema,
  statusIngestaoPublicoSchema,
  type EntradaSnapshots,
} from './gerador-snapshots';
import { esquemaVersao } from '../../app/dados/versao';
import { esportesSchema } from '../../config/esportes.schema';
import {
  zonaSchema,
  type LinhaClassificacao,
  type Partida,
} from '../../dominio/tipos/futebol';
import type { CompeticaoEstado } from '../futebol/orquestrador';
import type { CampeonatoConfig } from '../../config/campeonatos.schema';
import type { ClubeBase } from '../config/clubes';
import type { Fonte, ItemNoticia } from '../../dominio/tipos/noticias';
import type { Esporte } from '../../config/esportes.schema';

import {
  carregarCampeonatosDominio,
  gravarEstadoFutebol,
  gravarStatusFutebol,
} from '../futebol/orquestrador';
import { gravarEstadoNoticias, gravarStatus } from '../noticias/orquestrador';

const AGORA = new Date('2026-09-06T12:00:00-03:00');

// --- Fixtures da camada pura -------------------------------------------------

const ESPORTES_FIXTURE: Esporte[] = [
  { id: 'futebol', nome: 'Futebol', ordem: 1 },
  { id: 'volei-quadra', nome: 'Vôlei (quadra)', ordem: 2 },
  { id: 'formula1', nome: 'Fórmula 1 / automobilismo', ordem: 3 },
  { id: 'basquete', nome: 'Basquete', ordem: 4 },
  { id: 'tenis', nome: 'Tênis', ordem: 5 },
  { id: 'volei-praia', nome: 'Vôlei de praia', ordem: 6 },
  { id: 'natacao', nome: 'Natação', ordem: 7 },
  { id: 'mma', nome: 'MMA / UFC', ordem: 8 },
  { id: 'ginastica-artistica', nome: 'Ginástica artística', ordem: 9 },
  { id: 'surfe', nome: 'Surfe', ordem: 10 },
  { id: 'skate', nome: 'Skate', ordem: 11 },
  { id: 'judo', nome: 'Judô', ordem: 12 },
  { id: 'atletismo', nome: 'Atletismo', ordem: 13 },
  { id: 'futsal', nome: 'Futsal', ordem: 14 },
  { id: 'futebol-americano', nome: 'Futebol americano', ordem: 15 },
];

function fonteFixture(id: string, nome: string, fixa = false): Fonte {
  return {
    id,
    nome,
    fixa,
    esportesCobertos: ['futebol'],
    termos: { url: null, verificadoEm: '2026-09-05', uso: 'nao-comercial' },
    frequenciaMaximaMin: 30,
    feeds: [],
    verificacao: { estado: 'verificada', em: '2026-09-05' },
  };
}

const FONTES_FIXTURE: Fonte[] = [
  fonteFixture('ge', 'GE — ge.globo', true),
  fonteFixture('espn-brasil', 'ESPN Brasil'),
  fonteFixture('gazeta-esportiva', 'Gazeta Esportiva'),
  fonteFixture('terra-esportes', 'Terra Esportes'),
  fonteFixture('uol-esporte', 'UOL Esporte'),
  fonteFixture('ogol', 'ogol.com.br'),
  fonteFixture('superesportes', 'Superesportes'),
  fonteFixture('f1mania', 'F1Mania.net'),
  fonteFixture('motorsport-brasil', 'Motorsport.com Brasil'),
  fonteFixture('estadao-esportes', 'Estadão Esportes'),
  fonteFixture('r7-esporte', 'R7 Esporte'),
  fonteFixture('torcedores', 'Torcedores.com'),
];

function itemFixture(
  parcial: Partial<ItemNoticia> & Pick<ItemNoticia, 'id' | 'link'>,
): ItemNoticia {
  return {
    fonteId: 'espn-brasil',
    feedId: 'espn-top',
    titulo: 'Título de teste',
    resumo: null,
    publicadoEm: '2026-09-06T10:00:00-03:00',
    dataEstimada: false,
    esporte: 'futebol',
    origemClassificacao: 'feed-fixado',
    grupoId: null,
    ingeridoEm: '2026-09-06T10:05:00-03:00',
    ...parcial,
  };
}

const ITENS_NOTICIAS_FIXTURE: ItemNoticia[] = [
  itemFixture({ id: 'item-1', link: 'https://exemplo.com/1', titulo: 'Item de futebol' }),
  itemFixture({
    id: 'item-2',
    link: 'https://exemplo.com/2',
    titulo: 'Item geral',
    esporte: 'geral',
  }),
  itemFixture({
    id: 'item-3',
    link: 'https://exemplo.com/3',
    titulo: 'Item fora do recorte',
    esporte: 'fora-do-recorte',
  }),
];

const CLUBE_A: ClubeBase = {
  id: 'flamengo',
  nome: 'Clube de Regatas do Flamengo',
  nomeCurto: 'Flamengo',
  sigla: 'FLA',
  corBase: '#E2231A',
  idsProvedor: { 'football-data': 1783 },
};

const CLUBE_B: ClubeBase = {
  id: 'sao-paulo',
  nome: 'São Paulo Futebol Clube',
  nomeCurto: 'São Paulo',
  sigla: 'SPA',
  corBase: '#E30613',
  idsProvedor: { 'football-data': 'pendente-confirmacao' },
};

const CAMPEONATO_BRASILEIRAO: CampeonatoConfig = {
  id: 'brasileirao-serie-a',
  nome: 'Campeonato Brasileiro Série A',
  temporada: 2026,
  categoria: 'brasileirao',
  formato: 'pontos-corridos',
  janela: { inicio: '2026-03-28', fim: '2026-12-06' },
  provedor: 'football-data-org',
  clubes: ['flamengo', 'sao-paulo'],
};

const CAMPEONATO_ESTADUAL_SEM_ESTADO: CampeonatoConfig = {
  id: 'paulista',
  nome: 'Campeonato Paulista',
  temporada: 2026,
  categoria: 'estadual',
  formato: 'grupos',
  janela: { inicio: '2026-01-10', fim: '2026-03-20' },
  provedor: null,
  clubes: ['sao-paulo'],
};

const PARTIDA_FINALIZADA: Partida = {
  id: 'p1',
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

const PARTIDA_AGENDADA: Partida = {
  id: 'p2',
  competicaoId: 'brasileirao-serie-a',
  rodada: 2,
  fase: null,
  mandanteId: 'sao-paulo',
  visitanteId: 'flamengo',
  dataHora: '2026-10-01T19:00:00-03:00',
  horarioDefinido: true,
  estadio: null,
  status: 'agendada',
  placar: null,
};

const LINHAS_FIXTURE: LinhaClassificacao[] = [
  {
    competicaoId: 'brasileirao-serie-a',
    grupo: null,
    posicao: 1,
    clubeId: 'flamengo',
    pontos: 3,
    jogos: 1,
    v: 1,
    e: 0,
    d: 0,
    gp: 2,
    gc: 1,
    sg: 1,
    aproveitamento: 100,
    ultimosCinco: ['V'],
  },
  {
    competicaoId: 'brasileirao-serie-a',
    grupo: null,
    posicao: 2,
    clubeId: 'sao-paulo',
    pontos: 0,
    jogos: 1,
    v: 0,
    e: 0,
    d: 1,
    gp: 1,
    gc: 2,
    sg: -1,
    aproveitamento: 0,
    ultimosCinco: ['D'],
  },
];

const COMPETICAO_ESTADO_BRASILEIRAO: CompeticaoEstado = {
  competicao: {
    id: 'brasileirao-serie-a',
    nome: 'Campeonato Brasileiro Série A',
    temporada: 2026,
    formato: 'pontos-corridos',
    janela: { inicio: '2026-03-28', fim: '2026-12-06' },
    provedor: 'football-data-org',
    ultimaAtualizacao: '2026-09-06T09:00:00-03:00',
  },
  linhas: LINHAS_FIXTURE,
  partidas: [PARTIDA_FINALIZADA, PARTIDA_AGENDADA],
  participacoes: [
    {
      competicaoId: 'brasileirao-serie-a',
      clubeId: 'flamengo',
      status: 'em-andamento',
      faseAtual: null,
      resultadoFinal: null,
      resumo: {
        jogos: 1,
        v: 1,
        e: 0,
        d: 0,
        gp: 2,
        gc: 1,
        sg: 1,
        pontos: 3,
        aproveitamento: 100,
        posicao: 1,
      },
    },
    {
      competicaoId: 'brasileirao-serie-a',
      clubeId: 'sao-paulo',
      status: 'em-andamento',
      faseAtual: null,
      resultadoFinal: null,
      resumo: {
        jogos: 1,
        v: 0,
        e: 0,
        d: 1,
        gp: 1,
        gc: 2,
        sg: -1,
        pontos: 0,
        aproveitamento: 0,
        posicao: 2,
      },
    },
  ],
};

const STATUS_BRUTO_FIXTURE = {
  geradoEm: AGORA.toISOString(),
  fontes: {
    ge: {
      ultimaTentativa: AGORA.toISOString(),
      resultado: 'ok' as const,
      itensNovos: 1,
      falhasConsecutivas: 0,
      instavel: false,
      instavelDesde: null,
    },
  },
  distribuicaoClassificacao: { futebol: 1, geral: 1 },
  gruposFormados: 0,
  futebol: {
    'brasileirao-serie-a': {
      resultado: 'atualizada' as const,
      ultimaAtualizacao: AGORA.toISOString(),
    },
  },
  provedores: { 'football-data-org': 2 },
  pausadoPorCota: false,
};

function entradaFixture(): EntradaSnapshots {
  return {
    agora: AGORA,
    itensNoticiasEstado: ITENS_NOTICIAS_FIXTURE,
    fontes: FONTES_FIXTURE,
    statusIngestaoBruto: STATUS_BRUTO_FIXTURE,
    competicoesFutebol: { 'brasileirao-serie-a': COMPETICAO_ESTADO_BRASILEIRAO },
    campeonatosConfig: [CAMPEONATO_BRASILEIRAO, CAMPEONATO_ESTADUAL_SEM_ESTADO],
    clubesBase: [CLUBE_A, CLUBE_B],
    esportes: ESPORTES_FIXTURE,
    zonas: [
      { de: 1, ate: 4, rotulo: 'Libertadores', token: 'libertadores' },
      { de: 17, ate: 20, rotulo: 'Rebaixamento', token: 'rebaixamento' },
    ],
  };
}

describe('construirSnapshots — SDD §2.2 (estado mockado)', () => {
  it('produz todos os arquivos do contrato, cada um validando contra seu schema', () => {
    const snapshots = construirSnapshots(entradaFixture());

    expect(() => versaoPublicaSchema.parse(snapshots.versao)).not.toThrow();
    // Compatibilidade com o cliente (UI-DS-08): mesma forma de `esquemaVersao`.
    expect(() => esquemaVersao.parse(snapshots.versao)).not.toThrow();

    expect(() => noticiasPublicasSchema.parse(snapshots.noticias)).not.toThrow();
    expect(() =>
      catalogoFontesPublicoSchema.parse(snapshots.catalogoFontes),
    ).not.toThrow();
    expect(() =>
      brasileiraoPublicoSchema.parse(snapshots.futebolBrasileirao),
    ).not.toThrow();
    expect(() =>
      clubeFutebolPublicoSchema.parse(snapshots.futebolPorClube['flamengo']),
    ).not.toThrow();
    expect(() =>
      clubeFutebolPublicoSchema.parse(snapshots.futebolPorClube['sao-paulo']),
    ).not.toThrow();
    expect(() => esportesSchema.parse(snapshots.configEsportes)).not.toThrow();
    for (const clube of snapshots.configClubes) {
      expect(() => clubePublicoSchema.parse(clube)).not.toThrow();
    }
    for (const campeonato of snapshots.configCampeonatos) {
      expect(() => campeonatoPublicoSchema.parse(campeonato)).not.toThrow();
    }
    expect(snapshots.configZonas).not.toBeNull();
    for (const zona of snapshots.configZonas ?? []) {
      expect(() => zonaSchema.parse(zona)).not.toThrow();
    }
    expect(() =>
      statusIngestaoPublicoSchema.parse(snapshots.statusIngestao),
    ).not.toThrow();
  });

  it('nunca publica item `fora-do-recorte` em noticias.json (CA-04.8)', () => {
    const snapshots = construirSnapshots(entradaFixture());
    expect(snapshots.noticias).toHaveLength(2);
    expect(snapshots.noticias.some((item) => item.esporte === 'fora-do-recorte')).toBe(
      false,
    );
  });

  it('CA-07.2: campeonato sem estado de ingestão ainda aparece, com status "sem-dados"', () => {
    const snapshots = construirSnapshots(entradaFixture());
    const paulista = snapshots.futebolPorClube['sao-paulo']?.find(
      (c) => c.competicao.id === 'paulista',
    );
    expect(paulista).toBeDefined();
    expect(paulista?.participacao.status).toBe('sem-dados');
    expect(paulista?.competicao.ultimaAtualizacao).toBeNull();
  });

  it('CA-07.4: campeonato em-andamento vem antes do sem-dados na lista do clube', () => {
    const snapshots = construirSnapshots(entradaFixture());
    const idsOrdenados = snapshots.futebolPorClube['sao-paulo']?.map(
      (c) => c.competicao.id,
    );
    expect(idsOrdenados).toEqual(['brasileirao-serie-a', 'paulista']);
  });

  it('filtra partidas do clube.futebol/clube/<slug>.json só às que ele participa', () => {
    const snapshots = construirSnapshots(entradaFixture());
    const brasileiraoDoFlamengo = snapshots.futebolPorClube['flamengo']?.find(
      (c) => c.competicao.id === 'brasileirao-serie-a',
    );
    expect(brasileiraoDoFlamengo?.partidas).toHaveLength(2);
    expect(
      brasileiraoDoFlamengo?.partidas.every(
        (p) => p.mandanteId === 'flamengo' || p.visitanteId === 'flamengo',
      ),
    ).toBe(true);
  });

  it('determinismo: mesma entrada produz os mesmos 4 hashes de versao.json', () => {
    const entrada1 = entradaFixture();
    // Clone profundo (nova árvore de objetos, mesmo `Date` semântico) —
    // garante que o determinismo não depende de reaproveitar a mesma
    // referência de objeto entre as duas chamadas.
    const entrada2: EntradaSnapshots = {
      ...structuredClone(entrada1),
      agora: new Date(entrada1.agora.getTime()),
    };

    const snapshots1 = construirSnapshots(entrada1);
    const snapshots2 = construirSnapshots(entrada2);

    expect(snapshots2.versao.hashes).toEqual(snapshots1.versao.hashes);
    expect(snapshots2.versao.geradoEm).toEqual(snapshots1.versao.geradoEm);
    expect(JSON.stringify(snapshots2.noticias)).toEqual(
      JSON.stringify(snapshots1.noticias),
    );
    expect(JSON.stringify(snapshots2.futebolBrasileirao)).toEqual(
      JSON.stringify(snapshots1.futebolBrasileirao),
    );
  });

  it('config/zonas ausente (CA-18.2) produz configZonas null', () => {
    const entrada = entradaFixture();
    const snapshots = construirSnapshots({ ...entrada, zonas: null });
    expect(snapshots.configZonas).toBeNull();
    expect(snapshots.futebolBrasileirao.zonas).toEqual([]);
  });
});

// --- Camada de I/O, contra a configuração real do repositório ----------------

describe('gerarSnapshotsEmDisco — contrato completo em disco (config real)', () => {
  let dirTmp: string | undefined;

  afterEach(() => {
    if (dirTmp !== undefined) {
      rmSync(dirTmp, { recursive: true, force: true });
      dirTmp = undefined;
    }
  });

  function prepararEstado(): {
    caminhoEstadoNoticias: string;
    caminhoEstadoFutebol: string;
    caminhoStatus: string;
  } {
    dirTmp = mkdtempSync(join(tmpdir(), 'sportslm-pub02-'));
    const caminhoEstadoNoticias = join(dirTmp, 'estado', 'noticias.json');
    const caminhoEstadoFutebol = join(dirTmp, 'estado', 'futebol.json');
    const caminhoStatus = join(dirTmp, 'estado', 'ingestao', 'status.json');

    gravarEstadoNoticias(
      { itens: ITENS_NOTICIAS_FIXTURE, registrosPorFonte: {}, idsIngeridos: {} },
      caminhoEstadoNoticias,
    );
    gravarStatus(
      {
        geradoEm: AGORA.toISOString(),
        fontes: {},
        distribuicaoClassificacao: { futebol: 1, geral: 1 },
        gruposFormados: 0,
      },
      caminhoStatus,
    );

    const campeonatosReais = carregarCampeonatosDominio();
    const brasileirao = campeonatosReais.find((c) => c.id === 'brasileirao-serie-a');
    if (brasileirao === undefined) {
      throw new Error(
        'fixture: brasileirao-serie-a ausente de config/campeonatos-2026.json',
      );
    }
    const clubes = brasileirao.clubes;
    const linhas: LinhaClassificacao[] = clubes.map((clubeId, indice) => ({
      competicaoId: 'brasileirao-serie-a',
      grupo: null,
      posicao: indice + 1,
      clubeId,
      pontos: 0,
      jogos: 0,
      v: 0,
      e: 0,
      d: 0,
      gp: 0,
      gc: 0,
      sg: 0,
      aproveitamento: 0,
      ultimosCinco: [],
    }));
    const participacoes = clubes.map((clubeId) => ({
      competicaoId: 'brasileirao-serie-a',
      clubeId,
      status: 'nao-iniciado' as const,
      faseAtual: null,
      resultadoFinal: null,
      resumo: null,
    }));

    gravarEstadoFutebol(
      {
        competicoes: {
          'brasileirao-serie-a': {
            competicao: {
              id: 'brasileirao-serie-a',
              nome: brasileirao.nome,
              temporada: brasileirao.temporada,
              formato: brasileirao.formato,
              janela: brasileirao.janela,
              provedor: brasileirao.provedor,
              ultimaAtualizacao: AGORA.toISOString(),
            },
            linhas,
            partidas: [],
            participacoes,
          },
        },
      },
      caminhoEstadoFutebol,
    );
    gravarStatusFutebol(
      {
        geradoEm: AGORA.toISOString(),
        futebol: {
          'brasileirao-serie-a': {
            resultado: 'atualizada',
            ultimaAtualizacao: AGORA.toISOString(),
          },
        },
        provedores: { 'football-data-org': 2 },
        pausadoPorCota: false,
      },
      caminhoStatus,
    );

    return { caminhoEstadoNoticias, caminhoEstadoFutebol, caminhoStatus };
  }

  it('grava todos os arquivos do contrato do SDD §2.2 nos caminhos certos', () => {
    const { caminhoEstadoNoticias, caminhoEstadoFutebol, caminhoStatus } =
      prepararEstado();
    const dirSaida = join(dirTmp as string, 'dist-dados');

    const snapshots = gerarSnapshotsEmDisco({
      agora: AGORA,
      caminhoEstadoNoticias,
      caminhoEstadoFutebol,
      caminhoStatus,
      dirSaida,
    });

    for (const caminho of [
      'versao.json',
      'catalogo-fontes.json',
      'noticias.json',
      'futebol/brasileirao.json',
      'config/esportes.json',
      'config/clubes-2026.json',
      'config/campeonatos-2026.json',
      'ingestao/status.json',
      'futebol/clube/flamengo.json',
    ]) {
      expect(existsSync(join(dirSaida, ...caminho.split('/')))).toBe(true);
    }

    // RN-19 (12 fontes) e RN-04 (20 clubes) confirmados a partir da config real.
    expect(snapshots.catalogoFontes).toHaveLength(12);
    expect(snapshots.configClubes).toHaveLength(20);

    // CA-18.2: sem `config/zonas-2026.json` real publicado, nada é gerado.
    expect(existsSync(join(dirSaida, 'config', 'zonas-2026.json'))).toBe(false);
    expect(snapshots.configZonas).toBeNull();

    const versaoGravada = JSON.parse(
      readFileSync(join(dirSaida, 'versao.json'), 'utf8'),
    ) as unknown;
    expect(() => versaoPublicaSchema.parse(versaoGravada)).not.toThrow();
  });

  it('determinismo: gerar duas vezes a partir do mesmo estado produz bytes idênticos', () => {
    const { caminhoEstadoNoticias, caminhoEstadoFutebol, caminhoStatus } =
      prepararEstado();
    const dirSaida1 = join(dirTmp as string, 'saida-1');
    const dirSaida2 = join(dirTmp as string, 'saida-2');

    gerarSnapshotsEmDisco({
      agora: AGORA,
      caminhoEstadoNoticias,
      caminhoEstadoFutebol,
      caminhoStatus,
      dirSaida: dirSaida1,
    });
    gerarSnapshotsEmDisco({
      agora: AGORA,
      caminhoEstadoNoticias,
      caminhoEstadoFutebol,
      caminhoStatus,
      dirSaida: dirSaida2,
    });

    for (const caminho of [
      'versao.json',
      'catalogo-fontes.json',
      'noticias.json',
      'config/clubes-2026.json',
      'futebol/clube/flamengo.json',
    ]) {
      const conteudo1 = readFileSync(join(dirSaida1, ...caminho.split('/')), 'utf8');
      const conteudo2 = readFileSync(join(dirSaida2, ...caminho.split('/')), 'utf8');
      expect(conteudo2).toEqual(conteudo1);
    }
  });
});
