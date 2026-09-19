import { describe, expect, it } from 'vitest';
import { statusIngestaoPublicoSchema } from './gerador-snapshots';

const base = (resultado: string) => ({
  geradoEm: '2026-01-01T00:00:00Z',
  fontes: {},
  distribuicaoClassificacao: {},
  gruposFormados: 0,
  futebol: { x: { resultado, ultimaAtualizacao: null } },
  provedores: {},
  pausadoPorCota: false,
});

describe('status.json resultado (COB-16)', () => {
  it('aceita sem-dados-provedor e os valores antigos', () => {
    expect(
      statusIngestaoPublicoSchema.safeParse(base('sem-dados-provedor')).success,
    ).toBe(true);
    expect(statusIngestaoPublicoSchema.safeParse(base('atualizada')).success).toBe(true);
  });
  it('rejeita valor desconhecido', () => {
    expect(statusIngestaoPublicoSchema.safeParse(base('xpto')).success).toBe(false);
  });
});
