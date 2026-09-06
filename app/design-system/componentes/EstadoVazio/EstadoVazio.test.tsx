// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EstadoVazio } from './EstadoVazio';

describe('EstadoVazio (UI-DS-07B)', () => {
  afterEach(() => {
    cleanup();
  });

  it('exibe título e texto literais, e o ícone é decorativo', () => {
    render(
      <EstadoVazio
        icone="⚽"
        titulo="Escolha até 3 esportes favoritos"
        texto="Para ver o que mais te interessa aqui."
      />,
    );
    expect(screen.getByText('Escolha até 3 esportes favoritos')).not.toBeNull();
    expect(screen.getByText('Para ver o que mais te interessa aqui.')).not.toBeNull();
    expect(screen.getByText('⚽').getAttribute('aria-hidden')).toBe('true');
  });

  it('dispara a ação quando fornecida', () => {
    const aoClicar = vi.fn();
    render(
      <EstadoVazio
        titulo="Escolha seu time"
        texto="Para ver o painel com todos os campeonatos do ano."
        acao={{ rotulo: 'ESCOLHER MEU TIME', aoClicar }}
      />,
    );
    screen.getByRole('button', { name: 'ESCOLHER MEU TIME' }).click();
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it('não renderiza ação nem ícone quando ausentes', () => {
    render(<EstadoVazio titulo="Sem jogos" texto="Não há jogos marcados no momento." />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
