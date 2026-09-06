// dominio/frescor.test.ts — DOM-06 (TASK.md Lote 3)
//
// Testes por tabela cobrindo CA-17.1 (texto "atualizado há <tempo>"), CA-17.2
// (carimbo em alerta ao exceder RN-09, 2× o intervalo) e CA-17.5 (carimbos
// independentes por conjunto). Relógio sempre por parâmetro — nenhum teste
// usa `Date.now()`.

import { describe, expect, it } from 'vitest';
import {
  calcularFrescor,
  calcularLimiteAlertaMinutos,
  estaEmAlerta,
  formatarAtualizadoHa,
} from './frescor';

const AGORA = new Date('2026-09-06T12:00:00-03:00');

function minutosAtras(min: number): Date {
  return new Date(AGORA.getTime() - min * 60_000);
}

describe('formatarAtualizadoHa (CA-17.1)', () => {
  it.each([
    { descricao: 'agora mesmo (< 1s)', geradoEm: AGORA, esperado: 'atualizado agora' },
    {
      descricao: '1 minuto atrás',
      geradoEm: minutosAtras(1),
      esperado: 'atualizado há 1 minuto',
    },
    {
      descricao: '12 minutos atrás',
      geradoEm: minutosAtras(12),
      esperado: 'atualizado há 12 minutos',
    },
    {
      descricao: '59 minutos atrás',
      geradoEm: minutosAtras(59),
      esperado: 'atualizado há 59 minutos',
    },
    {
      descricao: '1 hora atrás',
      geradoEm: minutosAtras(60),
      esperado: 'atualizado há 1 hora',
    },
    {
      descricao: '2 horas atrás',
      geradoEm: minutosAtras(120),
      esperado: 'atualizado há 2 horas',
    },
    {
      descricao: '23 horas atrás (ainda não fecha 1 dia)',
      geradoEm: minutosAtras(23 * 60),
      esperado: 'atualizado há 23 horas',
    },
    {
      descricao: '1 dia atrás',
      geradoEm: minutosAtras(24 * 60),
      esperado: 'atualizado há 1 dia',
    },
    {
      descricao: '3 dias atrás',
      geradoEm: minutosAtras(3 * 24 * 60),
      esperado: 'atualizado há 3 dias',
    },
  ])('$descricao → "$esperado"', ({ geradoEm, esperado }) => {
    expect(formatarAtualizadoHa(AGORA, geradoEm)).toBe(esperado);
  });

  it('trata geradoEm no futuro (relógio do dado adiantado) como "agora", nunca "daqui a"', () => {
    const noFuturo = new Date(AGORA.getTime() + 5 * 60_000);
    expect(formatarAtualizadoHa(AGORA, noFuturo)).toBe('atualizado agora');
  });
});

describe('calcularLimiteAlertaMinutos (RN-09: 2× o intervalo)', () => {
  it.each([
    { intervaloMinutos: 30, esperado: 60 }, // notícias (SDD §5)
    { intervaloMinutos: 60, esperado: 120 }, // futebol, dia de jogo (SDD §5)
    { intervaloMinutos: 360, esperado: 720 }, // futebol, fora de dia de jogo (SDD §5)
  ])(
    'intervalo de $intervaloMinutos min → limite de $esperado min',
    ({ intervaloMinutos, esperado }) => {
      expect(calcularLimiteAlertaMinutos(intervaloMinutos)).toBe(esperado);
    },
  );
});

describe('estaEmAlerta (CA-17.2, RN-09)', () => {
  it.each([
    {
      descricao: 'dentro do intervalo normal',
      minutosDesdeAtualizacao: 10,
      intervaloMinutos: 30,
      esperado: false,
    },
    {
      descricao:
        'exatamente no limite de 2× (RN-09) ainda não é alerta ("passou de", SDD §2.5)',
      minutosDesdeAtualizacao: 60,
      intervaloMinutos: 30,
      esperado: false,
    },
    {
      descricao: 'passou de 2× o intervalo → alerta',
      minutosDesdeAtualizacao: 61,
      intervaloMinutos: 30,
      esperado: true,
    },
    {
      descricao:
        'futebol em dia de jogo (intervalo 1h): 1h50 ainda não excede 2h de limite',
      minutosDesdeAtualizacao: 110,
      intervaloMinutos: 60,
      esperado: false,
    },
    {
      descricao: 'futebol em dia de jogo (intervalo 1h): 2h05 excede o limite de 2h',
      minutosDesdeAtualizacao: 125,
      intervaloMinutos: 60,
      esperado: true,
    },
    {
      descricao:
        'futebol fora de dia de jogo (intervalo 6h): 11h59 ainda não excede o limite de 12h',
      minutosDesdeAtualizacao: 11 * 60 + 59,
      intervaloMinutos: 360,
      esperado: false,
    },
    {
      descricao:
        'futebol fora de dia de jogo (intervalo 6h): 12h01 excede o limite de 12h',
      minutosDesdeAtualizacao: 12 * 60 + 1,
      intervaloMinutos: 360,
      esperado: true,
    },
  ])('$descricao', ({ minutosDesdeAtualizacao, intervaloMinutos, esperado }) => {
    expect(
      estaEmAlerta(AGORA, minutosAtras(minutosDesdeAtualizacao), intervaloMinutos),
    ).toBe(esperado);
  });
});

describe('calcularFrescor (CA-17.1 + CA-17.2 combinados)', () => {
  it('devolve texto e emAlerta consistentes com as funções individuais', () => {
    const geradoEm = minutosAtras(75);
    const resultado = calcularFrescor(AGORA, geradoEm, 30);
    expect(resultado).toEqual({
      atualizadoHa: formatarAtualizadoHa(AGORA, geradoEm),
      emAlerta: estaEmAlerta(AGORA, geradoEm, 30),
    });
    expect(resultado.emAlerta).toBe(true);
  });
});

describe('CA-17.5 — carimbos independentes por conjunto', () => {
  it('notícias (30 min) e futebol (6h) com o mesmo geradoEm produzem estados de alerta diferentes', () => {
    const geradoEm = minutosAtras(90); // 1h30 atrás
    const noticias = calcularFrescor(AGORA, geradoEm, 30); // limite 1h → excede
    const futebolForaDeDiaDeJogo = calcularFrescor(AGORA, geradoEm, 360); // limite 12h → não excede

    expect(noticias.emAlerta).toBe(true);
    expect(futebolForaDeDiaDeJogo.emAlerta).toBe(false);
    // mesmo texto "atualizado há X" (independe do intervalo), mas emAlerta diverge
    expect(noticias.atualizadoHa).toBe(futebolForaDeDiaDeJogo.atualizadoHa);
  });

  it('dois conjuntos de futebol com geradoEm diferentes (clube em alerta, outro não) não se contaminam', () => {
    const clubeDesatualizado = calcularFrescor(AGORA, minutosAtras(150), 60); // > 2h → alerta
    const clubeAtualizado = calcularFrescor(AGORA, minutosAtras(20), 60); // < 2h → sem alerta

    expect(clubeDesatualizado.emAlerta).toBe(true);
    expect(clubeAtualizado.emAlerta).toBe(false);
  });
});
