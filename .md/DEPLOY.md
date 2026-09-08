# DEPLOY.md

Skill: `deploy-report-drafting` (chapéu DevOps, Validador). Preparação de
infraestrutura/CI-CD que precede o primeiro `/deploy` real — confirmação e
documentação sobre infraestrutura já construída como código (Lotes 1/6:
FUND-02/03, REFAT-01-02, REFAT-06-01), não provisionamento novo. Nenhum
`git push` nem alteração de configuração real do GitHub foi feito por este
agente — só leitura e documentação.

Autor: Validador (chapéu DevOps) · Data: 2026-09-06 (última atualização: 2026-09-08 — correção de Seção 1/histórico, ver Log de Alterações)

---

## 1. Infraestrutura confirmada

**Atualização (2026-09-08, Validador — chapéu DevOps)**: esta seção estava
desatualizada — descrevia GitHub Pages como único hosting-alvo. A decisão de
hosting real mudou (fora do fluxo normal de `TASK.md`, ver
`.md/BLOCKERS.md` Bloqueio 006 e `.md/adr/018-publicacao-de-snapshots-
publicos-direto-em-main-para-vercel.md`) e esta seção foi corrigida para
refletir a realidade confirmada por leitura direta de `vercel.json` e dos
dois workflows do GitHub Actions — não é decisão do Validador, só documentação
do que já existe.

Contexto de arquitetura (ADR-001, ADR-002, ADR-018, SDD §2.1): sem backend em
runtime, sem banco de dados. **Hosting real confirmado: Vercel**
(`https://sports-lm.vercel.app`), via integração Git a `origin/main` — todo
push em `main` dispara build (`npm run build`, `vercel.json` na raiz do
repositório) e deploy automático do Vercel, fora do controle de qualquer
workflow do GitHub Actions. `vercel.json` confirmado por leitura direta:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

`outputDirectory: "dist"` e o único `rewrite` (`/(.*)`→`/index.html`) são
consistentes com uma SPA estática de página única (ADR-001) — nenhum detalhe
adicional de configuração Vercel (variáveis de ambiente, regiões,
`vercel.json` estendido) existe no repositório além do que está reproduzido
acima.

O pipeline de ingestão (`.github/workflows/ingestao.yml`, agendado a cada 30
minutos) continua rodando no GitHub Actions, mas seu destino de publicação
mudou: em vez de commitar os snapshots públicos (`/dados/*.json`, contrato
SDD §2.2) numa branch órfã `dados` separada (a decisão original de ADR-002,
pensada para GitHub Pages com fonte "Deploy from a branch"), o passo final do
workflow agora copia `dist-dados/` para `app/public/dados/` e comita/faz push
direto em `main` — só quando o conteúdo muda (mesma checagem de hash de
ADR-002). Como `app/public/` é o `publicDir` do Vite (`root: 'app'`), todo o
conteúdo de `app/public/dados/` é copiado verbatim para `dist/dados/` a cada
build — inclusive o build que o Vercel dispara automaticamente a cada push,
incluindo os pushes de dados do próprio `ingestao.yml`. Isso significa que a
atualização de dado só fica visível em produção depois do build do Vercel
terminar (não é instantâneo) — aceitável para a cadência de 30 min do
pipeline (detalhe completo, alternativas descartadas e dívida aceita em
ADR-018).

`.github/workflows/build-publish.yml` (GitHub Pages) **continua existindo e
sendo disparado a cada push em `main` sem `[skip ci]`** — não foi removido
nem desabilitado por esta mudança (confirmado por leitura direta:
`.github/workflows/build-publish.yml` presente, gatilho `push` em `main`
inalterado). GitHub Pages nunca foi habilitado no repositório (ver Seção 2,
item 1 — ação operacional pendente do stakeholder, ainda não confirmada como
feita) — ou seja, esse workflow roda os portões de qualidade a cada push, mas
seu job `publish` provavelmente segue falhando ou sendo pulado por falta do
ambiente `github-pages` configurado. Decidir se desliga esse workflow (Vercel
já é o hosting real) é decisão de infraestrutura fora do escopo desta
confirmação — fica registrado aqui para o Coordenador/gestor avaliar.

### 1.1 `.github/workflows/build-publish.yml` (FUND-03)

- Gatilho: `push` em `main` + `workflow_dispatch` manual.
- `concurrency: group: pages, cancel-in-progress: false` — evita publicação
  concorrente no mesmo hosting.
- `permissions`: `contents: read`, `pages: write`, `id-token: write` — mínimo
  necessário para publicar via OIDC no Pages, sem escopo de escrita no
  repositório.
- Todas as ações de terceiros pinadas por SHA de commit (não por tag/branch),
  conforme GUARDRAILS §2 / SDD §7.7: `actions/checkout@11bd719...` (v4.2.2),
  `actions/setup-node@39370e3...` (v4.1.0), `actions/configure-pages@983d773...`
  (v5.0.0), `actions/upload-pages-artifact@56afc60...` (v3.0.1),
  `actions/deploy-pages@d6db901...` (v4.0.5).
- `runs-on: ubuntu-24.04` fixo (não `ubuntu-latest`) nos dois jobs.
- Portões de qualidade bloqueantes antes do build: `typecheck`, `lint`,
  `format:check`, `test`, `npm audit --omit=dev --audit-level=high`.
- Verificação de segredo bloqueante no artefato publicado
  (`npm run verificar-segredos`, que varre `dist/`) antes de `configure-pages`
  — SDD §7.2.
- Job `publish` depende de `build` (`needs: build`), roda só em `main`
  (`if: github.ref == 'refs/heads/main'`), usa o `environment: github-pages`
  nativo do GitHub, e publica via `actions/deploy-pages`.

Confirmado: consistente com SDD §7.2/§7.7 e GUARDRAILS §2/§4 enquanto
workflow. **Atualização (2026-09-08)**: este workflow publica em GitHub
Pages, mas GitHub Pages **não é** o hosting real do produto — ver correção da
Seção 1 acima. Este workflow segue existindo e disparando a cada push em
`main` (sem `[skip ci]`), mas seu resultado real (se GitHub Pages nunca foi
habilitado, ver Seção 2 item 1) não afeta o que o usuário final acessa em
`https://sports-lm.vercel.app`.

### 1.2 `.github/workflows/ingestao.yml` (REFAT-06-01)

- Gatilho: `schedule` a cada 30 minutos (`*/30 * * * *`) + `workflow_dispatch`
  manual.
- `concurrency: group: ingestao-agendada, cancel-in-progress: false`.
- `permissions: contents: write` — escopo mínimo declarado para escrever na
  branch órfã `dados` (ADR-002); nada além.
- Mesmas ações pinadas por SHA que `build-publish.yml`
  (`actions/checkout@11bd719...`, `actions/setup-node@39370e3...`),
  `runs-on: ubuntu-24.04`, `timeout-minutes: 15`.
- Mesmos portões de qualidade bloqueantes (`typecheck`, `lint`,
  `format:check`, `test`, `npm audit --omit=dev --audit-level=high`) antes de
  executar a ingestão.
- `FOOTBALL_DATA_API_TOKEN` injetado só como variável de ambiente do passo
  "Executa pipeline de ingestão" (`env:`), nunca ecoado em log, mascarado
  automaticamente pelo GitHub Actions a partir da primeira referência —
  conforme SDD §7.2 / GUARDRAILS §4.
- Comportamento de dry-run gracioso em duas condições, sem falhar o job:
  (a) nenhum coletor implementado (`npm run ingestao` ainda não existe no
  `package.json` — não é mais o caso hoje, já existe: `"ingestao": "tsx
  pipeline/ingestao-cli.ts"`); (b) coletor existe mas
  `FOOTBALL_DATA_API_TOKEN` não está cadastrado no cofre de secrets do
  repositório — o Fluxo 2 (futebol) exige o token real
  (`executarIngestaoFutebolEmDisco` lança erro sem ele).
- Verificação de segredo bloqueante no diretório de dados publicado
  (`npm run verificar-segredos:dados`, aponta para `dist-dados/`), só quando
  há algo a publicar (`steps.ingestao.outputs.publica == 'true'`).
- **Atualização (2026-09-08, ADR-018, Bloqueio 006)**: o passo final deixou
  de publicar na branch órfã `dados` — confirmado por leitura direta do
  `ingestao.yml` real (`.github/workflows/ingestao.yml`, passo "Publica
  snapshots públicos em app/public/dados (main — ADR-018)"). Hoje o workflow
  permanece em `main`, copia `dist-dados/` para `app/public/dados/`
  (sobrescrevendo o que houver) e comita/`git push origin HEAD:main`, só se o
  conteúdo realmente mudou (mesma checagem de hash de antes, adaptada ao novo
  caminho) — evita publicar sem mudança de hash, conforme SDD §2.2. A branch
  órfã `dados` de ADR-002 continua sendo a decisão vigente só para o
  **estado interno** do pipeline (não os snapshots públicos) — mas, conforme
  achado colateral registrado no próprio ADR-018/Bloqueio 006, o workflow
  real **nunca** teve um passo que de fato restaure/commite esse estado
  interno na branch `dados` — lacuna pré-existente, não corrigida por esta
  confirmação, registrada para decisão futura do Coordenador/gestor.

Confirmado: consistente com ADR-002 (parcialmente superado por ADR-018 para o
destino dos snapshots públicos), ADR-018, SDD §7.2/§7.7, GUARDRAILS §2/§4. O
script `npm run ingestao` já existe no `package.json` (`tsx
pipeline/ingestao-cli.ts`) desde REFAT-06-01 — o dry-run hoje em produção,
quando ocorrer, será pelo motivo (b) (token ausente), não (a). Múltiplos
snapshots reais já foram publicados com sucesso por este workflow desde
ADR-018 (ver Seção 5, histórico de deploys, e Bloqueios 007/008/009/010 em
`.md/BLOCKERS.md`).

**Nenhuma inconsistência encontrada** entre os dois workflows e o que
SDD.md/GUARDRAILS.md exigem. Ambos já foram validados nos Lotes 1/6
(QA-REPORT.md e SECURITY-REVIEW.md correspondentes).

---

## 2. Ações operacionais pendentes do stakeholder (fora do escopo de código)

O Validador não tem acesso às configurações reais do repositório no GitHub —
as ações abaixo precisam ser feitas manualmente pelo usuário/stakeholder antes
do primeiro deploy real funcionar de ponta a ponta:

1. **Habilitar GitHub Pages** no repositório
   `https://github.com/leandrosegheto17/SportsLM`, em Settings → Pages,
   com a fonte definida como **"GitHub Actions"** (não "Deploy from a
   branch"). Sem isso, o job `publish` de `build-publish.yml` falha ao tentar
   publicar via `actions/deploy-pages`.
2. **Cadastrar o secret `FOOTBALL_DATA_API_TOKEN`** em Settings → Secrets and
   variables → Actions, com o token do provedor football-data.org. Sem esse
   secret, `ingestao.yml` continua rodando em dry-run gracioso a cada 30
   minutos (sem falhar, sem publicar dados de futebol) — o Fluxo 1 (notícias)
   não depende deste token.
3. **Confirmar acesso de escrita do workflow** ao repositório remoto: a
   branch `dados` (destino da ingestão, `contents: write`) e o ambiente
   `github-pages` nativo (destino da SPA, `pages: write` + `id-token: write`)
   precisam estar acessíveis às permissões padrão do `GITHUB_TOKEN` do
   próprio repositório — nenhuma configuração adicional de token pessoal é
   esperada, mas vale confirmar que nenhuma política de organização (se
   houver) restringe `id-token: write` ou push para branches órfãs.

Nenhuma dessas três ações foi executada por este agente. `git push` para
`main` (que dispara `build-publish.yml` pela primeira vez em produção) também
não foi feito — é ação do orquestrador/usuário, fora desta tarefa.

---

## 3. Observabilidade

**Nota (2026-09-08)**: esta seção foi escrita quando GitHub Pages ainda era
tratado como hosting-alvo único. O hosting real é o Vercel (Seção 1) — o
Vercel tem seu próprio painel de build/deploy logs (não documentado aqui em
detalhe por falta de acesso direto deste Validador ao console da conta), além
do que já está descrito abaixo (GitHub Actions + `status.json`), que segue
válido para o pipeline de ingestão.

Protótipo estático sem backend (RNF-11, nível protótipo, ADR-015 §"Perfil de
protótipo"): observabilidade é necessariamente limitada, documentada aqui sem
inventar ferramenta ou métrica que não existe no projeto.

**O que existe:**

- **Logs de execução do próprio GitHub Actions**, por run de cada um dos dois
  workflows (`build-publish.yml`, `ingestao.yml`) — histórico de sucesso/falha,
  duração, e output de cada step, disponível no painel Actions do repositório.
- **`/dados/ingestao/status.json`** (SDD §5.4): único mecanismo de diagnóstico
  do pipeline de dados em runtime. Por fonte/provedor, registra
  `ultimaTentativa`, `resultado` (`ok`/`falha`/`pulado`), `itensNovos`,
  `falhasConsecutivas`, `instavel`, `instavelDesde`, `severidade` (`alta` só
  para o GE); globalmente, `geradoEm`, `pausadoPorCota`,
  `distribuicaoClassificacao`, `gruposFormados`. É público, consumido
  diretamente pela SPA (`esquemaStatusPublico`, validado com Zod) para
  alimentar o carimbo de frescor (RF-17) e o estado "pausado por cota"
  (CA-16.4/CA-17.4) — já auditado em SECURITY-REVIEW.md.

**O que não existe** (e não deve ser inventado):

- Sem APM (Application Performance Monitoring) — não há aplicação de
  servidor para instrumentar.
- Sem alerta automático de falha de ingestão ou de publicação — uma falha em
  `ingestao.yml` ou `build-publish.yml` aparece só no painel do GitHub
  Actions (e, se o usuário configurar notificação por e-mail do próprio
  GitHub para falha de workflow, o que é configuração de conta/notificação do
  GitHub, não deste projeto). Não há painel de observabilidade externo
  (Datadog, Grafana, Sentry ou equivalente) no escopo deste protótipo — ADR-015
  §"Perfil de protótipo": "Monitoramento, alertas, painéis de observabilidade"
  está explicitamente em nível protótipo, coberto por "Log do agendador +
  `status.json` + estados visíveis na tela".
- Sem histórico agregado de disponibilidade/uptime do hosting — GitHub Pages
  não expõe isso nativamente ao projeto.

---

## 4. Estratégia de rollback

**Nota (2026-09-08)**: mesma ressalva da Seção 3 — o texto abaixo foi escrito
para GitHub Pages. Com o Vercel como hosting real (Seção 1), o princípio
("reverter via commit/`git revert` em `main`, não republicação manual de
artefato") continua válido e é, na prática, a estratégia mais simples possível
— o Vercel também rebuilda automaticamente a cada push, então um `git revert`
em `main` já é, por si só, o mecanismo de rollback (o Vercel também mantém
histórico de deployments anteriores navegável pelo próprio painel, promovendo
um deployment anterior sem novo commit — não confirmado em detalhe aqui por
falta de acesso a esse painel, citado apenas como possibilidade adicional
plausível de qualquer hosting Git-integrado como o Vercel, não como fato
verificado).

GitHub Pages publicado via `actions/deploy-pages` não versiona múltiplos
releases simultâneos — a estratégia natural de rollback para este tipo de
hosting estático é **republicar a partir de um commit anterior**:

1. Identificar o último commit em `main` conhecido como estável (anterior ao
   que introduziu a regressão).
2. `git revert` do(s) commit(s) problemático(s) em `main` (preferível — mantém
   histórico linear e não reescreve o que já foi publicado) **ou**, se
   necessário reverter rapidamente sem revert de código,
   `workflow_dispatch` manual de `build-publish.yml` apontando/rodando a
   partir de um commit anterior específico (re-run via UI do Actions,
   selecionando o commit).
3. O job `publish` de `build-publish.yml` roda os mesmos portões de qualidade
   e verificação de segredo antes de publicar — o rollback não pula essas
   checagens, mesmo sendo uma reversão.
4. Para dados: **atualizado (2026-09-08, ADR-018)** — os snapshots públicos
   não vivem mais na branch órfã `dados`, e sim em `app/public/dados/`, na
   própria `main` (confirmado por leitura direta de `ingestao.yml`, Seção 1).
   Reverter dados problemáticos segue o mesmo princípio de código: `git
   revert` do commit de dados em `main` (o Vercel rebuilda a partir dele
   normalmente), ou aguardar a próxima execução agendada (30 min) corrigir o
   snapshot, dependendo da severidade. A branch órfã `dados` de ADR-002
   segue existindo só como destino conceitual do **estado interno** do
   pipeline — que, por lacuna pré-existente registrada em ADR-018/Bloqueio
   006, hoje não é de fato persistido por nenhum passo do workflow.

Não há infraestrutura adicional a testar (sem servidor, sem orquestrador de
container) — a estratégia é a natureza do próprio Git + hosting Git-integrado
(GitHub Pages e/ou Vercel), não uma ferramenta a ser implementada. Ainda não
foi formalmente exercida como incidente real de rollback (nenhum dos deploys
registrados na Seção 5 precisou de reversão) — será validada na prática no
primeiro incidente real, se ocorrer.

---

## 5. Histórico de Deploys

_Nenhum deploy foi realizado até o momento desta preparação de infraestrutura
(2026-09-06). Esta seção será preenchida a partir do primeiro `/deploy` que
publicar de fato, após a dupla aprovação (QA + DevSecOps) do lote correspondente
e a conclusão das ações operacionais pendentes listadas na Seção 2._

| Data | Ambiente | Commit | Resultado | Observações |
|---|---|---|---|---|
| 2026-09-06 | GitHub Pages (via Actions) | `43d26e9` | **Falhou** — job `build` reprovado no step "Testes"; job `publish` nunca rodou (`needs: build`) | `gh run` `34056870754`. 1/1099 testes falhou só no runner real (Linux/UTC), não localmente (sandbox em `America/Sao_Paulo`) — achado bloqueante, ver Seção 6 abaixo. GitHub Pages **não foi publicado** (nada foi ao ar). |

**Atualização (2026-09-08, Validador — chapéu DevOps)**: entre a linha acima
(primeira tentativa real, falha) e hoje, múltiplos pushes reais em `main`
chegaram a produção — confirmado por leitura direta de `git log` e de
`.md/BLOCKERS.md` (Bloqueios 004-010), não por nota de terceiro. Resumo, sem
inventar data/número de execução não documentado (o histórico completo,
run-a-run, não está disponível a este Validador sem acesso ao painel do
Vercel/GitHub Actions):

- `2006372` — correção do Bloqueio 004 (`TZ=America/Sao_Paulo` fixado em
  `vitest.config.ts`), primeiro push depois da falha registrada acima.
- `8d932f5` — correção do Bloqueio 005 (padrão `token` do verificador de
  segredo deixou de casar `zona.token` como falso positivo).
- `88e471c` — adiciona `vercel.json`, marcando a adoção do Vercel como
  hosting real (contexto do Bloqueio 006/ADR-018).
- `efa8d72` — ajusta `ingestao.yml` para publicar snapshots direto em
  `app/public/dados/` na própria `main`, em vez da branch órfã `dados`
  (resolução do Bloqueio 006/ADR-018).
- `982124d` — exclui sha256 de 64 caracteres do verificador de segredo
  (falso positivo estrutural) e **publica o primeiro snapshot real de dados**
  em `app/public/dados/` (resolução do Bloqueio 007) — primeira vez que
  `/dados/*.json` existiu de fato no host servido pelo Vercel.
- `c4d639f` — torna `traduzirPartidas` resiliente a status de partida
  desconhecido do provedor, sem descartar a competição inteira (resolução do
  Bloqueio 008, primeira execução real do Fluxo 2/futebol contra a API real).
- `972df4b` — expõe clubes não mapeados no log da ingestão (resolução do
  Bloqueio 009), viabilizando o diagnóstico usado a seguir.
- `cbfd337` — confirma 15/20 ids reais de clube (`REFAT-02-01`) a partir do
  log do Bloqueio 009; identifica divergência nos 5 restantes.
- `5cd50e8` (com `7ee34e0` registrando a resolução em `BLOCKERS.md`) —
  corrige o elenco da Série A 2026 em `config/clubes-2026.json`/
  `config/campeonatos-2026.json` (resolução do Bloqueio 010), fechando
  `REFAT-02-01` com os 20 clubes reais confirmados.
- Diversos commits `chore(dados): atualiza snapshots de ingestão [skip ci]`
  (visíveis no `git log`, cadência do agendamento a cada 30 min do
  `ingestao.yml`, só quando o conteúdo muda) — evidência de execução
  recorrente real do pipeline publicando em `main`/Vercel desde a resolução
  do Bloqueio 006.

Nenhum destes pushes teve resultado de build/deploy do Vercel confirmado
diretamente por este Validador (sem acesso ao painel da conta Vercel) — a
evidência disponível é a presença desses commits em `main`
(`origin/main`, mesmo branch que o Vercel monitora, `vercel.json` confirmado
na Seção 1) e a ausência de qualquer novo bloqueio registrado em
`.md/BLOCKERS.md` depois do Bloqueio 010 até esta confirmação.

| 2026-09-08 | Vercel (produção, auto-deploy via integração Git) | `cd747b6` | **Sucesso** — confirmado diretamente via `vercel inspect` (não por nota de terceiro): deployment `dpl_HLy1ATndKaDwaUxSD9MCrYDW9C78`, criado ~26s após o `git push`, `status: ● Ready`, `target: production`, com o alias `https://sports-lm.vercel.app` já apontando para ele; `curl` a `https://sports-lm.vercel.app` retornou `200`. | Commit publica o fechamento de Refatoração Lote-2 (REFAT-02-01, sem achado novo), Refatoração Lote-7 completo (REFAT-07-01/02/03, consolidação de tokens de borda) e a validação do Lote 12 com a criação de Refatoração Lote-12 (REFAT-12-01/02/03). **Débito aceito explicitamente pelo orquestrador/usuário em 2026-09-08**: `REFAT-12-03` (sessão manual real de acessibilidade, WCAG 2.2 AA, achado `SEC-12-03`) segue pendente — publicação liberada porque as mudanças deste commit são só CSS de tokens (sem alteração de valor visual) e documentação, não tocam superfície de acessibilidade. `REFAT-12-01`/`REFAT-12-02` também seguem pendentes, sem prazo vencido nesta rodada. Nenhum incidente na confirmação imediata pós-deploy; janela de observação de 24h ainda não fechada no momento deste registro. |

---

## 6. Achado bloqueante — primeira tentativa de deploy real (2026-09-06)

**Run**: `gh run view 34056870754` (`build-publish`, push do commit `43d26e9` em `main`).

**O que aconteceu**: o job `build` reprovou no step "Testes" — 1 de 1099 testes
falhou: `app/rotas/sobreposicoes/Configuracoes/SecaoFontesDeNoticia.test.tsx`,
caso `mostra "instável desde <data/hora>" sem remover a fonte (CA-01.2)`.
O job `publish` nunca chegou a rodar (`needs: build`) — **GitHub Pages não foi
publicado**, nenhum conteúdo quebrado foi ao ar.

**Causa raiz**: o teste injeta `instavelDesde: '2026-09-04T09:12:00-03:00'` e
espera o texto renderizado `"⚠ Instável desde 04/09, 09h12"` — ou seja, o
teste assume que o horário será formatado no fuso `America/Sao_Paulo`
(-03:00), reproduzindo literalmente o offset do próprio dado de entrada. Isso
só é verdade quando o processo Node que roda o teste tem `TZ=America/Sao_Paulo`
(verdade no ambiente local usado até aqui, por acaso do sandbox — confirmado
via `Intl.DateTimeFormat().resolvedOptions().timeZone`). O runner do GitHub
Actions roda em UTC por padrão (sem `TZ` setado); no mesmo instante
(`2026-09-04T12:12:00Z`), o componente formata `"12h12"`, não `"09h12"` —
daí a falha real só em CI. **Nenhum código local foi alterado**: o mesmo
padrão de formatação de hora provavelmente existe em outros testes/telas que
lidam com `instavelDesde`/timestamps (`CarimboFrescor`, `avaliador-fontes`,
etc.) e nunca foi exercitado contra um ambiente sem `TZ=America/Sao_Paulo`
antes desta primeira execução real em CI.

**Isto não é um erro de infraestrutura/CI** (os workflows em si estão
corretos, ver Seção 1) — é uma lacuna de determinismo na suíte de testes
(e possivelmente no próprio comportamento do componente, se a intenção do
produto for sempre exibir horário de Brasília independente do fuso do
navegador/máquina de quem roda — decisão de produto que caberia ao
Coordenador/Gestor confirmar, não a este Validador decidir sozinho).

**Escala para**: `executor` (correção de código/teste) — não decidido aqui
qual das duas correções é a certa:
(a) fixar `TZ=America/Sao_Paulo` no `vitest.config.ts`/ambiente de teste, se a
intenção é só tornar a suíte determinística mostrando o fuso do
visitante em produção normalmente; ou
(b) formatar explicitamente em `America/Sao_Paulo` (`timeZone` fixo no
`Intl.DateTimeFormat`/`toLocaleTimeString`) se a intenção de produto é sempre
mostrar horário de Brasília a qualquer visitante, em qualquer fuso.
Depois da correção, o(s) lote(s) afetado(s) (provável Lote 9, onde
`SecaoFontesDeNoticia`/UI-T03-01 vive — e qualquer outro lote com padrão
similar) precisa(m) passar por `/validar` de novo antes de nova tentativa de
`/deploy`.

**Status**: Aberto, bloqueante para publicação (registrado também em
`.md/BLOCKERS.md`, Bloqueio 004).

**Atualização (2026-09-07, executor)**: antes de aplicar a correção (a), a
checagem rápida de `.md/PRD-TECNICO.md` pedida nos guardrails da tarefa
encontrou evidência formal (RNF-02 e RN-07, ambos citando explicitamente
"America/Sao_Paulo" como fuso fixo de localidade/regra de negócio do feed) que
contraria a premissa de que "mostrar a hora no fuso do visitante" seria o
comportamento de produto pretendido. Nenhuma correção foi aplicada — decisão
foi escalada ao coordenador/gestor (ver detalhe e pergunta objetiva na
atualização de 2026-09-07 do Bloqueio 004 em `.md/BLOCKERS.md`) para
confirmar se RNF-02/RN-07 cobrem só cálculo/ordenação de dados (caso em que a
opção (a) permanece correta) ou também a apresentação na tela para qualquer
visitante (caso em que a correção certa é a opção (b), maior escopo). Nenhum
arquivo de código (produção ou teste) foi alterado nesta passagem.

**Resolução (2026-09-07, executor)**: stakeholder decidiu que RNF-02/RN-07
cobrem só o cálculo interno do pipeline/domínio (janelas de dedup/frescor/
retenção, ordenação do feed), que já recebem `agora: Date` por parâmetro; a
apresentação na tela continua no fuso do navegador do visitante. Aplicada a
opção (a): `TZ=America/Sao_Paulo` fixado em `test.env` do `vitest.config.ts`,
sem alterar nenhum componente de produção. Reproduzida a falha real sob
`TZ=UTC` antes da correção e confirmada a correção sob o mesmo `TZ=UTC`
depois; suíte completa (1099/1099 testes), typecheck, lint, format:check e
build limpos. Detalhe completo em `.md/BLOCKERS.md`, Bloqueio 004
(Resolvido). Bloqueio de publicação removido — próxima tentativa de
`/deploy` pode prosseguir.

**Achado bloqueante seguinte (2026-09-07, Bloqueio 005)**: com o Bloqueio 004
corrigido, o job `build` passou por todos os portões de qualidade em CI real
pela primeira vez, mas reprovou no passo seguinte, "Verificação de segredo no
artefato publicado" (`npm run verificar-segredos`, FUND-03):
`dist/assets/index-*.js: padrão 'token'`. Falso positivo — o padrão
`/\btoken\b/i` casava `zona.token` (campo de domínio das zonas de
classificação, RN-15/RF-18), não nenhum segredo real. **Resolução
(2026-09-07, executor)**: o padrão `token` em
`pipeline/ci/verificar-segredos.mjs` passou a exigir o formato real de um
segredo vazado — `token` seguido de `:`/`=`, um valor entre aspas de 16+
caracteres contendo ao menos um dígito — em vez de casar a palavra isolada.
Isso distingue um segredo real (`token: "sk_live_..."`) de um acesso de
propriedade de domínio (`zona.token`, `o.zona.token`) e de um valor curto de
enum (`token: 'libertadores'`, `token: 'pre-libertadores'`), sem enfraquecer
os outros 3 padrões (`api_key`, `Bearer`, `chave-hex-32+`). Prova de ponta a
ponta: `npm run build` (dist real) seguido de `npm run verificar-segredos
dist` → limpo; teste de injeção manual de um segredo real no mesmo bundle
real confirmou detecção mantida. Suíte de testes (21 casos em
`tests/verificar-segredos.test.ts`, incluindo os novos que reproduzem este
achado), typecheck, lint, format:check e suíte completa (97 arquivos, 1107
testes) limpos. Detalhe completo em `.md/BLOCKERS.md`, Bloqueio 005
(Resolvido). Bloqueio de publicação removido — próxima tentativa de
`/deploy` pode prosseguir até o próximo passo do pipeline.

---

## Log de Alterações

| Data | Autor | Mudança |
|---|---|---|
| 2026-09-06 | Validador (chapéu DevOps) | Criação do documento: confirmação da infraestrutura de CI/CD já construída (Lotes 1/6), ações operacionais pendentes do stakeholder, estratégia de observabilidade e rollback, histórico de deploys vazio. |
| 2026-09-06 | Validador (dupla aprovação QA + DevSecOps) | Confirmação final pré-deploy (primeira publicação conjunta, Lotes 1-11+13): regressão do zero limpa, integração pipeline↔SPA verificada manualmente sem divergência, workflows confirmados aptos sem depender de tarefa `Pendente`. Ver seção correspondente em `.md/QA-REPORT.md` e `.md/SECURITY-REVIEW.md`. Dupla aprovação **completa** — nenhuma alteração às ações operacionais pendentes da Seção 2 (ainda dependem do stakeholder); Seção 5 (histórico de deploys) segue vazia até o `git push`/execução real do `/deploy`. |
| 2026-09-07 | Executor | Resolução do Bloqueio 004 (Seção 6): `TZ=America/Sao_Paulo` fixado em `vitest.config.ts` (`test.env`), tornando a suíte determinística em CI sem alterar nenhum componente de produção — decisão do stakeholder confirmou que RNF-02/RN-07 cobrem só cálculo interno, não apresentação na tela. Ver `.md/BLOCKERS.md`, Bloqueio 004 (Resolvido). |
| 2026-09-07 | Executor | Resolução do Bloqueio 005 (Seção 6): padrão `token` de `pipeline/ci/verificar-segredos.mjs` deixou de casar a palavra isolada e passou a exigir formato real de segredo vazado (valor entre aspas, 16+ caracteres, com dígito), eliminando o falso positivo contra `zona.token` sem enfraquecer os outros 3 padrões. Prova de ponta a ponta contra o `dist/` real (`npm run build` + `npm run verificar-segredos`) limpa. Ver `.md/BLOCKERS.md`, Bloqueio 005 (Resolvido). |
| 2026-09-08 | Validador (confirmação final pré-`/deploy`, chapéus QA + DevSecOps + DevOps) | Correção de Seção 1 (infraestrutura): documento estava desatualizado, ainda descrevia GitHub Pages como hosting único. Corrigido para refletir a realidade real confirmada por leitura de `vercel.json` e dos dois workflows: hosting real é **Vercel** (`https://sports-lm.vercel.app`, auto-deploy a cada push em `main`), com o pipeline de ingestão publicando snapshots públicos direto em `app/public/dados/` na própria `main` (ADR-018, Bloqueio 006) em vez da branch órfã `dados` de ADR-002. `build-publish.yml` (GitHub Pages) segue existindo mas não é mais o hosting real. Seções 3/4 (observabilidade/rollback) receberam nota apontando a mesma correção sem reescrita completa. Seção 5 (histórico de deploys) ganhou entrada resumindo, com evidência de `git log` e `.md/BLOCKERS.md` (Bloqueios 004-010), os múltiplos pushes reais que chegaram a produção desde a primeira tentativa falha (`43d26e9`), incluindo a primeira publicação real de dados (`982124d`) e a correção do elenco do Brasileirão (`5cd50e8`/Bloqueio 010). Rodada completa de portões sobre o working tree (incluindo mudanças não commitadas de `REFAT-07-02`/`REFAT-07-03`): `npm run test` 99 arquivos/1135 testes, `typecheck`/`lint`/`format:check` limpos, `npm audit --omit=dev --audit-level=high` 0 vulnerabilidades — confirmando que `SEC-11-01`/`REFAT-01-03` (`react-router`) segue fechado (Refatoração Lote-1, 2026-09-06), sem regressão. Único achado ainda bloqueante para o próximo `/deploy` real: `REFAT-12-03`/`SEC-12-03` (sessão manual de acessibilidade), inalterado por esta rodada — ver veredito no relatório de confirmação correspondente. Nenhum `git commit`/`git push`/alteração de configuração real feita por este agente. |
