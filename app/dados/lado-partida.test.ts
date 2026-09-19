import { describe, expect, it } from 'vitest';
import type { Partida } from '../../dominio/tipos';
import type { ClubePublico } from './configPublico';
import { adversarioDe, resolverLado } from './lado-partida';

const clubes = [
  { id: 'flamengo', nome: 'Flamengo', nomeCurto: 'Fla' },
] as unknown as ClubePublico[];
const base = { mandanteId: 'flamengo', visitanteId: 'externo-134567' } as Partida;
const externa = {
  ...base,
  externo: { lado: 'visitante', nome: 'River Plate' },
} as Partida;

describe('resolverLado', () => {
  it('clube conhecido', () => {
    expect(resolverLado(externa, 'mandante', clubes)).toEqual({
      tipo: 'clube',
      clube: clubes[0],
    });
  });
  it('externo com nome e até 3 iniciais', () => {
    expect(resolverLado(externa, 'visitante', clubes)).toEqual({
      tipo: 'externo',
      nome: 'River Plate',
      iniciais: 'RP',
    });
    const p = {
      ...externa,
      externo: { lado: 'visitante', nome: 'Club Atletico Boca Juniors' },
    } as Partida;
    expect(resolverLado(p, 'visitante', clubes)).toMatchObject({ iniciais: 'CAB' });
  });
  it('id desconhecido sem externo cai no id, nunca externo-', () => {
    const p = { ...base, visitanteId: 'xyz' } as Partida;
    expect(resolverLado(p, 'visitante', clubes)).toEqual({
      tipo: 'externo',
      nome: 'xyz',
      iniciais: 'X',
    });
    const q = { ...base } as Partida;
    const r = resolverLado(q, 'visitante', clubes);
    expect(r.tipo === 'externo' && r.nome.startsWith('externo-')).toBe(false);
  });
});

describe('adversarioDe', () => {
  it('mando correto', () => {
    expect(adversarioDe(externa, 'flamengo')).toMatchObject({
      mando: 'visitante',
      lado: { tipo: 'externo', nome: 'River Plate' },
    });
    const p = {
      ...externa,
      mandanteId: 'externo-1',
      visitanteId: 'flamengo',
      externo: { lado: 'mandante', nome: 'X' },
    } as Partida;
    expect(adversarioDe(p, 'flamengo')).toMatchObject({ mando: 'mandante' });
    expect(adversarioDe(p, 'outro')).toBeNull();
  });
});
