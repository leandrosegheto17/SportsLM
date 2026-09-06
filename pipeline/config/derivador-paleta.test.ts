// pipeline/config/derivador-paleta.test.ts — PUB-01 (TASK.md Lote 6, ADR-017)
//
// Critério de aceite de PUB-01: "Testes por tabela cobrindo os 4 exemplos do
// UX-SPEC §3.4 (São Paulo, Mirassol, Corinthians acromático, Palmeiras);
// build falha propositalmente com uma cor inválida de teste." A cobertura
// dos 4 exemplos do UX-SPEC vive em `dominio/futebol/paleta.test.ts` (a
// aritmética/derivação pura); este arquivo cobre a integração com
// `config/clubes-2026.json` real (CFG-02): (a) os 20 clubes reais produzem
// paleta válida — o "build falha propositalmente" fica provado ao rodar
// `derivarPaletasClubes` sobre uma fixture com uma `corBase` de teste
// deliberadamente inválida, quebrando esta suíte (e, portanto, `vitest run`
// — já um portão de CI, FUND-01) se a validação falhar.

import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { carregarClubesSerieA2026, EsquemaClubesBase } from './clubes';
import {
  derivarPaletaClube,
  derivarPaletasClubes,
  ErroPaletaInvalida,
} from './derivador-paleta';

describe('derivarPaletasClubes — os 20 clubes reais de CFG-02', () => {
  const clubes = carregarClubesSerieA2026();

  it('carrega exatamente 20 clubes (pré-condição, RN-04)', () => {
    expect(clubes).toHaveLength(20);
  });

  it('deriva e valida paleta para cada um dos 20 clubes sem lançar (build não quebra hoje)', () => {
    const comPaleta = derivarPaletasClubes(clubes);
    expect(comPaleta).toHaveLength(20);
    for (const clube of comPaleta) {
      expect(clube.paleta).toBeDefined();
      expect(
        EsquemaClubesBase.element.shape.corBase.safeParse(clube.corBase).success,
      ).toBe(true);
    }
  });

  it('os 6 clubes acromáticos de TR-14 recebem a paleta acromática fixa do ADR-017', () => {
    const acromaticosEsperados = [
      'corinthians',
      'botafogo',
      'santos',
      'vasco',
      'atletico-mg',
      'ceara',
    ];
    const comPaleta = derivarPaletasClubes(clubes);
    for (const id of acromaticosEsperados) {
      const clube = comPaleta.find((c) => c.id === id);
      expect(clube?.paleta.acromatico).toBe(true);
      expect(clube?.paleta.identidade).toBe('#16181A');
    }
  });

  it('Palmeiras e Juventude usam `paletaManual.faixaB` para passar na validação (achado real desta tarefa)', () => {
    const comPaleta = derivarPaletasClubes(clubes);
    const palmeiras = comPaleta.find((c) => c.id === 'palmeiras');
    const juventude = comPaleta.find((c) => c.id === 'juventude');
    expect(palmeiras?.paleta.faixaB).toBe('#004526');
    expect(juventude?.paleta.faixaB).toBe('#18612A');
  });

  it('nenhum clube real fica sem o bloco `paleta` completo (11 campos do schema)', () => {
    const comPaleta = derivarPaletasClubes(clubes);
    for (const clube of comPaleta) {
      const campos = Object.keys(clube.paleta);
      expect(campos.sort()).toEqual(
        [
          'acromatico',
          'acento',
          'acentoSobreEscuro',
          'faixaB',
          'faixaBEscuro',
          'identidade',
          'identidadeEscuro',
          'identidadeTexto',
          'identidadeTextoEscuro',
          'suave',
          'suaveEscuro',
        ].sort(),
      );
    }
  });
});

describe('derivarPaletaClube — falha de validação quebra o build (critério de aceite de PUB-01)', () => {
  it('lança ErroPaletaInvalida para uma corBase de teste sem override que não converge (achado real: mesmo caso do Juventude)', () => {
    const clubeInvalido = {
      id: 'clube-de-teste-invalido',
      nome: 'Clube de Teste Inválido',
      nomeCurto: 'Teste',
      sigla: 'TST',
      corBase: '#1E7A34', // sem paletaManual — deliberadamente não corrigido
      idsProvedor: { 'football-data': 999999 },
    };

    expect(() => derivarPaletaClube(clubeInvalido)).toThrow(ErroPaletaInvalida);
    try {
      derivarPaletaClube(clubeInvalido);
      expect.unreachable('deveria ter lançado ErroPaletaInvalida');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroPaletaInvalida);
      const erroTipado = erro as ErroPaletaInvalida;
      expect(erroTipado.clubeId).toBe('clube-de-teste-invalido');
      expect(erroTipado.erros.length).toBeGreaterThan(0);
      expect(erroTipado.message).toContain('ADR-017 §3');
    }
  });

  it('derivarPaletasClubes propaga a falha: um único clube inválido quebra a execução inteira', () => {
    const clubes = [
      {
        id: 'clube-ok',
        nome: 'Clube OK',
        nomeCurto: 'OK',
        sigla: 'AAA',
        corBase: '#E30613',
        idsProvedor: { 'football-data': 1 },
      },
      {
        id: 'clube-invalido',
        nome: 'Clube Inválido',
        nomeCurto: 'Inválido',
        sigla: 'BBB',
        corBase: '#1E7A34',
        idsProvedor: { 'football-data': 2 },
      },
    ];

    expect(() => derivarPaletasClubes(clubes)).toThrow(ErroPaletaInvalida);
  });

  it('o mesmo clube inválido passa a validar quando recebe paletaManual.faixaB (o mesmo remédio aplicado a Palmeiras/Juventude)', () => {
    const clubeCorrigido = {
      id: 'clube-de-teste-invalido',
      nome: 'Clube de Teste Inválido',
      nomeCurto: 'Teste',
      sigla: 'TST',
      corBase: '#1E7A34',
      idsProvedor: { 'football-data': 999999 },
      paletaManual: { faixaB: '#18612A' },
    };

    expect(() => derivarPaletaClube(clubeCorrigido)).not.toThrow();
  });
});

describe('carregarClubesSerieA2026 + derivarPaletasClubes com fixture de arquivo (prova de ponta a ponta)', () => {
  let dirTemporario: string | undefined;

  afterEach(() => {
    if (dirTemporario !== undefined) {
      rmSync(dirTemporario, { recursive: true, force: true });
      dirTemporario = undefined;
    }
  });

  it('quebra o build ao carregar um arquivo real de configuração com uma corBase de teste inválida', () => {
    dirTemporario = mkdtempSync(join(tmpdir(), 'sportslm-derivador-paleta-'));
    const caminhoFixture = join(dirTemporario, 'clubes-teste-invalido.json');
    writeFileSync(
      caminhoFixture,
      JSON.stringify([
        {
          id: 'clube-de-teste-invalido',
          nome: 'Clube de Teste Inválido',
          nomeCurto: 'Teste',
          sigla: 'TST',
          corBase: '#1E7A34',
          idsProvedor: { 'football-data': 999999 },
        },
      ]),
      'utf8',
    );

    const clubes = carregarClubesSerieA2026(caminhoFixture);
    expect(() => derivarPaletasClubes(clubes)).toThrow(ErroPaletaInvalida);
  });
});
