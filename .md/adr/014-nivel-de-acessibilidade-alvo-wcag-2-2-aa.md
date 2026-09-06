# ADR-014 — Nível de acessibilidade alvo: WCAG 2.2, nível AA

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéus Software Architect + UX/UI)
- **Requisitos afetados**: RNF-03, RAN-16, I-19 (decisão delegada ao Coordenador)

## Contexto

RNF-03 registra "WCAG — nível a definir pelo Coordenador; recomendação AA". A decisão
precisa sair aqui porque muda o design system (contraste, tamanho de alvo), a
implementação (semântica, foco, teclado) e o critério de aceite do Validador.

Três candidatos: **2.1 AA** (o mais adotado), **2.2 AA** (recomendação W3C de 2023,
superconjunto do 2.1 AA) e **AAA** (contraste 7:1, sem exceções).

## Decisão

**WCAG 2.2, nível AA, como critério não negociável de toda tela.** Além disso, três
itens de 2.2 que costumam ser ignorados são explicitamente obrigatórios aqui, por
serem exatamente os pontos frágeis deste produto:

| Critério 2.2 | Por que é crítico neste produto |
|---|---|
| **2.4.11 Foco não obscurecido (mínimo)** | As sobreposições (configurações, escolha de time, rivais) e o cabeçalho fixo podem esconder o elemento focado no celular |
| **2.5.8 Tamanho do alvo (mínimo, 24×24)** | A grade de simulação é densa e tem três controles por partida; a tabela de classificação tem 10 colunas. Adotamos **44×44 CSS px** como alvo de projeto, acima do mínimo |
| **3.2.6 Ajuda consistente** | O texto explicativo de "sem dados", "cobertura indisponível", "fonte fixa" e "horário estimado" precisa aparecer sempre no mesmo lugar e com a mesma redação |

**Itens obrigatórios adicionais, herdados de 2.1 AA, com aplicação específica aqui:**

- **1.4.1 Uso de cor**: resultado V/E/D, zonas da tabela e estado de fonte **nunca**
  se distinguem só por cor — sempre há letra, ícone ou rótulo textual redundante.
- **1.4.3 Contraste (mínimo)**: 4,5:1 para texto normal, 3:1 para texto grande e para
  componentes de interface. Os tokens da Seção 3 do UX-SPEC já vêm com a razão de
  contraste calculada.
- **1.4.10 Reflow**: uso em 320 px de largura sem rolagem horizontal de página. A
  tabela de classificação é a única exceção permitida — rolagem horizontal **dentro do
  próprio componente**, com região rolável focalizável por teclado.
- **1.3.1 Informação e relações**: tabela de classificação é `<table>` de verdade, com
  `<caption>`, `scope="col"`/`scope="row"` e a linha do time do coração marcada por
  `aria-current` além do destaque visual.
- **2.1.1/2.1.2 Teclado**: a grade de simulação é operável por teclado — cada partida
  é um `fieldset` com `legend` descritiva e um grupo de rádio de 4 opções (vitória,
  empate, derrota, sem palpite).
- **4.1.3 Mensagens de status**: recálculo da simulação, bloqueio de fonte e "N
  palpites viraram resultado real" são anunciados por `aria-live="polite"`, com
  supressão de repetição para não inundar o leitor de tela.
- **2.3.3 / `prefers-reduced-motion`**: nenhuma animação essencial; transições ≤ 150 ms
  e desligadas quando o sistema pedir movimento reduzido.

**AAA foi recusado** com motivo: exigiria 7:1 de contraste em toda a tabela de
classificação e nas faixas de zona, o que colapsa a paleta de estados (vitória,
empate, derrota, alerta) em variações quase indistinguíveis, prejudicando a leitura
justamente de quem não tem deficiência visual. AA com margem (a maior parte dos
tokens fica acima de 6:1) entrega mais acessibilidade real do que AAA forçado.

**2.1 AA foi recusado** porque os três critérios acrescentados por 2.2 atacam
problemas que este produto tem de fato, e o custo incremental de atendê-los no
projeto é baixo — muito menor do que corrigir depois.

## Verificação

- `axe-core` em teste automatizado para toda tela, em ambos os temas — **zero
  violações críticas ou sérias** é condição de aceite, não recomendação.
- Percurso manual por teclado de cada fluxo do UX-SPEC (Seção 5 traz a lista).
- Contraste conferido token a token na Seção 3 do UX-SPEC.
- O automatizado cobre cerca de um terço dos critérios; a lista manual da Seção 5 do
  UX-SPEC existe justamente para o resto.

## Consequências

**Positivas**: critério objetivo para o Validador; alinha com a expectativa legal
brasileira (LBI/eMAG) caso o protótipo avance.

**Negativas**: restringe a paleta e obriga alvos de 44 px, o que reduz densidade de
informação no celular — resolvido no UX-SPEC com colunas reduzidas na tabela em
telas estreitas.

## Se virar produto

Auditoria formal por terceiro, teste com usuários de tecnologia assistiva e declaração
de acessibilidade publicada.
