// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LinhaPartida } from './LinhaPartida';

function envolverEmLista(elemento: ReactElement): ReactElement {
  return <ul>{elemento}</ul>;
}

describe('LinhaPartida (UI-DS-07B)', () => {
  afterEach(() => {
    cleanup();
  });

  it('variante disputada mostra letra + texto do resultado, não só a cor da barra (CA-08.6)', () => {
    render(
      envolverEmLista(
        <LinhaPartida
          variante="disputada"
          data="SÁB, 05/09"
          rodadaOuFase="23ª RODADA"
          resultado="V"
          mandante="São Paulo"
          visitante="Atlético-MG"
          placarMandante={2}
          placarVisitante={1}
          mando="casa"
        />,
      ),
    );
    expect(screen.getByText('(V)')).not.toBeNull();
    expect(screen.getByText('Vitória:')).not.toBeNull();
    expect(screen.getByText(/São Paulo 2 × 1 Atlético-MG · casa/)).not.toBeNull();
  });

  it('variante próxima mostra data, horário, confronto, mando e estádio (CA-08.7)', () => {
    render(
      envolverEmLista(
        <LinhaPartida
          variante="proxima"
          data="DOM, 13/09"
          horario="16H00"
          rodadaOuFase="24ª RODADA"
          mandante="Fluminense"
          visitante="São Paulo"
          mando="fora"
          estadio="Maracanã"
        />,
      ),
    );
    expect(screen.getByText(/DOM, 13\/09 · 16H00 · 24ª RODADA/)).not.toBeNull();
    expect(screen.getByText(/Fluminense × São Paulo · fora · Maracanã/)).not.toBeNull();
  });

  it('variante sem-horario mostra "HORÁRIO A DEFINIR" (CA-08.8)', () => {
    render(
      envolverEmLista(
        <LinhaPartida
          variante="sem-horario"
          data="SÁB, 19/09"
          rodadaOuFase="25ª RODADA"
          mandante="São Paulo"
          visitante="Vasco"
          mando="casa"
        />,
      ),
    );
    expect(screen.getByText(/HORÁRIO A DEFINIR/)).not.toBeNull();
  });

  it('variante sem-data mostra "DATA A DEFINIR" (CA-10.4)', () => {
    render(
      envolverEmLista(
        <LinhaPartida
          variante="sem-data"
          rodadaOuFase="26ª RODADA"
          mandante="Bahia"
          visitante="São Paulo"
          mando="fora"
        />,
      ),
    );
    expect(screen.getByText(/DATA A DEFINIR/)).not.toBeNull();
  });

  it('variante aguardando mostra ícone decorativo + texto "AGUARDANDO RESULTADO" (CA-08.10)', () => {
    const { container } = render(
      envolverEmLista(
        <LinhaPartida
          variante="aguardando"
          data="sex, 04/09"
          rodadaOuFase="23ª rodada"
          mandante="Ceará"
          visitante="São Paulo"
        />,
      ),
    );
    expect(screen.getByText('AGUARDANDO RESULTADO')).not.toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('variante adiada mostra a nova data (CA-08.9)', () => {
    render(
      envolverEmLista(
        <LinhaPartida
          variante="adiada"
          novaData="21/10"
          mandante="São Paulo"
          visitante="Internacional"
          mando="casa"
        />,
      ),
    );
    expect(screen.getByText(/ADIADA — NOVA DATA: 21\/10/)).not.toBeNull();
  });

  it('variante cancelada mostra o texto "Cancelada" (CA-08.9)', () => {
    render(
      envolverEmLista(
        <LinhaPartida variante="cancelada" mandante="São Paulo" visitante="Grêmio" />,
      ),
    );
    expect(screen.getByText('Cancelada')).not.toBeNull();
  });
});
