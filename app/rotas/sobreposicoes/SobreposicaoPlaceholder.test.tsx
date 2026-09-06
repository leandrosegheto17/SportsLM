// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SobreposicaoPlaceholder } from './SobreposicaoPlaceholder';

describe('SobreposicaoPlaceholder (T-03/T-04/T-07 — sem rota, ADR-003)', () => {
  afterEach(() => {
    cleanup();
  });

  it('não renderiza nada quando fechada', () => {
    render(
      <SobreposicaoPlaceholder
        idTela="T-03"
        nomeDaTela="Configurações"
        aberta={false}
        aoFechar={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renderiza como diálogo modal quando aberta', () => {
    render(
      <SobreposicaoPlaceholder
        idTela="T-03"
        nomeDaTela="Configurações"
        aberta={true}
        aoFechar={() => {}}
      />,
    );
    const dialogo = screen.getByRole('dialog', { name: 'Configurações' });
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
  });

  it('fecha ao pressionar Esc', () => {
    const aoFechar = vi.fn();
    render(
      <SobreposicaoPlaceholder
        idTela="T-03"
        nomeDaTela="Configurações"
        aberta={true}
        aoFechar={aoFechar}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('fecha ao clicar em "Fechar"', () => {
    const aoFechar = vi.fn();
    render(
      <SobreposicaoPlaceholder
        idTela="T-03"
        nomeDaTela="Configurações"
        aberta={true}
        aoFechar={aoFechar}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('devolve o foco ao gatilho depois de fechar', () => {
    const gatilho = document.createElement('button');
    document.body.appendChild(gatilho);
    gatilho.focus();
    expect(document.activeElement).toBe(gatilho);

    const { rerender } = render(
      <SobreposicaoPlaceholder
        idTela="T-03"
        nomeDaTela="Configurações"
        aberta={true}
        aoFechar={() => {}}
      />,
    );

    rerender(
      <SobreposicaoPlaceholder
        idTela="T-03"
        nomeDaTela="Configurações"
        aberta={false}
        aoFechar={() => {}}
      />,
    );

    expect(document.activeElement).toBe(gatilho);
    document.body.removeChild(gatilho);
  });
});
