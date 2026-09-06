# dominio/

Módulos de TypeScript **puro**, compartilhados entre `pipeline/` e `app/` (SDD §2.1,
§5; GUARDRAILS.md §5).

Regra dura, verificada automaticamente pelo ESLint (`eslint.config.js`, bloco
`dominio/**/*.{ts,tsx}`) e provada em `tests/dominio-purity.eslint.test.ts`:

- Nunca importa `react`, `react-dom` ou `react-router-dom`.
- Nunca importa módulo de rede (`node-fetch`, `http`, `https`) nem usa o global
  `fetch`/`XMLHttpRequest`.
- Nunca usa `localStorage`.
- Nunca chama `Date.now()`. O relógio sempre entra por parâmetro (ex.: `agora: Date`).

Conteúdo real (tipos, `esportes`, `dedup`, `campeonatos`, `simulacao`, `frescor`)
entra a partir do Lote 3 (DOM-01 em diante) — este arquivo só documenta o portão
criado em FUND-01.
