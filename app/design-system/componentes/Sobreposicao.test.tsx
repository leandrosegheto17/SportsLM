// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sobreposicao } from './Sobreposicao';

describe('Sobreposicao (UI-DS-07A)', () => {
  afterEach(() => {
    cleanup();
  });

  it('não renderiza nada quando fechada', () => {
    render(
      <Sobreposicao titulo="Configurações" aberta={false} aoFechar={() => {}}>
        <p>Conteúdo</p>
      </Sobreposicao>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renderiza como diálogo modal com título quando aberta', () => {
    render(
      <Sobreposicao titulo="Configurações" aberta={true} aoFechar={() => {}}>
        <p>Conteúdo</p>
      </Sobreposicao>,
    );
    const dialogo = screen.getByRole('dialog', { name: 'Configurações' });
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Conteúdo')).toBeTruthy();
  });

  it('fecha ao pressionar Esc', () => {
    const aoFechar = vi.fn();
    render(
      <Sobreposicao titulo="Configurações" aberta={true} aoFechar={aoFechar}>
        <p>Conteúdo</p>
      </Sobreposicao>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('fecha ao clicar em "Fechar"', () => {
    const aoFechar = vi.fn();
    render(
      <Sobreposicao titulo="Configurações" aberta={true} aoFechar={aoFechar}>
        <p>Conteúdo</p>
      </Sobreposicao>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('fecha ao clicar fora (no véu), mas não ao clicar dentro do diálogo', () => {
    const aoFechar = vi.fn();
    render(
      <Sobreposicao titulo="Configurações" aberta={true} aoFechar={aoFechar}>
        <p>Conteúdo</p>
      </Sobreposicao>,
    );

    fireEvent.click(screen.getByText('Conteúdo'));
    expect(aoFechar).not.toHaveBeenCalled();

    const dialogo = screen.getByRole('dialog');
    const veu = dialogo.parentElement;
    expect(veu).not.toBeNull();
    if (veu) {
      fireEvent.click(veu);
    }
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('devolve o foco ao gatilho depois de fechar', () => {
    const gatilho = document.createElement('button');
    document.body.appendChild(gatilho);
    gatilho.focus();
    expect(document.activeElement).toBe(gatilho);

    const { rerender } = render(
      <Sobreposicao titulo="Configurações" aberta={true} aoFechar={() => {}}>
        <p>Conteúdo</p>
      </Sobreposicao>,
    );

    rerender(
      <Sobreposicao titulo="Configurações" aberta={false} aoFechar={() => {}}>
        <p>Conteúdo</p>
      </Sobreposicao>,
    );

    expect(document.activeElement).toBe(gatilho);
    document.body.removeChild(gatilho);
  });

  it('move o foco para dentro do diálogo ao abrir (primeiro elemento focável — "Fechar", no cabeçalho)', () => {
    render(
      <Sobreposicao titulo="Configurações" aberta={true} aoFechar={() => {}}>
        <button type="button">Ação interna</button>
      </Sobreposicao>,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar' }));
  });

  it('mantém o foco preso no diálogo: Tab a partir do último elemento volta ao primeiro', () => {
    render(
      <Sobreposicao titulo="Configurações" aberta={true} aoFechar={() => {}}>
        <button type="button">Ação interna</button>
      </Sobreposicao>,
    );

    const botaoFechar = screen.getByRole('button', { name: 'Fechar' });
    const botaoAcao = screen.getByRole('button', { name: 'Ação interna' });

    // Ordem de DOM: Fechar (cabeçalho) vem antes de "Ação interna" (corpo) —
    // então o último focável é "Ação interna". Tab a partir dele deve voltar
    // ao primeiro focável, "Fechar".
    botaoAcao.focus();
    expect(document.activeElement).toBe(botaoAcao);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(botaoFechar);
  });

  it('mantém o foco preso no diálogo: Shift+Tab a partir do primeiro elemento vai ao último', () => {
    render(
      <Sobreposicao titulo="Configurações" aberta={true} aoFechar={() => {}}>
        <button type="button">Ação interna</button>
      </Sobreposicao>,
    );

    const botaoFechar = screen.getByRole('button', { name: 'Fechar' });
    const botaoAcao = screen.getByRole('button', { name: 'Ação interna' });

    botaoFechar.focus();
    expect(document.activeElement).toBe(botaoFechar);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(botaoAcao);
  });
});
