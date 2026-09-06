// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampoBusca } from './CampoBusca';

describe('CampoBusca (UI-DS-07A)', () => {
  afterEach(() => {
    cleanup();
  });

  it('variante vazia: sem botão de limpar', () => {
    render(<CampoBusca rotulo="Buscar clube" valor="" aoMudar={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).toBeNull();
  });

  it('é operável por teclado: recebe foco e aceita digitação', () => {
    const aoMudar = vi.fn();
    render(<CampoBusca rotulo="Buscar clube" valor="" aoMudar={aoMudar} />);
    const entrada = screen.getByRole('searchbox', { name: 'Buscar clube' });
    entrada.focus();
    expect(document.activeElement).toBe(entrada);
    fireEvent.change(entrada, { target: { value: 'Palm' } });
    expect(aoMudar).toHaveBeenCalledWith('Palm');
  });

  it('variante preenchida: botão "✕" limpa o valor, operável por teclado', () => {
    const aoMudar = vi.fn();
    render(<CampoBusca rotulo="Buscar clube" valor="Palmeiras" aoMudar={aoMudar} />);
    const botaoLimpar = screen.getByRole('button', { name: 'Limpar busca' });
    botaoLimpar.focus();
    expect(document.activeElement).toBe(botaoLimpar);
    fireEvent.click(botaoLimpar);
    expect(aoMudar).toHaveBeenCalledWith('');
  });

  it('variante sem resultado: anuncia via role="status"', () => {
    render(
      <CampoBusca
        rotulo="Buscar clube"
        valor="Zzz"
        aoMudar={() => {}}
        semResultado
        mensagemSemResultado="Nenhum resultado encontrado."
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('Nenhum resultado encontrado.');
  });
});
