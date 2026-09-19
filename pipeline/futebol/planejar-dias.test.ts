import { describe, expect, it } from 'vitest';
import { planejarDias } from './planejar-dias';

const hoje = new Date('2026-09-18T15:00:00Z');

describe('planejarDias', () => {
  it('faixa 1 sem âncoras devolve o trio', () => {
    expect(
      planejarDias({ hoje, proximoEvento: null, ultimoEvento: null, faixa: 1 }),
    ).toEqual(['2026-09-17', '2026-09-18', '2026-09-19']);
  });
  it('âncora dentro do trio é deduplicada', () => {
    expect(
      planejarDias({
        hoje,
        proximoEvento: '2026-09-19',
        ultimoEvento: '2026-09-17',
        faixa: 1,
      }),
    ).toHaveLength(3);
  });
  it('âncoras fora do trio somam 5, ordenadas', () => {
    expect(
      planejarDias({
        hoje,
        proximoEvento: '2026-09-25',
        ultimoEvento: '2026-09-10',
        faixa: 1,
      }),
    ).toEqual(['2026-09-10', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-25']);
  });
  it('virada de mês e ano', () => {
    expect(
      planejarDias({
        hoje: new Date('2026-12-31T23:00:00Z'),
        proximoEvento: null,
        ultimoEvento: null,
        faixa: 1,
      }),
    ).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
    expect(
      planejarDias({
        hoje: new Date('2026-03-01T00:00:00Z'),
        proximoEvento: null,
        ultimoEvento: null,
        faixa: 1,
      })[0],
    ).toBe('2026-02-28');
  });
  it('faixa 2 só âncoras não cobertas', () => {
    expect(
      planejarDias({
        hoje,
        proximoEvento: '2026-10-01',
        ultimoEvento: '2026-09-10',
        faixa: 2,
        diasCobertos: ['2026-09-10'],
      }),
    ).toEqual(['2026-10-01']);
    expect(
      planejarDias({ hoje, proximoEvento: null, ultimoEvento: null, faixa: 2 }),
    ).toEqual([]);
  });
  it('ignora âncora malformada e não muta entrada', () => {
    const cobertos = ['2026-09-10'];
    const entrada = {
      hoje,
      proximoEvento: 'lixo',
      ultimoEvento: '2026-09-10',
      faixa: 2 as const,
      diasCobertos: cobertos,
    };
    planejarDias(entrada);
    expect(cobertos).toEqual(['2026-09-10']);
    expect(planejarDias(entrada)).toEqual([]);
    expect(hoje.toISOString()).toBe('2026-09-18T15:00:00.000Z');
  });
});
