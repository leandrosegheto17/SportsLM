// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarraPontuacao } from './BarraPontuacao';

/**
 * Testes de UI-DS-06 (UX-SPEC §3.8.6). Critério de aceite: "`aria-label`
 * sempre inclui nome do clube e valor numérico".
 */
describe('BarraPontuacao (UI-DS-06)', () => {
  it('expõe role="img" com aria-label contendo nome do clube e valor', () => {
    render(<BarraPontuacao nomeClube="Palmeiras" valor={47} valorMaximo={47} />);

    expect(screen.getByRole('img', { name: 'Palmeiras, 47 pontos' })).not.toBeNull();
  });

  it('usa a unidade customizada quando informada', () => {
    render(
      <BarraPontuacao
        nomeClube="São Paulo"
        valor={12}
        valorMaximo={20}
        unidade="vitórias"
      />,
    );

    expect(screen.getByRole('img', { name: 'São Paulo, 12 vitórias' })).not.toBeNull();
  });

  it('mostra o valor numérico como texto visível, redundante à barra (WCAG 1.4.1)', () => {
    render(<BarraPontuacao nomeClube="Flamengo" valor={58} valorMaximo={58} />);

    expect(screen.getByText('58')).not.toBeNull();
    expect(screen.getByText('Flamengo')).not.toBeNull();
  });

  it.each([
    { valor: 47, valorMaximo: 47, esperado: '100%' },
    { valor: 0, valorMaximo: 47, esperado: '0%' },
    { valor: 23, valorMaximo: 46, esperado: '50%' },
  ])(
    'calcula o preenchimento como percentual do valor máximo da comparação ($valor/$valorMaximo)',
    ({ valor, valorMaximo, esperado }) => {
      const { container } = render(
        <BarraPontuacao nomeClube="Clube" valor={valor} valorMaximo={valorMaximo} />,
      );

      const preenchimento = container.querySelector('div[style]');
      expect(preenchimento).not.toBeNull();
      expect((preenchimento as HTMLDivElement).style.width).toBe(esperado);
    },
  );

  it('não quebra quando o valor máximo da tela é zero (nenhum clube pontuou ainda)', () => {
    const { container } = render(
      <BarraPontuacao nomeClube="Clube" valor={0} valorMaximo={0} />,
    );

    const preenchimento = container.querySelector('div[style]');
    expect((preenchimento as HTMLDivElement).style.width).toBe('0%');
  });

  it('usa o rótulo visível customizado quando informado, mantendo aria-label com o nome real do clube', () => {
    render(
      <BarraPontuacao
        nomeClube="Grêmio"
        rotuloVisivel="GRÊ"
        valor={30}
        valorMaximo={40}
      />,
    );

    expect(screen.getByText('GRÊ')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Grêmio, 30 pontos' })).not.toBeNull();
  });
});
