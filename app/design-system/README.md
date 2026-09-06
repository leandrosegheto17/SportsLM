# app/design-system/

`tokens.css` (FUND-05) — única fonte de valores literais de cor, tipografia,
espaçamento, raio, sombra e alvo de toque da SPA (UX-SPEC §3.2-3.6, TASK.md
Diretriz de Implementação #4). Importado uma vez, globalmente, em
`app/main.tsx`.

Nenhum outro arquivo de estilo (`*.module.css`) do projeto deve conter um
valor literal de cor/tamanho/espaçamento — sempre referenciar a custom
property correspondente daqui. Única exceção: cor de clube, que chega da
configuração (`clubes-2026.json`, ADR-017) e é injetada como custom property
inline pelo componente que a conhece (Lote 7+); os tokens `--clube-*` aqui
são só o fallback neutro de "sem time escolhido" (UX-SPEC §3.4).

Componentes reais do design system (`FaixaClube`, `BlocoPreto`,
`CartaoIngresso` etc.) são Lote 7 (UI-DS-01 a UI-DS-09) — fora do escopo desta
tarefa, que entrega só os tokens.
