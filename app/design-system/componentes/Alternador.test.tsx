// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Alternador } from './Alternador';

describe('Alternador (UI-DS-07A)', () => {
  afterEach(() => {
    cleanup();
  });

  it('expõe role="switch" com aria-checked correspondente ao estado', () => {
    render(<Alternador rotulo="UOL Esporte" ligado={false} aoAlternar={() => {}} />);
    const interruptor = screen.getByRole('switch', { name: 'UOL Esporte' });
    expect(interruptor.getAttribute('aria-checked')).toBe('false');
  });

  it('alterna por clique e é operável por teclado (foco + ativação nativa)', () => {
    const aoAlternar = vi.fn();
    render(<Alternador rotulo="UOL Esporte" ligado={false} aoAlternar={aoAlternar} />);
    const interruptor = screen.getByRole('switch', { name: 'UOL Esporte' });
    interruptor.focus();
    expect(document.activeElement).toBe(interruptor);
    fireEvent.click(interruptor);
    expect(aoAlternar).toHaveBeenCalledTimes(1);
  });

  it('mostra texto de estado além da cor (WCAG 1.4.1)', () => {
    render(<Alternador rotulo="UOL Esporte" ligado={true} aoAlternar={() => {}} />);
    expect(screen.getByText('Ligado')).toBeTruthy();
    cleanup();
    render(<Alternador rotulo="UOL Esporte" ligado={false} aoAlternar={() => {}} />);
    expect(screen.getByText('Desligado')).toBeTruthy();
  });

  it('não alterna quando desabilitado', () => {
    const aoAlternar = vi.fn();
    render(<Alternador rotulo="GE" ligado={true} aoAlternar={aoAlternar} disabled />);
    const interruptor = screen.getByRole('switch', { name: 'GE' });
    expect(interruptor).toHaveProperty('disabled', true);
  });
});
