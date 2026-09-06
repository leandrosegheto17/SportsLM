// dominio/futebol/paleta.test.ts — PUB-01 (TASK.md Lote 6, ADR-017)

import { describe, expect, it } from 'vitest';
import {
  CORES_FIXAS_VALIDACAO,
  RAZAO_CONTRASTE_MINIMA,
  ajustarL,
  derivarPaleta,
  ehAcromatico,
  hexParaRgb,
  hslParaRgb,
  razaoContraste,
  rgbParaHex,
  rgbParaHsl,
  validarPaleta,
} from './paleta';

describe('conversão de cor', () => {
  it('hexParaRgb/rgbParaHex são inversos', () => {
    expect(hexParaRgb('#E30613')).toEqual({ r: 227, g: 6, b: 19 });
    expect(rgbParaHex({ r: 227, g: 6, b: 19 })).toBe('#E30613');
  });

  it('rgbParaHsl/hslParaRgb são inversos (dentro de arredondamento)', () => {
    const hex = '#006437';
    const hsl = rgbParaHsl(hexParaRgb(hex));
    expect(rgbParaHex(hslParaRgb(hsl))).toBe(hex);
  });

  it('ajustarL mantém matiz/saturação e troca só a luminosidade', () => {
    const original = rgbParaHsl(hexParaRgb('#E30613'));
    const ajustada = rgbParaHsl(hexParaRgb(ajustarL('#E30613', 0.2)));
    expect(ajustada.l).toBeCloseTo(0.2, 1);
    expect(ajustada.h).toBeCloseTo(original.h, 0);
  });
});

describe('razaoContraste (WCAG 1.4.3)', () => {
  it('preto sobre branco é 21:1', () => {
    expect(razaoContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('uma cor contra si mesma é 1:1', () => {
    expect(razaoContraste('#E30613', '#E30613')).toBeCloseTo(1, 5);
  });

  it('é comutativa', () => {
    expect(razaoContraste('#123456', '#FEDCBA')).toBeCloseTo(
      razaoContraste('#FEDCBA', '#123456'),
      10,
    );
  });
});

describe('ehAcromatico (ADR-017 item 2, passo 2)', () => {
  it.each([
    ['#000000', true], // l < 0,10
    ['#FFFFFF', true], // l > 0,93
    ['#808080', true], // s < 0,15 (cinza puro)
    ['#E30613', false], // São Paulo: cromático
    ['#FFDD00', false], // Mirassol: cromático, claro mas s alta
  ])('%s → acromatico=%s', (cor, esperado) => {
    expect(ehAcromatico(cor)).toBe(esperado);
  });
});

// --- Os 4 exemplos do UX-SPEC §3.4 ------------------------------------------
//
// Tabela de conferência do UX-SPEC (§3.4, "Exemplos derivados"): cobre um
// clube cromático que passa sem ajuste (São Paulo), um clube claro/saturado
// que exige escurecer o acento (Mirassol), um clube acromático (Corinthians)
// e um segundo clube cromático que passa sem ajuste (Palmeiras). Critério de
// aceite de PUB-01.

describe('derivarPaleta — os 4 exemplos do UX-SPEC §3.4', () => {
  it.each([
    {
      clube: 'São Paulo',
      corBase: '#E30613',
      identidadeEsperada: '#E30613',
      identidadeTextoEsperada: '#FFFFFF',
      acentoEsperado: '#E30613', // "passa sem ajuste" (UX-SPEC)
      acromaticoEsperado: false,
    },
    {
      clube: 'Mirassol',
      corBase: '#FFDD00',
      identidadeEsperada: '#FFDD00',
      identidadeTextoEsperada: '#16181A',
      acentoEsperado: undefined, // escurecido — só valida que difere de corBase
      acromaticoEsperado: false,
    },
    {
      clube: 'Corinthians (acromático)',
      corBase: '#000000',
      identidadeEsperada: '#16181A',
      identidadeTextoEsperada: '#FFFFFF',
      acentoEsperado: '#16181A',
      acromaticoEsperado: true,
    },
    {
      clube: 'Palmeiras',
      corBase: '#006437',
      identidadeEsperada: '#006437',
      identidadeTextoEsperada: '#FFFFFF',
      acentoEsperado: '#006437', // "passa sem ajuste" (UX-SPEC)
      acromaticoEsperado: false,
    },
  ])(
    '$clube ($corBase)',
    ({
      corBase,
      identidadeEsperada,
      identidadeTextoEsperada,
      acentoEsperado,
      acromaticoEsperado,
    }) => {
      // Palmeiras precisa do override de `faixaB` documentado em
      // `pipeline/config/clubes.ts` (ver nota de decisão lá) para passar na
      // validação — replicado aqui como fixture isolada, sem depender de
      // `config/clubes-2026.json`.
      const paletaManual = corBase === '#006437' ? { faixaB: '#004526' } : undefined;
      const paleta = derivarPaleta(corBase, paletaManual);

      expect(paleta.acromatico).toBe(acromaticoEsperado);
      expect(paleta.identidade).toBe(identidadeEsperada);
      expect(paleta.identidadeTexto).toBe(identidadeTextoEsperada);
      if (acentoEsperado !== undefined) {
        expect(paleta.acento).toBe(acentoEsperado);
      } else {
        expect(paleta.acento).not.toBe(corBase);
      }

      const resultado = validarPaleta(paleta);
      expect(resultado.erros).toEqual([]);
      expect(resultado.valido).toBe(true);
    },
  );

  it('Mirassol: acento escurecido até satisfazer 4,5:1 contra --cor-fundo e --cor-superficie', () => {
    const paleta = derivarPaleta('#FFDD00');
    expect(
      razaoContraste(paleta.acento, CORES_FIXAS_VALIDACAO.fundoClaro),
    ).toBeGreaterThanOrEqual(RAZAO_CONTRASTE_MINIMA);
    expect(
      razaoContraste(paleta.acento, CORES_FIXAS_VALIDACAO.superficieClara),
    ).toBeGreaterThanOrEqual(RAZAO_CONTRASTE_MINIMA);
  });

  it('paletaManual sobrescreve campo a campo e o resultado ainda passa pela mesma validação', () => {
    const semOverride = derivarPaleta('#E30613');
    const comOverride = derivarPaleta('#E30613', { faixaB: '#7A0410' });
    expect(comOverride.faixaB).toBe('#7A0410');
    expect(comOverride.identidade).toBe(semOverride.identidade); // outros campos preservados
    expect(validarPaleta(comOverride).valido).toBe(true);
  });
});

describe('validarPaleta — os 8 alvos de contraste do ADR-017 §3', () => {
  it('paleta válida não produz erro', () => {
    const paleta = derivarPaleta('#E30613');
    expect(validarPaleta(paleta)).toEqual({ valido: true, erros: [] });
  });

  it('detecta identidadeTexto insuficiente contra identidade', () => {
    const paleta = { ...derivarPaleta('#E30613'), identidadeTexto: '#E30613' };
    const resultado = validarPaleta(paleta);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.some((e) => e.includes('identidadeTexto vs identidade'))).toBe(
      true,
    );
  });

  it('detecta cor-tinta insuficiente contra suave', () => {
    const paleta = { ...derivarPaleta('#E30613'), suave: '#16181A' };
    const resultado = validarPaleta(paleta);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.some((e) => e.includes('cor-tinta vs suave'))).toBe(true);
  });

  // Critério de aceite de PUB-01: "build falha propositalmente com uma cor
  // inválida de teste". `#1E7A34` (verde escuro e saturado, l ≈ 0,298 — bem
  // no limiar do corte de 0,30 do ADR-017 item 2) é o mesmo caso encontrado
  // ao rodar a derivação sobre os 20 clubes reais de CFG-02 (Juventude) sem
  // override manual: a derivação "cega" ao algoritmo do ADR não converge
  // para um `identidadeTexto` que passe nos dois alvos ao mesmo tempo
  // (`vs identidade` e `vs faixaB`) — prova de que `validarPaleta` realmente
  // barra uma cor problemática em vez de aceitar silenciosamente.
  it('cor de teste deliberadamente inválida: derivação "crua" (sem paletaManual) falha a validação', () => {
    const paleta = derivarPaleta('#1E7A34');
    const resultado = validarPaleta(paleta);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.length).toBeGreaterThan(0);
  });
});
