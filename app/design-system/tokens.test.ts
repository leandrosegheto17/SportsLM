import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const caminhoTokens = resolve(dirname(fileURLToPath(import.meta.url)), 'tokens.css');
const conteudo = readFileSync(caminhoTokens, 'utf-8');

/**
 * Verificação mecânica do critério de aceite de FUND-05: "Todos os tokens da
 * Seção 3.2-3.6 do UX-SPEC existem como custom property". Lista extraída
 * literalmente das tabelas de `.md/UX-SPEC.md` §3.2 (claro), §3.3 (escuro),
 * §3.4 (clube), §3.5 (tipografia) e §3.6 (espaçamento/raio/sombra/alvo).
 */
const TOKENS_ESPERADOS = [
  // §3.2 — cores do sistema, tema claro
  '--cor-fundo',
  '--cor-superficie',
  '--cor-superficie-2',
  '--cor-borda',
  '--cor-borda-forte',
  '--cor-tinta',
  '--cor-texto-secundario',
  '--cor-nav',
  '--cor-nav-texto',
  '--cor-nav-texto-ativo',
  '--cor-aviso-fundo',
  '--cor-aviso-texto',
  '--cor-erro-fundo',
  '--cor-erro-texto',
  '--cor-vitoria',
  '--cor-empate',
  '--cor-derrota',
  '--cor-foco',
  '--cor-esmaecido',
  '--zona-libertadores',
  '--zona-pre-libertadores',
  '--zona-sul-americana',
  '--zona-rebaixamento',
  // §3.4 — cores de clube (seis tokens derivados)
  '--clube-identidade',
  '--clube-faixa-b',
  '--clube-identidade-texto',
  '--clube-acento',
  '--clube-acento-sobre-escuro',
  '--clube-suave',
  '--clube-suave-escuro',
  // §3.5 — tipografia
  '--txt-camisa',
  '--txt-camisa-sm',
  '--txt-display',
  '--txt-titulo',
  '--txt-manchete',
  '--txt-manchete-sec',
  '--txt-dado',
  '--txt-corpo',
  '--txt-corpo-sm',
  '--txt-rotulo',
  '--txt-meta',
  // §3.6 — espaçamento, raio, sombra, alvo
  '--esp-1',
  '--esp-2',
  '--esp-3',
  '--esp-4',
  '--esp-5',
  '--esp-6',
  '--esp-7',
  '--esp-8',
  '--raio-sm',
  '--raio-md',
  '--raio-pill',
  '--sombra-overlay',
  '--alvo-toque-minimo',
];

describe('tokens.css (FUND-05 — UX-SPEC §3.2-3.6)', () => {
  it.each(TOKENS_ESPERADOS)('declara a custom property %s', (token) => {
    const padrao = new RegExp(`${token}\\s*:`);
    expect(conteudo).toMatch(padrao);
  });

  it('define os valores do tema escuro sob :root[data-tema="escuro"] (§3.3)', () => {
    expect(conteudo).toMatch(/:root\[data-tema=['"]escuro['"]\]/);
  });

  it('reduz a duração de transição sob prefers-reduced-motion (§3.6)', () => {
    expect(conteudo).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('não declara os tokens de tema claro e escuro com o mesmo valor de --cor-fundo', () => {
    const marcadorTemaEscuro = ":root[data-tema='escuro'] {";
    const [blocoRaiz, blocoEscuro] = conteudo.split(marcadorTemaEscuro) as [
      string,
      string,
    ];

    const valorClaro = /--cor-fundo:\s*(#[0-9a-fA-F]+)/.exec(blocoRaiz)?.[1];
    const valorEscuro = /--cor-fundo:\s*(#[0-9a-fA-F]+)/.exec(blocoEscuro)?.[1];

    expect(valorClaro).toBeDefined();
    expect(valorEscuro).toBeDefined();
    expect(valorClaro).not.toBe(valorEscuro);
  });
});
