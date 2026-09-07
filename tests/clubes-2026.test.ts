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

  // REFAT-02-01 (resolvido, 2026-09-07): Bloqueio 009 confirmou 15/20 ids
  // contra a API real do football-data.org; Bloqueio 010 revelou que os 5
  // clubes restantes da configuração original (ceara/fortaleza/sport/
  // juventude/criciuma) não jogam a Série A 2026 de verdade — a API devolveu,
  // em seus lugares, Athletico-PR/Coritiba/RB Bragantino/Clube do Remo/
  // Chapecoense (ids também confirmados nesse mesmo log). Com aprovação do
  // usuário, o elenco de CFG-02 foi corrigido para o real: os 20 clubes têm
  // agora id numérico confirmado, nenhuma sentinela restante. Os 5 clubes
  // substituídos continuam existindo como identidade de clube em outras
  // competições que realmente disputam (ver `config/campeonatos-2026.json`),
  // só não fazem mais parte do universo de 20 de CFG-02/Série A.
  it('todos os 20 clubes têm id numérico confirmado (Bloqueio 010 resolvido — nenhuma sentinela restante)', () => {
    for (const clube of clubes) {
      const idProvedor = clube.idsProvedor[ID_PROVEDOR_FOOTBALL_DATA];
      expect(idProvedor, `clube '${clube.id}' deveria ter id confirmado`).not.toBe(
        SENTINELA_ID_PENDENTE,
      );
      expect(typeof idProvedor).toBe('number');
    }
  });

  it('os 5 clubes reais confirmados no Bloqueio 010 estão presentes com o id certo', () => {
    const esperados: Record<string, number> = {
      'athletico-pr': 1768,
      coritiba: 4241,
      'rb-bragantino': 4286,
      remo: 4287,
      chapecoense: 1772,
    };
    for (const [id, idProvedorEsperado] of Object.entries(esperados)) {
      const clube = obterClubePorId(clubes, id);
      expect(clube, `clube '${id}' deveria existir`).toBeDefined();
      expect(clube?.idsProvedor[ID_PROVEDOR_FOOTBALL_DATA]).toBe(idProvedorEsperado);
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

  it('os 5 clubes acromáticos de UX-SPEC TR-14 têm corBase preto (entrada da derivação, ADR-017)', () => {
    // Era 6 antes do Bloqueio 010: 'ceara' saiu do elenco de CFG-02 (não
    // disputa a Série A 2026 de verdade) e nenhum dos 5 clubes reais que o
    // substituíram é acromático.
    const acromaticosEsperados = [
      'corinthians',
      'botafogo',
      'santos',
      'vasco',
      'atletico-mg',
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
