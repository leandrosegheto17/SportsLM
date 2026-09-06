// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AvatarClube } from './AvatarClube';

describe('AvatarClube (UI-DS-07B)', () => {
  afterEach(() => {
    cleanup();
  });

  it('exibe a sigla como texto (sem escudo — decisão TASK.md §6 item 7)', () => {
    render(<AvatarClube sigla="SPA" tamanho={44} nomeClube="São Paulo" />);
    expect(screen.getByText('SPA')).not.toBeNull();
  });

  it('usa o nome do clube como nome acessível quando fornecido', () => {
    render(<AvatarClube sigla="PAL" tamanho={32} nomeClube="Palmeiras" />);
    expect(screen.getByRole('img', { name: 'Palmeiras' })).not.toBeNull();
  });

  it('usa a própria sigla como nome acessível quando nomeClube está ausente', () => {
    render(<AvatarClube sigla="COR" tamanho={28} />);
    expect(screen.getByRole('img', { name: 'COR' })).not.toBeNull();
  });

  it.each([28, 32, 44] as const)('aceita o tamanho %ipx', (tamanho) => {
    const { container } = render(<AvatarClube sigla="BOT" tamanho={tamanho} />);
    const avatar = container.querySelector(`[data-tamanho="${tamanho}"]`);
    expect(avatar).not.toBeNull();
    expect((avatar as HTMLElement).style.width).toBe(`${tamanho}px`);
  });

  it('aplica override inline de cor quando fornecido (comparativo com clubes diferentes)', () => {
    const { container } = render(
      <AvatarClube
        sigla="FLA"
        tamanho={44}
        corIdentidade="#E30613"
        corIdentidadeTexto="#FFFFFF"
      />,
    );
    const avatar = container.querySelector('[data-tamanho="44"]') as HTMLElement;
    expect(avatar.style.getPropertyValue('--clube-identidade')).toBe('#E30613');
    expect(avatar.style.getPropertyValue('--clube-identidade-texto')).toBe('#FFFFFF');
  });
});
