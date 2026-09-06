// @vitest-environment jsdom
// app/rotas/sobreposicoes/Configuracoes/SecaoFontesDeNoticia.test.tsx —
// UI-T03-01 (TASK.md Lote 9)
//
// Cobre CA-01.1 (5 fontes, nome + esportes + estado), CA-01.2 (instável
// desde), CA-02.1/CA-02.2 (alternar bloqueio) e CA-02.3 (GE nunca
// apresentado como acionável — nenhum controle, não um controle desabilitado).

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecaoFontesDeNoticia, type FonteCatalogo } from './SecaoFontesDeNoticia';

const NOMES_ESPORTES = {
  futebol: 'Futebol',
  formula1: 'Fórmula 1',
  mma: 'MMA',
  basquete: 'Basquete',
  tenis: 'Tênis',
};

const FONTES: readonly FonteCatalogo[] = [
  {
    id: 'ge',
    nome: 'GE — ge.globo',
    fixa: true,
    esportesCobertos: [
      'futebol',
      'formula1',
      'mma',
      'basquete',
      'tenis',
      'a',
      'b',
      'c',
      'd',
      'e',
    ],
  },
  {
    id: 'espn-brasil',
    nome: 'ESPN Brasil',
    fixa: false,
    esportesCobertos: ['futebol', 'formula1', 'mma', 'basquete', 'tenis'],
  },
  {
    id: 'terra-esportes',
    nome: 'Terra Esportes',
    fixa: false,
    esportesCobertos: ['futebol', 'formula1'],
  },
];

describe('SecaoFontesDeNoticia (UI-T03-01)', () => {
  afterEach(() => {
    cleanup();
  });

  it('lista as fontes com nome e esportes cobertos (CA-01.1)', () => {
    render(
      <SecaoFontesDeNoticia
        fontes={FONTES}
        nomesEsportes={NOMES_ESPORTES}
        fontesBloqueadas={[]}
        aoAlternarFonte={() => {}}
      />,
    );

    expect(screen.getByText('GE — ge.globo')).toBeTruthy();
    expect(screen.getByText('Multi-esporte')).toBeTruthy();
    expect(screen.getByText('Futebol, Fórmula 1, MMA, Basquete, Tênis')).toBeTruthy();
  });

  it('a fonte fixa (GE) não expõe nenhum controle acionável (CA-02.3)', () => {
    render(
      <SecaoFontesDeNoticia
        fontes={FONTES}
        nomesEsportes={NOMES_ESPORTES}
        fontesBloqueadas={[]}
        aoAlternarFonte={() => {}}
      />,
    );

    // Nem um `<button>`, nem um `role="switch"` — nenhum elemento focável
    // associado ao GE. Diferente de "existe mas está desabilitado".
    expect(screen.queryByRole('switch', { name: 'GE — ge.globo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'GE — ge.globo' })).toBeNull();
    expect(screen.getByText('FONTE FIXA')).toBeTruthy();
    expect(
      screen.getByText('O GE é fonte fixa do SportsLM e não pode ser bloqueado.'),
    ).toBeTruthy();
  });

  it('as fontes bloqueáveis têm alternador operável (CA-02.1/CA-02.2)', () => {
    const aoAlternarFonte = vi.fn();
    render(
      <SecaoFontesDeNoticia
        fontes={FONTES}
        nomesEsportes={NOMES_ESPORTES}
        fontesBloqueadas={['terra-esportes']}
        aoAlternarFonte={aoAlternarFonte}
      />,
    );

    const espn = screen.getByRole('switch', { name: 'ESPN Brasil' });
    expect(espn.getAttribute('aria-checked')).toBe('true');
    espn.click();
    expect(aoAlternarFonte).toHaveBeenCalledWith('espn-brasil');

    const terra = screen.getByRole('switch', { name: 'Terra Esportes' });
    expect(terra.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Futebol, Fórmula 1 · Bloqueada')).toBeTruthy();
  });

  it('mostra "instável desde <data/hora>" sem remover a fonte (CA-01.2)', () => {
    render(
      <SecaoFontesDeNoticia
        fontes={FONTES}
        nomesEsportes={NOMES_ESPORTES}
        fontesBloqueadas={[]}
        aoAlternarFonte={() => {}}
        statusFontes={{
          'espn-brasil': { instavel: true, instavelDesde: '2026-09-04T09:12:00-03:00' },
        }}
      />,
    );

    expect(screen.getByText('⚠ Instável desde 04/09, 09h12')).toBeTruthy();
    // A fonte continua listada normalmente, com seu alternador.
    expect(screen.getByRole('switch', { name: 'ESPN Brasil' })).toBeTruthy();
  });

  it('mostra "Verificando…" enquanto o status ainda não chegou', () => {
    render(
      <SecaoFontesDeNoticia
        fontes={FONTES}
        nomesEsportes={NOMES_ESPORTES}
        fontesBloqueadas={[]}
        aoAlternarFonte={() => {}}
        carregandoStatus
      />,
    );

    expect(screen.getAllByText('Verificando…').length).toBeGreaterThan(0);
  });

  it('mostra o aviso de erro de verificação sem impedir o bloqueio (CA-13-adjacente/T-03 Erro)', () => {
    render(
      <SecaoFontesDeNoticia
        fontes={FONTES}
        nomesEsportes={NOMES_ESPORTES}
        fontesBloqueadas={[]}
        aoAlternarFonte={() => {}}
        erroStatus
      />,
    );

    const banner = screen.getByRole('status');
    expect(
      within(banner).getByText(/Não conseguimos verificar o estado das fontes agora/),
    ).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'ESPN Brasil' })).toBeTruthy();
  });
});
