// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Esqueleto } from './Esqueleto';

describe('Esqueleto (UI-DS-07B)', () => {
  afterEach(() => {
    cleanup();
  });

  it('anuncia "Carregando" uma única vez via role="status"', () => {
    render(<Esqueleto variante="cartao" quantidade={6} />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Carregando');
  });

  it('renderiza a quantidade de blocos pedida, todos decorativos', () => {
    const { container } = render(<Esqueleto variante="linha-tabela" quantidade={8} />);
    const blocos = container.querySelectorAll('[data-variante="linha-tabela"]');
    expect(blocos).toHaveLength(8);
    blocos.forEach((bloco) => expect(bloco.getAttribute('aria-hidden')).toBe('true'));
  });

  it('quantidade padrão é 1 quando não informada', () => {
    const { container } = render(<Esqueleto variante="faixa" />);
    expect(container.querySelectorAll('[data-variante="faixa"]')).toHaveLength(1);
  });
});
