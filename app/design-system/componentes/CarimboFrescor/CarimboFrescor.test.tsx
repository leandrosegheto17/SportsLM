// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CarimboFrescor } from './CarimboFrescor';

describe('CarimboFrescor (UI-DS-07B)', () => {
  afterEach(() => {
    cleanup();
  });

  it('estado normal usa <time> com o texto canônico (CA-17.1)', () => {
    render(
      <CarimboFrescor
        estado="normal"
        texto="atualizado há 12 minutos"
        dataHoraIso="2026-09-06T10:00:00-03:00"
      />,
    );
    const elemento = screen.getByText('atualizado há 12 minutos');
    expect(elemento.tagName).toBe('TIME');
    expect(elemento.getAttribute('dateTime')).toBe('2026-09-06T10:00:00-03:00');
  });

  it('estado alerta usa ícone diferente (⚠) do estado normal (ⓘ) — não só cor (CA-17.2)', () => {
    const { container: containerNormal } = render(
      <CarimboFrescor estado="normal" texto="atualizado há 2 minutos" />,
    );
    const { container: containerAlerta } = render(
      <CarimboFrescor
        estado="alerta"
        texto="ATUALIZADO HÁ 7 H — PODE ESTAR DESATUALIZADO"
      />,
    );
    expect(containerNormal.textContent).toContain('ⓘ');
    expect(containerAlerta.textContent).toContain('⚠');
    expect(
      screen.getByText('ATUALIZADO HÁ 7 H — PODE ESTAR DESATUALIZADO'),
    ).not.toBeNull();
  });

  it('estado sem-dados não exige dataHoraIso e ainda assim exibe o texto (CA-17.3)', () => {
    render(
      <CarimboFrescor estado="sem-dados" texto="Sem dados disponíveis no momento." />,
    );
    expect(screen.getByText('Sem dados disponíveis no momento.').tagName).toBe('SPAN');
  });

  it('estado pausado exibe a mensagem de pausa por cota (CA-17.4)', () => {
    render(
      <CarimboFrescor
        estado="pausado"
        texto="Atualização pausada por limite do provedor. Última atualização há 3 h."
      />,
    );
    expect(
      screen.getByText(
        'Atualização pausada por limite do provedor. Última atualização há 3 h.',
      ),
    ).not.toBeNull();
  });
});
