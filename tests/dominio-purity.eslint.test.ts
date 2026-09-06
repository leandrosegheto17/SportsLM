// tests/dominio-purity.eslint.test.ts
//
// Prova, em CI, que a regra de lint de FUND-01 efetivamente bloqueia dentro de
// `dominio/` os quatro imports/usos proibidos pelo SDD §2.1 / GUARDRAILS.md §5:
// rede, `localStorage`, React e `Date.now()`. Também prova que código
// legítimo (relógio por parâmetro) passa limpo — não é regra que
// superbloqueia.
//
// Usa a API programática do ESLint com o `eslint.config.js` real do projeto
// (não uma cópia da config), lintando código-fixture em memória com
// `filePath` dentro de `dominio/` para casar com o bloco de overrides.

import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

function criarLinter(): ESLint {
  return new ESLint({ cwd: process.cwd() });
}

async function ruleIdsPara(codigo: string, caminhoFicticio: string): Promise<string[]> {
  const eslint = criarLinter();
  const [resultado] = await eslint.lintText(codigo, { filePath: caminhoFicticio });
  return (resultado?.messages ?? []).map((m) => m.ruleId ?? '');
}

describe('dominio/ é puro — regra de lint (FUND-01, SDD §2.1)', () => {
  it('bloqueia import de React dentro de dominio/', async () => {
    const codigo = `import React from 'react';\nexport const x = React;\n`;
    const regras = await ruleIdsPara(codigo, 'dominio/exemplo-react.ts');
    expect(regras).toContain('no-restricted-imports');
  });

  it('bloqueia import de react-router-dom dentro de dominio/', async () => {
    const codigo = `import { useNavigate } from 'react-router-dom';\nexport const f = useNavigate;\n`;
    const regras = await ruleIdsPara(codigo, 'dominio/exemplo-router.ts');
    expect(regras).toContain('no-restricted-imports');
  });

  it('bloqueia uso de fetch (rede) dentro de dominio/', async () => {
    const codigo = `export async function buscar() {\n  return fetch('https://exemplo.com');\n}\n`;
    const regras = await ruleIdsPara(codigo, 'dominio/exemplo-fetch.ts');
    expect(regras).toContain('no-restricted-globals');
  });

  it('bloqueia uso de localStorage dentro de dominio/', async () => {
    const codigo = `export function ler() {\n  return localStorage.getItem('x');\n}\n`;
    const regras = await ruleIdsPara(codigo, 'dominio/exemplo-localstorage.ts');
    expect(regras).toContain('no-restricted-globals');
  });

  it('bloqueia Date.now() dentro de dominio/', async () => {
    const codigo = `export function agoraEmMs() {\n  return Date.now();\n}\n`;
    const regras = await ruleIdsPara(codigo, 'dominio/exemplo-date-now.ts');
    expect(regras).toContain('no-restricted-syntax');
  });

  it('não bloqueia código puro legítimo (relógio por parâmetro)', async () => {
    const codigo = `export function estaExpirado(agora: Date, limite: Date): boolean {\n  return agora.getTime() > limite.getTime();\n}\n`;
    const regras = await ruleIdsPara(codigo, 'dominio/exemplo-valido.ts');
    expect(regras).not.toContain('no-restricted-imports');
    expect(regras).not.toContain('no-restricted-globals');
    expect(regras).not.toContain('no-restricted-syntax');
  });

  it('fora de dominio/ (ex.: app/), os mesmos padrões não são bloqueados por estas regras', async () => {
    const codigo = `import React from 'react';\nexport const x = React;\n`;
    const regras = await ruleIdsPara(codigo, 'app/exemplo-react.tsx');
    expect(regras).not.toContain('no-restricted-imports');
  });
});
