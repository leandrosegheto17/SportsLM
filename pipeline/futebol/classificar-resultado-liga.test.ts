import { describe, expect, it } from 'vitest';
import { classificarResultadoLiga } from './classificar-resultado-liga';

const linha = { x: 1 } as never;
const partida = { x: 1 } as never;

describe('classificarResultadoLiga', () => {
  it('eventos e tabela vazios => sem-dados-provedor', () => {
    expect(classificarResultadoLiga({ linhas: [], partidas: [], descartes: [] })).toBe(
      'sem-dados-provedor',
    );
  });
  it('só partidas => atualizada', () => {
    expect(classificarResultadoLiga({ linhas: [], partidas: [partida], descartes: [] })).toBe(
      'atualizada',
    );
  });
  it('só tabela => atualizada', () => {
    expect(classificarResultadoLiga({ linhas: [linha], partidas: [], descartes: [] })).toBe(
      'atualizada',
    );
  });
  it('só descartes fora-do-recorte => atualizada (provedor cobre a liga)', () => {
    expect(
      classificarResultadoLiga({
        linhas: [],
        partidas: [],
        descartes: [{ motivo: 'fora-do-recorte' }],
      }),
    ).toBe('atualizada');
  });
});
