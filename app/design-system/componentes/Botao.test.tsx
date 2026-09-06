// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Botao } from './Botao';

describe('Botao (UI-DS-07A)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza como <button type="button"> por padrão', () => {
    render(<Botao>Confirmar</Botao>);
    const botao = screen.getByRole('button', { name: 'Confirmar' });
    expect(botao.getAttribute('type')).toBe('button');
  });

  it('é ativável por clique', () => {
    const aoClicar = vi.fn();
    render(<Botao onClick={aoClicar}>Confirmar</Botao>);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it('é operável por teclado (Enter aciona o clique nativo do <button>)', () => {
    const aoClicar = vi.fn();
    render(<Botao onClick={aoClicar}>Confirmar</Botao>);
    const botao = screen.getByRole('button', { name: 'Confirmar' });
    botao.focus();
    expect(document.activeElement).toBe(botao);
    fireEvent.keyDown(botao, { key: 'Enter' });
    fireEvent.click(botao);
    expect(aoClicar).toHaveBeenCalled();
  });

  it('não é ativável quando desabilitado', () => {
    const aoClicar = vi.fn();
    render(
      <Botao onClick={aoClicar} disabled>
        Confirmar
      </Botao>,
    );
    const botao = screen.getByRole('button', { name: 'Confirmar' });
    expect(botao).toHaveProperty('disabled', true);
  });

  it.each(['primario', 'secundario', 'terciario', 'destrutivo', 'fantasma'] as const)(
    'renderiza a variante %s sem lançar',
    (variante) => {
      render(<Botao variante={variante}>Ação</Botao>);
      expect(screen.getByRole('button', { name: 'Ação' })).toBeTruthy();
      cleanup();
    },
  );
});
