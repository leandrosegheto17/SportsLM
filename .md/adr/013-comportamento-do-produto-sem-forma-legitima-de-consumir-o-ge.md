# ADR-013 — Comportamento do produto caso o GE não seja consumível legitimamente (P-GE)

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-01, RF-02 (CA-02.3, CA-02.4), RF-15 (CA-15.6), RN-01, RN-03, CA-01.3
- **Premissa**: P-GE (crítica, não validada) — gatilho de reabertura do Gate 1 ativo
  (`CTO-REVIEW.md`, adendo da rodada 2)

## Contexto

RN-03 torna o GE (ge.globo) fonte **obrigatória e não bloqueável**, por decisão
inegociável do stakeholder. RN-01 proíbe scraping de HTML e API não documentada. As
duas regras juntas só são satisfazíveis se existir um feed oficial (ou API com termos
públicos compatíveis) do GE.

**Verificação nesta rodada**: o domínio `ge.globo.com` é **bloqueado pela ferramenta
de fetch deste ambiente** — mesma limitação que o chapéu BA encontrou em duas
tentativas. Uma busca na web devolveu apenas (a) diretórios de feeds mantidos por
terceiros e (b) uma URL de formato legado (`globoesporte.globo.com/.../Rss/...`)
citada sem data. **Nada disso é verificação.** Não foi possível confirmar nem o feed
nem os termos, e este ADR não afirma que existem nem que não existem.

Registro explícito para não haver ambiguidade: **não invento evidência sobre o GE.**
P-GE continua aberta e crítica.

## Decisão

**1. Não há caminho por exceção técnica.** Nenhuma implementação pode: raspar HTML do
ge.globo, consumir API não documentada, usar um feed hospedado por terceiro como se
fosse oficial, ou reempacotar conteúdo obtido por Google News (termos só de uso
pessoal, já descartado pelo BA). Isso é regra dura de `GUARDRAILS.md`, derivada de
RN-01/RNF-08. Uma exceção só existiria por decisão registrada do Gestor.

**2. O GE entra no catálogo com `verificacao.estado = "pendente"`** (ADR-007), com a
lista de URLs candidatas preenchida apenas quando a verificação manual (execução do
`verificar-catalogo` fora deste ambiente, mais leitura dos termos) devolver resultado.

**3. Comportamento do produto enquanto P-GE não estiver resolvida — o produto
funciona, degradado e honesto:**

| Aspecto | Comportamento |
|---|---|
| Catálogo (RF-01) | O GE **aparece** na lista das 5 fontes, marcado "fonte fixa", com estado "instável desde \<data\>" (CA-01.2). Nunca some |
| Bloqueio (RF-02) | O controle de bloqueio do GE continua não acionável, com a explicação de CA-02.3. Estar indisponível não o torna bloqueável |
| Home (CA-01.3) | Banner de alerta no cabeçalho: "O GE está indisponível no momento — as notícias abaixo vêm das outras fontes." Alta visibilidade, sem jargão técnico |
| Feed (RF-04) | Opera com as fontes restantes; se o usuário tiver bloqueado as outras 4, o feed exibe o estado vazio de CA-04.4 com a explicação do GE indisponível |
| Ingestão (CA-15.6) | Cada tentativa falha registra evento de **severidade alta** no `status.json`, distinto do "instável" comum das demais fontes |

**4. Se a verificação manual concluir que não existe forma legítima de consumo**, a
consequência não é técnica, é de negócio, e este ADR **não** a decide. O Coordenador
sinaliza ao Gestor e o gatilho já registrado no `CTO-REVIEW.md` reabre o Gate 1
restrito a este ponto. As três saídas possíveis, para o stakeholder escolher:

- (a) relaxar a obrigatoriedade do GE — o catálogo passa a 4 fontes verificadas mais
  um substituto ordenado, e RN-03 é reescrito;
- (b) promover outra fonte a fixa e não bloqueável no lugar do GE, mantendo a
  estrutura de RN-03 intacta;
- (c) negociar autorização direta com o publicador — fora do roster, dono é o
  stakeholder (gap jurídico R4 do Gate 1).

Nenhuma delas é acionável pelo Coordenador. **Todas as três custam apenas edição de
configuração no produto** (ADR-007), o que é justamente o objetivo: a decisão de
negócio não fica refém de retrabalho de engenharia.

**5. P-GE não bloqueia arquitetura nem UX**, mas **bloqueia RF-01 entrar em
desenvolvimento** (dependência já declarada em PRD-TECNICO §5.1). O Loop C precisa
tratar a configuração do catálogo como tarefa dependente da resolução de P-GE, com o
restante do pipeline de notícias independente dela.

## Consequências

**Positivas**: o produto nunca fica sem tela por causa do GE; o usuário nunca é
enganado sobre por que falta conteúdo; a decisão de negócio permanece reversível a
custo de configuração.

**Negativas**: com o GE fora, a cobertura de manchetes cai de forma sensível — o GE é
o maior portal esportivo do país e é a fonte que o stakeholder considera
indispensável. O protótipo perde parte do valor percebido, e M1 pode ser afetada.
Isso é **risco RT-01 (severidade alta)** na Seção 6 do SDD.

## Se virar produto

Acordo formal de licenciamento com o publicador antes de qualquer lançamento
comercial (R1/R4), independentemente de existir feed técnico.
