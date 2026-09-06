// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

describe('Chip (UI-DS-07A)', () => {
  afterEach(() => {
    cleanup();
  });

  describe('variante selecionável', () => {
    it('alterna por clique e reporta aria-pressed', () => {
      const aoAlternar = vi.fn();
      render(
        <Chip
          variante="selecionavel"
          rotulo="Futebol"
          selecionado={false}
          aoAlternar={aoAlternar}
        />,
      );
      const chip = screen.getByRole('button', { name: 'Futebol' });
      expect(chip.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(chip);
      expect(aoAlternar).toHaveBeenCalledTimes(1);
    });

    it('é operável por teclado (foco + Enter/clique nativo)', () => {
      const aoAlternar = vi.fn();
      render(
        <Chip
          variante="selecionavel"
          rotulo="Futebol"
          selecionado={false}
          aoAlternar={aoAlternar}
        />,
      );
      const chip = screen.getByRole('button', { name: 'Futebol' });
      chip.focus();
      expect(document.activeElement).toBe(chip);
      fireEvent.click(chip);
      expect(aoAlternar).toHaveBeenCalledTimes(1);
    });

    it('quando selecionado, mostra pista redundante além da cor (WCAG 1.4.1)', () => {
      render(
        <Chip
          variante="selecionavel"
          rotulo="Futebol"
          selecionado={true}
          aoAlternar={() => {}}
        />,
      );
      const chip = screen.getByRole('button', { name: 'Futebol' });
      expect(chip.getAttribute('aria-pressed')).toBe('true');
      expect(chip.textContent).toContain('✓');
    });
  });

  describe('variante removível', () => {
    it('tem um botão de remoção próprio, operável por teclado', () => {
      const aoRemover = vi.fn();
      render(
        <Chip
          variante="removivel"
          rotulo="Palmeiras"
          rotuloRemover="Remover Palmeiras"
          aoRemover={aoRemover}
        />,
      );
      const botaoRemover = screen.getByRole('button', { name: 'Remover Palmeiras' });
      botaoRemover.focus();
      expect(document.activeElement).toBe(botaoRemover);
      fireEvent.click(botaoRemover);
      expect(aoRemover).toHaveBeenCalledTimes(1);
    });
  });

  describe('variante informativa', () => {
    it('não é interativa (não expõe role de botão nem recebe foco)', () => {
      render(<Chip variante="informativo" rotulo="FONTE FIXA" />);
      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByText('FONTE FIXA')).toBeTruthy();
    });
  });
});
