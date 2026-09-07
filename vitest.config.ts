import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', 'dist/**', 'build/**'],
    passWithNoTests: true,
    // Fixa o fuso horário do ambiente de teste em America/Sao_Paulo para
    // tornar a suíte determinística em qualquer máquina/CI (Bloqueio 004,
    // ver .md/BLOCKERS.md e .md/DEPLOY.md Seção 6). Não afeta produção: o
    // componente continua formatando no fuso local do processo/visitante em
    // runtime real de navegador.
    env: {
      TZ: 'America/Sao_Paulo',
    },
  },
});
