// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TabelaClassificacao,
  type LinhaTabelaClassificacao,
} from './TabelaClassificacao';

const LINHAS: readonly LinhaTabelaClassificacao[] = [
  {
    posicao: 1,
    clubeId: 'palmeiras',
    siglaClube: 'PAL',
    nomeClube: 'Palmeiras',
    pontos: 47,
    jogos: 23,
    v: 14,
    e: 5,
    d: 4,
    gp: 42,
    gc: 21,
    sg: 21,
    aproveitamento: 68.1,
    corIdentidade: '#006437',
    zona: { token: 'libertadores', rotulo: 'LIBERTADORES' },
  },
  {
    posicao: 6,
    clubeId: 'sao-paulo',
    siglaClube: 'SPA',
    nomeClube: 'São Paulo',
    pontos: 42,
    jogos: 23,
    v: 11,
    e: 9,
    d: 3,
    gp: 36,
    gc: 22,
    sg: 14,
    aproveitamento: 61.4,
    corIdentidade: '#E30613',
    ehTimeDoUsuario: true,
    zona: null,
  },
  {
    posicao: 20,
    clubeId: 'sport',
    siglaClube: 'SPT',
    nomeClube: 'Sport',
    pontos: 18,
    jogos: 23,
    v: 4,
    e: 6,
    d: 13,
    gp: 20,
    gc: 45,
    sg: -25,
    aproveitamento: 26.1,
    zona: { token: 'rebaixamento', rotulo: 'REBAIXAMENTO' },
  },
];

describe('TabelaClassificacao (UI-DS-07B)', () => {
  afterEach(() => {
    cleanup();
  });

  it('é uma <table> real com <caption> dinâmico', () => {
    render(
      <TabelaClassificacao
        legenda="Classificação — Brasileirão Série A, 24ª rodada"
        linhas={LINHAS}
      />,
    );
    const tabela = screen.getByRole('table');
    expect(tabela).not.toBeNull();
    expect(
      screen.getByText('Classificação — Brasileirão Série A, 24ª rodada'),
    ).not.toBeNull();
    expect(tabela.querySelector('caption')).not.toBeNull();
  });

  it('cabeçalho usa scope="col" e a coluna de clube usa scope="row"', () => {
    render(<TabelaClassificacao legenda="Tabela" linhas={LINHAS} variante="completa" />);
    const colunas = screen.getAllByRole('columnheader');
    expect(colunas.length).toBeGreaterThan(0);
    colunas.forEach((coluna) => expect(coluna.getAttribute('scope')).toBe('col'));

    const linhas = screen.getAllByRole('row').slice(1); // exclui o cabeçalho
    linhas.forEach((linha) => {
      const cabecalhoDaLinha = within(linha).getByRole('rowheader');
      expect(cabecalhoDaLinha.getAttribute('scope')).toBe('row');
    });
  });

  it('a linha do time do usuário tem aria-current e não depende só de cor', () => {
    render(<TabelaClassificacao legenda="Tabela" linhas={LINHAS} />);
    const linhaSaoPaulo = screen.getByText(/São Paulo/).closest('tr');
    expect(linhaSaoPaulo).not.toBeNull();
    expect(linhaSaoPaulo?.getAttribute('aria-current')).toBe('true');
    // pista textual paralela à cor/estilo da linha:
    expect(within(linhaSaoPaulo as HTMLElement).getByText('(seu time)')).not.toBeNull();

    const linhaPalmeiras = screen.getByText(/Palmeiras/).closest('tr');
    expect(linhaPalmeiras?.getAttribute('aria-current')).toBeNull();
  });

  it('zona configurada vem com legenda textual (CA-18.1), nunca só a faixa de cor', () => {
    render(
      <TabelaClassificacao
        legenda="Tabela"
        linhas={LINHAS}
        legendaZonas={[
          { token: 'libertadores', rotulo: 'LIBERTADORES' },
          { token: 'rebaixamento', rotulo: 'REBAIXAMENTO' },
        ]}
      />,
    );
    expect(screen.getByLabelText('Legenda de zonas da tabela')).not.toBeNull();
    expect(screen.getByText('LIBERTADORES')).not.toBeNull();
    expect(screen.getByText('REBAIXAMENTO')).not.toBeNull();
  });

  it('sem zonas configuradas: sem faixa e sem legenda, sem mensagem de erro (CA-18.2)', () => {
    render(<TabelaClassificacao legenda="Tabela" linhas={LINHAS} />);
    expect(screen.queryByLabelText('Legenda de zonas da tabela')).toBeNull();
    expect(screen.queryByText(/erro/i)).toBeNull();
  });

  it('variante reduzida omite V/E/D/GP/GC; completa exibe todas as colunas', () => {
    const { unmount } = render(
      <TabelaClassificacao legenda="Tabela" linhas={LINHAS} variante="reduzida" />,
    );
    expect(screen.queryByRole('columnheader', { name: 'V' })).toBeNull();
    unmount();

    render(<TabelaClassificacao legenda="Tabela" linhas={LINHAS} variante="completa" />);
    expect(screen.getByRole('columnheader', { name: 'V' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'GC' })).not.toBeNull();
  });

  it('formata o aproveitamento como percentual com vírgula decimal', () => {
    render(<TabelaClassificacao legenda="Tabela" linhas={LINHAS} />);
    expect(screen.getByText('68,1%')).not.toBeNull();
  });
});
