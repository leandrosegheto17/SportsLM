// app/dados/configPublico.test.ts — UI-T02-01 (TASK.md Lote 8)

import { describe, expect, it } from 'vitest';
import { clubesPublicosSchema, URL_CONFIG_CLUBES } from './configPublico';

const paleta = {
  acromatico: false,
  identidade: '#E30613',
  faixaB: '#B10510',
  identidadeTexto: '#FFFFFF',
  acento: '#E30613',
  acentoSobreEscuro: '#FF6B6B',
  suave: '#FDE7E8',
  suaveEscuro: '#3A1013',
  identidadeEscuro: '#8C040C',
  faixaBEscuro: '#5C0308',
  identidadeTextoEscuro: '#FFFFFF',
};

describe('clubesPublicosSchema (/dados/config/clubes-2026.json)', () => {
  it('valida uma lista de clubes com paleta já derivada', () => {
    const resultado = clubesPublicosSchema.safeParse([
      {
        id: 'sao-paulo',
        nome: 'São Paulo Futebol Clube',
        nomeCurto: 'São Paulo',
        sigla: 'SPA',
        corBase: '#E30613',
        paleta,
      },
    ]);
    expect(resultado.success).toBe(true);
  });

  it('rejeita entrada sem paleta (ADR-017: a SPA nunca calcula, só consome)', () => {
    const resultado = clubesPublicosSchema.safeParse([
      {
        id: 'sao-paulo',
        nome: 'São Paulo Futebol Clube',
        nomeCurto: 'São Paulo',
        sigla: 'SPA',
        corBase: '#E30613',
      },
    ]);
    expect(resultado.success).toBe(false);
  });

  it('rejeita sigla que não seja exatamente 3 letras maiúsculas', () => {
    const resultado = clubesPublicosSchema.safeParse([
      {
        id: 'sao-paulo',
        nome: 'São Paulo Futebol Clube',
        nomeCurto: 'São Paulo',
        sigla: 'spa',
        corBase: '#E30613',
        paleta,
      },
    ]);
    expect(resultado.success).toBe(false);
  });

  it('URL_CONFIG_CLUBES é o caminho fixo do contrato (SDD §2.2)', () => {
    expect(URL_CONFIG_CLUBES).toBe('/dados/config/clubes-2026.json');
  });
});
