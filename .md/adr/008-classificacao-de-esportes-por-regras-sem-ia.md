# ADR-008 — Classificação de notícia em esporte por regras determinísticas (sem IA)

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-15 (CA-15.4), RF-04 (CA-04.7, CA-04.8), RF-05, RN-06, RN-18, I-17
- **Restrição dura**: sem LLM e sem qualquer funcionalidade de IA (Q8)

## Contexto

Todo item ingerido precisa cair em um dos 15 esportes da Seção 2A, em `geral`, ou em
`fora-do-recorte`. Classificar texto sem IA é o ponto de maior incerteza de qualidade
do produto, e um erro tem efeito assimétrico: um item mal classificado que entra na
seção "Seus esportes" quebra a confiança na personalização (M2), enquanto um item
rotulado `geral` apenas fica no feed principal — perda pequena e prevista por I-17.

## Decisão

Classificador determinístico, em **cascata de 4 níveis**, com a regra de ouro "na
dúvida, `geral`":

| Nível | Regra | Confiança |
|---|---|---|
| 1 | O feed tem `esporteFixado` (ADR-007) → esporte do feed | Alta — não é inferência |
| 2 | `<category>`/tag do item casa com o mapa de categorias daquela fonte (`config/categorias-fonte.json`) | Alta |
| 3 | Léxico ponderado sobre título + resumo: vence o esporte com maior pontuação, desde que pontuação ≥ 2 **e** vantagem ≥ 2 sobre o segundo colocado | Média |
| 4 | Sem vencedor: fonte multi-esporte → `geral`; fonte mono-esporte → esporte da fonte | — |

Regras complementares:

- **Léxico versionado em configuração** (`config/lexico-esportes.json`), pt-BR, com
  pesos: nome do esporte e termos inequívocos peso 3 ("pole position", "cestinha",
  "nocaute técnico"); entidades peso 2 (os 20 clubes da Série A e apelidos → futebol;
  "NBA", "NFL", "UFC", "ATP", "WTA", "Superliga"); termos ambíguos peso 1 e nunca
  decidem sozinhos ("técnico", "seleção", "final").
- **Normalização** antes do casamento: minúsculas, remoção de acentos (NFD), remoção
  de pontuação, casamento por palavra inteira (evita "surfe" dentro de "surfista"
  ser tratado como outra coisa, e evita casamento acidental dentro de palavras).
- **`fora-do-recorte`**: um segundo léxico curto de esportes reconhecidos porém fora
  dos 15 (handebol, boxe, ciclismo, e-sports, xadrez, golfe, críquete, rugby, hipismo,
  beisebol). Item classificado assim é armazenado no estado interno com esse rótulo e
  **não entra no snapshot público** — atende CA-15.4 e CA-04.8 sem carregar peso
  inútil para o navegador.
- **`geral` nunca aparece na seção "Seus esportes"** (CA-04.7), só no feed principal.
- **Sem aprendizado, sem histórico, sem ranking por comportamento** (RN-18): a mesma
  entrada produz sempre a mesma saída; o classificador é uma função pura, testada por
  tabela de casos.
- **Medição de qualidade**: `status.json` registra, por execução, a distribuição de
  `origemClassificacao` (`feed-fixado` | `categoria` | `lexico` | `nao-classificado`).
  Taxa de `geral` acima de **35%** dos itens é sinal de que faltam feeds fixados ou
  termos no léxico — vira ajuste de configuração, não de código.

## Alternativas consideradas

- **Classificação por LLM**: proibida por decisão do stakeholder (Q8) — sequer avaliada
  como alternativa técnica.
- **Modelo estatístico local** (Naive Bayes treinado em manchetes): exigiria conjunto
  rotulado, virando um mini-projeto de ML sem papel no roster e sem valor claro contra
  o léxico neste recorte. Recusada.
- **Só o esporte declarado pela fonte**: mais simples, mas quase todas as fontes do
  catálogo são multi-esporte e devolveriam tudo como `geral`, esvaziando a
  personalização (RF-05/M2). Recusada.

## Consequências

**Positivas**: determinístico, auditável, testável por tabela, ajustável por quem não
programa (configuração), zero custo, zero dependência externa.

**Negativas**: erra em manchete ambígua ("Brasil vence e vai à final"); o produto
absorve isso com o rótulo `geral`. É risco **RT-05 (média)** na Seção 6 do SDD.

**Dependência**: a qualidade depende diretamente de quantos feeds mono-esporte o
catálogo tem (ADR-007). Priorizar feeds fixados da Gazeta Esportiva é a alavanca mais
barata de qualidade da personalização.

## Se virar produto

Reavaliar com um conjunto rotulado real do grupo de teste; só então considerar modelo
estatístico. Qualquer uso de IA reabre a decisão Q8 com o stakeholder.
