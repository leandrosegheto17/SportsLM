// dominio/campeonatos/ordenacao.test.ts — DOM-04 (TASK.md Lote 3)
//
// Testes por tabela cobrindo CA-07.4 (TASK.md §1, diretriz 11).

import { describe, expect, it } from 'vitest';
import { ordenarCampeonatos, type CampeonatoOrdenavel } from './ordenacao';

describe('ordenarCampeonatos (CA-07.4)', () => {
  it('ordena em-andamento → não-iniciado → eliminado → concluído → sem-dados', () => {
    const entrada: CampeonatoOrdenavel[] = [
      { id: 'sem-dados-1', status: 'sem-dados', proximoJogoDataHora: null },
      { id: 'concluido-1', status: 'concluido', proximoJogoDataHora: null },
      { id: 'eliminado-1', status: 'eliminado', proximoJogoDataHora: null },
      { id: 'nao-iniciado-1', status: 'nao-iniciado', proximoJogoDataHora: null },
      {
        id: 'em-andamento-1',
        status: 'em-andamento',
        proximoJogoDataHora: '2026-09-10T20:00:00-03:00',
      },
    ];

    const resultado = ordenarCampeonatos(entrada).map((c) => c.id);

    expect(resultado).toEqual([
      'em-andamento-1',
      'nao-iniciado-1',
      'eliminado-1',
      'concluido-1',
      'sem-dados-1',
    ]);
  });

  it('dentro de em-andamento, ordena pela data do próximo jogo (mais próxima primeiro)', () => {
    const entrada: CampeonatoOrdenavel[] = [
      {
        id: 'daqui-30-dias',
        status: 'em-andamento',
        proximoJogoDataHora: '2026-10-06T20:00:00-03:00',
      },
      {
        id: 'amanha',
        status: 'em-andamento',
        proximoJogoDataHora: '2026-09-07T16:00:00-03:00',
      },
      {
        id: 'hoje',
        status: 'em-andamento',
        proximoJogoDataHora: '2026-09-06T21:30:00-03:00',
      },
    ];

    const resultado = ordenarCampeonatos(entrada).map((c) => c.id);

    expect(resultado).toEqual(['hoje', 'amanha', 'daqui-30-dias']);
  });

  it('em-andamento sem próxima data conhecida vai para o fim do próprio grupo, nunca para o topo', () => {
    const entrada: CampeonatoOrdenavel[] = [
      { id: 'sem-data', status: 'em-andamento', proximoJogoDataHora: null },
      {
        id: 'com-data',
        status: 'em-andamento',
        proximoJogoDataHora: '2026-09-08T19:00:00-03:00',
      },
    ];

    const resultado = ordenarCampeonatos(entrada).map((c) => c.id);

    expect(resultado).toEqual(['com-data', 'sem-data']);
  });

  it('duas ausências de data em em-andamento preservam a ordem de entrada (estável)', () => {
    const entrada: CampeonatoOrdenavel[] = [
      { id: 'primeiro-sem-data', status: 'em-andamento', proximoJogoDataHora: null },
      { id: 'segundo-sem-data', status: 'em-andamento', proximoJogoDataHora: null },
    ];

    const resultado = ordenarCampeonatos(entrada).map((c) => c.id);

    expect(resultado).toEqual(['primeiro-sem-data', 'segundo-sem-data']);
  });

  it('preserva a ordem de entrada dentro de não-iniciado/eliminado/concluído/sem-dados (ordenação estável)', () => {
    const entrada: CampeonatoOrdenavel[] = [
      { id: 'nao-iniciado-b', status: 'nao-iniciado', proximoJogoDataHora: null },
      { id: 'nao-iniciado-a', status: 'nao-iniciado', proximoJogoDataHora: null },
      { id: 'concluido-b', status: 'concluido', proximoJogoDataHora: null },
      { id: 'concluido-a', status: 'concluido', proximoJogoDataHora: null },
    ];

    const resultado = ordenarCampeonatos(entrada).map((c) => c.id);

    expect(resultado).toEqual([
      'nao-iniciado-b',
      'nao-iniciado-a',
      'concluido-b',
      'concluido-a',
    ]);
  });

  it('lista vazia retorna lista vazia', () => {
    expect(ordenarCampeonatos([])).toEqual([]);
  });

  it('não muta a lista recebida (função pura)', () => {
    const entrada: CampeonatoOrdenavel[] = [
      { id: 'sem-dados-1', status: 'sem-dados', proximoJogoDataHora: null },
      {
        id: 'em-andamento-1',
        status: 'em-andamento',
        proximoJogoDataHora: '2026-09-10T20:00:00-03:00',
      },
    ];
    const copiaOriginal = [...entrada];

    ordenarCampeonatos(entrada);

    expect(entrada).toEqual(copiaOriginal);
  });

  it('caso realista de CA-07.3: eliminado fica depois de não-iniciado, com sua data do último jogo irrelevante para a ordenação', () => {
    const entrada: CampeonatoOrdenavel[] = [
      { id: 'eliminado-copa-do-brasil', status: 'eliminado', proximoJogoDataHora: null },
      {
        id: 'nao-iniciado-libertadores',
        status: 'nao-iniciado',
        proximoJogoDataHora: null,
      },
      {
        id: 'em-andamento-brasileirao',
        status: 'em-andamento',
        proximoJogoDataHora: '2026-09-13T18:30:00-03:00',
      },
    ];

    const resultado = ordenarCampeonatos(entrada).map((c) => c.id);

    expect(resultado).toEqual([
      'em-andamento-brasileirao',
      'nao-iniciado-libertadores',
      'eliminado-copa-do-brasil',
    ]);
  });
});
