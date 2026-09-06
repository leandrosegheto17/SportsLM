// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NumeroCamisa } from './NumeroCamisa';

const caminhoCss = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'NumeroCamisa.module.css',
);
const conteudoCss = readFileSync(caminhoCss, 'utf-8');

const caminhoTokens = resolve(dirname(fileURLToPath(import.meta.url)), 'tokens.css');
const conteudoTokens = readFileSync(caminhoTokens, 'utf-8');

describe('NumeroCamisa (UI-DS-04 — UX-SPEC §3.8.4)', () => {
  afterEach(() => {
    cleanup();
  });

  it('variante "sobre-faixa" mostra o número acompanhado do texto associado', () => {
    render(<NumeroCamisa variante="sobre-faixa" numero={6} rotulo="6º lugar" />);

    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('6º lugar')).toBeTruthy();
  });

  it('variante "sobre-fundo-claro" mostra o número acompanhado do texto associado', () => {
    render(<NumeroCamisa variante="sobre-fundo-claro" numero={12} rotulo="12º lugar" />);

    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('12º lugar')).toBeTruthy();
  });

  it('o texto associado não é um atributo escondido — é conteúdo textual visível na árvore de acessibilidade', () => {
    render(<NumeroCamisa variante="sobre-faixa" numero={6} rotulo="6º lugar" />);

    const rotulo = screen.getByText('6º lugar');
    // Não deve haver aria-hidden entre o texto e o document.body — senão o
    // "texto associado" exigido pelo critério de aceite não chegaria a
    // tecnologia assistiva.
    let no: HTMLElement | null = rotulo;
    while (no) {
      expect(no.getAttribute('aria-hidden')).not.toBe('true');
      no = no.parentElement;
    }
  });

  it('variante "sem-posicao" (mata-mata) mostra a fase no lugar do número, sem número nenhum', () => {
    render(<NumeroCamisa variante="sem-posicao" fase="Oitavas de final" />);

    expect(screen.getByText('Oitavas de final')).toBeTruthy();
  });

  it('define o token --txt-camisa-compacta (56px) em tokens.css, distinto de --txt-camisa (72px) e --txt-camisa-sm (48px)', () => {
    expect(conteudoTokens).toMatch(/--txt-camisa:\s*800 72px\/64px/);
    expect(conteudoTokens).toMatch(/--txt-camisa-compacta:\s*800 56px\/52px/);
    expect(conteudoTokens).toContain('--txt-camisa-compacta-tracking');
  });

  it('reduz o número de 72px para o token de 56px abaixo de 340px de largura, escopado ao próprio componente', () => {
    const blocoMediaQuery = conteudoCss.match(
      /@media \(max-width: 339px\) \{[\s\S]*?\}\s*\}/,
    )?.[0];

    expect(blocoMediaQuery).toBeDefined();
    expect(blocoMediaQuery).toContain('.numero');
    expect(blocoMediaQuery).toContain('var(--txt-camisa-compacta)');
  });

  it('não usa nenhum valor literal de cor/tamanho fora de tokens.css (Diretriz de Implementação #4)', () => {
    // Verificação mecânica: toda declaração de propriedade de cor/tipografia/
    // espaçamento no CSS do componente referencia uma custom property
    // (var(--...)) — a única forma de valor "cru" tolerada é a de
    // layout estrutural sem significado de design (display/flex-direction/
    // align-items/margin: 0), que não são cor/tamanho/espaçamento de tokens.
    const declaracoesDeInteresse = conteudoCss.match(
      /(?:color|font|letter-spacing|gap):\s*[^;]+;/g,
    );

    expect(declaracoesDeInteresse).not.toBeNull();
    for (const declaracao of declaracoesDeInteresse ?? []) {
      const usaVarOuHerda = /var\(--|inherit/.test(declaracao);
      expect(usaVarOuHerda).toBe(true);
    }
  });
});
