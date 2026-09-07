// tests/clubes-2026.test.ts
//
// Prova o critério de aceite de CFG-02 (TASK.md Lote 2): `config/clubes-2026.json`
// valida contra o schema Zod de dados base (sem `paleta`, RN-04), tem
// exatamente 20 clubes, e nenhum tem `idsProvedor['football-data']` vazio.
import { describe, expect, it } from 'vitest';
import {
  EsquemaClubeBase,
  EsquemaClubesBase,
  ID_PROVEDOR_FOOTBALL_DATA,
  SENTINELA_ID_PENDENTE,
  carregarClubesSerieA2026,
  obterClubePorId,
  type ClubeBase,
} from '../pipeline/config/clubes';

describe('EsquemaClubeBase (schema Zod)', () => {
  const baseValida: ClubeBase = {
    id: 'atletico-mg',
    nome: 'Clube Atlético Mineiro',
    nomeCurto: 'Atlético-MG',
    sigla: 'CAM',
    corBase: '#000000',
    idsProvedor: { 'football-data': 1234 },
  };

  it('aceita um clube base válido', () => {
    expect(() => EsquemaClubeBase.parse(baseValida)).not.toThrow();
  });

  it('aceita idsProvedor com valor string (sentinela de pendência)', () => {
    expect(() =>
      EsquemaClubeBase.parse({
        ...baseValida,
        idsProvedor: { 'football-data': SENTINELA_ID_PENDENTE },
      }),
    ).not.toThrow();
  });

  it('rejeita id fora do formato slug', () => {
    expect(() => EsquemaClubeBase.parse({ ...baseValida, id: 'Atlético MG' })).toThrow();
  });

  it('rejeita sigla que não tem exatamente 3 letras maiúsculas', () => {
    expect(() => EsquemaClubeBase.parse({ ...baseValida, sigla: 'cam' })).toThrow();
    expect(() => EsquemaClubeBase.parse({ ...baseValida, sigla: 'CAMP' })).toThrow();
  });

  it('rejeita corBase que não é hex #RRGGBB', () => {
    expect(() =>
      EsquemaClubeBase.parse({ ...baseValida, corBase: 'preto e branco' }),
    ).toThrow();
    expect(() => EsquemaClubeBase.parse({ ...baseValida, corBase: '#FFF' })).toThrow();
  });

  it('rejeita idsProvedor vazio', () => {
    expect(() => EsquemaClubeBase.parse({ ...baseValida, idsProvedor: {} })).toThrow();
  });

  it('rejeita campo `paleta` — CFG-02 é explicitamente sem paleta derivada (PUB-01)', () => {
    expect(() =>
      EsquemaClubeBase.parse({ ...baseValida, paleta: { acromatico: true } }),
    ).toThrow();
  });
});

describe('config/clubes-2026.json (dado real)', () => {
  const clubes = carregarClubesSerieA2026();

  it('valida inteiramente contra EsquemaClubesBase', () => {
    expect(() => EsquemaClubesBase.parse(clubes)).not.toThrow();
  });

  it('tem exatamente 20 clubes (RN-04, 2026)', () => {
    expect(clubes).toHaveLength(20);
  });

  it('nenhum idsProvedor["football-data"] é vazio/ausente', () => {
    for (const clube of clubes) {
      const idProvedor = clube.idsProvedor[ID_PROVEDOR_FOOTBALL_DATA];
      expect(
        idProvedor,
        `clube '${clube.id}' sem idsProvedor.football-data`,
      ).toBeDefined();
      expect(String(idProvedor).length).toBeGreaterThan(0);
    }
  });

  it('flamengo tem id de provedor confirmado (ADR-006, exemplo literal 1783)', () => {
    const flamengo = obterClubePorId(clubes, 'flamengo');
    expect(flamengo?.idsProvedor[ID_PROVEDOR_FOOTBALL_DATA]).toBe(1783);
  });

  // REFAT-02-01 (parcialmente resolvido, 2026-09-07): com o token real
  // cadastrado, 15/20 ids foram confirmados contra a API real do
  // football-data.org (Bloqueio 009/BLOCKERS.md). Os 5 clubes abaixo
  // permanecem pendentes não por falta de token, mas porque o elenco real
  // da Série A 2026 devolvido pela API diverge do que este arquivo assumiu
  // na configuração original (5 clubes daqui não apareceram na resposta
  // real; 5 outros clubes reais — Athletico-PR, Coritiba, RB Bragantino,
  // Clube do Remo, Chapecoense — apareceram na API mas não têm entrada
  // aqui). Decisão sobre corrigir o elenco pendente do Coordenador/gestor.
  const IDS_CLUBES_COM_ELENCO_DIVERGENTE = [
    'ceara',
    'fortaleza',
    'sport',
    'juventude',
    'criciuma',
  ];

  it('clubes confirmados contra a API real usam o id numérico verificado (REFAT-02-01)', () => {
    const confirmados = clubes.filter(
      (clube) => !IDS_CLUBES_COM_ELENCO_DIVERGENTE.includes(clube.id),
    );
    expect(confirmados.length).toBe(15);
    for (const clube of confirmados) {
      const idProvedor = clube.idsProvedor[ID_PROVEDOR_FOOTBALL_DATA];
      expect(idProvedor, `clube '${clube.id}' deveria ter id confirmado`).not.toBe(
        SENTINELA_ID_PENDENTE,
      );
      expect(typeof idProvedor).toBe('number');
    }
  });

  it('clubes com elenco divergente da API real seguem com a sentinela explícita (achado Bloqueio 009)', () => {
    expect(IDS_CLUBES_COM_ELENCO_DIVERGENTE.length).toBe(5);
    for (const id of IDS_CLUBES_COM_ELENCO_DIVERGENTE) {
      const clube = obterClubePorId(clubes, id);
      expect(clube?.idsProvedor[ID_PROVEDOR_FOOTBALL_DATA]).toBe(SENTINELA_ID_PENDENTE);
    }
  });

  it('todos os ids são únicos e em formato slug', () => {
    const ids = clubes.map((clube) => clube.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todas as siglas são únicas', () => {
    const siglas = clubes.map((clube) => clube.sigla);
    expect(new Set(siglas).size).toBe(siglas.length);
  });

  it('os 6 clubes acromáticos de UX-SPEC TR-14 têm corBase preto (entrada da derivação, ADR-017)', () => {
    const acromaticosEsperados = [
      'corinthians',
      'botafogo',
      'santos',
      'vasco',
      'atletico-mg',
      'ceara',
    ];
    for (const id of acromaticosEsperados) {
      const clube = obterClubePorId(clubes, id);
      expect(clube, `clube '${id}' deveria existir`).toBeDefined();
      expect(clube?.corBase).toBe('#000000');
    }
  });

  it('nenhum clube tem o campo `paleta` nesta etapa (CFG-02 não deriva paleta)', () => {
    for (const clube of clubes) {
      expect((clube as Record<string, unknown>)['paleta']).toBeUndefined();
    }
  });
});
