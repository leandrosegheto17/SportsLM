import { describe, expect, it, vi } from 'vitest';
import {
  avaliarCatalogoOnboarding,
  construirCatalogoOnboarding,
} from './catalogoOnboarding';

const ESPORTE_VALIDO = { id: 'futebol', nome: 'Futebol', ordem: 1 };

function brutosValidos() {
  return {
    esportes: Array.from({ length: 15 }, (_, indice) => ({
      id: [
        'futebol',
        'volei-quadra',
        'formula1',
        'basquete',
        'tenis',
        'volei-praia',
        'natacao',
        'mma',
        'ginastica-artistica',
        'surfe',
        'skate',
        'judo',
        'atletismo',
        'futsal',
        'futebol-americano',
      ][indice],
      nome: `Esporte ${String(indice + 1)}`,
      ordem: indice + 1,
    })),
    fontes: [{ id: 'ge' }, { id: 'espn-brasil' }],
    clubes: [
      { id: 'flamengo', nomeCurto: 'Flamengo', sigla: 'FLA', corBase: '#E2231A' },
      { id: 'palmeiras', nomeCurto: 'Palmeiras', sigla: 'PAL', corBase: '#006437' },
    ],
    campeonatos: { temporada: 2026 },
  };
}

describe('avaliarCatalogoOnboarding (apoio a UI-T01-01)', () => {
  it('monta o catálogo quando os 4 arquivos são válidos', () => {
    const catalogo = avaliarCatalogoOnboarding(brutosValidos());

    expect(catalogo).not.toBeNull();
    expect(catalogo?.esportes).toHaveLength(15);
    expect(catalogo?.esportes[0]).toEqual(
      expect.objectContaining({ id: 'futebol', nome: 'Esporte 1' }),
    );
    expect(catalogo?.referencias.esportesValidos.has('futebol')).toBe(true);
    expect(catalogo?.referencias.fontesValidas.has('ge')).toBe(true);
    expect(catalogo?.referencias.clubesValidos.has('flamengo')).toBe(true);
    expect(catalogo?.temporadaAtual).toBe(2026);
    expect(catalogo?.clubes).toHaveLength(2);
    expect(catalogo?.clubes[0]).toEqual(
      expect.objectContaining({ id: 'flamengo', nomeCurto: 'Flamengo', sigla: 'FLA' }),
    );
  });

  it('retorna null (nunca lança) quando os esportes não batem com a Seção 2A (RN-06)', () => {
    const avisar = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const catalogo = avaliarCatalogoOnboarding({
      ...brutosValidos(),
      esportes: [ESPORTE_VALIDO], // só 1 de 15 — esquema exige os 15 ids
    });

    expect(catalogo).toBeNull();
    expect(avisar).toHaveBeenCalled();
    avisar.mockRestore();
  });

  it('retorna null quando a lista de clubes não tem o formato esperado', () => {
    const avisar = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const catalogo = avaliarCatalogoOnboarding({
      ...brutosValidos(),
      clubes: 'não é uma lista',
    });

    expect(catalogo).toBeNull();
    avisar.mockRestore();
  });

  it('retorna null quando a temporada não é um número', () => {
    const avisar = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const catalogo = avaliarCatalogoOnboarding({
      ...brutosValidos(),
      campeonatos: { temporada: '2026' },
    });

    expect(catalogo).toBeNull();
    avisar.mockRestore();
  });
});

describe('construirCatalogoOnboarding (configuração real do projeto)', () => {
  it('monta o catálogo a partir de config/esportes|fontes|clubes-2026|campeonatos-2026.json', () => {
    const catalogo = construirCatalogoOnboarding();

    expect(catalogo).not.toBeNull();
    expect(catalogo?.esportes).toHaveLength(15);
    expect(catalogo?.temporadaAtual).toBe(2026);
    expect(catalogo?.referencias.esportesValidos.size).toBe(15);
    expect(catalogo?.referencias.clubesValidos.size).toBe(20);
    expect(catalogo?.clubes).toHaveLength(20);
  });
});
