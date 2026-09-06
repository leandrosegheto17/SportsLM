// vite.config.ts — SportsLM (FUND-04)
//
// Bundler da SPA (ADR-004). `root: 'app'` porque o repositório é organizado por
// módulo no nível raiz (`pipeline/`, `dominio/`, `app/`, `config/` — FUND-01),
// não por convenção padrão do Vite. Build publica em `dist/` na raiz do
// repositório (consumido por FUND-03).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'app',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
