// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Abas } from './Abas';

const ABAS = [
  { id: 'ativas', rotulo: 'Ativas' },
  { id: 'bloqueadas', rotulo: 'Bloqueadas' },
  { id: 'instaveis', rotulo: 'Instáveis' },
];

describe('Abas (UI-DS-07A)', () => {
  afterEach(() => {
    cleanup();
  });

  it('marca a aba ativa com aria-selected', () => {
    render(
      <Abas
        abas={ABAS}
        abaAtivaId="ativas"
        aoMudarAba={() => {}}
        rotuloGrupo="Fontes de notícia"
      />,
    );
    expect(
      screen.getByRole('tab', { name: 'Ativas' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      screen.getByRole('tab', { name: 'Bloqueadas' }).getAttribute('aria-selected'),
    ).toBe('false');
  });

  it('muda de aba por clique', () => {
    const aoMudarAba = vi.fn();
    render(
      <Abas
        abas={ABAS}
        abaAtivaId="ativas"
        aoMudarAba={aoMudarAba}
        rotuloGrupo="Fontes de notícia"
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Bloqueadas' }));
    expect(aoMudarAba).toHaveBeenCalledWith('bloqueadas');
  });

  it('é operável por teclado: seta direita move e ativa a próxima aba', () => {
    const aoMudarAba = vi.fn();
    render(
      <Abas
        abas={ABAS}
        abaAtivaId="ativas"
        aoMudarAba={aoMudarAba}
        rotuloGrupo="Fontes de notícia"
      />,
    );
    const primeira = screen.getByRole('tab', { name: 'Ativas' });
    primeira.focus();
    fireEvent.keyDown(primeira, { key: 'ArrowRight' });
    expect(aoMudarAba).toHaveBeenCalledWith('bloqueadas');
  });

  it('é operável por teclado: seta esquerda a partir da primeira aba circula para a última', () => {
    const aoMudarAba = vi.fn();
    render(
      <Abas
        abas={ABAS}
        abaAtivaId="ativas"
        aoMudarAba={aoMudarAba}
        rotuloGrupo="Fontes de notícia"
      />,
    );
    const primeira = screen.getByRole('tab', { name: 'Ativas' });
    primeira.focus();
    fireEvent.keyDown(primeira, { key: 'ArrowLeft' });
    expect(aoMudarAba).toHaveBeenCalledWith('instaveis');
  });

  it('é operável por teclado: End vai para a última aba, Home para a primeira', () => {
    const aoMudarAba = vi.fn();
    render(
      <Abas
        abas={ABAS}
        abaAtivaId="ativas"
        aoMudarAba={aoMudarAba}
        rotuloGrupo="Fontes de notícia"
      />,
    );
    const primeira = screen.getByRole('tab', { name: 'Ativas' });
    primeira.focus();
    fireEvent.keyDown(primeira, { key: 'End' });
    expect(aoMudarAba).toHaveBeenCalledWith('instaveis');
    fireEvent.keyDown(primeira, { key: 'Home' });
    expect(aoMudarAba).toHaveBeenCalledWith('ativas');
  });

  it('só a aba ativa tem tabindex 0 (roving tabindex — nunca duas paradas de Tab)', () => {
    render(
      <Abas
        abas={ABAS}
        abaAtivaId="bloqueadas"
        aoMudarAba={() => {}}
        rotuloGrupo="Fontes de notícia"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Ativas' }).getAttribute('tabindex')).toBe(
      '-1',
    );
    expect(screen.getByRole('tab', { name: 'Bloqueadas' }).getAttribute('tabindex')).toBe(
      '0',
    );
    expect(screen.getByRole('tab', { name: 'Instáveis' }).getAttribute('tabindex')).toBe(
      '-1',
    );
  });
});
