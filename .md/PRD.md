# PRD.md — SportsLM

**Status**: rascunho — Loop A, rodada 3 (2026-09-05)
**Autor**: Gestor (chapéu PM)
**Base**: briefing do stakeholder; Gate 1 e adendos em `.md/CTO-REVIEW.md`;
respostas do stakeholder às perguntas das rodadas 1 e 2, relatadas pelo
coordenador em 2026-09-05 (decisões tomadas em conversas anteriores fora deste
repositório).

Convenção de marcação:

- **[BRIEFING]** — literal do briefing.
- **[STAKEHOLDER]** — decisão do stakeholder (rodadas 2 e 3); registrada com
  origem, não reaberta.
- **[DECISÃO PM]** — decisão do Gestor (chapéu PM), contestável.

Não há mais marcação **[CONFIRMAR]**: todas as perguntas de produto foram
respondidas (Seção 7).

---

## 1. Problema e Contexto

**[BRIEFING]** Um torcedor brasileiro que acompanha esportes hoje precisa visitar
múltiplos sites (portais de notícia, sites de cada campeonato, redes sociais) para:

- (a) se manter atualizado sobre as principais notícias esportivas do dia,
  filtrando manualmente o que interessa entre fontes que nem sempre confia;
- (b) acompanhar o desempenho do time de futebol pelo qual torce ao longo da
  temporada — em quais competições está, como está indo, quando joga de novo, e
  como está em relação a rivais diretos na disputa por posições/vagas.

Esse consumo é fragmentado: não existe hoje, para esse usuário, um único lugar que
junte (1) notícias multi-fonte com controle de quais fontes confia, e (2) uma visão
consolidada e comparativa do desempenho do próprio time ao longo do ano.

**Contexto do projeto [BRIEFING]**: SportsLM é um projeto novo (green-field), sem
produto anterior, sem base de usuários e sem roadmap corporativo pré-existente.
Este PRD é o ponto de partida do roadmap do produto.

**Contexto de produto — protótipo [STAKEHOLDER, rodada 3]**: a aplicação é um
**protótipo**: sem prazo-alvo e sem compromisso de lançamento comercial nesta
fase. Monetização é decisão futura. Consequências: (i) requisitos não funcionais
de disponibilidade, escala e observabilidade são relaxados para o nível de
protótipo (PRD-TECNICO.md §2); (ii) o uso de fontes e provedores com termos
"não-comerciais" fica mais defensável, mas continua registrado como risco caso o
protótipo vire produto (R1); (iii) as métricas de sucesso valem como critério de
pronto do protótipo, medidas sobre um grupo de teste, não sobre um lançamento
público (Seção 3).

**Como o problema é observável hoje [DECISÃO PM]**: número de sites/apps que o
torcedor abre por dia para se informar (hipótese: 3 ou mais — a levantar com o
grupo de teste) e ausência, nos portais brasileiros, de uma tela que combine
notícias filtradas por fonte com tabela, calendário e comparação/simulação do time
contra rivais escolhidos.

**Hipótese de valor [DECISÃO PM]**: *Se* entregarmos, numa única página de acesso
diário, as 30 notícias mais recentes de 5 fontes confiáveis (menos as que o
torcedor bloqueou, com destaque para os esportes favoritos dele) e o painel do time
com todos os campeonatos do ano mais o comparativo e a simulação de cenário contra
os rivais que ele escolheu no Brasileirão, *então* o torcedor passa a abrir o
SportsLM como primeiro ponto de consulta do dia, *porque* elimina o custo de
visitar e filtrar várias fontes e de montar mentalmente a briga do time na tabela.

**O diferencial declarado [STAKEHOLDER]**: o comparativo com rivais e a simulação de
cenário jogo a jogo até o fim do Brasileirão.

**Contexto de temporada [DECISÃO PM, evidência em PRD-TECNICO.md §6]**: calendário
2026 — Brasileirão Série A de 28/jan a 02/dez (pausa na Copa do Mundo), estaduais
11/jan a 08/mar, Copa do Brasil em novo formato (126 clubes, 5 fases de jogo único,
Série A entra na 5ª fase), Libertadores (final 28/nov), Sul-Americana (final
21/nov), copas regionais 25/mar a 07/jun, Supercopa 24/jan. Um clube de Série A
disputa de 4 a 6 campeonatos no ano.

## 2. Público-Alvo

**[BRIEFING]**

- **Persona primária**: torcedor brasileiro que acompanha esportes de forma
  recorrente (diária/quase diária), tem pelo menos 1 esporte de interesse forte o
  bastante para querer notícias filtradas, e tem um time de futebol específico
  pelo qual torce de forma contínua.
- **Persona secundária**: torcedor que acompanha múltiplos esportes e quer uma
  visão diária agregada, sem acompanhamento aprofundado de um time (usa só a
  Feature 1).
- **Fora do público-alvo desta release**: quem quer apostas/odds; quem quer
  assistir transmissão/vídeo no produto; quem busca ligas/esportes fora do recorte
  "mais assistidos no Brasil" (Feature 1) ou fora de futebol (Feature 2).

**Recorte operacional [STAKEHOLDER]**:

- **Esportes**: lista curada dos **15 esportes mais assistidos no Brasil**
  (PRD-TECNICO.md §2A); o torcedor escolhe **até 3 favoritos**.
- **Time de futebol**: **somente os clubes da Série A do Brasil no ano corrente**
  (2026: 20 clubes). Torcedor de clube fora da Série A usa só a Feature 1 nesta
  fase.
- **Grupo de teste do protótipo [DECISÃO PM]**: as métricas da Seção 3 são medidas
  sobre um grupo de teste recrutado pelo stakeholder dentro das personas acima
  (tamanho mínimo a definir — P10).

## 3. Objetivo de Sucesso

Baseline: **0** em todas as métricas — produto green-field.

As três métricas do stakeholder (rodada 2) e a M4 do PM continuam valendo como
**critério de pronto do protótipo**. **Ajuste de janela [DECISÃO PM, rodada 3]**:
como não há lançamento, "primeiros 60 dias após o lançamento do MVP" passa a ser
"60 dias a partir do início do uso pelo grupo de teste"; percentuais sobre grupo
pequeno são indicativos, por isso o PM propõe coorte mínima (P10). Metas
inalteradas.

| # | Métrica | Meta | Janela (ajustada) | Origem |
|---|---|---|---|---|
| M1 (primária) | Retenção D7: usuários da primeira sessão que voltam no 7º dia (janela D7 padrão da ferramenta) | ≥ 30% | 60 dias a partir do início do uso pelo grupo de teste; coorte mínima de 20 usuários (a confirmar — P10) | [STAKEHOLDER]; janela [DECISÃO PM] |
| M2 | Usuários que voltam para uma segunda sessão e completam a personalização básica (≥ 1 esporte favorito e, se torcedor de futebol, o time do coração) até o fim dessa sessão | ≥ 70% | Idem | [STAKEHOLDER] |
| M3 | Tempo até a primeira interação útil (abrir uma notícia ou abrir a tela do time), por telemetria, em 4G típico | < 10 s | Contínua durante o teste | [STAKEHOLDER] |
| M4 | Usuários com time e ≥ 1 rival que abrem o comparativo/simulação ao menos 1 vez por semana | ≥ 40% (a confirmar) | Idem M1 | [DECISÃO PM] — mede o diferencial |

Instrumentação, ferramenta de telemetria e consentimento são decisão do
Coordenador/Validador; no protótipo, a telemetria pode ser mínima (PRD-TECNICO.md
RNF-07).

## 4. Escopo desta Release (protótipo, v1)

Framework: **MoSCoW**. Esforço de engenharia **não avaliado ainda**. Diretriz
transversal **[STAKEHOLDER]**: fontes e provedores **gratuitos**; qualquer fonte
paga exige consulta explícita ao stakeholder (RN-13).

### Dentro

| Item | Feature | Prioridade | Origem | Amarração à métrica |
|---|---|---|---|---|
| Catálogo fixo de **5 fontes de notícia** escolhidas por confiabilidade (critério em RN-19): **GE (obrigatória, não bloqueável)**, ESPN Brasil, Gazeta Esportiva, Terra Esportes (feeds verificados) e UOL Esporte (candidata a confirmar pelo Coordenador; substitutos ordenados: Folha Esporte, Placar) | F1 | Must | [STAKEHOLDER] (5, por confiabilidade, GE); [DECISÃO PM/BA] (quais 4) | Base de M1/M3 |
| Feed das **30 notícias mais recentes** agregadas entre as fontes não bloqueadas, com a fonte visível | F1 | Must | [STAKEHOLDER] | M1, M3 |
| **Bloquear fontes** (exceto GE), com efeito imediato | F1 | Must | [STAKEHOLDER] | M2 |
| Recorte de **15 esportes** (lista curada) e **até 3 favoritos** | F1 | Must | [STAKEHOLDER] | M2 |
| Seção da home que **destaca as notícias dos favoritos** (personalização somente de notícias) | F1 | Must | [STAKEHOLDER] | M1, M2 |
| Escolha de **1 time do coração** entre os clubes da Série A do ano corrente | F2 | Must | [STAKEHOLDER] | M2 |
| Painel com **todos os campeonatos do ano corrente, incluindo estaduais e regionais**; por campeonato: resumo (V/E/D, aproveitamento, posição quando aplicável), tabela (pontos corridos/grupos), partidas disputadas e próximas | F2 | Must | [STAKEHOLDER] | M3 |
| **Até 2 rivais**, escolhidos entre os demais clubes da Série A do ano corrente | F2 | Must | [STAKEHOLDER] | M4 |
| **Comparativo** no Brasileirão: jogos que faltam para o time e cada rival | F2 | Must | [STAKEHOLDER] | M4 |
| **Simulação de cenário** jogo a jogo até o fim do Brasileirão, com pontuação acumulada — **somente entre time do coração e rivais**, sem posição projetada na tabela completa | F2 | Must | [STAKEHOLDER] — "o diferencial" (Q14) | M4 |
| Regra defensiva de **virada de temporada**: se o time salvo não estiver na Série A da nova temporada, o produto avisa e pede nova escolha; rivais e simulação são descartados | F2 | Must | [DECISÃO PM] — substitui a exceção "fora do Brasileirão", que deixou de ocorrer por seleção (ver Seção 7.1, Q4) | — |
| Persistência **local, por dispositivo/navegador, sem conta** | F1+F2 | Must | [STAKEHOLDER] | M2 |
| Onboarding em 2 passos (favoritos → time), puláveis | F1+F2 | Must | [DECISÃO PM] | M2, M3 |
| Carimbo "atualizado há X" e degradação visível; atualização periódica, nunca ao vivo | F1+F2 | Must | [STAKEHOLDER] (Q12) | Confiança |
| **Uma página Web**, responsiva, português do Brasil | — | Must | [STAKEHOLDER] | M3 |
| Destaque de zonas na tabela do Brasileirão (configuração por temporada) | F2 | Should | [DECISÃO PM] | M4 |
| Deduplicação de manchetes entre fontes | F1 | Should | [DECISÃO PM] | Ruído |
| Simulação persistida localmente | F2 | Should | [DECISÃO PM] | M4 |

### Fora desta release, com justificativa

| Item | Por que fica de fora | Origem |
|---|---|---|
| Apostas, odds, prognósticos | Excluído pelo briefing e reconfirmado | [STAKEHOLDER] |
| Vídeo/transmissão/streaming | Idem | [STAKEHOLDER] |
| Comentários, interação social, compartilhamento | Reconfirmado | [STAKEHOLDER] |
| Placar ao vivo e push de eventos | Atualização periódica é aceitável | [STAKEHOLDER] (Q12) |
| Conta/login e sincronização | "v1 local apenas" | [STAKEHOLDER] (Q6) |
| App nativo | Release futura | [STAKEHOLDER] (Q7) |
| Outros idiomas | Só pt-BR | [STAKEHOLDER] |
| Dados estruturados para esportes fora de futebol | Personalização é "somente notícias" | [STAKEHOLDER] (Q2) |
| Comparativo/simulação fora do Brasileirão | "Apenas pontos corridos, vamos focar no Brasileirão" | [STAKEHOLDER] (Q5) |
| Posição final projetada na tabela completa | Simulação é só entre time e rivais | [STAKEHOLDER] (Q14) |
| Times fora da Série A (Série B, C, D, estrangeiros) | "Somente os clubes da Série A do Brasil" | [STAKEHOLDER] (Q4) |
| Fontes de notícia além das 5 do catálogo | Catálogo fechado em 5 por confiabilidade | [STAKEHOLDER] (Q1b) |
| **Qualquer funcionalidade de IA/LLM** | "Sem LLM" — decisão definitiva; gatilho de reabertura do Gate 1 encerrado | [STAKEHOLDER] (Q8) |
| Fontes/provedores pagos | Só com consulta explícita (RN-13) | [STAKEHOLDER] (Q10) |
| Lançamento comercial, SLA de disponibilidade, escala de produção | Protótipo sem compromisso comercial nesta fase | [STAKEHOLDER] (Q10) |
| Múltiplos times do coração | 1 time ativo, com troca | [BRIEFING] |
| Personalização algorítmica além dos favoritos | Ordem por recência | [DECISÃO PM] |
| Texto integral ou imagens das matérias | Só título + resumo curto + link | [DECISÃO PM] |

## 5. Requisitos de Alto Nível Priorizados

| # | Requisito de alto nível | Feature | MoSCoW | Origem / justificativa |
|---|---|---|---|---|
| RAN-01 | Catálogo fixo de 5 fontes gratuitas com feed oficial, escolhidas por confiabilidade (RN-19): GE (obrigatória), ESPN Brasil, Gazeta Esportiva, Terra Esportes, UOL Esporte (candidata; substitutos Folha, Placar) | F1 | Must | [STAKEHOLDER] + [DECISÃO PM/BA] |
| RAN-02 | Bloqueio de fontes (exceto GE) com efeito imediato; padrão: nenhuma bloqueada | F1 | Must | [STAKEHOLDER] |
| RAN-03 | 15 esportes (PRD-TECNICO.md §2A); até 3 favoritos | F1 | Must | [STAKEHOLDER] |
| RAN-04 | Home lista as 30 notícias mais recentes das fontes não bloqueadas, com fonte, esporte, horário e link | F1 | Must | [STAKEHOLDER] |
| RAN-05 | Seção da home destacando as notícias mais recentes dos favoritos (somente notícias) | F1 | Must | [STAKEHOLDER] |
| RAN-06 | 1 time do coração entre os clubes da Série A do ano corrente; troca permitida | F2 | Must | [STAKEHOLDER] |
| RAN-07 | Painel lista todos os campeonatos do ano corrente em que o time participa (estadual, regional, Supercopa, Brasileirão, Copa do Brasil, Libertadores/Sul-Americana), com status | F2 | Must | [STAKEHOLDER] |
| RAN-08 | Por campeonato: resumo, tabela quando houver, partidas disputadas e próximas | F2 | Must | [STAKEHOLDER] |
| RAN-09 | Até 2 rivais, entre os demais clubes da Série A do ano corrente | F2 | Must | [STAKEHOLDER] |
| RAN-10 | Comparativo no Brasileirão: situação atual e jogos restantes do time e de cada rival | F2 | Must | [STAKEHOLDER] |
| RAN-11 | Simulação jogo a jogo até o fim do Brasileirão, com pontuação acumulada e projeção, somente entre time e rivais | F2 | Must | [STAKEHOLDER] |
| RAN-12 | Regra defensiva de virada de temporada: time salvo fora da Série A da nova temporada → aviso e nova escolha; rivais/simulação descartados; Brasileirão sem dados → estado "sem dados", nunca exceção silenciosa | F2 | Must | [DECISÃO PM] (substitui a exceção "fora do Brasileirão") |
| RAN-13 | Persistência local por dispositivo/navegador, sem conta; cenário simulado persistido como Should | F1+F2 | Must (cenário: Should) | [STAKEHOLDER] |
| RAN-14 | Onboarding em 2 passos puláveis (favoritos → time) | F1+F2 | Must | [DECISÃO PM] |
| RAN-15 | Atualização periódica (nunca ao vivo), carimbo por conjunto de dados, degradação visível | F1+F2 | Must | [STAKEHOLDER] (Q12) |
| RAN-16 | Uma página Web responsiva, pt-BR, acessível (nível WCAG pelo Coordenador) | — | Must | [STAKEHOLDER] |
| RAN-17 | Destaque de zonas na tabela do Brasileirão | F2 | Should | [DECISÃO PM] |
| RAN-18 | Deduplicação de manchetes | F1 | Should | [DECISÃO PM] |
| RAN-19 | Gratuito por padrão; pago exige consulta ao stakeholder | — | Must (regra) | [STAKEHOLDER] |
| RAN-20 | Contexto de protótipo: sem SLA, escala de grupo de teste, observabilidade e telemetria mínimas | — | Must (restrição) | [STAKEHOLDER] (Q10) |

## 6. Premissas e Riscos de Produto

| # | Premissa / Risco | Impacto se falsa / se concretizar | Severidade | Dono | Prazo de validação |
|---|---|---|---|---|---|
| **P-GE** | O GE (ge.globo) pode ser consumido legitimamente por feed oficial (ou API com termos compatíveis) | GE é obrigatório e não bloqueável; sem forma legítima, o chapéu CTO reabre o Gate 1 **só neste ponto** | **Crítica** | Gestor (chapéu BA) — verificação manual; stakeholder — permissão | Antes de RAN-01 entrar em desenvolvimento (idealmente antes da aprovação do `TASK.md`) |
| P1 | As 4 fontes além do GE têm feed oficial gratuito ativo e uso permitido para título + link | Substituir pela próxima da lista de substitutos (RN-19) | Média (3 verificadas; 1 candidata) | Coordenador confirma UOL (ou substituto) no `SDD.md`; stakeholder — permissão de uso | `SDD.md` |
| P2a | Calendário completo e tabela do Brasileirão Série A gratuitos | Sem isso, não há simulação | Alta | Gestor (chapéu BA) | Validada (rodada 2) |
| P2b | Fonte gratuita para estaduais, regionais, Copa do Brasil e continentais | Campeonatos "sem dados" no painel; fonte paga exige consulta (RAN-19) | Alta | Coordenador — teste com conta real | `SDD.md` |
| P3 | Lista de 15 esportes representa os mais assistidos | Muda recorte/classificação | Média (posições 12-15 com baixa confiança) | Stakeholder revisa posições 12-15 | Antes do `UX-SPEC.md` (ação fora do pipeline) |
| P4 | Torcedor aceita configurar favoritos e time no 1º acesso | M2 não se realiza | Média | Stakeholder/PM via grupo de teste | Medida por M2 |
| P7 | Calendário 2026 como modelo de competições | Modelo configurável por temporada | Baixa | Gestor (chapéu BA) | Validada |
| P8 | Provedor identifica eliminação/fase em mata-mata | Status errado ou "sem dados" em eliminatórias | Média | Coordenador | `SDD.md` |
| P10 | Existe um grupo de teste do protótipo grande o bastante para M1-M4 serem indicativas (coorte mínima 20 usuários, a confirmar) | Métricas sem significado; critério de pronto do protótipo inverificável | Média | Stakeholder — recrutamento | Antes do `/deploy` do protótipo |
| R1 | Risco jurídico de agregação de conteúdo e de uso de termos "não-comerciais" | No protótipo sem fim comercial, o risco é menor e o uso é mais defensável; **continua risco se virar produto** — revisão jurídica obrigatória antes de qualquer lançamento comercial | Média no protótipo / Alta se virar produto | Stakeholder | Antes de decisão de lançamento comercial |
| R2 | Cotas de free tier limitam frescor/cobertura | Dado envelhecido; escolha entre cobertura e frescor | Alta | Coordenador (`SDD.md`) | `SDD.md` |
| R4 | Fontes mudam URL/formato ou saem do ar (Lance descontinuou o feed em 2026, evidência direta) | Feed perde cobertura; para o GE é crítico | Média (Alta para o GE) | PM (sinalização, RAN-15); Coordenador (detecção) | `TASK.md` |
| R5 | Sem fonte gratuita para estaduais/regionais, painel parcial | Requisito "todos os campeonatos" parcialmente atendido; stakeholder decide entre lacuna e fonte paga | Alta | Stakeholder (decisão); Coordenador (opções no `SDD.md`) | `SDD.md` |

Encerrados nesta rodada: **P5, P6, P9** (decisões do stakeholder) e **R3** (sem
LLM — gatilho de reabertura do Gate 1 encerrado, ver `CTO-REVIEW.md`).

## 7. Perguntas em Aberto

### 7.1 Respondidas (registro de origem — não reabrir)

| # | Pergunta | Decisão do stakeholder | Rodada | Onde foi incorporada |
|---|---|---|---|---|
| Q1 | Fontes/quantidade/bloqueio | 30 mais recentes; fonte visível; bloqueio imediato; GE obrigatório e não bloqueável | 2 | RAN-01/02/04; P-GE |
| Q1b | Catálogo além do GE | **5 fontes no total, por confiabilidade**; as outras 4 propostas pelo PM/BA com critério explícito (RN-19) e status honesto | 3 | RAN-01; PRD-TECNICO.md §5.2 |
| Q2 | Recorte de esportes | 15 mais assistidos; até 3 favoritos; seção de destaque; só notícias | 2 | RAN-03/05; §2A |
| Q3 | Campeonatos | Todos do ano corrente, incluindo estaduais e regionais | 2 | RAN-07/08 |
| Q4 | Times elegíveis | **Somente clubes da Série A do Brasil no ano corrente.** Consequência avaliada pelo PM: a exceção "time fora do Brasileirão" deixou de ocorrer por seleção; foi **simplificada** para uma regra defensiva de virada de temporada (time salvo rebaixado/ausente da nova lista → aviso e nova escolha) e o caso "dado indisponível" segue o estado "sem dados", não a exceção | 3 | RAN-06/09/12; RN-04/RN-12 |
| Q5 | Rivais/comparação | Até 2 rivais do mesmo Brasileirão; comparativo; simulação; só Brasileirão | 2 | RAN-09/10/11 |
| Q6 | Persistência | Local, sem conta | 2 | RAN-13 |
| Q7 | Plataforma | Uma página Web | 2 | RAN-16 |
| Q8 | LLM | **Sem LLM; nenhuma funcionalidade de IA.** Gatilho de reabertura do Gate 1 encerrado (adendo no CTO-REVIEW.md) | 3 | §4 "fora"; R3 encerrado |
| Q9 | Modelo de negócio | Decisão futura; não bloqueia | 2 | R1 |
| Q10 | Orçamento e prazo | Sem número; "free pro MVP"; pago exige consulta. **Sem prazo; a aplicação é um protótipo**, sem compromisso de lançamento comercial nesta fase | 2 e 3 | RAN-19/20; §1; §3 (janela); RNFs |
| Q11 | Metas | Três métricas do stakeholder + M4 do PM; janela ajustada para grupo de teste | 2 e 3 | §3 |
| Q12 | Ao vivo | Fora; periódico | 2 | RAN-15 |
| Q13 | Janela do feed | "30 mais recentes" | 2 | RAN-04 |
| Q14 | Simulação | **Somente entre time do coração e rivais**; sem posição na tabela completa | 3 | RAN-11; P9 encerrada |

### 7.2 Ainda abertas

**Nenhuma pergunta de produto pendente.** Restam três ações fora do pipeline de
agentes, já com dono:

1. Verificação manual do feed oficial e dos termos de uso do GE (P-GE — Gestor/BA
   + stakeholder).
2. Revisão, pelo stakeholder, das posições 12-15 da lista de esportes (P3).
3. Confirmação, pelo Coordenador, do feed da 5ª fonte (UOL Esporte) ou adoção do
   substituto (P1) — UOL, Folha e Estadão não são acessíveis pela ferramenta do BA.

---

**Stakeholder alignment check (rodada 3, 2026-09-05)**: (1) objetivo de negócio:
inalterado; (2) público/escopo: restringido (Série A; 5 fontes; sem IA) — dentro
do aprovado; (3) orçamento/prazo: "protótipo sem prazo e sem lançamento
comercial" é compatível com a plausibilidade do Gate 1 e reduz a exposição das
ressalvas R1/R3 do CTO; (4) gap de roster: o gap condicional de IA/ML desaparece
com "sem LLM". **Sem divergência do Gate 1; liberado para o chapéu BA em
2026-09-05.**
