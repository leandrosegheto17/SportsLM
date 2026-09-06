// @vitest-environment jsdom
// app/rotas/sobreposicoes/Configuracoes/SecaoAparencia.test.tsx — UI-T03-02
// (TASK.md Lote 9)
//
// Critério de aceite explícito de UI-T03-02: "troca de tema persiste
// (`sportslm.tema.v1`)". `usarTema`/`app/tema/tema.ts` já cobrem a lógica por
// tabela (FUND-05) — aqui confirmamos só a integração de UI.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAVE_ARMAZENAMENTO_TEMA } from '../../../tema/tema';
import { SecaoAparencia } from './SecaoAparencia';

type Escutador = (evento: Partial<MediaQueryListEvent>) => void;

function mockarMatchMedia(prefereEscuro: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((consulta: string) => ({
    matches: prefereEscuro,
    media: consulta,
    addEventListener: (_tipo: string, _escutador: Escutador) => {},
    removeEventListener: (_tipo: string, _escutador: Escutador) => {},
  }));
}

describe('SecaoAparencia (UI-T03-02)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-tema');
    mockarMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('mostra as 3 opções, com "Igual ao sistema" marcada por padrão', () => {
    render(<SecaoAparencia />);

    const opcaoSistema = screen.getByRole('radio', { name: 'Igual ao sistema' });
    expect((opcaoSistema as HTMLInputElement).checked).toBe(true);
  });

  it('troca para "Escuro" e persiste em sportslm.tema.v1, sem F5', () => {
    render(<SecaoAparencia />);

    fireEvent.click(screen.getByRole('radio', { name: 'Escuro' }));

    expect(document.documentElement.dataset['tema']).toBe('escuro');
    expect(JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO_TEMA) as string)).toEqual({
      versaoEsquema: 1,
      preferencia: 'escuro',
    });
    expect(
      (screen.getByRole('radio', { name: 'Escuro' }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('troca para "Claro" corretamente', () => {
    render(<SecaoAparencia />);

    fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));

    expect(document.documentElement.dataset['tema']).toBe('claro');
    expect(
      (screen.getByRole('radio', { name: 'Claro' }) as HTMLInputElement).checked,
    ).toBe(true);
  });
});
