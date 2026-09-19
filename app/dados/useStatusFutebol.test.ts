import { describe, expect, it } from 'vitest';
import { statusFutebolSchema } from './useStatusFutebol';

describe('statusFutebolSchema', () => {
  it('resultado desconhecido vira falha sem lançar', () => {
    const r = statusFutebolSchema.parse({
      futebol: {
        a: { resultado: 'xpto', ultimaAtualizacao: null },
        b: { resultado: 'atualizada', ultimaAtualizacao: 'x' },
      },
    });
    expect(r['a']?.resultado).toBe('falha');
    expect(r['b']?.resultado).toBe('atualizada');
  });
});
