# ADR-004 — Stack de frontend: React + TypeScript + Vite, CSS Modules com tokens

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RNF-01, RNF-04, RNF-05, RAN-16, M3
- **Depende de**: ADR-001, ADR-003

## Contexto

A aplicação é uma SPA que lê JSON estático e mantém todo o estado do usuário local.
Não há renderização no servidor, não há autenticação, não há formulários complexos. O
que existe de difícil é: uma tabela de classificação densa, uma grade de simulação
interativa com recálculo imediato, e um orçamento de desempenho apertado (primeira
interação útil < 10 s em 4G — M3/RNF-04).

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| **React 18 + TypeScript + Vite** | Ecossistema e documentação maiores; testes maduros (Vitest + Testing Library); previsível para múltiplas instâncias do Executor trabalhando em paralelo | Bundle base maior (~45 KB gz de runtime) |
| Svelte / SvelteKit | Bundle menor, menos código | Menor massa de referência para implementação assistida; SvelteKit traria conceitos de servidor que aqui não se usam |
| Vanilla + Web Components | Bundle mínimo | Custo alto em componentes de estado (grade de simulação, tabela) e em testes; risco de reinventar o roteador e o gerenciamento de foco |

**Estilo**: CSS Modules com *design tokens* em CSS custom properties, contra Tailwind
e contra CSS-in-JS. Tokens em variáveis CSS mapeiam 1:1 o design system do UX-SPEC
(Seção 3), permitem tema claro/escuro trocando um bloco de variáveis, e não adicionam
etapa de build nem runtime. Tailwind foi descartado por deixar a especificação visual
diluída em classes utilitárias, o que dificulta a auditoria do Validador contra o
UX-SPEC; CSS-in-JS foi descartado por custo de runtime.

**Estado**: `useReducer` + Context para preferências e cenário; um hook `useSnapshot`
com cache em memória e revalidação por `versao.json`. Sem Redux, sem TanStack Query —
não há mutação remota nem cache de servidor a coordenar.

## Decisão

- **React 18 + TypeScript (strict) + Vite** como base.
- **CSS Modules + tokens em CSS custom properties**; nenhum framework de CSS.
- **Roteador**: `react-router-dom` em modo configurável (ADR-003).
- **Sem biblioteca de gráficos**: as barras do comparativo e da simulação são CSS
  puro com `role="img"` e rótulo textual equivalente.
- **Sem webfont**: pilha de fontes do sistema (ADR-016 detalha o orçamento).
- **Testes**: Vitest + Testing Library; `axe-core` em modo de teste para as telas;
  nenhum teste toca a rede (fixtures de feed e de provedor versionadas).
- Dependências de runtime permitidas no frontend: `react`, `react-dom`,
  `react-router-dom`. Qualquer outra exige registro em `GUARDRAILS.md`.

## Consequências

**Positivas**: implementação previsível e paralelizável; auditoria visual direta
(token → CSS custom property → valor do UX-SPEC); superfície de dependências mínima,
o que reduz o trabalho do Validador em análise de dependências.

**Negativas**: ~45 KB gz de runtime que uma stack menor não teria — absorvido pelo
orçamento de 170 KB gz (ADR-016); CSS escrito à mão, portanto a consistência depende
do uso disciplinado dos tokens (vira regra em `GUARDRAILS.md`: nenhum valor
hexadecimal, tamanho de fonte ou espaçamento literal fora do arquivo de tokens).

## Se virar produto

Reavaliar renderização no servidor/pré-renderização e a adoção de uma biblioteca de
componentes acessíveis já testada (por exemplo, primitivas headless) no lugar dos
componentes próprios de sobreposição e abas.
