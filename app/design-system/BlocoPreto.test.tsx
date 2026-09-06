// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlocoPreto, PROPRIEDADE_ALTURA_PROJECAO } from './BlocoPreto';

/**
 * BlocoPreto.test.tsx — UI-DS-02.
 *
 * Critério de aceite (TASK.md): a variante "projeção" (fixo ao rolar) nunca
 * obscurece um elemento com foco (WCAG 2.4.11). jsdom não calcula layout real
 * nem geometria de rolagem, então a prova possível neste ambiente é
 * mecânica: confirmar que o componente mede a própria altura e a publica
 * como reserva de espaço de rolagem (`--bloco-preto-projecao-altura` +
 * `scroll-padding-bottom`, técnica citada em UX-SPEC §5.2) enquanto está
 * montado, e que restaura o estado anterior ao desmontar — para que nenhuma
 * outra tela herde o efeito por engano.
 */

beforeEach(() => {
  // jsdom não tem ResizeObserver — o componente cai no listener de `resize`,
  // que é o caminho que exercitamos aqui.
  vi.stubGlobal('ResizeObserver', undefined);
});

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty(PROPRIEDADE_ALTURA_PROJECAO);
  document.documentElement.style.removeProperty('scroll-padding-bottom');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BlocoPreto (UX-SPEC §3.8.2)', () => {
  it('renderiza a tira com o rótulo (pista textual redundante, WCAG 1.4.1) e o corpo', () => {
    const { container } = render(
      <BlocoPreto variante="resumo" rotulo="RESUMO DO CAMPEONATO">
        <p>conteúdo</p>
      </BlocoPreto>,
    );
    expect(container.textContent).toContain('RESUMO DO CAMPEONATO');
    expect(container.textContent).toContain('conteúdo');
  });

  it.each(['proximo-jogo', 'a-briga', 'projecao', 'resumo', 'campeonatos'] as const)(
    'marca o elemento raiz com data-variante="%s" (UX-SPEC §3.8.2)',
    (variante) => {
      const { container } = render(
        <BlocoPreto variante={variante} rotulo="RÓTULO">
          <p>conteúdo</p>
        </BlocoPreto>,
      );
      expect(container.firstElementChild?.getAttribute('data-variante')).toBe(variante);
    },
  );

  it('variante "projeção": publica a própria altura como --bloco-preto-projecao-altura em :root (WCAG 2.4.11)', () => {
    const { container } = render(
      <BlocoPreto variante="projecao" rotulo="PROJEÇÃO">
        <p>conteúdo</p>
      </BlocoPreto>,
    );
    const raizBloco = container.firstElementChild as HTMLElement;
    vi.spyOn(raizBloco, 'getBoundingClientRect').mockReturnValue({
      height: 96,
      width: 320,
      top: 0,
      left: 0,
      right: 320,
      bottom: 96,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Força a remedição via o mesmo caminho que o ResizeObserver acionaria:
    // dispara o listener de `resize` instalado como alternativa (jsdom não
    // tem ResizeObserver, ver beforeEach).
    window.dispatchEvent(new Event('resize'));

    expect(
      document.documentElement.style.getPropertyValue(PROPRIEDADE_ALTURA_PROJECAO),
    ).toBe('96px');
    expect(document.documentElement.style.getPropertyValue('scroll-padding-bottom')).toBe(
      '96px',
    );
  });

  it('variante "projeção": restaura o estado anterior de :root ao desmontar, sem vazar para outras telas', () => {
    document.documentElement.style.setProperty('scroll-padding-bottom', '10px');

    const { unmount } = render(
      <BlocoPreto variante="projecao" rotulo="PROJEÇÃO">
        <p>conteúdo</p>
      </BlocoPreto>,
    );
    expect(
      document.documentElement.style.getPropertyValue(PROPRIEDADE_ALTURA_PROJECAO),
    ).not.toBe('');

    unmount();

    expect(
      document.documentElement.style.getPropertyValue(PROPRIEDADE_ALTURA_PROJECAO),
    ).toBe('');
    expect(document.documentElement.style.getPropertyValue('scroll-padding-bottom')).toBe(
      '10px',
    );
  });

  it.each(['proximo-jogo', 'a-briga', 'resumo', 'campeonatos'] as const)(
    'variante "%s" nunca toca --bloco-preto-projecao-altura nem scroll-padding-bottom',
    (variante) => {
      render(
        <BlocoPreto variante={variante} rotulo="RÓTULO">
          <p>conteúdo</p>
        </BlocoPreto>,
      );
      expect(
        document.documentElement.style.getPropertyValue(PROPRIEDADE_ALTURA_PROJECAO),
      ).toBe('');
      expect(
        document.documentElement.style.getPropertyValue('scroll-padding-bottom'),
      ).toBe('');
    },
  );
});
