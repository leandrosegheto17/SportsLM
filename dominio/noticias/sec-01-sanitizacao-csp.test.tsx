// dominio/noticias/sec-01-sanitizacao-csp.test.ts — SEC-01 (TASK.md Lote 12)
//
// Tarefa de auditoria + fechamento de lacuna (ADR-011): confirma, com um
// teste de injeção (XSS) de ponta a ponta num item de feed mockado, que a
// cadeia ING-N-02 (normalização) → renderização (UI-T02-03/CartaoIngresso)
// nunca deixa um payload de script sobreviver — nem como tag executável, nem
// como `innerHTML` bruto — e que a meta CSP declarada em `app/index.html`
// (ADR-011 passo 9) está presente com `connect-src 'self'`.
//
// Não reimplementa a suíte já existente de `normalizador-item.test.ts`
// (que já cobre `<script>`, `javascript:` href e double-encoding em nível de
// unidade) — este arquivo fecha a lacuna que faltava: um teste que vai até o
// DOM renderizado de verdade (`CartaoIngresso`, `@testing-library/react`)
// com um payload de injeção completo, e a verificação da meta CSP publicada.

// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizarItem, type ItemBrutoFeed } from './index';
import { CartaoIngresso } from '../../app/design-system/CartaoIngresso';

const diretorioAtual = dirname(fileURLToPath(import.meta.url));
const AGORA = new Date('2026-09-06T15:00:00.000Z');

/** Payload de injeção "de manual": tag `<script>` executável, handler inline
 * (`onerror`) e um `href` com esquema `javascript:` no mesmo item — as três
 * formas mais comuns de XSS a partir de conteúdo de terceiro (ADR-011,
 * contexto). */
const ITEM_MALICIOSO: ItemBrutoFeed = {
  fonteId: 'ge',
  feedId: 'ge-futebol',
  tituloBruto:
    'Notícia <script>window.__xss = true;</script><img src=x onerror="window.__xss = true">',
  resumoBruto: 'Resumo <svg onload="window.__xss = true"></svg> normal',
  linkBruto: 'javascript:window.__xss = true', // ADR-011 passo 2: descarta o item inteiro
  publicadoEmBruto: '2026-09-06T12:00:00Z',
};

describe('SEC-01 — sanitização e CSP na prática (ADR-011)', () => {
  afterEach(() => {
    cleanup();
    delete (globalThis as { __xss?: boolean }).__xss;
  });

  it('item de feed com payload de injeção completo é descartado (link fora de http(s))', () => {
    // O `link` malicioso (`javascript:`) já é motivo de descarte do item
    // inteiro (ADR-011 passo 2) — nem chega a ser candidato a renderização.
    expect(normalizarItem(ITEM_MALICIOSO, AGORA)).toBeNull();
  });

  it('mesmo com link http(s) válido, título/resumo maliciosos nunca sobrevivem à normalização', () => {
    const resultado = normalizarItem(
      { ...ITEM_MALICIOSO, linkBruto: 'https://ge.globo.com/materia/xss' },
      AGORA,
    );

    expect(resultado).not.toBeNull();
    expect(resultado?.titulo).not.toContain('<script');
    expect(resultado?.titulo).not.toContain('onerror');
    expect(resultado?.titulo).not.toContain('<img');
    expect(resultado?.resumo).not.toContain('<svg');
    expect(resultado?.resumo).not.toContain('onload');
  });

  it('renderizado em CartaoIngresso (DOM real), o item sanitizado nunca executa script nem injeta HTML', () => {
    const resultado = normalizarItem(
      { ...ITEM_MALICIOSO, linkBruto: 'https://ge.globo.com/materia/xss' },
      AGORA,
    );
    if (resultado === null) {
      throw new Error('item deveria sobreviver à normalização com link válido');
    }

    render(
      <CartaoIngresso
        href={resultado.link}
        destino="externo"
        rotuloEtiqueta="futebol"
        fonte={resultado.fonteId}
        tempo="há 8 min"
        titulo={resultado.titulo}
        resumo={resultado.resumo}
        variante="normal"
      />,
    );

    // Nenhum <script>/<img>/<svg> foi injetado no DOM real (React só criou
    // nós de texto para titulo/resumo — nunca `dangerouslySetInnerHTML`).
    const link = screen.getByRole('link');
    expect(link.querySelector('script')).toBeNull();
    expect(link.querySelector('img')).toBeNull();
    expect(link.querySelector('svg')).toBeNull();
    // Nenhum handler malicioso rodou (seria detectável por esta flag global).
    expect((globalThis as { __xss?: boolean }).__xss).toBeUndefined();
    // O texto bruto do payload aparece, no máximo, como texto inerte — nunca
    // como marcação — dentro do próprio cartão.
    expect(link.innerHTML).not.toContain('<script');
    expect(link.innerHTML).not.toContain('onerror=');
    expect(link.innerHTML).not.toContain('onload=');
  });

  it('link externo do CartaoIngresso sempre tem rel="noopener noreferrer" (ADR-011 passo 8)', () => {
    render(
      <CartaoIngresso
        href="https://ge.globo.com/materia/1"
        destino="externo"
        rotuloEtiqueta="futebol"
        fonte="ge"
        tempo="há 8 min"
        titulo="Título normal"
        variante="normal"
      />,
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('nenhum arquivo do projeto usa dangerouslySetInnerHTML fora de comentários/documentação (ADR-011 passo 7/GUARDRAILS §4)', async () => {
    // Verificação estática simples e determinística (sem depender de ESLint
    // customizado): varre `app/` e `dominio/` por ocorrências reais de uso
    // do atributo JSX (não em comentário) — o único achado esperado hoje é a
    // menção em prosa dentro do comentário de `BlocoPreto.tsx`.
    const { readdirSync, readFileSync: lerArquivo, statSync } = await import('node:fs');
    const raizApp = resolve(diretorioAtual, '../../app');
    const raizDominio = resolve(diretorioAtual, '../../dominio');

    function coletarArquivos(dir: string): string[] {
      const entradas = readdirSync(dir);
      const arquivos: string[] = [];
      for (const entrada of entradas) {
        const caminho = resolve(dir, entrada);
        const stat = statSync(caminho);
        if (stat.isDirectory()) {
          arquivos.push(...coletarArquivos(caminho));
        } else if (
          /\.(tsx?|jsx?)$/.test(entrada) &&
          !entrada.endsWith('.test.tsx') &&
          !entrada.endsWith('.test.ts')
        ) {
          arquivos.push(caminho);
        }
      }
      return arquivos;
    }

    const arquivos = [...coletarArquivos(raizApp), ...coletarArquivos(raizDominio)];
    const usosReais: string[] = [];

    for (const arquivo of arquivos) {
      const conteudo = lerArquivo(arquivo, 'utf-8');
      // Uso real de JSX é `dangerouslySetInnerHTML={` — a menção em prosa de
      // `BlocoPreto.tsx` está dentro de um comentário de bloco, sem `={`.
      if (/dangerouslySetInnerHTML\s*=\s*\{/.test(conteudo)) {
        usosReais.push(arquivo);
      }
    }

    expect(usosReais).toEqual([]);
  });
});

describe('SEC-01 — meta CSP em app/index.html (ADR-011 passo 9)', () => {
  const indexHtml = readFileSync(
    resolve(diretorioAtual, '../../app/index.html'),
    'utf-8',
  );
  const metaCspMatch = indexHtml.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/,
  );
  const csp = metaCspMatch?.[1] ?? '';

  it('declara Content-Security-Policy via <meta http-equiv>', () => {
    expect(metaCspMatch).not.toBeNull();
    expect(csp.length).toBeGreaterThan(0);
  });

  it("connect-src restrito a 'self' (mais host de telemetria opcional documentado)", () => {
    expect(csp).toMatch(/connect-src 'self'/);
    // Nenhum host externo autorizado por padrão — telemetria fica como
    // placeholder comentado até TEL-01 escolher o provedor.
    expect(csp).not.toMatch(/connect-src[^;]*https?:\/\//);
  });

  it("script-src estrito ('self', sem unsafe-inline/unsafe-eval) — o vetor real do ADR-011", () => {
    expect(csp).toMatch(/script-src 'self';/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
  });

  it("object-src e base-uri travados a 'none' (defesa em profundidade)", () => {
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/base-uri 'none'/);
  });

  it('host de telemetria fica documentado como placeholder comentado, não ativo (TEL-01 ainda não define o provedor)', () => {
    expect(indexHtml).toMatch(/<!--\s*connect-src 'self' https:\/\/<host-de-telemetria/);
  });
});
