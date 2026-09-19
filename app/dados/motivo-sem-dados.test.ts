import { describe, expect, it } from 'vitest';
import { frescorDaCompeticao, motivoSemDados } from './motivo-sem-dados';

const janela = { inicio: '2026-03-03T12:00:00Z', fim: '2026-11-30T00:00:00Z' };
const dentro = new Date('2026-06-01T12:00:00Z');

describe('motivoSemDados (UX-SPEC T-05)', () => {
  const m = (resultado: string | null | undefined, temDado = false, agora = dentro) =>
    motivoSemDados({ resultado, janela, agora, temDado });
  it('textos canônicos', () => {
    for (const r of ['sem-cobertura', 'sem-dados-provedor', 'provedor-nao-registrado'])
      expect(m(r)).toBe('Cobertura indisponível nesta versão.');
    expect(m('fora-da-janela')).toBe('Fora da janela da competição.');
    expect(m('fora-da-janela', false, new Date('2026-01-10T12:00:00Z'))).toBe(
      'Fora da janela da competição. Começa em 03/03.',
    );
    expect(m('pausado-por-cota')).toBe('Atualização pausada por limite do provedor.');
    expect(m('falha')).toBe('Falha na última atualização.');
    expect(m('inconsistente')).toBe('Falha na última atualização.');
    expect(m(null)).toBe('Sem dados disponíveis no momento');
  });
  it('desconhecido não lança e vira falha', () => {
    expect(m('xpto')).toBe('Falha na última atualização.');
  });
  it('com dado não vira sem dados', () => {
    expect(m('falha', true)).toBeNull();
  });
});

describe('frescorDaCompeticao', () => {
  const f = (o: Partial<Parameters<typeof frescorDaCompeticao>[0]>) =>
    frescorDaCompeticao({
      ultimaAtualizacao: '2026-06-01T11:00:00Z',
      janela,
      agora: dentro,
      temJogoProximo: false,
      ...o,
    });
  it('nunca', () => expect(f({ ultimaAtualizacao: null })).toBe('nunca'));
  it('normal e alerta 2h/12h', () => {
    expect(f({})).toBe('normal');
    expect(f({ ultimaAtualizacao: '2026-06-01T09:00:00Z', temJogoProximo: true })).toBe(
      'alerta',
    );
    expect(f({ ultimaAtualizacao: '2026-06-01T09:00:00Z' })).toBe('normal');
    expect(f({ ultimaAtualizacao: '2026-05-31T23:00:00Z' })).toBe('alerta');
  });
  it('encerrada nunca em alerta', () => {
    expect(
      f({
        agora: new Date('2026-12-15T00:00:00Z'),
        ultimaAtualizacao: '2026-11-30T00:00:00Z',
      }),
    ).toBe('encerrada');
  });
  it('pausado e falha', () => {
    expect(f({ resultado: 'pausado-por-cota' })).toBe('pausado');
    expect(f({ resultado: 'falha' })).toBe('falha');
    expect(f({ resultado: 'inconsistente' })).toBe('falha');
    expect(f({ resultado: 'xpto' })).toBe('falha');
    expect(f({ resultado: 'atualizada' })).toBe('normal');
  });
});
