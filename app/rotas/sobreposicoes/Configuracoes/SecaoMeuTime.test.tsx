// @vitest-environment jsdom
// app/rotas/sobreposicoes/Configuracoes/SecaoMeuTime.test.tsx — UI-T03-02
// (TASK.md Lote 9)

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecaoMeuTime } from './SecaoMeuTime';

afterEach(() => {
  cleanup();
});

describe('SecaoMeuTime (UI-T03-02)', () => {
  it('mostra o clube escolhido e aciona "aoTrocar" no botão Trocar', () => {
    const aoTrocar = vi.fn();
    render(
      <SecaoMeuTime
        clube={{ id: 'spa', nomeCurto: 'São Paulo', sigla: 'SPA', corBase: '#c0392b' }}
        aoTrocar={aoTrocar}
      />,
    );

    expect(screen.getByText('São Paulo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar' }));
    expect(aoTrocar).toHaveBeenCalledTimes(1);
  });

  it('convida a escolher um time quando não há clube (CA-14.3)', () => {
    const aoTrocar = vi.fn();
    render(<SecaoMeuTime clube={null} aoTrocar={aoTrocar} />);

    expect(screen.getByText('Nenhum time escolhido.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Escolher time' }));
    expect(aoTrocar).toHaveBeenCalledTimes(1);
  });
});
