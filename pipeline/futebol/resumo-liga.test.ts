import { describe, expect, it } from 'vitest';
import { linhaLogLiga, montarResumoLiga } from './resumo-liga';
import type { InconsistenciaPartida } from './adaptador-football-data';

const inc: InconsistenciaPartida[] = [
  {
    tipo: 'clube-nao-mapeado',
    competicaoId: 'x',
    idProvedor: 1,
    nomeProvedorDiagnostico: 'A',
    contexto: 'c',
  },
  {
    tipo: 'clube-nao-mapeado',
    competicaoId: 'x',
    idProvedor: 2,
    nomeProvedorDiagnostico: 'B',
    contexto: 'c',
  },
  {
    tipo: 'partida-status-desconhecido',
    competicaoId: 'x',
    idPartidaProvedor: 1,
    statusBrutoDiagnostico: 'ZZ',
    contexto: 'c',
  },
  {
    tipo: 'clube-serie-a-sem-id',
    competicaoId: 'x',
    idProvedor: '9',
    nomeProvedorDiagnostico: 'C',
    contexto: 'c',
  },
  {
    tipo: 'partida-invalida',
    competicaoId: 'x',
    idPartidaProvedor: '3',
    motivo: 'm',
    contexto: 'c',
  },
];

describe('montarResumoLiga', () => {
  it('sem descartes: zera todos os motivos', () => {
    const r = montarResumoLiga({
      partidas: 5,
      requisicoes: 2,
      foraDoRecorte: 0,
      inconsistencias: [],
    });
    expect(r).toEqual({
      partidas: 5,
      requisicoes: 2,
      descartes: {
        'fora-do-recorte': 0,
        'clube-serie-a-sem-id': 0,
        'clube-nao-mapeado': 0,
        'status-desconhecido': 0,
        'nome-externo-invalido': 0,
      },
    });
  });

  it('conta cada motivo e fora-do-recorte', () => {
    const r = montarResumoLiga({
      partidas: 3,
      requisicoes: 1,
      foraDoRecorte: 4,
      inconsistencias: inc,
    });
    expect(r.descartes).toEqual({
      'fora-do-recorte': 4,
      'clube-serie-a-sem-id': 1,
      'clube-nao-mapeado': 2,
      'status-desconhecido': 1,
      'nome-externo-invalido': 1,
    });
  });

  it('partidas + descartes de partida = eventos recebidos', () => {
    const r = montarResumoLiga({
      partidas: 3,
      requisicoes: 1,
      foraDoRecorte: 4,
      inconsistencias: inc,
    });
    const d = r.descartes;
    const total =
      r.partidas +
      d['fora-do-recorte'] +
      d['clube-serie-a-sem-id'] +
      d['status-desconhecido'] +
      d['nome-externo-invalido'];
    expect(total).toBe(3 + 4 + 1 + 1 + 1);
  });
});

describe('linhaLogLiga', () => {
  const resumo = montarResumoLiga({
    partidas: 3,
    requisicoes: 1,
    foraDoRecorte: 4,
    inconsistencias: inc,
  });
  const args = {
    horario: new Date('2026-09-18T10:00:00Z'),
    liga: 'paulista',
    resultado: 'ok',
    resumo,
  };

  it('é determinística e traz horário, liga, resultado e contagens', () => {
    const l = linhaLogLiga(args);
    expect(l).toBe(linhaLogLiga(args));
    expect(l).toContain('2026-09-18T10:00:00.000Z');
    expect(l).toContain('liga=paulista');
    expect(l).toContain('resultado=ok');
    expect(l).toContain('partidas=3');
    expect(l).toContain('requisicoes=1');
    expect(l).toContain('fora-do-recorte=4');
    expect(l).not.toMatch(/\n/);
  });

  it('não vaza token, corpo nem nomes do provedor', () => {
    const l = linhaLogLiga(args);
    expect(l).not.toMatch(/token|body|corpo|ZZ/i);
    expect(l).not.toContain('A ');
  });
});
