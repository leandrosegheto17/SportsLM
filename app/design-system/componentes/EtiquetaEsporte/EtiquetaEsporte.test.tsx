// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EtiquetaEsporte } from './EtiquetaEsporte';

describe('EtiquetaEsporte (UI-DS-07B)', () => {
  afterEach(() => {
    cleanup();
  });

  it('exibe o rótulo do esporte como texto (não só cor)', () => {
    render(<EtiquetaEsporte esporte="futebol" rotulo="FUTEBOL" />);
    expect(screen.getByText('FUTEBOL')).not.toBeNull();
  });

  it('aceita a variante GERAL (UX-SPEC §3.8: "15 esportes + GERAL")', () => {
    render(<EtiquetaEsporte esporte="geral" rotulo="GERAL" />);
    expect(screen.getByText('GERAL')).not.toBeNull();
  });

  it('marca o esporte em data-esporte, sem depender de cor para o teste', () => {
    const { container } = render(
      <EtiquetaEsporte esporte="basquete" rotulo="BASQUETE" />,
    );
    expect(container.querySelector('[data-esporte="basquete"]')).not.toBeNull();
  });
});
