// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SeloFonte } from './SeloFonte';

describe('SeloFonte (UI-DS-07B)', () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    ['ativa', 'ATIVA'],
    ['bloqueada', 'BLOQUEADA'],
    ['instavel', 'INSTÁVEL'],
    ['fixa', 'FONTE FIXA'],
  ] as const)(
    'estado %s tem texto "%s" (não só a cor do ponto)',
    (estado, textoEsperado) => {
      render(<SeloFonte nome="Gazeta Esportiva" estado={estado} />);
      expect(screen.getByText(textoEsperado)).not.toBeNull();
      expect(screen.getByText('Gazeta Esportiva')).not.toBeNull();
    },
  );

  it('o ponto de estado é decorativo (aria-hidden)', () => {
    const { container } = render(<SeloFonte nome="GE" estado="fixa" />);
    const ponto = container.querySelector('[aria-hidden="true"]');
    expect(ponto).not.toBeNull();
  });
});
