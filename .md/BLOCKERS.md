# BLOCKERS.md

## Bloqueio 001 — 2026-09-06
- Reportado por: executor (chapéu Backend, QA-02)
- Escalado para: coordenador
- Artefato/trecho afetado: `.md/PRD-TECNICO.md` CA-08.5 (RF-08); implementação em
  `app/rotas/paginas/DetalheCampeonato.tsx` (variável `ehMataMata`/`dadosClassificacao`)
- Descrição: CA-08.5 exige que, ao mudar de formato (grupos → mata-mata), o
  sistema "passe a CA-08.4 e mantenha a tabela final do grupo acessível". A
  implementação atual zera `dadosClassificacao` por completo sempre que
  `competicao.formato === 'mata-mata'`, sem nenhum mecanismo (estado, rota, aba)
  que preserve acesso à tabela final do grupo anterior. Além disso, por decisão
  de detalhe já registrada no próprio arquivo (linhas 45-58), a única fonte de
  classificação hoje publicada é a do Brasileirão, cujo formato é sempre
  `pontos-corridos` (SPK-01: só o Brasileirão tem cobertura garantida de
  tabela) — ou seja, nenhum dado real aciona esse caminho de código hoje. Isso
  é uma lacuna de **implementação**, não de teste: QA-02 é tarefa de
  auditoria/consolidação de testes já escritos (DOM-02 a DOM-06 e telas que os
  exercitam), não de reimplementação de comportamento novo, então não cabe ao
  Executor decidir sozinho se implementa a preservação da tabela agora (sem
  fonte real que a exercite) ou se adia.
- Impacto se não resolvido: CA-08.5 permanece sem cobertura de teste (1 de 62
  CA-xx auditados nesta tarefa); QA-01 (portão de acessibilidade do Lote 12) não
  depende deste item para prosseguir, e as demais 61 entradas da auditoria estão
  fechadas — não bloqueia o restante do lote.
- Sugestão (opcional): (a) implementar agora a preservação da tabela final do
  grupo em `DetalheCampeonato.tsx` mesmo sem fonte de dado real que a exercite
  hoje (tarefa nova de Frontend, pequena); ou (b) registrar adiamento explícito
  até que uma fonte de campeonato de formato `grupos`/`misto` seja publicada,
  com nota no próprio RF-08/CA-08.5 do PRD-TECNICO.md sobre a limitação atual.
- Status: Resolvido
- Resolução (2026-09-06, executor/chapéu Frontend): implementada a opção (a) da
  sugestão — preservação da tabela final do grupo, mesmo sem fonte real que
  exercite o caminho hoje.
  - Contrato estendido de forma aditiva (`app/dados/futebol.ts` e, em espelho,
    `pipeline/publicacao/gerador-snapshots.ts`): novo campo opcional
    `classificacaoFinalDoGrupo` em `campeonatoDoClubePublicoSchema` (mesmo
    schema de `LinhaClassificacao`), representando a tabela do grupo
    "congelada" no momento em que o campeonato muda para mata-mata.
    `undefined`/`null`/vazio ⇒ nada a preservar (mesmo comportamento de hoje,
    nenhum arquivo publicado precisa ser regravado).
  - `app/rotas/paginas/DetalheCampeonato.tsx` (UI-T06-01/UI-T06-02): quando
    `ehMataMata` e há `classificacaoFinalDoGrupo`, um botão "VER TABELA DO
    GRUPO" (`Botao` design system, `aria-expanded`) alterna a exibição da
    tabela final do grupo — oculta por padrão (CA-08.4/confronto continua
    sendo a visão padrão), acessível sob demanda (CA-08.5). Sem
    `classificacaoFinalDoGrupo`, nenhum botão aparece — comportamento
    idêntico ao anterior.
  - Teste com fixture em `app/rotas/paginas/DetalheCampeonato.test.tsx`
    ("CA-08.5: muda para mata-mata mas mantém a tabela final do grupo
    acessível (fixture)" e o caso sem o campo), documentando explicitamente
    que nenhuma fonte real aciona esse caminho hoje — mesmo padrão de
    documentação já usado nas linhas 45-58 do próprio arquivo.
  - Verificado: `tsc --noEmit` limpo, `eslint` limpo, suíte completa
    (`vitest run`) 95 arquivos / 1044 testes passando.
  - Limitação registrada permanece válida: até uma fonte real de
    grupos→mata-mata ser publicada, este caminho só é exercitado por teste.

## Bloqueio 002 — 2026-09-06
- Reportado por: validador (checagem estrutural do Lote 13, a partir do
  achado de SPK-04)
- Escalado para: coordenador
- Artefato/trecho afetado: `.md/adr/012-telemetria-minima-anonima-com-identificador-local.md`,
  regra 4 (Ferramenta de telemetria)
- Descrição: ADR-012 regra 4 registra **GoatCounter** como opção padrão e
  **Cloudflare Web Analytics** como alternativa, com a confirmação de plano
  e termos delegada ao "spike SP-04" (hoje SPK-04). SPK-04 concluiu, com
  evidência técnica verificável (não opinião): Cloudflare Web Analytics
  **não suporta eventos customizados** — só pageviews agregados — e por isso
  **não cobre nenhum dos 5 eventos de RNF-07**, todos customizados. GoatCounter
  permanece válido (confirma a regra 4 nesse ponto). A alternativa recomendada
  em lugar de Cloudflare é **Umami Cloud** (tier gratuito hospedado, 100
  mil eventos/mês, cookieless, eventos customizados nativos). Decidir se e
  como atualizar o texto do ADR-012 regra 4 (trocar a alternativa registrada)
  é mudança de conteúdo de ADR — fora da autoridade do Validador, que só
  audita/valida, e fora da autoridade do Executor que rodou o spike.
- Impacto se não resolvido: nenhum, hoje. TEL-01 já está implementado e
  funcional com sumidouro local em memória, sem nenhuma ferramenta de
  terceiro plugada (`assinarColetor` permanece sem adaptador). Só passa a
  importar quando alguém decidir plugar de fato uma ferramenta de telemetria
  externa — nesse momento, a escolha entre GoatCounter e Umami Cloud (e a
  atualização do ADR-012 regra 4 e do host em `connect-src`, `app/index.html`)
  precisa estar decidida.
- Sugestão (opcional): atualizar ADR-012 regra 4 substituindo Cloudflare Web
  Analytics por Umami Cloud como alternativa a GoatCounter, com nota
  referenciando a evidência de SPK-04 (`.md/TASK.md`, tabela do Lote 13).
- Status: Aberto, não bloqueante (não impede a validação do Lote 13 nem
  nenhum deploy hoje).

## Bloqueio 003 — 2026-09-06
- Reportado por: validador (checagem estrutural do Lote 13, a partir do
  achado de SPK-03)
- Escalado para: coordenador (dono do conteúdo do ADR-013); sinalizado em
  paralelo ao gestor (relevância estratégica na decisão de negócio de P-GE)
- Artefato/trecho afetado: `.md/adr/013-comportamento-do-produto-sem-forma-legitima-de-consumir-o-ge.md`
  (P-GE); indiretamente, a decisão futura sobre a 5ª fonte do catálogo
  (`config/fontes.json`, `uol-esporte.substitutos: ["folha-esporte", "placar"]`)
- Descrição: SPK-03 (`verificar-catalogo` em rede aberta) trouxe um achado
  novo, não apenas a reafirmação da limitação de rede já conhecida (ADR-007/
  013): os Termos e Condições publicados do Placar
  (`placar.com.br/termos-e-condicoes/`, Editora Score) **proíbem
  explicitamente** "robôs ou qualquer dispositivo para monitorar ou copiar
  conteúdo da Score". Isso é um sinal negativo claro (não ambíguo, como os
  achados anteriores sobre UOL/GE) contra usar o Placar como substituto da
  5ª fonte (`uol-esporte`) — relevante porque o catálogo já lista Placar como
  um dos dois substitutos candidatos e porque a decisão de P-GE/ADR-013 é
  decisão de negócio do stakeholder, não do Executor/Validador.
- Impacto se não resolvido: nenhum imediato — `config/fontes.json` já mantém
  Placar fora do catálogo, decisão que continua correta com ou sem este
  achado. O impacto é apenas que a base de evidência para uma futura decisão
  de substituição de fonte (ou para o próprio ADR-013/P-GE) ficaria
  incompleta se este achado não chegar à atenção de quem decide.
- Sugestão (opcional): incluir este achado como argumento adicional no
  ADR-013 (seção de alternativas/consequências de P-GE) ou em qualquer
  registro de avaliação de fonte substituta que o Coordenador mantenha,
  referenciando `.md/TASK.md`, tabela do Lote 13, nota de SPK-03.
- Status: Aberto, não bloqueante (catálogo já reflete a decisão correta;
  achado é insumo para decisão futura, não correção de erro atual).

## Bloqueio 004 — 2026-09-06
- Reportado por: orquestrador (usuário), durante `/deploy` — confirmação final
  de CI real após `git push` do commit `43d26e9` para `origin/main`
- Escalado para: executor (correção de código/teste); decisão de produto
  (qual das duas correções, ver abaixo) pode exigir confirmação do
  coordenador/gestor antes de implementar
- Artefato/trecho afetado: `app/rotas/sobreposicoes/Configuracoes/SecaoFontesDeNoticia.test.tsx`
  (caso "CA-01.2"), e possivelmente todo padrão de formatação de hora local
  que dependa do fuso do processo (`CarimboFrescor`, `avaliador-fontes`,
  qualquer teste/tela com "instavelDesde"/timestamp formatado)
- Descrição: primeira execução real do workflow `build-publish.yml` em CI
  (GitHub Actions, run `34056870754`, disparado pelo push do commit `43d26e9`)
  reprovou no job `build`, step "Testes": 1 de 1099 testes falhou —
  `SecaoFontesDeNoticia.test.tsx` espera `"⚠ Instável desde 04/09, 09h12"`
  para o instante `2026-09-04T09:12:00-03:00`, mas o runner (UTC, sem `TZ`
  setado) formatou `"12h12"`. O teste (e possivelmente o componente) depende
  implicitamente do fuso horário do processo que executa — verdade por acaso
  no ambiente local usado até aqui (`TZ=America/Sao_Paulo`), falso no runner
  real do GitHub Actions. Detalhe completo e as duas opções de correção
  documentadas em `.md/DEPLOY.md`, Seção 6.
- Impacto se não resolvido: `main` no repositório real
  (`github.com/leandrosegheto17/SportsLM`) fica com CI vermelho; nenhum
  deploy real (`/deploy`) consegue publicar enquanto este teste falhar no job
  `build` (o job `publish` depende de `build` ter sucesso). **Nenhum conteúdo
  quebrado foi ao ar** — o job `publish` nunca rodou, GitHub Pages não foi
  tocado.
- Sugestão (opcional): (a) fixar `TZ=America/Sao_Paulo` no ambiente de teste
  (`vitest.config.ts` ou variável de ambiente do workflow) para tornar a
  suíte determinística, mantendo o componente formatando no fuso de quem
  visita em produção normal; ou (b) formatar explicitamente em
  `America/Sao_Paulo` (`timeZone` fixo) se a intenção de produto for sempre
  mostrar horário de Brasília a qualquer visitante — esta segunda opção é
  uma decisão de produto, não escolha livre do Executor.
- Status: Aberto, bloqueante para publicação (não afeta nenhum lote já
  `Validado` retroativamente — é achado da confirmação final de `/deploy`,
  não de nenhuma validação de lote anterior).
- Atualização (2026-09-07, executor): antes de aplicar a correção (a) sugerida
  (fixar `TZ=America/Sao_Paulo` só no ambiente de teste, mantendo o componente
  formatando no fuso local do processo/visitante), confirmei rapidamente
  `.md/UX-SPEC.md`/`.md/PRD-TECNICO.md` conforme pedido nos guardrails da
  tarefa — e encontrei evidência formal, não ambígua, de que a intenção de
  produto é o caso (b), não o (a):
  - **RNF-02** (`PRD-TECNICO.md`, Seção 2, tabela de RNFs): "Idioma/localidade
    — Só pt-BR; dd/mm/aaaa; **America/Sao_Paulo**" — requisito não-funcional
    explícito de que a localidade/fuso é **fixo** em America/Sao_Paulo, não
    derivado do navegador/máquina de quem visita.
  - **RN-07** ("Feed = 30 mais recentes; fuso; retenção", `PRD-TECNICO.md`):
    "30 itens mais recentes por data de publicação [...] sem janela de horas;
    **America/Sao_Paulo**; descarte de armazenamento após 7 dias" — mesma
    âncora de fuso fixo, aplicada à regra de negócio do feed (RF-04/RF-05/
    RF-15/RF-19), não só a um detalhe visual isolado.
  Isso contraria a premissa com a qual a tarefa foi aberta (de que "mostrar a
  hora no fuso do visitante" seria o comportamento correto e intencional de
  produto, cabendo só corrigir o determinismo do teste). Ao contrário: os dois
  achados acima são evidência forte de que `formatarDataHora` (e qualquer
  outro ponto do código com o mesmo padrão — `getDate()`/`getHours()`/
  `getMonth()` lendo o fuso do processo/runtime) deveria formatar
  explicitamente em `America/Sao_Paulo` (via `timeZone` fixo no
  `Intl.DateTimeFormat`), não no fuso do visitante — ou seja, a opção (b) da
  Seção 6 do `DEPLOY.md`, que é mudança de **comportamento de produto**, fora
  da autoridade do Executor decidir sozinho.
  - Conforme guardrail explícito desta tarefa ("se... a intenção de produto É
    sempre mostrar horário de Brasília... pare e escale para o
    coordenador/gestor em vez de decidir sozinho"), **não apliquei nenhuma
    correção** (nem (a) no `vitest.config.ts`, nem (b) no componente) e não
    alterei nenhum arquivo de produção/teste. O comando corrente deve pausar
    aqui para o usuário/orquestrador decidir com o coordenador/gestor.
  - Pergunta objetiva para o coordenador/gestor decidir: RNF-02/RN-07 foram
    escritos pensando em **dados** (data de publicação, ordenação do feed,
    janela de frescor/retenção) calculados a partir de timestamps do
    provedor/pipeline — cenário em que "fuso fixo America/Sao_Paulo" faz
    sentido óbvio para consistência de dados server-side — ou também cobrem
    explicitamente a **apresentação/renderização** na tela para qualquer
    visitante, em qualquer fuso onde ele esteja fisicamente? Se for só o
    primeiro (dado/ordenação), a opção (a) (fixar TZ só no ambiente de teste,
    sem tocar no componente) permanece correta e este bloqueio pode ser
    resolvido como planejado originalmente. Se for o segundo, a correção certa
    é a opção (b) — `timeZone: 'America/Sao_Paulo'` explícito em
    `formatarDataHora` e em todo ponto equivalente (`CarimboFrescor`,
    `avaliador-fontes`, `DetalheCampeonato.tsx`, etc.) — tarefa de
    Frontend/Backend maior que uma correção de `vitest.config.ts`, com
    ADR/nota de RNF-02 atualizada para deixar isso explícito e testes
    reescritos para fixar o `timeZone` no assert em vez de depender do TZ do
    processo.
- Status: Resolvido
- Decisão do stakeholder (2026-09-07, orquestrador/usuário): RNF-02/RN-07
  (`.md/PRD-TECNICO.md`) cobrem **só o cálculo interno** do pipeline/domínio
  (janelas de dedup/frescor/retenção, ordenação do feed) — que já usam
  `agora: Date` recebido por parâmetro, nunca leem o relógio do sistema
  diretamente. A **apresentação na tela continua no fuso do navegador do
  próprio visitante** (comportamento padrão web) — isso não muda. A pergunta
  levantada na atualização anterior está resolvida: nenhum componente de
  produção (`formatarDataHora`, `CarimboFrescor`, `DetalheCampeonato.tsx`,
  etc.) precisa mudar; a opção (b) da Seção 6 do `DEPLOY.md` não se aplica.
- Resolução (2026-09-07, executor): aplicada a opção (a), como planejada
  originalmente antes da escalada.
  - Causa raiz confirmada: `formatarDataHora` em
    `app/rotas/sobreposicoes/Configuracoes/SecaoFontesDeNoticia.tsx` usa
    `new Date(iso).getDate()`/`getHours()`/etc., que lê o fuso horário do
    processo — correto para produção (fuso do visitante), mas fazia o teste
    `SecaoFontesDeNoticia.test.tsx` (caso "CA-01.2") depender implicitamente
    do fuso da máquina que roda a suíte.
  - Correção: `vitest.config.ts` agora fixa `test.env.TZ =
    'America/Sao_Paulo'`, tornando a suíte determinística em qualquer
    máquina/CI, sem tocar em nenhum componente de produção.
  - Prova (reprodução antes/depois, simulando a diferença entre o ambiente
    local original e o runner do GitHub Actions):
    - Antes da correção, `TZ=UTC npm run test -- app/rotas/sobreposicoes/
      Configuracoes/SecaoFontesDeNoticia.test.tsx` reproduziu a falha real
      vista em CI (esperado `"⚠ Instável desde 04/09, 09h12"`, obtido
      `"12h12"` — mesmo sintoma do run `34056870754`).
    - Depois da correção, o mesmo comando (`TZ=UTC` ainda setado no shell
      externo) passou com os 6 testes do arquivo — prova de que o Vitest
      sobrescreve a timezone internamente, independente do TZ do shell.
  - Suíte completa (`npm run test`, sem forçar `TZ` no shell):
    1099/1099 testes passando (97 arquivos), incluindo os demais pontos que
    dependem do mesmo padrão de formatação de data/hora (`LinhaPartida.test.tsx`,
    `SecaoUltimasNoticias.test.tsx`), agora determinísticos pela mudança no
    ambiente de teste inteiro, sem alteração pontual por arquivo.
  - Grep de confirmação: `DetalheCampeonato.tsx`, `Comparativo.tsx`,
    `PainelTime.tsx` e `SecaoIdentidade.tsx` não usam `getHours()`/`getDate()`/
    `getMonth()` — nenhuma alteração necessária neles.
  - Portões: `npm run typecheck`, `npm run lint`, `npm run format:check` e
    `npm run build` — todos limpos.
  - Nenhum arquivo de produção foi alterado; único arquivo modificado é
    `vitest.config.ts`.
