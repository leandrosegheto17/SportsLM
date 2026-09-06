// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CartaoIngresso, type PropriedadesCartaoIngresso } from './CartaoIngresso';

const diretorioAtual = dirname(fileURLToPath(import.meta.url));

function propsPadrao(
  parciais: Partial<PropriedadesCartaoIngresso> = {},
): PropriedadesCartaoIngresso {
  return {
    href: 'https://ge.globo.com/noticia-exemplo',
    destino: 'externo',
    rotuloEtiqueta: 'futebol',
    fonte: 'ge',
    tempo: 'há 8 min',
    titulo: 'São Paulo vence o Atlético-MG por 2 a 1',
    resumo: 'Resumo de exemplo da notícia, até três linhas de texto corrido.',
    variante: 'normal',
    ...parciais,
  };
}

describe('CartaoIngresso (UI-DS-03 — UX-SPEC §3.8.3)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza como link externo, em nova aba, com aria-label incluindo "abre em nova aba" (UX-SPEC §5.7)', () => {
    render(<CartaoIngresso {...propsPadrao()} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://ge.globo.com/noticia-exemplo');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('aria-label')).toBe(
      'São Paulo vence o Atlético-MG por 2 a 1 — ge — abre em nova aba',
    );
  });

  it('CA-04.2: mostra título, fonte, esporte e horário juntos, com link externo abrindo fora do produto', () => {
    render(
      <CartaoIngresso
        {...propsPadrao({
          rotuloEtiqueta: 'futebol',
          fonte: 'ge',
          tempo: 'há 8 min',
          titulo: 'São Paulo vence o Atlético-MG por 2 a 1',
          href: 'https://ge.globo.com/noticia-exemplo',
          destino: 'externo',
        })}
      />,
    );

    // Título, fonte, esporte (etiqueta) e horário — todos visíveis (CA-04.2).
    expect(screen.getByText('São Paulo vence o Atlético-MG por 2 a 1')).toBeTruthy();
    expect(screen.getByText('futebol')).toBeTruthy();
    expect(screen.getByText('ge')).toBeTruthy();
    expect(screen.getByText('há 8 min')).toBeTruthy();

    // Link para o original, abrindo fora do produto (RN-02).
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://ge.globo.com/noticia-exemplo');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renderiza como link interno (react-router) sem "abre em nova aba" quando destino é campeonato', () => {
    render(
      <MemoryRouter>
        <CartaoIngresso
          {...propsPadrao({
            destino: 'interno',
            href: '/time/campeonato-x',
            rotuloEtiqueta: 'Brasileirão Série A',
            fonte: 'football-data.org',
            variante: 'normal',
            origemCorBarra: 'clube',
            corBarra: 'var(--clube-identidade)',
          })}
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/time/campeonato-x');
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('aria-label')).toBe(
      'São Paulo vence o Atlético-MG por 2 a 1 — football-data.org',
    );
  });

  it('aceita aria-label explícito, sobrescrevendo o padrão derivado', () => {
    render(<CartaoIngresso {...propsPadrao({ ariaLabel: 'Rótulo customizado' })} />);
    expect(screen.getByRole('link').getAttribute('aria-label')).toBe(
      'Rótulo customizado',
    );
  });

  it.each([
    ['normal', 'futebol'],
    ['agrupado', 'futebol'],
    ['horario-estimado', 'vôlei'],
    ['encerrado', 'basquete'],
    ['sem-dados', 'tênis'],
  ] as const)(
    'variante "%s" sempre mostra a etiqueta textual (WCAG 1.4.1 — cor nunca é a única pista)',
    (variante, rotuloEtiqueta) => {
      render(
        <CartaoIngresso
          {...propsPadrao({ variante, rotuloEtiqueta, quantidadeFontesAgrupadas: 2 })}
        />,
      );
      expect(screen.getByText(rotuloEtiqueta)).toBeTruthy();
    },
  );

  it('variante "agrupado" mostra "também em: +N fontes" (CA-19.1)', () => {
    render(
      <CartaoIngresso
        {...propsPadrao({ variante: 'agrupado', quantidadeFontesAgrupadas: 3 })}
      />,
    );
    expect(screen.getByText('também em: +3 fontes')).toBeTruthy();
  });

  it('não mostra "também em" quando quantidadeFontesAgrupadas está ausente', () => {
    render(<CartaoIngresso {...propsPadrao({ variante: 'agrupado' })} />);
    expect(screen.queryByText(/também em/)).toBeNull();
  });

  it('variante "horario-estimado" mostra o ícone (aria-hidden) e o texto canônico "horário estimado" (Diretriz #9, UX-SPEC §1.4/§3.7)', () => {
    render(<CartaoIngresso {...propsPadrao({ variante: 'horario-estimado' })} />);
    expect(screen.getByText('horário estimado')).toBeTruthy();
    const icone = screen.getByText('ⓘ');
    expect(icone.getAttribute('aria-hidden')).toBe('true');
  });

  it('variante "encerrado" mostra o rótulo textual "encerrado", não só a cor da barra', () => {
    const { container } = render(
      <CartaoIngresso {...propsPadrao({ variante: 'encerrado' })} />,
    );
    expect(screen.getByText('encerrado')).toBeTruthy();
    const link = container.querySelector('a');
    expect(link?.className).toMatch(/barraEncerrada/);
    expect(link?.className).not.toMatch(/barraEsporte|barraClube/);
  });

  it('variante "sem-dados" mostra o rótulo textual "sem dados", com barra tracejada (sem preenchimento de cor)', () => {
    const { container } = render(
      <CartaoIngresso {...propsPadrao({ variante: 'sem-dados' })} />,
    );
    expect(screen.getByText('sem dados')).toBeTruthy();
    const link = container.querySelector('a');
    expect(link?.className).toMatch(/barraSemDados/);
  });

  it('injeta a cor resolvida pelo chamador via custom property, sem literal nesta camada', () => {
    const { container } = render(
      <CartaoIngresso
        {...propsPadrao({
          origemCorBarra: 'esporte',
          corBarra: 'var(--zona-libertadores)',
        })}
      />,
    );
    const link = container.querySelector('a') as HTMLElement;
    expect(link.style.getPropertyValue('--cartao-cor-barra')).toBe(
      'var(--zona-libertadores)',
    );
  });

  it('não aplica --cartao-cor-barra nas variantes "encerrado"/"sem-dados" (cor fixa do sistema, não a do chamador)', () => {
    const { container } = render(
      <CartaoIngresso {...propsPadrao({ variante: 'encerrado', corBarra: '#ff00ff' })} />,
    );
    const link = container.querySelector('a') as HTMLElement;
    expect(link.style.getPropertyValue('--cartao-cor-barra')).toBe('');
  });

  it('omite o parágrafo de resumo quando ausente/nulo', () => {
    render(<CartaoIngresso {...propsPadrao({ resumo: null })} />);
    expect(screen.queryByText(/Resumo de exemplo/)).toBeNull();
  });

  it('alvo de toque: a classe .cartao define min-height com o token --alvo-toque-minimo (44px)', () => {
    const conteudoCss = readFileSync(
      resolve(diretorioAtual, 'CartaoIngresso.module.css'),
      'utf-8',
    );
    expect(conteudoCss).toMatch(
      /\.cartao\s*{[^}]*min-height:\s*var\(--alvo-toque-minimo\)/s,
    );

    const conteudoTokens = readFileSync(resolve(diretorioAtual, 'tokens.css'), 'utf-8');
    expect(conteudoTokens).toMatch(/--alvo-toque-minimo:\s*44px/);
  });

  it('não declara valor literal de cor/tamanho fora de tokens.css, exceto a custom property documentada --cartao-cor-barra', () => {
    const conteudoCss = readFileSync(
      resolve(diretorioAtual, 'CartaoIngresso.module.css'),
      'utf-8',
    );
    // Remove comentários de bloco antes de varrer por literais.
    const semComentarios = conteudoCss.replace(/\/\*[\s\S]*?\*\//g, '');
    // Nenhuma cor hex literal.
    expect(semComentarios).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // Nenhum tamanho em px/em/rem fora de uma função var(...): remove todo
    // trecho `var(...)` de cada linha e confere que não sobra px/em/rem.
    const linhasSemVar = semComentarios
      .split('\n')
      .map((linha) => linha.replace(/var\([^)]*\)/g, ''));
    const linhasComValorDeTamanhoLiteral = linhasSemVar.filter((linha) =>
      /\d(px|em|rem)\b/.test(linha),
    );
    expect(linhasComValorDeTamanhoLiteral).toEqual([]);
  });
});
