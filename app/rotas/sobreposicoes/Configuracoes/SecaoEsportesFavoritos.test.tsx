// @vitest-environment jsdom
// app/rotas/sobreposicoes/Configuracoes/SecaoEsportesFavoritos.test.tsx —
// UI-T03-02 (TASK.md Lote 9)
//
// Cobre a "mesma regra do onboarding" (RN-06/CA-03.3): até 3 favoritos, 4ª
// tentativa bloqueada com o texto canônico via `aria-live`.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EsporteId } from '../../../../dominio/tipos';
import { MENSAGEM_LIMITE_FAVORITOS } from '../../paginas/Onboarding/PassoFavoritos';
import { SecaoEsportesFavoritos } from './SecaoEsportesFavoritos';

const ESPORTES: ReadonlyArray<{ id: EsporteId; nome: string }> = [
  { id: 'futebol', nome: 'Futebol' },
  { id: 'volei-quadra', nome: 'Vôlei' },
  { id: 'formula1', nome: 'Fórmula 1' },
  { id: 'basquete', nome: 'Basquete' },
];

afterEach(() => {
  cleanup();
});

describe('SecaoEsportesFavoritos (UI-T03-02)', () => {
  it('mostra o contador e os chips selecionados', () => {
    render(
      <SecaoEsportesFavoritos
        esportes={ESPORTES}
        favoritos={['futebol', 'volei-quadra']}
        aoAlternar={() => {}}
      />,
    );

    expect(screen.getByText('2 DE 3')).toBeTruthy();
    // "✓" fica dentro de um `<span aria-hidden="true">` (Chip, UI-DS-07A) —
    // não entra no nome acessível, só é pista visual redundante (WCAG 1.4.1).
    const chip = screen.getByRole('button', { name: 'Futebol' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('chama aoAlternar ao clicar num chip livre', () => {
    const aoAlternar = vi.fn();
    render(
      <SecaoEsportesFavoritos
        esportes={ESPORTES}
        favoritos={[]}
        aoAlternar={aoAlternar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));
    expect(aoAlternar).toHaveBeenCalledWith('futebol');
  });

  it('bloqueia a 4ª tentativa e anuncia o texto canônico de CA-03.3', () => {
    const aoAlternar = vi.fn();
    render(
      <SecaoEsportesFavoritos
        esportes={ESPORTES}
        favoritos={['futebol', 'volei-quadra', 'formula1']}
        aoAlternar={aoAlternar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Basquete' }));

    expect(aoAlternar).not.toHaveBeenCalled();
    expect(screen.getByText(MENSAGEM_LIMITE_FAVORITOS)).toBeTruthy();
  });

  it('ainda permite desmarcar um favorito com o limite atingido', () => {
    const aoAlternar = vi.fn();
    render(
      <SecaoEsportesFavoritos
        esportes={ESPORTES}
        favoritos={['futebol', 'volei-quadra', 'formula1']}
        aoAlternar={aoAlternar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));
    expect(aoAlternar).toHaveBeenCalledWith('futebol');
  });
});
