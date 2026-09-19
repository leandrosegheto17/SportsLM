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

---

## Gate 4 — Registro de fechamento de deploy — 2026-09-09

**Skill**: não é deste chapéu (`deploy-report-drafting` é do Validador) — este é
o registro de governança do Gate 4 (chapéu CTO), só documentação de fechamento;
**sem poder de veto** (ver `.claude/agents/gestor.md` e
PIPELINE-CONVENTIONS.md §1). Input: `.md/DEPLOY.md` (Seção 5, entrada de
2026-09-09), `.md/QA-REPORT.md` e `.md/SECURITY-REVIEW.md` (entradas de
"Refatoração Lote-12"/fechamento de `REFAT-12-03` e "Melhoria — Otimização
mobile da Home"), todos já atualizados pelo Validador antes deste registro.

Diferença deste Gate 4 em relação ao anterior (2026-09-08): não houve
publicação nova disparada nesta sessão — o Validador confirmou que dois lotes,
cujos commits já estavam em `origin/main` fora desta sessão, de fato chegaram
a produção sem regressão cruzada entre si. O registro abaixo fecha o ciclo
Gestor→Coordenador→Executor→Validador→Gestor para esses dois lotes.

### Resultado

**Sucesso.** Nenhum rollback, nenhum incidente. Confirmação feita por
evidência direta (`git merge-base --is-ancestor`, `vercel inspect`/`vercel ls`,
`curl`), não por nota de terceiro.

| Item | Valor |
|---|---|
| Ambiente | Vercel, produção real (`https://sports-lm.vercel.app`) |
| Commits confirmados como publicados | `df420b4`, `7813ed9` (Refatoração Lote-12) e `23ec6bf` (UX-14-01/UX-14-02) — todos ancestrais de `origin/main` |
| Deployments de produção correspondentes | `Ready`/`target: production`, timestamps batendo em segundos com cada commit (`vercel inspect`/`vercel ls`); deployment mais recente no momento da checagem (`dpl_D2npeNHYXK4xe6aBjMTWiBnZRBGE`, commit `07503c6`, descendente de `23ec6bf`) já com o alias público apontando para ele |
| Confirmação adicional | `curl -sI https://sports-lm.vercel.app` → `200 OK` |
| Data | 2026-09-09 |

### O que foi publicado

- **Fechamento estrutural de Refatoração Lote-12** (`REFAT-12-01`,
  `REFAT-12-02`, `REFAT-12-03`, todas `Concluída`): `df420b4` fecha
  `REFAT-12-01` (remove `'unsafe-inline'` de `style-src`) e `REFAT-12-02`
  (rótulo do botão de telemetria); `7813ed9` fecha `REFAT-12-03` com a sessão
  manual real de acessibilidade (percurso só-teclado, NVDA, zoom 200%,
  roteiro `UX-SPEC.md` §5.8), conduzida diretamente pelo usuário — os 6 itens
  do roteiro passaram sem nenhum achado (`.md/QA-REPORT.md`, "Refatoração
  Lote-12 — fechamento de REFAT-12-03").
- **Melhoria — Otimização mobile da Home** (`UX-14-01`/`UX-14-02`, `23ec6bf`):
  bloco do time lado a lado e feed único de notícias no mobile, mudança
  isolada a `Home.tsx`/`SecaoIdentidade`/`SecaoNoticias`, sem sobreposição de
  arquivo com o fechamento do Lote-12.
- Regressão cruzada checada com suíte completa isolada num `git worktree`
  dedicado ao `HEAD` real: `tsc --noEmit`/`eslint .` limpos, `vitest run` — 98
  arquivos, 1131 testes, todos passando, sem regressão entre os dois lotes.

### Débitos residuais conhecidos — sem veto, apenas registro

- **`SEC-12-01`** (severidade baixa, `style-src 'unsafe-inline'` remanescente
  em parte do CSS, desvio documentado e aceito do ADR-011) e **`SEC-12-02`**
  (severidade baixa, rótulo "Desativar e apagar id" impreciso) seguem como
  débito de hardening/copy, sem prazo fixado — não bloqueiam esta publicação
  nem geram nova ressalva estratégica além da já registrada no Gate 4 anterior
  para `SEC-12-03` (agora encerrado).
- **`SEC-12-03`/`REFAT-12-03` está encerrado** com esta publicação — a
  ressalva estratégica de acessibilidade registrada no Gate 4 de 2026-09-08
  (compromisso do ADR-014, WCAG 2.2 AA como critério não-negociável) fica
  **resolvida**: a sessão manual real confirmou, sem achado, os pontos mais
  frágeis identificados naquele ADR (2.4.11 Foco não obscurecido, 2.5.8
  Tamanho do alvo, 4.1.3 Mensagens de status via `aria-live`). Não há mais
  débito de acessibilidade manual pendente para este ciclo.
- **Ressalva de verificação visual real em dispositivo móvel físico** (UX-14,
  registrada pelo Validador como pré-condição de processo, não de produto):
  segue não-automatizável, já conhecida, não bloqueante — mesma natureza da
  ressalva de acessibilidade anterior, sem relevância estratégica nova a
  acrescentar além do que já está documentado em `.md/QA-REPORT.md`.
- **Nota cosmética, não estratégica**: a prosa introdutória do Lote 12 em
  `.md/TASK.md` ainda descreve `REFAT-12-03` como bloqueio do próximo
  `/deploy` — texto desatualizado desde `7813ed9` (a coluna `Status`, fonte de
  verdade, já mostra `Concluída` nas três tarefas). Já sinalizado pelo
  Validador para uma próxima passagem de documentação; não justifica reabrir
  nada aqui.

Nenhum achado dos relatórios revisados é genuinamente novo ou preocupante o
suficiente para reabrir o Gate 1 ou qualquer ressalva estratégica ativa —
pelo contrário, este fechamento **resolve** a única ressalva estratégica de
acessibilidade pendente desde o Gate 4 de 2026-09-08.

### Checklist do Gate 4

- [x] `DEPLOY.md` recebido do Validador, com resultado sucesso/rollback/incidente
      declarado (sucesso, confirmação de publicação já ocorrida)
- [x] Commits e ambiente publicado identificados
- [x] Lotes/tarefas incluídos nesta confirmação nomeados (Refatoração Lote-12
      completo; Melhoria — Otimização mobile da Home)
- [x] Débitos residuais conhecidos revisados: nenhum novo, um encerrado
      (`SEC-12-03`/`REFAT-12-03`), demais (`SEC-12-01`/`SEC-12-02`, ressalva de
      verificação visual real) permanecem como débito de baixa severidade/
      processo, sem veto

### Veredito

**Registrado.** Gate 4 é só fechamento — não há veredito de aprovação/
reprovação aqui, conforme PIPELINE-CONVENTIONS.md §1 e `.claude/agents/gestor.md`.

---

## Gate 4 — Registro de fechamento de deploy — 2026-09-09 (Faixa do clube consistente)

**Skill**: não é deste chapéu (`deploy-report-drafting` é do Validador) — este é
o registro de governança do Gate 4 (chapéu CTO), só documentação de fechamento;
**sem poder de veto** (ver `.claude/agents/gestor.md` e
PIPELINE-CONVENTIONS.md §1). Input: `.md/DEPLOY.md` (Seção 5, entrada "2026-09-09
— Melhoria 'Faixa do clube consistente' (UX-15-01/UX-15-02), publicação real
desta sessão"), `.md/QA-REPORT.md` e `.md/SECURITY-REVIEW.md` (entradas
"Melhoria — Faixa do clube consistente em Meu Time e Comparativo (2026-09-09)"),
todos já atualizados pelo Validador antes deste registro.

Diferença deste Gate 4 em relação ao anterior (2026-09-09, Lote-12 +
Home mobile): ali o Validador só confirmou publicações que já haviam ocorrido
fora da sessão; aqui, o próprio orquestrador/usuário pediu explicitamente
"Commit, push, deploy" nesta sessão, e o `git push`/deploy foi de fato
executado agora, depois da dupla aprovação (QA + DevSecOps) deste lote.

### Resultado

**Sucesso.** Nenhum rollback, nenhum incidente. Confirmação feita por evidência
direta (`vercel inspect`, `curl`), não por nota de terceiro.

| Item | Valor |
|---|---|
| Ambiente | Vercel, produção real (`https://sports-lm.vercel.app`) — sem staging intermediário (arquitetura de hosting único, `.md/DEPLOY.md` §1) |
| Commit publicado | `baf0cab` ("feat(ux): faixa do clube consistente em Meu Time e Comparativo"), rebaseado sobre `07503c6` e enviado a `origin/main` nesta sessão |
| Lote incluído | Melhoria — Faixa do clube consistente em Meu Time e Comparativo (`UX-15-01`, `UX-15-02`) |
| Deployment de produção correspondente | `dpl_5HimAurDAp6Dg3BpePJWzFRt3HEa`, `● Ready`, `target: production`, criado em poucos segundos após o `git push`, três aliases de produção (inclusive `https://sports-lm.vercel.app`) apontando para ele |
| Confirmação adicional | `curl -sI https://sports-lm.vercel.app` → `200 OK` |
| Data | 2026-09-09 |

### O que foi publicado

- `PainelTime.tsx`: sem mudança de código de produção, só teste novo
  confirmando que a composição já existente (`FaixaClube`, UI-DS-01, Lote 7)
  está correta.
- `Comparativo.tsx`: nova `FaixaClube` no topo, mesmo shape de dado
  (`ClubeParaFaixa`) e mesma fonte já validada por Zod usados por
  `Home`/`PainelTime`, sem `href` (sem navegação nova).
- Rodada 3 do `UX-SPEC.md` e fechamento de `UX-15-01`/`UX-15-02` em `TASK.md`.
- Suíte completa validada limpa antes do commit (98 arquivos/1135 testes,
  `tsc`/`eslint`/`prettier` limpos), sem achado de segurança bloqueante
  (`.md/QA-REPORT.md`/`.md/SECURITY-REVIEW.md`, seção correspondente).

### Débitos residuais conhecidos — sem veto, apenas registro

- Os 2 achados do chapéu QA (`QA-15-01`, nome de componente incorreto no
  critério de aceite de `UX-15-02`; `QA-15-02`, contagem de teste incorreta na
  nota do Executor) são de documentação/narração, sem débito de código e sem
  implicação de segurança (confirmado pelo chapéu DevSecOps) — não abrem
  `Refatoração Lote-15`, não geram ressalva estratégica nova.
- Débitos de baixa severidade já conhecidos e inalterados por este lote
  (`SEC-12-01`, `SEC-12-02`, ressalva de verificação visual real de UX-14 em
  dispositivo móvel) seguem como registrado no Gate 4 anterior (2026-09-09,
  Lote-12 + Home mobile) — nenhum novo achado deste lote se soma a eles.
- Nenhum achado dos relatórios revisados é genuinamente novo ou preocupante o
  suficiente para reabrir o Gate 1 ou qualquer ressalva estratégica ativa.

### Checklist do Gate 4

- [x] `DEPLOY.md` recebido do Validador, com resultado sucesso/rollback/incidente
      declarado (sucesso, publicação real disparada nesta sessão)
- [x] Commit e ambiente publicado identificados
- [x] Lote/tarefas incluídos nesta confirmação nomeados (`UX-15-01`, `UX-15-02`)
- [x] Débitos residuais conhecidos revisados: nenhum novo, nenhuma mudança nos
      já existentes (`SEC-12-01`/`SEC-12-02`, ressalva de verificação visual de
      UX-14), sem veto

### Veredito

**Registrado.** Gate 4 é só fechamento — não há veredito de aprovação/
reprovação aqui, conforme PIPELINE-CONVENTIONS.md §1 e `.claude/agents/gestor.md`.

---

## Gate 4 — Registro de fechamento de deploy — 2026-09-17 (Correção do bloqueio de ingestão de 8 dias + fechamento de Refatoração Lote-14)

**Skill**: não é deste chapéu (`deploy-report-drafting` é do Validador) — este é
o registro de governança do Gate 4 (chapéu CTO), só documentação de fechamento;
**sem poder de veto** (ver `.claude/agents/gestor.md` e
PIPELINE-CONVENTIONS.md §1). Input: `.md/DEPLOY.md` (Seção 5, entrada
"2026-09-17 — Correção do bloqueio de ingestão de 8 dias + fechamento de
Refatoração Lote-14, publicação real desta sessão"), já atualizado pelo
Validador/orquestrador antes deste registro.

Diferença deste Gate 4 em relação aos anteriores: a publicação nasceu de um
relato direto do usuário sobre sintoma em produção ("notícias de basquete não
entram", "tabelas desatualizadas", "páginas parecem quebradas"), investigado
com `systematic-debugging` até causa raiz confirmada em CI real (`gh run
list`/`gh run view`), não suposição — e incluiu, na mesma publicação, o
fechamento formal de uma tarefa de débito documental já validada
(`REFAT-14-01`).

### Resultado

**Sucesso.** Nenhum rollback, nenhum incidente na confirmação imediata
pós-deploy.

| Item | Valor |
|---|---|
| Ambiente | Vercel, produção real (`https://sports-lm.vercel.app`), sem staging intermediário |
| Commit publicado | `0c4d363` ("fix(design-system): corrige quebra de linha do Prettier em tokens.css"), enviado a `origin/main` nesta sessão |
| Confirmação | CI `build-publish` (GitHub Actions) verde neste commit (`run 35254100225`, ambos os jobs); `curl -sI https://sports-lm.vercel.app` → `200 OK`, `Server: Vercel`, `Last-Modified` batendo com o horário do push (`vercel inspect` indisponível nesta sessão — CLI sem contexto de conta configurado) |
| Data | 2026-09-17 |

### O que foi publicado

1. **Correção de bug de infraestrutura**: `app/design-system/tokens.css` — uma
   quebra de linha do Prettier fora de conformidade, introduzida no commit
   `1afd1ff` (2026-09-10, publicado fora do fluxo formal, sem `format:check`
   real rodado antes do push), vinha fazendo o gate `format:check` do
   workflow `.github/workflows/ingestao.yml` falhar em **toda** execução
   agendada desde 2026-09-10T14:00:03Z — 8 dias consecutivos sem nenhuma
   atualização de dado (notícias de qualquer esporte, tabelas de futebol),
   confirmado por dezenas de execuções `failure` em `gh run list` e por
   `app/public/dados/versao.json` congelado. As "páginas quebradas"
   relatadas pelo usuário foram investigadas com Playwright real contra
   produção (5 telas, desktop + mobile) sem nenhum erro técnico — o sintoma
   era só dado congelado, não regressão de código. Correção foi
   estritamente formatação (`npx prettier --write`), sem mudança de valor.
2. **Fechamento formal de Refatoração Lote-14** (`REFAT-14-01`) — reconciliação
   de `.md/UX-SPEC.md` §4/§6 com a fusão do feed de notícias já publicada em
   `UX-14-02`, já com dupla aprovação (QA Aprovado, DevSecOps Aprovado,
   checagem estrutural limpa) antes desta publicação.

### Nota de relevância estratégica — causa raiz do incidente é de processo, não de arquitetura

O bloqueio de 8 dias não veio de uma falha de design do pipeline de ingestão
nem de dado externo indisponível — veio de um push fora do fluxo formal
(`1afd1ff`, mudança "só CSS", liberada sem rodar `format:check` real antes do
`git push`) que quebrou silenciosamente um gate de CI que só é exercitado pela
execução agendada de `ingestao.yml`, não pelo fluxo de deploy da SPA em si
(`build-publish.yml` também roda `format:check`, mas isso não impede a
publicação da SPA porque o Vercel não depende desse workflow — só o dado
parou). Como o produto não tem alerta automático de falha de workflow (Seção
3 de `DEPLOY.md`, já registrado como limite conhecido do "perfil de
protótipo", ADR-015), o bloqueio só foi percebido 8 dias depois, por relato
do usuário, não por observabilidade do sistema. Isso não é um achado novo de
arquitetura a reabrir aqui — é reforço de um risco já conhecido e aceito
(ADR-015): sem alerta automático de falha de CI/ingestão, qualquer push fora
do fluxo formal que quebre silenciosamente um gate de qualidade só será
percebido por sintoma observado pelo usuário final, com atraso proporcional à
cadência de uso. Não gera reabertura do Gate 1 nem de nenhuma ressalva
estratégica ativa; fica registrado para orientar prioridade futura, cuja
decisão de sequenciamento continua sendo do Coordenador/usuário via
`TASK.md`.

### Débitos residuais conhecidos — sem veto, apenas registro

- **Pendência não bloqueante já registrada pelo Validador**: a confirmação
  empírica de que `ingestao.yml` volta a publicar dado real só vem do
  próximo run agendado (ciclo de ~5-6h) — nenhuma execução agendada havia
  rodado sobre `0c4d363` no momento do registro em `DEPLOY.md`. Recomendação
  de acompanhamento (não bloqueio): checar `gh run list
  --workflow=ingestao.yml --limit 3` para confirmar o encerramento definitivo
  do bloqueio.
- Débitos de baixa severidade já conhecidos e inalterados por esta
  publicação (`SEC-12-01`, `SEC-12-02`, ressalva de verificação visual real
  de UX-14 em dispositivo móvel) seguem como registrado em Gates 4
  anteriores — nenhum novo achado desta publicação se soma a eles.
- Nenhum achado desta publicação é genuinamente novo ou preocupante o
  suficiente para reabrir o Gate 1 ou qualquer ressalva estratégica ativa.

### Checklist do Gate 4

- [x] `DEPLOY.md` recebido do Validador/orquestrador, com resultado sucesso/
      rollback/incidente declarado (sucesso, publicação real disparada nesta
      sessão)
- [x] Commit e ambiente publicado identificados (`0c4d363`, Vercel produção)
- [x] Lotes/mudanças incluídos nesta confirmação nomeados (correção de
      infraestrutura de ingestão; fechamento de `REFAT-14-01`)
- [x] Pendência não bloqueante (confirmação do próximo run agendado de
      `ingestao.yml`) registrada como acompanhamento, sem veto

### Veredito

**Registrado.** Gate 4 é só fechamento — não há veredito de aprovação/
reprovação aqui, conforme PIPELINE-CONVENTIONS.md §1 e `.claude/agents/gestor.md`.

---

## Adendo ao Gate 4 acima — 2026-09-17 (mesma sessão): a pendência não era só o run agendado

Registrado como só "acompanhamento, sem veto" acima — mas a investigação da
pendência achou uma causa raiz mais grave, então fica documentado aqui em vez
de reabrir o Gate 4 inteiro (não muda o veredito "Registrado", só corrige o
que se sabia no momento):

1. **`FOOTBALL_DATA_API_TOKEN` nunca esteve cadastrado no repositório** — o
   pipeline de ingestão sempre rodou em dry-run (`publica=false`), mesmo
   antes do bug do Prettier. A correção de `0c4d363` só resolveu o gate de
   formatação; nunca teria, sozinha, voltado a publicar dado real. Usuário
   cadastrou o secret nesta sessão; disparo manual confirmou publicação real
   (`0f19365`, `versao.json` em `2026-09-17T19:10:06Z`) — ver
   `.md/DEPLOY.md` §5, entrada "causa raiz real era outra".
2. **Bug de CSS real e pré-existente** (não introduzido nesta sessão) fazia
   os blocos "PRÓXIMO JOGO"/"A BRIGA" da Home colapsarem no desktop
   (≥1024px) — achado só depois que o usuário confirmou visualmente a
   publicação e reportou "a tela ainda parece quebrada". Corrigido em
   `app/rotas/paginas/Home/SecaoIdentidade.module.css`, validado (testes +
   verificação visual contra bundle de produção real) e publicado — ver
   `.md/DEPLOY.md` §5, entrada "bug real de CSS achado durante a
   verificação visual pós-deploy".

Nenhum dos dois achados é motivo para reabrir o Gate 1 ou qualquer ressalva
estratégica — reforça, de novo, o risco já aceito em ADR-015 (sem alerta
automático de falha de CI/dado ausente, o produto só descobre esse tipo de
problema por sintoma relatado pelo usuário, com atraso). Fica como reforço de
prioridade futura, não como bloqueio.

---

## Gate 1 (recorte pontual) — Cobertura completa de ligas via TheSportsDB — 2026-09-18

**Skill**: `tech-strategy-review` (escopo: uma demanda, não o projeto).
**Input**: demanda "estender a integração TheSportsDB a todos os estaduais, Copa do
Brasil e continentais" (Loop A, reabertura pontual — caso (b) de PLANNING-FLOW.md);
`PRD.md` (Q3, RAN-07, P2b, P8, R2, R5), `PRD-TECNICO.md` (RF-07/08/16/17, RN-05, RN-13),
`GUARDRAILS.md` §3/§5, código de `pipeline/futebol/adaptador-thesportsdb.ts` e
`orquestrador.ts`, `config/campeonatos-2026.json`.

**Atualização (rodada 2, mesmo dia)**: o stakeholder reduziu o recorte a Copa do
Brasil, Libertadores, Sul-Americana, Paulista, Carioca, Gaúcho e Mineiro (demais
estaduais, Copa do Nordeste e Supercopa ficam fora), aceitou a meta de 80% com lacuna
honesta e, sobre continentais, respondeu apenas "Sim" (lido de forma conservadora: assumir
lacuna, sem fonte paga/cadastro/API alternativa — a confirmar). Redução de escopo:
**veredito inalterado** (as ressalvas abaixo seguem valendo; RS-1 passa a valer para
essa lista fechada).

### Objetivo de negócio

Cumprir a promessa já aceita do PRD (Q3: "todos os campeonatos do ano, incluindo
estaduais e regionais") que o painel do time mostre a temporada inteira do clube
sem sair para outro site — o que sustenta a hipótese de valor (PRD §1) e M3. Hoje o
painel tem dado real só para Brasileirão (football-data.org) + Paulista/Carioca
(SPK-01); Copa do Brasil, Libertadores, Sul-Americana e demais estaduais aparecem
como "sem dados" (RN-05).

### Alinhamento e plausibilidade

- **Alinhado**: reduz o principal vazio de cobertura do diferencial do painel, sem
  novo custo (RN-13), sem IA, sem ao vivo, sem conta.
- **Custo/prazo**: reaproveita o adaptador e a porta `ProvedorFutebol` (ADR-006); o
  trabalho é configuração + mapeamento de ids + tratamento de mata-mata/adversário
  fora da Série A. Compatível com um protótipo sem prazo.
- **Fatos técnicos que limitam a promessa (evidência no código)**: (a) o adaptador
  descarta toda partida em que um dos clubes não esteja na Série A 2026
  (`clube-nao-mapeado`) — Copa do Brasil (fases iniciais) e continentais têm
  adversários fora da Série A, então sem mudança o painel mostraria buracos; (b) as
  listas `clubes` de Libertadores/Sul-Americana estão vazias e Mineiro não tem id de
  liga localizado; (c) os estaduais 2026 já encerraram
  (janela até 2026-03-22; `foraDaJanela` só reabre em 2027-01-14), então hoje só
  Copa do Brasil e continentais estão vivas; (d) a extensão de cobertura amplia a
  superfície de falha silenciosa já aceita em ADR-015 (sem alerta de CI).
- **Termos**: chave demo pública "123", 30 req/min; uso não-comercial aceitável no
  protótipo (RNF-08, I-22); reabre R1 se virar produto.

### Gap de roster

Nenhum novo. Verificação jurídica dos termos do TheSportsDB segue com o stakeholder (R4).

### Veredito

**Aprovado com ressalvas.** Libera os chapéus PM e BA para o recorte.

| # | Ressalva | Antes de |
|---|---|---|
| RS-1 | "Completa" = toda competição do recorte exibida, com estado honesto "sem dados" onde o provedor não cobrir — nunca cobertura garantida (P2b/R5 seguem abertas) | Aprovação do recorte pelo usuário |
| RS-2 | Adversário fora da Série A é decisão de contrato de dados (GUARDRAILS §5) — só o Coordenador pode aprovar a mudança | `/definir_organizar` |
| RS-3 | Orçamento de 30 req/min e limite de eventos por chamada do endpoint gratuito são premissas a provar com teste real, não a assumir | SDD/TASK do recorte |
| RS-4 | Nenhuma fonte paga, mesmo que a cobertura fique parcial — exceção só via consulta ao stakeholder (RN-13) | Sempre |

Checklist do Gate 1:

- [x] Objetivo de negócio declarado e verificável (Q3 / RAN-07)
- [x] Alinhamento com roadmap/orçamento (RN-13 preservada; sem prazo)
- [x] Sem gap óbvio de capacidade
