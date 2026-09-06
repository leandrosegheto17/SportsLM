# ADR-009 — Deduplicação determinística de manchetes por similaridade de trigramas

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-19 (Should), RN-16, RN-07, CA-19.1 a CA-19.4
- **Restrição dura**: sem IA (Q8); "na dúvida, não agrupar" (RN-16)

## Contexto

RN-16 delega ao Coordenador o limiar de similaridade. O custo do erro é assimétrico e
explicitamente declarado: **falso positivo esconde notícia**. Portanto o limiar tem
de ser conservador, mesmo ao preço de deixar duplicata passar.

Complicação de arquitetura: o agrupamento é calculado na ingestão, mas a **composição
visível do grupo depende do bloqueio de fontes, que é local do usuário** (CA-19.2).
O snapshot público não sabe quem o usuário bloqueou.

## Decisão

**Algoritmo (executado na ingestão):**

1. Normalizar o título: minúsculas, NFD com remoção de diacríticos, remoção de
   pontuação, colapso de espaços, remoção de uma lista fixa de *stopwords* pt-BR
   (`config/stopwords-pt-br.json`).
2. Candidatos a par: itens de **fontes distintas** (mesma fonte nunca agrupa, RN-16)
   com diferença de publicação **≤ 12 h**.
3. Similaridade = **coeficiente de Dice sobre trigramas de caracteres** do título
   normalizado.
4. Agrupa se, e somente se: `Dice ≥ 0,82` **e** houver **≥ 2 tokens fortes em comum**
   (token com ≥ 4 caracteres, fora das stopwords). A segunda condição é o que impede
   agrupar duas manchetes de estrutura parecida sobre assuntos diferentes
   ("Palmeiras vence o Santos por 2 a 1" × "Palmeiras vence o Corinthians por 2 a 1"
   têm Dice alto, mas divergem no token forte do adversário).
5. Grupos por união transitiva (union-find), com `grupoId` estável (hash dos ids
   ordenados dos membros).

**Publicação:** o snapshot traz `grupoId` em cada item e **não** escolhe o
representante. A escolha é do cliente, depois de aplicar os bloqueios:

- **Representante = o item mais antigo do grupo entre as fontes não bloqueadas.** É a
  leitura literal de CA-19.2 ("omitir a bloqueada e promover a próxima mais antiga") e
  premia quem publicou primeiro.
- A data exibida e a posição do grupo na ordenação por recência são as **do
  representante**.
- O grupo conta como **1** na contagem dos 30 (CA-19.4) e exibe a lista das demais
  fontes com seus links (CA-19.1).
- Grupo cujos membros estejam todos bloqueados simplesmente não aparece.

**Lacuna de detalhe resolvida aqui** (registrada por transparência): o PRD-TECNICO não
define qual data ordena um grupo. Decisão: a do representante — assim a ordem da tela
nunca contradiz a data que a tela mostra.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Jaccard sobre tokens | Sensível demais a sinônimo e ordem; produziria mais falso negativo sem ganhar precisão onde importa |
| Levenshtein normalizado | Custo O(n·m) por par e pior comportamento com manchetes de tamanhos diferentes |
| Embeddings/similaridade semântica | Proibido (Q8) e desproporcional |
| Agrupar por URL canônica compartilhada | Não se aplica: fontes diferentes publicam URLs diferentes |

Limiar: 0,82 foi escolhido dentro da faixa em que trigramas separam bem manchetes
sobre o mesmo fato de manchetes apenas parecidas; combinado com a regra dos 2 tokens
fortes, erra para o lado de não agrupar, como RN-16 exige. O valor é **configuração**
(`config/dedup.json`), ajustável sem código, e o `status.json` registra quantos grupos
foram formados por execução para permitir calibragem com dados reais.

## Consequências

**Positivas**: determinístico, barato (O(n²) sobre ≤ 300 itens em janela de 12 h é
trivial), auditável, e correto na interação com o bloqueio de fontes.

**Negativas**: duplicatas com títulos muito diferentes sobre o mesmo fato continuarão
separadas — comportamento explicitamente aceito por CA-19.3.

**Custo no cliente**: a escolha do representante roda a cada mudança de bloqueio; é um
`reduce` sobre no máximo poucas dezenas de grupos, imperceptível.

## Se virar produto

Calibrar o limiar com um conjunto rotulado do grupo de teste e considerar
agrupamento por entidade (clube/atleta) extraída por regras.
