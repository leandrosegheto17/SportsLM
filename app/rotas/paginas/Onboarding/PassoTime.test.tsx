// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClubeCatalogo } from './catalogoOnboarding';
import { PassoTime } from './PassoTime';

const CLUBES: ClubeCatalogo[] = [
  { id: 'sao-paulo', nomeCurto: 'São Paulo', sigla: 'SPA', corBase: '#E30613' },
  { id: 'palmeiras', nomeCurto: 'Palmeiras', sigla: 'PAL', corBase: '#006437' },
  { id: 'corinthians', nomeCurto: 'Corinthians', sigla: 'COR', corBase: '#000000' },
];

function renderizar(
  timeSelecionado: string | null = null,
  sobrescritas: Partial<Parameters<typeof PassoTime>[0]> = {},
) {
  const aoSelecionar = vi.fn();
  const aoConfirmar = vi.fn();
  const aoPular = vi.fn();
  const aoVoltar = vi.fn();
  render(
    <PassoTime
      clubes={CLUBES}
      timeSelecionado={timeSelecionado}
      aoSelecionar={aoSelecionar}
      aoConfirmar={aoConfirmar}
      aoPular={aoPular}
      aoVoltar={aoVoltar}
      {...sobrescritas}
    />,
  );
  return { aoSelecionar, aoConfirmar, aoPular, aoVoltar };
}

describe('PassoTime (UI-T01-02 — T-01 passo 2 de 2, time do coração)', () => {
  afterEach(() => {
    cleanup();
  });

  it('CA-06.1: lista os clubes recebidos, com nome e busca por nome', () => {
    renderizar();
    expect(screen.getByText('QUAL É O SEU TIME?')).toBeTruthy();
    for (const clube of CLUBES) {
      expect(screen.getByText(clube.nomeCurto)).toBeTruthy();
    }
  });

  it('estado vazio: [ Confirmar ] fica desabilitado sem seleção', () => {
    renderizar(null);
    expect(
      screen.getByRole('button', { name: 'Confirmar' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('estado preenchido: rádio marcado e [ Confirmar ] habilitado (UX-SPEC §4/T-01)', () => {
    renderizar('sao-paulo');
    const radio = screen.getByRole('radio', { name: 'São Paulo' }) as HTMLInputElement;
    expect(radio.checked).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Confirmar' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('selecionar um clube chama aoSelecionar com o id', () => {
    const { aoSelecionar } = renderizar();
    fireEvent.click(screen.getByRole('radio', { name: 'Palmeiras' }));
    expect(aoSelecionar).toHaveBeenCalledWith('palmeiras');
  });

  it('busca por nome filtra a lista (CA-06.1)', () => {
    renderizar();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar time' }), {
      target: { value: 'palm' },
    });
    expect(screen.getByText('Palmeiras')).toBeTruthy();
    expect(screen.queryByText('São Paulo')).toBeNull();
  });

  it('busca por sigla também filtra', () => {
    renderizar();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar time' }), {
      target: { value: 'cor' },
    });
    expect(screen.getByText('Corinthians')).toBeTruthy();
    expect(screen.queryByText('Palmeiras')).toBeNull();
  });

  it('busca sem resultado mostra o texto canônico de T-04 (reaproveitado, mesmo componente de busca+lista)', () => {
    renderizar();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar time' }), {
      target: { value: 'flamengo do sul' },
    });
    expect(
      screen.getByText(
        'Nenhum clube encontrado para "flamengo do sul". A lista tem os 20 clubes da Série A de 2026.',
      ),
    ).toBeTruthy();
  });

  it('"Confirmar", "Pular" e "Voltar" chamam os manipuladores recebidos', () => {
    const { aoConfirmar, aoPular, aoVoltar } = renderizar('sao-paulo');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(aoConfirmar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
    expect(aoPular).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao passo 1' }));
    expect(aoVoltar).toHaveBeenCalledTimes(1);
  });
});
