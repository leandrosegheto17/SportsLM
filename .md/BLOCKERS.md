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

## Bloqueio 005 — 2026-09-07
- Reportado por: orquestrador (usuário), durante a re-tentativa de `/deploy`
  após a correção do Bloqueio 004 (run `34132808687`, commit `2006372`)
- Escalado para: executor (correção do verificador) ou coordenador (se a
  correção exigir decisão sobre precisão vs. segurança do portão)
- Artefato/trecho afetado: `pipeline/ci/verificar-segredos.mjs` (regex
  `/\btoken\b/i`); campo de domínio `zona.token` em
  `dominio/tipos/futebol.ts`/`app/design-system/componentes/TabelaClassificacao/TabelaClassificacao.tsx`
- Descrição: com o Bloqueio 004 corrigido, o job `build` de `build-publish.yml`
  passou por todos os portões de qualidade (typecheck/lint/format/test/audit)
  pela primeira vez em CI real — mas reprovou no passo seguinte, "Verificação
  de segredo no artefato publicado" (`npm run verificar-segredos`, FUND-03):
  `dist/assets/index-*.js: padrão 'token'`. É **falso positivo**: o bundle
  contém `zona.token` (campo de domínio das zonas de classificação —
  `'libertadores'`/`'rebaixamento'`/etc., RN-15/RF-18), não nenhum segredo
  real. O regex `/\btoken\b/i` é deliberadamente cru (SDD §7.2: "erra para o
  lado seguro") e nunca tinha sido exercitado contra um `dist/` real de ponta
  a ponta em CI antes (localmente, FUND-03 testou contra um bundle anterior à
  introdução do campo `zona.token`, que veio depois, no Lote 10).
- Impacto se não resolvido: **todo** deploy futuro falha no mesmo ponto,
  permanentemente — não é uma falha pontual como o Bloqueio 004, é
  estrutural enquanto `zona.token` existir no bundle. `main` seguirá com CI
  vermelho; nenhum conteúdo quebrado vai ao ar (mesmo comportamento do
  Bloqueio 004: o job `publish` nunca chega a rodar).
- Sugestão (opcional): tornar o padrão `token` mais preciso sem enfraquecer a
  proteção real — ex. exigir contexto de atribuição/valor
  (`token[:=]\s*['"][A-Za-z0-9_-]{16,}`) em vez de casar a palavra isolada,
  mantendo os outros 3 padrões (`api_key`, `Bearer`, chave-hex-32+) como
  estão. Alternativa (não recomendada sem decisão do Coordenador): renomear
  o campo de domínio `zona.token` para evitar a palavra — mudança de
  contrato mais invasiva, tocando `dominio/tipos/futebol.ts` e todo
  consumidor.
- Status: Resolvido
- Resolução (2026-09-07, executor): aplicada a correção sugerida — o padrão
  `token` agora exige o formato real de um segredo vazado, não a palavra
  isolada.
  - Regex anterior: `/\btoken\b/i` — casava a palavra `token` em qualquer
    contexto, incluindo acesso de propriedade (`o.token`, `zona.token`,
    `token:S.enum(...)`, sem valor de segredo atribuído.
  - Regex nova: `/\btoken["']?\s*[:=]\s*["'](?=[A-Za-z0-9_\-.]*[0-9])[A-Za-z0-9_\-.]{16,}["']/i`.
    Exige, na sequência de `token`: (1) um separador de atribuição (`:` ou
    `=`, com aspas opcionais entre a palavra e o separador); (2) um valor
    entre aspas; (3) valor com 16+ caracteres; (4) pelo menos um dígito no
    valor. As 4 condições combinadas isolam o formato real de um segredo
    vazado (`token: "sk_live_..."`, `token = "eyJhbG...MzQ1..."`) do uso de
    `token` como nome de campo/propriedade de domínio (`zona.token`,
    `o.zona.token`, `data-zona={...token}`) e do valor curto de enum de
    domínio (`token: 'libertadores'`, `token: 'pre-libertadores'` — 12–17
    caracteres, só letras/hífen, sem dígito, os 4 valores fixos de
    `TOKENS_DE_ZONA` em `dominio/tipos/futebol.ts`/`config/zonas.ts`).
    Os outros 3 padrões (`api_key`, `Bearer`, `chave-hex-32+`) não foram
    tocados — a proteção real contra os formatos de segredo mais comuns
    permanece tão ampla quanto antes: `Bearer` continua casando a palavra
    isolada (cobre qualquer token OAuth atrás de `Authorization: Bearer`,
    mesmo sem dígito no valor), e `chave-hex-32+` continua casando qualquer
    sequência hexadecimal longa independente de contexto.
  - Por que a margem de segurança não foi reduzida: o requisito de dígito no
    valor é uma heurística de domínio (os 4 tokens de zona são sempre
    palavras/hífen puros, nunca dígito), não uma regra genérica frágil —
    segredos reais (chave de API, JWT, token opaco gerado por
    fornecedor) são strings pseudo-aleatórias que quase sempre contêm ao
    menos um dígito; e mesmo no caso raro de um segredo sem nenhum dígito, o
    padrão `Bearer` (quando o segredo aparece como cabeçalho de autorização,
    o caso mais comum de vazamento em bundle de frontend) e o padrão
    `chave-hex-32+` continuam cobrindo, sem depender do padrão `token`.
  - Prova (`tests/verificar-segredos.test.ts`, 21 casos — os 10 já existentes
    mantidos, mais 11 novos): `npx vitest run tests/verificar-segredos.test.ts`
    → 21/21 passando, incluindo os casos novos que reproduzem exatamente o
    achado (`zona.token`, `data-zona={...token}`, `token: 'libertadores'`,
    `token: 'pre-libertadores'`, `token:S.enum(d0)` → sem achado; `token:
    "sk_live_..."`, JWT com dígito → achado). A fixture do primeiro caso
    pré-existente (`'const config = { token: "abc" };'`) foi ajustada para
    `"abc123longstring"` — um valor de 3 caracteres nunca seria um segredo
    real; o caso em si (token com valor atribuído é detectado) foi mantido,
    só a fixture ficou mais representativa. Mesmo ajuste na fixture do teste
    de integração (`"segredo-de-teste"` → `"segredo-de-teste-2026"`, com
    dígito).
  - **Prova de ponta a ponta contra o bundle real** (o que de fato disparou
    este bloqueio): `npm run build` (gera `dist/` real, mesmo bundle que
    reprovou em CI) seguido de `npm run verificar-segredos dist` →
    `Varredura de segredo: nenhum padrão encontrado em 'dist'.` Confirmado
    por leitura direta do bundle minificado gerado: as ocorrências reais de
    `token` no JS são todas acesso de propriedade/schema
    (`token:S.enum(d0)`, `o.zona.token`, `u.token`, `n.token`), nenhuma no
    formato `token[:=]"valor"` — exatamente o padrão que o novo regex não
    casa. Teste de injeção manual confirmou que um segredo real
    (`const token = "sk_live_abcdefghijklmnop1234567890";`) apensado ao
    mesmo bundle real segue sendo detectado.
  - Demais portões: `npm run typecheck`, `npm run lint`,
    `npm run format:check`, `npm run test` (97 arquivos, 1107 testes) —
    todos limpos.
  - Arquivos alterados: `pipeline/ci/verificar-segredos.mjs` (regex do
    padrão `token` + comentário explicando a decisão) e
    `tests/verificar-segredos.test.ts` (casos novos + 2 fixtures ajustadas).
    Nenhum arquivo de domínio/produção tocado — `dominio/tipos/futebol.ts`,
    `config/zonas.ts` e `TabelaClassificacao.tsx` permanecem inalterados,
    conforme guardrail da tarefa.
  - `dist/` gerado durante a verificação foi removido ao final; confirmado
    via `git status` que nada ficou staged/pendente (já coberto por
    `.gitignore`).

## Bloqueio 006 — 2026-09-07
- Reportado por: orquestrador (usuário), decisão de infraestrutura tomada
  diretamente fora do fluxo normal de `TASK.md`
- Escalado para: executor (implementação direta, sem passar por
  coordenador/gestor — decisão de hosting já fechada pelo stakeholder)
- Artefato/trecho afetado: `.github/workflows/ingestao.yml` (passo "Publica
  snapshots na branch dados"); `.md/adr/002-ingestao-periodica-em-ci-agendado-com-estado-versionado.md`
  (decisão de destino dos snapshots públicos)
- Descrição: o projeto passou a usar **Vercel** como hosting principal da SPA
  (`https://sports-lm.vercel.app`), conectado por integração Git a
  `origin/main` — todo push em `main` já dispara build+deploy automático do
  Vercel, sem depender de nenhum workflow do GitHub Actions. `vercel.json`
  (rewrite de SPA) já commitado. Achado: o pipeline de ingestão publicava os
  snapshots públicos (`/dados/*.json`, SDD §2.2) na branch órfã `dados`
  (ADR-002), mecanismo pensado para GitHub Pages que nunca chegou a
  funcionar de ponta a ponta (Pages nunca foi habilitado — `.md/DEPLOY.md`
  Seção 2). O Vercel só builda/serve o conteúdo de `main`, então
  `/dados/*.json` nunca existia lá — confirmado por
  `curl https://sports-lm.vercel.app/dados/versao.json` → 404 antes desta
  mudança. A SPA carregava, mas sem notícia/futebol real.
- Impacto se não resolvido: produção no Vercel permanece sem dado real
  (notícias/futebol) indefinidamente — a SPA funciona, mas o feed/tabelas
  ficam vazios/desatualizados para sempre, já que o destino de publicação
  nunca alcança o host real.
- Decisão do stakeholder: os snapshots públicos passam a ser commitados
  direto em `app/public/dados/`, na própria `main` — o Vercel já auto-deploya
  a cada push, resolvendo a entrega sem precisar de integração nova com a API
  do Vercel. Trade-off aceito: histórico de `main` cresce um commit por
  execução em que o hash muda (mesma cadência de 30 min, só quando o
  conteúdo muda — comportamento de "publica só se mudou" preservado).
- Status: Resolvido
- Resolução (2026-09-07, executor/chapéu Backend):
  - `.github/workflows/ingestao.yml`, passo final: deixou de trocar de
    branch (`git checkout dados`/`--orphan dados`); agora permanece em
    `main`, copia `dist-dados/` para `app/public/dados/` (sobrescrevendo o
    que houver), `git add app/public/dados`, e comita/push direto em `main`
    só quando o conteúdo muda (mesma checagem `git diff --cached --quiet` já
    existente, adaptada ao novo caminho). Mensagem de commit mantida
    (`chore(dados): atualiza snapshots de ingestão [skip ci]`). Antes do
    `git push`, `git fetch origin main` + `git rebase origin/main`, para não
    falhar por non-fast-forward se `main` tiver avançado desde o checkout do
    job. A verificação de segredo bloqueante (`npm run verificar-segredos:dados`)
    continua rodando sobre `dist-dados/` antes da cópia, sem mudança de
    ordem/lógica. `permissions.contents: write` mantido (mesmo escopo,
    agora usado para comitar em `main` em vez da branch `dados`).
  - `.md/adr/018-publicacao-de-snapshots-publicos-direto-em-main-para-vercel.md`
    criado (formato MADR, mesmo padrão dos ADRs existentes), registrando
    contexto, alternativas descartadas (segundo projeto Vercel para a branch
    `dados`, integração via API do Vercel, reabilitar GitHub Pages) e a
    decisão. `.md/adr/002-...md` recebeu nota de supersessão parcial no
    topo: só a parte de destino dos **snapshots públicos** foi substituída;
    a branch órfã `dados` continua sendo a decisão vigente (documentada)
    para o **estado interno** do pipeline.
  - **Observação separada, não resolvida aqui** (achado colateral da
    investigação, conforme guardrail explícito da tarefa): confirmado, lendo
    `pipeline/noticias/orquestrador.ts`/`pipeline/futebol/orquestrador.ts` e
    o próprio `ingestao.yml`, que `SPORTSLM_DIR_ESTADO` nunca é setado no
    workflow (usa o default local `estado/` na raiz do checkout) e que o
    workflow **nunca** teve um passo que restaure `estado/` de alguma branch
    antes de `npm run ingestao`, nem que o commite de volta depois — só o
    passo de publicação dos snapshots públicos (agora corrigido) existe.
    Ou seja, **o estado interno não persiste entre execuções agendadas
    hoje**, contrariando a premissa original de ADR-002 ("branch órfã
    `dados`... commitada ao final de cada execução" — essa parte nunca foi
    implementada, é lacuna pré-existente e separada do que este bloqueio
    resolve). Nenhuma correção foi aplicada a este ponto nesta tarefa —
    fica registrado aqui e no `ADR-018` para decisão futura do
    Coordenador/gestor sobre como (e se) implementar a persistência real do
    estado interno entre execuções (ex.: passo dedicado de
    restore/commit na branch `dados`, ou outro mecanismo).
  - Validação: sintaxe YAML confirmada via `js-yaml` (parse bem-sucedido, 8
    steps no job `ingestao`, mesma técnica já usada no Lote 1/QA-REPORT.md);
    `npm run typecheck`, `npm run lint`, `npm run format:check` limpos;
    suíte completa (`npm run test`) 97 arquivos / 1107 testes passando (sem
    nenhuma alteração de comportamento de produção — mudança é só no
    workflow). Não foi feito nenhum `git push`/execução real do workflow
    nesta tarefa (não testável de dentro desta sessão sem afetar o
    repositório de produção) — prova é revisão cuidadosa do YAML +
    validação de sintaxe, mesmo padrão já aceito em rodadas anteriores
    (Bloqueios 004/005).
  - Arquivos alterados: `.github/workflows/ingestao.yml`,
    `.md/adr/018-publicacao-de-snapshots-publicos-direto-em-main-para-vercel.md`
    (novo), `.md/adr/002-ingestao-periodica-em-ci-agendado-com-estado-versionado.md`
    (nota de topo), `.md/BLOCKERS.md` (esta entrada). Nenhum arquivo de
    domínio/pipeline de geração de dado tocado
    (`pipeline/publicacao/gerador-snapshots.ts`,
    `pipeline/noticias/orquestrador.ts`, `pipeline/futebol/orquestrador.ts`
    permanecem inalterados, conforme guardrail da tarefa);
    `.github/workflows/build-publish.yml` não removido nem desabilitado.

## Bloqueio 007 — 2026-09-07
- Reportado por: orquestrador (usuário), ao gerar o primeiro snapshot real
  em `app/public/dados/` para validar o Bloqueio 006 (ADR-018) de ponta a
  ponta
- Escalado para: executor (correção do verificador); resolvido diretamente
  pelo orquestrador, mesmo padrão dos Bloqueios 004/005
- Artefato/trecho afetado: `pipeline/ci/verificar-segredos.mjs` (padrão
  `chave-hex-32+`); `ItemNoticia.id`/`versao.json.hashes` (sha256 de 64
  caracteres hex, contrato público do SDD §2.2)
- Descrição: ao rodar `verificar-segredos` contra o primeiro `app/public/dados/`
  real (Fluxo 1, feeds reais), o padrão `chave-hex-32+`
  (`/\b[0-9a-fA-F]{32,}\b/`) bloqueou `versao.json` e `noticias.json`. É
  **falso positivo estrutural, não pontual**: `id` de cada notícia é
  literalmente definido como "sha256 do link canônico" (CA-15.3), e cada
  entrada de `versao.hashes` também é um digest sha256 — ambos sempre
  exatamente 64 caracteres hex, presentes em **todo** snapshot público que o
  pipeline já produz, por contrato. Sem correção, **nenhuma publicação de
  dado real jamais passaria** por este portão (bloqueio permanente, mesma
  classe do Bloqueio 005, mas no verificador de dados em vez do bundle da
  SPA).
- Impacto se não resolvido: `ingestao.yml` nunca conseguiria publicar
  nenhum dado real em `app/public/dados/`/`main` (Bloqueio 006/ADR-018),
  mesmo com `FOOTBALL_DATA_API_TOKEN` cadastrado — o passo de verificação de
  segredo falharia sempre, antes de qualquer commit.
- Resolução (2026-09-07, orquestrador): `chave-hex-32+` passou de regex pura
  para uma função de teste que ainda casa qualquer trecho hex de 32+
  caracteres, mas **exclui exatamente 64 caracteres** (comprimento fixo de
  um digest sha256, nunca outro) da lista de achados — qualquer outro
  comprimento de 32+ (a maioria dos formatos reais de chave de API/token
  opaco não usa exatamente 64) continua bloqueando. Os padrões `token`
  (Bloqueio 005), `api_key` e `Bearer` não foram alterados — continuam
  cobrindo um vazamento real de segredo mesmo que ele, por coincidência,
  tenha 64 caracteres hex e não seja pego pela exceção do sha256 (ex.
  `Bearer <64-hex-chars>` ainda dispara pelo padrão `Bearer`, independente
  do comprimento do valor).
  - `tests/verificar-segredos.test.ts`: 3 casos novos (id de notícia sha256
    isolado, `versao.json` real com os 4 hashes, e um `noticias.json`/
    `versao.json` completo via `varrerDiretorio`) confirmando ausência de
    falso positivo; nenhum caso existente (incluindo os que provam detecção
    real de segredo, ex. chave hex de 32 caracteres — comprimento diferente
    de 64) foi removido ou teve seu resultado esperado alterado.
  - Prova real: `node pipeline/ci/verificar-segredos.mjs app/public/dados`
    contra o primeiro snapshot real gerado (Fluxo 1, feeds reais,
    2026-09-07) passou limpo depois da correção (falhava antes).
  - Achado colateral fechado no mesmo commit: `app/public/dados/` (agora
    versionado em `main`, ADR-018) não estava no `.prettierignore` —
    `format:check` falharia a cada execução da ingestão por divergência de
    formatação entre o `JSON.stringify` do gerador e o Prettier. Adicionado
    `app/public/dados/` ao `.prettierignore` (dado gerado, não
    código-fonte — mesma lógica já aplicada a `dist/`/`.md/`/`design/`).
  - Portões: `npx vitest run tests/verificar-segredos.test.ts` (24/24);
    `npm run typecheck`, `npm run lint`, `npm run format:check` limpos;
    suíte completa (`npm run test`) 97 arquivos / 1110 testes passando;
    `npm run build` + `npm run verificar-segredos` (bundle real da SPA)
    seguem limpos.
- Status: Resolvido
