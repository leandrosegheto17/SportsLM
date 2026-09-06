// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usarTema } from './usarTema';
import { CHAVE_ARMAZENAMENTO_TEMA } from './tema';

type Escutador = (evento: Partial<MediaQueryListEvent>) => void;

function mockarMatchMedia(prefereEscuroInicial: boolean): {
  dispararMudanca: (prefereEscuro: boolean) => void;
} {
  let escutadores: Escutador[] = [];
  let atual = prefereEscuroInicial;

  window.matchMedia = vi.fn().mockImplementation((consulta: string) => ({
    matches: atual,
    media: consulta,
    addEventListener: (_tipo: string, escutador: Escutador) => {
      escutadores.push(escutador);
    },
    removeEventListener: (_tipo: string, escutador: Escutador) => {
      escutadores = escutadores.filter((item) => item !== escutador);
    },
  }));

  return {
    dispararMudanca: (prefereEscuro: boolean) => {
      atual = prefereEscuro;
      escutadores.forEach((escutador) => escutador({ matches: prefereEscuro }));
    },
  };
}

describe('usarTema (FUND-05 — troca de tema sem F5)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-tema');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aplica "claro" por padrão quando não há preferência salva nem o sistema prefere escuro', () => {
    mockarMatchMedia(false);
    renderHook(() => usarTema());

    expect(document.documentElement.dataset['tema']).toBe('claro');
  });

  it('segue prefers-color-scheme quando a preferência é "sistema"', () => {
    mockarMatchMedia(true);
    renderHook(() => usarTema());

    expect(document.documentElement.dataset['tema']).toBe('escuro');
  });

  it('usa a preferência salva em localStorage ao montar', () => {
    mockarMatchMedia(false);
    localStorage.setItem(
      CHAVE_ARMAZENAMENTO_TEMA,
      JSON.stringify({ versaoEsquema: 1, preferencia: 'escuro' }),
    );

    renderHook(() => usarTema());

    expect(document.documentElement.dataset['tema']).toBe('escuro');
  });

  it('troca de tema imediatamente ao chamar definirPreferencia, sem F5', () => {
    mockarMatchMedia(false);
    const { result } = renderHook(() => usarTema());

    expect(document.documentElement.dataset['tema']).toBe('claro');

    act(() => {
      result.current.definirPreferencia('escuro');
    });

    expect(result.current.temaEfetivo).toBe('escuro');
    expect(document.documentElement.dataset['tema']).toBe('escuro');
    expect(JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO_TEMA) as string)).toEqual({
      versaoEsquema: 1,
      preferencia: 'escuro',
    });
  });

  it('reage a mudança de prefers-color-scheme do sistema operacional enquanto a preferência é "sistema"', () => {
    const { dispararMudanca } = mockarMatchMedia(false);
    renderHook(() => usarTema());

    expect(document.documentElement.dataset['tema']).toBe('claro');

    act(() => {
      dispararMudanca(true);
    });

    expect(document.documentElement.dataset['tema']).toBe('escuro');
  });

  it('ignora mudança do sistema depois que o usuário fixou uma preferência explícita', () => {
    const { dispararMudanca } = mockarMatchMedia(false);
    const { result } = renderHook(() => usarTema());

    act(() => {
      result.current.definirPreferencia('claro');
    });

    act(() => {
      dispararMudanca(true);
    });

    expect(document.documentElement.dataset['tema']).toBe('claro');
  });
});
