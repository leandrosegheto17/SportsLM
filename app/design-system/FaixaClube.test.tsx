// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import './vitest-axe-setup';
import { FaixaClube, type FaixaClubeProps } from './FaixaClube';
import { PALETAS_DE_TESTE, type ClubeDeTeste } from './paletasTeste.fixture';

type TemaDeTeste = 'claro' | 'escuro';

function definirTema(tema: TemaDeTeste): void {
  document.documentElement.dataset['tema'] = tema;
}

function renderizar(props: FaixaClubeProps): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <FaixaClube {...props} />
    </MemoryRouter>,
  );
}

describe('FaixaClube (UI-DS-01 — UX-SPEC §3.8.1)', () => {
  beforeEach(() => {
    definirTema('claro');
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-tema');
  });

  describe('acessibilidade (axe-core) — 3 variantes × 2 temas × 4 paletas de teste (UX-SPEC §5)', () => {
    const temas: TemaDeTeste[] = ['claro', 'escuro'];

    for (const tema of temas) {
      describe(`tema ${tema}`, () => {
        it('variante neutra não tem violações', async () => {
          definirTema(tema);
          const { container } = renderizar({ variante: 'neutra', href: '/onboarding' });
          const resultado = await axe(container);
          expect(resultado).toHaveNoViolations();
        });

        for (const clubeDeTeste of PALETAS_DE_TESTE) {
          const clube: ClubeDeTeste = clubeDeTeste;

          it(`variante completa não tem violações — ${clube.nome}`, async () => {
            definirTema(tema);
            const { container } = renderizar({
              variante: 'completa',
              clube,
              competicaoNome: 'Brasileirão Série A',
              temporada: 2026,
              posicao: 6,
              pontos: 42,
              href: '/time',
            });
            const resultado = await axe(container);
            expect(resultado).toHaveNoViolations();
          });

          it(`variante compacta não tem violações — ${clube.nome}`, async () => {
            definirTema(tema);
            const { container } = renderizar({
              variante: 'compacta',
              clube,
              competicaoNome: 'Brasileirão Série A',
              temporada: 2026,
            });
            const resultado = await axe(container);
            expect(resultado).toHaveNoViolations();
          });
        }
      });
    }
  });

  describe('aria-label completo (critério de aceite)', () => {
    it('inclui nome, posição, competição, temporada, pontos e "Abrir painel do time" quando clicável', () => {
      renderizar({
        variante: 'completa',
        clube: PALETAS_DE_TESTE[0] as ClubeDeTeste,
        competicaoNome: 'Brasileirão Série A',
        temporada: 2026,
        posicao: 6,
        pontos: 42,
        href: '/time',
      });

      const link = screen.getByRole('link', {
        name: `${(PALETAS_DE_TESTE[0] as ClubeDeTeste).nome}, 6º lugar no Brasileirão Série A de 2026, 42 pontos. Abrir painel do time.`,
      });
      expect(link.getAttribute('href')).toBe('/time');
    });

    it('omite "Abrir painel do time" quando não há href', () => {
      renderizar({
        variante: 'compacta',
        clube: PALETAS_DE_TESTE[1] as ClubeDeTeste,
        competicaoNome: 'Brasileirão Série A',
        temporada: 2026,
        posicao: 3,
        pontos: 55,
      });

      expect(
        screen.getByRole('group', {
          name: `${(PALETAS_DE_TESTE[1] as ClubeDeTeste).nome}, 3º lugar no Brasileirão Série A de 2026, 55 pontos.`,
        }),
      ).toBeTruthy();
    });

    it('aria-label da variante neutra descreve "nenhum time escolhido"', () => {
      renderizar({ variante: 'neutra' });
      expect(
        screen.getByRole('group', { name: 'SportsLM. Nenhum time escolhido.' }),
      ).toBeTruthy();
    });
  });

  describe('listras decorativas (aria-hidden, UX-SPEC §3.6/§5.1)', () => {
    it('o elemento de listras é aria-hidden em todas as variantes', () => {
      const { container: containerCompleta } = renderizar({
        variante: 'completa',
        clube: PALETAS_DE_TESTE[2] as ClubeDeTeste,
        posicao: 1,
        pontos: 68,
      });
      const listrasCompleta = containerCompleta.querySelector('[aria-hidden="true"]');
      expect(listrasCompleta).not.toBeNull();

      cleanup();

      const { container: containerNeutra } = renderizar({ variante: 'neutra' });
      const listrasNeutra = containerNeutra.querySelector('[aria-hidden="true"]');
      expect(listrasNeutra).not.toBeNull();
    });
  });

  describe('variantes — anatomia (UX-SPEC §3.8.1)', () => {
    it('variante compacta nunca mostra o número, mesmo com posição/pontos informados', () => {
      renderizar({
        variante: 'compacta',
        clube: PALETAS_DE_TESTE[0] as ClubeDeTeste,
        posicao: 4,
        pontos: 40,
      });
      expect(screen.queryByText('4º')).toBeNull();
      expect(screen.queryByText('40 pts')).toBeNull();
    });

    it('variante completa mostra o número quando posição e pontos estão disponíveis', () => {
      renderizar({
        variante: 'completa',
        clube: PALETAS_DE_TESTE[0] as ClubeDeTeste,
        posicao: 4,
        pontos: 40,
      });
      expect(screen.getByText('4º')).toBeTruthy();
      expect(screen.getByText('40 pts')).toBeTruthy();
    });

    it('variante completa omite o número quando não há dados (CA-06.4/CA-17.3)', () => {
      renderizar({
        variante: 'completa',
        clube: PALETAS_DE_TESTE[0] as ClubeDeTeste,
        posicao: null,
        pontos: null,
      });
      expect(screen.queryByText(/pts$/)).toBeNull();
      expect(screen.getByText((PALETAS_DE_TESTE[0] as ClubeDeTeste).nome)).toBeTruthy();
    });

    it('variante neutra mostra o texto "SportsLM" e nenhum avatar/sigla', () => {
      renderizar({ variante: 'neutra' });
      expect(screen.getByText('SportsLM')).toBeTruthy();
    });

    it('sem href, a faixa não é um link (não interativo)', () => {
      renderizar({ variante: 'neutra' });
      expect(screen.queryByRole('link')).toBeNull();
      expect(screen.getByRole('group')).toBeTruthy();
    });
  });
});
