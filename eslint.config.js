// eslint.config.js — SportsLM
//
// Portão de qualidade (FUND-01). Regra central: `dominio/` é puro (SDD §2.1,
// GUARDRAILS.md §5) — proibido importar rede, `localStorage`, React ou usar
// `Date.now()` dentro de qualquer módulo de `dominio/`. O relógio sempre entra
// por parâmetro.
//
// Nota de implementação: `Date.now()`, `fetch` e `localStorage` não são
// "imports" (são identificadores/APIs globais), então além de
// `no-restricted-imports` (para bloquear `import ... from 'react'` etc. e
// libs de rede) usamos `no-restricted-globals` (fetch/localStorage) e
// `no-restricted-syntax` (chamada específica `Date.now()`) — mesmo espírito
// da diretriz do TASK.md, com o mecanismo de lint correto para cada caso.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const dominioRestrictedImports = {
  'no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name: 'react',
          message: 'dominio/ é puro (SDD §2.1): proibido importar React.',
        },
        {
          name: 'react-dom',
          message: 'dominio/ é puro (SDD §2.1): proibido importar React.',
        },
        {
          name: 'react-router-dom',
          message: 'dominio/ é puro (SDD §2.1): proibido importar React.',
        },
        {
          name: 'node-fetch',
          message: 'dominio/ é puro (SDD §2.1): proibido importar rede.',
        },
        {
          name: 'http',
          message: 'dominio/ é puro (SDD §2.1): proibido importar rede.',
        },
        {
          name: 'https',
          message: 'dominio/ é puro (SDD §2.1): proibido importar rede.',
        },
      ],
    },
  ],
};

const dominioRestrictedGlobals = {
  'no-restricted-globals': [
    'error',
    {
      name: 'fetch',
      message: 'dominio/ é puro (SDD §2.1): proibido usar rede (fetch).',
    },
    {
      name: 'localStorage',
      message: 'dominio/ é puro (SDD §2.1): proibido usar localStorage.',
    },
    {
      name: 'XMLHttpRequest',
      message: 'dominio/ é puro (SDD §2.1): proibido usar rede.',
    },
  ],
};

const dominioRestrictedSyntax = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
      message:
        'dominio/ é puro (SDD §2.1): proibido Date.now(); o relógio entra sempre por parâmetro (ex.: `agora: Date`).',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.claude/**',
      '.md/**',
      'design/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // SPA (app/) roda no navegador.
  {
    files: ['app/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  // Pipeline (pipeline/) roda em Node.
  {
    files: ['pipeline/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // dominio/ é puro — portão automático da regra de FUND-01/SDD §2.1.
  {
    files: ['dominio/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      ...dominioRestrictedImports,
      ...dominioRestrictedGlobals,
      ...dominioRestrictedSyntax,
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
