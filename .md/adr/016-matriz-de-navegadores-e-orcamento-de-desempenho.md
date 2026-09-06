# ADR-016 — Matriz de navegadores e orçamento de desempenho

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RNF-01 (lista de navegadores delegada ao Coordenador), RNF-04, RNF-05, M3
- **Depende de**: ADR-004

## Contexto

RNF-01 diz "Navegadores: os usados pelo grupo de teste; lista: Coordenador". Sem lista,
não há critério de aceite nem base para decidir o que a implementação pode usar. E M3
("primeira interação útil < 10 s em 4G típico") só é verificável contra um orçamento.

## Decisão — matriz de navegadores

| Navegador | Versão mínima | Prioridade |
|---|---|---|
| Chrome para Android | 2 últimas versões estáveis | **Primária** (mobile-first, maior parcela do público brasileiro) |
| Safari iOS | **16.4+** | **Primária** |
| Chrome desktop | 2 últimas | Secundária |
| Edge desktop | 2 últimas | Secundária |
| Firefox desktop/Android | 2 últimas | Secundária |
| Safari macOS | 16.4+ | Secundária |
| Internet Explorer, Opera Mini modo econômico | **Não suportados** | — |

**Alvo de compilação**: ES2022. Sem *polyfills* legados.

Safari 16.4 é a linha de corte porque é onde as capacidades que o UX-SPEC usa estão
disponíveis em todos os navegadores da matriz: `:has()`, consultas de contêiner,
`Array.prototype.at`, `Intl.RelativeTimeFormat` (para o carimbo "atualizado há X"),
`structuredClone`. Abaixo dessa linha, o custo é reescrever partes do layout com
soluções alternativas para uma fatia de usuários que o grupo de teste provavelmente
não tem.

**Degradação em navegador fora da matriz**: a aplicação tenta funcionar; se falhar no
carregamento do módulo, um bloco `<noscript>`/fallback estático informa em pt-BR que o
navegador não é suportado e lista os suportados. Nunca uma tela branca.

## Decisão — orçamento de desempenho

Referência de rede: **"Slow 4G" simulado** (≈ 1,6 Mbps de descida, 150 ms de latência
de ida e volta), em um aparelho de desempenho médio com desaceleração de CPU de 4×.

| Métrica | Orçamento | Amarração |
|---|---|---|
| JavaScript inicial (rota `/`) | ≤ **170 KB** comprimido | M3 |
| CSS inicial | ≤ **25 KB** comprimido | M3 |
| Fontes web | **0 bytes** — pilha do sistema | M3 |
| Imagens no carregamento inicial | **0** — sem escudos, sem imagem de notícia (I-14) | M3, R1 |
| `noticias.json` (snapshot do feed) | ≤ **60 KB** comprimido | M3 |
| `brasileirao.json` | ≤ **40 KB** comprimido | Carregado só nas rotas de time/comparativo |
| Maior Pintura de Conteúdo (LCP) | ≤ **2,5 s** | RNF-04 |
| Primeira interação útil (M3) | < **10 s** | M3 — com folga grande sobre o orçamento acima |
| Recálculo da simulação | < **100 ms** (requisito: < 1 s) | RNF-14 |

**Como o orçamento é sustentado**: divisão de código por rota (ADR-003) — a home não
baixa a simulação; nenhuma biblioteca de gráfico, de datas ou de componentes;
`Intl.RelativeTimeFormat` e `Intl.DateTimeFormat` nativos para datas em pt-BR e fuso
America/Sao_Paulo; snapshots servidos comprimidos pelo hosting.

**Verificação**: medição do tamanho do bundle no CI, com falha da construção ao
estourar o orçamento (é regra de `GUARDRAILS.md`, não recomendação). M3 medido de
verdade por telemetria no grupo de teste (ADR-012).

## Consequências

**Positivas**: critério objetivo; a folga entre o orçamento (~2-3 s previstos) e o
alvo de M3 (10 s) absorve rede ruim real, que é o cenário do torcedor no estádio ou
no transporte.

**Negativas**: veta bibliotecas convenientes (gráficos, datas, componentes) — cada
inclusão futura precisa passar por `GUARDRAILS.md`; veta navegadores antigos, o que
é uma escolha consciente de um protótipo com grupo de teste conhecido.

## Se virar produto

Matriz definida por dado real de uso, e não por hipótese; medição contínua com
usuários reais; reavaliação da linha de corte do Safari conforme a base instalada.
