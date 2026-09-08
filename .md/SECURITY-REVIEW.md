# SECURITY-REVIEW.md — SportsLM

**Status**: primeira entrada, criada na auditoria do Lote 1 (2026-09-06),
depois da aprovação funcional (QA) do mesmo lote em `QA-REPORT.md`.
**Autor**: Validador (chapéu DevSecOps)
**Base**: `.md/SDD.md` §7 (Requisitos de Segurança), `.md/GUARDRAILS.md`,
código real do Lote 1 (`git status`/leitura direta — todos os arquivos são
novos/untracked nesta primeira auditoria).

---

## 1. Segredos em código/artefato (SDD §7.2, GUARDRAILS §4)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum segredo literal em código/config versionado | Busca manual em `.github/workflows/*.yml`, `pipeline/ci/verificar-segredos.mjs`, `package.json` | Nenhum token/chave hardcoded encontrado |
| Segredo do provedor de futebol só como env de CI | `FOOTBALL_DATA_API_TOKEN` referenciado só via `${{ secrets.FOOTBALL_DATA_API_TOKEN }}` em `ingestao.yml`, nunca impresso (`echo`) nem passado como argumento de CLI | Conforme |
| Varredura bloqueante no artefato de build (`dist/`) | `pipeline/ci/verificar-segredos.mjs`, testado por mim injetando segredo real no artefato (ver QA-REPORT.md, FUND-03) | Bloqueia corretamente (`exit 1`) |
| Varredura bloqueante no artefato de dados (`dist-dados/`, branch `dados`) | Passo "Publica snapshots" em `ingestao.yml`, `grep -R -E -i` contra os mesmos padrões (`api_key`/`bearer`/`token[:=]`/32+ chars) antes de qualquer `git commit`/`push` | Presente; não pude executar de ponta a ponta (não há `dist-dados/` real ainda, pipeline de ingestão é Lote 4/5) — revisão de código, não execução real |

**Achado SEC-01-01 (informativo, sem ação)**: a expressão regular do passo de
publicação (`token["'"'"']?\s*[:=]`) é mais restrita que a de
`verificar-segredos.mjs` (`\btoken\b` — qualquer ocorrência da palavra). Isso é
aceitável porque cada varredura tem escopo diferente (artefato de build vs.
diretório de dados públicos, que legitimamente pode conter a palavra "token"
em texto de notícia, por exemplo) — decisão de implementação razoável, não é
inconsistência a corrigir.

## 2. Dependências de runtime (SDD §3, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| Lista fechada de dependências de runtime | `package.json` conferido: `dependencies` = `fast-xml-parser`, `react`, `react-dom`, `react-router-dom`, `zod` — idêntico à lista do GUARDRAILS §2 | Conforme |
| `package-lock.json` versionado | `git status` mostra `package-lock.json` como arquivo a versionar | Conforme |
| Auditoria de dependências de produção | `npm audit --omit=dev` executado por mim | **2 vulnerabilidades moderadas** em `react-router`/`react-router-dom` (CVE-2025-68470 bypass — open redirect via backslash em `<Link>`/`useNavigate`; e injeção de construtor arbitrário via `deserializeErrors()` na hidratação SSR). Nenhuma alta/crítica |
| Ações de CI fixadas por versão, nunca referência móvel (SDD §7.7, GUARDRAILS §2) | Comparação entre os dois workflows | **Inconsistente** — ver achado SEC-01-02 abaixo |

### Achado SEC-01-02 — `build-publish.yml` fixa ações por tag (`@v4.2.2` etc.) e usa `runs-on: ubuntu-latest`, não por SHA de commit nem versão de runner fixa

**Severidade**: **média** (não é vulnerabilidade ativa nem exposição de dado;
é uma lacuna de mitigação de supply-chain — tag de Action pode em tese ser
removida/reapontada pelo mantenedor upstream, e `ubuntu-latest` é uma imagem
que muda de conteúdo ao longo do tempo sem aviso, podendo introduzir
diferença de comportamento entre execuções).

Evidência: `ingestao.yml` (FUND-02) fixa corretamente
`actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2` e
`actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0`, e usa
`runs-on: ubuntu-24.04` (versão fixa). Já `build-publish.yml` (FUND-03) usa
`actions/checkout@v4.2.2`, `actions/setup-node@v4.1.0`,
`actions/configure-pages@v5.0.0`, `actions/upload-pages-artifact@v3.0.1`,
`actions/deploy-pages@v4.0.5` — todas por tag — e `runs-on: ubuntu-latest`. O
comentário no topo do próprio arquivo (`Ações fixadas por versão exata, nunca
@latest nem branch`) descreve a intenção corretamente, mas tag de versão não é
o mesmo mecanismo de imutabilidade que SHA de commit (o padrão mais forte, já
aplicado no workflow irmão do mesmo lote).

**Não bloqueia deploy** (severidade média, sem compliance obrigatório em
jogo) — vira débito registrado com prazo: tarefa `REFAT-01-02` em
`Refatoração Lote-1` (TASK.md), com prazo sugerido de **antes do primeiro
deploy real em produção** (ou seja, antes do Lote 6/PUB-03, quando o pipeline
de publicação passa a valer para dado real, não só "hello world").

### Achado SEC-01-03 (débito já identificado pelo Executor, revalidado por mim)

`react-router`/`react-router-dom` moderado (2 CVEs, sem CVSS crítico — maior
pontuação 6.1). Correção disponível só via major breaking
(`react-router-dom@7.18.3`), o que exige revalidação de `app/rotas/Rotas.tsx`
e do `BrowserRouter`/`HashRouter` por `VITE_ROTEAMENTO` (ADR-003) — não é
troca trivial de patch. **Não bloqueia** (moderada, sem exploração conhecida
neste contexto: SPA sem SSR, RN-09 já proíbe navegação "ao vivo"/servidor, o
vetor de SSR hydration do segundo CVE não se aplica a este projeto que não usa
SSR). Vira débito registrado: tarefa `REFAT-01-03` em `Refatoração Lote-1`,
prazo sugerido **antes do Lote 8** (primeira tela real que usa navegação de
verdade em produção), para dar tempo de qualificar o breaking change com
calma.

## 3. Conformidade regulatória (LGPD) em nível de implementação

Não aplicável ao Lote 1 — nenhum dado pessoal é coletado ainda (é
infraestrutura/shell, sem telemetria/armazenamento de usuário; isso é
Lote 7/`UI-DS-09` e Lote 12/`TEL-01`). Sem achado.

## 4. Exposição de dados sensíveis em logs/erro/armazenamento

- **Logs de CI**: verificado acima (segredo nunca ecoado).
- **`localStorage`**: ainda não implementado neste lote (armazenamento de
  preferências é Lote 7). Sem achado.
- **Mensagens de erro**: `pipeline/ci/verificar-segredos.mjs` não vaza o
  conteúdo do segredo encontrado nas mensagens de erro — só o nome do padrão
  (`api_key`, `chave-hex-32+`), nunca o trecho casado. Conforme boa prática de
  não duplicar o segredo no próprio log de detecção.

## 5. `dominio/` puro e `dangerouslySetInnerHTML` (SDD §2.1, §7.4.2)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum uso de `dangerouslySetInnerHTML` no projeto | Busca em `app/` | Nenhuma ocorrência |
| `dominio/` sem import de rede/`localStorage`/React/`Date.now()` | `dominio/` só contém `README.md` nesta fase; regra de lint (FUND-01) testada e correta (ver QA-REPORT.md) | Conforme — nada a violar ainda, portão automático confirmado funcionando |

## 6. Requisitos de segurança operacional para o chapéu DevOps (definidos aqui)

Para quando o chapéu DevOps (`/deploy`) provisionar infraestrutura real:

1. Cadastro do secret `FOOTBALL_DATA_API_TOKEN` em Settings > Secrets do
   repositório GitHub, escopo restrito ao ambiente/branch que executa
   `ingestao.yml` — nunca como secret de organização exposto a outros repos.
2. `permissions` de cada workflow devem continuar no escopo mínimo já
   praticado (`contents: write` só em `ingestao.yml`, restrito à branch
   `dados`; `pages: write`/`id-token: write` só em `build-publish.yml`) — não
   ampliar por conveniência futura sem justificativa registrada aqui.
3. Antes do primeiro deploy real (Lote 6+), migrar as ações de
   `build-publish.yml` para SHA pinning (achado SEC-01-02) e fixar a versão do
   runner (`ubuntu-24.04`, alinhado ao workflow irmão).
4. GitHub Pages (hosting estático definido em FUND-03) não expõe porta/rede
   adicional — sem superfície de firewall/rede a configurar nesta arquitetura
   (ADR-001, sem backend em runtime).

## 7. Achados por severidade — resumo

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| Média | SEC-01-02 — pinagem de ações por tag + `ubuntu-latest` em `build-publish.yml` | Não | Débito com prazo — `REFAT-01-02`, antes do Lote 6 |
| Baixa/Moderada (CVE) | SEC-01-03 — 2 CVEs moderados em `react-router`/`react-router-dom` | Não | Débito com prazo — `REFAT-01-03`, antes do Lote 8 |
| — | Nenhum achado alto/crítico | — | — |

Nenhum achado tem relevância estratégica de negócio suficiente para escalar ao
Gestor nesta rodada (ambos são hardening técnico incremental, sem decisão de
compliance ou custo envolvida) — registrado aqui apenas, conforme rotina.

## Veredito

**Aprovado com débito registrado** (2 achados de severidade média/moderada,
ambos com prazo definido em `Refatoração Lote-1`, nenhum bloqueante). O Lote 1
está liberado para a checagem estrutural final e fechamento como `Validado
(com ressalvas)`.

---

## Lote 2 — Configuração por temporada

**Pré-requisito confirmado**: `QA-REPORT.md` aprovou funcionalmente as 5
tarefas do Lote 2 (CFG-01 a CFG-05) antes desta auditoria começar.

### 1. Segredos em arquivo de configuração (SDD §7.2, GUARDRAILS §4)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum segredo/token/chave literal em `config/*.json`/`config/*.ts` | Busca por `token`/`api_key`/`apikey`/`secret`/`bearer`/`senha`/`password` (case-insensitive) em todo `config/` | Única ocorrência é a palavra "token" dentro de comentários/nome de variável do design system de zonas (`TOKENS_DE_ZONA`, tokens de UI, nada relacionado a credencial) — sem falso positivo real |
| `idsProvedor` não é segredo | `config/clubes-2026.json` lido: ids são identificadores públicos do catálogo do provedor (ex.: `1783` para Flamengo), não credencial de acesso; a sentinela `"pendente-confirmacao"` também não é segredo | Conforme — nenhuma tentativa de embutir o token de CI no arquivo de configuração publicado |

**Nenhum achado.**

### 2. Exposição de dado sensível (SDD §7.4, §7.6, RNF-07)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum dado pessoal em `config/` | Os 5 arquivos (`esportes.json`, `clubes-2026.json`, `campeonatos-2026.json`, ausência de `zonas-2026.json`, `fontes.json`) contêm só dado de catálogo/produto (nomes de clube, cores, campeonatos, fontes) | Conforme RNF-07 — nada aqui identifica usuário |
| `dangerouslySetInnerHTML` | Busca em `config/` | Nenhuma ocorrência (nem aplicável — não é código de renderização) |
| Fonte instável do GE tratada sem esconder falha (RN-03) | `config/fontes.json`: `ge.verificacao.estado: 'pendente'`, sem URL de feed ainda (`feeds: []`) | Conforme — nenhuma evidência forjada sobre o GE, alinhado à "conclusão honesta" do SDD §3.1 |

**Nenhum achado.**

### 3. Conformidade com o catálogo de fontes (SDD §3.1, RN-19, GUARDRAILS §3)

| Verificação | Método | Resultado |
|---|---|---|
| Catálogo com exatamente 5 fontes, GE fixo e não-bloqueável | `config/fontes.json` conferido contra SDD §3.1 | Conforme |
| Só feed RSS/Atom oficial, HTTPS | Todas as `url` de feed em `config/fontes.json` começam com `https://` | Conforme GUARDRAILS §3 ("HTTPS obrigatório... feed só em HTTP puro é inelegível") |
| Substituto ordenado registrado para a candidata (UOL) | `substitutos: ["folha-esporte", "placar"]` presente | Conforme RN-19/I-25 |

**Nenhum achado.**

### 4. Dependências de runtime e auditoria (SDD §3, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| Lote 2 não introduziu dependência de runtime nova | `package.json` comparado ao estado já auditado — `config/` usa só `zod`, já na lista fechada | Conforme |
| `npm audit --omit=dev` | Executado por mim nesta rodada | Mesmas **2 vulnerabilidades moderadas** em `react-router`/`react-router-dom`, já cobertas por `REFAT-01-03` (Lote 1) — nenhuma nova, nenhuma alta/crítica |

### 5. Compliance regulatório (LGPD)

Não aplicável — nenhum dado pessoal em `config/`. Sem achado.

### 6. Achado de segurança operacional — débito de completude do mapeamento de clube↔provedor (registrado aqui, não como bloqueio)

Reforço, do ponto de vista de segurança/integridade de dado (não é achado
novo, é a mesma lacuna que o QA classificou como `QA-2-01`/`REFAT-02-01`): a
sentinela `"pendente-confirmacao"` em 19/20 `idsProvedor.football-data` não é
um risco de segurança em si — não expõe segredo, não é dado sensível — mas é
relevante para a integridade de `ING-F-01` (Lote 5): o ADR-006 já prevê que
qualquer clube sem id mapeado é descartado por inconsistência (CA-16.6), o
que é o comportamento seguro (nunca casar por nome, nunca inventar id). Não
gero um segundo achado/tarefa aqui — apenas confirmo que o tratamento a
jusante já é o correto (falha segura), então não há necessidade de mitigação
adicional além de resolver a sentinela antes do Lote 5, já com prazo em
`REFAT-02-01`.

## Achados por severidade — Lote 2

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum achado alto/crítico | — | — |
| — | Nenhum achado médio/baixo novo (débito de `react-router` já coberto por `REFAT-01-03`, Lote 1; débito de `idsProvedor` já coberto por `REFAT-02-01`, chapéu QA) | — | — |

Nenhum achado com relevância estratégica de negócio a escalar ao Gestor nesta
rodada.

## Veredito — Lote 2

**Aprovado**, sem débito novo de segurança (o único débito relevante,
`idsProvedor` pendente, já está registrado pelo chapéu QA em
`REFAT-02-01`, tratado de forma segura a jusante). O Lote 2 está liberado
para a checagem estrutural final do Validador e fechamento como `Validado`.

---

## Lote 3 — Domínio compartilhado (puro)

**Pré-requisito confirmado**: `QA-REPORT.md` aprovou funcionalmente as 6
tarefas do Lote 3 (DOM-01 a DOM-06) antes desta auditoria começar.

### 1. Pureza de `dominio/` como requisito de arquitetura/segurança (SDD §2.1, GUARDRAILS §5)

Tratada aqui como requisito de segurança, não só de estilo: um módulo de
domínio que importasse rede/`localStorage` quebraria a garantia de que
cálculo de negócio nunca depende de estado externo mutável nem pode vazar
para fora do dispositivo — parte do modelo de ameaça implícito de "sem
backend, sem dado pessoal no servidor" (ADR-001, GUARDRAILS §1).

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum import de `react`/`react-dom`/`react-router-dom` em `dominio/` | Grep por `from ['"]react` em `dominio/**/*.ts` (excluindo `.test.ts`) | Nenhuma ocorrência |
| Nenhum import de `config/`/`pipeline/` em `dominio/` (direção de dependência) | Grep por `from ['"](\.\./)*config` / `pipeline` | Nenhuma ocorrência — confirma a decisão registrada em DOM-01/03/04 de redefinir localmente em vez de importar |
| Nenhuma chamada real a `Date.now()`, `fetch`, `localStorage`, `XMLHttpRequest` | Grep por cada padrão em `dominio/**/*.ts` (não-teste); toda ocorrência textual encontrada é comentário/README explicando a regra, nenhuma chamada real | Conforme |
| Portão automático de CI (regra de lint) continua cobrindo os módulos novos | `tests/dominio-purity.eslint.test.ts` (7 casos) rodado dentro de `npm test`, contra a config real do ESLint (`eslint.config.js`, bloco `dominio/**`) | Passa — a regra criada em FUND-01 se aplica a todo o `dominio/` novo do Lote 3, não precisou de atualização |

**Nenhum achado.** A pureza de domínio está estruturalmente garantida (regra
de lint + confirmação manual), não é uma promessa não verificável.

### 2. `dangerouslySetInnerHTML` e validação de entrada externa (SDD §7.4.1/§7.4.2)

Não aplicável a este lote: nenhum módulo do Lote 3 renderiza HTML nem lê
entrada externa diretamente — `dominio/tipos` define os *validadores* Zod que
`ING-N-*`/`ING-F-*` (Lote 4/5) e `armazenamento/*` (Lote 7, UI-DS-09) vão usar
nas fronteiras reais. Verifiquei que os schemas em si são coerentes com a
regra "toda entrada externa passa por Zod" (GUARDRAILS §4): `linkHttpSchema`/
`itemNoticiaSchema.link` exigem `http(s)` absoluto (ADR-011); `preferenciasSchema`/
`cenarioSchema` travam `versaoEsquema: z.literal(1)`, condição necessária para
o descarte com registro de versão divergente que UI-DS-09 vai implementar.
Sem achado — o trabalho de fronteira real ainda não existe para auditar.

### 3. Exposição de dados sensíveis / dado pessoal (RN-18, RNF-07, CA-13.5)

- `Preferencias`/`Cenario` (`dominio/tipos/estado-local.ts`) não têm nenhum
  campo que identifique o usuário (sem nome, e-mail, IP, id de dispositivo) —
  só `temporada`, `favoritos` (esportes), `fontesBloqueadas`, `timeId`,
  `rivais`, `atualizadoEm` e, no cenário, palpites por id de partida. Conforme
  CA-13.5 ("nenhum dado pessoal").
- Nenhum módulo do Lote 3 grava em log nem em `console.*` (confirmado por
  leitura direta) — nada a vazar em mensagem de erro/log neste lote.

**Nenhum achado.**

### 4. Dependências de runtime e auditoria (SDD §3, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| Lote 3 não introduziu dependência de runtime nova | `package.json` comparado ao estado já auditado no Lote 1: `dependencies` continua `fast-xml-parser`, `react`, `react-dom`, `react-router-dom`, `zod` | Conforme — `dominio/` usa só `zod`, já na lista fechada |
| `npm audit --omit=dev` | Executado por mim nesta rodada | Mesmas **2 vulnerabilidades moderadas** em `react-router`/`react-router-dom` já registradas em `SEC-01-03` (Lote 1) — nenhuma nova, nenhuma alta/crítica. Não é achado novo do Lote 3 (o domínio puro não usa `react-router-dom`); já tem tarefa de débito aberta (`REFAT-01-03`, prazo antes do Lote 8) |

### 5. Compliance regulatório (LGPD)

Reforça a conclusão da Seção 3: como nenhum tipo do Lote 3 carrega dado
pessoal, não há requisito de LGPD em aberto para este lote. Sem achado.

## Achados por severidade — Lote 3

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum achado alto/crítico | — | — |
| — | Nenhum achado médio/baixo novo (débito de `react-router` já coberto por `REFAT-01-03`, Lote 1) | — | — |

Nenhum achado com relevância estratégica de negócio a escalar ao Gestor nesta
rodada.

## Veredito — Lote 3

**Aprovado**, sem débito novo. O Lote 3 está liberado para a checagem
estrutural final do Validador e fechamento como `Validado`.

---

## Lote 4 — Pipeline de ingestão de notícias

**Pré-requisito confirmado**: `QA-REPORT.md` aprovou funcionalmente as 7
tarefas do Lote 4 (ING-N-01 a ING-N-07) antes desta auditoria começar.

Requisito central deste lote (SDD §7.4, ADR-011): sanitização de conteúdo de
terceiros na ingestão — HTML removido, `link` restrito a `http(s)` absoluto.
Auditado por leitura direta do código (não pela nota do Executor) e por
execução real dos testes de injeção já presentes.

### 1. Sanitização de conteúdo de terceiros / XSS (SDD §7.4.1-.3, ADR-011)

| Verificação | Método | Resultado |
|---|---|---|
| Toda marcação HTML é de fato removida de título/resumo | `removerMarcacaoHtml` lido: `<script>`/`<style>` removidos por inteiro (tag + conteúdo, regex `[\s\S]*?`), qualquer outra tag substituída por espaço; roda depois de `decodificarEntidadesHtml` (ordem que impede evasão por double-encoding, ex. `&lt;script&gt;` → decodifica para `<script>` → só então é removido) | Conforme — verifiquei a ordem das duas funções em `sanitizarTexto`, não só a existência de cada uma isoladamente |
| Teste de injeção real (XSS) num item de feed mockado não sobrevive | Rodei `npm test` e li as asserções de `dominio/noticias/normalizador-item.test.ts` (linhas 64-90, 233, 281-285): `<script>alert(1)</script>`, atributo `href="javascript:alert(1)"`, e o payload de double-encoding `&lt;script&gt;alert(1)&lt;/script&gt;` — todos removidos, nenhum resíduo de `<script>`/`script` no resultado | **Conforme** — script não sobrevive à sanitização, confirmado por execução real dos testes, não por leitura de código isolada |
| `link` só `http(s)` absoluto; qualquer outro esquema descarta o item (ADR-011) | `resolverLinkHttp`/`linkHttpSchema` (`dominio/tipos/comuns.ts`): `.url()` + `startsWith('http://')`\|\|`startsWith('https://')`; testes cobrindo `javascript:`, `data:`, `file:`, `ftp:`, URL relativa e vazia — todos rejeitados (`null`, item descartado por `normalizarItem`) | Conforme |
| Feed HTTP puro é inelegível (SDD §7.3) | `config/fontes.json` (9 URLs de feed distintas) — todas `https://` | Conforme, nenhuma URL de feed em HTTP puro |
| `dangerouslySetInnerHTML` no projeto inteiro | `grep -ri "dangerouslySetInnerHTML"` em todo o repositório (excluindo `.md`/skills/design) | **Zero ocorrências em código** — só em documentação (`SDD.md`, `GUARDRAILS.md`, ADR-011) e em referências de skill do Claude Code, nenhuma em `app/`/`dominio/`/`pipeline/` |
| Validação de esquema (Zod) na fronteira do feed | `itemNormalizadoSchema`/`itemNoticiaSchema` — todo item passa por `.safeParse` antes de entrar no domínio; falha é descarte silencioso com item simplesmente não avançando (nunca lançado, nunca corrigido heuristicamente) | Conforme GUARDRAILS §4 |

**Nenhum achado alto/crítico.** O requisito central do lote está
estruturalmente garantido, com evidência de execução real de teste de
injeção — não é uma alegação da nota do Executor aceita por confiança.

### 2. Dependências de runtime (SDD §3, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| Lote 4 não introduziu dependência de runtime nova | `package.json` comparado ao estado já auditado: `dependencies` continua `fast-xml-parser`, `react`, `react-dom`, `react-router-dom`, `zod`; o pipeline de notícias usa só `fast-xml-parser`/`zod` + módulos nativos do Node (`node:crypto`, `node:fs`, `node:path`, `node:url`) | Conforme — nenhuma lib nova, nada a atualizar em GUARDRAILS.md |
| `npm audit --omit=dev` | Executado por mim nesta rodada | Mesmas **2 vulnerabilidades moderadas** em `react-router`/`react-router-dom`, já registradas (`REFAT-01-03`, Lote 1, prazo antes do Lote 8) — nenhuma nova, nenhuma alta/crítica; não relacionadas ao pipeline de notícias (que não usa `react-router-dom`) |

### 3. Segredos e dados sensíveis em logs/estado interno

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum segredo em `config/`/estado interno novo | `config/lexico-esportes.json`/`config/categorias-fonte.json` lidos por inteiro — só termos de classificação e mapa fonte→categoria, nenhum dado sensível | Conforme |
| Único `console.*` do lote não vaza dado sensível | `pipeline/noticias/orquestrador.ts::carregarEstadoNoticias` — `console.warn` só em caminho defensivo (estado interno `estado/noticias.json` corrompido), imprime caminho de arquivo local e erro de validação Zod de dado já público (notícia), nunca segredo/token | Conforme |
| `id` de item é hash sha256 do link, não dado pessoal | `createHash('sha256').update(normalizado.link).digest('hex')` em `orquestrador.ts` | Conforme CA-15.3, sem exposição de dado de usuário (não há usuário nesta camada) |

**Nenhum achado.**

### 4. Isolamento e superfície de ataque (SDD §7.1/§7.5)

- O pipeline de notícias só se comunica com as URLs do catálogo configurado
  (`config/fontes.json`) — nenhum acesso por scraping, nenhuma URL fora do
  catálogo é alcançável (`BuscadorHttp` recebe só `feed.url` do próprio
  catálogo carregado e validado por Zod).
- `pipeline/` (I/O) e `dominio/` (puro) seguem isolados conforme SDD §2.1: a
  auditoria de pureza do `dominio/` (regra de lint `tests/dominio-purity.eslint.test.ts`)
  continua cobrindo os módulos novos do Lote 4 sem precisar de atualização —
  confirmado passando dentro de `npm test`.

**Nenhum achado.**

### 5. Compliance regulatório (LGPD) e requisitos de segurança operacional para o DevOps

- Nenhum dado pessoal trafega neste lote (itens de notícia são conteúdo
  editorial público, não dado de usuário) — reforça a conclusão dos Lotes 1-3.
- Requisito operacional para o chapéu DevOps registrado aqui (ainda não
  aplicável, pipeline não está integrado ao CI real — PUB-02/PUB-03, Lote 6):
  quando `npm run ingestao` existir de fato, o job de CI precisa continuar
  sem expor `FOOTBALL_DATA_API_TOKEN` (não usado neste lote, mas o mesmo job
  de `ingestao.yml`, FUND-02, vai rodar o Fluxo 1 e o Fluxo 2 lado a lado) e
  a varredura de segredo no diretório de estado/publicado (já prevista em
  FUND-02) precisa cobrir `estado/noticias.json`/`estado/ingestao/status.json`
  antes de qualquer commit na branch `dados`.

## Achados por severidade — Lote 4

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum achado alto/crítico | — | — |
| — | Nenhum achado médio/baixo novo (débito de `react-router` já coberto por `REFAT-01-03`, Lote 1) | — | — |

Nenhum achado com relevância estratégica de negócio a escalar ao Gestor nesta
rodada.

## Veredito — Lote 4

**Aprovado**, sem débito novo. O requisito de segurança central do lote
(sanitização de conteúdo de terceiros/ADR-011) está implementado e
verificado por execução real de teste de injeção. O Lote 4 está liberado
para a checagem estrutural final do Validador e fechamento como `Validado`.

---

## Lote 5 — Pipeline de ingestão de futebol

**Pré-requisito confirmado**: `QA-REPORT.md` aprovou funcionalmente as 5
tarefas do Lote 5 (ING-F-01 a ING-F-05) antes desta auditoria começar.

Requisito central deste lote (SDD §7.2): token do provedor de futebol
(`football-data.org`) só como variável de ambiente do job de CI, nunca em
código, arquivo de configuração ou artefato publicado. Auditado por leitura
direta do código (não pela nota do Executor) e por busca textual em todo o
diretório `pipeline/futebol/`.

### 1. Segredo do provedor de futebol (SDD §7.2, GUARDRAILS §4)

| Verificação | Método | Resultado |
|---|---|---|
| `adaptador-football-data.ts` nunca lê `process.env` | `grep -n "process.env" pipeline/futebol/adaptador-football-data.ts` | **Zero ocorrências** — token só chega via `OpcoesAdaptadorFootballData.token`, injetado por quem chama |
| Token nunca hardcoded (literal de string) | Leitura integral do arquivo: `headers = { 'X-Auth-Token': opcoes.token }` — único uso do token, sempre a variável recebida por parâmetro | Conforme |
| Único ponto de leitura de `process.env['FOOTBALL_DATA_API_TOKEN']` é o wrapper de I/O (fronteira certa) | `pipeline/futebol/orquestrador.ts::executarIngestaoFutebolEmDisco` — lê a variável, lança erro claro se ausente/vazia, e só então monta o adaptador real via `montarProvedoresPadrao` | Conforme — a camada pura (`executarFluxoFutebol`, testada de ponta a ponta) nunca toca `process.env`, recebe o provedor já pronto por injeção |
| Teste dedicado prova o comportamento sem token | `orquestrador.test.ts` — "lança erro claro quando FOOTBALL_DATA_API_TOKEN não está definido" — executei o teste e confirmei que ele de fato remove a variável do ambiente (`delete process.env[...]`) e espera rejeição, restaurando o valor original no `finally` | Conforme, verificado por execução real |
| Nenhum segredo literal em código/config versionado deste lote | Busca manual em todos os arquivos de `pipeline/futebol/` (fonte e teste) por `token`/`api_key`/`Bearer`/chave hex 32+ caracteres fora de nome de variável/comentário | Nenhum token/chave hardcoded encontrado — todas as ocorrências de "token" são nomes de campo/parâmetro (`token: string`), nunca um valor literal |
| `config/campeonatos-2026.json`/`config/clubes-2026.json` (dados consumidos por este lote) sem segredo | Já auditados nos Lotes 2/3; sem mudança de conteúdo sensível neste lote | Conforme |

**Nenhum achado alto/crítico.** O requisito central do lote (SDD §7.2) está
estruturalmente garantido: o segredo nunca atravessa a fronteira de
`dominio/`/`pipeline/futebol/adaptador-football-data.ts`, existe só como
variável de ambiente no wrapper de I/O, e há teste de execução real provando
o caminho de erro sem o segredo.

### 2. Validação de entrada externa (SDD §7.4.1, GUARDRAILS §4)

| Verificação | Método | Resultado |
|---|---|---|
| Toda resposta do provedor passa por Zod antes do domínio | `standingsProvedorSchema.parse`/`matchesProvedorSchema.parse` no início de `traduzirClassificacao`/`traduzirPartidas`; nenhum campo da resposta bruta chega ao domínio sem passar pelo schema | Conforme |
| Falha de validação é descarte com registro, nunca correção heurística | `.parse()` (não `.safeParse()`) lança em resposta malformada — o erro propaga para `coletor-futebol.ts`, que o trata como `tipo: 'falha'` (nunca "conserta" o dado) | Conforme — comportamento correto mesmo usando `.parse()` em vez de `.safeParse()`, porque o chamador (`coletarFutebol`) já envolve a chamada em `try/catch` |
| Estado interno (`estado/futebol.json`) revalidado ao carregar, nunca confiado cegamente | `carregarEstadoFutebol`: `estadoFutebolSchema.safeParse`; estado corrompido vira `estadoFutebolVazio()` com `console.warn`, nunca lança nem propaga dado inválido | Conforme |

**Nenhum achado.**

### 3. Dependências de runtime (SDD §3, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| Lote 5 não introduziu dependência de runtime nova | `pipeline/futebol/*.ts` usa só `zod` + módulos nativos do Node (`node:fs`, `node:path`, `node:url`) + `fetch` nativo (Node 22) | Conforme — nenhuma lib nova, nada a atualizar em GUARDRAILS.md |
| `npm audit --omit=dev` | Executado por mim nesta rodada | Mesmas **2 vulnerabilidades moderadas** em `react-router`/`react-router-dom`, já registradas (`REFAT-01-03`, Lote 1, prazo antes do Lote 8) — nenhuma nova, nenhuma alta/crítica; não relacionadas ao pipeline de futebol (que não usa `react-router-dom`) |

### 4. Isolamento e superfície de ataque (SDD §7.1/§7.5)

- O pipeline de futebol só se comunica com `https://api.football-data.org/v4`
  (`BASE_URL_FOOTBALL_DATA`), configurável só por parâmetro explícito
  (`opcoes.baseUrl`) — nenhum acesso a URL fora do provedor configurado,
  nenhum scraping.
- `pipeline/futebol/` (I/O) e `dominio/campeonatos/` (puro) seguem isolados
  conforme SDD §2.1: `derivador-status.ts` e `verificacao-consistencia.ts`
  não importam rede/`localStorage`/React/`Date.now()` — confirmei por leitura
  integral dos dois arquivos, além da regra de lint automática
  (`tests/dominio-purity.eslint.test.ts`) continuar cobrindo os módulos novos
  sem precisar de atualização, confirmada passando dentro de `npm test`.
- Clube não mapeado por id nunca "vaza" como dado de um clube errado — é
  descartado e só aparece em `InconsistenciaClube` (diagnóstico interno, não
  publicado; a publicação do contrato público é PUB-02, Lote 6, fora do
  escopo desta auditoria).

**Nenhum achado.**

### 5. Compliance regulatório (LGPD) e requisitos de segurança operacional para o DevOps

- Nenhum dado pessoal trafega neste lote (tabela/calendário de futebol é
  dado público, não dado de usuário) — reforça a conclusão dos Lotes 1-4.
- Requisito operacional para o chapéu DevOps, registrado aqui para quando o
  job de CI real existir (PUB-02/PUB-03, Lote 6): `FOOTBALL_DATA_API_TOKEN`
  precisa ser cadastrado como secret do repositório (já anotado em FUND-02) e
  a varredura de segredo no diretório publicado/estado (FUND-02/FUND-03)
  precisa cobrir também `estado/futebol.json`/`estado/ingestao/status.json`
  antes de qualquer commit na branch `dados` — mesma disciplina já pedida
  para a porção de notícias no Lote 4, agora estendida à porção de futebol.
- Cota do provedor gratuito (10 req/min) tratada com defesa dupla (proativa +
  reativa a HTTP 429) em `coletor-futebol.ts` — reduz o risco de a chave ser
  suspensa/bloqueada pelo provedor por uso indevido, requisito de
  "conformidade com os termos" (GUARDRAILS §3), não só de desempenho.

## Achados por severidade — Lote 5

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum achado alto/crítico | — | — |
| — | Nenhum achado médio/baixo novo (débito de `react-router` já coberto por `REFAT-01-03`, Lote 1; débito de dado `REFAT-02-01`, Lote 2, é operacional/configuração, não de segurança) | — | — |

Nenhum achado com relevância estratégica de negócio a escalar ao Gestor
nesta rodada.

## Veredito — Lote 5

**Aprovado**, sem débito novo. O requisito de segurança central do lote (SDD
§7.2 — segredo do provedor só como variável de ambiente do CI) está
implementado e verificado por leitura direta de todo o código de
`pipeline/futebol/` e por execução real do teste que remove a variável de
ambiente. O Lote 5 está liberado para a checagem estrutural final do
Validador e fechamento como `Validado`.

---

## Lote 6 — Paleta de clube e publicação

**Pré-requisito confirmado**: `QA-REPORT.md` aprovou funcionalmente (com
ressalvas) as 3 tarefas do Lote 6 (PUB-01 a PUB-03) antes desta auditoria
começar.

Este é o lote em que o contrato de dados público do SDD §2.2 é gerado pela
primeira vez de ponta a ponta e em que os dois portões de segurança que
faltavam desde o Lote 1 — varredura de segredo no diretório de **dados**
publicado e auditoria de dependências no workflow de **build** — são
efetivamente fechados. Auditado por leitura direta do código, execução real
dos dois workflows de CI (via os scripts que eles chamam) e injeção real de
segredo de teste — não pela nota do Executor.

### 1. Segredo no diretório de dados publicado (SDD §7.2, GUARDRAILS §4, PUB-03)

| Verificação | Método | Resultado |
|---|---|---|
| `dist-dados/` (não só `dist/`) varrido por padrão de segredo antes de qualquer commit na branch `dados` | `package.json`: script `verificar-segredos:dados` (`node pipeline/ci/verificar-segredos.mjs dist-dados`); passo dedicado em `.github/workflows/ingestao.yml`, antes do passo "Publica snapshots na branch dados" | Conforme — mesmo módulo genérico já auditado no Lote 1 (`pipeline/ci/verificar-segredos.mjs`), reaproveitado por parâmetro, sem duplicar a lógica de detecção |
| Falha proposital com segredo de teste injetado (execução real, não relato) | Criei um diretório temporário fora do repositório com um arquivo `.json` contendo `api_key = "abcdef1234567890abcdef1234567890"` e rodei `node pipeline/ci/verificar-segredos.mjs <dir>` diretamente | **Bloqueou com `exit 1`**, apontando os 2 padrões (`api_key`, `chave-hex-32+`) e o arquivo exato; o mesmo diretório sem o segredo passou com `exit 0` — confirmado nas duas direções |
| `versao.json`/`config/clubes-2026.json`/demais arquivos gerados por PUB-02 não carregam segredo nenhum por construção | `gerador-snapshots.ts` lido: todo campo publicado vem de `config/*.json`/estado interno já auditados (Lotes 2/4/5) — nenhuma leitura de `process.env`/segredo em nenhum ponto do módulo | Conforme — a varredura de `dist-dados/` é defesa em profundidade, não a única barreira |

**Nenhum achado alto/crítico.**

### 2. Dependências de runtime e auditoria de CI (SDD §3/§7.7, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| Lote 6 não introduziu dependência de runtime nova | `package.json` comparado ao estado já auditado: `dependencies` continua `fast-xml-parser`, `react`, `react-dom`, `react-router-dom`, `zod`; `pipeline/publicacao/`/`pipeline/config/derivador-paleta.ts` usam só `zod` + módulos nativos do Node | Conforme |
| `npm audit --omit=dev` | Executado por mim nesta rodada | Mesmas **2 vulnerabilidades moderadas** em `react-router`/`react-router-dom`, já registradas (`REFAT-01-03`, Lote 1, prazo antes do Lote 8) — nenhuma nova, nenhuma alta/crítica |
| `build-publish.yml` ganhou passo de auditoria de dependências (lacuna do Lote 1, fechada por PUB-03) | `.github/workflows/build-publish.yml` lido: passo "Auditoria de dependências de runtime (SDD §7.7, GUARDRAILS §2)" com `npm audit --omit=dev --audit-level=high`, antes do `build` | **Conforme — lacuna real fechada**: antes de PUB-03, só `ingestao.yml` tinha esse portão; `build-publish.yml` (workflow que efetivamente publica a SPA) não tinha nenhum. Confirmei o `--audit-level=high` presente em ambos os workflows (o que de fato bloquearia merge/publicação em caso de achado alto/crítico) |

**Nenhum achado novo alto/crítico** — a lacuna de auditoria em `build-publish.yml` identificada implicitamente desde o Lote 1 está corretamente fechada por PUB-03.

### 3. Achado SEC-06-01 (reafirmação de SEC-01-02/REFAT-01-02) — pinagem de ações por tag em `build-publish.yml` continua em aberto, prazo já vencido

**Severidade**: **média** (mesma classificação original de `SEC-01-02`,
Lote 1 — não é vulnerabilidade ativa, é lacuna de mitigação de
supply-chain).

Reconfirmei por leitura direta de `.github/workflows/build-publish.yml`
(linha a linha, não por amostragem): `actions/checkout@v4.2.2`,
`actions/setup-node@v4.1.0`, `actions/configure-pages@v5.0.0`,
`actions/upload-pages-artifact@v3.0.1`, `actions/deploy-pages@v4.0.5` —
**todas ainda fixadas por tag**, e `runs-on: ubuntu-latest` (não fixo) —
exatamente o mesmo estado documentado em `SEC-01-02` na validação do Lote 1.
`ingestao.yml` (workflow irmão do mesmo Lote 1) continua com SHA pinning +
`ubuntu-24.04`, então a inconsistência entre os dois workflows do mesmo
repositório também persiste.

O prazo textual original de `REFAT-01-02` (`TASK.md`, `Refatoração Lote-1`)
era **"antes do Lote 6 (PUB-02/PUB-03)"**. PUB-03 concluiu, mas não tocou
este ponto — a nota de implementação de PUB-03 avalia "ambos já em
conformidade literal com a regra" (o texto do SDD §7.7, "fixadas por versão,
nunca por referência móvel", é satisfeito por tag também, lido isoladamente),
o que é uma leitura defensável do **texto genérico** do SDD, mas não resolve
o **achado específico já registrado** (`SEC-01-02`), que pede explicitamente
o mecanismo mais forte (SHA de commit), o mesmo já usado no workflow irmão.
Não trato isso como reprovação de PUB-03 (não era o critério de aceite da
tarefa) nem crio uma tarefa nova (o débito já existe, é o mesmo
`REFAT-01-02`) — mas o prazo textual não pode continuar sendo "antes do Lote
6", porque o Lote 6 já terminou.

**Ajuste de prazo e elevação a requisito de segurança operacional bloqueante
do deploy** (feito por mim diretamente no `TASK.md`, mesmo padrão já usado
para `REFAT-02-01` na validação do Lote 5): novo prazo de `REFAT-01-02` —
**antes de qualquer execução real do chapéu DevOps (`/deploy`) que publique
a SPA em produção** (não apenas "antes do Lote 6", que já não é uma baliza
útil). Diferente de um débito comum, registro este explicitamente na Seção 6
abaixo como requisito de segurança operacional que o próprio chapéu DevOps
deste agente deve verificar **antes** de executar o primeiro deploy real —
não bloqueia a aprovação deste lote (severidade continua média, sem
exploração ativa conhecida), mas bloqueia a próxima etapa do pipeline de
governança se não for resolvido antes dela.

### 4. Validação de entrada e contrato público (SDD §7.4.1, §2.2)

| Verificação | Método | Resultado |
|---|---|---|
| Todo arquivo publicado por PUB-02 passa por `.parse()` do schema público correspondente antes de ser gravado | `gerador-snapshots.ts` lido: `noticiasPublicasSchema`/`brasileiraoPublicoSchema`/`clubePublicoSchema`/etc., todos com `.parse()` (não `.safeParse()`) — falha de schema interrompe a geração em vez de publicar dado fora de forma | Conforme — mesma disciplina de "nunca corrige heuristicamente" (GUARDRAILS §4), aqui aplicada à fronteira interna→pública, não só externa→interna |
| Paleta de clube inválida quebra a publicação, não é publicada com fallback | `construirSnapshots` chama `derivarPaletasClubes` sem `try/catch` — `ErroPaletaInvalida` propaga e interrompe `gerarSnapshotsEmDisco` inteiro | Conforme ADR-017 ("falha de validação quebra o build", agora também "quebra a publicação") |
| Nenhum campo interno de operação (`idsProvedor`, `feeds`/`termos` de fonte, `clubes`/`observacao` de campeonato) vazado ao contrato público | `clubePublicoSchema`/`fontePublicaSchema`/`campeonatoPublicoSchema` conferidos campo a campo | Conforme — reduz superfície de informação exposta ao mínimo que a SPA precisa (princípio de menor exposição, coerente com SDD §7.1) |

**Nenhum achado novo.**

### 5. Compliance regulatório (LGPD) e isolamento

- Nenhum dado pessoal é publicado por PUB-02 — os 10 arquivos do contrato são
  conteúdo editorial (notícia), dado de configuração (clube/campeonato/fonte)
  e estado de ingestão (diagnóstico operacional); nenhum identificador de
  usuário. Reforça a conclusão dos Lotes 1-5.
- Isolamento mantido: `pipeline/publicacao/` (I/O) só lê `estado/*`/`config/*`
  e só escreve em `dist-dados/` — nenhuma chamada de rede própria, nenhum
  acesso a segredo (confirmado na Seção 1 acima).

**Nenhum achado.**

### 6. Requisitos de segurança operacional para o chapéu DevOps (definidos aqui)

1. **Bloqueante antes do primeiro deploy real em produção**: migrar
   `build-publish.yml` para SHA pinning + `runs-on` fixo (`REFAT-01-02`,
   achado `SEC-06-01`/`SEC-01-02`) — o chapéu DevOps deste mesmo agente não
   deve executar `/deploy` contra produção antes de confirmar esta tarefa
   concluída, dado que é o próprio workflow que publica o artefato final.
2. **Bloqueante para a ingestão real em produção** (não bloqueia a
   publicação da SPA em si, mas impede que o contrato de dados tenha
   conteúdo real): `npm run ingestao` ainda não existe (`REFAT-06-01`, achado
   QA-6-02 do chapéu QA) — sem esse script, `ingestao.yml` nunca sai do
   modo dry-run e `gerador-snapshots`/PUB-02 nunca roda de fato em CI. Isso
   não é uma falha de segurança em si (o dry-run é seguro por design, FUND-02),
   mas o chapéu DevOps precisa saber que o site publicado ficará sem dado
   real até essa lacuna ser fechada.
3. Cadastro do secret `FOOTBALL_DATA_API_TOKEN` (já registrado desde o Lote
   1) continua pendente de confirmação operacional — reforçado aqui porque
   `npm run ingestao`, quando existir, dependerá dele imediatamente.
4. Nenhum requisito novo de rede/firewall — `dist-dados/` é publicado pelo
   mesmo hosting estático já coberto (GitHub Pages/branch `dados`), sem porta
   ou serviço adicional.

## Achados por severidade — Lote 6

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| Média | `SEC-06-01` (= `SEC-01-02`) — pinagem de ações por tag + `ubuntu-latest` em `build-publish.yml`, prazo "antes do Lote 6" vencido | **Bloqueia o próximo `/deploy` real em produção** (requisito operacional explícito acima) — não bloqueia a aprovação deste lote | `REFAT-01-02`, prazo reajustado para "antes de qualquer execução real do chapéu DevOps" |
| — | Nenhum achado alto/crítico novo | — | — |
| — | Débito de `react-router` (`REFAT-01-03`) e de `idsProvedor` (`REFAT-02-01`) — sem mudança neste lote | Não | Já rastreados, prazos inalterados |

Nenhum achado tem relevância estratégica de negócio suficiente para escalar
ao Gestor como decisão de compliance/custo — `SEC-06-01` é hardening técnico
de CI, não decisão de negócio; registrado aqui e em `TASK.md`, sinalizado ao
Gestor em paralelo apenas como fechamento de rotina do Gate 4, não como
bloqueio que exija decisão dele.

## Veredito — Lote 6

**Aprovado com débito registrado** (reafirmação de `SEC-01-02`/`REFAT-01-02`,
severidade média, prazo reajustado e agora explicitamente amarrado ao
próximo `/deploy` real — não ao Lote 6 em si). Os dois requisitos centrais de
segurança deste lote — varredura de segredo cobrindo `dist-dados/` e
auditoria de dependências em `build-publish.yml` — estão implementados e
verificados por execução real (injeção de segredo de teste, `npm audit`). O
Lote 6 está liberado para a checagem estrutural final do Validador e
fechamento como `Validado (com ressalvas)`.

---

## Lote 7 — Design system e infraestrutura de tela

**Pré-requisito confirmado**: `QA-REPORT.md` aprovou funcionalmente (com
ressalvas) as 9 tarefas do Lote 7 (UI-DS-01 a UI-DS-09) antes desta auditoria
começar.

### 1. Dados pessoais em `armazenamento/` (SDD §7.6, RNF-07, CA-13.5)

| Verificação | Método | Resultado |
|---|---|---|
| `app/armazenamento/preferencias.ts` sem campo de identificação de usuário | Lido por inteiro: `Preferencias` (DOM-01) só guarda `versaoEsquema`, `temporada`, `favoritos` (ids de esporte), `fontesBloqueadas` (ids de fonte), `timeId`/`rivais` (ids de clube), `atualizadoEm` (timestamp) | Conforme — nenhum campo novo além dos já auditados em DOM-01 (Lote 3) |
| `app/armazenamento/cenario.ts` sem campo de identificação de usuário | Lido por inteiro: `Cenario` só guarda escopo (`temporada:time:rivais-ordenados`) e palpites por id de partida (`vitoria`/`empate`/`derrota`/`null`) | Conforme |
| Nenhum `console.*`/log grava o conteúdo persistido | Grep por `console\.` em `app/armazenamento/` | Só `console.warn` em caminhos defensivos (JSON inválido, esquema incompatível, escrita indisponível) — nenhuma ocorrência imprime o valor de `Preferencias`/`Cenario`, só a chave e o motivo do descarte | Conforme |
| Teste de execução real prova CA-13.5 | Rodei `npx vitest run app/armazenamento/preferencias.test.ts app/armazenamento/cenario.test.ts` | 27/27 passam, incluindo os 2 casos dedicados a "nenhum campo além dos definidos" e "nenhuma substring de dado pessoal no JSON persistido" |

**Nenhum achado.**

### 2. Validação de entrada externa — `localStorage` (SDD §7.4.1, GUARDRAILS §4)

| Verificação | Método | Resultado |
|---|---|---|
| Todo conteúdo lido de `localStorage` passa por Zod antes de entrar no domínio | `preferencias.ts`/`cenario.ts`: `JSON.parse` seguido de `preferenciasSchema.safeParse`/`cenarioSchema.safeParse` (DOM-01) antes de qualquer uso | Conforme |
| Falha de esquema é descarte com registro, nunca correção heurística | JSON inválido ou esquema estruturalmente incompatível descarta o objeto inteiro com `console.warn`, nunca tenta "consertar" o valor | Conforme GUARDRAILS §4 |
| Referência individual inválida (CA-13.4) tratada como descarte parcial, não como falha de segurança silenciosa | Cada descarte gera uma mensagem específica (`descartes: string[]`), nunca falha silenciosa sem rastro | Conforme |

**Nenhum achado.**

### 3. `dangerouslySetInnerHTML` em todo o design system (SDD §7.4.2)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhuma ocorrência real de `dangerouslySetInnerHTML` em `app/design-system/`, `app/armazenamento/`, `app/dados/`, `app/tema/` | `grep -rn "dangerouslySetInnerHTML"` nos 4 diretórios | Única ocorrência é textual, dentro de um comentário de `BlocoPreto.tsx` citando a própria Diretriz #5 ("nunca `dangerouslySetInnerHTML`") — não é uso de código |
| Título/rótulo/texto de todo componente é sempre nó de texto React | Confirmado por leitura de `CartaoIngresso`, `BlocoPreto`, `TabelaClassificacao`, `LinhaPartida`, `BannerAlerta` — todos usam interpolação de string em JSX, nunca HTML bruto | Conforme |

**Nenhum achado.**

### 4. Dependências de runtime e de desenvolvimento (SDD §3, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| `vitest-axe`/`axe-core` (adicionados nesta rodada, UI-DS-01) são só devDependency | `package.json` lido: `dependencies` = `fast-xml-parser`, `react`, `react-dom`, `react-router-dom`, `zod` (lista fechada do GUARDRAILS §2, idêntica à já auditada nos Lotes 1-5); `vitest-axe` presente só em `devDependencies` (`axe-core` entra como transitiva de `vitest-axe`, também no grafo de dev) | Conforme — nenhuma dependência de runtime nova, `GUARDRAILS.md` não precisa de atualização |
| `npm audit --omit=dev` | Executado por mim nesta rodada | Mesmas **2 vulnerabilidades moderadas** em `react-router`/`react-router-dom` (CVE-2025-68470 bypass, injeção de construtor via `deserializeErrors()`), já registradas e com débito aberto (`REFAT-01-03`, Lote 1, prazo antes do Lote 8) — nenhuma nova, nenhuma alta/crítica; a superfície de `axe-core`/`vitest-axe` não aparece no relatório porque roda só em teste local (devDependency), nunca no bundle publicado |
| Bug de build conhecido do `vitest-axe@0.1.0` (`dist/extend-expect.js` vazio), contornado por `vitest-axe-setup.ts` | Lido: o contorno importa a função real de `vitest-axe/dist/matchers` (subpath interno do próprio pacote, não um fork nem código de terceiro reescrito) e registra via `expect.extend` — não introduz superfície de execução nova além do próprio pacote já declarado | Aceitável — é um workaround de tooling de teste, não afeta o bundle de produção nem introduz dependência de runtime |

**Nenhum achado.**

### 5. Conteúdo publicado — cor de clube só como custom property, nunca embutida em código (ADR-017)

| Verificação | Método | Resultado |
|---|---|---|
| `FaixaClube`/`BarraPontuacao`/`TabelaClassificacao`/`AvatarClube` recebem cor de clube só via prop/custom property inline, nunca leem `clubes-2026.json` diretamente | Lido nos 4 componentes | Conforme — mantém a fronteira certa (ADR-017: "o navegador só aplica", a derivação/validação de contraste é do pipeline, PUB-01) |

**Nenhum achado.**

### 6. Requisitos de segurança operacional para o chapéu DevOps (definidos aqui)

Nenhum requisito novo além dos já registrados nos Lotes 1/4/5 (secret do
provedor de futebol, permissões mínimas de workflow, varredura de segredo
cobrindo `estado/noticias.json`/`estado/futebol.json`). O design system em si
não introduz superfície de rede/infraestrutura nova — é código de front-end
puro, sem I/O de rede própria (a busca de dado é UI-DS-08, que só consome o
contrato público já auditado, sem endpoint novo).

## Achados por severidade — Lote 7

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum achado alto/crítico | — | — |
| — | Nenhum achado médio/baixo novo de segurança (débito de `react-router` já coberto por `REFAT-01-03`, Lote 1; o achado de token hygiene do chapéu QA, `REFAT-07-01`, e a nota de spec gap, `QA-7-02`, não são achados de segurança) | — | — |

Nenhum achado com relevância estratégica de negócio a escalar ao Gestor nesta
rodada.

## Veredito — Lote 7

**Aprovado**, sem débito novo de segurança. Nenhum dado pessoal em
`armazenamento/preferencias`/`cenario` (CA-13.5 confirmado por execução real
de teste); `dangerouslySetInnerHTML` ausente de todo o design system;
`vitest-axe`/`axe-core` corretamente restritos a devDependency, sem afetar a
lista fechada de dependências de runtime do SDD §3/GUARDRAILS §2; nenhuma
vulnerabilidade nova em `npm audit --omit=dev`. O Lote 7 está liberado para a
checagem estrutural final do Validador e fechamento como `Validado (com
ressalvas)`.

---

## Lote 8 — Onboarding e Home (T-01, T-02)

**Pré-requisito confirmado**: `QA-REPORT.md` aprovou funcionalmente (com
ressalvas) as 6 tarefas do Lote 8 (UI-T01-01/02, UI-T02-01/02/03/04) antes
desta auditoria começar.

### 1. Dados pessoais em preferências (SDD §7.6, RNF-07, CA-13.5)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum campo novo de identificação de usuário adicionado por este lote | `dominio/tipos/estado-local.ts` relido por inteiro: `preferenciasSchema`/`cenarioSchema` (DOM-01, Lote 3) inalterados — `Preferencias` só tem `versaoEsquema`/`temporada`/`favoritos` (ids de esporte)/`fontesBloqueadas` (ids de fonte)/`timeId`/`rivais` (slugs de clube)/`atualizadoEm`; nenhum componente do Lote 8 grava campo além destes | Conforme — nenhum novo campo, nenhum dado pessoal |
| `Onboarding.tsx`/`PassoFavoritos.tsx`/`PassoTime.tsx` só chamam `salvarPreferencias`/`lerPreferencias` (UI-DS-09, já auditado no Lote 7), nunca escrevem `localStorage` diretamente | Grep por `localStorage\.` fora de `app/armazenamento/` nos arquivos do Lote 8 | Nenhuma ocorrência — toda escrita passa pela fronteira já auditada |

**Nenhum achado.**

### 2. `dangerouslySetInnerHTML` (SDD §7.4.2)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhuma ocorrência real em `app/rotas/paginas/Onboarding*`, `app/rotas/paginas/Home*`, `app/rotas/Navegacao/` | `grep -rn "dangerouslySetInnerHTML=\{"` nos 3 diretórios (busca pela sintaxe de uso real, não pela string em comentário) | Nenhuma ocorrência |
| Título/manchete/texto de todas as seções da Home são nós de texto React | Lido em `SecaoIdentidade.tsx`/`SecaoSeusEsportes.tsx`/`SecaoUltimasNoticias.tsx`: interpolação de string em JSX (`{titulo}`, template strings), nunca HTML bruto | Conforme |

**Nenhum achado.**

### 3. Links externos — `rel="noopener noreferrer"` (SDD §7, CA-04.2)

| Verificação | Método | Resultado |
|---|---|---|
| Todo link de notícia (que sai do produto, CA-04.2) usa `target="_blank"` + `rel="noopener noreferrer"` | `CartaoIngresso.tsx` (consumido por `SecaoSeusEsportes`/`SecaoUltimasNoticias` para `destino: 'externo'`) relido: `<a href={href} target="_blank" rel="noopener noreferrer" ...>` | Conforme — único ponto de saída externa do Lote 8, já coberto pelo componente auditado no Lote 7 (`CartaoIngresso`, UI-DS-03), reconfirmado aqui no consumo real |
| `aria-label` do link externo avisa "abre em nova aba" (WCAG 3.2.5) | Já auditado em `CartaoIngresso` no Lote 7; reconfirmado no uso real de `SecaoSeusEsportes.test.tsx`/`SecaoUltimasNoticias.test.tsx` | Conforme |

**Nenhum achado.**

### 4. Fronteira de entrada externa — contrato público de PUB-02 (SDD §7.4.1, GUARDRAILS §4)

| Verificação | Método | Resultado |
|---|---|---|
| `SecaoSeusEsportes`/`SecaoUltimasNoticias` validam `/dados/noticias.json`/`/dados/ingestao/status.json` com Zod antes de usar | `esquemaNoticiasPublico = z.array(itemNoticiaSchema)` (idêntico ao `noticiasPublicasSchema` real de `gerador-snapshots.ts`) passado a `useSnapshot`, que já valida via `.safeParse` antes de expor o dado (UI-DS-08, Lote 7, já auditado) | Conforme — a correção de contrato (array vs. `{itens}`) não introduziu nenhuma validação heurística nova; continua "falha de schema é descarte com registro" |
| `SecaoIdentidade` valida `/dados/config/clubes-2026.json`/`/dados/futebol/*.json` | `configPublico.ts`/`futebol.ts` (schemas locais espelhando os schemas reais do pipeline) passados a `useClubesPublicos`/`useSnapshot` | Conforme |
| Nenhuma correção heurística em caso de falha de schema | Confirmado por leitura: degradação silenciosa preserva o último dado válido, nunca "conserta" o dado recebido | Conforme GUARDRAILS §4 |

**Nenhum achado.**

### 5. Dependências de runtime e de desenvolvimento (SDD §3, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhuma dependência de runtime nova introduzida pelo Lote 8 | `package.json` relido: `dependencies` inalteradas desde o Lote 7 (`fast-xml-parser`, `react`, `react-dom`, `react-router-dom`, `zod`) | Conforme |
| `npm audit --omit=dev` | Executado por mim nesta rodada | **Mesmas 2 vulnerabilidades moderadas** em `react-router`/`react-router-dom` (`react-router 6.0.0 - 7.17.0`: open redirect via backslash em `<Link>`/`useNavigate`, CVE-2025-68470 bypass; injeção arbitrária de construtor via `deserializeErrors()` na hidratação SSR) — nenhuma nova, nenhuma alta/crítica |

**Achado `SEC-08-01`** (reafirmação de débito já rastreado, não achado novo de
código): o débito de `react-router`/`react-router-dom` (`REFAT-01-03`, Lote
1) tinha prazo explícito "antes do Lote 8" — este lote está sendo validado
agora e a vulnerabilidade moderada continua presente, sem `REFAT-01-03` ter
sido executada. Severidade continua **média** (mesma classificação desde o
Lote 1: open redirect/injeção de construtor exigem uma combinação de
condições específicas para exploração, não é RCE/exposição direta de dado).
Não bloqueia a aprovação deste lote — mas o prazo perdido não pode virar só
uma nota solta de novo: reajusto o prazo, aplicando o mesmo backstop já
usado para `REFAT-01-02` (`SEC-06-01`, Lote 6): **antes de qualquer execução
real do chapéu DevOps (`/deploy`) que publique a SPA em produção**. Do ponto
em que o Lote 8 é o maior lote de tela do projeto (PR-04) e já mexeu em
`app/rotas/` várias vezes em paralelo (Navegacao, Home, Onboarding), o risco
de regressão ao aplicar a major do `react-router-dom` teria sido maior nesta
janela — não é uma justificativa para ignorar o prazo, mas explica por que
não escalo isso como bloqueio agora que o próximo `/deploy` real ainda não
foi disparado.

### 6. Requisitos de segurança operacional para o chapéu DevOps (definidos aqui)

Nenhum requisito novo além dos já registrados nos Lotes 1/4/5/6. O
Lote 8 não introduz endpoint novo nem superfície de rede além do contrato
público já auditado (PUB-02, Lote 6) — é consumo, não produção, de dado
publicado.

## Achados por severidade — Lote 8

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum achado alto/crítico | — | — |
| Média | `SEC-08-01` (= `SEC-01-03`/`REFAT-01-03`) — `react-router`/`react-router-dom` com CVE moderado, prazo "antes do Lote 8" vencido sem execução | **Bloqueia o próximo `/deploy` real em produção** (mesmo backstop já aplicado a `SEC-06-01`/`REFAT-01-02`) — não bloqueia a aprovação deste lote | `REFAT-01-03`, prazo reajustado para "antes de qualquer execução real do chapéu DevOps" |
| — | Débito de `idsProvedor` (`REFAT-02-01`) e de pinagem por SHA (`REFAT-01-02`/`SEC-06-01`) — sem mudança neste lote | Não | Já rastreados, prazos inalterados |

Nenhum achado tem relevância estratégica de negócio suficiente para escalar
ao Gestor como decisão de compliance/custo — `SEC-08-01` é débito técnico de
dependência já conhecido desde o Lote 1, não uma decisão de negócio nova;
registrado aqui e em `TASK.md`, sinalizado ao Gestor em paralelo apenas como
fechamento de rotina do Gate 4, não como bloqueio que exija decisão dele.

## Veredito — Lote 8

**Aprovado com débito reafirmado** (reafirmação de `SEC-01-03`/`REFAT-01-03`,
severidade média, prazo vencido e reajustado — agora amarrado ao mesmo
backstop de `SEC-06-01`: antes do próximo `/deploy` real, não antes de um
lote específico). Nenhum achado novo de segurança neste lote: nenhum dado
pessoal em `Preferencias`/`Cenario` (reconfirmado), `dangerouslySetInnerHTML`
ausente, `rel="noopener noreferrer"` presente no único ponto de saída
externa (link de notícia), validação Zod na fronteira de todo dado publicado
consumido, nenhuma dependência de runtime nova. O Lote 8 está liberado para
a checagem estrutural final do Validador e fechamento como `Validado (com
ressalvas)`.

---

## Lote 9 — Configurações e seleção de time (T-03, T-04)

**Pré-requisito confirmado**: `QA-REPORT.md` aprovou funcionalmente (com
ressalvas) as 3 tarefas do Lote 9 (UI-T03-01/02, UI-T04-01) antes desta
auditoria começar.

### 1. Dados pessoais em preferências e telemetria (SDD §7.6, RNF-07, ADR-012)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum campo novo de identificação de usuário em `Preferencias` | `dominio/tipos/estado-local.ts` relido: inalterado desde o Lote 8 — `favoritos`/`fontesBloqueadas`/`timeId`/`rivais` continuam ids/slugs de configuração, nunca dado do torcedor | Conforme |
| `sportslm.anonimo.v1` tratado como identificador anônimo local, não dado pessoal | `telemetriaId.ts` lido por inteiro: só `removerBrutoSemLancar` na chave; nenhuma geração de UUID, nenhuma leitura, nenhum envio de rede — "Desativar e apagar id" é puramente destrutivo (remoção), nunca cria ou lê identidade | Conforme ADR-012 regra 2/6 — o módulo não antecipa nem inventa mecanismo de telemetria (TEL-01, Lote 12, segue responsável por gravar o identificador) |
| Texto de privacidade e lista de eventos não sub/superestimam a coleta real | `TEXTO_PRIVACIDADE`/`EVENTOS_TELEMETRIA_RNF07` comparados literalmente com RNF-07 (PRD-TECNICO.md Seção 2) — 5 eventos, nenhum a mais/a menos, nenhum conteúdo de preferência do usuário entre eles | Conforme — nenhum evento descrito carrega dado de conteúdo/preferência, só metadados de uso (ex. "abertura do comparativo") |
| `Configuracoes.tsx`/`EscolherTime.tsx` só escrevem via `lerPreferencias`/`salvarPreferencias`/`limparCenario` (UI-DS-09, já auditado) | Busca por `localStorage\.` fora de `app/armazenamento/` nos arquivos de produção do Lote 9 (excluindo `*.test.tsx`) | Nenhuma ocorrência — toda escrita passa pela fronteira já auditada |

**Nenhum achado.**

### 2. `dangerouslySetInnerHTML` (SDD §7.4.2)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhuma ocorrência real em `app/rotas/sobreposicoes/` | Busca por `dangerouslySetInnerHTML=\{` no diretório inteiro (sintaxe de uso real) | Nenhuma ocorrência |
| Nome de clube/fonte/esporte e textos de banner são nós de texto React | `SecaoFontesDeNoticia.tsx`/`EscolherTime.tsx`/`SecaoPrivacidade.tsx` lidos: interpolação de string em JSX, nunca HTML bruto | Conforme |

**Nenhum achado.**

### 3. Fronteira de entrada externa — `config/fontes.json` e `/dados/ingestao/status.json` (SDD §7.4.1, GUARDRAILS §4)

| Verificação | Método | Resultado |
|---|---|---|
| `Configuracoes.tsx` valida `config/fontes.json` com Zod antes de usar | `fonteCatalogoSchema`/`listaFontesCatalogoSchema` (`.passthrough()`), `construirFontesCatalogo` faz `safeParse` e degrada para catálogo vazio (nunca lança) em caso de falha, com `console.warn` — sem correção heurística | Conforme Diretriz de Implementação #6 |
| `/dados/ingestao/status.json` validado antes de expor estado de instabilidade | `esquemaStatusPublico` passado a `useSnapshot` (UI-DS-08, já auditado no Lote 7) | Conforme |
| `EscolherTime.tsx`/`preferencias.ts`: leitura de `localStorage` (entrada externa, SDD §7.4.1) validada com Zod antes de confiar no `timeId` salvo | `preferenciasSchema.safeParse` em `lerTimeIdBruto`/`lerPreferencias`; falha de parse retorna `null` (nunca lança, nunca "conserta" o valor) | Conforme |

**Nenhum achado.**

### 4. Dependências de runtime e de desenvolvimento (SDD §3, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhuma dependência de runtime nova introduzida pelo Lote 9 | `package.json` relido: `dependencies` inalteradas desde o Lote 7 (`fast-xml-parser`, `react`, `react-dom`, `react-router-dom`, `zod`) | Conforme |
| `npm audit --omit=dev` | Executado por mim nesta rodada | **Mesmas 2 vulnerabilidades moderadas** em `react-router`/`react-router-dom` (open redirect via backslash em `<Link>`/`useNavigate`, CVE-2025-68470 bypass; injeção de construtor via `deserializeErrors()`) — nenhuma nova, nenhuma alta/crítica. `EscolherTime.tsx`/`Configuracoes.tsx` usam `useNavigate` (RN-12/navegação pós-confirmação) — reconfirmei que nenhum destino de navegação deste lote é construído a partir de entrada não sanitizada do usuário (rotas fixas: `/time`, `/onboarding`), então a superfície de exploração do CVE (open redirect) não é ampliada por este lote |

**Achado `SEC-09-01`** (reafirmação de débito já rastreado, não achado novo de
código): `REFAT-01-03` segue com prazo "antes de qualquer `/deploy` real"
(reajustado nos Lotes 6/8, backstop de `SEC-06-01`/`SEC-08-01`) — continua
sem execução, mas o prazo não venceu ainda (não houve `/deploy` real).
Severidade **média**, mesma classificação desde o Lote 1, não bloqueia esta
aprovação.

### 5. Requisitos de segurança operacional para o chapéu DevOps (definidos aqui)

Nenhum requisito novo além dos já registrados nos Lotes 1/4/5/6. O Lote 9
não introduz endpoint novo nem superfície de rede além do contrato público
já auditado (`/dados/ingestao/status.json`, PUB-02/Lote 6) — é consumo, não
produção.

## Achados por severidade — Lote 9

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum achado alto/crítico | — | — |
| Média | `SEC-09-01` (= `SEC-01-03`/`REFAT-01-03`) — débito já rastreado de `react-router`/`react-router-dom`, sem mudança neste lote | Bloqueia o próximo `/deploy` real (backstop já vigente desde `SEC-06-01`) — não bloqueia a aprovação deste lote | Prazo inalterado: antes de qualquer execução real do chapéu DevOps |
| — | Débitos de `idsProvedor` (`REFAT-02-01`) e pinagem por SHA (`REFAT-01-02`) — sem mudança neste lote | Não | Já rastreados, prazos inalterados |

Nenhum achado de segurança novo neste lote tem relevância estratégica de
negócio que exija decisão do Gestor — registrado aqui e em `TASK.md`,
sinalizado ao Gestor em paralelo apenas como fechamento de rotina do Gate 4.

## Veredito — Lote 9

**Aprovado, sem débito novo de segurança** (reafirmação apenas do débito já
conhecido de `react-router`/`REFAT-01-03`, inalterado desde o Lote 8).
Nenhum dado pessoal em `Preferencias`/telemetria — `sportslm.anonimo.v1`
confirmado como id anônimo local, nunca combinado com dado de conteúdo;
`dangerouslySetInnerHTML` ausente; toda entrada externa (`config/fontes.json`,
`/dados/ingestao/status.json`, `localStorage`) validada com Zod na fronteira,
sem correção heurística; nenhuma dependência de runtime nova. O Lote 9 está
liberado para a checagem estrutural final do Validador e fechamento como
`Validado (com ressalvas)`.

---

## Lote 10 — Painel e detalhe do campeonato (T-05, T-06)

**Base específica**: `.md/QA-REPORT.md` (Lote 10, aprovado com ressalvas —
QA-10-01/02/03, nenhum de segurança), `.md/SDD.md` §7, `.md/GUARDRAILS.md`,
código real de `PainelTime.tsx`/`DetalheCampeonato.tsx` e seus módulos CSS.

### 1. Dados sensíveis (SDD §7.4, GUARDRAILS §4)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum dado pessoal exposto em `/dados/futebol/*` (dado público de campeonato/partida, sem PII) | Schemas `clubeFutebolPublicoSchema`/`brasileiraoPublicoSchema` (`app/dados/futebol.ts`) lidos — só campos de competição/partida/classificação, nenhum campo de usuário | Conforme |
| `PainelTime.tsx`/`DetalheCampeonato.tsx` só leem `timeId` de `localStorage` (já auditado como não-PII, ADR-012/Lote 1) | Busca por `localStorage\.` fora de `app/armazenamento/` nos dois arquivos de produção do Lote 10 | Nenhuma ocorrência direta — ambos usam `lerBrutoSemLancar` (fronteira já auditada) |
| Nenhum dado sensível em mensagem de erro/texto de estado | "Não conseguimos carregar o painel agora."/"...este campeonato." — genéricos, sem stack trace nem detalhe de implementação exposto ao usuário | Conforme |

**Nenhum achado.**

### 2. Validação Zod na fronteira de `/dados/futebol/*` (SDD §7.4.1, Diretriz de Implementação #6)

| Verificação | Método | Resultado |
|---|---|---|
| `/dados/futebol/clube/<slug>.json` validado antes de uso | `useSnapshot(..., clubeFutebolPublicoSchema, ...)` em ambas as telas — mesma fronteira `useSnapshot`/`ClienteSnapshot` já auditada (Lote 7, UI-DS-08): `safeParse`, descarte com registro em caso de falha, nunca correção heurística | Conforme |
| `/dados/futebol/brasileirao.json` validado antes de uso (classificação/zonas) | `useSnapshot(..., brasileiraoPublicoSchema, ...)` em `DetalheCampeonato.tsx`, mesma fronteira | Conforme |
| `/dados/ingestao/status.json` validado antes de uso (`pausadoPorCota`) | `esquemaStatusPublico` (`z.object({ pausadoPorCota: z.boolean() }).passthrough()`) passado a `useSnapshot` — mesmo padrão de leitura parcial já usado por `SecaoUltimasNoticias`/UI-T02-03 | Conforme |
| `timeId` salvo (entrada externa via `localStorage`) validado antes de confiar | `preferenciasSchema.safeParse` em `lerTimeIdSalvo` (duplicado propositalmente nas duas telas, mesmo padrão de `SecaoIdentidade`) — falha de parse retorna `null` (nunca lança, nunca "conserta" o valor) | Conforme |

**Nenhum achado.**

### 3. `dangerouslySetInnerHTML` (SDD §7.4.2)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhuma ocorrência em `PainelTime.tsx`/`DetalheCampeonato.tsx`/CSS modules do Lote 10 | Busca por `dangerouslySetInnerHTML=\{` nos arquivos do lote | Nenhuma ocorrência — nomes de clube/competição/estádio são sempre interpolação de string em JSX |

**Nenhum achado.**

### 4. Dependências de runtime (SDD §3, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhuma dependência de runtime nova introduzida pelo Lote 10 | `package.json` relido: `dependencies` inalteradas desde o Lote 7 | Conforme |
| `npm audit --omit=dev` | Executado por mim nesta rodada | **Mesmas 2 vulnerabilidades moderadas** em `react-router`/`react-router-dom` (open redirect via backslash, CVE-2025-68470 bypass; injeção de construtor via `deserializeErrors()`) — nenhuma nova, nenhuma alta/crítica. Nenhuma navegação nova deste lote é construída a partir de entrada não sanitizada do usuário (`Link to={`/time/${entrada.competicao.id}`}`, `id` sempre vindo do array publicado já validado por Zod, nunca de texto livre digitado) |

**Achado `SEC-10-01`** (reafirmação de débito já rastreado, não achado novo de
código): `REFAT-01-03` segue com prazo "antes de qualquer `/deploy` real"
(reajustado nos Lotes 6/8, backstop de `SEC-06-01`/`SEC-08-01`) — continua
sem execução, mas o prazo não venceu ainda (não houve `/deploy` real).
Severidade **média**, mesma classificação desde o Lote 1, não bloqueia esta
aprovação.

### 5. Requisitos de segurança operacional para o chapéu DevOps (definidos aqui)

Nenhum requisito novo além dos já registrados nos Lotes 1/4/5/6. O Lote 10
não introduz endpoint novo nem superfície de rede além do contrato público
já auditado (`/dados/futebol/clube/<slug>.json`, `/dados/futebol/brasileirao.json`,
`/dados/ingestao/status.json`, PUB-02/Lote 6) — é consumo, não produção.

## Achados por severidade — Lote 10

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum achado alto/crítico | — | — |
| Média | `SEC-10-01` (= `SEC-01-03`/`REFAT-01-03`) — débito já rastreado de `react-router`/`react-router-dom`, sem mudança neste lote | Bloqueia o próximo `/deploy` real (backstop já vigente desde `SEC-06-01`) — não bloqueia a aprovação deste lote | Prazo inalterado: antes de qualquer execução real do chapéu DevOps |
| — | Débitos de `idsProvedor` (`REFAT-02-01`), pinagem por SHA (`REFAT-01-02`) e layout 2 colunas (`REFAT-08-01`) — sem mudança neste lote | Não | Já rastreados, prazos inalterados |

Nenhum achado de segurança novo neste lote tem relevância estratégica de
negócio que exija decisão do Gestor — registrado aqui e em `TASK.md`,
sinalizado ao Gestor em paralelo apenas como fechamento de rotina do Gate 4.

## Veredito — Lote 10

**Aprovado, sem débito novo de segurança** (reafirmação apenas do débito já
conhecido de `react-router`/`REFAT-01-03`, inalterado desde o Lote 9).
Nenhum dado pessoal exposto em `/dados/futebol/*`; toda fronteira de entrada
externa consumida por este lote (`/dados/futebol/clube/<slug>.json`,
`/dados/futebol/brasileirao.json`, `/dados/ingestao/status.json`,
`localStorage`) validada com Zod, sem correção heurística;
`dangerouslySetInnerHTML` ausente; nenhuma dependência de runtime nova. Os
3 achados do chapéu QA (QA-10-01/02/03) não têm implicação de segurança —
são cobertura de teste e literal de CSS/copy. O Lote 10 está liberado para a
checagem estrutural final do Validador e fechamento como `Validado (com
ressalvas)`.

---

## Lote 11 — Rivais, comparativo e simulação (T-07, T-08, T-09)

**Base específica**: `.md/QA-REPORT.md` (Lote 11, aprovado com ressalvas —
QA-11-01, nenhum de segurança), `.md/SDD.md` §7, `.md/GUARDRAILS.md`, código
real de `EscolherRivais.tsx`/`Comparativo.tsx`/`Simulacao.tsx`,
`app/armazenamento/cenario.ts`, `dominio/tipos/estado-local.ts`.

### 1. Dados sensíveis (SDD §7.4, GUARDRAILS §4)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum dado pessoal em `Cenario` (rivais/palpites) | `cenarioSchema` (`dominio/tipos/estado-local.ts`) relido: `versaoEsquema`, `escopo` (string `temporada:time:rivais-ordenados`, todos ids de configuração), `palpites` (`Record<idPartida, 'vitoria'\|'empate'\|'derrota'>`), `partidasTravadasVistas` (array de ids) — nenhum campo de identificação do torcedor, nenhum texto livre | Conforme |
| Nenhum dado pessoal em `Preferencias.rivais` | `preferenciasSchema.rivais`: `z.array(slugSchema).max(2)` — só slugs de clube da configuração pública (`clubes-2026.json`), nunca dado inserido livremente pelo usuário | Conforme |
| Nenhum dado sensível em mensagem de erro/texto de estado | "Não conseguimos carregar a lista de clubes."/"...o comparativo."/"...o calendário restante." — genéricos, sem stack trace nem detalhe de implementação | Conforme |

**Nenhum achado.**

### 2. Validação Zod na fronteira (SDD §7.4.1, Diretriz de Implementação #6)

| Verificação | Método | Resultado |
|---|---|---|
| `Cenario` lido de `localStorage` validado antes de uso | `lerCenario` (`app/armazenamento/cenario.ts`): `JSON.parse` em `try/catch` (descarta com `console.warn` em JSON inválido) → `cenarioSchema.safeParse` (descarta com `console.warn` em esquema incompatível) → checagem de escopo divergente descarta o objeto inteiro — nunca lança, nunca corrige heuristicamente um campo individual | Conforme |
| `Preferencias.timeId`/`rivais` lidos de `localStorage` validados antes de uso | `preferenciasSchema.safeParse` em `lerPreferenciasComparativo`/`lerTimeERivaisSalvos` (`Comparativo.tsx`/`Simulacao.tsx`) — falha de parse (JSON inválido ou esquema incompatível) retorna `{ timeId: null, rivais: [] }`, equivalente a "sem time/sem rivais", nunca um valor parcialmente confiado | Conforme |
| `/dados/futebol/brasileirao.json` validado antes de uso nas 3 telas | `useSnapshot(URL_FUTEBOL_BRASILEIRAO, 'futebol', brasileiraoPublicoSchema, ...)` — mesma fronteira já auditada (Lote 7/UI-DS-08, Lote 10) | Conforme |
| `/dados/ingestao/status.json` validado antes de uso (`Comparativo.tsx`) | `esquemaStatusPublico` (`z.object({ pausadoPorCota: z.boolean() }).passthrough()`), mesmo padrão já auditado | Conforme |

**Nenhum achado.**

### 3. `dangerouslySetInnerHTML` (SDD §7.4.2)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhuma ocorrência em `EscolherRivais.tsx`/`Comparativo.tsx`/`Simulacao.tsx`/CSS modules do Lote 11 | Busca por `dangerouslySetInnerHTML=\{` nos arquivos do lote | Nenhuma ocorrência — nome de clube/adversário/rodada é sempre interpolação de string em JSX |

**Nenhum achado.**

### 4. Isolamento de escopo de dado local (ADR-005, específico deste lote)

| Verificação | Método | Resultado |
|---|---|---|
| Cenário de um escopo (time+rivais) nunca vaza para outro escopo | `construirEscopoCenario(temporada, timeId, rivais)` — rivais ordenados antes de compor a chave, comparação de escopo salvo vs. atual descarta o cenário inteiro quando diverge (`lerCenario`); ao confirmar rivais em `EscolherRivais.tsx`, só chama `limparCenario` quando o escopo realmente muda | Conforme — nenhum caminho identificado em que um palpite gravado sob um conjunto de rivais seja lido/aplicado sob outro conjunto |

**Nenhum achado.**

### 5. Dependências de runtime (SDD §3, GUARDRAILS §2)

| Verificação | Método | Resultado |
|---|---|---|
| Nenhuma dependência de runtime nova introduzida pelo Lote 11 | `package.json` relido: `dependencies` inalteradas desde o Lote 7 | Conforme |
| `npm audit --omit=dev` | Executado por mim nesta rodada | **Mesmas 2 vulnerabilidades moderadas** em `react-router`/`react-router-dom` (open redirect via backslash, CVE-2025-68470 bypass; injeção de construtor via `deserializeErrors()`) — nenhuma nova, nenhuma alta/crítica. Nenhuma navegação nova deste lote usa entrada não sanitizada do usuário (`navegar('/simulacao')` é literal; `<Link to="/comparativo">` é literal) |

**Achado `SEC-11-01`** (reafirmação de débito já rastreado, não achado novo
de código): `REFAT-01-03` segue com prazo "antes de qualquer `/deploy` real"
(reajustado nos Lotes 6/8/9/10) — continua sem execução, mas o prazo não
venceu ainda (não houve `/deploy` real). Severidade **média**, mesma
classificação desde o Lote 1, não bloqueia esta aprovação.

### 6. Requisitos de segurança operacional para o chapéu DevOps (definidos aqui)

Nenhum requisito novo além dos já registrados nos Lotes 1/4/5/6. O Lote 11
não introduz endpoint novo nem superfície de rede além do contrato público
já auditado (`/dados/futebol/brasileirao.json`, `/dados/ingestao/status.json`,
Lote 6) — é consumo, não produção. Como este é o último lote de tela antes
do Lote 12 (SEC-01, "Sanitização e CSP na prática"), confirmo que nenhum
achado deste lote adiciona requisito além do já coberto pelo escopo de SEC-01
(CSP/`rel="noopener noreferrer"`/sanitização de feed) — T-07/T-08/T-09 não
renderizam conteúdo de terceiros nem abrem link externo.

## Achados por severidade — Lote 11

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum achado alto/crítico | — | — |
| Média | `SEC-11-01` (= `SEC-01-03`/`REFAT-01-03`) — débito já rastreado de `react-router`/`react-router-dom`, sem mudança neste lote | Bloqueia o próximo `/deploy` real (backstop já vigente desde `SEC-06-01`) — não bloqueia a aprovação deste lote | Prazo inalterado: antes de qualquer execução real do chapéu DevOps |
| — | Débitos de `idsProvedor` (`REFAT-02-01`), pinagem por SHA (`REFAT-01-02`) e layout 2 colunas (`REFAT-08-01`) — sem mudança neste lote | Não | Já rastreados, prazos inalterados |

Nenhum achado de segurança novo neste lote tem relevância estratégica de
negócio que exija decisão do Gestor — registrado aqui e em `TASK.md`,
sinalizado ao Gestor em paralelo apenas como fechamento de rotina do Gate 4.

## Veredito — Lote 11

**Aprovado, sem débito novo de segurança** (reafirmação apenas do débito já
conhecido de `react-router`/`REFAT-01-03`, inalterado desde o Lote 10).
Nenhum dado pessoal em `Cenario`/`Preferencias.rivais`; toda fronteira de
entrada externa consumida por este lote (`Cenario`/`Preferencias` de
`localStorage`, `/dados/futebol/brasileirao.json`,
`/dados/ingestao/status.json`) validada com Zod, sem correção heurística;
isolamento de escopo do cenário por time+rivais confirmado sem vazamento
entre escopos; `dangerouslySetInnerHTML` ausente; nenhuma dependência de
runtime nova. O achado do chapéu QA (QA-11-01) não tem implicação de
segurança — é lacuna de layout responsivo. O Lote 11 está liberado para a
checagem estrutural final do Validador e fechamento como `Validado (com
ressalvas)`.

---

## Refatoração Lote-1 — validação de fechamento de débito técnico (chapéu DevSecOps)

**Base específica**: achados `SEC-01-02` e `SEC-01-03`/`SEC-08-01` (Seção 2
acima) e as 3 tarefas `REFAT-01-01`/`REFAT-01-02`/`REFAT-01-03`
(`.md/TASK.md`, lote `Refatoração Lote-1`), todas `Concluída` e já aprovadas
funcionalmente pelo chapéu QA (ver `.md/QA-REPORT.md`, seção "Refatoração
Lote-1 — validação de fechamento de débito técnico").

### Fechamento de `SEC-01-02` — pinagem por SHA em `build-publish.yml`

Confirmei por leitura direta que as 5 ações de `build-publish.yml`
(`checkout`, `setup-node`, `configure-pages`, `upload-pages-artifact`,
`deploy-pages`) estão referenciadas por SHA de commit completo (40 hex),
cada uma com comentário `# vX.Y.Z`, e que `runs-on: ubuntu-24.04` substitui
`ubuntu-latest` nos dois jobs — igual ao padrão já usado em `ingestao.yml`.

Método de verificação dos 3 SHAs que a nota do Executor alegava ter
confirmado via API (não aceito por alegação — reexecutei eu mesmo, com
acesso de rede disponível neste ambiente):

```
GET https://api.github.com/repos/actions/configure-pages/git/refs/tags/v5.0.0
GET https://api.github.com/repos/actions/upload-pages-artifact/git/refs/tags/v3.0.1
GET https://api.github.com/repos/actions/deploy-pages/git/refs/tags/v4.0.5
```

| Ação | Tag oficial | SHA da tag (API) | SHA gravado em `build-publish.yml` | `object.type` |
|---|---|---|---|---|
| `actions/configure-pages` | `v5.0.0` | `983d7736d9b0ae728b81ab479565c72886d7745b` | `983d7736d9b0ae728b81ab479565c72886d7745b` | `commit` (tag leve, sem indireção) |
| `actions/upload-pages-artifact` | `v3.0.1` | `56afc609e74202658d3ffba0e8f6dda462b719fa` | `56afc609e74202658d3ffba0e8f6dda462b719fa` | `commit` |
| `actions/deploy-pages` | `v4.0.5` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` | `commit` |

Os 3 SHAs batem exatamente com a tag oficial reivindicada, e cada tag aponta
direto para um objeto `commit` (não uma tag anotada intermediária) — mesmo
padrão de imutabilidade forte já usado por `checkout`/`setup-node` em ambos
os workflows. `runs-on: ubuntu-24.04` idêntico entre os dois arquivos.

**`SEC-01-02` fechado — confirmado, não é mais débito em aberto.**

### Fechamento de `SEC-01-03`/`SEC-08-01` — `react-router-dom@7.18.3`

`npm audit --omit=dev` (executado por mim nesta rodada, do zero): **0
vulnerabilidades** — as 2 CVEs moderadas de `react-router`/`react-router-dom`
que sustentavam este achado desde o Lote 1 não aparecem mais.

Avaliação de superfície nova (chapéu DevSecOps, não é só rodar o audit):
`react-router-dom` é biblioteca de roteamento client-side, sem servidor
próprio nem SSR neste projeto (ADR-001, SPA estática servida por GitHub
Pages) — os dois CVEs originais tinham vetor de SSR/data-loader server-side,
já não aplicável a este projeto mesmo antes do upgrade (registrado assim na
auditoria original do Lote 1). A v7 não introduz nenhum novo endpoint, novo
armazenamento ou novo dado sensível manuseado pela lib: o projeto continua
usando só a API declarativa (`BrowserRouter`/`HashRouter`/`Routes`/`Route`/
`Link`), confirmada sem alteração de comportamento pelos testes de
`app/rotas/` (232/232, chapéu QA). Nenhuma nova permissão de rede, nenhum
novo acesso a `localStorage`/cookies foi adicionado pela major. Não há
`loader`/`action`/modo data de servidor (recursos novos da v6.4+/v7 com
maior superfície) em uso em nenhuma rota deste projeto.

**`SEC-01-03`/`SEC-08-01` fechados — confirmado, não é mais débito em
aberto.** O backstop que bloqueava o próximo `/deploy` real em produção
(vigente desde `SEC-06-01`, Lote 6) está removido.

### Requisitos de segurança operacional para o chapéu DevOps — atualização

O requisito operacional #3 da Seção 6 ("antes do primeiro deploy real,
migrar as ações de `build-publish.yml` para SHA pinning") está **cumprido**.
Nenhum requisito operacional novo surge deste fechamento — os já registrados
nas Seções 6 dos Lotes 1/6 continuam válidos (cadastro do secret, escopo
mínimo de `permissions`, ausência de superfície de rede adicional no
GitHub Pages).

### Achados por severidade — Refatoração Lote-1

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | `SEC-01-02` (pinagem por SHA) | Não — fechado | Nenhuma; achado encerrado |
| — | `SEC-01-03`/`SEC-08-01` (`react-router` CVE moderado) | Não — fechado | Nenhuma; achado encerrado |

Nenhum achado novo de severidade alta/crítica encontrado nesta rodada. Nada
com relevância estratégica de negócio a sinalizar ao Gestor além do fato de
que o backstop de deploy foi removido — registrado aqui e em `TASK.md` como
fechamento de rotina do Gate 4.

**Veredito**: **Aprovado, sem débito de segurança em aberto**. Os dois
achados que vinham sendo reafirmados como débito desde o Lote 1
(`SEC-01-02`/`SEC-06-01` e `SEC-01-03`/`SEC-08-01`/`SEC-09-01`/`SEC-10-01`/
`SEC-11-01`) estão fechados de fato, confirmados por verificação direta
(API do GitHub para os SHAs; `npm audit` + leitura de código para a lib de
roteamento), não pela nota do Executor. `Refatoração Lote-1` liberada para a
checagem estrutural final do Validador.

---

## Refatoração Lote-6 — validação de fechamento de débito técnico (chapéu DevSecOps)

**Base específica**: tarefa `REFAT-06-01` (`.md/TASK.md`, lote `Refatoração
Lote-6`), `Concluída` e já aprovada funcionalmente pelo chapéu QA (ver
`.md/QA-REPORT.md`, seção "Refatoração Lote-6 — validação de fechamento de
débito técnico").

### `tsx` como devDependency — não introduz vulnerabilidade de runtime

Executei os dois comandos, deixando claro qual é o gate que importa:

- `npm audit --omit=dev --audit-level=high` (gate real de CI, o único que
  bloqueia o job): **0 vulnerabilidades**. `tsx` nunca entra nesta árvore
  porque é devDependency, e o SDD §3 só fecha a lista de dependências de
  *runtime* — decisão já registrada corretamente pelo Executor no cabeçalho
  de `pipeline/ingestao-cli.ts`.
- `npm audit` (árvore completa, sem `--omit=dev`, só para visibilidade): **7
  vulnerabilidades (2 low, 3 moderate, 1 high, 1 critical)**, todas na cadeia
  `@eslint/plugin-kit` (RegExp DoS, via `eslint@9.10.0-9.26.0`) e
  `esbuild`/`vite`/`vitest`/`vite-node`/`@vitest/mocker` (esbuild dev-server
  request forgery) — nenhuma delas tem `tsx` na cadeia de dependência
  (confirmado lendo a árvore de `npm audit` linha a linha: `tsx` não aparece
  em nenhum `node_modules/.../tsx` das entradas listadas). São
  devDependencies pré-existentes do projeto (eslint/vite/vitest, usados
  desde o Lote 1), não introduzidas por esta tarefa. Registro como nota de
  observação, não como achado novo desta tarefa: como são devDependencies
  puras (eslint só roda em CI/dev, vite/vitest não fazem parte do bundle de
  produção do ADR-001), ficam fora do gate `--omit=dev --audit-level=high`
  que efetivamente bloqueia o deploy — mesma lógica já usada para
  `vitest-axe`/`axe-core` no Lote 7. Não abro tarefa de correção agora
  (exigiria `npm audit fix --force`, breaking change de major em
  eslint/vite/vitest, fora do escopo desta tarefa pontual de wiring);
  sinalizo como observação para o Coordenador considerar numa atualização de
  dependências de desenvolvimento dedicada, sem prazo bloqueante (não é
  requisito de segurança operacional deste lote, é debt de manutenção geral
  do projeto).

### Nenhum vazamento do segredo `FOOTBALL_DATA_API_TOKEN`

Confirmado por leitura direta de código, não por alegação da nota do
Executor:

- `pipeline/futebol/orquestrador.ts:555` — `process.env['FOOTBALL_DATA_API_TOKEN']`
  é o único ponto de leitura do token em todo o `pipeline/`; a mensagem de
  erro lançada quando ausente (linha 558) é uma string estática
  ("FOOTBALL_DATA_API_TOKEN não definido — segredo do provedor deve vir da
  [...]"), nunca interpola o valor da variável.
- `pipeline/ingestao-cli.ts` nunca importa nem referencia
  `FOOTBALL_DATA_API_TOKEN` diretamente — só chama
  `executarIngestaoFutebolEmDisco()` (que resolve o token internamente) e
  propaga o resultado/erro. `formatarResumo` monta a string de log só a
  partir de contagens (`itensPublicaveis.length`, competições
  atualizada/total, `pausadoPorCota`, arquivos gerados) — nenhum campo do
  resumo carrega o token nem qualquer payload bruto de resposta do
  provedor. `main()` imprime `erro.stack ?? erro.message` em caso de falha;
  a mensagem de erro de token ausente (linha acima) já não contém o valor
  em nenhum caso (o valor simplesmente não existe quando o erro é lançado).
  Não há caminho de código em que um valor real de token chegue a
  `console.log`/`console.error` deste módulo.
- Em `.github/workflows/ingestao.yml`, o secret só existe como variável de
  ambiente do job (`env: FOOTBALL_DATA_API_TOKEN: ${{ secrets.[...] }}`),
  nunca ecoado (`echo`) — o GitHub Actions mascara automaticamente qualquer
  ocorrência do valor nos logs a partir da referência ao secret; a checagem
  do `elif` usa `${FOOTBALL_DATA_API_TOKEN:-}` só para testar
  presença/ausência, sem nunca imprimir o conteúdo.

**Nenhum achado de exposição de segredo.**

### Requisitos de segurança operacional para o chapéu DevOps — sem mudança

Nenhum requisito operacional novo surge desta tarefa. O cadastro do secret
`FOOTBALL_DATA_API_TOKEN` no cofre do repositório (já listado nas Seções 6
dos Lotes 1/6) continua sendo a única ação pendente antes de o ramo (c) do
step "Executa pipeline de ingestão" rodar contra a rede real — ação
operacional fora do escopo de qualquer agente.

### Achados por severidade — Refatoração Lote-6

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | 7 vulnerabilidades pré-existentes em devDependencies (eslint/vite/vitest, não introduzidas por `tsx`) | Não — fora do gate `--omit=dev` | Observação sinalizada ao Coordenador, sem prazo bloqueante |

Nenhum achado novo de severidade alta/crítica. Nenhum vazamento de segredo.
Nada com relevância estratégica de negócio a sinalizar ao Gestor além do
registro de rotina do Gate 4.

**Veredito**: **Aprovado, sem débito de segurança bloqueante**. `tsx` não
introduz vulnerabilidade de runtime (gate real `--omit=dev
--audit-level=high` limpo); token do provedor confirmado nunca logado, em
nenhum ponto de `pipeline/ingestao-cli.ts`/`orquestrador.ts`/
`ingestao.yml`; `Refatoração Lote-6` liberada para a checagem estrutural
final do Validador.

---

## Refatoração Lote-7 — validação de fechamento de débito técnico (chapéu DevSecOps)

**Base específica**: tarefa `REFAT-07-01` (`.md/TASK.md`, lote `Refatoração
Lote-7`), `Concluída` e já aprovada funcionalmente pelo chapéu QA (ver
`.md/QA-REPORT.md`, seção "Refatoração Lote-7 — validação de fechamento de
débito técnico").

### Nenhuma superfície de segurança nova

`REFAT-07-01` é uma mudança puramente de CSS/tokens: substituição de 5
literais de cor/tamanho por `var(...)` e troca de um reuso de token de
z-index (`--z-pular-conteudo` → `--z-modal`, novo) em 5 arquivos
`.module.css` de `app/design-system/`, mais 4 declarações novas em
`tokens.css`. Confirmado por leitura direta do diff funcional (não pela nota
do Executor):

- Nenhuma dependência de runtime nova (`package.json` não muda).
- Nenhum código JS/TS tocado — só arquivos `.css`.
- Nenhuma entrada externa, `fetch`, `localStorage`, log ou payload de API
  envolvidos — não há superfície de exposição de dado sensível a checar
  (`sensitive-data-exposure-check` não se aplica a esta tarefa).
- Nenhuma mudança de autenticação/autorização/isolamento multi-tenant
  (não aplicável ao design system).
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilidades** (mesmo
  estado já registrado desde `Refatoração Lote-1`, sem regressão).

**Nenhum achado esperado, nenhum achado encontrado.**

### Requisitos de segurança operacional para o chapéu DevOps — sem mudança

Nenhum requisito operacional novo surge desta tarefa.

### Achados por severidade — REFAT-07-01

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum | — | — |

Nenhum achado novo de qualquer severidade. Nenhum vazamento de segredo/dado
pessoal. Nada com relevância estratégica de negócio a sinalizar ao Gestor
além do registro de rotina do Gate 4. O achado `QA-7-03` (débito de higiene
de token em outros arquivos, `REFAT-07-02`) é puramente de CSS/tokens, sem
implicação de segurança — mesma avaliação desta seção se aplicaria.

**Veredito (parcial, só `REFAT-07-01`)**: **Aprovado, sem débito de
segurança**. Mudança confirmada como puramente de CSS/tokens, sem
superfície de segurança nova. O veredito de fechamento do lote inteiro
(`REFAT-07-01` + `REFAT-07-02`) está na subseção abaixo, após a validação
específica de `REFAT-07-02`.

### Fechamento de `REFAT-07-02` — validação de segurança específica

**Base específica**: tarefa `REFAT-07-02` (`.md/TASK.md`, lote `Refatoração
Lote-7`), `Concluída` e já aprovada funcionalmente pelo chapéu QA com
ressalvas (ver `.md/QA-REPORT.md`, seção "Refatoração Lote-7 — validação de
fechamento de débito técnico", subseção "Fechamento de `REFAT-07-02`",
incluindo o achado simples `QA-7-04` fora do escopo desta tarefa).

`REFAT-07-02` consolida `--borda-fina`/`--borda-media`/`--esp-1`/`--esp-2`
(4 tokens já existentes em `tokens.css`, nenhum token novo) em 12 arquivos
`.module.css` de `app/design-system/`, trocando literais de espessura de
borda/box-shadow por `var(...)` — mesma categoria mecânica de
`REFAT-07-01`, sem mudança de lógica JS/TS. Confirmado por leitura direta
do estado atual dos arquivos (não pela nota do Executor nem só pelo
`QA-REPORT.md`):

- **Nenhuma superfície nova de XSS/CSP**: `grep -r dangerouslySetInnerHTML`
  em `app/design-system/` encontra 1 ocorrência, mas é um comentário em
  `BlocoPreto.tsx:31` documentando a Diretriz de Implementação #5 (nunca
  usar essa API) — não é uso real, e o arquivo não é um dos 12
  `.module.css` tocados por `REFAT-07-02` (a tarefa não editou nenhum
  `.tsx`). `grep -r 'style={'` em `app/design-system/` encontra 5
  componentes (`TabelaClassificacao.tsx`, `FaixaClube.tsx`,
  `CartaoIngresso.tsx`, `AvatarClube.tsx`, `BarraPontuacao.tsx`) usando
  `style={estiloInline}` para injetar variáveis CSS — padrão pré-existente
  e fora do escopo desta tarefa (`REFAT-07-02` só tocou `.module.css`, não
  os `.tsx` correspondentes), já coberto pelo vetor de XSS/CSP auditado em
  `SEC-01`. Nenhuma interpolação de dado externo em `style` foi introduzida
  por esta tarefa.
- `grep -nE '(border[a-zA-Z-]*|box-shadow|outline)[^;]*\b\d+px\b'` em
  `app/design-system/**/*.module.css`: **0 ocorrências** — confirma, por
  leitura direta e independente, o mesmo resultado já reportado pelo QA
  (13 pontos catalogados agora usam `var(...)`, exceção sr-only
  preservada).
- Nenhuma dependência de runtime nova (`package.json` não muda) — mesma
  observação de `REFAT-07-01`.
- Nenhuma entrada externa, `fetch`, `localStorage`, log ou payload de API
  envolvidos — `sensitive-data-exposure-check` não se aplica, mesma
  avaliação de `REFAT-07-01`.
- Nenhuma mudança de autenticação/autorização/isolamento multi-tenant.
- **Segredos**: `grep -i` por `password|secret|apikey|api_key|token=|BEGIN
  RSA/PRIVATE|AKIA...` nos 12 arquivos `.module.css` do escopo: **nenhuma
  ocorrência** — confere por disciplina de rotina, como esperado para CSS
  puro de tokens de design.
- `npm audit --omit=dev --audit-level=high`, rodado do zero por mim: **0
  vulnerabilidades**.

**Nenhum achado de segurança nesta tarefa.** O achado `QA-7-04`
(`Navegacao.module.css:77`, `border-bottom: 2px` literal fora do escopo
nomeado de `REFAT-07-02`) é da mesma categoria puramente de CSS/tokens — se
uma futura `REFAT-07-03` cobrir esse ponto, a mesma avaliação de ausência
de superfície de segurança nova se aplica; não há necessidade de nova
auditoria de segurança dedicada só para essa substituição mecânica.

### Requisitos de segurança operacional para o chapéu DevOps — sem mudança (REFAT-07-02)

Nenhum requisito operacional novo surge desta tarefa.

### Achados por severidade — REFAT-07-02

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum | — | — |

Nenhum achado novo de qualquer severidade. Nenhum vazamento de
segredo/dado pessoal. Nada com relevância estratégica de negócio a
sinalizar ao Gestor além do registro de rotina do Gate 4.

**Veredito (lote completo, `REFAT-07-01` + `REFAT-07-02`)**: **Aprovado,
sem débito de segurança**. As duas tarefas confirmadas, por leitura direta
independente da nota do Executor e do `QA-REPORT.md`, como mudança
puramente de CSS/tokens em 18 pontos do design system — nenhuma
dependência nova, nenhuma superfície de XSS/CSP nova, nenhum segredo
exposto, `npm audit` limpo em ambas as verificações. `Refatoração Lote-7`
(REFAT-07-01 + REFAT-07-02) liberada para a checagem estrutural final do
Validador e, em conjunto com a aprovação funcional do QA já registrada,
apta para o chapéu DevOps prosseguir com deploy.

> Atualização: o veredito acima cobria só `REFAT-07-01` + `REFAT-07-02`. A
> subseção abaixo fecha `REFAT-07-03` (achado `QA-7-04`) e substitui este
> veredito parcial pelo veredito consolidado do lote completo (3 tarefas), ao
> final desta seção.

### Fechamento de `REFAT-07-03` — validação de segurança específica

**Base específica**: tarefa `REFAT-07-03` (`.md/TASK.md`, lote `Refatoração
Lote-7`), `Concluída` e já aprovada funcionalmente pelo chapéu QA sem
ressalvas (ver `.md/QA-REPORT.md`, seção "Refatoração Lote-7 — validação de
fechamento de débito técnico", subseção "Fechamento de `REFAT-07-03`").

`REFAT-07-03` resolve o achado `QA-7-04`: em
`app/rotas/Navegacao/Navegacao.module.css`, a regra `.itemNav` trocou
`border-bottom: 2px solid transparent` por
`border-bottom: var(--borda-media) solid transparent` — 1 token já existente
em `tokens.css` (o mesmo `--borda-media` já usado por `REFAT-07-01`/
`REFAT-07-02` em outros arquivos), nenhum token novo. Confirmado por leitura
direta do diff real (não pela nota do Executor nem só pelo `QA-REPORT.md`):

- `git diff --stat -- app/rotas/Navegacao/Navegacao.module.css`: **1 file
  changed, 1 insertion(+), 1 deletion(-)** — confirma, por evidência
  independente, que a mudança é exatamente a 1 linha descrita, sem nenhuma
  superfície nova (nenhum outro arquivo `.tsx`/`.ts`/`.css` tocado por esta
  tarefa).
- Nenhuma dependência de runtime nova: `git diff --stat -- package.json
  package-lock.json` **sem saída** (nenhuma mudança) — mesma observação de
  `REFAT-07-01`/`REFAT-07-02`.
- Nenhum código JS/TS tocado — só o arquivo `.css` acima, e só a propriedade
  `border-bottom`. `Navegacao.tsx` (componente que consome esta classe) não
  foi tocado por esta tarefa.
- Nenhuma entrada externa, `fetch`, `localStorage`, log ou payload de API
  envolvidos — `sensitive-data-exposure-check` não se aplica, mesma
  avaliação das duas tarefas anteriores do lote.
- Nenhuma mudança de autenticação/autorização/isolamento multi-tenant.
- **Segredos**: `grep -inE
  'password|secret|apikey|api_key|token=|BEGIN RSA|BEGIN PRIVATE|AKIA'` em
  `app/rotas/Navegacao/Navegacao.module.css`: **nenhuma ocorrência**.
- `npm audit --omit=dev --audit-level=high`, rodado do zero por mim: **0
  vulnerabilidades** — mesmo estado já registrado desde `Refatoração
  Lote-1`, sem regressão.

**Nenhum achado de segurança nesta tarefa.** Escopo mínimo e classe de
mudança idêntica às duas tarefas anteriores do lote (literal → token em
CSS), sem introduzir superfície nova de qualquer tipo.

### Requisitos de segurança operacional para o chapéu DevOps — sem mudança (REFAT-07-03)

Nenhum requisito operacional novo surge desta tarefa.

### Achados por severidade — REFAT-07-03

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum | — | — |

Nenhum achado novo de qualquer severidade. Nenhum vazamento de
segredo/dado pessoal. Nada com relevância estratégica de negócio a
sinalizar ao Gestor além do registro de rotina do Gate 4.

### Veredito consolidado — `Refatoração Lote-7` completo (`REFAT-07-01` + `REFAT-07-02` + `REFAT-07-03`)

**Aprovado (sem achado)**. As três tarefas, auditadas individualmente por
leitura direta do diff real de cada uma (nunca pela nota do Executor), são
todas da mesma classe: substituição mecânica de literal de
cor/tamanho/espessura por `var(...)` já existente em `tokens.css`, em CSS
Modules puro — sem código JS/TS tocado (exceto a troca de token de z-index
em `REFAT-07-01`, também sem implicação de segurança), sem dependência de
runtime nova em nenhuma das três (`package.json`/`package-lock.json`
inalterados do início ao fim do lote), sem superfície nova de
autenticação/autorização/multi-tenant/XSS/CSP/exposição de dado sensível, e
sem segredo introduzido em nenhum dos arquivos tocados. `npm audit
--omit=dev --audit-level=high` retornou **0 vulnerabilidades** nas três
verificações independentes (uma por tarefa), sem regressão em relação ao
estado registrado desde `Refatoração Lote-1`. Nenhum achado de nenhuma
severidade nas 3 tarefas — não há débito de segurança a registrar.
`Refatoração Lote-7` (as 3 tarefas) libera para o fechamento estrutural
final do Validador e, em conjunto com a aprovação funcional do QA sem
ressalvas já registrada (`.md/QA-REPORT.md`), está apta para o chapéu DevOps
prosseguir com deploy.

---

## Refatoração Lote-8 — validação de fechamento de débito técnico (chapéu DevSecOps)

**Base específica**: tarefa `REFAT-08-01` (`.md/TASK.md`, lote `Refatoração
Lote-8`), `Concluída` e já aprovada funcionalmente pelo chapéu QA (ver
`.md/QA-REPORT.md`, seção "Refatoração Lote-8 — validação de fechamento de
débito técnico").

### Nenhuma superfície de segurança nova

`REFAT-08-01` reabre `Home.tsx`/`Home.module.css` só para trocar o container
de layout (grade CSS de 2 colunas em desktop) e adicionar 2 tokens de
largura em `tokens.css`. Confirmado por leitura direta do diff funcional
(não pela nota do Executor):

- Nenhuma dependência de runtime nova (`package.json` não muda).
- Nenhuma prop, estado, fetch ou leitura de `localStorage` nova — as 3
  seções (`SecaoIdentidade`/`SecaoSeusEsportes`/`SecaoUltimasNoticias`)
  continuam recebendo exatamente as mesmas props de antes, só reagrupadas
  num `<div>` adicional sem atributo de acessibilidade/semântica novo.
- Nenhuma entrada externa nova, nenhum log, nenhum payload de API tocado —
  não há superfície de exposição de dado sensível a checar
  (`sensitive-data-exposure-check` não se aplica a esta tarefa).
- Nenhuma mudança de autenticação/autorização/isolamento multi-tenant (não
  aplicável a este projeto/tarefa).
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilidades**
  (confirmado nesta rodada, sem regressão).

**Nenhum achado esperado, nenhum achado encontrado.**

### Requisitos de segurança operacional para o chapéu DevOps — sem mudança

Nenhum requisito operacional novo surge desta tarefa.

### Achados por severidade — Refatoração Lote-8

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum | — | — |

Nenhum achado novo de qualquer severidade. Nenhum vazamento de segredo/dado
pessoal. Nada com relevância estratégica de negócio a sinalizar ao Gestor
além do registro de rotina do Gate 4. O débito de `SEC-08-01`
(`REFAT-01-03`, vulnerabilidades moderadas de `react-router`, backstop do
próximo `/deploy` real) permanece em aberto, inalterado por esta tarefa —
mudança puramente de CSS/estrutura de container, sem relação com a
dependência afetada.

**Veredito**: **Aprovado, sem débito novo**. Mudança confirmada como
puramente de CSS/estrutura de container, sem superfície de segurança nova;
`Refatoração Lote-8` liberada para a checagem estrutural final do
Validador.

---

## Lote 13 — Spikes técnicos

Auditoria bem leve, como esperado para um lote de investigação sem mudança
de código de produção: o chapéu QA já confirmou que nenhum código foi
alterado, e a auditoria do chapéu DevSecOps aqui é sobretudo confirmação
dessa ausência de superfície nova, não uma varredura de vulnerabilidade em
código novo (não há código novo).

**Foco específico em SPK-03** (única tarefa que toca configuração
sensível — o catálogo de fontes que alimenta ingestão de conteúdo de
terceiro): `config/fontes.json` confirmado byte a byte como intocado (5
fontes fixas, GE e UOL com `verificacao.estado: "pendente"`, nenhuma URL de
Folha/Placar adicionada); `config/fontes.test.ts` roda limpo, sem qualquer
ajuste (`vitest run config/fontes.test.ts` incluído na suíte completa
abaixo). Nenhuma configuração inconsistente deixada por trás. Nenhum
segredo, token ou dado sensível referenciado ou exposto por nenhuma das 5
tarefas (nenhuma delas toca `.env`/CI/pipeline de deploy).

**SPK-04**: confirmado por leitura de `app/telemetria/` que nenhuma
dependência de runtime nova foi introduzida e nenhum host de terceiro foi
adicionado a `connect-src` (`app/index.html` continua com o placeholder
comentado do ADR-011/TEL-01) — a avaliação de ferramentas foi só
documental, sem integração de fato.

**Portões**: `tsc --noEmit`, `eslint .` e `vitest run` (97 arquivos/1099
testes) confirmados limpos, idênticos ao estado anterior às 5 tarefas.
`npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades (mesmo
resultado dos lotes anteriores — nenhuma dependência nova entrou).

**Requisitos de segurança operacional para o chapéu DevOps**: nenhum novo
neste lote — SPK-04 não resultou em nenhuma ferramenta de telemetria
efetivamente plugada (decisão de ADR pendente no Coordenador), então não há
novo secret/host/configuração de rede a provisionar ainda.

Nenhum achado de segurança de qualquer severidade neste lote — é o esperado
para um lote de investigação. O achado sobre os termos do Placar (SPK-03)
não é, em si, um achado de segurança técnica (não é vulnerabilidade nem
exposição de dado) — é um achado de conformidade/termos de uso relevante
para uma decisão de negócio já em aberto (P-GE/ADR-013), por isso registrado
no `QA-REPORT.md` e em `BLOCKERS.md`, não como entrada nova neste relatório.

**Veredito**: **Aprovado, sem achado, sem débito novo**.

---

## Confirmação final pré-deploy — primeira publicação (chapéu DevSecOps)

**Escopo**: mesmo conjunto de lotes da confirmação equivalente em
`.md/QA-REPORT.md` (todos os `Validado`/`Validado (com ressalvas)`; excluídos
Lote 12, `REFAT-02-01`, `REFAT-07-02`). Auditoria feita **depois** da
confirmação funcional do chapéu QA sobre o mesmo conjunto (mesma seção,
mesma data), conforme a regra de sincronização QA→DevSecOps.

**Regressão de segurança confirmada do zero**:

- `npm audit --omit=dev --audit-level=high` → **0 vulnerabilidades**. As 2
  vulnerabilidades moderadas de `react-router` (débito `SEC-08-01`/
  `SEC-09-01`/`SEC-10-01`/`SEC-11-01`, `REFAT-01-03`) seguem fechadas desde
  Refatoração Lote-1 — nenhuma reabertura, nenhuma vulnerabilidade nova
  introduzida por nenhum lote publicado.
- Verificação de segredo: não há novo artefato de produção neste ponto de
  corte além do que os Lotes 1/6 já auditaram (`npm run verificar-segredos`/
  `:dados`, cobertos por `tests/verificar-segredos.test.ts`, 13 casos, todos
  passando na suíte completa). Nenhum segredo (`FOOTBALL_DATA_API_TOKEN` ou
  qualquer outro) aparece em código, log ou artefato de build — confirmado por
  leitura de `pipeline/futebol/orquestrador.ts`/`pipeline/ingestao-cli.ts` e
  pela suíte completa.
- Isolamento `dominio/`↔`pipeline/`↔`app/` mantido: `tests/dominio-purity.eslint.test.ts`
  (7 casos) e a checagem de que `pipeline/` nunca é importado por `app/`
  (direção de dependência documentada em `app/dados/configPublico.ts`/
  `app/dados/futebol.ts`) confirmadas pela suíte completa e por leitura de
  código nos dois arquivos citados.
- Nenhum dado pessoal novo introduzido no contrato público — mesmo escopo já
  auditado lote a lote (`/dados/*` são só dados públicos de competição/clube/
  notícia; `sportslm.anonimo.v1`/`Preferencias`/`Cenario` continuam locais,
  nunca publicados).

**Checagem de integração entre lotes (achado de hardening, não bloqueante)**:
a validação cruzada de schema feita pelo chapéu QA nesta mesma rodada (ver
`.md/QA-REPORT.md`, mesma seção) é também uma confirmação de segurança
relevante — schemas duplicados manualmente entre `pipeline/publicacao/
gerador-snapshots.ts` e `app/dados/{futebol,configPublico}.ts` sem trava
automática de sincronia são, em tese, uma superfície onde um schema
desatualizado no lado da SPA poderia aceitar (ou rejeitar incorretamente) um
payload que já não corresponde ao que o pipeline publica — não uma
vulnerabilidade de injeção/exposição, mas um risco de robustez do parse na
fronteira de entrada externa (mesma fronteira que já é validada com Zod,
GUARDRAILS.md §4). A verificação manual confirmou que hoje os dois lados
estão sincronizados — sem achado real, registrado aqui só como reforço da
recomendação já anotada pelo chapéu QA (estender o teste cruzado automatizado).
Não bloqueia.

**Requisitos de segurança operacional para o chapéu DevOps** (confirmados,
sem mudança em relação ao que já está em `.md/DEPLOY.md`): gestão de
`FOOTBALL_DATA_API_TOKEN` como secret do GitHub Actions (nunca em código),
ações de terceiro pinadas por SHA nos dois workflows, permissões mínimas por
job (`contents: read`/`pages: write`/`id-token: write` em `build-publish.yml`;
`contents: write` isolado em `ingestao.yml`) — todos já confirmados em
`.md/DEPLOY.md` §1.

**Nenhum achado de severidade alta/crítica. Nenhum compliance obrigatório em
aberto** (LGPD/RNF-07: dado anônimo, sem PII, telemetria opt-in por interruptor
de build, mecanismo de "ver quais eventos"/"desativar e apagar id" confirmado
nos Lotes 9-11 — sem mudança neste ponto de corte, TEL-01 real ainda não
publicado, é Lote 12).

**Veredito**: **Aprovado (com débito já registrado, nenhum novo)** —
libera o build para deploy do lado de segurança, completando a dupla
aprovação (QA + DevSecOps) exigida antes do `/deploy` real. Débito de
severidade baixa/média em aberto nesta publicação: nenhum bloqueante — as
únicas pendências (`REFAT-02-01`, `REFAT-07-02`) já estão fora do escopo
desta publicação por decisão prévia, não por achado novo deste chapéu.

---

## Refatoração Lote-2 — validação de fechamento de débito técnico (chapéu DevSecOps)

**Base específica**: débito `REFAT-02-01` (`idsProvedor.football-data` com
`SENTINELA_ID_PENDENTE` em 19/20 clubes, achado original de dado/configuração
sem implicação de segurança — ver linhas 188-213 acima, Lote 2), rastreado
desde então em todo lote intermediário (linhas 466, 607, 795, 881, 963, 1059)
e explicitamente excluído da "Confirmação final pré-deploy" (linha 1424) por
estar pendente naquele ponto de corte. Fechado via `Bloqueio 009`/`Bloqueio
010` (`.md/BLOCKERS.md`) e aprovado funcionalmente pelo chapéu QA em
`.md/QA-REPORT.md`, seção "Refatoração Lote-2 — validação de fechamento"
(2026-09-07, veredito **Aprovado**). Auditoria feita **depois** dessa
aprovação funcional, conforme a regra de sincronização QA→DevSecOps — não
aceito a nota de fechamento do QA nem a nota do orquestrador como prova de
segurança; recolho evidência própria abaixo.

### 1. Varredura de segredo (foco 1 do escopo desta auditoria)

- Li `config/clubes-2026.json` por inteiro (20 entradas): cada `idsProvedor`
  contém só `{ "football-data": <número inteiro> }` — nenhuma string, nenhum
  campo de credencial, nenhum header/URL de autenticação. Dado público de
  identidade de clube (id do provedor, nome, sigla, cor), o mesmo tipo de dado
  que qualquer resposta pública da API do football-data.org já expõe.
- Li `config/campeonatos-2026.json` por inteiro: só ids de clube (strings-slug
  já existentes no domínio) e texto de observação — nenhum segredo.
- Li `Bloqueio 009` e `Bloqueio 010` (`.md/BLOCKERS.md`) por inteiro,
  incluindo as transcrições/descrições do log do GitHub Actions usadas para
  capturar o mapeamento id↔nome: grep por `FOOTBALL_DATA_API_TOKEN`,
  `X-Auth-Token`, `Bearer`, `api_key`/`apikey` e por padrão de token
  alfanumérico longo (15+ caracteres) dentro do arquivo inteiro — as únicas
  ocorrências de `FOOTBALL_DATA_API_TOKEN` são texto descritivo ("token nunca
  deve aparecer em log", "sem acesso ao `FOOTBALL_DATA_API_TOKEN`"), nunca o
  valor do token; as ocorrências de `api_key`/`Bearer` no arquivo pertencem a
  outras entradas de bloqueio (evolução do próprio verificador de segredos,
  linhas 274-471), não a esta tarefa. Nenhum valor de segredo real ou
  verossímil em nenhuma das duas entradas.
- Confirmei por leitura de `pipeline/futebol/orquestrador.ts`/
  `pipeline/ingestao-cli.ts` (trecho tocado pelo Bloqueio 009, que criou o
  `console.warn` de diagnóstico usado para obter o mapeamento) que o log de
  clube não mapeado emite só `idProvedor`/`nome` — nenhuma variável de
  ambiente nem referência a `process.env` no trecho de log. Mesma conclusão já
  registrada pelo próprio executor no Bloqueio 009 e reconfirmada aqui por
  mim, não aceita por alegação.
- `diff` entre `config/clubes-2026.json` e o snapshot publicado
  `app/public/dados/config/clubes-2026.json`: a única diferença é o bloco
  `paleta` derivado (PUB-01/ADR-017), já existente no fluxo de publicação
  normal — nenhum campo novo, nenhum segredo introduzido pela publicação.
- Inspecionei os 5 novos arquivos publicados por clube em
  `app/public/dados/futebol/clube/` (`athletico-pr.json`, `coritiba.json`,
  `rb-bragantino.json`, `remo.json`, `chapecoense.json`): mesmo formato dos
  demais 15, só dado de competição público.

### 2. `npm audit` (foco 2)

`npm audit --omit=dev --audit-level=high` (executado por mim, do zero, no
estado atual do repositório, após o merge de `REFAT-02-01`): **0
vulnerabilidades**. Sem regressão em relação à Confirmação final pré-deploy.

### 3. Conformidade com SDD.md §7 (foco 3) — premissa de "sem superfície nova" confirmada, não assumida

- Li `.md/SDD.md` §7 (Requisitos de Segurança) por inteiro. A mudança se
  encaixa em §7.4 ("Validação de entrada e conteúdo de terceiros"): embora
  `config/clubes-2026.json` seja config estática versionada (não uma resposta
  de rede em tempo real), ela é consumida pelo mesmo schema Zod estrito que já
  valida qualquer alteração no arquivo — confirmado por leitura de
  `pipeline/config/clubes.ts`: `EsquemaClubeBase` é `.strict()` (rejeita campo
  desconhecido), `id` restrito a slug (`^[a-z0-9]+(-[a-z0-9]+)*$`), `sigla`
  restrita a 3 letras maiúsculas, `corBase` restrita a hex `#RRGGBB`,
  `idsProvedor` é um `record<string, string|number>` não vazio. Os 5 clubes
  novos e os 15 ids atualizados passam por essa mesma validação — não há
  campo novo, tipo novo ou relaxamento de schema introduzido por
  `REFAT-02-01`.
- `idsProvedor.football-data` é usado só como chave de correlação para casar
  a resposta do provedor com o clube local (`obterClubePorId`,
  `traduzirClassificacao`/`traduzirPartidas`) — nunca interpolado em URL,
  comando de shell ou query; não é vetor de injeção. Confirmado por leitura de
  `pipeline/config/clubes.ts` (só comparação de valor) — nenhum uso de
  `idsProvedor` em concatenação de string encontrado no restante do
  repositório (grep).
- §7.1 (Superfície de ataque) permanece correta sem alteração: a mudança não
  cria banco de dados, endpoint mutável, sessão, upload ou qualquer novo tipo
  de entrada de usuário — é substituição de conteúdo dentro do mesmo dado
  público de identidade de clube já coberto por §7.1(a). Premissa do escopo
  desta tarefa ("é dado público de identidade de clube, não deveria introduzir
  superfície nova") **confirmada** por esta verificação, não apenas aceita.
- §7.6 (Privacidade): nenhum dado pessoal envolvido — nome/sigla/cor/id de
  clube são dados públicos de competição, mesma classificação já usada em todo
  o restante do contrato publicado.

### 4. Varredura de segredo pós-build (foco 4)

- `npm run build` (do zero) seguido de `npm run verificar-segredos` (varre
  `dist/`): **"nenhum padrão encontrado em 'dist'"**.
- `node pipeline/ci/verificar-segredos.mjs app/public/dados` (equivalente ao
  script `verificar-segredos:dados`, apontado diretamente para o diretório de
  snapshots publicados que inclui a mudança desta tarefa): **"nenhum padrão
  encontrado em 'app/public/dados'"**.
- Nenhum falso positivo novo disparado pelos 5 clubes novos (nomes/siglas sem
  caractere que colida com os 4 padrões do verificador — `token`, `api_key`,
  `Bearer`, chave-hex-32+) e nenhum segredo real escondido — os dois comandos
  rodaram limpos, cobrindo tanto o bundle da SPA quanto os dados publicados.

### Requisitos de segurança operacional para o chapéu DevOps

Nenhum requisito novo. Os já registrados em `.md/DEPLOY.md` §1 (gestão de
`FOOTBALL_DATA_API_TOKEN` como secret do GitHub Actions, pinagem por SHA,
permissões mínimas por job) continuam válidos sem alteração — esta tarefa não
mexeu em workflow, pipeline de CI/CD nem em código de acesso ao provedor.

### Achados por severidade — Refatoração Lote-2

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | `REFAT-02-01` (`idsProvedor` com sentinela pendente) | Não — fechado | Nenhuma; achado encerrado, confirmado sem sentinela restante e sem segredo introduzido |

Nenhum achado novo de severidade alta/crítica. Nenhuma questão de
compliance/negócio nova a sinalizar ao Gestor além do já registrado no
Bloqueio 010 (decisão de conteúdo, aprovada pelo usuário/stakeholder, sem
implicação de segurança).

**Veredito**: **Aprovado (sem achado)**. O débito de dado/configuração que
vinha sendo rastreado como `REFAT-02-01` desde o Lote 2 está fechado de fato
— confirmado por leitura direta de config/schema/log, `npm audit` limpo e
varredura de segredo limpa em bundle e dados publicados, não pela nota do
orquestrador ou do chapéu QA. `Refatoração Lote-2` liberada do lado de
segurança; nenhum novo requisito operacional para o chapéu DevOps; nenhuma
mudança na dupla aprovação já concedida na Confirmação final pré-deploy para
os demais lotes.

---

## Lote 12 — Telemetria, acessibilidade e segurança transversal

**Base específica**: `.md/TASK.md` (Lote 12: `TEL-01`, `QA-02`, `SEC-01`,
`QA-01`, todas `Concluída`), `.md/PRD-TECNICO.md` (RNF-07, RNF-04, CA-13.5),
`.md/SDD.md` §7, `adr/ADR-011.md`, `adr/ADR-012.md`, `adr/ADR-014.md`,
`.md/GUARDRAILS.md` §4/§6, `.md/QA-REPORT.md` (seção "Lote 12 — validação de
fechamento", veredito **Aprovado com ressalvas** — QA-01 tem pendência de
verificação manual de acessibilidade documentada, tratada pelo chapéu QA como
pré-condição obrigatória antes do primeiro deploy, não como bloqueio deste
lote). Auditoria feita **depois** dessa aprovação funcional, conforme a regra
de sincronização QA→DevSecOps — não aceitei a nota de implementação do
Executor nem a nota de fechamento do chapéu QA como prova de segurança: reli
eu mesmo `app/telemetria/id.ts`, `app/telemetria/eventos.ts`,
`app/telemetria/nucleoTelemetria.ts`, `app/telemetria/index.ts`,
`app/telemetria/coletor.ts`, `app/index.html`,
`dominio/noticias/sec-01-sanitizacao-csp.test.tsx`,
`app/rotas/sobreposicoes/Configuracoes/SecaoPrivacidade.tsx`, e rodei os
comandos abaixo eu mesmo, do zero, no estado atual do repositório.

### 1. TEL-01 — identificador anônimo e conteúdo dos eventos

| Verificação | Método | Resultado |
|---|---|---|
| Identificador não é derivado de/correlacionável com dado pessoal | `gerarIdAnonimo` (`app/telemetria/id.ts`) usa só `crypto.randomUUID`/`getRandomValues`/`Math.random` — nenhuma entrada de IP, user agent, dispositivo, rede ou comportamento; persistido em `sportslm.anonimo.v1` (chave já convencionada por `armazenamento/telemetriaId.ts`, ADR-005), apagável e reiniciável (`obterOuCriarIdAnonimo` gera um novo quando a chave está ausente) | Conforme — id opaco, sem vínculo a PII, mesma leitura do ADR-012 regra 2 |
| Os 5 eventos (ADR-012) não carregam conteúdo/preferência/URL/favorito | Li `eventos.ts` por inteiro: `CargaRetorno` (`diasDesdePrimeiraSessao: number`), `CargaPersonalizacaoConcluida` (`quantidadeFavoritos: number`, `temTimeDefinido: boolean` — nunca a lista de favoritos nem o id do time), `CargaPrimeiraInteracaoUtil` (`milissegundosAteInteracao: number`), `CargaComparativoAberto` (`rota: 'comparativo'\|'simulacao'`, enum fechado, nunca o conteúdo do comparativo/palpite), `primeira_sessao` sem carga. `nucleoTelemetria.ts` confirma que `criarEvento` só monta `{ nome, timestampMs, idAnonimo, carga }` — nenhum campo extra em nenhuma das 5 funções de registro | Conforme — nenhuma carga excede a tabela do ADR-012 |
| `VITE_TELEMETRIA` desliga tudo por padrão (opt-in, não opt-out) | `index.ts`: cada função pública guarda a chamada real atrás de `if (import.meta.env.VITE_TELEMETRIA === 'on')` — variável **ausente** (não só `'off'`) já resulta em condição falsa; grep em `.github/workflows/*.yml` confirma que nenhum workflow define `VITE_TELEMETRIA`, então o build de produção atual não habilita telemetria; `.env`/`.env.local` (únicos lugares que poderiam setar a variável localmente) estão listados em `.gitignore` (confirmado via `git check-ignore -v`), não versionados. Prova de build real (não só de runtime): `buildEliminacao.test.ts` builda duas vezes com Vite de verdade e confirma que o artefato "off"/ausente não contém nenhum dos 4 marcadores (nomes de evento + função interna) — executado por mim, passa nas duas direções | Conforme — comportamento padrão é desligado; habilitar exige ação explícita de quem builda (nunca opt-out de usuário final) |
| Sumidouro (`coletor.ts`) não faz I/O de rede | Lido por inteiro: buffer em memória + `Set` de ouvintes, sem `fetch`/`XMLHttpRequest`/`navigator.sendBeacon` — SPK-04 (qual SDK/host real) segue em aberto, nenhuma requisição sai do navegador hoje mesmo com `VITE_TELEMETRIA=on` | Conforme, e reduz o risco residual: mesmo se alguém builda com a flag ligada antes de SPK-04 concluir, nada é de fato transmitido a terceiro |

**Nenhum achado.**

### 2. SEC-01 — CSP e sanitização na prática (tarefa mais crítica do lote)

| Verificação | Método | Resultado |
|---|---|---|
| Meta CSP completa (`app/index.html`, linha 41) | Lida diretamente: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none';` — `script-src` estrito (sem `unsafe-inline`/`unsafe-eval`, o vetor real do ADR-011), `object-src`/`base-uri` travados a `'none'` (defesa em profundidade), `connect-src` restrito a `'self'` (host de telemetria fica só como placeholder comentado, linha 38, até TEL-01/SPK-04 escolher provedor) | Conforme com ADR-011 passo 9, exceto o desvio documentado abaixo |
| Ressalva `style-src 'unsafe-inline'` é aceitável | Comentário inline (linhas 19-36) explica: >10 componentes do design system injetam cor via custom property CSS (`style` inline), sempre resolvida de tokens internos, nunca de texto de terceiro (título/resumo de notícia são sempre nó de texto, nunca viram atributo `style`); `script-src` continua estrito. Concordo com a leitura técnica: o vetor de XSS real (`<script>`/`javascript:`/handler inline vindo do feed) não passa por `style-src` — confirmei eu mesmo, por leitura de `CartaoIngresso.tsx`/`BlocoPreto.tsx`/`FaixaClube.tsx`, que nenhum desses componentes interpola texto de terceiro dentro do atributo `style` | Aceito como decisão de implementação razoável — risco residual é de estilo (poluição visual no limite), não de execução de script. Registrado como débito de hardening de baixa severidade (ver achados) |
| `dangerouslySetInnerHTML` ausente do uso real | `grep -rn "dangerouslySetInnerHTML" --include="*.ts*"` no projeto inteiro (fora `node_modules`): as únicas 5 ocorrências são em comentário de prosa (`BlocoPreto.tsx`, explicando que o componente *não* usa) e no próprio teste `sec-01-sanitizacao-csp.test.tsx` que varre o repositório por `dangerouslySetInnerHTML\s*=\s*\{` (uso real de JSX) e falha se encontrar — nenhuma ocorrência de uso real em `app/`/`dominio/`. Executei o teste eu mesmo: passa | Conforme, confirmado por grep próprio, não só pela suíte |
| `rel="noopener noreferrer"` em todo link externo de notícia | `grep -rn "<a\b\|href="` em `app/`/`dominio/` (fora testes): único `<a target="_blank">` real do projeto é `CartaoIngresso.tsx` (linhas 187-197), com `rel="noopener noreferrer"` presente incondicionalmente no ramo `destino === 'interno' ? <Link> : <a ... rel="noopener noreferrer">`; os dois pontos de consumo de notícia (`SecaoUltimasNoticias.tsx`, `SecaoSeusEsportes.tsx`) sempre passam `destino="externo"` para `CartaoIngresso`, nunca renderizam `<a>` próprio. Os demais `href=`/`<a>` do projeto (`Layout.tsx` skip-link, `FaixaClubeDoTime.tsx`/`SecaoIdentidade.tsx` para `/time`) são navegação interna, sem `target="_blank"` | Conforme — todo link externo de conteúdo de terceiro passa pelo único ponto de saída auditado |
| Teste de injeção XSS de ponta a ponta contra `ING-N-02` | `sec-01-sanitizacao-csp.test.tsx` já cobre isso com prova de DOM real (não mock): payload com `<script>`, `onerror`, `onload` e `href` `javascript:` no mesmo item; `linkBruto: 'javascript:...'` é descartado na normalização (ADR-011 passo 2); com link válido, título/resumo maliciosos nunca sobrevivem (`normalizarItem`), e renderizado em `CartaoIngresso` real via `@testing-library/react`, confirma zero `<script>`/`<img>`/`<svg>` no DOM e a flag global `__xss` nunca setada. Executei a suíte eu mesmo (não aceitei a alegação do Executor/QA): passa. Considero esta prova automatizada suficiente — não vi necessidade de um teste manual adicional além do que já roda em CI | Conforme, com prova de DOM real já suficiente |

**Achado `SEC-12-01`** (severidade baixa, débito de hardening, não bloqueia):
`style-src 'unsafe-inline'` é um desvio documentado e tecnicamente
justificado do texto literal do ADR-011, mas ainda é uma superfície maior do
que o necessário enquanto os >10 componentes do design system dependem de
`style` inline para cor dinâmica. Migrar para nonce/hash de `<style>` (ou
para classes CSS geradas em vez de custom property inline) eliminaria a
ressalva por completo. Não bloqueia — o vetor real de execução de script
(`script-src`) segue estrito, e a fonte da cor é sempre interna, nunca de
conteúdo de terceiro.

### 3. Dependências de runtime

`npm audit --omit=dev --audit-level=high` (executado por mim, do zero):
**0 vulnerabilidades**. Nenhuma dependência nova introduzida pelo Lote 12
(`package.json` inalterado desde o Lote 11).

### 4. Compliance regulatória (LGPD/RNF-07) aplicável à telemetria

| Verificação | Método | Resultado |
|---|---|---|
| Aviso de consentimento simples existe e está correto | `SecaoPrivacidade.tsx` (Lote 9, wired em `Configuracoes.tsx` linha 314): texto canônico "Suas preferências ficam só neste navegador. Não usamos conta nem cookies. Enviamos 5 eventos anônimos de uso.", botão "Ver quais" revela os 5 nomes de evento (mesmos nomes/ordem do RNF-07/ADR-012), botão "Desativar e apagar id" chama `apagarIdentificadorAnonimo` | Conforme ADR-012 regra 6 ("consentimento simples se a ferramenta exigir") — RNF-07 pede telemetria mínima com aviso simples para o estágio de protótipo, não LGPD completa (base legal formal/política publicada só "se virar produto", ADR-012 e ADR-015) |
| Nenhum cookie usado | Confirmado por leitura de `coletor.ts`/`id.ts` — persistência é só `localStorage` (`sportslm.anonimo.v1`), sem `document.cookie` em nenhum módulo de telemetria | Conforme — texto do aviso ("não usamos cookies") é factualmente verdadeiro, não só marketing |
| Rótulo do botão "Desativar e apagar id" corresponde ao comportamento real | Li `SecaoPrivacidade.tsx`/`telemetriaId.ts`: o botão só chama `apagarIdentificadorAnonimo` (remove a chave). Não existe, hoje, um interruptor de runtime que impeça a próxima chamada de `obterOuCriarIdAnonimo` de gerar um novo id e continuar registrando eventos (a única forma real de desligar telemetria é o interruptor de **build**, `VITE_TELEMETRIA`, não algo que o usuário final controla em runtime) | **Achado `SEC-12-02`** (severidade baixa — transparência de consentimento, não vazamento de dado): o rótulo "Desativar e apagar id" pode sugerir ao usuário que a telemetria para de rodar, quando na prática só o identificador é trocado (evento seguinte usa um id novo, se `VITE_TELEMETRIA=on`). Não é dado pessoal exposto nem descumprimento de RNF-07 (que exige só "consentimento simples", não um toggle real de opt-out em runtime) — é uma imprecisão de copy que vale ajustar antes de qualquer sessão real com usuários, para o texto não prometer mais do que o mecanismo entrega |
| Nenhum outro requisito de compliance aplicável não atendido | Reli RNF-07/RNF-15/ADR-012/ADR-015 por inteiro: enquanto RNF-15 mantém o produto em "contexto de protótipo, sem compromisso de lançamento comercial", a barra de compliance declarada é "mínima" (sem conta, sem PII, telemetria anonimizada, consentimento simples) — integralmente atendida. Base legal LGPD formal, política de privacidade publicada e consentimento formal são gatilhos explícitos de "Se virar produto" (ADR-012/ADR-015), não exigíveis nesta fase | Conforme ao escopo declarado do protótipo — nenhum requisito de compliance obrigatório em aberto para o estágio atual |

**Nenhum achado bloqueante de compliance.** `SEC-12-02` registrado como débito
de baixa severidade (ajuste de copy), não como violação de LGPD/RNF-07.

### 5. Ressalva de acessibilidade manual do chapéu QA (QA-01) — implicação de segurança/compliance

O chapéu QA aprovou QA-01 com ressalva: os itens 1, 2, 5 e parte do 4 do
roteiro manual de UX-SPEC §5.8 (percurso só-teclado real, leitor de tela
real, zoom 200%/320px, verificação visual de `scroll-margin`) não foram
executados por falta de navegador/leitor de tela reais neste ambiente —
documentados como pendência de infraestrutura de verificação, não como
achado de produto, e tratados como **pré-condição obrigatória antes do
primeiro deploy em produção**.

Avaliação deste chapéu sobre a implicação de segurança/compliance dessa
ressalva:

- `GUARDRAILS.md` §6 declara "WCAG 2.2 AA é critério de aceite, não
  recomendação" e fixa `axe-core` com zero violações críticas/sérias como
  **portão de CI** — esse portão está integralmente atendido (48/48 casos,
  confirmado nesta auditoria e na validação de fechamento do chapéu QA). O
  portão de CI não inclui, por definição, o percurso manual — a própria
  ADR-014 ("Verificação") registra que o automatizado cobre "cerca de um
  terço dos critérios" e que a lista manual da Seção 5 do UX-SPEC "existe
  justamente para o resto". Ou seja, a lacuna hoje em aberto (itens 1/2/5 e
  parte do 4) não é um desvio do critério de aceite automatizado — é a parte
  do critério de aceite completo (WCAG 2.2 AA de fato, não só o subconjunto
  automatizável) que ainda não tem prova real.
- ADR-014 (seção "Consequências") liga explicitamente WCAG 2.2 AA à
  "expectativa legal brasileira (LBI/eMAG) **caso o protótipo avance**" — ou
  seja, o próprio ADR já delimita quando essa lacuna vira exposição legal
  real: não neste estágio de protótipo/coorte de teste (RNF-15), mas no
  momento em que o produto avança para uso mais amplo. Isso está alinhado
  com a decisão do chapéu QA de não bloquear o lote, mas de exigir a
  verificação manual real como pré-condição do primeiro deploy.
- Concordo com a leitura do chapéu QA: **isto não é puramente
  funcional/UX, fora do meu chapéu** — tem implicação de compliance
  (WCAG como critério de aceite não-negociável do próprio GUARDRAILS, e como
  expectativa legal condicional do ADR-014), mas essa implicação já está
  corretamente endereçada como um gate de pré-deploy, não como algo a
  ignorar. Meu papel aqui, como chapéu DevSecOps com poder de bloquear
  deploy, é **reforçar** que este é um bloqueio real de deploy (não uma nota
  solta) — ver achado `SEC-12-03` abaixo.

**Achado `SEC-12-03`** (severidade média — compliance condicional, não
bloqueia a aprovação deste lote, **bloqueia o próximo `/deploy` real que
exponha o produto além deste ambiente de desenvolvimento**): sessão manual
real (percurso só-teclado nos 7 fluxos, VoiceOver + NVDA nas 4 telas de
maior risco — T-02/T-06/T-08/T-09, zoom 200% em 320px, verificação visual de
`scroll-margin` no celular) pendente de execução em ambiente com
navegador/leitor de tela reais. Prazo: antes do próximo `/deploy` real
(mesmo padrão de backstop já usado para `SEC-01-03`/`REFAT-01-03`). Registrado
também em `.md/TASK.md` (nota da tarefa `QA-01`) para visibilidade do
Coordenador/Gestor.

### 6. Requisitos de segurança operacional para o chapéu DevOps (definidos aqui)

- Nenhum secret novo: o coletor de telemetria não faz I/O de rede ainda
  (SPK-04 em aberto); quando um provedor for escolhido, a URL/host real deve
  entrar em `connect-src` (substituindo o placeholder comentado) e qualquer
  chave pública de projeto (não secreta, por definição de GoatCounter/
  Cloudflare Web Analytics) deve ser tratada como configuração, não como
  `secret` do GitHub Actions — nenhuma credencial de telemetria é esperada.
- Nenhuma mudança em `build-publish.yml`/`ingestao.yml` requerida por este
  lote — CSP é servida via `<meta>` no próprio HTML publicado (limitação já
  aceita em ADR-011: `frame-ancestors`/`X-Frame-Options` não funcionam por
  `<meta>`, débito RT-13 já registrado, sem mudança).
- Reforço do requisito já vigente (`SEC-11-01`/`REFAT-01-03`): backstop de
  `react-router`/`react-router-dom` continua bloqueando o próximo `/deploy`
  real, junto com o novo `SEC-12-03` (sessão manual de acessibilidade) — o
  chapéu DevOps não deve executar deploy de produção enquanto qualquer um dos
  dois estiver em aberto.

### Achados por severidade — Lote 12

| Severidade | Achado | Bloqueia deploy? | Ação |
|---|---|---|---|
| — | Nenhum achado alto/crítico | — | — |
| Baixa | `SEC-12-01` — `style-src 'unsafe-inline'`, desvio documentado e tecnicamente aceito do ADR-011 | Não | Débito de hardening; migrar para nonce/hash de `<style>` quando o design system permitir, sem prazo fixado (severidade baixa) |
| Baixa | `SEC-12-02` — rótulo "Desativar e apagar id" sugere mais do que o mecanismo entrega (só troca o id, não desliga telemetria em runtime) | Não | Ajustar copy antes de qualquer sessão real com usuários; sem prazo fixado (severidade baixa, transparência de consentimento) |
| Média | `SEC-12-03` — sessão manual real de acessibilidade (itens 1/2/5 e parte do 4 do roteiro UX-SPEC §5.8) ainda não executada, WCAG 2.2 AA é critério de aceite não-negociável (GUARDRAILS §6) e liga a expectativa legal LBI/eMAG condicional (ADR-014) | **Sim — bloqueia o próximo `/deploy` real** | Executar a sessão manual (teclado, VoiceOver/NVDA, zoom 200%/320px, verificação visual de `scroll-margin`) antes do primeiro deploy que exponha o produto além deste ambiente de desenvolvimento; prazo: antes do próximo `/deploy` real |
| Média | `SEC-11-01`/`REFAT-01-03` — reafirmação, sem mudança neste lote | Sim — já bloqueava | Inalterado |

Nenhum achado deste lote tem, isoladamente, relevância estratégica de
negócio que exija decisão do Gestor além do registro de rotina do Gate 4 —
mas sinalizo ao Gestor, em paralelo (não como pré-requisito deste veredito),
que `SEC-12-03` soma-se a `SEC-11-01` como segundo motivo concreto para o
`/deploy` real permanecer bloqueado até ambos fecharem.

## Veredito — Lote 12

**Aprovado (com débito registrado)**. TEL-01 confirmado sem dado pessoal em
identificador ou carga de evento, com interruptor de build desligado por
padrão (opt-in, não opt-out) e prova real de eliminação do bundle. SEC-01
confirmado com CSP completa, `dangerouslySetInnerHTML` ausente do uso real,
`rel="noopener noreferrer"` em todo link externo de notícia, e prova de DOM
real contra payload de injeção — a única ressalva (`style-src
'unsafe-inline'`) é aceita como decisão técnica razoável, registrada como
débito de baixa severidade. `npm audit` sem vulnerabilidade alta/crítica.
Nenhum requisito de compliance obrigatório em aberto para o estágio de
protótipo declarado (RNF-15) — a ressalva de acessibilidade manual do
chapéu QA **tem**, sim, implicação de compliance (WCAG como critério de
aceite não-negociável e expectativa legal condicional), por isso elevada
aqui a achado de severidade média (`SEC-12-03`) que **bloqueia o próximo
`/deploy` real**, junto com o débito já vigente de `react-router`
(`SEC-11-01`). O Lote 12 em si está liberado para a checagem estrutural
final do Validador — o achado bloqueante é sobre o **deploy**, não sobre a
aprovação deste lote.

| Data | Lote | Veredito | Observação |
|---|---|---|---|
| 2026-09-06 | Lote 1 — Fundação técnica | Aprovado com débito registrado | 2 achados de severidade média, sem bloqueio; nenhum achado alto/crítico |
| 2026-09-06 | Lote 2 — Configuração por temporada | Aprovado | Nenhum segredo/dado sensível em `config/`; catálogo de fontes conforme SDD §3.1/RN-19; nenhum achado alto/crítico/médio novo; `npm audit` sem vulnerabilidade nova |
| 2026-09-06 | Lote 3 — Domínio compartilhado (puro) | Aprovado | Pureza de `dominio/` verificada estrutural e manualmente; nenhum achado alto/crítico/médio novo; `npm audit` sem vulnerabilidade nova |
| 2026-09-06 | Lote 4 — Pipeline de ingestão de notícias | Aprovado | Sanitização de conteúdo de terceiros (ADR-011) verificada por execução real de teste de injeção XSS; `dangerouslySetInnerHTML` ausente do código; feeds só HTTPS; nenhum achado alto/crítico/médio novo; `npm audit` sem vulnerabilidade nova |
| 2026-09-06 | Lote 5 — Pipeline de ingestão de futebol | Aprovado | Token do provedor só via variável de ambiente (`FOOTBALL_DATA_API_TOKEN`), nunca hardcoded/lido em `adaptador-football-data.ts`, verificado por leitura de código e execução real de teste; validação Zod na fronteira do provedor; isolamento `dominio/`×`pipeline/` mantido; nenhum achado alto/crítico/médio novo; `npm audit` sem vulnerabilidade nova |
| 2026-09-06 | Lote 6 — Paleta de clube e publicação | Aprovado com débito registrado | Varredura de segredo em `dist-dados/` confirmada por injeção real de segredo de teste (exit 1/exit 0 nas duas direções); `build-publish.yml` ganhou auditoria de dependências (`npm audit --audit-level=high`), lacuna do Lote 1 fechada; `npm audit` sem alta/crítica; reafirmação de `SEC-01-02`/`REFAT-01-02` (pinagem por tag em `build-publish.yml`, prazo "antes do Lote 6" vencido) — prazo reajustado e elevado a requisito bloqueante do próximo `/deploy` real, não bloqueia este lote; nenhum dado pessoal no contrato público gerado por PUB-02 |
| 2026-09-06 | Lote 7 — Design system e infraestrutura de tela | Aprovado | Nenhum dado pessoal em `armazenamento/preferencias`/`cenario` (CA-13.5 confirmado por teste real); `dangerouslySetInnerHTML` ausente do design system; `vitest-axe`/`axe-core` corretamente restritos a devDependency; nenhum achado alto/crítico/médio novo de segurança; `npm audit` sem vulnerabilidade nova (mesmo débito moderado de `react-router` já coberto por REFAT-01-03) |
| 2026-09-06 | Lote 8 — Onboarding e Home | Aprovado com débito reafirmado | Nenhum dado pessoal em `Preferencias`/`Cenario` (reconfirmado); `dangerouslySetInnerHTML` ausente; `rel="noopener noreferrer"` presente no único ponto de saída externa (link de notícia); validação Zod na fronteira de todo dado publicado consumido (contrato real de PUB-02); nenhuma dependência de runtime nova; `npm audit` com as mesmas 2 vulnerabilidades moderadas de `react-router` — prazo de `REFAT-01-03` ("antes do Lote 8") vencido sem execução, achado `SEC-08-01`, prazo reajustado para antes do próximo `/deploy` real (mesmo backstop de `SEC-06-01`) |
| 2026-09-06 | Lote 9 — Configurações e seleção de time | Aprovado, sem débito novo | Nenhum dado pessoal em `Preferencias`; `sportslm.anonimo.v1` confirmado como id anônimo local (ADR-012), nunca combinado com dado de conteúdo, "Desativar e apagar id" é só remoção, sem gerar/ler identidade; `dangerouslySetInnerHTML` ausente; toda entrada externa (`config/fontes.json`, `/dados/ingestao/status.json`, `localStorage`) validada com Zod; nenhuma dependência de runtime nova; `npm audit` com as mesmas 2 vulnerabilidades moderadas de `react-router`, achado `SEC-09-01` (reafirmação de `REFAT-01-03`, prazo inalterado, não vencido) |
| 2026-09-06 | Lote 10 — Painel e detalhe do campeonato | Aprovado, sem débito novo | Nenhum dado pessoal em `/dados/futebol/*` (dado público de competição/partida); toda fronteira de entrada externa consumida (`/dados/futebol/clube/<slug>.json`, `/dados/futebol/brasileirao.json`, `/dados/ingestao/status.json`, `localStorage`) validada com Zod; `dangerouslySetInnerHTML` ausente; nenhuma dependência de runtime nova; `npm audit` com as mesmas 2 vulnerabilidades moderadas de `react-router`, achado `SEC-10-01` (reafirmação de `REFAT-01-03`, prazo inalterado, não vencido); os 3 achados do chapéu QA (QA-10-01/02/03) não têm implicação de segurança |
| 2026-09-06 | Lote 11 — Rivais, comparativo e simulação | Aprovado, sem débito novo | Nenhum dado pessoal em `Cenario`/`Preferencias.rivais`; toda fronteira de entrada externa consumida (`Cenario`/`Preferencias` de `localStorage`, `/dados/futebol/brasileirao.json`, `/dados/ingestao/status.json`) validada com Zod; isolamento de escopo do cenário (time+rivais) confirmado sem vazamento entre escopos; `dangerouslySetInnerHTML` ausente; nenhuma dependência de runtime nova; `npm audit` com as mesmas 2 vulnerabilidades moderadas de `react-router`, achado `SEC-11-01` (reafirmação de `REFAT-01-03`, prazo inalterado, não vencido); o achado do chapéu QA (QA-11-01) não tem implicação de segurança — último lote de tela antes do Lote 12 |
| 2026-09-06 | Refatoração Lote-1 (débito técnico) | Aprovado, sem débito em aberto | Fecha `SEC-01-02` (5 ações de `build-publish.yml` confirmadas por SHA de commit via GitHub API, batendo exatamente com as tags `v5.0.0`/`v3.0.1`/`v4.0.5` reivindicadas, `object.type=="commit"`; `runs-on: ubuntu-24.04` alinhado) e `SEC-01-03`/`SEC-08-01` (`react-router-dom@7.18.3`, `npm audit --omit=dev` 0 vulnerabilidades, sem superfície nova — SPA client-side sem SSR/loader de servidor); remove o backstop que bloqueava o próximo `/deploy` real desde o Lote 6 |
| 2026-09-06 | Refatoração Lote-6 (débito técnico) | Aprovado, sem débito bloqueante | `tsx` (devDependency) confirmado sem vulnerabilidade de runtime (`npm audit --omit=dev --audit-level=high` 0 vulnerabilidades; as 7 vulnerabilidades da árvore completa são pré-existentes em eslint/vite/vitest, sem `tsx` na cadeia); token `FOOTBALL_DATA_API_TOKEN` confirmado nunca logado (leitura só via `process.env` em `orquestrador.ts`, mensagem de erro estática, `ingestao-cli.ts` nunca referencia o token, secret do workflow nunca ecoado); nenhum requisito operacional novo para o chapéu DevOps |
| 2026-09-08 | Refatoração Lote-7 (débito técnico) — completo (`REFAT-07-01` + `REFAT-07-02` + `REFAT-07-03`) | Aprovado (sem achado) | As 3 tarefas confirmadas, cada uma por leitura direta do diff real, como mudança puramente de CSS/tokens (literal → `var(...)` já existente em `tokens.css`, incluindo a troca de token de z-index em `REFAT-07-01`), sem dependência de runtime nova em nenhuma das três, sem entrada externa/fetch/localStorage/log envolvidos, sem superfície de XSS/CSP nova, sem segredo introduzido; `npm audit --omit=dev --audit-level=high` 0 vulnerabilidades nas 3 verificações independentes, sem regressão; nenhum achado de qualquer severidade nas 3 tarefas; nenhum requisito operacional novo para o chapéu DevOps; apto para dupla aprovação (QA + DevSecOps) e deploy |
| 2026-09-06 | Refatoração Lote-8 (débito técnico) | Aprovado, sem débito novo | `REFAT-08-01` confirmada como mudança puramente de CSS/estrutura de container (grade de 2 colunas em `Home.module.css` + 2 tokens de largura), sem dependência de runtime nova, sem prop/estado/fetch/`localStorage` novo nas 3 seções; `npm audit --omit=dev --audit-level=high` 0 vulnerabilidades, sem regressão; nenhum achado de qualquer severidade novo; débito `SEC-08-01`/`REFAT-01-03` (react-router, backstop do próximo `/deploy` real) permanece inalterado; nenhum requisito operacional novo para o chapéu DevOps |
| 2026-09-06 | Lote 13 — Spikes técnicos | Aprovado, sem achado, sem débito novo | Auditoria leve (lote de investigação, sem código novo); `config/fontes.json` confirmado intocado byte a byte (SPK-03), `config/fontes.test.ts` limpo; nenhuma dependência de runtime nova (SPK-04, `app/telemetria/` sem SDK de terceiro plugado, `connect-src` inalterado); 97 arquivos/1099 testes, `tsc`/`eslint` limpos; `npm audit --omit=dev --audit-level=high` 0 vulnerabilidades; achado de termos do Placar (SPK-03) é conformidade/negócio, não vulnerabilidade técnica — registrado no `QA-REPORT.md`/`BLOCKERS.md`, não como achado de segurança aqui; nenhum requisito operacional novo para o chapéu DevOps |
| 2026-09-06 | **Confirmação final pré-deploy** (Lotes 1-11+13, primeira publicação conjunta) | **Aprovado (com débito já registrado, nenhum novo)** | `npm audit --omit=dev --audit-level=high` 0 vulnerabilidades; segredo/isolamento `dominio/pipeline/app` reconfirmados sem novo artefato de produção; achado de hardening não bloqueante sobre sincronia manual de schema pipeline↔SPA (mesmo achado do chapéu QA, sem vulnerabilidade real hoje); requisitos operacionais para o chapéu DevOps inalterados (já em `.md/DEPLOY.md`); dupla aprovação QA+DevSecOps completa para este conjunto de lotes |
| 2026-09-07 | Refatoração Lote-2 (débito técnico) | Aprovado, sem achado | `REFAT-02-01` (sentinela `idsProvedor` pendente em 19/20 clubes, mais substituição de 5 clubes por Bloqueio 010) fechado; nenhum segredo em `config/clubes-2026.json`, `config/campeonatos-2026.json`, snapshots publicados ou nas transcrições de log dos Bloqueios 009/010 (grep dedicado, sem ocorrência de token real); schema Zod `.strict()` de `pipeline/config/clubes.ts` confirma ausência de campo/superfície nova; `npm audit --omit=dev --audit-level=high` 0 vulnerabilidades; `verificar-segredos` limpo em `dist/` e em `app/public/dados/`; nenhum requisito operacional novo para o chapéu DevOps |
| 2026-09-08 | Lote 12 — Telemetria, acessibilidade e segurança transversal | Aprovado (com débito registrado) | TEL-01: identificador anônimo sem PII, 5 eventos sem conteúdo/preferência (relidos por inteiro), `VITE_TELEMETRIA` desligado por padrão (nenhum workflow define a variável, `.env*` gitignorado), eliminação do bundle provada por build real; SEC-01: CSP completa lida em `app/index.html`, `dangerouslySetInnerHTML` ausente do uso real (grep próprio), `rel="noopener noreferrer"` confirmado no único ponto de saída externa (`CartaoIngresso`), teste de injeção XSS de ponta a ponta com DOM real executado; `npm audit --omit=dev --audit-level=high` 0 vulnerabilidades; achados novos de baixa severidade `SEC-12-01` (`style-src 'unsafe-inline'`, aceito, débito de hardening) e `SEC-12-02` (rótulo "Desativar e apagar id" impreciso, débito de copy); achado de severidade média `SEC-12-03` (sessão manual real de acessibilidade pendente, WCAG 2.2 AA é critério de aceite não-negociável do GUARDRAILS e liga expectativa legal condicional do ADR-014) **bloqueia o próximo `/deploy` real**, somando-se ao débito já vigente `SEC-11-01`/`REFAT-01-03` (react-router) |
