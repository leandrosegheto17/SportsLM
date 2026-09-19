import { describe, expect, it } from 'vitest';
import type { Partida } from '../../dominio/tipos/futebol';
import { mesclarPartidas } from './mesclar-partidas';

const p = (id: string, o: Partial<Partida> = {}): Partida => ({
  id,
  competicaoId: 'paulista',
  rodada: null,
  fase: null,
  mandanteId: 'a',
  visitanteId: 'b',
  dataHora: '2026-03-01T20:00:00Z',
  horarioDefinido: true,
  estadio: null,
  status: 'agendada',
  placar: null,
  ...o,
});
const fin = { status: 'finalizada' as const, placar: { mandante: 1, visitante: 0 } };

describe('mesclarPartidas', () => {
  it('nova finalizada vence agendada', () => {
    expect(mesclarPartidas([p('1')], [p('1', fin)])[0]?.status).toBe('finalizada');
  });
  it('nova agendada não regride finalizada', () => {
    const r = mesclarPartidas([p('1', fin)], [p('1')]);
    expect(r[0]?.status).toBe('finalizada');
    expect(r[0]?.placar).toEqual({ mandante: 1, visitante: 0 });
  });
  it('partida sumida é mantida', () => {
    expect(mesclarPartidas([p('1')], [p('2')]).map((x) => x.id)).toEqual(['1', '2']);
  });
  it('data alterada (adiada) vence', () => {
    const r = mesclarPartidas([p('1')], [p('1', { status: 'adiada', dataHora: null })]);
    expect(r[0]).toMatchObject({ status: 'adiada', dataHora: null });
  });
  it('ids duplicados nas novas: a última vence', () => {
    const r = mesclarPartidas([], [p('1'), p('1', { estadio: 'X' })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.estadio).toBe('X');
  });
  it('ordena por data, null por último, depois id', () => {
    const r = mesclarPartidas(
      [],
      [
        p('c', { dataHora: null }),
        p('b', { dataHora: '2026-03-02T00:00:00Z' }),
        p('a'),
        p('0'),
      ],
    );
    expect(r.map((x) => x.id)).toEqual(['0', 'a', 'b', 'c']);
  });
  it('idempotente', () => {
    const ant = [p('1', fin)];
    const nov = [p('1'), p('2')];
    const um = mesclarPartidas(ant, nov);
    expect(mesclarPartidas(um, nov)).toEqual(um);
  });
  it('não muta entradas', () => {
    const ant = [p('1')];
    const nov = [p('1', fin)];
    const a = structuredClone(ant);
    const n = structuredClone(nov);
    mesclarPartidas(ant, nov);
    expect(ant).toEqual(a);
    expect(nov).toEqual(n);
  });
});
