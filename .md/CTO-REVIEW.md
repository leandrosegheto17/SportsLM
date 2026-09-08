# CTO-REVIEW.md — SportsLM

Log de governança do Gestor (chapéu CTO). Cada seção é um gate ou parecer ad hoc,
datado, terminando em veredito. Vereditos fora do Gate 1 e das mudanças de
`GUARDRAILS.md` são consultivos (ver `.claude/agents/gestor.md`).

---

## Gate 1 — Pré-descoberta — 2026-09-05

**Skill**: `tech-strategy-review`
**Input**: briefing de negócio do stakeholder (Seções "Problema e Contexto" e
"Público-Alvo"), recebido via `/planejar`. Não existe `PRD.md`, `SDD.md` nem
código — projeto green-field, repositório só com configuração de agentes.

### Objetivo de negócio

Em uma frase: **reduzir a fragmentação do consumo esportivo do torcedor brasileiro
recorrente, entregando num único produto (1) as notícias do dia de fontes que ele
mesmo escolhe confiar e (2) uma visão consolidada e comparativa do desempenho do seu
time de futebol ao longo da temporada.**

O objetivo é verificável: o problema declarado (visitar múltiplos sites, filtrar
manualmente, não ter visão consolidada do time) é observável hoje, e o sucesso pode
ser medido por adoção/retenção do produto como substituto desse comportamento (o
chapéu PM define a métrica no `PRD.md`, Seção 3).

O briefing **não declara** objetivo de receita, modelo de negócio, prazo ou
orçamento. Para um green-field sem base de usuários, isso não impede o Gate 1 — o
objetivo de negócio de curto prazo é validar o produto — mas vira ressalva porque
afeta diretamente o licenciamento de dados de terceiros (ver abaixo).

### Alinhamento com roadmap

**Neutro.** Não existe roadmap corporativo nem produto anterior; o briefing declara
que este PRD é o ponto de partida do roadmap. Não há com o que competir nem o que
reforçar. O único alinhamento a preservar daqui em diante é interno: as duas
features (notícias multi-fonte; painel do time) precisam continuar servindo a mesma
persona primária — o produto não deve derivar para portal genérico de esportes nem
para ferramenta de apostas (o briefing exclui odds e vídeo explicitamente, e isso
está mantido).

### Plausibilidade de orçamento/prazo

Sem orçamento/prazo declarados, a avaliação é só de sinal, não de cálculo:

- **Sinal positivo**: as duas features são, tecnicamente, agregação e apresentação
  de dados de terceiros — não há dado proprietário, algoritmo novo nem integração
  com sistema legado. É escopo compatível com um MVP de squad pequeno.
- **Sinal de atenção 1 — dado de terceiros é o núcleo do produto**: tudo que o
  produto mostra vem de feeds de notícia e de provedores de dados de futebol. A
  pesquisa preliminar (registrada com fontes no `PRD-TECNICO.md`, Seção 6) indica
  que existem opções gratuitas para validação (ex.: Série A em free tier; RSS
  oficiais de alguns portais), mas a cobertura completa do calendário brasileiro
  2026 (estaduais, Copa do Brasil, Libertadores, Sul-Americana) tende a exigir
  plano pago, na faixa de dezenas de dólares/euros por mês. Não é impeditivo, mas é
  um custo recorrente que precisa de dono.
- **Sinal de atenção 2 — licenciamento**: feeds gratuitos e agregadores (ex.:
  Google News RSS) têm termos que restringem uso comercial. Enquanto o modelo de
  negócio não for declarado, o produto deve ser tratado como não-comercial para
  fins de licenciamento, e isso precisa ser revisto antes de qualquer deploy
  público.
- Nenhum sinal óbvio de incompatibilidade entre escopo e o que um MVP costuma
  comportar.

### Gap de roster

Roster ativo: `gestor`, `coordenador` (arquitetura/UX/decomposição), `executor`
(backend/frontend/mobile), `validador` (QA/DevSecOps/DevOps). Para um produto web
de agregação de conteúdo e dados, o roster cobre o tipo de projeto.

Gaps identificados nominalmente:

1. **Revisão jurídica de licenciamento/direitos autorais** (uso de feeds de
   notícia, exibição de manchetes/resumos, termos de uso de provedores de dados).
   Não existe papel jurídico no pipeline — é responsabilidade do stakeholder
   providenciar antes do deploy público. Registrado como risco no `PRD.md`.
2. **Condicional — engenharia de IA/LLM**: o nome "SportsLM" sugere um produto
   baseado em modelo de linguagem (resumos gerados, curadoria por IA), mas o
   briefing não menciona nada disso. Se o stakeholder confirmar que "LM" implica
   funcionalidade de LLM, o roster não tem papel dedicado de ML/IA e este Gate
   precisa ser reaberto para reavaliar escopo, custo e risco. Enquanto não
   confirmado, o chapéu PM adota a interpretação mais simples (sem LLM no MVP) e
   registra a pergunta.

### Veredito

**Aprovado com ressalvas.** Libera os chapéus PM e BA na mesma chamada.

Ressalvas (não bloqueiam o PRD, mas precisam de resposta antes dos marcos indicados):

| # | Ressalva | Precisa estar resolvida antes de |
|---|---|---|
| R1 | Modelo de negócio/monetização não declarado — define se o licenciamento de dados e feeds pode ser o gratuito/não-comercial ou precisa ser pago/comercial | Deploy público (`/deploy`); idealmente antes do `SDD.md`, porque muda a escolha de provedor |
| R2 | Prazo e orçamento não declarados — a avaliação de plausibilidade acima é só de sinal | Aprovação do `TASK.md` pelo usuário (se pedir parecer ad hoc de capacidade, o chapéu CTO precisa desses números) |
| R3 | Dependência estrutural de dados de terceiros (notícias + dados de futebol) sem dado proprietário — risco estratégico de custo recorrente, mudança de termos e descontinuidade de fonte | `SDD.md` deve tratar explicitamente (provedor escolhido, plano de saída, comportamento em falha de fonte) |
| R4 | Revisão jurídica de licenciamento e direitos autorais está fora do roster — dono é o stakeholder | Deploy público |
| R5 | Confirmar se "SportsLM" implica funcionalidade de LLM; se sim, reabrir este Gate para reavaliar roster e escopo | Rodada 2 do Loop A (antes de fechar `PRD.md`) |

Checklist do Gate 1:

- [x] Objetivo de negócio declarado explicitamente e verificável
- [x] Hipótese de alinhamento com roadmap registrada (neutro — green-field)
- [x] Nenhum gap óbvio de capacidade para o tipo de projeto (gaps listados são
      jurídico, fora do roster técnico, e um condicional a confirmar)

---

## Adendo ao Gate 1 — rodada 2 do Loop A — 2026-09-05

Registro de governança, **não** é reabertura do Gate 1 nem novo veredito. O
stakeholder respondeu às perguntas da rodada 1 (via coordenador); o chapéu CTO
registra o efeito sobre as ressalvas e um gatilho condicional.

| Ressalva | Status após a rodada 2 |
|---|---|
| R1 (modelo de negócio) | Stakeholder: monetização é decisão futura e não bloqueia o MVP. Mantida como risco de licenciamento (PRD.md R1); não bloqueia PM/BA |
| R2 (prazo/orçamento) | Orçamento: sem número; diretriz "focar no free pro MVP; pago exige consulta" virou regra de negócio (PRD-TECNICO.md RN-13). Prazo: continua em aberto. Parecer de capacidade sobre o TASK.md continua dependendo de prazo |
| R3 (dependência de dados de terceiros) | Reforçada: o escopo agora exige todos os campeonatos do ano (estaduais e regionais inclusive) e o calendário completo do Brasileirão. Evidência do BA: Brasileirão Série A tem fonte gratuita com termos públicos; estaduais/regionais/Copa do Brasil/continentais **não** têm fonte gratuita confirmada. O SDD.md deve apresentar as opções (gratuita parcial vs. paga completa) para decisão do stakeholder |
| R4 (revisão jurídica) | Inalterada |
| R5 (LLM) | Q8 sem resposta; interpretação "sem LLM" mantida; gatilho de reabertura permanece |

**Gatilho condicional de reabertura do Gate 1 (novo)**: o stakeholder tornou o GE
(ge.globo) fonte obrigatória e não bloqueável (RN-03). O BA não conseguiu
verificar a existência de feed oficial nem termos de uso do GE (premissa P-GE,
crítica, dono BA, prazo: antes de RAN-01 entrar em desenvolvimento). Se a
verificação concluir que **não há forma legítima** de consumir o GE (feed oficial
ou API com termos compatíveis), o chapéu CTO reabre o Gate 1 **restrito a este
ponto**: a regra "GE obrigatório" passa a ser inviável como está e o stakeholder
precisa decidir entre relaxar a obrigatoriedade, aceitar outra fonte fixa ou
negociar acesso com o publisher. Até lá, o Loop A segue normalmente.

Veredito do Gate 1: **inalterado — Aprovado com ressalvas.**

---

## Adendo ao Gate 1 — rodada 3 do Loop A — 2026-09-05

Registro de governança, **não** é reabertura do Gate 1. O stakeholder respondeu às
cinco perguntas restantes (via coordenador).

| Item | Efeito sobre a governança |
|---|---|
| Q8 — "sem LLM; nenhuma funcionalidade de IA" | **Ressalva R5 encerrada.** O gatilho condicional de reabertura do Gate 1 por expectativa de IA/LLM deixa de existir. O gap condicional de roster (engenharia de IA/ML) desaparece. O roster de 4 agentes cobre integralmente o projeto |
| Q10 — "sem prazo; a aplicação é um protótipo", sem compromisso de lançamento comercial nesta fase | **Ressalva R2 reclassificada**: prazo não existe por decisão, não por omissão — o parecer ad hoc de capacidade sobre o TASK.md, se pedido, avalia só compatibilidade de escopo com squad, sem prazo. **Ressalva R1 (monetização)** e **R4 (jurídico)** ficam com exposição reduzida enquanto o uso for não-comercial, mas **permanecem abertas**: qualquer decisão de transformar o protótipo em produto reabre a revisão de licenciamento antes do lançamento. Registrado no PRD.md como R1 |
| Q4 — só clubes da Série A | Reduz a dependência de dados de terceiros (ressalva R3): o insumo do diferencial (Brasileirão Série A) tem fonte gratuita com termos públicos validada pelo BA. A cobertura de estaduais/regionais continua sem fonte gratuita confirmada — segue para o SDD.md |
| Q1b — 5 fontes por confiabilidade | Sem efeito de governança; o gatilho condicional pela premissa P-GE (adendo da rodada 2) **permanece** até a verificação manual do GE |
| Q14 — simulação só entre comparados | Sem efeito de governança |

Estado das ressalvas do Gate 1 após a rodada 3: R1 aberta (exposição reduzida no
protótipo); R2 resolvida por decisão (sem prazo, gratuito primeiro); R3 aberta
(estaduais/regionais); R4 aberta (revisão jurídica antes de qualquer lançamento
comercial); R5 **encerrada**. Gatilhos condicionais de reabertura ativos: apenas
P-GE.

Veredito do Gate 1: **inalterado — Aprovado com ressalvas.**

---

## Gate 4 — Registro de fechamento de deploy — 2026-09-08

**Skill**: `deploy-report-drafting` não é deste chapéu — este é o registro de
governança do Gate 4 (chapéu CTO), que só documenta o fechamento; **sem poder de
veto** (ver `.claude/agents/gestor.md` e PIPELINE-CONVENTIONS.md §1). Input:
`.md/DEPLOY.md` (Seção 5, Histórico de Deploys) e `.md/TASK.md` (linha
`REFAT-12-03`), ambos já atualizados pelo Validador antes deste registro.

### Resultado

**Sucesso.** Nenhum rollback, nenhum incidente na confirmação imediata
pós-deploy.

| Item | Valor |
|---|---|
| Ambiente | Vercel, produção real (`https://sports-lm.vercel.app`) |
| Commit publicado | `cd747b6` (+ `72bee20`, commit de documentação subsequente) |
| Deployment | `dpl_HLy1ATndKaDwaUxSD9MCrYDW9C78`, status `Ready`, `target: production` |
| Confirmação | `vercel inspect` direto + `curl` retornando `200`; auto-deploy via integração Git a `origin/main` |
| Data | 2026-09-08 |

### O que foi publicado

- Fechamento de **Refatoração Lote-2** (`REFAT-02-01`, sem achado novo).
- **Refatoração Lote-7 completo** (`REFAT-07-01`/`02`/`03`) — consolidação de
  tokens de borda/espaçamento no design system, achados `QA-7-03`/`QA-7-04`
  encerrados.
- Primeira validação formal do **Lote 12** (Telemetria, acessibilidade e
  segurança transversal), que gerou **Refatoração Lote-12**, com 3 novas
  tarefas de débito abertas: `REFAT-12-01`, `REFAT-12-02`, `REFAT-12-03`.

### Nota de relevância estratégica — débito de acessibilidade aceito

`REFAT-12-03` (sessão manual real de acessibilidade — percurso só-teclado,
leitor de tela real, zoom 200%, roteiro `UX-SPEC.md` §5.8) segue **Pendente**.
O chapéu DevSecOps do Validador classificou o achado correspondente
(`SEC-12-03`) como severidade média, e o registrou como o que bloquearia o
próximo `/deploy` real se não resolvido.

O orquestrador/usuário **aceitou esse débito explicitamente em 2026-09-08**
para liberar esta publicação — decisão já registrada em `.md/TASK.md` (linha
`REFAT-12-03`) e em `.md/DEPLOY.md` (Seção 5). O argumento aceito: o conteúdo
efetivamente publicado neste commit (CSS de tokens de borda/espaçamento +
documentação) não toca superfície de acessibilidade, então o risco de regressão
imediata é baixo.

O chapéu CTO registra esta nota **sem veto** — o Gate 4 não tem poder de
bloqueio retroativo, e a decisão já foi tomada e executada. A relevância
estratégica a documentar é que o produto tem, desde **ADR-014** (`WCAG 2.2,
nível AA` como "critério não negociável de toda tela"), um compromisso de
acessibilidade que vai além de boa prática — em qualquer cenário de evolução do
protótipo para produto com uso público real, WCAG 2.2 AA tende a se tornar
também expectativa legal (acessibilidade digital, incluindo mas não limitada à
LBI — Lei Brasileira de Inclusão). O débito de `REFAT-12-03` não invalida
ADR-014 nem indica que critérios de acessibilidade automatizáveis tenham
regredido (o achado é especificamente sobre a sessão *manual* — teclado, leitor
de tela real, zoom 200% — que ferramentas automatizadas não cobrem); mas
enquanto pendente, o produto não tem confirmação humana de que os critérios
mais frágeis identificados no próprio ADR-014 (2.4.11 Foco não obscurecido,
2.5.8 Tamanho do alvo, 4.1.3 Mensagens de status via `aria-live`) funcionam de
fato para um usuário real de tecnologia assistiva.

**Recomendação de acompanhamento (não é bloqueio retroativo, é recomendação)**:
priorizar `REFAT-12-03` antes do próximo `/deploy` que inclua qualquer mudança
de superfície (componentes interativos, layout, foco, live regions) — não
necessariamente antes de publicações que, como esta, sejam comprovadamente
restritas a tokens/documentação. Quem decide prioridade e sequenciamento
continua sendo o Coordenador/usuário via `TASK.md`.

### Checklist do Gate 4

- [x] `DEPLOY.md` recebido do Validador, com resultado sucesso/rollback/incidente
      declarado (sucesso)
- [x] Commit e ambiente publicado identificados
- [x] Lotes/tarefas incluídos nesta publicação nomeados
- [x] Débito de risco aceito (`REFAT-12-03`) registrado com relevância
      estratégica, sem veto retroativo

### Veredito

**Registrado.** Gate 4 é só fechamento — não há veredito de aprovação/reprovação
aqui, conforme PIPELINE-CONVENTIONS.md §1 e `.claude/agents/gestor.md`.
