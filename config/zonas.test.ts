// config/zonas.test.ts — CFG-04 (RN-15/RF-18, CA-18.1/CA-18.2)
//
// Cobre: (1) ausência do arquivo é estado válido (CA-18.2), nunca erro; (2)
// arquivo presente válido, com a soma de faixas consistente com as 20
// posições do Brasileirão (RN-04) — ver interpretação registrada em
// `config/zonas.ts`; (3) rejeição de conteúdo inconsistente (sobreposição,
// fora de 1–20, soma > 20, token fora do design system).
import { describe, expect, it } from 'vitest';
import {
  TOKENS_DE_ZONA,
  TOTAL_POSICOES_BRASILEIRAO,
  ZonasConfigSchema,
  analisarZonas,
  carregarZonas,
  type DependenciasDeArquivo,
} from './zonas';

/** Formato real do Brasileirão (RN-15): título+Libertadores 1–4,
 * pré-Libertadores 5–6, Sul-Americana 7–12, rebaixamento 17–20 — meio de
 * tabela (13–16) sem faixa, de propósito (ver `config/zonas.ts`). */
const FAIXAS_VALIDAS_EXEMPLO = [
  { de: 1, ate: 4, rotulo: 'Libertadores', token: 'libertadores' },
  { de: 5, ate: 6, rotulo: 'Pré-Libertadores', token: 'pre-libertadores' },
  { de: 7, ate: 12, rotulo: 'Sul-Americana', token: 'sul-americana' },
  { de: 17, ate: 20, rotulo: 'Rebaixamento', token: 'rebaixamento' },
];

function dependenciasComArquivo(conteudo: string | undefined): DependenciasDeArquivo {
  return {
    existeArquivo: () => conteudo !== undefined,
    lerArquivo: () => {
      if (conteudo === undefined) {
        throw new Error('lerArquivo chamado sem o arquivo existir — bug no teste');
      }
      return conteudo;
    },
  };
}

describe('CA-18.2 — ausência do arquivo é estado válido', () => {
  it('carregarZonas retorna null quando o arquivo não existe, sem lançar', () => {
    const dependencias = dependenciasComArquivo(undefined);

    expect(() => carregarZonas('config/zonas-2026.json', dependencias)).not.toThrow();
    expect(carregarZonas('config/zonas-2026.json', dependencias)).toBeNull();
  });
});

describe('schema Zod — arquivo presente e válido', () => {
  it('aceita o formato real do Brasileirão (RN-15) e devolve as faixas', () => {
    const conteudo = JSON.stringify(FAIXAS_VALIDAS_EXEMPLO);
    const dependencias = dependenciasComArquivo(conteudo);

    const resultado = carregarZonas('config/zonas-2026.json', dependencias);

    expect(resultado).toEqual(FAIXAS_VALIDAS_EXEMPLO);
  });

  it('a soma das faixas nunca excede as 20 posições do Brasileirão (RN-04)', () => {
    const somaDePosicoesCobertas = FAIXAS_VALIDAS_EXEMPLO.reduce(
      (soma, faixa) => soma + (faixa.ate - faixa.de + 1),
      0,
    );

    expect(somaDePosicoesCobertas).toBeLessThanOrEqual(TOTAL_POSICOES_BRASILEIRAO);
    expect(ZonasConfigSchema.safeParse(FAIXAS_VALIDAS_EXEMPLO).success).toBe(true);
  });

  it('aceita lista vazia (nenhuma faixa configurada, mas arquivo presente)', () => {
    expect(ZonasConfigSchema.safeParse([]).success).toBe(true);
  });

  it.each(TOKENS_DE_ZONA)('aceita o token fixo "%s" do design system', (token) => {
    const faixa = { de: 1, ate: 1, rotulo: 'Teste', token };
    expect(ZonasConfigSchema.safeParse([faixa]).success).toBe(true);
  });
});

describe('schema Zod — rejeita configuração inconsistente', () => {
  it('rejeita faixas sobrepostas', () => {
    const faixas = [
      { de: 1, ate: 5, rotulo: 'Libertadores', token: 'libertadores' },
      { de: 4, ate: 8, rotulo: 'Sul-Americana', token: 'sul-americana' },
    ];

    expect(ZonasConfigSchema.safeParse(faixas).success).toBe(false);
  });

  it('soma de faixas nunca excede 20 quando não há sobreposição nem posição fora de 1–20', () => {
    // Consequência estrutural, não só de interpretação: como cada faixa é
    // obrigada a ficar dentro de 1–20 (checagem de campo) e faixas não podem
    // se sobrepor (checagem de `superRefine`), a soma das posições cobertas
    // por faixas não-sobrepostas dentro de um universo de 20 posições jamais
    // ultrapassa 20 — o caso "soma > 20" só é alcançável combinado com
    // sobreposição ou posição fora do intervalo, ambos já rejeitados por
    // outras checagens (testes acima/abaixo). O cobrindo o Brasileirão
    // inteiro (1–20, sem lacuna) é o teto exato dessa soma:
    const cobrindoTodasAs20Posicoes = [
      { de: 1, ate: 15, rotulo: 'A', token: 'libertadores' },
      { de: 16, ate: 20, rotulo: 'B', token: 'rebaixamento' },
    ];

    expect(ZonasConfigSchema.safeParse(cobrindoTodasAs20Posicoes).success).toBe(true);
  });

  it('rejeita posição fora do intervalo 1–20', () => {
    const faixas = [{ de: 0, ate: 4, rotulo: 'Libertadores', token: 'libertadores' }];
    expect(ZonasConfigSchema.safeParse(faixas).success).toBe(false);

    const faixasAcimaDe20 = [
      { de: 18, ate: 21, rotulo: 'Rebaixamento', token: 'rebaixamento' },
    ];
    expect(ZonasConfigSchema.safeParse(faixasAcimaDe20).success).toBe(false);
  });

  it('rejeita "de" maior que "ate"', () => {
    const faixas = [{ de: 10, ate: 4, rotulo: 'Inválida', token: 'libertadores' }];
    expect(ZonasConfigSchema.safeParse(faixas).success).toBe(false);
  });

  it('rejeita token fora do design system (RF-18/TR-19)', () => {
    const faixas = [{ de: 1, ate: 4, rotulo: 'Título', token: 'titulo' }];
    expect(ZonasConfigSchema.safeParse(faixas).success).toBe(false);
  });

  it('rejeita rótulo vazio', () => {
    const faixas = [{ de: 1, ate: 4, rotulo: '', token: 'libertadores' }];
    expect(ZonasConfigSchema.safeParse(faixas).success).toBe(false);
  });

  it('analisarZonas lança para JSON inválido (não é a ausência do arquivo)', () => {
    expect(() => analisarZonas('{ isso não é uma lista de faixas }')).toThrow();
  });

  it('carregarZonas lança (não retorna null) quando o arquivo existe mas é inválido', () => {
    const conteudo = JSON.stringify([
      { de: 1, ate: 4, rotulo: 'Título', token: 'token-invalido' },
    ]);
    const dependencias = dependenciasComArquivo(conteudo);

    expect(() => carregarZonas('config/zonas-2026.json', dependencias)).toThrow();
  });
});
