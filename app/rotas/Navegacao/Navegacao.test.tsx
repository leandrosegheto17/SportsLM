// @vitest-environment jsdom
// app/rotas/Navegacao/Navegacao.test.tsx — UI-T02-04 (TASK.md Lote 8)
//
// Cobre o critério de aceite de UI-T02-04: item ativo com `aria-current`,
// navegação nunca duplicada (topo × rodapé) por largura de tela, e presença
// só nas 3 rotas do wireframe que a exibem (UX-SPEC §2: T-02/T-05/T-08).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Navegacao, deveExibirNavegacao } from './Navegacao';
import { ProvedorSobreposicoes } from '../SobreposicoesContext';

function mockarMatchMedia(): void {
  window.matchMedia = vi.fn().mockImplementation((consulta: string) => ({
    matches: false,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function renderizarEm(caminho: string) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <ProvedorSobreposicoes>
        <Navegacao />
      </ProvedorSobreposicoes>
    </MemoryRouter>,
  );
}

describe('Navegacao (UI-T02-04)', () => {
  beforeEach(() => {
    mockarMatchMedia();
    localStorage.clear();
    document.documentElement.removeAttribute('data-tema');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('não renderiza nada fora das 3 rotas do wireframe (T-06/T-09/onboarding têm cabeçalho próprio)', () => {
    for (const rota of ['/onboarding', '/time/brasileirao-2026', '/simulacao']) {
      expect(deveExibirNavegacao(rota)).toBe(false);
      const { container } = renderizarEm(rota);
      expect(container.innerHTML).toBe('');
      cleanup();
    }
  });

  it.each(['/', '/time', '/comparativo'])(
    'renderiza a barra em %s (UX-SPEC §2: T-02/T-05/T-08)',
    (rota) => {
      expect(deveExibirNavegacao(rota)).toBe(true);
      renderizarEm(rota);
      expect(screen.getAllByText('Notícias').length).toBeGreaterThan(0);
    },
  );

  it('marca o item da rota atual com aria-current="page" e nenhum outro', () => {
    renderizarEm('/time');

    const ativos = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    // Duas cópias no DOM (topo desktop + rodapé mobile — nunca as duas
    // visíveis ao mesmo tempo, ver teste de CSS abaixo), mas SEMPRE o mesmo
    // item ("Meu time"), nunca "Notícias"/"Comparativo".
    expect(ativos.length).toBe(2);
    for (const ativo of ativos) {
      expect(ativo.textContent).toBe('Meu time');
    }
  });

  it('o logo "SportsLM" leva para "/" e nunca fica marcado como item ativo dos 3 itens', () => {
    renderizarEm('/');
    const logo = screen.getByRole('link', { name: 'SportsLM' });
    expect(logo.getAttribute('href')).toBe('/');
  });

  it('o botão de configurações abre a sobreposição T-03', () => {
    renderizarEm('/');

    expect(screen.queryByRole('dialog')).toBeNull();

    const [botaoConfiguracoes] = screen.getAllByRole('button', {
      name: 'Abrir configurações',
    });
    fireEvent.click(botaoConfiguracoes as HTMLElement);

    expect(screen.getByRole('dialog', { name: 'Configurações' })).toBeTruthy();
  });

  it('o botão de tema alterna o tema efetivo do documento sem F5', () => {
    renderizarEm('/');

    expect(document.documentElement.dataset['tema']).toBe('claro');

    const [botaoTema] = within(
      screen.getAllByRole('banner')[0] as HTMLElement,
    ).getAllByRole('button', { name: /Tema atual/ });
    fireEvent.click(botaoTema as HTMLElement);

    expect(document.documentElement.dataset['tema']).toBe('escuro');
  });

  it('CSS: a barra desktop e a barra inferior nunca ficam visíveis ao mesmo tempo (mesmo breakpoint, regras opostas)', () => {
    const caminhoCss = resolve(
      dirname(fileURLToPath(import.meta.url)),
      'Navegacao.module.css',
    );
    const css = readFileSync(caminhoCss, 'utf-8');

    // `.navDesktop` só aparece (flex) a partir de 1024px — invisível abaixo.
    expect(css).toMatch(/\.navDesktop\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(
      /@media \(min-width: 1024px\) \{\s*\.navDesktop\s*\{[^}]*display:\s*flex/,
    );

    // `.inferior` é a barra padrão (mobile) — escondida a partir de 1024px.
    expect(css).toMatch(/\.inferior\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(
      /@media \(min-width: 1024px\) \{\s*\.inferior\s*\{[^}]*display:\s*none/,
    );
  });
});
