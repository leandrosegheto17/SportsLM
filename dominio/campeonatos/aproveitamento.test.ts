// dominio/campeonatos/aproveitamento.test.ts — DOM-04 (TASK.md Lote 3)
//
// Testes por tabela cobrindo CA-08.1/I-13 (TASK.md §1, diretriz 11).

import { describe, expect, it } from 'vitest';
import { calcularAproveitamento } from './aproveitamento';

describe('calcularAproveitamento (CA-08.1, I-13)', () => {
  const casos: Array<{ nome: string; pontos: number; jogos: number; esperado: number }> =
    [
      { nome: '100% (só vitórias)', pontos: 30, jogos: 10, esperado: 100 },
      { nome: '0% (nenhum ponto)', pontos: 0, jogos: 10, esperado: 0 },
      {
        nome: 'aproveitamento exato sem dízima (1V 1E em 2 jogos = 4/6)',
        pontos: 4,
        jogos: 2,
        esperado: 66.7,
      },
      {
        nome: 'dízima arredondada a 1 casa (1 ponto em 3 jogos = 1/9)',
        pontos: 1,
        jogos: 3,
        esperado: 11.1,
      },
      {
        nome: 'meio de tabela (metade dos pontos possíveis)',
        pontos: 15,
        jogos: 10,
        esperado: 50,
      },
      {
        nome: 'zero jogos disputados não divide por zero',
        pontos: 0,
        jogos: 0,
        esperado: 0,
      },
      {
        nome: 'jogos negativo (dado inconsistente) não divide por zero nem retorna negativo',
        pontos: 5,
        jogos: -1,
        esperado: 0,
      },
      {
        nome: 'campanha perfeita fracionária arredonda para cima (2/3 de 100)',
        pontos: 2,
        jogos: 1,
        esperado: 66.7,
      },
    ];

  it.each(casos)('$nome', ({ pontos, jogos, esperado }) => {
    expect(calcularAproveitamento(pontos, jogos)).toBe(esperado);
  });

  it('nunca retorna abaixo de 0 nem acima de 100 para entradas válidas (V=3,E=1,D=0)', () => {
    for (let jogos = 1; jogos <= 38; jogos += 1) {
      for (let pontos = 0; pontos <= jogos * 3; pontos += 1) {
        const resultado = calcularAproveitamento(pontos, jogos);
        expect(resultado).toBeGreaterThanOrEqual(0);
        expect(resultado).toBeLessThanOrEqual(100);
      }
    }
  });
});
