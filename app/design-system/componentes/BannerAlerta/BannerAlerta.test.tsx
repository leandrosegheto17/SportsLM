// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BannerAlerta } from './BannerAlerta';

describe('BannerAlerta (UI-DS-07B)', () => {
  afterEach(() => {
    cleanup();
  });

  it('variante alerta tem prefixo textual "ATENÇÃO" distinto de erro', () => {
    render(<BannerAlerta variante="alerta" texto="1 fonte instável: UOL Esporte" />);
    expect(screen.getByText('ATENÇÃO:')).not.toBeNull();
    expect(screen.getByRole('alert').textContent).toContain(
      '1 fonte instável: UOL Esporte',
    );
  });

  it('variante erro tem prefixo textual "ERRO" (mesmo ícone de alerta, texto diferente)', () => {
    render(
      <BannerAlerta
        variante="erro"
        texto="Não conseguimos carregar as notícias agora."
      />,
    );
    expect(screen.getByText('ERRO:')).not.toBeNull();
  });

  it('variante informação usa role="status" e não exige prefixo', () => {
    render(<BannerAlerta variante="informacao" texto="Verificando…" />);
    expect(screen.getByRole('status').textContent).toContain('Verificando…');
  });

  it('renderiza a ação opcional e dispara o callback', () => {
    const aoClicar = vi.fn();
    render(
      <BannerAlerta
        variante="erro"
        texto="Não conseguimos carregar o painel agora."
        acao={{ rotulo: 'TENTAR DE NOVO', aoClicar }}
      />,
    );
    screen.getByRole('button', { name: 'TENTAR DE NOVO' }).click();
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it('não renderiza botão de ação quando ela não é fornecida', () => {
    render(<BannerAlerta variante="informacao" texto="Sem ação" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
