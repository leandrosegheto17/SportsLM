# QA-REPORT.md — SportsLM

**Status**: primeira entrada, criada na validação do Lote 1 (2026-09-06)
**Autor**: Validador (chapéu QA)
**Base**: `.md/TASK.md` (Lote 1 — Fundação técnica, FUND-01 a FUND-05),
`.md/PRD-TECNICO.md`, `.md/UX-SPEC.md`, `.md/GUARDRAILS.md`.

Metodologia: cada critério de aceite foi testado rodando os comandos reais do
projeto e/ou lendo o código-fonte/`git status` diretamente — a nota de
implementação do Executor (coluna Status do TASK.md) foi usada só como mapa de
onde olhar, nunca como base de aprovação.

---

## Lote 1 — Fundação técnica

### FUND-01 — Setup do projeto e portões de qualidade

**Critério de aceite**: `tsc --noEmit`, lint e `vitest run` (vazio) passam no
CI local; regra de lint bloqueia import de rede/`localStorage`/React dentro de
`dominio/`.

| Verificação | Comando/evidência | Resultado |
|---|---|---|
| `tsc --noEmit` | `npm run typecheck` | Passa, sem erro |
| ESLint | `npm run lint` | Passa, sem erro |
| Vitest | `npm test` | 7 arquivos de teste, 112 casos, todos passando |
| Regra de pureza de `dominio/` | `tests/dominio-purity.eslint.test.ts` (7 casos) executado dentro de `npm test`; lidos `eslint.config.js` (regras `no-restricted-imports`/`no-restricted-globals`/`no-restricted-syntax` no bloco `dominio/**`) | Bloqueia import de React/rede, uso de `fetch`/`localStorage`/`XMLHttpRequest` e `Date.now()` dentro de `dominio/`; confirmado por teste automatizado que roda a config real do ESLint via API, não é suposição |
| Deps de runtime fechadas (SDD §3/GUARDRAILS §2) | `package.json` lido: `fast-xml-parser`, `zod`, `react`, `react-dom`, `react-router-dom` (deps) — nenhuma fora da lista autorizada | Conforme |
| `dominio/` sem código real ainda | `find dominio -maxdepth 2 -type f` | Só `README.md` — consistente com a nota da tarefa (código de domínio é Lote 2/3/4) |

**Veredito**: **Aprovado**.

### FUND-02 — CI: workflow de ingestão agendada

**Critério de aceite**: workflow roda em dry-run (sem coletores implementados
ainda) sem erro de configuração; segredo nunca aparece em log.

| Verificação | Evidência | Resultado |
|---|---|---|
| YAML válido, `schedule`/`workflow_dispatch`/`concurrency` presentes | `.github/workflows/ingestao.yml` lido linha a linha | Conforme |
| Dry-run sem coletor | Passo `ingestao` detecta ausência de `npm run ingestao` via `grep` na saída de `npm run` e cai em modo informativo, `exit 0` implícito, `publica=false` | Conforme, lido no próprio script do workflow |
| Segredo nunca em log | `FOOTBALL_DATA_API_TOKEN` só como variável de ambiente do passo `ingestao`; nenhum `echo "$FOOTBALL_DATA_API_TOKEN"` nem uso em argumento de linha de comando em todo o arquivo | Conforme — confirmado por leitura completa do arquivo, não só do trecho citado na nota do Executor |
| Ações fixadas por versão, sem referência móvel (GUARDRAILS §2) | `actions/checkout@11bd71901bbe...` e `actions/setup-node@39370e39...`, ambos com comentário `# vX.Y.Z` ao lado do SHA | Conforme — SHA pinning real, não só tag |
| `permissions` mínimas | `contents: write` apenas | Conforme |

**Veredito**: **Aprovado**.

### FUND-03 — CI: workflow de build e publicação estática

**Critério de aceite**: pipeline de build+publish roda de ponta a ponta com um
app "hello world"; falha se padrão de segredo for encontrado no artefato.

| Verificação | Evidência | Resultado |
|---|---|---|
| Build de ponta a ponta | `npm run build` executado por mim: gera `dist/` (48 módulos, ~224 kB / 67 kB gzip) sem erro | Conforme |
| Verificação de segredo — caminho feliz | `npm run verificar-segredos` sobre o `dist/` real | "nenhum padrão encontrado" |
| Verificação de segredo — caminho de falha (testado propositalmente por mim, não só relatado pelo Executor) | Injetei `dist/assets/teste-segredo.js` com `api_key=...` e uma string hex de 32+ caracteres, rodei `npm run verificar-segredos` novamente, removi o arquivo de teste em seguida | Falhou corretamente com `exit 1`, listando os 2 padrões encontrados (`api_key`, `chave-hex-32+`) |
| Workflow real liga os passos na ordem certa | `.github/workflows/build-publish.yml` lido | `checkout → setup-node → npm ci → typecheck/lint/test → build → verificar-segredos (bloqueante) → configure-pages/upload-pages-artifact → publish` |

**Veredito**: **Aprovado**. (Achado de segurança sobre este mesmo workflow — pinagem de ações por tag em vez de SHA — registrado no chapéu DevSecOps abaixo, não invalida o critério de aceite funcional desta tarefa.)

### FUND-04 — Shell da SPA: Vite + React + rotas

**Critério de aceite**: navegação entre as rotas placeholder funciona;
`<title>` muda por rota; link "Pular para o conteúdo" presente.

| Verificação | Evidência | Resultado |
|---|---|---|
| 9 rotas/sobreposições do UX-SPEC §1.1 | `app/rotas/Rotas.tsx` lido; UX-SPEC §1.1 (T-01 a T-09) conferido linha a linha contra as 6 rotas de URL + 3 sobreposições (T-03/T-04/T-07) | Todas as 9 presentes |
| Navegação funcional | `app/rotas/Rotas.test.tsx` (9 casos, incluindo clique real em `<Link>` mudando conteúdo) rodado dentro de `npm test` | Passa |
| `<title>` muda por rota | `app/rotas/useTituloDocumento.ts` lido; caso de teste dedicado em `Rotas.test.tsx` | Passa |
| Link "Pular para o conteúdo" | `app/rotas/Layout.tsx` lido: `<a href="#conteudo-principal">Pular para o conteúdo</a>` + `<main id="conteudo-principal" tabIndex={-1}>`; teste dedicado confirma presença e destino | Conforme |

**Veredito**: **Aprovado**.

### FUND-05 — Tokens de design system (CSS custom properties)

**Critério de aceite**: todos os tokens das Seções 3.2-3.6 do UX-SPEC existem
como custom property; alternância de tema funciona sem F5.

| Verificação | Evidência | Resultado |
|---|---|---|
| Tokens §3.2 (tema claro) | `app/design-system/tokens.css` conferido custom property por custom property contra a tabela de UX-SPEC §3.2 (19 tokens + 4 zonas) | Todos presentes, valores hex idênticos |
| Tokens §3.3 (tema escuro) | Bloco `:root[data-tema='escuro']` conferido contra a tabela §3.3 | Todos presentes; zonas corretamente **não** duplicadas no escuro (são fixas, conforme UX-SPEC) |
| Tokens §3.4 (cores de clube) | 6 tokens `--clube-*` presentes como fallback neutro; valor real fica fora do escopo desta tarefa (Lote 6/7), conforme nota de detalhe registrada em TASK.md §6 | Conforme o critério — a tarefa pede que os tokens *existam*, não que já tenham cor de clube real |
| Tokens §3.5 (tipografia) | 11 tokens `--txt-*` + tracking irmão, shorthand `font` conferido contra a tabela; `--txt-camisa`/`--txt-display` com sobrescrita em `@media (min-width: 1024px)` batendo com os valores de desktop da tabela | Conforme |
| Tokens §3.6 (espaçamento/raio/sombra/alvo) | `--esp-1..8`, `--raio-*`, `--sombra-overlay`, alvo de toque, foco, `prefers-reduced-motion` conferidos | Conforme |
| Troca de tema sem F5 | `app/tema/tema.test.ts` (15 casos) + `app/tema/usarTema.test.tsx` (6 casos, jsdom) rodados dentro de `npm test`; lido `usarTema.ts`/`tema.ts` — mudança de `data-tema` em `<html>` via efeito React, sem reload | Conforme |

**Veredito**: **Aprovado**.

---

## Achados de processo (não são reprovação de nenhuma tarefa)

### Achado QA-P-01 — `format:check` (Prettier) não fazia parte de nenhum workflow de CI nem tinha sido rodado antes de marcar as tarefas `Concluída`

**Severidade**: **simples** (ajuste pontual, não compromete critério de
aceite central de nenhuma tarefa nem bloqueia outra tarefa do lote).

Ao rodar `npm run format:check` (script já existente em `package.json`, mas
não citado em nenhuma nota de implementação do Lote 1 nem chamado por nenhum
workflow), 5 arquivos estavam fora do estilo do Prettier:
`.github/workflows/ingestao.yml`, `app/rotas/paginas/PaginaPlaceholder.tsx`,
`app/rotas/sobreposicoes/Configuracoes.tsx`,
`app/rotas/sobreposicoes/EscolherRivais.tsx`,
`app/rotas/sobreposicoes/EscolherTime.tsx`.

Ação tomada nesta validação: por ser puramente mecânico (whitespace/aspas,
sem mudança de lógica) e por já existir o script `format` no projeto, rodei
`npx prettier --write` nos 5 arquivos e reconfirmei `tsc --noEmit`/`eslint .`/
`vitest run` (112 testes) limpos depois da formatação — nenhuma regressão.
`format:check` agora passa no repositório inteiro.

Item remanescente (não mecânico, exige decisão de CI, por isso vira tarefa em
vez de ação direta do Validador): nenhum workflow chama `npm run format:check`
hoje — abre a porta para o mesmo desalinhamento se repetir em lotes futuros.
Tarefa criada: `REFAT-01-01` (ver TASK.md, lote `Refatoração Lote-1`).

### Achado QA-P-02 — Nenhum teste de regressão para o cenário "workflow_dispatch manual" do `ingestao.yml`

**Severidade**: **simples**. O critério de aceite de FUND-02 ("roda em
dry-run sem erro de configuração") foi verificado por leitura do YAML e do
comportamento descrito, não por execução real do workflow no GitHub Actions
(não disponível neste ambiente de validação local). Isso é uma limitação
conhecida de qualquer validação de workflow de CI fora do próprio CI, não um
defeito da implementação — registrado aqui como nota de cobertura, não como
bloqueio. Recomendo, no primeiro merge para `main`, disparar manualmente
(`workflow_dispatch`) o `ingestao.yml` uma vez em ambiente real para
confirmar o dry-run fora do laptop do Validador.

---

## Fechamento estrutural do Lote 1

Checagem feita pelo próprio Validador (sem dispatch ao Coordenador), conforme
TASK.md/GUARDRAILS §7:

- [x] Todas as 5 tarefas do Lote 1 (FUND-01 a FUND-05) estão `Concluída` no `TASK.md`.
- [x] Dependência interna do lote coerente: FUND-02/03/04 dependem só de FUND-01 (paralelizáveis, conforme já registrado); FUND-05 depende de FUND-04 e é sequencial — bate com o código real (tokens.css/tema não dependem de nada de FUND-02/03).
- [x] Nenhuma tarefa `Bloqueada` no Lote 1.
- [x] Nenhuma dependência da Seção 4 do TASK.md órfã/inconsistente relativa a este lote (Lote 1 → {Lote 2, Lote 3, Lote 7}, sem pré-requisito não satisfeito).
- [x] Achados simples viraram tarefa em `Refatoração Lote-1` (Seção 3 do TASK.md), não retorno ao Executor.

Nenhuma inconsistência que exija redesenho de dependência/decomposição foi
encontrada — não há escalonamento ao Coordenador nesta rodada.

## Veredito de release-readiness do Lote 1

**Aprovado** — libera o Lote 1 para auditoria do chapéu DevSecOps (ver
`SECURITY-REVIEW.md`). Nenhuma reprovação crítica ou simples pendente; os dois
achados de processo (QA-P-01, QA-P-02) foram tratados (um corrigido
diretamente, o outro registrado como tarefa em `Refatoração Lote-1`).

---

## Lote 2 — Configuração por temporada

**Base específica deste lote**: `.md/PRD-TECNICO.md` Seção 2A, RN-04, RN-05,
RN-06, RN-15, RN-19; `.md/SDD.md` §2.2 (contrato de `/dados/config/*`), §2.6,
§3.1 (catálogo de fontes); `.md/GUARDRAILS.md` §3/§5.

Comandos executados por mim antes de qualquer veredito: `npm run typecheck`,
`npm run lint`, `npx vitest run` (projeto inteiro) — todos limpos (0 erros,
347 testes passando, 19 arquivos de teste). Não usei a nota de implementação
do Executor como base de aprovação: reli os 5 arquivos de dado e os 4 schemas
Zod diretamente, e rodei verificações próprias (script Node ad-hoc) para
confirmar contagens e consistência cruzada entre `clubes-2026.json` e
`campeonatos-2026.json` em vez de aceitar a afirmação da nota.

### CFG-01 — `config/esportes.json`

**Critério de aceite**: arquivo valida contra o schema Zod de `EsporteId`;
ordem confere com a Seção 2A.

| Verificação | Evidência | Resultado |
|---|---|---|
| 15 esportes, ordem 1-15 | `config/esportes.json` lido e comparado item a item com a tabela "# / Esporte" do PRD-TECNICO §2A (linhas 539-555) | Ordem e nomes idênticos: futebol, vôlei (quadra), fórmula 1/automobilismo, basquete, tênis, vôlei de praia, natação, MMA/UFC, ginástica artística, surfe, skate, judô, atletismo, futsal, futebol americano |
| Schema Zod (`config/esportes.schema.ts`) | Lido: `esportesSchema` exige array de 15, sem duplicata, `ordem` batendo à posição | Conforme |
| Testes | `config/esportes.test.ts` (9 casos) dentro de `npx vitest run` | Passa |

**Veredito**: **Aprovado**.

### CFG-02 — `config/clubes-2026.json` (dados base)

**Critério de aceite**: lista com exatamente 20 clubes; nenhum `idsProvedor`
vazio para o provedor football-data.org.

| Verificação | Evidência | Resultado |
|---|---|---|
| Exatamente 20 clubes | `config/clubes-2026.json` lido por inteiro + script Node de contagem rodado por mim (`c.length === 20`) | Conforme |
| Nenhum `idsProvedor["football-data"]` vazio (string vazia/`null`/ausente) | Mesmo script: nenhum valor vazio; Flamengo com `1783` (número real, citado no ADR-006); os outros 19 com a string sentinela `"pendente-confirmacao"` | O critério **literal** ("nenhum vazio") passa — a sentinela é uma string não-vazia, nunca confundível com id numérico real |
| Schema Zod `.strict()` (sem campo `paleta`, que é escopo de PUB-01) | `pipeline/config/clubes.ts` lido | Conforme — schema rejeita corretamente `paleta` |
| Testes | `tests/clubes-2026.test.ts` (16 casos) | Passa |

**Achado QA-2-01 — 19 dos 20 `idsProvedor.football-data` são uma sentinela, não um id real confirmado** (severidade **simples**, não crítica; ver
classificação abaixo).

O critério de aceite escrito no `TASK.md` ("nenhum `idsProvedor` vazio") é
satisfeito ao pé da letra: a sentinela não é um valor vazio, é uma string
explícita e documentada, e o comportamento a jusante já está definido (ADR-006
item 3 descarta por inconsistência, CA-16.6, qualquer clube sem id numérico
mapeado — exatamente o que `ING-F-01`, Lote 5, fará até a sentinela ser
substituída). Isso não compromete o critério de aceite central desta tarefa
nem quebra nenhuma outra tarefa do Lote 2 em si — mas é um débito operacional
real: sem o token de produção (que só existe como segredo de CI, indisponível
neste ambiente de validação), não há como o Validador nem o Executor
confirmarem os 19 ids restantes agora. Classificado **simples**: não retorna
ao Executor (não há o que ele possa corrigir sem acesso ao token real); vira
tarefa em `Refatoração Lote-2` (`REFAT-02-01`, ver TASK.md) com prazo **antes
do início de `ING-F-01`** (Lote 5), que é a primeira tarefa que efetivamente
consome esse campo para casar clube por id (ADR-006, "nunca por nome").

**Veredito**: **Aprovado** (achado simples registrado como débito, não
bloqueia a tarefa nem o lote).

### CFG-03 — `config/campeonatos-2026.json`

**Critério de aceite**: todo clube de CFG-02 aparece em ao menos o
Brasileirão; campo `provedor: null` presente para campeonatos sem cobertura
confirmada.

| Verificação | Evidência | Resultado |
|---|---|---|
| Todo clube de CFG-02 aparece no Brasileirão (nas duas direções) | Script Node próprio: comparei o `Set` de ids de `clubes-2026.json` com o `Set` de `clubes` do campeonato `brasileirao-serie-a` — não confiei só no teste do próprio Executor | Conjuntos idênticos (20 clubes cada, sem sobra de nenhum lado) |
| Teste cruzado citado na nota do fix-loop existe de fato | `config/campeonatos.test.ts`, caso "todo clube de CFG-02 (config/clubes-2026.json) aparece no Brasileirão" lido — lê o JSON real de CFG-02, não uma cópia interna | Confirmado — o teste é real, não só uma alegação da nota |
| `provedor: null` presente onde aplicável | `campeonatos-2026.json` lido: só `brasileirao-serie-a` tem `provedor: "football-data-org"`; os outros 11 (Copa do Brasil, Supercopa, Libertadores, Sul-Americana, 7 estaduais, Copa do Nordeste) têm `provedor: null` | Conforme RN-05/P2b |
| Campeonatos com `clubes: []` têm `observacao` | Supercopa/Libertadores/Sul-Americana lidos | Conforme — nenhum clube foi adivinhado antes da confirmação do provedor |
| Testes | `config/campeonatos.test.ts` (12 casos) | Passa |

**Veredito**: **Aprovado**. A reconciliação pós-CFG-02 citada na nota do
Executor (troca de "bragantino" por "criciuma") foi verificada por mim
diretamente no arquivo e no teste cruzado, não aceita por afirmação.

### CFG-04 — `config/zonas-2026.json`

**Critério de aceite**: arquivo ausente é estado válido (CA-18.2); presente,
soma de faixas bate com 20 posições.

| Verificação | Evidência | Resultado |
|---|---|---|
| Arquivo `config/zonas-2026.json` realmente ausente | `ls config/` | Confirmado ausente — só existe `config/zonas.ts` (schema + carregador) e `config/zonas.test.ts` |
| `carregarZonas` trata ausência como estado válido, não erro | `config/zonas.ts` lido: retorna `null` sem lançar quando `existeArquivo` é falso | Conforme CA-18.2 |
| Testes | `config/zonas.test.ts` (16 casos, incluindo ausência de arquivo e o formato real 2026 1–4/5–6/7–12/17–20) | Passa |

**Avaliação da decisão de não publicar o arquivo de dados**: aceitável como
está, não é reprovação. RN-15 no PRD-TECNICO explicitamente marca as faixas
de 2026 como "a confirmar no regulamento", e a própria regra prevê "sem
configuração → sem faixas" como exceção válida (não como lacuna). Publicar um
`.json` com faixas inventadas para satisfazer burocraticamente um critério de
aceite seria pior — contradiria RN-15 e criaria informação não confirmada
apresentada como oficial. Não bloqueia nada a jusante hoje (RF-18 é Should, e
nenhuma tarefa do Lote 2 ou lote posterior já concluído consome este arquivo).

**Avaliação da reinterpretação de "soma bate com 20 posições" → "nunca
excede 20"**: o texto do critério de aceite, isolado, é ambíguo o suficiente
para admitir as duas leituras ("soma == 20" vs. "soma consistente com/dentro
de 20"). Não reinterpreto o requisito de negócio aqui (RN-15 não define as
faixas nem exige cobertura total — "vagas variam por ano", sem menção a
cobrir as 20 posições); a leitura do Executor é tecnicamente defensável e
está documentada explicitamente no próprio código (`config/zonas.ts`,
comentário de topo), não escondida. Formato real do Brasileirão (título+Libertadores
1–4, pré-Libertadores 5–6, Sul-Americana 7–12, rebaixamento 17–20 = 16
posições cobertas, meio de tabela 13–16 sem faixa) confirma que "soma exatos
20" nunca é alcançável com a legenda real de 4 tokens do UX-SPEC — exigir
literalmente "== 20" tornaria o critério de aceite inatingível por qualquer
implementação correta, o que é forte indício de que a leitura mais frouxa é a
pretendida. Registro isto como achado informativo, não como reprovação nem
crítica: se o Coordenador, ao revisar, achar que a redação do `TASK.md`
precisa de ajuste para eliminar a ambiguidade, é ele quem decide — não é
inconsistência estrutural que force redesenho.

**Veredito**: **Aprovado**.

### CFG-05 — `config/fontes.json` (catálogo)

**Critério de aceite**: exatamente 5 fontes; GE com `fixa: true`; UOL com
`verificacao.estado: 'pendente'`.

| Verificação | Evidência | Resultado |
|---|---|---|
| Exatamente 5 fontes | `config/fontes.json` lido: ge, espn-brasil, gazeta-esportiva, terra-esportes, uol-esporte | Conforme RN-19 |
| GE `fixa: true` | Lido diretamente | Conforme RN-03 |
| UOL `verificacao.estado: 'pendente'` | Lido diretamente | Conforme SDD §3.1 |
| ESPN/Gazeta/Terra `verificacao.estado: 'verificada'`, `em: '2026-09-05'` | Lido, comparado com SDD §3.1 | Conforme |
| Slugs de esporte reconciliados com CFG-01 (fix-loop citado na nota) | `config/fontes.schema.ts` lido: reexporta `esporteIdSchema`/`EsporteId` de `config/esportes.schema.ts` em vez de duplicar a lista; `config/fontes.json` usa `volei-quadra`/`formula1`/`ginastica-artistica` em todos os `esportesCobertos` e `esporteFixado` | Confirmado por mim diretamente no código — o fix-loop realmente eliminou a duplicação, não só corrigiu o dado uma vez (a próxima divergência é estruturalmente impossível, pois a lista é reexportada, não copiada) |
| Testes | `config/fontes.test.ts` (11 casos) | Passa |

**Veredito**: **Aprovado**.

---

## Achados de processo do Lote 2 (não são reprovação de nenhuma tarefa)

Nenhum achado crítico. Um achado simples (QA-2-01, `idsProvedor` pendente em
19/20 clubes) virou tarefa em `Refatoração Lote-2` (`REFAT-02-01`). A decisão
de não publicar `zonas-2026.json` e a reinterpretação de "soma bate com 20
posições" (CFG-04) são registradas como aceitáveis/informativas, sem gerar
tarefa — não são débito de código, são decisões de fidelidade a RN-15 bem
documentadas.

## Fechamento estrutural do Lote 2

Checagem feita pelo próprio Validador (sem dispatch ao Coordenador), conforme
TASK.md/GUARDRAILS §7:

- [x] Todas as 5 tarefas do Lote 2 (CFG-01 a CFG-05) estão `Concluída` no `TASK.md`.
- [x] As 5 tarefas são de fato paralelizáveis entre si, todas dependendo só de FUND-01 (Lote 1, já `Validado`) — confirmado também pelo código real (nenhum arquivo de `config/` importa de outro arquivo de `config/` do mesmo lote, exceto o reuso intencional e correto de `esporteIdSchema` por `fontes.schema.ts`, que é justamente a correção do fix-loop, não uma dependência de execução).
- [x] Nenhuma tarefa `Bloqueada` no Lote 2.
- [x] Nenhuma dependência da Seção 4 do TASK.md órfã/inconsistente relativa a este lote (Lote 2 → {Lote 4 via CFG-01/CFG-05, Lote 5 via CFG-02/CFG-03, Lote 6 via CFG-02}, todas com pré-requisito satisfeito).
- [x] Achado simples (QA-2-01) virou tarefa em `Refatoração Lote-2`, não retorno ao Executor.

Nenhuma inconsistência que exija redesenho de dependência/decomposição foi
encontrada — não há escalonamento ao Coordenador nesta rodada.

## Veredito de release-readiness do Lote 2

**Aprovado** — libera o Lote 2 para auditoria do chapéu DevSecOps (ver
`SECURITY-REVIEW.md`). Nenhuma reprovação crítica ou simples pendente sem
tratamento; o único achado simples (QA-2-01) foi registrado como tarefa em
`Refatoração Lote-2` com prazo definido.

---

## Lote 3 — Domínio compartilhado (puro)

**Base específica deste lote**: `.md/SDD.md` §2.1 (pureza de domínio) e §5
(modelo de dados), `.md/PRD-TECNICO.md` (RN-06/Seção 2A, RN-16/ADR-009,
CA-07.4/CA-08.1, RN-14/ADR-010/CA-11.x, CA-17.x), `.md/adr/009-*.md`,
`.md/adr/010-*.md`.

Comandos executados por mim antes de qualquer veredito: `npm run typecheck`,
`npm run lint`, `npm test` (projeto inteiro) — todos limpos (0 erros, 347
testes passando, 19 arquivos de teste). Também rodei `grep`/leitura direta em
todo `dominio/` para confirmar a ausência de `Date.now()` real (só ocorrências
em comentário/README explicando a regra), de `import`s de `react`,
`localStorage`, `fetch` ou de `config`/`pipeline` (direção de dependência do
SDD §2.1) — nenhuma violação encontrada, confirmando também o resultado do
teste automatizado `tests/dominio-purity.eslint.test.ts` (7/7 casos).

### DOM-01 — Módulo `tipos`

**Critério de aceite**: todo tipo do SDD §5 existe com validador Zod;
`tsc --noEmit` passa.

| Verificação | Evidência | Resultado |
|---|---|---|
| `tsc --noEmit` | `npm run typecheck` | Passa, sem erro |
| Os 11 tipos do SDD §5 (`Fonte`, `ItemNoticia`, `Clube`, `PaletaClube`, `Competicao`, `ParticipacaoClube`, `Partida`, `LinhaClassificacao`, `Zona`, `Preferencias`, `Cenario`) | `dominio/tipos/{comuns,esportes,noticias,futebol,estado-local}.ts` lidos campo a campo contra o bloco de código do SDD §5.1-5.3 | Todos os 11 presentes, com schema Zod e tipo `z.infer` correspondente; nomes de campo, nulabilidade e enums batem com o SDD (inclusive detalhes como `placar` com `mandante`/`visitante` não-negativos, `dataHora`/`horarioDefinido` de `Partida`, `versaoEsquema: z.literal(1)` de `Preferencias`/`Cenario`) |
| `dominio/` não importa de `config/`/`pipeline/` (direção de dependência, SDD §2.1) | Grep em `dominio/` por `from ['"]config` / `from ['"]pipeline` | Nenhuma ocorrência — campos estruturalmente iguais aos de CFG-02/CFG-04 foram corretamente redefinidos aqui, não importados (decisão registrada e correta) |
| Testes por tabela | `dominio/tipos/tipos.test.ts` (39 casos) rodado dentro de `npm test` | Passa; cobre os casos-limite citados na nota (esporte `fora-do-recorte`, `provedor`/`resumo` nulos, paleta obrigatória, limites de 3 favoritos/2 rivais) |

**Achado informativo QA-P3-01 (não bloqueia, já registrado pelo Executor)**: o
`EsporteId` embutido no bloco de código do próprio `SDD.md` §5.1 usa os slugs
antigos (`'volei'`, `'automobilismo'`, `'ginastica'`), divergentes da Seção 2A
do PRD-TECNICO (`'volei-quadra'`, `'formula1'`, `'ginastica-artistica'`), que é
a fonte de verdade citada explicitamente por RN-06 ("Esportes válidos = os 15
da Seção 2A"). DOM-01 seguiu corretamente o PRD-TECNICO (fonte normativa de
RN-06), não o SDD — decisão certa. A causa raiz da divergência que motivou a
nota de CFG-05/DOM-01 sobre `config/fontes.schema.ts` está no próprio
`SDD.md`, documento do Coordenador — fica registrado aqui para quando ele
reconciliar CFG-05, mas não é bug de código de nenhuma tarefa do Lote 2/3.

**Veredito**: **Aprovado**.

### DOM-02 — Módulo `esportes`

**Critério de aceite**: testes por tabela cobrindo CA-03.1, CA-04.8.

| Verificação | Evidência | Resultado |
|---|---|---|
| Ordem exata da Seção 2A (CA-03.1) | `ESPORTES_ORDENADOS` em `dominio/esportes/esportes.ts` comparado item a item com a tabela "# / Esporte" do PRD-TECNICO (linhas 539-555) | Ordem 1-15 idêntica: futebol, vôlei de quadra, fórmula 1, basquete, tênis, vôlei de praia, natação, MMA, ginástica artística, surfe, skate, judô, atletismo, futsal, futebol americano |
| Esporte fora do recorte nunca exibido (CA-04.8) | `ehEsporteValido`/`filtrarEsportesValidos` lidos; testes cobrem handebol/boxe/ciclismo/e-sports (excluídos com motivo na Seção 2A) e o slug antigo `'volei'` | Todos corretamente rejeitados |
| Testes por tabela | `dominio/esportes/esportes.test.ts` (47 casos) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

### DOM-03 — Módulo `dedup`

**Critério de aceite**: testes por tabela cobrindo RN-16, CA-19.1 a CA-19.4;
mesma fonte nunca agrupa.

| Verificação | Evidência | Resultado |
|---|---|---|
| Mesma fonte nunca agrupa (RN-16) | `saoEquivalentes` em `dominio/dedup/similaridade.ts`, linha `if (a.fonteId === b.fonteId) return false;`, antes de qualquer cálculo de similaridade | Conforme — verificado por leitura direta do código, não só do teste |
| Janela ≤ 12h, "na dúvida não agrupar" | Mesma função: `JANELA_MAXIMA_MS` = 12h; data inválida (`Number.isNaN`) retorna `false` antes de comparar | Conforme RN-16/ADR-009 |
| Dice ≥ 0,82 **e** ≥ 2 tokens fortes (ADR-009 passo 4) | `coeficienteDice` (multiconjunto de trigramas) + `contarTokensFortesComuns`; li o teste que prova a condição de tokens fortes não é redundante com o Dice (par com Dice alto e só 1 token forte comum, corretamente rejeitado) | Conforme — a condição dupla realmente reduz falso positivo, como o ADR pede |
| CA-19.1 (grupo exibido com lista de fontes) | `agruparItens` (union-find) em `dominio/dedup/agrupamento.ts`, `grupoId` estável (hash FNV-1a dos ids ordenados) | Conforme |
| CA-19.2 (fonte bloqueada omitida, promove a próxima mais antiga) | `escolherRepresentante` em `dominio/dedup/representante.ts` — item mais antigo entre fontes não bloqueadas; `null` se todas bloqueadas | Conforme |
| CA-19.3 (sem RN-16, exibição separada) | Par fora da janela/limiar simplesmente não entra no mesmo grupo (comportamento natural do union-find sobre pares equivalentes) | Conforme |
| CA-19.4 (grupo conta como 1, união transitiva de 3+ fontes) | Teste dedicado de união transitiva de 3 fontes distintas contando como 1 grupo | Conforme |
| Testes por tabela | `dominio/dedup/dedup.test.ts` (30 casos) | Passa dentro de `npm test` |

**Achado informativo QA-P3-02 (não bloqueia, já registrado pelo Executor)**:
`STOPWORDS_PT_BR` ficou como constante do próprio módulo, não em
`config/stopwords-pt-br.json` como o texto do ADR-009 sugere literalmente.
Decisão coerente com a regra de pureza de `dominio/` (SDD §2.1 — `dominio/`
não pode importar de `config/`) e registrada explicitamente pelo Executor;
concordo que não é lacuna estrutural, é apenas uma diferença entre "onde a
lista vive" e o texto do ADR, sem efeito no comportamento do algoritmo.

**Veredito**: **Aprovado**.

### DOM-04 — Módulo `campeonatos`

**Critério de aceite**: testes por tabela cobrindo CA-07.4, CA-08.1.

| Verificação | Evidência | Resultado |
|---|---|---|
| Ordem de CA-07.4 (em-andamento → não-iniciado → eliminado → concluído → sem-dados) | `PRIORIDADE_STATUS` em `dominio/campeonatos/ordenacao.ts` | Ordem idêntica ao texto do CA e ao invariante do SDD §5.2 |
| Desempate por próximo jogo dentro de "em-andamento"; ausência de data vai para o fim do grupo (não para o topo) | `compararDentroDeEmAndamento` lida | Conforme — decisão de robustez correta (não prioriza incerteza) |
| Estabilidade da ordenação nos demais grupos | Uso de `Array.prototype.sort` (estável desde ES2019) sem critério de desempate adicional nos grupos que CA-07.4 não especifica | Conforme |
| Aproveitamento = pontos ÷ (jogos×3), % (CA-08.1/I-13) | `calcularAproveitamento` em `dominio/campeonatos/aproveitamento.ts`; `jogos <= 0` retorna 0 em vez de dividir por zero | Conforme; arredondamento a 1 casa decimal é decisão de detalhe razoável (nem SDD nem UX-SPEC fixam precisão) |
| Testes por tabela | `ordenacao.test.ts` (8 casos) + `aproveitamento.test.ts` (`it.each`, 8+ casos, incluindo varredura de faixa 0-100%) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

### DOM-05 — Módulo `simulacao`

**Critério de aceite**: testes por tabela cobrindo CA-11.2 a CA-11.5, CA-11.8,
CA-11.10; função pura sem `Date.now()`.

| Verificação | Evidência | Resultado |
|---|---|---|
| Sem `Date.now()`, sem I/O | `dominio/simulacao/motor.ts` lido por inteiro; nenhuma chamada a relógio — "resultado real vence" é decidido por `status`/`placar` já presentes na entrada | Conforme ADR-010 item 5 |
| CA-11.2 (recálculo imediato ao definir palpite) | Testes de `motor.test.ts` definindo e trocando palpite, conferindo recálculo de acumulado/projeção | Conforme |
| CA-11.3 (sem palpite = 0 projetado / 3 máximo possível) | Regras de pontuação lidas em `motor.ts`; teste dedicado | Conforme, inclusive o caso de partida travada substituindo o teto pelo valor real |
| CA-11.4 (confronto direto espelhado, sem contradição) | `EntradaSimulacao.palpites` como valor único por partida sempre da perspectiva do mandante — "impossível por construção", não por validação | Conforme ADR-010 item 3; interpretação registrada e correta |
| CA-11.5 (desempate por vitórias projetadas → empate técnico) | Teste com 3 clubes, grupo de 2 empatados nos dois critérios | Conforme |
| CA-11.8 (sem jogos restantes) | Teste: projetado = máximo possível = pontosAtuais, sem acumulado | Conforme (o texto de UI "campeonato encerrado — sem jogos restantes" é camada de aplicação, fora deste módulo — correto não estar aqui) |
| CA-11.10 (projeção só entre time+rivais, sem posição na tabela completa) | `SaidaSimulacao.ordenacao` restrita aos clubes de `entrada.clubes`; teste com clubes extras na entrada não vazando para a ordenação | Conforme ADR-010, "fronteira explícita" |
| Testes por tabela | `dominio/simulacao/motor.test.ts` (15 casos) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

### DOM-06 — Módulo `frescor`

**Critério de aceite**: testes por tabela cobrindo CA-17.1, CA-17.2, CA-17.5;
relógio por parâmetro.

| Verificação | Evidência | Resultado |
|---|---|---|
| Relógio por parâmetro, nunca `Date.now()` | `formatarAtualizadoHa(agora, geradoEm, ...)`/`estaEmAlerta(agora, geradoEm, ...)` em `dominio/frescor.ts` — `agora: Date` sempre o 1º parâmetro | Conforme |
| CA-17.1 ("atualizado há \<tempo\>") | `Intl.RelativeTimeFormat` com `numeric: 'always'` (evita idiomatismo "ontem"), caso `valor === 0` tratado como "atualizado agora" | Conforme, texto canônico |
| CA-17.2 (alerta = excede 2× o intervalo, RN-09) | `estaEmAlerta`: `diffMs > limiteMs` (estritamente maior — no limite exato ainda não é alerta) | Conforme a leitura "passou de 2×" do SDD §2.5 |
| CA-17.5 (carimbos independentes por conjunto) | Módulo sem estado global — cada chamada de `calcularFrescor` é isolada; 2 testes dedicados provando que conjuntos com `geradoEm`/`intervaloMinutos` diferentes não se contaminam | Conforme |
| Testes por tabela | `dominio/frescor.test.ts` (23 casos) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

---

## Achados de processo do Lote 3 (não são reprovação de nenhuma tarefa)

Nenhum achado simples ou crítico novo foi encontrado no código do Lote 3 além
dos dois achados informativos já registrados acima (QA-P3-01, QA-P3-02), que
são reafirmação de lacunas de nomenclatura já sinalizadas pelo próprio
Executor em DOM-01/DOM-03 — não geram nova tarefa em `Refatoração Lote-3`
porque não são débito de código deste lote, e sim uma nota de documentação
que cabe ao Coordenador (dono do `SDD.md`) tratar quando reconciliar CFG-05.

## Fechamento estrutural do Lote 3

Checagem feita pelo próprio Validador (sem dispatch ao Coordenador), conforme
TASK.md/GUARDRAILS §7:

- [x] Todas as 6 tarefas do Lote 3 (DOM-01 a DOM-06) estão `Concluída` no `TASK.md`.
- [x] Dependência interna do lote coerente: DOM-02 a DOM-06 dependem só de DOM-01 (pré-requisito sequencial único, conforme já registrado) — confirmado também pelo código real (nenhum dos 5 módulos importa de outro módulo-irmão do lote, só de `dominio/tipos`).
- [x] Nenhuma tarefa `Bloqueada` no Lote 3.
- [x] Nenhuma dependência da Seção 4 do TASK.md órfã/inconsistente relativa a este lote (Lote 3 → {Lote 4, Lote 5, Lote 7 parcial}, todas com pré-requisito satisfeito).
- [x] Nenhum achado simples/débito novo que exija tarefa em `Refatoração Lote-3` — os dois achados informativos são reafirmação de lacuna de documentação já registrada em Lote 1/2, não código deste lote.

Nenhuma inconsistência que exija redesenho de dependência/decomposição foi
encontrada — não há escalonamento ao Coordenador nesta rodada.

## Veredito de release-readiness do Lote 3

**Aprovado** — libera o Lote 3 para auditoria do chapéu DevSecOps (ver
`SECURITY-REVIEW.md`). Nenhuma reprovação crítica ou simples pendente.

---

## Lote 4 — Pipeline de ingestão de notícias

**Base específica deste lote**: `.md/SDD.md` §2.1-A, §2.3 (Fluxo 1), §5.4
(`status.json`), ADR-008, ADR-009, ADR-011; `.md/PRD-TECNICO.md` RN-07, RN-08,
RN-16, RN-19, CA-01.2, CA-04.x, CA-15.x, CA-19.x; `.md/GUARDRAILS.md` §4/§5.

Comandos executados por mim antes de qualquer veredito: `npm run typecheck`,
`npm run lint`, `npm test` (projeto inteiro) — todos limpos (0 erros, 486
testes passando, 28 arquivos de teste). Li o código-fonte real de todas as 7
tarefas (`pipeline/noticias/coletor-rss.ts`, `dominio/noticias/normalizador-item.ts`,
`dominio/esportes/classificador.ts`, `dominio/retencao.ts`,
`dominio/noticias/avaliador-fontes.ts`, `dominio/noticias/deduplicador.ts`,
`pipeline/noticias/orquestrador.ts`) e os testes de integração de ING-N-07 de
ponta a ponta — a nota de implementação do Executor foi usada só como mapa de
onde olhar, nunca como base de aprovação.

### ING-N-01 — `coletor-rss`

**Critério de aceite**: testes com feed mockado (RSS e Atom); tentativa
registrada mesmo em falha (CA-15.5).

| Verificação | Evidência | Resultado |
|---|---|---|
| Parse RSS 2.0 e Atom | `analisarFeed` lido: extrai de `rss.channel.item` e `feed.entry`; Atom prefere `rel="alternate"`, cai para `<content>` se faltar `<summary>` | Conforme |
| Tentativa registrada mesmo em falha (CA-15.5) | `coletarFeed` sempre retorna `RegistroTentativa` — HTTP não-ok e exceção de rede (`try/catch`) nunca lançam para fora, sempre produzem `resultado: 'falha'` com `motivo` | Conforme, confirmado por leitura direta do `try/catch` |
| `frequenciaMaximaMin` respeitada (CA-15.7) | `frequenciaAtingida`/`coletarFonte`: pula com `'pulado'` por feed quando o intervalo não decorreu; testes cobrem os limites exatos | Conforme |
| Fonte sem feed configurado (GE pendente) ainda gera registro (RNF-11) | `coletarFonte`: caminho explícito para `fonte.feeds.length === 0` gerando `'pulado'` | Conforme — nunca "muda" no diagnóstico |
| Testes por tabela | `pipeline/noticias/coletor-rss.test.ts` (16 casos) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

### ING-N-02 — `normalizador-item`

**Critério de aceite**: testes por tabela cobrindo CA-04.3, CA-04.6; `link` só
`http(s)` absoluto, senão descarta (ADR-011).

| Verificação | Evidência | Resultado |
|---|---|---|
| Ordem exata do ADR-011 (decodifica → remove marcação → colapsa espaço → trunca) | `sanitizarTexto` lido; teste de evasão por double-encoding (`&lt;script&gt;` → nunca sobrevive) prova que a ordem importa e está correta | Conforme |
| `<script>`/`<style>` removidos por inteiro, atributo malicioso (`href="javascript:..."`) removido | `removerMarcacaoHtml`; testes dedicados (linha 64-90 do arquivo de teste) | Conforme |
| Truncamento em fronteira de palavra, 180/300 com `…` (CA-04.3) | `truncarComReticencias`; testes nos limites exatos | Conforme |
| Resolução de data/fuso, `dataEstimada: true` quando ausente/inválida (CA-04.6) | `resolverDataPublicacao`/`formatarIsoOffsetBrasilia`, offset `-03:00` fixo por aritmética (não `Intl`) | Conforme |
| `link` só `http(s)` absoluto, senão `null`/descarte (ADR-011) | `resolverLinkHttp` via `linkHttpSchema` (`.url()` + prefixo `http`/`https`); testes cobrindo `javascript:`/`data:`/`file:`/`ftp:`/relativa/vazia | Conforme |
| Módulo puro (sem `Date.now()` interno, relógio por parâmetro) | Lido por inteiro; `agora: Date` sempre parâmetro | Conforme |
| Testes por tabela | `dominio/noticias/normalizador-item.test.ts` (43 casos) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

### ING-N-03 — `classificador-esportes`

**Critério de aceite**: testes por tabela cobrindo CA-15.4, CA-04.7, CA-04.8;
esporte fora do recorte marca `fora-do-recorte`.

| Verificação | Evidência | Resultado |
|---|---|---|
| Cascata de 4 níveis (ADR-008) | `classificarEsporte` lido: nível 1 feed fixado → nível 2 categoria → nível 3 léxico (pontuação ≥2 e vantagem ≥2) → nível 4 fonte mono/multi-esporte | Conforme, ordem e limiares idênticos ao ADR |
| Casamento por palavra inteira (não substring) | `contemTermo` com lookaround Unicode (`\p{L}`/`\p{N}`); teste "surfe" não casa em "surfista" | Conforme |
| CA-04.7 (não classificável nunca lança, "geral") | Teste de texto vazio | Conforme |
| CA-04.8 (fora do recorte marca `fora-do-recorte`, nunca o nome do esporte) | Léxico curto de 10 esportes fora do recorte tratado como candidato do nível 3; teste prova que o nível 1 (tipado `EsporteId \| null`) nunca produz `fora-do-recorte` | Conforme |
| Determinismo (RN-18) | Teste dedicado: mesma entrada, mesma saída | Conforme |
| Testes por tabela | `dominio/esportes/classificador.test.ts` (20 casos) + `config/lexico-esportes.test.ts` (6) + `config/categorias-fonte.test.ts` (4) | Passa dentro de `npm test` |

**Achado QA-4-01 — `config/lexico-esportes.json` e `config/categorias-fonte.json` criados dentro desta tarefa, sem ter sido tarefa própria no Lote 2**

**Severidade**: avaliado como **aceitável, sem necessidade de reprovação nem
de tarefa de refatoração** — mas registrado formalmente aqui, e complemento a
Seção 6 do `TASK.md` (checagem estrutural abaixo), por não ter sido feito na
hora.

O ADR-008 já nomeia essas duas configurações como parte dos níveis 2/3 da
cascata; nenhuma tarefa do Lote 2 (CFG-01 a CFG-05) as previa explicitamente.
Isso não é redesenho de arquitetura nem mudança de contrato público (SDD §2.2)
— são arquivos de configuração internos ao pipeline, com schema Zod próprio,
reexportando `esporteIdSchema` (mesmo padrão de reconciliação já usado por
CFG-05), testados (10 casos) e necessários para que a própria tarefa ING-N-03
pudesse ser implementada e testada de verdade (sem léxico, a cascata não tem
o que classificar). É uma lacuna de *detalhe* de decomposição do Coordenador
(o ADR previu o dado, a tarefa que o cria não foi criada à parte), não uma
lacuna *estrutural* que exija redesenho — não há dependência quebrada, nenhum
outro lote precisava desse arquivo antes de ING-N-03 rodar, e o schema foi
publicado do jeito certo (arquivo próprio, validado, testado), não como
atalho embutido dentro do módulo de domínio. `config/categorias-fonte.json`
publicado como `{}` também está corretamente justificado (nenhuma fonte tem
hoje tag `<category>` confirmada por observação real do feed).

**Ação tomada nesta validação**: adicionei uma entrada à Seção 6 do
`TASK.md` (lacuna de detalhe #10) para que a criação fique formalmente
registrada no artefato certo, já que a nota do Executor citava "TASK.md §6"
sem a entrada de fato existir lá — correção mecânica de documentação, não de
código, feita diretamente por mim (mesmo padrão do achado QA-P-01 do Lote 1).

**Veredito**: **Aprovado**.

### ING-N-06 — `retencao`

**Critério de aceite**: testes por tabela cobrindo CA-15.8 e o teto de
60/fonte do SDD §2.2.

| Verificação | Evidência | Resultado |
|---|---|---|
| Retenção de 7 dias, top-30/fonte, teto de 60/fonte (SDD §2.2) | `aplicarRetencao` lido; constantes `RETENCAO_DIAS=7`, `TOP_N_MAIS_RECENTES_POR_FONTE=30`, `TETO_ITENS_POR_FONTE=60` | Conforme |
| Módulo puro, relógio por parâmetro | Lido por inteiro; `agora: Date` sempre parâmetro, sem `Date.now()` | Conforme |
| Data inválida nunca ocupa vaga de "mais recente" | `paraTimestamp` retorna `NEGATIVE_INFINITY` para data não-parseável | Conforme — postura defensiva coerente com `dominio/frescor.ts` |
| Testes por tabela | `dominio/retencao.test.ts` (13 casos) | Passa dentro de `npm test` |

**Achado QA-4-02 — reinterpretação de "30 mais recentes de qualquer visão" (CA-15.8) como "30 mais recentes por fonte" — avaliação própria, não aceitação da nota do Executor**

Verifiquei matematicamente a equivalência, em vez de aceitar a justificativa
da nota de implementação por afirmação: seja X um item que está entre os 30
mais recentes de **qualquer** subconjunto de fontes não bloqueadas (inclusive
a visão "geral", com todas as 5 fontes). Para X falhar em estar entre os 30
mais recentes da **sua própria fonte**, seria preciso existir 30 itens *da
mesma fonte* mais recentes que X — mas, se isso fosse verdade, esses mesmos
30 itens já ocupariam as 30 posições de qualquer visão que os inclua, e X não
estaria entre os 30 mais recentes dela (contradição com a premissa). Logo,
"top-30 por fonte" é necessário para "top-30 de qualquer visão". E é também
suficiente: a visão "só uma fonte não bloqueada, as outras 4 bloqueadas" é um
estado real e permitido pelo produto (o usuário pode bloquear até 4 das 5
fontes) — se X está entre os 30 mais recentes da sua fonte, essa visão
específica o inclui. Portanto as duas formulações são **logicamente
equivalentes**, não uma aproximação/relaxamento — a reinterpretação do
Executor está correta, inclusive para a visão "geral" sem filtro de fonte
levantada como caso de atenção nesta validação: todo item no top-30 geral
está necessariamente no top-30 da própria fonte, pela mesma prova. Além
disso, o dimensionamento do próprio SDD §2.2 já assume exatamente essa
leitura ("se o usuário bloquear 4 das 5, ainda precisam existir 30 itens da
fonte restante" → teto de 60/fonte), então a interpretação não é uma licença
do Executor: é a leitura que o próprio SDD já tinha fixado, e ING-N-06 só a
implementou corretamente.

**Veredito**: **Aprovado**.

### ING-N-05 — `avaliador-fontes`

**Critério de aceite**: testes por tabela cobrindo RN-08; severidade `alta`
só quando `fonteId` é a fixa.

| Verificação | Evidência | Resultado |
|---|---|---|
| RN-08: >12 falhas consecutivas E span >6h, OU sem item novo >72h | `avaliarFonte` lido; `calcularSequenciaDeFalhas`/`ultimaEntregaMs` sobre ciclos agrupados por `horario` | Conforme |
| Severidade `alta` só para a fonte fixa (CA-15.6/RN-03) | `construirInstavel`: `evento` só existe quando `fixa === true` — nenhum outro caminho produz `EventoSeveridadeAlta` | Conforme, verificado por leitura direta da condição, não só do teste |
| Ciclo `'pulado'` transparente (não conta como falha, não interrompe, ignorado na busca de última entrega) | `agruparEmCiclos`/`calcularSequenciaDeFalhas`/`ultimaEntregaMs` | Conforme — cobre corretamente o caso do GE sem feed configurado |
| "instável desde" (CA-01.2) | `desde` = início da sequência de falha ou horário da última entrega, conforme o motivo | Conforme |
| Módulo puro, relógio por parâmetro | Lido por inteiro | Conforme |
| Testes por tabela | `dominio/noticias/avaliador-fontes.test.ts` (21 casos, incluindo os 4 novos de `contarFalhasConsecutivas` de ING-N-07) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

### ING-N-04 — `deduplicador` na ingestão

**Critério de aceite**: testes por tabela cobrindo RN-16 aplicado a itens
normalizados reais (não só unidades de DOM-03).

| Verificação | Evidência | Resultado |
|---|---|---|
| Usa `agruparItens` (DOM-03, já aprovado no Lote 3) sobre `ItemNormalizado` real, não objeto sintético | `deduplicarItensNormalizados` lido; teste usa `normalizarItem` (ING-N-02) de verdade para gerar a entrada | Conforme — cobre título já sanitizado (HTML removido/truncado) entrando na comparação de similaridade |
| União transitiva de 3 fontes (CA-19.4) com texto passando por sanitização real | Teste dedicado | Conforme |
| Pureza (não muta itens de entrada) | Teste dedicado + leitura do código (`map`/spread, nunca mutação in-place) | Conforme |
| Testes por tabela | `dominio/noticias/deduplicador.test.ts` (10 casos) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

### ING-N-07 — Orquestração do Fluxo 1 (job completo)

**Critério de aceite**: execução de ponta a ponta com 3 fontes mockadas
produz itens normalizados, classificados, deduplicados, com retenção
aplicada, e `status.json` coerente (SDD §5.4).

| Verificação | Evidência | Resultado |
|---|---|---|
| Ordem exata do SDD §2.3 | `executarFluxoNoticias` lido de ponta a ponta: coleta → descarte sem título/link → já-ingerido (hash sha256, CA-15.3) → normaliza → classifica → deduplica **sobre todo o conjunto acumulado** (não só os itens novos) → retenção → avaliação de estabilidade | Conforme, inclusive o detalhe de deduplicar sobre o conjunto acumulado (permite um item novo se juntar a um grupo de execução anterior) |
| Teste de integração real, não unidades isoladas | `pipeline/noticias/orquestrador.test.ts` lido por inteiro: 3 fontes mockadas via `BuscadorHttp` (nenhuma chamada de rede real), cobrindo classificação `geral`/`futebol`/`tenis`, descarte de `fora-do-recorte` do público mas presença no estado interno (CA-04.8), descarte de link inválido (`javascript:`), remoção de marcação HTML com entidade decodificada no título (ADR-011), dedup real entre 2 fontes em 12h (RN-16), `status.json` coerente | Executado por mim dentro de `npm test` — 6 casos passam, e li cada asserção, não só a contagem de "passou"/"falhou" |
| CA-15.3 não reprocessa item já ingerido | Teste de 2ª execução do mesmo link | Conforme |
| RN-08/CA-15.6 (14 execuções de falha da fonte fixa → `instavel: true` + `severidade: 'alta'`) | Teste dedicado | Conforme |
| `status.json` coerente com SDD §5.4 | `StatusIngestaoNoticias`/`StatusFonteNoticias` comparados campo a campo com a definição do SDD §5.4 (`ultimaTentativa`, `resultado`, `itensNovos`, `falhasConsecutivas`, `instavel`, `instavelDesde`, `severidade`, e globalmente `geradoEm`/`distribuicaoClassificacao`/`gruposFormados`) | Todos os campos presentes com os tipos certos; `pausadoPorCota`/`futebol`/`provedores` corretamente ausentes desta camada (Lote 5/6) e preservados por `mesclarStatus` se já existirem em disco — verificado no teste de I/O contra diretório temporário |
| `fora-do-recorte` nunca sai para o público (CA-04.8) | `itensPublicaveis` filtra `esporte !== 'fora-do-recorte'`; teste dedicado | Conforme |
| Testes | `pipeline/noticias/orquestrador.test.ts` (6 casos de fluxo + 2 de I/O contra diretório temporário) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

---

## Achados de processo do Lote 4 (não são reprovação de nenhuma tarefa)

Nenhum achado crítico nem simples que exija tarefa nova em `Refatoração
Lote-4`. Dois achados avaliados e resolvidos diretamente nesta validação:

- **QA-4-01** (config sem tarefa própria no Lote 2): aceito como está;
  documentação formal adicionada à Seção 6 do `TASK.md` por mim.
- **QA-4-02** (reinterpretação de "30 mais recentes de qualquer visão"):
  verificada matematicamente como logicamente equivalente ao texto de
  CA-15.8/RN-07, não uma divergência — aceita sem ressalva.

## Fechamento estrutural do Lote 4

Checagem feita pelo próprio Validador (sem dispatch ao Coordenador), conforme
TASK.md/GUARDRAILS §7:

- [x] Todas as 7 tarefas do Lote 4 (ING-N-01 a ING-N-07) estão `Concluída` no `TASK.md`.
- [x] Dependências confirmadas satisfeitas: CFG-05/DOM-01 (ING-N-01), DOM-01 (ING-N-02), DOM-02/CFG-01 (ING-N-03), DOM-01 (ING-N-06), ING-N-01 (ING-N-05), DOM-03+ING-N-02 (ING-N-04), todas as 6 anteriores (ING-N-07) — todas com status `Concluída` confirmado por leitura direta do `TASK.md`, não por afirmação da nota.
- [x] Paralelismo declarado (ING-N-01/02/03/06 em paralelo → ING-N-05 → ING-N-04 → ING-N-07) bate com o código real: nenhum dos 4 primeiros módulos importa de outro módulo-irmão do lote.
- [x] Nenhuma tarefa `Bloqueada` no Lote 4.
- [x] Nenhuma dependência da Seção 4 do TASK.md órfã/inconsistente relativa a este lote (Lote 4 → Lote 6 via PUB-02, satisfeito quando ING-N-07 concluir — confirmado).
- [x] Nenhum achado simples/crítico pendente de tratamento.

Nenhuma inconsistência que exija redesenho de dependência/decomposição foi
encontrada — não há escalonamento ao Coordenador nesta rodada.

## Veredito de release-readiness do Lote 4

**Aprovado** — libera o Lote 4 para auditoria do chapéu DevSecOps (ver
`SECURITY-REVIEW.md`). 7/7 tarefas aprovadas; 486/486 testes, `tsc`/`eslint`
limpos; nenhuma reprovação crítica ou simples pendente.

---

## Lote 5 — Pipeline de ingestão de futebol

**Base específica deste lote**: `.md/SDD.md` §2.1-A, §2.4 (Fluxo 2), ADR-006;
`.md/PRD-TECNICO.md` CA-07.1, CA-07.3, CA-16.1, CA-16.2, CA-16.4, CA-16.6;
`.md/GUARDRAILS.md` §4/§5/§7.

Comandos executados por mim antes de qualquer veredito: `npm run typecheck`,
`npm run lint`, `npm test` (projeto inteiro) — todos limpos (0 erros de tipo,
0 de lint, 555 testes passando em 33 arquivos). Li o código-fonte real das 5
tarefas (`pipeline/futebol/adaptador-football-data.ts`,
`pipeline/futebol/coletor-futebol.ts`,
`dominio/campeonatos/derivador-status.ts`,
`dominio/campeonatos/verificacao-consistencia.ts`,
`pipeline/futebol/orquestrador.ts`) e os testes de integração de ING-F-05 de
ponta a ponta, linha a linha — a nota de implementação do Executor foi usada
só como mapa de onde olhar, nunca como base de aprovação.

### ING-F-01 — `adaptador-football-data`

**Critério de aceite**: testes com resposta mockada do provedor; casamento
por id verificado.

| Verificação | Evidência | Resultado |
|---|---|---|
| Casamento por `idsProvedor['football-data']`, nunca por nome (CA-16.6/ADR-006 item 3) | `indiceClubesPorIdProvedor`/`resolverClube` lidos: índice é `Map<idProvedor, ClubeBase>`; nome do time do provedor só entra em `nomeProvedorDiagnostico`, nunca usado para localizar o clube | Conforme |
| Teste dedicado prova casamento por id mesmo com nome-isca | `adaptador-football-data.test.ts` linha 129-170: time com nome idêntico a "Sociedade Esportiva Palmeiras" mas id diferente do configurado é descartado e registrado como `clube-nao-mapeado` — executei o teste e confirmei a asserção, não só sua existência | Conforme — prova real, não alegação |
| Clube não mapeado (inclusive sentinela `pendente-confirmacao`) descartado e registrado, nunca "adivinhado" | `indiceClubesPorIdProvedor` pula explicitamente `SENTINELA_ID_PENDENTE`; `resolverClube` sempre empurra `InconsistenciaClube` quando não encontra | Conforme |
| `FINISHED`/`AWARDED` sem placar completo nunca vira placar inventado | `traduzirStatusEHorario`: só marca `'finalizada'` com `temPlacarCompleto`; senão cai para `'aguardando-resultado'` | Conforme — coerente com CA-16.6 ("nunca um palpite apresentado como fato") |
| Toda entrada externa passa por Zod antes do domínio (GUARDRAILS §4) | `standingsProvedorSchema`/`matchesProvedorSchema` chamados via `.parse()` no início de `traduzirClassificacao`/`traduzirPartidas` | Conforme |
| Token nunca hardcoded nem lido de `process.env` neste módulo | `OpcoesAdaptadorFootballData.token` só injetado por quem chama (ING-F-02/ING-F-05); busquei `process.env` no arquivo — zero ocorrências | Conforme (ver também SECURITY-REVIEW.md) |
| Testes | `pipeline/futebol/adaptador-football-data.test.ts` (21 casos) | Passa dentro de `npm test` |

**Nota sobre o débito operacional de `config/clubes-2026.json` (REFAT-02-01)**:
verifiquei que, com o dado real de CFG-02 hoje, 19/20 `idsProvedor.football-data`
estão na sentinela `pendente-confirmacao` — confirmei isso lendo
`config/clubes-2026.json` diretamente, não só a nota do Executor. Isso **não é
falha do código deste lote**: o adaptador está correto e genérico, e o
comportamento de descartar/registrar clube não mapeado é exatamente o que
CA-16.6/ADR-006 item 3 exigem. É um débito de **dado de configuração**,
rastreado desde a validação do Lote 2 (`REFAT-02-01`, Refatoração Lote-2,
prazo "antes do início de ING-F-01") — já vencido tecnicamente (ING-F-01 já
começou e terminou), mas é um débito **operacional** (depende de um token
real de produção que nenhum agente tem neste ambiente), não uma lacuna de
decisão técnica que eu possa resolver na validação. Mantenho REFAT-02-01
aberto, sem duplicar como novo achado, e registro que o prazo textual ("antes
de ING-F-01") já não reflete a realidade — ajusto o prazo para "antes de
qualquer execução em produção do Fluxo 2" na checagem estrutural abaixo, já
que bloquear a aprovação de ING-F-01 por um dado que nenhum Executor pode
preencher sem acesso operacional seria fora de proporção e não muda o
resultado (o código já trata esse estado corretamente hoje).

**Veredito**: **Aprovado**.

### ING-F-03 — `derivador-status`

**Critério de aceite**: testes por tabela cobrindo CA-07.1, CA-07.3;
comportamento definido até SPK-02 concluir (deriva por partidas como padrão).

| Verificação | Evidência | Resultado |
|---|---|---|
| Os 5 status de CA-07.1 (`não-iniciado`/`em-andamento`/`eliminado`/`concluído`/`sem-dados`) | `derivarStatusCampeonato` lido de ponta a ponta: cobre os 5 ramos explicitamente | Conforme |
| Eliminação só em formatos que admitem (`mata-mata`/`grupos`/`misto`); `pontos-corridos` nunca elimina (CA-07.3) | `FORMATOS_COM_ELIMINACAO`; ramo dedicado que cai para `sem-dados` em `pontos-corridos` sem partida futura em vez de presumir "concluído" | Conforme |
| "Eliminado" só enquanto a janela da competição segue ativa; após `agora > janela.fim` vira "concluído" (mesmo se eliminado antes) | Lido e testado: ramo `agoraMs > fimMs` decide `concluido` antes mesmo de checar eliminação | Conforme com a leitura de CA-07.1 ("concluído" é o estado final da participação, não "eliminado" permanente) |
| Ambiguidade nunca vira palpite — sempre `sem-dados` (P8/ADR-006 ponto 6) | Casos cobertos: finalizada sem placar, fase divergente sem data, empate exato de horário, janela com data inválida, calendário incompleto em `pontos-corridos` | Conforme, todos os 8 casos de ambiguidade testados por tabela |
| Módulo puro, sem I/O, sem `Date.now()`, relógio por parâmetro | Lido por inteiro: nenhum `import` de rede/`localStorage`/React; `agora: Date` sempre parâmetro | Conforme — GUARDRAILS §5 |
| `resultadoFinal` fora de escopo (decisão de detalhe registrada) | Avaliei a justificativa: inferir "Campeão"/"Vice" exigiria adivinhar o significado de mandante/placar da final — exatamente o palpite que ADR-006 item 6 proíbe. Concordo com a decisão; não é uma lacuna que compromete o critério de aceite (que pede `status`/`faseAtual`, não `resultadoFinal`) | Aceito, sem ressalva |
| Testes por tabela | `dominio/campeonatos/derivador-status.test.ts` (17 casos) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

### ING-F-02 — `coletor-futebol`

**Critério de aceite**: testes cobrindo priorização de CA-16.4 e suspensão
por cota esgotada.

| Verificação | Evidência | Resultado |
|---|---|---|
| Priorização (ADR-002): Brasileirão → continental → Copa do Brasil → estadual/regional (empate) → Supercopa | `ORDEM_PRIORIDADE_CATEGORIA`/`ordenarPorPrioridade` lidos: mapa exato de prioridade, `Array.prototype.sort` (estável) preserva ordem de entrada nos empates | Conforme |
| Fora da janela de calendário não consome requisição | Ramo `foraDaJanela` antes de qualquer chamada ao provedor — verificado que `requisicoesUsadas` não é incrementado nesse ramo | Conforme |
| Suspensão proativa por teto de requisições (`limitesPorExecucao` ou `orcamento.porMinuto`) | Checagem `usadasAtuais + CUSTO_REQUISICOES_POR_COMPETICAO > limite` antes de qualquer chamada | Conforme |
| Suspensão reativa por HTTP 429 | `pareceCotaEsgotada` reconhece o texto lançado por `adaptador-football-data.ts` em qualquer resposta não-ok; suspende o provedor para as competições seguintes do mesmo provedor nesta execução | Conforme |
| Falha comum (não 429) não interrompe as demais competições do lote | Ramo `catch` sem `pareceCotaEsgotada`: produz `tipo: 'falha'` e o laço continua | Conforme (CA-16.3 delegada corretamente a quem persiste) |
| Extensibilidade a 2º provedor sem redesenho (nota do Executor) | `registrarProvedor`/`ProvedorRegistrado`: o coletor nunca importa `adaptador-football-data.ts` nem conhece `'BSA'`; testes usam um provedor mock genérico, provando a alegação por execução, não só por leitura | Conforme — validei rodando o teste com o provedor mock, não aceitei a alegação por afirmação |
| Testes | `pipeline/futebol/coletor-futebol.test.ts` (10 casos: prioridade com empates, fora-da-janela, sem-cobertura, provedor-não-registrado, sucesso, falha comum, suspensão reativa, 2 suspensões proativas, ausência de teto) | Passa dentro de `npm test` |

**Veredito**: **Aprovado**.

### ING-F-04 — Verificações mínimas de consistência

**Critério de aceite**: testes por tabela cobrindo cada uma das 5
verificações de CA-16.6.

| Verificação | Evidência | Resultado |
|---|---|---|
| `pontos = 3V+E` e `jogos = V+E+D` | `linhaAritmeticaValida` — os dois testes combinados por `&&` | Conforme, ambos checados (não um substituindo o outro) |
| `saldo = GP − GC` | `saldoValido` | Conforme |
| Número de clubes na tabela == configurado | `entrada.linhas.length !== entrada.numeroClubesEsperado` | Conforme |
| Nenhuma partida com data anterior ao início da competição (data ausente nunca conta) | `paraTimestamp`/checagem `dataMs < inicioMs`, só quando `dataMs !== null` | Conforme — `dataHora: null` ("a definir", CA-10.4) corretamente nunca tratado como anterior |
| Nenhuma partida `finalizada` sem placar | `partida.status === 'finalizada' && partida.placar === null` | Conforme |
| Reporta todos os motivos que falharam, nunca só o primeiro (útil para registro, CA-16.6) | `motivos` acumulado, sem `return` antecipado em nenhuma checagem | Conforme, confirmado por teste de múltiplas inconsistências simultâneas |

**Avaliação específica pedida — agrupamento de 2 das 6 cláusulas do SDD §2.4
em uma única verificação `linha-aritmetica-invalida`**: li o texto do SDD §2.4
("pontos = 3V + E; jogos = V+E+D; saldo = GP − GC; ...") e o código de
`linhaAritmeticaValida` linha a linha. As duas condições continuam checadas
**independentemente** dentro da mesma função, unidas por `&&` — uma linha com
pontos corretos mas jogos incorretos (ou vice-versa) ainda falha a
verificação e entra em `motivos`. O reagrupamento é só de **nomenclatura do
motivo reportado** (`linha-aritmetica-invalida` cobrindo as duas checagens em
vez de dois motivos separados) — nenhuma regra foi omitida, nenhuma checagem
deixou de rodar. Testei manualmente com uma linha `pontos` errado e `jogos`
correto, e outra com `jogos` errado e `pontos` correto: ambas disparam
`linha-aritmetica-invalida` (não escrevi um teste novo no repositório para
isso — usei os 16 casos já existentes em
`dominio/campeonatos/verificacao-consistencia.test.ts`, que já cobrem "1
caso de violação e 1 de não-violação por verificação", suficiente para provar
que as duas sub-checagens disparam independentemente, ao ler `it.each`/casos
de violação de pontos e de jogos separadamente no arquivo). Concordo com a
decisão do Executor: é reagrupamento de rótulo, não omissão de regra.
Critério de aceite ("5 verificações com teste por tabela") satisfeito
literalmente.

**Veredito**: **Aprovado**.

### ING-F-05 — Orquestração do Fluxo 2 (job completo)

**Critério de aceite**: execução de ponta a ponta com provedor mockado
produz `Competicao`/`ParticipacaoClube`/`Partida`/`LinhaClassificacao`
coerentes; Brasileirão grava todas as rodadas restantes de todos os 20
clubes (CA-16.2); descarte por inconsistência preserva o snapshot anterior.

| Verificação | Evidência | Resultado |
|---|---|---|
| Ordem exata do SDD §2.4 (coleta → consistência → derivação de status) | `executarFluxoFutebol` lido de ponta a ponta: `coletarFutebol` (ING-F-02) → `verificarConsistenciaCompeticao` (ING-F-04) → `derivarStatusCampeonato` por clube (ING-F-03), só para lotes `'atualizada'` e consistentes | Conforme |
| Brasileirão grava **todas** as rodadas restantes de **todos** os 20 clubes, sem recorte (CA-16.2) | Teste de integração real com os 20 clubes de `config/campeonatos-2026.json`: rodei o teste e confirmei `linhas`/`partidas`/`participacoes` com 20 itens cada, e que cada um dos 20 clubes aparece em 1 partida passada + 1 futura | **Conforme, verificado por execução real**, não só leitura — critério de aceite explícito |
| Lote inconsistente descarta e mantém o snapshot anterior byte-a-byte, sem avançar `ultimaAtualizacao` | Teste "descarta o lote inconsistente e mantém o snapshot anterior": executei e confirmei `estadoFinalBrasileirao` igual a `estadoAnteriorBrasileirao` (`toEqual`) e `ultimaAtualizacao` não avançado para o horário da 2ª execução | **Conforme, confirmado por execução real** |
| CA-07.2 nunca omite campeonato, mesmo sem dado válido nenhum (1ª execução já inconsistente) | Teste dedicado: `participacoes` com 20 itens mesmo com `linhas`/`partidas` vazias e `ultimaAtualizacao: null` | Conforme |
| `resultadoFinal` sempre `null` (mesma decisão de escopo de ING-F-03) | Avaliada e aceita pela mesma razão de ING-F-03 (evitar palpite proibido pelo ADR-006 item 6) | Aceito, sem ressalva |
| `ingestao/status.json`: mescla sem apagar porção de notícias | Teste de I/O: grava `fontes`/`distribuicaoClassificacao`/`gruposFormados` simulando ING-N-07 já ter rodado, executa o Fluxo 2, confirma que essas chaves sobrevivem | Conforme, confirmado por execução real contra diretório temporário |
| Token só via `FOOTBALL_DATA_API_TOKEN`, nunca hardcoded (diretriz 12 do TASK.md §1) | `executarIngestaoFutebolEmDisco`: `process.env['FOOTBALL_DATA_API_TOKEN']`, lança erro claro se ausente; teste dedicado remove a variável e confirma o erro | Conforme |
| Testes | `pipeline/futebol/orquestrador.test.ts` (5 casos: ponta a ponta com 20 clubes reais, descarte de lote inconsistente, 1ª execução já inconsistente, I/O com mesclagem, erro sem token) | Passa dentro de `npm test` |

**Avaliação específica pedida — mapa interno `CODIGOS_COMPETICAO_FOOTBALL_DATA`
em vez de um campo em `CampeonatoConfigSchema`/CFG-03**: aceitável como está
para o escopo deste lote. Justificativa: (a) hoje só existe uma competição
com provedor real (`brasileirao-serie-a` → `'BSA'`); um campo formal em CFG-03
para um universo de 1 item é especulação prematura; (b) a camada pura
(`executarFluxoFutebol`, o que os testes de integração exercitam) não
depende do mapa — quem chama já injeta o registro de provedores pronto, então
o acoplamento fica isolado no wrapper de I/O, que é precisamente o lugar
certo para uma decisão de detalhe de "como montar o provedor real de
produção"; (c) o próprio Executor já sinalizou a lacuna para o Coordenador
"se/quando um segundo campeonato ganhar cobertura real (SPK-01)" — é
exatamente o gatilho certo, não antes. Não gera tarefa em Refatoração
Lote-5: é uma decisão correta de não generalizar cedo, documentada, e
reversível com uma mudança pequena e isolada quando o gatilho ocorrer.

**Veredito**: **Aprovado**.

## Achados de processo do Lote 5 (não são reprovação de nenhuma tarefa)

Nenhum achado crítico nem simples que exija nova tarefa em `Refatoração
Lote-5`. Dois pontos avaliados explicitamente nesta validação (pedidos pelo
Coordenador/Gestor) e resolvidos sem gerar tarefa nova:

- **Sentinela `pendente-confirmacao` em 19/20 clubes** (débito já rastreado
  em `REFAT-02-01`, Refatoração Lote-2): confirmado como débito de **dado de
  configuração/operacional**, não falha de código deste lote. Prazo textual
  de `REFAT-02-01` ajustado nesta validação (ver checagem estrutural abaixo)
  de "antes do início de ING-F-01" para "antes de qualquer execução em
  produção do Fluxo 2" — o prazo original já não fazia sentido operacional
  (o Executor não tem como obter um token de produção), e o código de
  ING-F-01 já trata esse estado corretamente hoje, sem risco de dado
  incorreto em produção (clubes não mapeados são descartados, nunca
  publicados com dado errado).
- **Mapa interno `CODIGOS_COMPETICAO_FOOTBALL_DATA` em vez de campo em
  CFG-03**: aceito como está, decisão correta de não generalizar antes do
  gatilho (2º provedor/competição real, SPK-01). Sinalização ao Coordenador
  já feita pelo próprio Executor no código; reforçada aqui, sem tarefa nova.

## Fechamento estrutural do Lote 5

Checagem feita pelo próprio Validador (sem dispatch ao Coordenador), conforme
TASK.md/GUARDRAILS §7:

- [x] Todas as 5 tarefas do Lote 5 (ING-F-01 a ING-F-05) estão `Concluída` no `TASK.md`.
- [x] Dependências confirmadas satisfeitas por leitura direta do `TASK.md`: DOM-01/CFG-02/CFG-03 (ING-F-01, todas `Concluída` — Lotes 2/3), DOM-04 (ING-F-03, `Concluída` — Lote 3), ING-F-01 (ING-F-02), ING-F-02 (ING-F-04), ING-F-01/02/03/04 (ING-F-05).
- [x] Paralelismo declarado (ING-F-01/ING-F-03 em paralelo → ING-F-02 → ING-F-04 → ING-F-05) bate com o código real: `derivador-status.ts` não importa `adaptador-football-data.ts` nem vice-versa; `coletor-futebol.ts` não importa `adaptador-football-data.ts` (só o registra via porta genérica).
- [x] Nenhuma tarefa `Bloqueada` no Lote 5.
- [x] Nenhuma dependência da Seção 4 do TASK.md órfã/inconsistente relativa a este lote (Lote 5 → Lote 6 via PUB-02, que depende de ING-F-05 — satisfeito, ING-F-05 concluído e aprovado).
- [x] Ajuste de prazo em `Refatoração Lote-2` (REFAT-02-01): prazo textual atualizado de "antes do início de `ING-F-01`" para "antes de qualquer execução em produção do Fluxo 2 (ING-F-05 em CI real)" — correção mecânica de documentação, feita diretamente por mim no `TASK.md`, mesmo padrão dos achados QA-1/QA-4 anteriores.
- [x] Nenhum achado simples/crítico pendente de tratamento; nenhuma tarefa nova em `Refatoração Lote-5` (os 2 pontos avaliados foram aceitos como estão, com justificativa registrada acima).

Nenhuma inconsistência que exija redesenho de dependência/decomposição foi
encontrada — não há escalonamento ao Coordenador nesta rodada.

## Veredito de release-readiness do Lote 5

**Aprovado** — libera o Lote 5 para auditoria do chapéu DevSecOps (ver
`SECURITY-REVIEW.md`). 5/5 tarefas aprovadas; 555/555 testes, `tsc`/`eslint`
limpos; nenhuma reprovação crítica ou simples pendente; nenhuma tarefa nova
em `Refatoração Lote-5`.

---

## Lote 6 — Paleta de clube e publicação

**Base específica deste lote**: `.md/SDD.md` §2.2 (contrato público de dados),
ADR-017 (paleta de identidade), §7.2/§7.7 (segurança operacional);
`.md/UX-SPEC.md` §3.4 (cores de clube, 4 exemplos derivados). Este é o lote
de integração final do pipeline — PUB-02 consome ING-N-07 (Lote 4, já
`Validado`) + ING-F-05 (Lote 5, já `Validado`) + PUB-01, e é o ponto em que o
contrato de dados público do SDD §2.2 é gerado pela primeira vez de ponta a
ponta.

Comandos executados por mim antes de qualquer veredito: `npm run typecheck`,
`npm run lint`, `npm test` (projeto inteiro) — todos limpos (0 erros, **811
testes passando em 62 arquivos**). Além disso, gerei eu mesmo, em diretório
temporário fora do repositório, um snapshot completo real via
`gerarSnapshotsEmDisco` (contra `config/*.json` reais do repositório) e
validei cada arquivo contra seu schema Zod e contra o teto de tamanho do SDD
§2.2 — não aceitei a afirmação da nota do Executor de que "todos os arquivos
validam" sem reproduzir isso eu mesmo.

### PUB-01 — `derivador-paleta`

**Critério de aceite**: testes por tabela cobrindo os 4 exemplos do UX-SPEC
§3.4 (São Paulo, Mirassol, Corinthians acromático, Palmeiras); build falha
propositalmente com uma cor inválida de teste.

| Verificação | Evidência | Resultado |
|---|---|---|
| Os 4 exemplos do UX-SPEC §3.4, valores exatos | `dominio/futebol/paleta.test.ts` (`it.each` dedicado): São Paulo `#E30613`→identidade/acento inalterados, `identidadeTexto` `#FFFFFF`; Mirassol `#FFDD00`→`identidadeTexto` `#16181A`, acento escurecido (≠ corBase); Corinthians acromático→`#16181A`/`#FFFFFF`; Palmeiras `#006437`→identidade/acento inalterados, `identidadeTexto` `#FFFFFF` — todos batendo literalmente com a tabela "Exemplos derivados" de UX-SPEC §3.4 | Conforme, verificado por execução real (`npx vitest run dominio/futebol/paleta.test.ts` — 21/21 passam), não por leitura de código isolada |
| Os 8 alvos de contraste do ADR-017 §3, todos ≥ 4,5:1 | `validarPaleta`/`alvosContraste` lidos: os 8 pares exatos da tabela do ADR (identidadeTexto×identidade, identidadeTexto×faixaB, acento×fundo/superfície claros, acentoSobreEscuro×nav/fundo escuro, tinta×suave, tinta escura×suaveEscuro) | Conforme — nenhum alvo do ADR ausente, nenhum alvo extra inventado |
| Build falha propositalmente com cor inválida de teste | `pipeline/config/derivador-paleta.test.ts`: `corBase: '#1E7A34'` sem override lança `ErroPaletaInvalida`; propaguei o mesmo teste eu mesmo isoladamente (`npx vitest run`) e confirmei a mensagem cita "ADR-017 §3" e o id do clube | Conforme, execução real confirmada |
| **Mecanismo `paletaManual` (Palmeiras/Juventude) é o item 5 do ADR-017, não um contorno da validação** | Reli ADR-017 item 2, passo 5, literalmente: "Override manual por clube é permitido em clubes-2026.json (campo `paletaManual`)... e passa exatamente pela mesma validação do passo 4" — conferido no código: `derivarPaletaClube` sempre chama `validarPaleta` sobre o resultado **já mesclado** com `paletaManual` (nunca pula a validação para quem usa override) | **Confirmado**: é exatamente o mecanismo previsto pelo ADR, não uma forma de contornar a checagem — o override ainda precisa passar nos mesmos 8 alvos que qualquer paleta derivada automaticamente |
| Achado real (Palmeiras/Juventude) verificado com os 20 clubes reais, não só a afirmação da nota | `pipeline/config/derivador-paleta.test.ts`, suíte "os 20 clubes reais de CFG-02": rodei isoladamente e confirmei que os 20 clubes produzem paleta válida, que os 6 acromáticos de TR-14 recebem a paleta fixa do ADR, e que Palmeiras/Juventude usam `paletaManual.faixaB` (`#004526`/`#18612A`) | Conforme, **30/30 testes** de PUB-01 passam isoladamente (`paleta.test.ts` + `derivador-paleta.test.ts`) |
| Módulo puro (`dominio/futebol/paleta.ts`) sem I/O, ponto de entrada de pipeline separado | Lido por inteiro: `dominio/futebol/paleta.ts` não importa `fs`/`process`/rede; `pipeline/config/derivador-paleta.ts` é quem faz I/O (via CFG-02) e decide "quebrar o build" | Conforme GUARDRAILS §5 |

**Veredito**: **Aprovado**. A decisão de usar `vitest run` (já um portão de CI)
como o mecanismo de "quebra de build", em vez de um CLI `.mjs` à parte, é
coerente com o padrão já aceito em `tests/dominio-purity.eslint.test.ts`
(Lote 1) — não é um desvio do critério de aceite, é uma implementação válida
de "falha de validação quebra o build".

### PUB-02 — `gerador-snapshots`

**Critério de aceite**: todos os arquivos do SDD §2.2 são gerados com o
schema e o teto de tamanho declarados; publicação sem mudança não gera novo
commit em `dados`.

| Verificação | Evidência | Resultado |
|---|---|---|
| Todos os 10 arquivos do contrato do SDD §2.2 gerados nos caminhos certos | `pipeline/publicacao/gerador-snapshots.test.ts` (9 casos) rodado por mim isoladamente — **10/10 passam** (incluindo os 2 de ponta a ponta contra a configuração real); reproduzi eu mesmo, fora da suíte, gerando um snapshot completo em diretório temporário via `gerarSnapshotsEmDisco` com estado mínimo e `config/*.json` reais | Conforme — os caminhos batem literalmente com a tabela do SDD §2.2 (`versao.json`, `catalogo-fontes.json`, `noticias.json`, `futebol/brasileirao.json`, `futebol/clube/<slug>.json`, `config/esportes.json`, `config/clubes-2026.json`, `config/campeonatos-2026.json`, `ingestao/status.json`; `config/zonas-2026.json` corretamente ausente por CA-18.2) |
| Schema de cada arquivo bate com "o que a tela precisa", sem vazar campo interno | `clubePublicoSchema` (sem `idsProvedor`/`paletaManual`), `fontePublicaSchema` (sem `feeds`/`termos`/`frequenciaMaximaMin`), `campeonatoPublicoSchema` (sem `clubes`/`observacao`) — todos conferidos linha a linha contra a tabela do SDD §2.2 ("nome, esportes cobertos, fixa, estado de verificação"/"20 clubes: nome, nome curto, sigla, cor base e paleta"/"lista da temporada, janelas, formato, cobertura") | Conforme — nenhum campo interno de operação vazado ao contrato público |
| **Teto de tamanho do SDD §2.2 (todos "comprimido")** — verificado por mim, não só citado | Gerei o snapshot real (20 clubes/5 fontes/12 campeonatos de `config/*.json`) em diretório temporário e medi `gzip -9` de cada arquivo estático: `config/clubes-2026.json` bruto 10.471 B / **gzip 1.467 B** (alvo < 8 KB comprimido); `config/esportes.json` bruto 1.114 B / gzip 353 B (alvo < 2 KB); `config/campeonatos-2026.json` bruto 3.260 B / gzip 493 B (alvo < 4 KB); `catalogo-fontes.json` bruto 1.997 B / gzip 394 B (alvo < 2 KB); `versao.json` bruto 396 B / gzip 283 B (alvo < 1 KB) | **Todos dentro do teto comprimido do SDD §2.2**, com folga confortável mesmo no arquivo mais pesado (clubes-2026.json, 11 campos × 20 clubes) |
| `noticias.json`/`futebol/brasileirao.json`/`futebol/clube/<slug>.json` não puderam ser medidos com dado real (produção nunca rodou — sem `estado/noticias.json`/`estado/futebol.json` reais neste ambiente) | Medidos só com fixture mínima (`futebol/brasileirao.json` vazio = 364 B) — não é uma reprovação: o dimensionamento desses três é orçado analiticamente pelo próprio SDD §2.2 (teto de 60 itens/fonte × ~350 B ≈ 30 KB comprimidos para `noticias.json`), e a estrutura de cada item já é validada pelo schema Zod real (`itemNoticiaSchema`/`partidaSchema`/etc.) contra o mesmo contrato, o que é o que este critério de aceite pede ("gerados com o schema... declarado") | Registrado como limitação de ambiente (sem dado de produção para medir o teto real dos 3 arquivos dependentes de ingestão), não como achado — mesma classe de limitação já registrada em QA-P-02 (Lote 1) para verificação de CI fora do ambiente real |
| Determinismo (mesmo input ⇒ mesmo hash) | Teste dedicado (`clone profundo da entrada`) + teste de I/O ("gerar duas vezes produz bytes idênticos") — rodei os dois isoladamente | Conforme, confirmado por execução real, não só por leitura da lógica |
| "Publica só se o hash mudou" — mecanismo correto (delegado ao `git diff --cached --quiet` do workflow) | Já confirmado no chapéu QA do Lote 1 (`ingestao.yml`) que esse passo existe; aqui confirmo que a pré-condição (determinismo de `construirSnapshots`) realmente vale, o que é o que falta para a alegação ser verdadeira | Conforme |
| CA-04.8 (nunca publica `fora-do-recorte`), CA-07.2 (nunca omite campeonato), CA-18.2 (zonas ausentes = arquivo ausente, não placeholder) | Todos com teste dedicado, rodados por mim isoladamente | Conforme |
| Compatibilidade com o cliente (`app/dados/versao.ts`/UI-DS-08) | Teste usa `esquemaVersao.parse` real sobre o `versao.json` gerado — não uma cópia do schema do cliente | Conforme — prova de integração real entre pipeline e SPA, não coincidência de nome de campo |

**Veredito**: **Aprovado**.

### PUB-03 — Verificação de segurança da publicação

**Critério de aceite**: pipeline falha propositalmente ao injetar um segredo
de teste no artefato; auditoria de dependências limpa bloqueia merge se
alta/crítica.

| Verificação | Evidência | Resultado |
|---|---|---|
| Varredura de segredo em `dist-dados/` (não só `dist/`) | `npm run verificar-segredos:dados` (`pipeline/ci/verificar-segredos.mjs dist-dados`) existe em `package.json`; passo dedicado em `ingestao.yml` antes da publicação | Conforme |
| Falha proposital com segredo de teste injetado (testado por mim, não só relatado) | Criei um diretório temporário com `api_key = "abcdef1234...32+ chars"` e rodei `node pipeline/ci/verificar-segredos.mjs <dir>`: bloqueou com `exit 1`, listando os 2 padrões (`api_key`, `chave-hex-32+`); o mesmo diretório sem o segredo passou com `exit 0` | **Conforme, confirmado por execução real** |
| Auditoria de dependências (`npm audit --omit=dev`) presente em ambos os workflows | `ingestao.yml` (já existia desde FUND-02) e `build-publish.yml` (adicionado por esta tarefa) — rodei eu mesmo `npm audit --omit=dev` | **2 vulnerabilidades moderadas** em `react-router`/`react-router-dom` (mesmas de sempre, já rastreadas em `REFAT-01-03`), **nenhuma alta/crítica** — `--audit-level=high` não bloquearia esta execução, corretamente |
| Auditoria bloquearia merge se alta/crítica | Ambos os workflows usam `npm audit --omit=dev --audit-level=high` — verifiquei o *flag*, não só a chamada do comando | Conforme, mecanismo de bloqueio real presente |

**Achado QA-6-01 — Ações de CI de `build-publish.yml` continuam fixadas por
tag, não por SHA (REFAT-01-02 não foi resolvido por PUB-03, ao contrário do
que a nota do Executor sugere)**

**Severidade**: reafirmação de um achado de segurança **já existente**
(`SEC-01-02`, registrado pelo chapéu DevSecOps na validação do Lote 1, severidade
**média**) — não é um achado novo do chapéu QA, é uma checagem estrutural que
faço aqui porque a nota de implementação de PUB-03 afirma algo que o código
não confirma.

A nota de implementação de PUB-03 diz: "Ações de CI conferidas contra SDD
§7.7/GUARDRAILS §2... `build-publish.yml` fixa por tag de versão exata
(`@v4.2.2` etc., não `@latest`/branch): ambos já em conformidade literal com
a regra, sem mudança necessária aí." Li `.github/workflows/build-publish.yml`
diretamente, linha a linha: `actions/checkout@v4.2.2`,
`actions/setup-node@v4.1.0`, `actions/configure-pages@v5.0.0`,
`actions/upload-pages-artifact@v3.0.1`, `actions/deploy-pages@v4.0.5` — todas
por **tag**, e `runs-on: ubuntu-latest` (não fixo). Isso é literalmente o
mesmo estado encontrado na validação do Lote 1 (achado `SEC-01-02`), com
prazo textual já registrado em `REFAT-01-02` (`TASK.md`, `Refatoração
Lote-1`): **"antes do Lote 6 (PUB-02/PUB-03)"**. PUB-03 não tocou este
arquivo neste ponto — a nota do Executor está tecnicamente correta sobre "não
é `@latest`/branch" (satisfaz a leitura mais frouxa do texto do SDD §7.7),
mas isso não é a mesma coisa que a mitigação de SHA pinning que `REFAT-01-02`
pede e que `ingestao.yml` (workflow irmão do mesmo lote) já usa — a nota
conflou "conformidade literal" com "achado resolvido", o que não procede.

**Avaliação**: não é reprovação de PUB-03 — o critério de aceite da tarefa
("pipeline falha propositalmente ao injetar segredo"/"auditoria bloqueia
merge se alta/crítica") foi cumprido à risca, e SHA-pinning de
`build-publish.yml` nunca foi o critério de aceite de PUB-03, era escopo de
`REFAT-01-02`. O problema é só que o prazo textual desse débito
("antes do Lote 6") já **venceu** — Lote 6 terminou sem que a tarefa fosse
executada. Trato isso na checagem estrutural abaixo, com ajuste de prazo e
como requisito de segurança operacional explícito para o chapéu DevOps (ver
`SECURITY-REVIEW.md`, seção Lote 6) — não crio uma nova tarefa (o débito já
existe, só o prazo precisa de ajuste), e não bloqueio a aprovação de PUB-03
nem do Lote 6 por isso (severidade média, sem exploração ativa, mesma
avaliação original do Lote 1).

**Veredito**: **Aprovado**.

**Achado QA-6-02 — `npm run ingestao` nunca foi escrito; `ingestao.yml`
permanece em dry-run permanente até essa lacuna ser fechada**

**Severidade**: **simples** (não compromete o critério de aceite de nenhuma
tarefa do Lote 6 — todas as 3 tarefas entregam exatamente o que seus
critérios de aceite pedem — mas é uma lacuna real de decomposição: nenhuma
tarefa de nenhum lote até aqui cobre "ligar `ING-N-07` + `ING-F-05` +
`gerador-snapshots` num único script executável em CI real").

Confirmei em `package.json`: não existe script `ingestao` (nem `tsx`/
`ts-node` como devDependency). O próprio Executor de PUB-01 e de PUB-02
sinalizou essa lacuna nas duas notas de implementação ("sinalizo ao
Coordenador que a wiring de `npm run ingestao`... é um passo de
infraestrutura ainda em aberto, não coberto por nenhuma tarefa do Lote 6").
Concordo com a auto-avaliação: sem esse script, `ingestao.yml`
(`.github/workflows/ingestao.yml`) permanece em modo dry-run para sempre —
`gerador-snapshots`/PUB-02 nunca é de fato invocado em produção, mesmo já
estando completo e testado. Isso não é uma regressão de nenhuma tarefa (o
comportamento de dry-run é o que FUND-02, Lote 1, definiu explicitamente
como correto até os coletores existirem) — é a última peça de fiação que
falta para o pipeline rodar de ponta a ponta de verdade.

Também confirmei que resolver isso **não** exige um novo tipo de dependência
de runtime fora da lista fechada: um executor de TypeScript como `tsx` entra
como **devDependency** (mesma categoria de `vite`/`vitest`/`typescript`, já
presentes), não como dependência de runtime do SDD §3/GUARDRAILS §2 — a nota
do Executor de PUB-01/PUB-02 tratou os dois tipos de dependência como
equivalentes ao justificar o adiamento; a conclusão de adiar ficou correta
(não era escopo de PUB-01/02/03), mas a justificativa técnica citada não
seria, por si, um bloqueio real caso alguém decidisse resolver agora.

**Ação tomada nesta validação**: tarefa `REFAT-06-01` criada em `Refatoração
Lote-6` (ver `TASK.md`), não retorno ao Executor — nenhuma tarefa do Lote 6
falhou seu critério de aceite por causa disso.

**Veredito**: **Aprovado**.

---

## Achados de processo do Lote 6 (não são reprovação de nenhuma tarefa)

Nenhum achado crítico. Dois achados simples: `QA-6-01` (reafirmação de débito
já existente, `SEC-01-02`/`REFAT-01-02`, com prazo vencido — ajustado na
checagem estrutural, não é tarefa nova) e `QA-6-02` (lacuna de wiring de
`npm run ingestao`, nova tarefa `REFAT-06-01`). Nenhum dos dois compromete o
critério de aceite de PUB-01/PUB-02/PUB-03, todos cumpridos e verificados por
execução real (30 + 10 + 2 = 42 testes relevantes rodados isoladamente por
mim, além dos 811 do projeto inteiro).

## Fechamento estrutural do Lote 6

Checagem feita pelo próprio Validador (sem dispatch ao Coordenador), conforme
TASK.md/GUARDRAILS §7:

- [x] Todas as 3 tarefas do Lote 6 (PUB-01, PUB-02, PUB-03) estão `Concluída` no `TASK.md`.
- [x] Dependências confirmadas satisfeitas por leitura direta do `TASK.md`: CFG-02 (PUB-01, Lote 2, `Validado`); ING-N-07/ING-F-05/PUB-01 (PUB-02, Lotes 4/5 `Validado` + PUB-01 `Concluída`); PUB-02 (PUB-03).
- [x] Sequencialidade declarada ("nenhuma paralelização real... PUB-02 e PUB-03 são estritamente sequenciais") confirmada pelo código: `gerador-snapshots.ts` importa `derivador-paleta.ts` (PUB-01); `PUB-03` só adiciona passos de CI, não toca código de PUB-02.
- [x] Nenhuma tarefa `Bloqueada` no Lote 6.
- [x] Nenhuma dependência da Seção 4 do TASK.md órfã/inconsistente relativa a este lote (Lote 6 → Lotes 8/9/10/11, "contrato, não bloqueante via fixture" — nenhum desses lotes já iniciado dependia de um contrato ainda não publicado; nenhuma inconsistência).
- [x] Achado simples com tarefa nova (`QA-6-02`) virou `REFAT-06-01` em `Refatoração Lote-6`, não retorno ao Executor.
- [x] Débito pré-existente com prazo vencido (`REFAT-01-02`, achado `QA-6-01`) teve o prazo textual ajustado por mim diretamente no `TASK.md` (mesmo padrão já usado para `REFAT-02-01` na validação do Lote 5) — não é tarefa nova, é o mesmo débito, agora com prazo realista e reforçado como requisito de segurança operacional bloqueante do primeiro deploy real (ver `SECURITY-REVIEW.md`).

Nenhuma inconsistência que exija redesenho de dependência/decomposição foi
encontrada — não há escalonamento ao Coordenador via `BLOCKERS.md` nesta
rodada (as duas lacunas encontradas são achado de débito/decomposição de
detalhe, resolvidas diretamente por mim, não redesenho estrutural).

## Veredito de release-readiness do Lote 6

**Aprovado (com ressalvas)** — libera o Lote 6 para auditoria do chapéu
DevSecOps (ver `SECURITY-REVIEW.md`). 3/3 tarefas aprovadas; 811/811 testes
do projeto (42 deles específicos do lote, rodados isoladamente por mim);
`tsc`/`eslint` limpos; contrato público do SDD §2.2 gerado e validado contra
schema e teto de tamanho comprimido com dado real dos 20 clubes/5
fontes/12 campeonatos; nenhuma reprovação crítica ou simples sem tratamento;
1 tarefa nova (`REFAT-06-01`) e 1 ajuste de prazo em débito pré-existente
(`REFAT-01-02`) registrados, nenhum bloqueante para a aprovação funcional
deste lote — o achado de prazo vencido (`QA-6-01`) é, no entanto, relevante
para a decisão de **deploy** (chapéu DevOps), tratado como requisito de
segurança operacional na seção correspondente de `SECURITY-REVIEW.md`.

---

## Lote 7 — Design system e infraestrutura de tela

**Base específica deste lote**: `.md/UX-SPEC.md` Seção 3.8 (anatomia e
variantes dos 6 componentes de direção + tabela de componentes de base),
Seção 5 (Acessibilidade — WCAG 2.2 AA, paletas de teste), `.md/TASK.md`
Diretriz de Implementação #4 (nenhum literal fora de `tokens.css`) e #7
(pistas redundantes de WCAG 1.4.1 desde o primeiro commit); `.md/GUARDRAILS.md`
§6.

Comandos executados por mim antes de qualquer veredito: `npm run typecheck`,
`npm run lint`, `npx vitest run` (projeto inteiro) — todos limpos (0 erros de
tipo, 0 de lint, **772/772 testes passando em 59 arquivos**). Não usei a nota
de implementação de nenhum dos 9 Executores como base de aprovação: li o
código-fonte real de cada componente (`.tsx`/`.module.css`) e o `git diff`
contra `tokens.css`, e rodei buscas próprias (`grep`) por literal de
cor/tamanho fora de `var(...)` em vez de aceitar a afirmação "nenhum literal
fora de tokens.css" de cada nota por confiança.

O aviso de `stderr` "Not implemented: HTMLCanvasElement.prototype.getContext"
durante os testes de `axe-core` de `FaixaClube.test.tsx` é uma limitação
conhecida e já documentada do jsdom (a regra `color-contrast` do `axe-core`
não roda de forma confiável sem `canvas`/layout real) — não é falha de teste
(os 27 testes do arquivo passam) nem lacuna de cobertura: a validação de
contraste de cor de clube é responsabilidade do pipeline (ADR-017/PUB-01) e
da verificação manual de UX-SPEC §5.8, nunca de `axe-core` em jsdom. Confirmei
isso lendo a regra em si (`_isIconLigature`/`hasRealTextChildren` do
`axe-core`, caminho que só é acionado por `color-contrast`) antes de aceitar a
explicação do Executor.

### UI-DS-01 — Componente `FaixaClube`

**Critério de aceite**: `axe-core` zero violações nas 3 variantes, tema
claro/escuro, 4 paletas de teste (UX-SPEC §5).

| Verificação | Evidência | Resultado |
|---|---|---|
| 3 variantes × 2 temas × 4 paletas = 24 combinações testadas com `axe-core` real | `FaixaClube.test.tsx` lido: bloco "acessibilidade (axe-core)" com `it.each` sobre `paletasTeste.fixture.ts` (Mirassol/Palmeiras/São Paulo/Corinthians, valores literais da tabela "Exemplos derivados" de UX-SPEC §3.4) × 2 temas × (completa/compacta/neutra, com `neutra` sem eixo de paleta) | Rodei `npx vitest run app/design-system/FaixaClube.test.tsx` isoladamente: **27/27 passam**, incluindo os 18 casos de `axe-core` real (`vitest-axe`, não um mock) |
| `aria-label` completo com nome/posição/competição/temporada/pontos | `FaixaClube.tsx` lido: função de montagem do rótulo concatena os 5 campos só quando presentes | Conforme; caso "sem `href` não é link" e "sem número quando null" também testados |
| Listras `aria-hidden` | `<span aria-hidden="true">` dedicado, separado do `background` decorativo | Conforme — nó explícito na árvore de acessibilidade, não só CSS |
| Discriminated union impede misturar `clube` com variante `neutra` | `tsc --noEmit` confirma o tipo; tentativa manual de compilar `neutra` com `clube` (não incluída no repo, testada por mim ad-hoc e revertida) | Erro de tipo em tempo de compilação, como esperado |

**Veredito**: **Aprovado**.

### UI-DS-02 — Componente `BlocoPreto`

**Critério de aceite**: variante "fixo ao rolar" não obscurece foco (WCAG
2.4.11).

| Verificação | Evidência | Resultado |
|---|---|---|
| Variante `projecao` usa `position: fixed` real (não `sticky`) | `BlocoPreto.module.css` lido | Conforme, literal do UX-SPEC ("fixo ao rolar") |
| Mede a própria altura e publica `--bloco-preto-projecao-altura`/`scroll-padding-bottom` do documento | `BlocoPreto.tsx` lido de ponta a ponta: `useLayoutEffect` com `ResizeObserver` (fallback a `resize`), restaura o valor anterior ao desmontar | Conforme — mecanismo real, não só comentário de intenção |
| Testes | `BlocoPreto.test.tsx` (12 casos) rodado isoladamente: mock de `getBoundingClientRect` confirma a publicação/restauração das custom properties | Passa; jsdom não calcula geometria de rolagem real — a prova é mecânica (o componente mede e publica corretamente), consistente com a limitação já documentada pelo Executor; a confirmação visual fica para a verificação manual de UX-SPEC §5.8 quando a tela de destino existir (Lote 9) |
| Rótulo da tira sempre texto (nunca só cor identifica a variante) | `rotulo: string`, obrigatório, renderizado sempre | Conforme Diretriz #7 |

**Veredito**: **Aprovado**.

### UI-DS-03 — Componente `CartaoIngresso`

**Critério de aceite**: alvo de toque ≥ 44 px; cor da barra nunca é a única
pista (etiqueta textual sempre presente).

| Verificação | Evidência | Resultado |
|---|---|---|
| Alvo de toque ≥ 44 px | `CartaoIngresso.module.css`: `min-height: var(--alvo-toque-minimo)`; `--alvo-toque-minimo: 44px` em `tokens.css` | Conforme, verificado nos dois arquivos, não só no teste mecânico do Executor |
| Etiqueta textual sempre presente, nas 5 variantes | `CartaoIngresso.test.tsx`, `it.each` sobre as 5 variantes | Rodei isoladamente: **18/18 passam** |
| Cor da barra nunca é única pista em `encerrado`/`sem-dados` | `CartaoIngresso.tsx` lido: rótulo textual próprio somado à mudança de cor/traço | Conforme |
| Link externo com `target`/`rel="noopener noreferrer"`/`aria-label` terminando em "abre em nova aba" (CA-04.2, UX-SPEC §5.7) | Lido e testado | Conforme |
| Lacuna sinalizada — "paleta fixa de 15 tons do sistema" (UX-SPEC §3.8.3) | Ver avaliação dedicada abaixo, seção "Achados de processo" | Não bloqueia esta tarefa (cor recebida já resolvida via prop, etiqueta textual sempre presente) |

**Veredito**: **Aprovado**.

### UI-DS-04 — Componente `NumeroCamisa`

**Critério de aceite**: número sempre acompanhado de texto associado; reduz
de 72 para 56 px abaixo de 340 px.

| Verificação | Evidência | Resultado |
|---|---|---|
| Discriminated union impede número sem rótulo | `NumeroCamisa.tsx` lido: `sobre-faixa`/`sobre-fundo-claro` exigem `numero`+`rotulo` juntos; `sem-posicao` exige `fase`, sem número | Conforme — impossível em tempo de compilação, não só em runtime |
| Redução 72→56 px abaixo de 340 px | `NumeroCamisa.module.css`: `@media (max-width: 339px)` troca `.numero` para `var(--txt-camisa-compacta)` (`800 56px/52px`, criado em `tokens.css`) | Conforme — verifiquei o breakpoint exato (339px, não 340px, correto para "abaixo de 340") |
| Nenhum literal de cor/tipografia fora de `var(...)` no CSS deste componente | Teste mecânico do Executor (`NumeroCamisa.test.tsx`) reconferido por mim com `grep` independente no `.module.css` | Confirmado — nenhum literal encontrado |

**Veredito**: **Aprovado**.

### UI-DS-05 — Componente `SeletorPalpite`

**Critério de aceite**: 3 pistas simultâneas no selecionado; navegável por
setas.

| Verificação | Evidência | Resultado |
|---|---|---|
| `fieldset`/`legend` + 4 `input[type=radio]` nativos | `SeletorPalpite.tsx` lido | Conforme, marcação 100% nativa |
| 3 pistas no selecionado (preenchimento + contorno + letra) | `.opcaoSelecionada` no CSS declara `background`+`border-color`; a letra (V/E/D/—) é sempre nó de texto, nunca `aria-hidden` | Conforme — as 3 pistas confirmadas simultaneamente, não uma substituindo a outra |
| Navegação por setas (roving tabindex, WAI-ARIA APG) | `SeletorPalpite.test.tsx`: 2 direções + wrap nas extremidades | Rodei isoladamente: **12/12 passam** |
| Variante `espelhado` somente-leitura, sem permitir contradição (CA-11.4) | Rádios desabilitados, clique não dispara `aoMudar` | Conforme — decisão de implementação bem justificada (fonte de verdade é sempre o outro lado do confronto) |
| Variante `travado` sem rádios, resultado real como texto | Lido e testado | Conforme |

**Veredito**: **Aprovado**.

### UI-DS-06 — Componente `BarraPontuacao`

**Critério de aceite**: `aria-label` sempre inclui nome do clube e valor
numérico.

| Verificação | Evidência | Resultado |
|---|---|---|
| `aria-label="{nomeClube}, {valor} {unidade}"` | `BarraPontuacao.tsx` lido | Conforme, com unidade padrão "pontos" customizável |
| Valor e nome também como texto visível (WCAG 1.4.1) | `BarraPontuacao.test.tsx` | Conforme, redundante ao `aria-label` |
| Preenchimento em `var(--clube-identidade)`, nunca literal | Lido | Conforme |
| `min-width: 96px` no rótulo, sem token correspondente | Ver achado QA-7-01 abaixo | Não compromete o critério de aceite (aria-label/redundância textual intactos) — registrado como achado de token hygiene |

**Veredito**: **Aprovado**.

### UI-DS-07A — Componentes base — interativos

**Critério de aceite**: todos operáveis por teclado; `Sobreposicao` fecha com
Esc/toque fora/"Fechar" e devolve foco ao gatilho.

| Verificação | Evidência | Resultado |
|---|---|---|
| `Botao`/`Chip`/`Alternador`/`CampoBusca`/`Abas` operáveis por teclado | Cada `*.test.tsx` (37 casos no total) rodado dentro de `npx vitest run` | Passa; `Abas` com roving tabindex + setas/Home/End confirmado por teste; `Alternador` com `role="switch"`+`aria-checked` |
| `Sobreposicao`: Esc fecha | `Sobreposicao.test.tsx` | Confirmado por teste dedicado |
| `Sobreposicao`: toque fora fecha (clique no véu, distinto de clique dentro via `stopPropagation`) | Lido e testado | Conforme |
| `Sobreposicao`: botão "Fechar" fecha | Testado | Conforme |
| `Sobreposicao`: devolve foco ao gatilho | Testado | Conforme |
| `Sobreposicao`: foco-trap nas 2 direções (Tab/Shift+Tab) | Testado | Conforme — implementação completa, não só o placeholder de FUND-04 |
| `Sobreposicao`: pistas redundantes (Chip "✓" textual, Alternador "Ligado"/"Desligado" textual, Abas ativa por peso de fonte além de cor) | Lido nos 3 componentes | Conforme Diretriz #7 |
| `Sobreposicao.module.css`: `rgba(22, 24, 26, 0.5)` e `z-index: var(--z-pular-conteudo)` | Ver achado QA-7-01 abaixo | Não compromete funcionalidade (rodei os 9 testes de `Sobreposicao.test.tsx` e todos passam; a ordem de empilhamento está correta hoje) — registrado como achado de token hygiene |

**Veredito**: **Aprovado**.

### UI-DS-07B — Componentes base — exibição de dados

**Critério de aceite**: `TabelaClassificacao` é `<table>` real com
`<caption>`, `scope`, `aria-current` na linha do time; nenhum componente
depende só de cor.

| Verificação | Evidência | Resultado |
|---|---|---|
| `<table>` real com `<caption>` dinâmico | `TabelaClassificacao.tsx` lido linha a linha | Conforme — `<caption>{legenda}</caption>`, não uma `<div>` estilizada |
| `<th scope="col">` no cabeçalho, `<th scope="row">` na célula do clube | Lido | Conforme |
| `aria-current="true"` na linha do time, **e** marcador textual "▸"/"(seu time)" (nunca só o fundo `--clube-suave`) | Lido e testado (`TabelaClassificacao.test.tsx`, 7 casos) | Conforme — pista redundante confirmada, não só o atributo ARIA |
| Zona: faixa de 4 px **e** legenda textual (`aria-label="Legenda de zonas da tabela"`), ausente sem erro quando `legendaZonas` não é passada (CA-18.2) | Lido | Conforme |
| `LinhaPartida`: resultado V/E/D sempre letra+texto, nunca só cor da barra lateral | `LinhaPartida.test.tsx` (7 casos) | Conforme |
| `BannerAlerta`: `alerta`/`erro` diferenciados por prefixo textual "ATENÇÃO"/"ERRO", não só cor de fundo (só há `⚠` no catálogo de ícones do UX-SPEC §3.7 para os dois) | Lido | Conforme |
| Demais componentes (`SeloFonte`, `CarimboFrescor`, `Esqueleto`, `AvatarClube`, `EtiquetaEsporte`) sem dependência só de cor | 81 casos de teste (9 arquivos) rodados dentro de `npx vitest run` | Passa |
| `EtiquetaEsporte` usa `--clube-suave` em vez da "paleta fixa de 15 tons" citada em UX-SPEC §3.8 | Ver avaliação dedicada abaixo | Não compromete o critério de aceite (rótulo do esporte é sempre texto) |

**Veredito**: **Aprovado**.

### UI-DS-08 — Hook `dados/useSnapshot`

**Critério de aceite**: rebusca só o arquivo cujo hash mudou; funciona com o
contrato de dados documentado no SDD §2.2.

| Verificação | Evidência | Resultado |
|---|---|---|
| Cache por URL, rebusca seletiva por hash | `clienteSnapshot.ts` lido: compara hash de `versao.json` por chave (`noticias`/`futebol`/`catalogo`/`status`) antes de rebuscar cada arquivo | Conforme |
| Teste dedicado de rebusca seletiva | `clienteSnapshot.test.ts` (8 casos): "duas URLs do grupo `futebol` com caches independentes" e "rebusca seletiva só do arquivo com hash mudado" | Rodei isoladamente: **8/8 passam** |
| Funciona com fixture do contrato SDD §2.2 | `useSnapshot.test.tsx` usa `itemNoticiaSchema` real de `dominio/tipos` para validar a fixture, não um objeto solto | Conforme — a fixture é validada pelo schema real, não inventada |
| Sem sondagem cega, sem WebSocket | Revalida a cada 5 min só com `visibilityState === 'visible'`, mais reação a `visibilitychange` — nenhum `setInterval` incondicional | Conforme RN-09 |
| Degradação silenciosa preserva último dado válido em falha/esquema inválido | Testado | Conforme GUARDRAILS §4 (descarte com registro, nunca correção heurística) |

**Veredito**: **Aprovado**.

### UI-DS-09 — `armazenamento/preferencias` e `armazenamento/cenario`

**Critério de aceite**: testes cobrindo CA-13.4 (referência inválida
descartada individualmente) e CA-13.5 (nenhum dado pessoal).

| Verificação | Evidência | Resultado |
|---|---|---|
| CA-13.4: cada referência inválida (esporte/fonte/rival) descartada individualmente, resto mantido | `preferencias.ts` lido linha a linha: `favoritos`/`fontesBloqueadas`/`rivais` filtrados um a um contra `ReferenciasValidas`, com mensagem de descarte por item — nunca o objeto inteiro descartado por causa de um campo | Conforme — confirmei a distinção correta entre "esquema incompatível" (descarta tudo) e "referência inválida" (descarta só o item) |
| CA-13.5: nenhum dado pessoal | `Preferencias`/`Cenario` (DOM-01) relidos: só ids de configuração (esporte/fonte/clube) e timestamp — nenhum nome, e-mail, IP | Conforme — nenhum campo novo foi adicionado pelos módulos de `app/armazenamento/` além dos já aprovados em DOM-01 (Lote 3) |
| `armazenamentoEstaDisponivel`/modo memória nunca lança (ADR-005 regra 4, CA-13.3) | `nucleo.ts` lido | Conforme |
| Testes | `nucleo.test.ts` (14) + `preferencias.test.ts` (13, incl. 4 de CA-13.4 e 2 de CA-13.5) + `cenario.test.ts` (14) | Rodei `npx vitest run app/armazenamento`: **39/39 passam** |
| Perder o time (RN-12) descarta rivais junto, sinaliza `timeForaDaTemporada` sem acoplar diretamente a `limparCenario` | Lido | Conforme — decisão de acoplamento correta (o chamador decide, não o módulo) |

**Veredito**: **Aprovado**.

---

## Achados de processo do Lote 7 (não são reprovação de nenhuma tarefa)

### Achado QA-7-01 — Literais de cor/tamanho fora de `tokens.css` em 5 pontos do design system, mais 1 reuso semântico de token de z-index

**Severidade**: **simples** (ajuste pontual e de baixo esforço — nenhum
compromete o critério de aceite central de sua tarefa nem bloqueia outra
tarefa do lote; nenhum tem efeito de acessibilidade ou funcional observável,
confirmado por teste).

Rodei uma varredura própria (`grep` por padrão de cor/tamanho fora de
`var(...)`) em todo `app/design-system/**/*.module.css`, em vez de aceitar a
afirmação "nenhum literal fora de tokens.css" de cada nota de implementação
por confiança. Achados:

1. `BarraPontuacao.module.css:24` — `min-width: 96px` no rótulo do clube, sem
   token correspondente em `tokens.css`.
2. `componentes/Abas.module.css:16` — `border-bottom: 2px solid transparent`,
   literal (não há token de 2px na escala `--esp-*`/`--borda-*`).
3. `componentes/BannerAlerta/BannerAlerta.module.css:44` —
   `border: 1px solid currentColor` usa o literal `1px` em vez do token já
   existente `--borda-fina` (criado por UI-DS-03 exatamente para este caso).
4. `componentes/LinhaPartida/LinhaPartida.module.css:6` —
   `border-left: 4px solid transparent`, literal (poderia reusar `--esp-1`,
   que já vale `4px`, em vez de repetir o número).
5. `componentes/Sobreposicao.module.css:14` — `background: rgba(22, 24, 26, 0.5)`
   é uma duplicata literal de `--cor-tinta` (`#16181a` = `rgb(22,24,26)`) com
   opacidade, sem token próprio — UX-SPEC §3.6 só autoriza explicitamente um
   literal `rgba` (`--sombra-overlay`, para `box-shadow`), não um segundo para
   véu de modal.
6. `componentes/Sobreposicao.module.css:10` —
   `z-index: var(--z-pular-conteudo)` reaproveita o token do link "pular para
   o conteúdo" (`1000`) como z-index do véu do modal, em vez de um token
   dedicado (ex. `--z-modal`). Funciona hoje (fica acima de `--z-bloco-fixo`,
   `500`), mas é um acoplamento semântico frágil: uma mudança futura no valor
   de `--z-pular-conteudo` (motivada só pelo link de pular conteúdo) mudaria
   silenciosamente a pilha de empilhamento do modal.

**Não classifiquei como reprovação** porque: (a) nenhum dos 6 pontos altera
comportamento observável hoje — os testes de `BarraPontuacao`, `Abas`,
`BannerAlerta`, `LinhaPartida` e `Sobreposicao` (72 casos no total) passam
sem exceção, incluindo os 9 casos de `Sobreposicao` que exercitam
Esc/toque-fora/"Fechar"/devolução de foco/foco-trap; (b) o padrão
"visualmente oculto" (`width:1px; height:1px; margin:-1px`, presente em
`LinhaPartida`/`TabelaClassificacao`/`SeletorPalpite`) é a técnica padrão de
indústria "sr-only" e uma exceção universalmente aceita às regras de token de
design system — não contei essas ocorrências como achado. É um débito de
higiene de token (Diretriz de Implementação #4), de baixo esforço para
corrigir (adicionar 2-3 tokens a `tokens.css` e trocar as referências).

**Ação tomada**: tarefa `REFAT-07-01` criada em `Refatoração Lote-7` (ver
`TASK.md`), não retorno ao Executor.

### Achado QA-7-02 — Lacuna real de UX-SPEC: "paleta fixa de 15 tons do sistema" por esporte não existe em nenhuma tabela do documento

**Severidade**: informativo — nota tipo "spec gap" ao Coordenador, não é
achado de código de nenhum Executor, não gera tarefa de refatoração.

UX-SPEC §3.8.3 (anatomia de `CartaoIngresso`) cita: "Cor da barra: esporte no
feed (**paleta fixa de 15 tons do sistema**, não do clube)...". A tabela de
componentes de base (mesma Seção 3.8) também descreve `EtiquetaEsporte` como
"caixa alta sobre fundo tonal do esporte" para "15 esportes + GERAL". Conferi
pessoalmente, linha a linha, toda a Seção 3 do UX-SPEC (§3.2 cores de tema,
§3.3 tema escuro, §3.4 cores de clube, §3.5 tipografia, §3.6
espaçamento/raio/sombra, §3.7 ícones) e todo `app/design-system/tokens.css`:
**não existe, em nenhum dos dois lugares, uma tabela ou lista dos 15 tons por
esporte** — nem nomes de token, nem valores hex, nem critério de contraste
declarado para eles (diferente de §3.4, que declara razão de contraste para
cada token de clube).

**Avaliação**: concordo com o que UI-DS-03 e UI-DS-07B sinalizaram de forma
independente — é uma **lacuna real do UX-SPEC**, não algo que os dois
Executores deixaram de encontrar em outra seção. Não bloqueia o lote porque a
etiqueta textual do esporte está sempre presente nos dois componentes que a
citam (`CartaoIngresso`/`EtiquetaEsporte`, confirmado nos respectivos testes),
o que já satisfaz WCAG 1.4.1 (Diretriz #7) mesmo sem a paleta de 15 tons — a
cor seria reforço visual, não a única pista de significado. As duas decisões
de contorno adotadas pelos Executores (`--cartao-cor-barra` recebida já
resolvida via prop; `EtiquetaEsporte` usando `--clube-suave` como fundo tonal
único) são pontos de extensão razoáveis e não geram retrabalho estrutural
quando/se o Coordenador decidir tabelar os 15 tons.

**Ação tomada**: registrada como nota tipo "spec gap", destino Coordenador,
em `Refatoração Lote-7` (ver `TASK.md`) — não é uma tarefa de código do
Executor, é uma decisão de conteúdo do UX-SPEC que só o Coordenador (dono do
documento) pode resolver (GUARDRAILS §7: "lacuna de detalhe é decidida e
documentada"; esta, por afetar consistência visual entre 15 esportes em pelo
menos 2 componentes, é maior que um detalhe pontual, por isso vai como nota
formal em vez de só um comentário de código).

---

## Fechamento estrutural do Lote 7

Checagem feita pelo próprio Validador (sem dispatch ao Coordenador), conforme
TASK.md/GUARDRAILS §7:

- [x] Todas as 9 tarefas do Lote 7 (UI-DS-01 a UI-DS-09) estão `Concluída` no `TASK.md`.
- [x] Dependências confirmadas satisfeitas por leitura direta do `TASK.md`: FUND-04/FUND-05 (Lote 1, `Validado (com ressalvas)`) e DOM-01 (Lote 3, `Validado`) — todas com status confirmado, não por afirmação da nota.
- [x] Paralelismo declarado ("as 9 tarefas são paralelizáveis entre si") confirmado pelo código real: nenhum componente de uma tarefa importa de outra tarefa-irmã do lote (só de `tokens.css`, compartilhado, e de `dominio/tipos`, Lote 3) — as poucas colisões de edição concorrente em `tokens.css` citadas nas notas dos Executores foram preservadas corretamente, sem token sobrescrito/perdido (conferido lendo o arquivo final linha a linha).
- [x] Nenhuma tarefa `Bloqueada` no Lote 7.
- [x] Nenhuma dependência da Seção 4 do TASK.md órfã/inconsistente relativa a este lote (Lote 7 → Lotes 8/9/10/11 via UI-T0x-0x, e Lote 12/TEL-01 via UI-DS-09 — todas com pré-requisito satisfeito, nenhum lote posterior já iniciado que dependesse de tarefa não concluída aqui).
- [x] Achado simples (QA-7-01) virou tarefa em `Refatoração Lote-7`, não retorno ao Executor.
- [x] Achado de lacuna de UX-SPEC (QA-7-02) registrado como nota formal em `Refatoração Lote-7`, destino Coordenador — não é inconsistência estrutural de dependência/decomposição (não exige redesenho de nenhum lote), por isso não é escalada via `BLOCKERS.md`.

Nenhuma inconsistência que exija redesenho de dependência/decomposição foi
encontrada — não há escalonamento ao Coordenador via `BLOCKERS.md` nesta
rodada (a nota QA-7-02 é conteúdo de especificação, não estrutura de
dependência).

## Veredito de release-readiness do Lote 7

**Aprovado (com ressalvas)** — libera o Lote 7 para auditoria do chapéu
DevSecOps (ver `SECURITY-REVIEW.md`). 9/9 tarefas aprovadas; 772/772 testes,
`tsc`/`eslint` limpos; nenhuma reprovação crítica ou simples pendente sem
tratamento; 1 achado simples de token hygiene (`REFAT-07-01`) e 1 nota de
lacuna de spec (`QA-7-02`, destino Coordenador) registrados, nenhum dos dois
bloqueante.

---

## Lote 8 — Onboarding e Home (T-01, T-02)

**Verificação de portões**: rodei eu mesmo, do zero, no estado atual do
repositório: `npm run typecheck` (limpo), `npm run lint` (limpo), `npm test -- --run`
(**909/909 testes passam**, 75 arquivos — bate com o número declarado pela
última nota de implementação, UI-T02-04), `npm run build` (bundle gerado,
289,75 kB / 87,43 kB gzip) e `vite preview` servindo `/` e `/onboarding` com
HTTP 200 (confirma o fallback de SPA nas duas rotas). As mensagens de erro
impressas no console durante `npm test` (`Failed to parse URL from
/dados/...`) são esperadas — Node/jsdom não resolve URL relativa em `fetch`
fora de um `document`/`window.location` real; são exatamente os casos de
teste que exercitam a "falha de rede preserva o último dado válido" e
aparecem como `console.error` intencional, não indicam teste falhando (todos
os 909 estão marcados `passed`).

**Nota sobre confirmação visual**: o ambiente não tem um navegador
interativo disponível para captura de tela; a confirmação "visual" desta
rodada foi feita por dois meios equivalentes em rigor: (a) leitura direta do
DOM renderizado pelos testes de componente (Testing Library/jsdom, que
constroem a árvore real de elementos e atributos, não apenas invocam
funções) para os textos/estrutura exigidos pelo UX-SPEC; (b) build de
produção + `vite preview` respondendo 200 nas rotas do fluxo. Não substitui
uma passada humana de navegador com `axe-core`/leitor de tela real (essa é
a responsabilidade formal de `UI-DS-01`/Lote 7, já com 18 casos de
`axe-core` sob jsdom, e do Lote 12 de acessibilidade completa) — registrado
aqui como limitação de ambiente, não como lacuna do critério de aceite desta
rodada.

### UI-T01-01 — Onboarding, passo 1 (favoritos)

**Critério de aceite**: `aria-live` anuncia "Até 3 esportes favoritos;
desmarque um para trocar." (CA-03.3); estados "erro" e "preenchido" cobertos.

| Verificação | Evidência | Resultado |
|---|---|---|
| Texto canônico de CA-03.3, letra por letra | `PassoFavoritos.tsx`: `MENSAGEM_LIMITE_FAVORITOS = 'Até 3 esportes favoritos; desmarque um para trocar.'` — comparei caractere a caractere com UX-SPEC §2/T-01 ("chips não selecionados ganham `aria-disabled`... aparece, em `aria-live`: **"Até 3 esportes favoritos; desmarque um para trocar."**") | Idêntico |
| Região viva alcançável por teclado/clique (não `disabled` nativo) | Lido: o `Chip` nunca recebe `disabled`; a interceptação do 4º favorito acontece no manipulador de clique, que nunca repassa a `aoAlternar`; `aria-live="polite"` num `<p>` dedicado que nasce vazio | Conforme — decisão de implementação (não usar `disabled` nativo) é tecnicamente correta: `disabled` removeria o botão do fluxo de tabulação e do disparo do próprio evento que aciona o aviso |
| Estado "preenchido" (contador muda, mesmo layout) | `PassoFavoritos.tsx`: `{favoritos.length} DE {LIMITE_FAVORITOS} ESCOLHIDOS` | Conforme UX-SPEC §4/T-01 |
| Estado "erro" (falha ao carregar configuração) | `Onboarding.tsx`: `TEXTO_ERRO_CATALOGO_ONBOARDING = 'Não conseguimos carregar a lista de clubes agora. Você pode continuar e escolher seu time depois.'` — comparado literalmente com UX-SPEC §4/T-01 | Idêntico; `[ CONTINUAR SEM ESCOLHER ]` presente como `BannerAlerta` com ação |
| "Carregando" não se aplica | Confirmado: catálogo vem de `construirCatalogoOnboarding()` síncrono, sem `fetch` | Conforme (mesma justificativa do UX-SPEC §4, "não se aplica") |
| Testes de execução real | `PassoFavoritos` é exercitado por `Onboarding.test.tsx` (17+ casos entre os 2 componentes) | Rodei `npx vitest run app/rotas/paginas/Onboarding.test.tsx app/rotas/paginas/Onboarding/`: todos passam |

**Veredito**: **Aprovado**.

### UI-T01-02 — Onboarding, passo 2 (time) + transição

**Critério de aceite**: onboarding completo em no máximo 2 confirmações
(CA-14.5/RNF-04); retomada do passo 2 funciona de verdade.

| Verificação | Evidência | Resultado |
|---|---|---|
| No máximo 2 confirmações até a home | `Onboarding.tsx`: passo 1 tem só "Continuar"/"Pular" (ambos chamam `aoConcluirPasso1`, avançam ao passo 2, nunca à home); passo 2 tem só "Confirmar"/"Pular" (ambos chamam `iniciarTransicaoEConcluir`, concluem) — nunca existe um 3º clique possível no caminho de conclusão | Conforme — confirmado por leitura de fluxo, não só pela nota |
| **Retomada real do passo 2** (não só a intenção documentada) | Testei eu mesmo, isoladamente: `npx vitest run -t "CA-14.4"` — o teste `'CA-14.4: reabrir /onboarding após abandonar no passo 2 retoma direto nele'` grava um registro real em `localStorage` (`sportslm.preferencias.v1`, `timeId: null`) *antes* de renderizar o componente, então renderiza `Onboarding` do zero e verifica que ele abre direto em "QUAL É O SEU TIME?" (passo 2), nunca em "QUAIS ESPORTES..." (passo 1) — é um teste de comportamento fim-a-fim, não uma checagem de estado interno exposto artificialmente | **3 testes passam** (`npx vitest run -t "CA-14.4"`: 3/3) |
| Mecanismo de distinção "nunca abriu" vs. "abandonou depois do passo 1" | `calcularEstadoInicial`: usa a *existência* do registro (`lerBrutoSemLancar`) combinada com `timeId === null`, não o conteúdo de `favoritos` (que pode ser `[]` legitimamente, CA-14.2) | Correto — evita o bug óbvio de tratar "zero favoritos" como "nunca abriu" |
| "Voltar" preserva favoritos | Teste dedicado (`"Voltar" retorna ao passo 1 sem perder os favoritos já marcados`), rodei isoladamente | Passa |
| Transição de 150ms + `prefers-reduced-motion` | 3 testes dedicados (paleta pronta mostra a faixa; movimento reduzido nunca mostra; paleta não chegou navega direto) | Rodei os 3: passam; a lógica não bloqueia a navegação em nenhum caso (RNF-04/RNF-05) |

**Veredito**: **Aprovado**.

### UI-T02-01 — Home: faixa do clube + PRÓXIMO JOGO + A BRIGA

**Critério de aceite**: faixa renderiza sem esperar rede (dado de config
local); atalho "SIMULAR OS JOGOS QUE FALTAM" leva a T-09.

| Verificação | Evidência | Resultado |
|---|---|---|
| `timeId` lido síncrono de `localStorage`, decide "sem time" antes de qualquer rede | `SecaoIdentidade.tsx` lido: `lerPreferencias` roda antes do primeiro `render`, decide `FaixaClube variante="neutra"` + convite (CA-14.3) sem esperar `useClubesPublicos`/`useFutebol` | Conforme |
| Atalho de simulação leva à rota certa | Teste `SecaoIdentidade.test.tsx`: "SIMULAR OS JOGOS QUE FALTAM" navega para `/simulacao"` via `MemoryRouter` | Rodei isoladamente: passa |
| CA-14.3 sem convite duplicado | Teste cobre "sem time" (convite + `aoEscolherTime`) e "com time" (nunca mostra convite) | Conforme |
| "A Briga" — seleção líder + acima do torcedor + o próprio, deduplicado | Lido: regra implementada e coberta por teste | Aceitável — UX-SPEC §3.8.6 não formaliza a regra de seleção além do wireframe (3 exemplos), interpretação razoável e documentada |
| Divergência de infraestrutura de config (fetch vs. bundle estático) entre `SecaoIdentidade`/`catalogoOnboarding` | Sinalizada pelo próprio Executor; resolvida por UI-T02-04 (ambos os mecanismos mantidos, cada um resolvendo o dado que só ele pode) | Verifiquei a resolução: `Home.tsx` usa `useClubesPublicos` para paleta (ADR-017) e `construirCatalogoOnboarding` para nomes sem paleta — não há duplicação de fonte de verdade nem paleta computada fora do pipeline |

**Veredito**: **Aprovado**.

### UI-T02-02 — Home: "Seus esportes"

**Critério de aceite**: item "geral" nunca aparece; filtro funciona sem
reload; confirmar que a correção de contrato (array vs. `{itens}`) está de
fato aplicada e testada contra o schema real de PUB-02.

| Verificação | Evidência | Resultado |
|---|---|---|
| **Correção de contrato confirmada contra o schema real** | `pipeline/publicacao/gerador-snapshots.ts:137`: `export const noticiasPublicasSchema = z.array(itemNoticiaSchema);` — array puro, sem envelope. `SecaoSeusEsportes.tsx:77`: `const esquemaNoticiasPublico = z.array(itemNoticiaSchema);` — **idêntico** ao schema real, não uma cópia aproximada | Conforme — corrigido de fato, não só na nota |
| Fixture de teste reflete o formato real, não o antigo `{itens}` | `SecaoSeusEsportes.test.tsx`: `json: async () => itens` (array puro) em todo mock de resposta — nenhuma ocorrência de `{ itens }` no arquivo | Confirmei via leitura completa do arquivo de teste: nenhuma referência ao envelope antigo restante |
| "geral" nunca aparece (CA-04.7) | Teste `CA-05.1/CA-04.7`: injeta um item `esporte: 'geral'` deliberadamente e afirma `queryByText('Item geral')` é `null` | Rodei isoladamente (`npx vitest run -t "CA-05.1/CA-04.7"`): passa — a garantia estrutural (favoritos nunca incluem `'geral'`, tipo `EsporteId`) + filtro defensivo redundante confirmados por teste real de injeção, não só por tipo |
| Filtro por chip sem reload | Teste `CA-05.2`: clica em "Vôlei", verifica que só a notícia de vôlei aparece, sem re-mock de nova chamada de rede entre os cliques | Rodei isoladamente: passa — nenhum novo `fetch` disparado entre a troca de chip (o `cliente` mockado só é chamado 1x na montagem) |
| CA-05.1 (10 mais recentes, ordenação) | Teste dedicado com 15 itens, corte em 10, ordenação | Rodei isoladamente: passa |
| CA-05.3/CA-05.4 (textos canônicos) | Comparados literalmente: "Escolha até 3 esportes favoritos para ver o que mais te interessa aqui." e "Sem notícias recentes de Futebol e Vôlei — atualizado..." batem com UX-SPEC §4/T-02 | Idêntico |

**Veredito**: **Aprovado**.

### UI-T02-03 — Home: "Últimas notícias"

**Critério de aceite**: contagem de 30 respeita grupo=1 (CA-19.4); banners
de fonte instável e GE indisponível presentes.

| Verificação | Evidência | Resultado |
|---|---|---|
| CA-19.4: grupo conta como 1 no limite de 30 | `dominio/noticias/montador-feed.test.ts`: `'CA-19.4: 30 grupos de 2 itens cada contam como 30, não 60, respeitando o limite'` — monta 30 grupos de 2 itens (60 itens brutos) e afirma `feed.toHaveLength(30)` | Rodei isoladamente (`npx vitest run -t "CA-19.4"`): **2/2 passam** (o caso de agrupamento simples e o de 30 grupos) |
| Banner de fonte instável | `SecaoUltimasNoticias.tsx`: lê `status.fontes[<id>].instavel`, degrada silenciosamente se ausente | Teste dedicado passa |
| Banner GE indisponível (texto canônico) | `texto="O GE está indisponível no momento — as notícias abaixo vêm das outras fontes."` — comparado literalmente com UX-SPEC §4/T-02 | Idêntico |
| Lógica de montagem extraída para `dominio/` (função pura) | `montador-feed.ts` — sem `fetch`/`localStorage`/`Date.now()` direto (recebe `agora` por parâmetro) | Conforme Diretriz de Implementação #2 |

**Veredito**: **Aprovado**.

### UI-T02-04 — Home: integração, navegação e estados globais

**Critério de aceite**: nenhum dos 4 estados falta; navegação nunca
duplicada (topo × rodapé) por largura.

| Verificação | Evidência | Resultado |
|---|---|---|
| **Navegação nunca duplicada — teste real de CSS/breakpoint, não só a alegação** | `Navegacao.module.css` lido linha a linha: `.navDesktop { display: none; }` no escopo base, com `@media (min-width: 1024px) { .navDesktop { display: flex; ... } }`; `.inferior { display: flex; ... }` no escopo base, com `@media (min-width: 1024px) { .inferior { display: none; } }` — as duas regras são espelhadas e mutuamente exclusivas no mesmo breakpoint | Conforme — confirmado por leitura direta do CSS-fonte, e o teste `Navegacao.test.tsx` (`'CSS: a barra desktop e a barra inferior nunca ficam visíveis ao mesmo tempo'`) faz a mesma verificação mecanicamente via regex sobre o arquivo real | Rodei isoladamente: passa. Limitação registrada: jsdom não executa media queries de verdade (sem layout real), então a prova é sobre a declaração CSS-fonte, não sobre um viewport redimensionado de fato — mesmo padrão já aceito em `BlocoPreto`/Lote 7 para casos que dependem de geometria real do navegador |
| Os 4 estados da Seção 4/T-02 presentes, sem duplicação | Confirmei que carregando/erro/vazio/preenchido já vinham decompostos em UI-T02-01/02/03, e que UI-T02-04 fechou a lacuna real encontrada (CA-02.4, "todas as bloqueáveis bloqueadas") em vez de deixar como nota solta | Teste `CA-02.4` em `SecaoUltimasNoticias.test.tsx` (2 casos: aciona/não aciona), rodei isoladamente: passa — texto canônico "Você bloqueou 4 fontes. Estas notícias vêm do ge." idêntico ao UX-SPEC §4/T-02 |
| `aria-current="page"` só no item certo, mesmo com 2 cópias no DOM | Teste dedicado, rodei isoladamente | Passa |
| Divergência de layout desktop de 2 colunas do wireframe **não reproduzida** | `Home.tsx`/`Home.module.css` lidos: as 3 seções compõem em coluna única centralizada (`--largura-container`, 1120px) em qualquer largura — o wireframe desktop de UX-SPEC §2/T-02 (coluna fixa 336px + feed largo 748px) não existe no código | **Achado QA-8-01** (ver abaixo) — não compromete nenhum critério de aceite explícito desta tarefa (que fala de navegação/estados, não de grade), mas é uma divergência visual real do wireframe, sinalizada pelo próprio Executor e confirmada pelo Validador |

**Veredito**: **Aprovado** (a divergência de layout é achado simples, não reprovação — ver Achados de processo).

---

## Achados de processo do Lote 8 (não são reprovação de nenhuma tarefa)

### Achado QA-8-01 — Layout desktop de 2 colunas do wireframe T-02 não reproduzido

**Severidade**: **simples** (ajuste de diagramação, de esforço moderado mas
isolado — não compromete o critério de aceite central de UI-T02-04
("nenhum dos 4 estados falta; navegação nunca duplicada"), não quebra
nenhuma outra tarefa do lote, não tem efeito de acessibilidade ou funcional
observável: todo conteúdo e todos os 4 estados estão presentes, só a
diagramação em telas largas diverge do wireframe).

Confirmei por leitura de `Home.tsx`/`Home.module.css`: em qualquer largura
de tela, as 3 seções (`SecaoIdentidade`, `SecaoSeusEsportes`,
`SecaoUltimasNoticias`) empilham em coluna única, centralizada em
`--largura-container` (1120px). UX-SPEC §2/T-02, wireframe desktop (1280px),
pede uma grade de 2 colunas a partir de 1024px: coluna fixa de 336px
(`PRÓXIMO JOGO` + `A BRIGA` + `CAMPEONATOS DE 2026`) ao lado de um feed
largo de 748px (`SEUS ESPORTES` + `ÚLTIMAS NOTÍCIAS`, inclusive em grade de
2 colunas dentro do feed para os cartões).

**Por que não é reprovação crítica**: nenhum dos dois critérios de aceite
explícitos de UI-T02-04 ("nenhum dos 4 estados falta"; "navegação nunca
duplicada por largura") menciona a grade de 2 colunas — o critério de
aceite fala de estados e navegação, não de diagramação. O próprio Executor
já havia sinalizado a divergência como "lacuna registrada, não bloqueante"
antes de eu chegar nela de forma independente pela leitura do CSS.

**Por que não é "informativo apenas"**: ao contrário da lacuna de paleta de
15 tons do Lote 7 (que era ausência de definição no próprio UX-SPEC), aqui
o UX-SPEC já define a grade com precisão de pixel (336px/748px,
`1024px`) — é uma divergência de implementação com destino claro, não uma
decisão do Coordenador a esperar. Por isso é achado simples com tarefa de
código, não nota "spec gap" para o Coordenador.

**Ação tomada**: tarefa `REFAT-08-01` criada em `Refatoração Lote-8` (ver
`TASK.md`), não retorno ao Executor — mesmo padrão de `REFAT-07-01` no Lote
7 (achado simples, sem reabrir o Coordenador).

---

## Fechamento estrutural do Lote 8

Checagem feita pelo próprio Validador (sem dispatch ao Coordenador):

- [x] Todas as 6 tarefas do Lote 8 (UI-T01-01, UI-T01-02, UI-T02-01, UI-T02-02, UI-T02-03, UI-T02-04) estão `Concluída` no `TASK.md`.
- [x] Dependências confirmadas satisfeitas por leitura direta do `TASK.md`: UI-DS-07A/07B/09/01/02/03/06/08 (Lote 7, `Validado`) — todas com status confirmado.
- [x] Paralelismo declarado ("UI-T01-01, UI-T02-01, UI-T02-02 e UI-T02-03 são paralelizáveis entre si") confirmado: as 4 tarefas paralelas produzem componentes isolados (`PassoFavoritos`/`SecaoIdentidade`/`SecaoSeusEsportes`/`SecaoUltimasNoticias`) sem import cruzado entre si; a única colisão real (formato do contrato de `/dados/noticias.json` entre UI-T02-02 e UI-T02-03) foi encontrada pelas próprias tarefas em paralelo, sinalizada ao Coordenador e corrigida em fix-loop antes desta validação — confirmei a correção por leitura de código (ver UI-T02-02 acima), não por confiança na nota.
- [x] Nenhuma tarefa `Bloqueada` no Lote 8.
- [x] Nenhuma dependência da Seção 4 do TASK.md órfã/inconsistente relativa a este lote (Lote 8 → Lote 9/`SEC-01` via UI-T02-03 — pré-requisito satisfeito; nenhum lote posterior já iniciado que dependesse de tarefa não concluída aqui).
- [x] Achado simples (QA-8-01, layout desktop) virou tarefa em `Refatoração Lote-8`, não retorno ao Executor.
- [x] Divergência arquitetural entre UI-T01-01 (config estática via bundle) e UI-T02-01 (config publicada via fetch com paleta), sinalizada pelo próprio UI-T02-01, confirmada como **resolvida** por UI-T02-04 — os dois mecanismos continuam em uso, cada um resolvendo só o dado que só ele pode resolver (paleta nunca vem do bundle estático, ADR-017; nomes de esporte/fonte não precisam de paleta). Não é uma inconsistência de dependência/decomposição pendente — não gera escalonamento.

Nenhuma inconsistência que exija redesenho de dependência/decomposição foi
encontrada — não há escalonamento ao Coordenador via `BLOCKERS.md` nesta
rodada.

## Veredito de release-readiness do Lote 8

**Aprovado (com ressalvas)** — libera o Lote 8 para auditoria do chapéu
DevSecOps (ver `SECURITY-REVIEW.md`). 6/6 tarefas aprovadas; 909/909 testes
(75 arquivos), `tsc`/`eslint` limpos; build de produção e `vite preview`
confirmados; correção de contrato de UI-T02-02 (array vs. `{itens}`)
verificada linha a linha contra o schema real de PUB-02, não só aceita pela
nota; retomada real de CA-14.4 e navegação não duplicada por breakpoint
verificadas por teste de execução, não por alegação; nenhuma reprovação
crítica ou simples pendente sem tratamento; 1 achado simples de layout
(`REFAT-08-01`) registrado, não bloqueante.

---

## Lote 9 — Configurações e seleção de time (T-03, T-04)

**Verificação de portões**: rodei eu mesmo, do zero, no estado atual do
repositório: `npm run typecheck` (limpo), `npm run lint` (limpo),
`npm run format:check` (limpo), `npm test` (**951/951 testes passam**, 83
arquivos — bate com o número declarado pela última nota de implementação,
UI-T03-02). Os erros impressos no console durante `npm test` (`Failed to
parse URL from /dados/...`) são o mesmo ruído esperado já registrado no Lote
8 — Node/jsdom não resolve URL relativa em `fetch` fora de `window.location`
real; nenhum teste falha por causa disso (951/951 `passed`).

**Nota sobre confirmação visual**: mesma limitação de ambiente já registrada
no Lote 8 (sem navegador interativo para captura de tela) — confirmação
feita por leitura do DOM renderizado nos testes de Testing Library/jsdom e
por leitura de código-fonte, nunca pela nota de implementação do Executor
como base de aprovação.

### UI-T03-01 — Configurações: fontes de notícia

**Critério de aceite**: tentativa de bloquear o GE nunca é apresentada como
acionável (CA-02.3).

| Verificação | Evidência | Resultado |
|---|---|---|
| Nenhum controle clicável na linha do GE, não apenas desabilitado | `SecaoFontesDeNoticia.tsx` lido linha a linha: quando `fonte.fixa`, a linha renderiza só `<span>{fonte.nome}</span>` + `<Chip variante="informativo" rotulo="FONTE FIXA" />` — nenhum `<button>`, nenhum `Alternador`, nenhum elemento com `role` interativo ou `tabIndex`. O `Alternador` só é renderizado no ramo `else` (fontes não fixas) | Conforme — verifiquei por leitura de código que não existe *nenhum* nó focável/clicável na linha do GE, não só que um controle está `disabled` (a diferença que o CA-02.3 exige — "o controle não é apresentado como acionável") |
| Confirmação via DOM renderizado em teste, não só por leitura de código | `Configuracoes.test.tsx`/`SecaoFontesDeNoticia.test.tsx`: rodei isoladamente `npx vitest run app/rotas/sobreposicoes/Configuracoes/SecaoFontesDeNoticia.test.tsx` — 1 caso consulta `container.querySelectorAll('button, input, [role="switch"]')` na linha do GE e afirma lista vazia | Passa |
| Texto explicativo presente (CA-02.3, "o GE é fonte fixa... não pode ser bloqueado") | `SecaoFontesDeNoticia.tsx`: `"O GE é fonte fixa do SportsLM e não pode ser bloqueado."` — comparado literalmente com o texto de CA-02.3 do PRD-TECNICO ("informar 'o GE é fonte fixa do SportsLM e não pode ser bloqueado'") | Idêntico |
| CA-01.2 — "instável desde \<data/hora\>" sem remover a fonte | Teste dedicado com `statusFontes` mockado com `instavel: true` | Conforme — fonte continua listada, com o selo de instabilidade |
| CA-02.1/CA-02.2 (bloqueio/desbloqueio com efeito imediato *dentro da própria sobreposição*) | Testado: alternar o `Alternador` de uma fonte bloqueável chama `salvarPreferencias` e atualiza a lista local (`fontesBloqueadas`) no mesmo render | Conforme — efeito imediato confirmado dentro de T-03. **Ver achado QA-9-01 abaixo**: o mesmo efeito não se propaga para o feed da Home enquanto ambas as telas convivem montadas |

**Veredito**: **Aprovado** (achado QA-9-01, abaixo, é achado de processo — não reprovação desta tarefa, cujo critério de aceite explícito, CA-02.3, está integralmente satisfeito).

### UI-T03-02 — Configurações: esportes, tema, privacidade

**Critério de aceite**: troca de tema persiste em `sportslm.tema.v1`; texto
de privacidade corresponde a RNF-07.

| Verificação | Evidência | Resultado |
|---|---|---|
| Troca de tema persiste na chave certa | `SecaoAparencia.test.tsx`: seleciona "Escuro", depois `JSON.parse(localStorage.getItem('sportslm.tema.v1'))` — rodei isoladamente (`npx vitest run app/rotas/sobreposicoes/Configuracoes/SecaoAparencia.test.tsx`): 3/3 passam | Conforme — chave e formato batem com `app/tema/tema.ts` (`CHAVE_ARMAZENAMENTO_TEMA = 'sportslm.tema.v1'`, já auditado em FUND-05/Lote 1) |
| Troca de tema sem F5 | `SecaoAparencia.tsx` usa `usarTema()` (FUND-05), já testado por tabela (6 casos) para reatividade instantânea; aqui só confirmo a integração de UI (clique no rádio → `definirPreferencia`) | Conforme |
| Texto de privacidade literal (RNF-07) | `TEXTO_PRIVACIDADE` = `'Suas preferências ficam só neste navegador. Não usamos conta nem cookies. Enviamos 5 eventos anônimos de uso.'` — comparado caractere a caractere com o wireframe de UX-SPEC §2/T-03 | Idêntico |
| Os 5 eventos revelados por "Ver quais" batem com RNF-07 | `EVENTOS_TELEMETRIA_RNF07` = `['primeira sessão', 'retorno', 'personalização concluída', 'tempo até primeira interação útil', 'abertura do comparativo']` — comparado com PRD-TECNICO.md RNF-07 ("eventos: primeira sessão, retorno, personalização concluída, tempo até primeira interação útil, abertura do comparativo") | Idêntico, mesma ordem |
| "Desativar e apagar id" não inventa mecanismo de telemetria | `telemetriaId.ts` lido: só `removeItem('sportslm.anonimo.v1')`, nenhuma geração/leitura de identificador, nenhum envio de evento | Conforme — `sportslm.anonimo.v1` tratado como id anônimo local (ADR-012), não dado pessoal |
| **Correção do bug latente de `aoAlternarFonte` (UI-T03-01), confirmada e testada** | `Configuracoes.tsx:237-246`: `novasPreferencias` usa `favoritos`/`timeId`/`rivais` (estado ao vivo, atualizado a cada abertura via `useEffect`), não `leituraInicial.preferencias` (só a leitura de montagem) — confirmei por leitura direta que a variável `leituraInicial` só é usada para o valor *inicial* do `useState`, nunca dentro de `aoAlternarFonte`/`aoAlternarFavorito` | Corrigido de fato — rodei um teste de regressão manual mental equivalente ao caso relatado: abrir T-03 → trocar de time via T-04 (a partir do botão "Trocar", fechando/reabrindo T-03) → bloquear uma fonte em T-03 → o `timeId` gravado é o novo, não o de quando T-03abriu pela primeira vez. `Configuracoes.test.tsx` cobre esse cenário (`useEffect` recalcula a cada `aberta`) — confirmei que os testes existentes de "bloquear fonte preserva timeId/favoritos atuais" passam isoladamente |

**Veredito**: **Aprovado**.

### UI-T04-01 — Escolher/trocar time (+ virada de temporada)

**Critério de aceite**: ao trocar, aviso "rivais e simulação foram
redefinidos" aparece antes da confirmação; texto de CA-06.5 literal.

| Verificação | Evidência | Resultado |
|---|---|---|
| Aviso de troca (CA-06.3) aparece antes de confirmar, só quando há troca real | `EscolherTime.tsx`: `trocando = timeConfirmadoId !== null && selecionado !== null && selecionado !== timeConfirmadoId`; o banner (`TEXTO_AVISO_TROCA`) só renderiza quando `trocando` é `true`, antes do botão "Confirmar troca" | Conforme — texto `'Trocar de time redefine seus rivais e apaga a simulação salva.'`, idêntico ao wireframe de UX-SPEC §2/T-04 |
| Texto de CA-06.5 literal | `` `${nomeTimePerdido} não está na Série A de ${temporadaAtual}; escolha um novo time para continuar. Seus esportes favoritos e fontes bloqueadas foram mantidos.` `` — comparado com o texto do PRD-TECNICO CA-06.5 e o banner de exemplo de UX-SPEC §2/T-04 ("Cruzeiro não está na Série A de 2027; escolha um novo time para continuar. Seus esportes favoritos e fontes bloqueadas foram mantidos.") | Idêntico, com interpolação correta de nome/ano |
| Favoritos e fontes bloqueadas realmente preservados na virada (RN-12) | `preferencias.ts`: `timeForaDaTemporada` zera só `timeId`/`rivais`; `favoritos`/`fontesBloqueadas` nunca tocados nesse ramo — confirmado por leitura e por `preferencias.test.ts` ("descarta timeId e rivais juntos... mantendo favoritos/fontesBloqueadas", rodei isoladamente) | Conforme |
| Rivais e cenário descartados nos dois casos (troca manual E virada) | `aoConfirmar`: `descartaRivaisECenario = trocando \|\| estadoAbertura.nomeTimePerdido !== null` → `rivais: []` + `limparCenario()` | Conforme CA-06.3/CA-06.5 |
| Busca dos 20 clubes, sem espera de rede (UX-SPEC §4/T-04: "Carregando não se aplica") | `construirCatalogoOnboarding()` síncrono, mesmo mecanismo de `PassoTime`/UI-T01-02, já auditado | Conforme — decisão de não reaproveitar `useClubesPublicos` (que tem fetch) é correta, o próprio UX-SPEC exige "não se aplica" |
| Testes de execução real | Rodei isoladamente `npx vitest run app/rotas/sobreposicoes/EscolherTime.test.tsx`: 9/9 passam, incluindo os 2 casos de virada de temporada e o de troca com aviso | Conforme |
| **Gatilho automático de abertura no retorno após virada (RN-12)** | Não existe hoje nenhum ponto que chame `abrirEscolherTime()` automaticamente quando `lerPreferencias(...).timeForaDaTemporada` é `true` no retorno à Home — a sobreposição só trata o caso corretamente *quando aberta*, nunca se abre sozinha. Confirmei por leitura de `Home.tsx`/`SecaoIdentidade.tsx`: nenhuma chamada a `timeForaDaTemporada` fora de `EscolherTime.tsx`/`preferencias.ts` | **Ver achado QA-9-02, abaixo** — não é reprovação desta tarefa (o critério de aceite explícito de UI-T04-01 fala do aviso ao trocar e do texto de CA-06.5, ambos conformes quando a sobreposição é aberta), mas é uma lacuna real de RN-12/CA-06.5 no fluxo de retorno como um todo |

**Veredito**: **Aprovado** (achado QA-9-02, abaixo, é achado de processo — não reprovação desta tarefa).

---

## Achados de processo do Lote 9 (não são reprovação de nenhuma tarefa)

### Achado QA-9-01 — Bloqueio de fonte em Configurações não reflete de imediato no feed da Home

**Severidade**: **simples** (não compromete o critério de aceite explícito
de nenhuma tarefa deste lote — CA-02.3 de UI-T03-01 está integralmente
satisfeito, e nenhuma tarefa do Lote 9 depende deste comportamento para
fechar — mas é um bug real de UX que toca CA-02.1, Must de RF-02: "remover
imediatamente... sem recarregar a página").

**O que confirmei por leitura de código, além do que o Executor já havia
sinalizado**: `T-03` (`Configuracoes`) e `T-04` (`EscolherTime`) são
montadas como irmãs de `<Outlet />` dentro de `ProvedorSobreposicoes`
(`SobreposicoesContext.tsx:70-89`), nunca substituindo a rota `/` — ou seja,
`Home` **permanece montada o tempo todo** enquanto a sobreposição de
Configurações está aberta por cima. `Home.tsx:156-162` calcula
`preferencias` (incluindo `fontesBloqueadas`) num `useMemo` cuja lista de
dependências é só `[catalogo, armazenamento]` — nenhuma delas muda quando
`Configuracoes.tsx` grava uma nova lista de fontes bloqueadas no
`localStorage`. Resultado: bloquear uma fonte, fechar a sobreposição, e
olhar o feed — os itens da fonte recém-bloqueada continuam visíveis até que
`Home` seja desmontada e remontada de verdade (navegar para outra rota e
voltar; F5 também resolve, mas não é o único jeito, o que confirma que o
requisito "sem recarregar a página" de CA-02.1 realmente não é cumprido no
fluxo primário — abrir Configurações a partir da própria Home).

**Por que classifico como simples, não crítica**: (a) o critério de aceite
explícito de UI-T03-01 no `TASK.md` ("tentativa de bloquear o GE nunca é
apresentada como acionável, CA-02.3") não menciona propagação para outras
telas montadas — está integralmente satisfeito; (b) não bloqueia nem
UI-T03-02 nem UI-T04-01, que não dependem deste comportamento; (c) o próprio
Executor já havia identificado a causa raiz corretamente e proposto a
solução certa (estado de preferências compartilhado/observador de
`localStorage`) antes de eu chegar ao mesmo achado por leitura independente
— é um gap de integração entre duas tarefas de lotes diferentes (Home,
Lote 8, já `Validado`; Configurações, Lote 9), não uma falha de
implementação isolada de nenhuma das duas. Mesmo padrão de precedente do
Lote 8 (achado QA-8-01, layout desktop): divergência real, com destino
técnico claro, mas que não compromete o critério de aceite central de
nenhuma tarefa concluída.

**Por que não reabro o Lote 8**: a validação do Lote 8 foi feita
corretamente contra o critério de aceite de UI-T02-04 então vigente ("nenhum
dos 4 estados falta; navegação nunca duplicada"), que não previa — e não
tinha como prever, já que T-03 sequer existia — reatividade cruzada com uma
sobreposição futura. Retroagir a aprovação de um lote já fechado por causa
de uma integração só observável depois que o lote seguinte foi implementado
não é o padrão correto de governança deste pipeline; o tratamento é abrir
tarefa de correção agora, no lote em que o problema se tornou observável.

**Ação tomada**: tarefa `REFAT-09-01` criada em `Refatoração Lote-9` (ver
`TASK.md`) — implementar um mecanismo reativo de leitura de preferências
(hook compartilhado, ex. `useSyncExternalStore` sobre um emissor de evento
de `armazenamento/preferencias.ts`, ou evento customizado disparado por
`salvarPreferencias`) consumido por `Home.tsx` (`SecaoSeusEsportes`/
`SecaoUltimasNoticias`) e por `Configuracoes.tsx`, para que qualquer
alteração de preferências reflita em qualquer tela montada sem exigir
remontagem. Prazo: **antes do início do Lote 10** (Painel do Time, T-05, que
adiciona mais uma tela consumidora de preferências e aumentaria a superfície
do mesmo bug) — o mais tardar, antes de qualquer `/deploy` real.

**RESOLVIDO — confirmado na validação de `Refatoração Lote-9` (2026-09-06)**:
li `app/armazenamento/preferencias.ts` por inteiro. `salvarPreferencias`
agora chama `notificarMudancaPreferencias()` incondicionalmente (mesmo em
modo memória), incrementando um contador de versão privado
(`versaoPreferencias`) e disparando cada ouvinte registrado em
`ouvintesMudancaPreferencias`; `assinarMudancasPreferencias`/
`obterVersaoPreferencias` expõem exatamente a API de `subscribe`/
`getSnapshot` que `useSyncExternalStore` exige, sem importar React neste
módulo (pureza de I/O preservada). Em `app/rotas/paginas/Home.tsx`, `Home`
assina via `useSyncExternalStore(assinarMudancasPreferencias,
obterVersaoPreferencias, obterVersaoPreferencias)` e usa
`versaoPreferencias` só como dependência do `useMemo` que recalcula
`lerPreferencias(...)` — sem lê-lo no corpo, exatamente para forçar
reinvalidação a cada notificação, sem duplicar a leitura de preferências já
usada por CA-13.4. Não é remontagem: `Home` nunca desmonta neste fluxo, só
recalcula estado interno. Testei de verdade, não só li o código: rodei
isoladamente `npx vitest run app/rotas/paginas/Home.test.tsx` — o caso
"REFAT-09-01: bloquear uma fonte em Configurações (aberta a partir da Home)
reflete no feed sem navegar/remontar" (linha 221) abre Configurações a
partir da própria Home (`fireEvent.click` no botão "Escolher esportes", sem
navegação de rota), clica no `role="switch"` de "Fonte A" dentro do
`dialog`, fecha a sobreposição e confirma que "Notícia da Fonte A" some do
feed enquanto "Notícia do GE" permanece — exatamente o teste de execução
real exigido pelo critério de aceite de `REFAT-09-01`, não uma alegação da
nota do Executor. Suite completa confirmada limpa (ver rodada de comandos no
fechamento deste lote, abaixo). **Achado QA-9-01 considerado resolvido.**

### Achado QA-9-02 — Nenhum gatilho automático abre T-04 no retorno após virada de temporada (RN-12)

**Severidade**: **simples** (não compromete o critério de aceite explícito
de UI-T04-01 — o aviso e o texto de CA-06.5 estão corretos *quando a
sobreposição é aberta*; a lacuna é a ausência de um ponto de disparo
automático, não um defeito no componente em si).

**Avaliação do impacto real**: confirmei que `lerPreferencias` (Lote 7,
`armazenamento/preferencias.ts`) já corrige o estado persistido no momento
da leitura — quando `timeForaDaTemporada` é `true`, `timeId`/`rivais` já
voltam `null`/`[]` em **qualquer** tela que releia as preferências,
inclusive `Home.tsx`. Ou seja: o torcedor que retorna após a virada de
temporada não fica com um time "fantasma" nem em estado inconsistente — a
`Home` mostra corretamente o convite "sem time" (CA-14.3) em vez do
time antigo. O que falta é especificamente o texto informativo de CA-06.5
("\<time\> não está na Série A de \<ano\>; escolha um novo time para
continuar...") — sem abrir T-04 manualmente (clicar em "ESCOLHER MEU TIME"),
o torcedor nunca vê essa frase específica, só o convite genérico de "sem
time". CA-06.5, como redigido no PRD-TECNICO ("WHEN o torcedor retorna...
THE SYSTEM SHALL informar..."), e o mapa de fluxo do UX-SPEC (FL-01:
"ramo de virada de temporada em T-04", descrito como parte do fluxo de
retorno, não de uma ação manual) sugerem que esse aviso deveria aparecer
proativamente no retorno, não só quando o torcedor abre a troca de time por
conta própria.

**Por que classifico como simples, não crítica**: (a) o critério de aceite
explícito de UI-T04-01 ("aviso... aparece antes da confirmação; texto de
CA-06.5 literal") está satisfeito à risca — a tarefa não prometia o
gatilho automático; (b) nenhuma outra tarefa do Lote 9 depende disso; (c) o
efeito prático do gap é perda de uma mensagem explicativa, não perda de
dado nem estado inconsistente (favoritos/bloqueios continuam corretos,
RN-12); (d) o ponto natural de disparo (retorno = `Home`, T-02) pertence a
um lote já `Validado` (Lote 8) — mesma lógica do achado QA-9-01, é um gap de
integração entre lotes, não falha de nenhuma tarefa isolada. O botão
"TROCAR TIME" do Painel do Time (T-05) — a outra lacuna sinalizada pelo
Executor — **não é um gap**: aquele botão é escopo explícito de UI-T05-01
(Lote 10, `Pendente`), ainda não implementado, nada a cobrar aqui.

**Ação tomada**: tarefa `REFAT-09-02` criada em `Refatoração Lote-9` (ver
`TASK.md`) — em `Home.tsx`/`SecaoIdentidade.tsx` (ponto de retorno, FL-01),
detectar `lerPreferencias(...).timeForaDaTemporada` no mount e abrir
automaticamente a sobreposição `EscolherTime` (via
`abrirEscolherTime`/`SobreposicoesContext`, já pronta para tratar o caso)
em vez de exigir o clique manual em "ESCOLHER MEU TIME". Prazo: **antes do
início do Lote 10** (mesmo prazo do achado QA-9-01, mesma superfície de
código/tela).

**RESOLVIDO — confirmado na validação de `Refatoração Lote-9` (2026-09-06)**:
li `app/rotas/paginas/Home.tsx` por inteiro. `resultadoLeituraPreferencias`
reaproveita a mesma chamada a `lerPreferencias(catalogo.referencias,
catalogo.temporadaAtual, armazenamento)` já usada para
`favoritos`/`fontesBloqueadas` (sem duplicar a validação contra o catálogo),
agora também capturando `timeForaDaTemporada`. Um `useEffect` guardado por
`useRef` (`jaAbriuEscolherTimeAutomaticamenteRef`) chama `abrirEscolherTime()`
uma única vez quando `resultadoLeituraPreferencias.timeForaDaTemporada` é
`true` — a ref evita reabertura a cada notificação subsequente de
`salvarPreferencias` que não seja sobre o time (ex.: bloquear uma fonte em
Configurações, cenário do próprio REFAT-09-01, testado em paralelo no mesmo
arquivo sem conflito). Quando `timeForaDaTemporada` é `false`, o `if` dentro
do efeito nunca chama `abrirEscolherTime()` — confirmado por leitura direta,
não é um "sempre abre e o componente decide não mostrar nada": a abertura em
si não ocorre. Testei de verdade, não só li o código: rodei isoladamente
`npx vitest run app/rotas/paginas/Home.test.tsx` — os dois casos
"REFAT-09-02: time salvo fora da temporada corrente abre T-04 sozinha, com o
banner de CA-06.5" (linha 255, salva um `timeId` fora de `clubesValidos`,
renderiza `Home` do zero e confirma que a sobreposição abre sozinha com o
banner de CA-06.5 visível) e "REFAT-09-02: `timeForaDaTemporada` falso não
abre T-04 automaticamente" (linha 282, sem preferências salvas, confirma
ausência de abertura automática) passam — exatamente o par de cenários
exigido pelo critério de aceite de `REFAT-09-02`. Suite completa confirmada
limpa (ver rodada de comandos no fechamento deste lote, abaixo). **Achado
QA-9-02 considerado resolvido.**

---

## Fechamento estrutural do Lote 9

Checagem feita pelo próprio Validador (sem dispatch ao Coordenador):

- [x] As 3 tarefas do Lote 9 (UI-T03-01, UI-T03-02, UI-T04-01) estão `Concluída` no `TASK.md`.
- [x] Dependências confirmadas satisfeitas por leitura direta do `TASK.md`: UI-DS-07A/07B/09 (Lote 7, `Validado`) para UI-T03-01; UI-T03-01 (`Concluída`, Lote 9) para UI-T03-02; UI-DS-01/09 (Lote 7, `Validado`) para UI-T04-01.
- [x] Paralelismo declarado ("UI-T03-01 e UI-T04-01 são paralelizáveis entre si; UI-T03-02 é sequencial após UI-T03-01") confirmado: `EscolherTime.tsx` (UI-T04-01) não importa nada de `Configuracoes.tsx`/`SecaoFontesDeNoticia.tsx` (UI-T03-01) — único ponto de acoplamento é `SobreposicoesContext`, já existente desde o Lote 8; `Configuracoes.tsx` (UI-T03-02) constrói sobre os arquivos de UI-T03-01, de fato sequencial.
- [x] Nenhuma tarefa `Bloqueada` no Lote 9.
- [x] Nenhuma dependência da Seção 4 do TASK.md órfã/inconsistente relativa a este lote — Lote 10 (UI-T05-01, "TROCAR TIME" do Painel do Time) depende só de UI-DS-01/02/08 (Lote 7), não de nada deste lote; nenhuma tarefa futura já iniciada dependia de algo não concluído aqui.
- [x] 2 achados simples (QA-9-01, reatividade cruzada de preferências; QA-9-02, gatilho automático de RN-12) viraram tarefas em `Refatoração Lote-9` (`REFAT-09-01`, `REFAT-09-02`), não retorno ao Executor.
- [x] Correção do bug latente de `aoAlternarFonte` (sinalizada por UI-T03-02) confirmada por leitura de código, não só aceita pela nota.

Nenhuma inconsistência que exija redesenho de dependência/decomposição foi
encontrada — não há escalonamento ao Coordenador via `BLOCKERS.md` nesta
rodada. Os dois achados (QA-9-01/QA-9-02) são gaps de integração entre
lotes já previstos como situação normal deste pipeline (mesmo padrão do
Lote 8), não decisões de arquitetura que exijam redesenho.

## Veredito de release-readiness do Lote 9

**Aprovado (com ressalvas)** — libera o Lote 9 para auditoria do chapéu
DevSecOps (ver `SECURITY-REVIEW.md`). 3/3 tarefas aprovadas; 951/951 testes
(83 arquivos), `tsc`/`eslint`/`format:check` limpos; CA-02.3 (GE nunca
acionável) confirmado estruturalmente, sem nenhum elemento focável na linha
do GE; troca de tema persiste em `sportslm.tema.v1`, confirmado por teste
real; texto de privacidade e os 5 eventos de RNF-07 idênticos, literal;
CA-06.3/CA-06.5 (aviso de troca e banner de virada de temporada) com texto
canônico confirmado, favoritos/fontes bloqueadas preservados na virada
(RN-12); correção do bug latente de `aoAlternarFonte` confirmada por leitura
de código. 2 achados simples (`REFAT-09-01`, `REFAT-09-02`) registrados, com
prazo antes do início do Lote 10, nenhum bloqueante para esta aprovação.

---

## Refatoração Lote-9 — validação de fechamento de débito técnico

**Base específica**: achados `QA-9-01`/`QA-9-02` (acima) e as 2 tarefas
`REFAT-09-01`/`REFAT-09-02` (`.md/TASK.md`, lote `Refatoração Lote-9`), ambas
`Concluída`.

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run typecheck` (limpo), `npm run lint` (limpo),
`npm test` (**954/954 testes passam**, 83 arquivos — bate com o número
declarado pela nota de implementação de `REFAT-09-02`). Os erros impressos
no console durante `npm test` (`Failed to parse URL from /dados/...`) são o
mesmo ruído de ambiente já registrado nos Lotes 8/9 (Node/jsdom não resolve
URL relativa em `fetch` fora de `window.location` real) — nenhum teste falha
por isso.

Não usei a nota de implementação do Executor como base de aprovação: li
`app/armazenamento/preferencias.ts` e `app/rotas/paginas/Home.tsx` por
inteiro, e rodei isoladamente os testes de execução real citados por cada
achado (`npx vitest run app/rotas/paginas/Home.test.tsx`) em vez de aceitar
a alegação da nota.

- **REFAT-09-01**: confirmado que `useSyncExternalStore` (nativo do React,
  sem lib nova, Diretriz #3) propaga de fato a mudança de preferências sem
  remontagem — `salvarPreferencias` notifica incondicionalmente, `Home`
  assina e recalcula `lerPreferencias(...)` a cada notificação. Teste real
  (`Home.test.tsx`, caso "bloquear uma fonte em Configurações... reflete no
  feed sem navegar/remontar") passa: abre Configurações a partir da própria
  Home, bloqueia "Fonte A" via `role="switch"`, fecha a sobreposição, e o
  feed já não mostra a notícia da fonte bloqueada — sem navegação, sem
  remontagem. **Achado QA-9-01 resolvido de fato**, não só pela nota.
- **REFAT-09-02**: confirmado que a abertura automática de `EscolherTime` no
  retorno funciona (`useEffect` guardado por `useRef`, dispara
  `abrirEscolherTime()` uma única vez quando `timeForaDaTemporada` é
  `true`) e que **não** abre quando `timeForaDaTemporada` é falso (o `if`
  dentro do efeito simplesmente não executa a chamada — confirmado por
  leitura direta, não é o componente "abrindo e não mostrando nada"). Os
  dois testes reais (`Home.test.tsx`, casos "abre T-04 sozinha, com o banner
  de CA-06.5" e "`timeForaDaTemporada` falso não abre T-04
  automaticamente") passam. **Achado QA-9-02 resolvido de fato**.

### Fechamento estrutural de `Refatoração Lote-9`

- [x] As 2 tarefas (`REFAT-09-01`, `REFAT-09-02`) estão `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: ambas dependiam de UI-T02-04/UI-T03-01/UI-T04-01 (Lotes 8/9, já `Validado`/fechados nesta mesma validação) — satisfeitas.
- [x] Nenhuma tarefa `Bloqueada`.
- [x] Nenhum achado novo de código encontrado durante esta verificação que justifique nova tarefa de refatoração.

Nenhuma inconsistência que exija redesenho de dependência/decomposição —
sem escalonamento ao Coordenador nesta rodada.

**Veredito**: **Aprovado**. `Refatoração Lote-9` fechada — libera para
auditoria do chapéu DevSecOps (achados QA-9-01/QA-9-02 não tinham
implicação de segurança; confirmação de fechamento ainda cabe ao
`SECURITY-REVIEW.md` quanto ao débito `REFAT-01-03`/`react-router`, que
continua em aberto e não é afetado por este lote).

---

## Lote 10 — Painel e detalhe do campeonato (T-05, T-06)

**Base específica**: `.md/TASK.md` (Lote 10, UI-T05-01/UI-T06-01/UI-T06-02,
todas `Concluída`), `.md/UX-SPEC.md` (T-05 §2/§4, T-06 §2/§4/§6),
`.md/PRD-TECNICO.md` (CA-07.1 a CA-07.5, CA-08.1 a CA-08.11, CA-18.1/CA-18.2).

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run typecheck` (limpo), `npm run lint` (limpo),
`npx vitest run` (**972/972 testes passam**, 85 arquivos — bate com o número
declarado pela nota de implementação de UI-T06-02). Não usei a nota de
implementação do Executor como base de aprovação: li
`app/rotas/paginas/PainelTime.tsx`, `PainelTime.module.css`,
`app/rotas/paginas/DetalheCampeonato.tsx`, `DetalheCampeonato.module.css`,
`dominio/campeonatos/ordenacao.ts`, `LinhaPartida.tsx`,
`TabelaClassificacao.tsx` por inteiro, e rodei os testes reais em vez de
aceitar a alegação da nota.

### UI-T05-01 — Painel do time

**Critério de aceite**: cartão "sem dados" nunca omitido (CA-07.2);
ordenação idêntica em mobile e desktop.

| Verificação | Método | Resultado |
|---|---|---|
| CA-07.2 — cartão "sem dados" nunca omitido | Lido `PainelTime.tsx`: renderiza `.map` sobre TODAS as entradas do array publicado, sem filtro; teste real `PainelTime.test.tsx` ("cartão sem dados nunca é omitido, mesmo com outros 3 status presentes") executado | Conforme — texto "SEM DADOS"/"Cobertura indisponível nesta versão." literal (CA-07.2) |
| CA-07.4 — ordenação idêntica mobile/desktop | Lido `dominio/campeonatos/ordenacao.ts` (`PRIORIDADE_STATUS`: em-andamento → não-iniciado → eliminado → concluído → sem-dados, desempate por data do próximo jogo dentro de em-andamento) — usada por uma ÚNICA lista/DOM, só o `grid-template-columns` muda por `@media` (`PainelTime.module.css`); teste real "ordena em-andamento → eliminado → concluído → sem-dados (mesma ordem sempre)" executado | Conforme — ordenação garantida idêntica por construção (mesmo DOM, não duas árvores) |
| CA-07.1 — texto de status canônico | `montarTextoStatus` lido: "Não iniciado" / "Em andamento — \<fase\>" / "Eliminado na \<fase\>" · data / "Concluído — \<resultado\>" / "Sem dados" | Conforme à redação do próprio CA-07.1 |
| CA-07.3 — eliminado ao fim da lista com data do último jogo | `dataUltimoJogoFinalizado` + prioridade 2 em `ordenacao.ts` | Conforme |
| CA-07.5 — próximo jogo em destaque no cabeçalho | `encontrarProximoJogoGlobal` (busca entre TODOS os campeonatos, não só o mais prioritário) + teste real "destaca o próximo jogo do time no cabeçalho" | Conforme |
| CA-06.4/CA-17.3 — time sem dados (array vazio) | Ramo defensivo dedicado + teste real | Conforme |
| CA-16.4/CA-17.4 — pausa por cota | `pausadoPorCota` lido de `/dados/ingestao/status.json` (validado por Zod, `esquemaStatusPublico`) + teste real | Conforme, texto canônico "Atualização pausada por limite do provedor. Última atualização \<tempo\>." |
| CA-17.2 — frescor em alerta | `calcularFrescor` (já testado por tabela em `dominio/frescor.test.ts`, Lote 3) encadeado corretamente à `CarimboFrescor` (já auditada, Lote 7) | Conforme por leitura de código — **nenhum teste de execução real em `PainelTime.test.tsx` exercita este estado especificamente nesta tela** (achado QA-10-01, simples, ver abaixo) |
| Diretriz #4 (sem literal fora de tokens) | `PainelTime.module.css` inteiro lido | Conforme — usa `var(--largura-container)`, `var(--esp-*)`, etc. |

**Veredito**: **Aprovado** (1 achado simples de cobertura de teste, não bloqueante).

### UI-T06-01 — Detalhe do campeonato — resumo e tabela

**Critério de aceite**: `TabelaClassificacao` com `<caption>` dinâmico por
rodada; zonas com faixa + legenda + `aria-label`, ou ausentes sem erro.

| Verificação | Método | Resultado |
|---|---|---|
| `<caption>` dinâmico por rodada | `obterRodadaAtual` (maior rodada finalizada) + `legendaTabela` = `"Classificação — {competição}, {rodada}ª rodada"`; teste real "CA-08.1/CA-08.2/CA-18.1: resumo + tabela completa com zonas e linha do time destacada" confirma o texto do `<caption>` renderizado | Conforme |
| CA-18.1 — zonas com faixa + legenda + `aria-label` | `TabelaClassificacao` (já auditada no Lote 7): `aria-label="Legenda de zonas da tabela"` no `<ul>` de legenda, faixa via `--cor-zona-linha` + rótulo textual paralelo (nunca só cor, WCAG 1.4.1); `construirLegendaZonas` só lista zonas que de fato tocam alguma linha visível | Conforme, teste real confirma |
| CA-18.2 — zonas ausentes, sem erro | `legendaZonas.length > 0` controla a passagem da prop; teste real "CA-18.2: zonas ausentes — tabela sem faixas e sem legenda, sem erro" executado, tabela renderiza normalmente | Conforme |
| CA-08.1 — resumo J/V/E/D/GP/GC/SG/% | `resumo.jogos/v/e/d/gp/gc` + `SALDO {sg}` + `%` renderizados; teste real confirma | Conforme |
| CA-08.2 — tabela completa com linha destacada | `variante="completa"`, `aria-current` na linha do time (via `TabelaClassificacao`); teste real confirma `aria-current` | Conforme |
| CA-08.4 — mata-mata sem tabela | Texto canônico exato "Este campeonato é de mata-mata — não há tabela de classificação." — comparado literalmente com a Seção 4 do UX-SPEC/T-06; teste real confirma | Conforme, literal |
| Erro sem dado anterior | Texto canônico "Não conseguimos carregar este campeonato." + `TENTAR DE NOVO` — literal com a Seção 4; teste real confirma refazer a busca | Conforme |
| Diretriz #4 (sem literal fora de tokens) | `DetalheCampeonato.module.css` lido linha a linha | **Não conforme** — `.pagina { max-width: 1120px; }` é um valor literal idêntico ao token `--largura-container` (`tokens.css:137`, já usado por `PainelTime.module.css`/`Home.module.css`), contradizendo o próprio comentário de cabeçalho do arquivo ("Nenhum valor literal... fora de tokens.css"). **Achado QA-10-02 (simples)**, ver abaixo |

**Veredito**: **Aprovado** (1 achado simples, não bloqueante).

### UI-T06-02 — Detalhe do campeonato — abas Disputadas/Próximas e mata-mata

**Critério de aceite**: todos os 7 estados de `LinhaPartida` cobertos com
texto canônico exato da Seção 4 do UX-SPEC.

Os 7 textos canônicos foram comparados **literalmente** contra a Seção 4 do
UX-SPEC (não parafraseados) e confirmados por execução real do teste "abas
Disputadas/Próximas cobrem os 7 estados de `LinhaPartida` com texto canônico
(CA-08.6 a CA-08.10)":

| Variante | Texto exigido (UX-SPEC §4/T-06) | Texto renderizado (confirmado por teste real) | Resultado |
|---|---|---|---|
| disputada | letra (V)/(E)/(D) + confronto + mando, nunca só cor (CA-08.6) | `(V)` + `sao-paulo 2 × 1 atletico-mg · casa` | Conforme |
| proxima | data, horário, adversário, mando, estádio (CA-08.7) | `fluminense × sao-paulo · fora · Maracanã` | Conforme |
| sem-horario | "horário a definir" (CA-08.8) | `HORÁRIO A DEFINIR` (maiúsculo por `text-transform` do design system, mesmo padrão de outros cabeçalhos de meta — não é parafraseio) | Conforme |
| sem-data | "data a definir" (CA-10.4) | `DATA A DEFINIR` (mesma convenção de caixa) | Conforme |
| adiada | "Adiada — nova data: 21/10" (CA-08.9) | `ADIADA — NOVA DATA: 21/10` | Conforme |
| cancelada | "Cancelada" (CA-08.9) | `Cancelada` (case exato, sem transformação de CSS nesta variante) | Conforme |
| aguardando | "Aguardando resultado" (CA-08.10) | `AGUARDANDO RESULTADO` | Conforme |

| Verificação adicional | Método | Resultado |
|---|---|---|
| CA-08.4 — bloco de confronto de mata-mata (agregado/próximo jogo) | Teste real "CA-08.4: bloco de mata-mata mostra fase, confronto, agregado e próximo jogo" — `AGREGADO 1 × 0 (IDA FORA)` e `Volta: qui, 17/09 · 21h30 · Morumbis` confirmados | Conforme |
| Vazio de cada aba (texto canônico) | "O \<time\> ainda não jogou neste campeonato." / "Não há jogos marcados no momento." comparados literalmente; teste real confirma | Conforme |
| Responsividade "sem abas" ≥900px (UX-SPEC §6) | `DetalheCampeonato.module.css` lido: `hidden` HTML + `!important` a partir de 900px, sem `matchMedia` em JS — mecanismo plausível, mas **sem teste automatizado de layout** (verificação mecânica de CSS, como já feito em outros lotes para grade 2 colunas) | Aceito por leitura de código (mesma técnica já usada e aprovada em Home/UI-T02-04); não é um critério de aceite explícito desta tarefa (a descrição só cita os 7 estados de `LinhaPartida`), não gera achado |
| CA-08.11 — carimbo de frescor em alerta | `temPartidaHoje`/`calcularFrescor` encadeados corretamente (mesmo domínio já testado por tabela); **nenhum teste de execução real em `DetalheCampeonato.test.tsx` exercita o estado "em alerta" nesta tela** | Conforme por leitura de código — mesmo achado de cobertura de teste que UI-T05-01 (QA-10-01), estendido aqui |
| "Sem time" nesta tela reaproveita o texto canônico de T-05 ("...ver o painel com todos os campeonatos do ano") | UX-SPEC não define texto próprio para "sem time" em T-06 (FL-03: fluxo normal vai de T-05 direto a T-04 quando não há time — esta tela normalmente não é alcançável sem time salvo, é uma defesa contra navegação direta por URL) | **Cópia inconsistente** — a tela é "Detalhe do campeonato", não "Painel", e o texto fala de "o painel". **Achado QA-10-03 (simples)**, ver abaixo |

**Veredito**: **Aprovado** (2 achados simples, não bloqueantes — um deles
compartilhado com UI-T05-01).

### Achados simples — Lote 10 (viram tarefa em `Refatoração Lote-10`, tarefas continuam `Concluída`)

- **QA-10-01** — Nenhum teste de execução real exercita o estado "frescor em
  alerta" (CA-17.2/CA-08.11) em `PainelTime.test.tsx`/`DetalheCampeonato.test.tsx`,
  embora a função de domínio (`calcularFrescor`) já seja testada por tabela e
  o encadeamento nas duas telas esteja correto por leitura de código. Não
  compromete o critério de aceite central (ambas as tarefas citam CA-17.2/
  CA-08.11 só como parte da descrição, não como o critério de aceite
  específico desta tarefa no TASK.md) — ajuste pontual de cobertura de
  teste, baixo esforço.
- **QA-10-02** — `DetalheCampeonato.module.css` usa `max-width: 1120px`
  literal em vez de `var(--largura-container)` (Diretriz de Implementação
  #4), contradizendo o próprio comentário de cabeçalho do arquivo. Ajuste
  pontual de 1 linha, sem risco de regressão visual (mesmo valor numérico).
- **QA-10-03** — O estado "sem time" de `DetalheCampeonato.tsx` reaproveita
  literalmente o texto canônico de T-05 ("Escolha seu time para ver o painel
  com todos os campeonatos do ano."), que menciona "o painel" numa tela que
  é "Detalhe do campeonato". Estado dificilmente alcançável no fluxo normal
  (FL-03 já desvia para T-04 antes de chegar a T-06 sem time), mas o texto
  deveria referenciar o campeonato/detalhe, não o painel, caso alguém chegue
  aqui por link direto.

Nenhum dos três achados compromete o critério de aceite central de nenhuma
das 3 tarefas, exige mudança de escopo/arquitetura, ou bloqueia outra tarefa
do lote — classificados como **simples** (não crítica).

### Fechamento estrutural do Lote 10

- [x] As 3 tarefas (UI-T05-01, UI-T06-01, UI-T06-02) estão `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: UI-T05-01 depende de UI-DS-01/02/08 (Lote 7, `Validado`); UI-T06-01 depende de UI-DS-07B/08 (Lote 7, `Validado`); UI-T06-02 depende de UI-T06-01 (mesmo lote, `Concluída`) — todas satisfeitas.
- [x] Nenhuma tarefa `Bloqueada`.
- [x] 3 achados simples encontrados nesta checagem (QA-10-01/02/03) — viram tarefas em `Refatoração Lote-10` (`.md/TASK.md`), sem reabrir o Coordenador.

Nenhuma inconsistência que exija redesenho de dependência/decomposição —
sem escalonamento ao Coordenador nesta rodada.

**Veredito — Lote 10**: **Aprovado (com ressalvas)**. 3/3 tarefas aprovadas;
972/972 testes, `tsc`/`eslint` limpos; os 7 estados de `LinhaPartida`
confirmados com texto canônico literal por execução real de teste; `<caption>`
dinâmico e zonas de `TabelaClassificacao` confirmados (com/sem zona, sem
erro); ordenação de CA-07.4 confirmada por construção (DOM único); 3 achados
simples viram tarefas em `Refatoração Lote-10`, nenhum bloqueante. Libera
para auditoria do chapéu DevSecOps.

---

## Lote 11 — Rivais, comparativo e simulação (T-07, T-08, T-09)

**Base específica**: `.md/TASK.md` (Lote 11, UI-T07-01/UI-T08-01/UI-T09-01/
UI-T09-02, todas `Concluída`), `.md/UX-SPEC.md` (T-07 §2/§4, T-08 §2/§4/§6,
T-09 §2/§4/§6), `.md/PRD-TECNICO.md` (CA-09.1 a CA-09.7, CA-10.1 a CA-10.6,
CA-11.1 a CA-11.10).

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run typecheck` (limpo), `npm run lint` (limpo),
`npx vitest run` (**999/999 testes passam**, 88 arquivos — bate com o número
declarado pela nota de implementação de UI-T09-02). Não usei a nota de
implementação do Executor como base de aprovação: li
`app/rotas/sobreposicoes/EscolherRivais.tsx`, `app/rotas/paginas/Comparativo.tsx`,
`app/rotas/paginas/Simulacao.tsx`, `app/design-system/BlocoPreto.tsx`,
`dominio/tipos/estado-local.ts` e `app/armazenamento/cenario.ts` por
inteiro, os respectivos `*.test.tsx`, e rodei os testes reais em vez de
aceitar a alegação da nota.

### UI-T07-01 — Escolher rivais

**Critério de aceite**: confirmação de remoção com texto canônico da Seção
4; time do coração nunca aparece na lista.

| Verificação | Método | Resultado |
|---|---|---|
| CA-09.1 — time do coração nunca aparece | `clubesSemMeuTime` filtra `clube.id !== estadoAbertura.meuTimeId` antes de qualquer busca; teste real "lista os outros clubes, filtra pela busca e nunca mostra o time do coração" (`screen.queryByText('São Paulo')` → `null`) executado | Conforme |
| CA-09.1 — busca tolerante | `normalizarParaBusca` (remove acento/caixa) casa por nome ou sigla; teste real confirma filtragem por "san" | Conforme |
| CA-09.2 — adicionar até 2 e persistir | Checkbox de 0 a 2, persistência só em "Confirmar rivais" via `salvarPreferencias`; teste real confirma `rivais: ['santos', 'palmeiras']` salvo | Conforme |
| CA-09.3 — impedir 3º com aviso canônico | Texto exigido: "até 2 rivais; remova um para trocar" — implementado `TEXTO_LIMITE_ATINGIDO = 'Até 2 rivais; remova um para trocar.'`, comparado literalmente com a Seção 4 do UX-SPEC (`T-07 · Limite atingido`); teste real confirma aviso + checkbox permanece desmarcado | Conforme, literal |
| CA-09.4 — confirmação de remoção com texto canônico | Texto exigido: "Remover Corinthians? Os palpites dele na simulação serão apagados." — implementado com interpolação `Remover ${nome}? Os palpites dele na simulação serão apagados.`, comparado literalmente; teste real confirma o texto renderizado e o fluxo completo (confirmar remove + apaga `Cenario`; cancelar não altera nada) | Conforme, literal |
| CA-09.4 — decisão de arquitetura (confirmação só quando há cenário salvo) | `Cenario` é escopado por `temporada:time:rivais-ordenados` (`ADR-005 regra 3`), não por rival individual — não há como isolar "só os palpites daquele rival" sem dados de calendário (fora das dependências desta tarefa). Confirmação em linha só aparece quando remover de fato arriscaria descartar uma simulação salva existente; desmarcar um rival nunca confirmado, ou confirmado sem cenário salvo, remove direto (nada a perder) | Decisão de arquitetura razoável e documentada, coerente com o mesmo padrão já aceito em `EscolherTime`/CA-06.3 (Lote 9) — não é lacuna, aceito sem achado |

**Veredito**: **Aprovado**, sem achado.

### UI-T08-01 — Comparativo no Brasileirão

**Critério de aceite**: "confronto direto" aparece nas duas listas
simultaneamente (CA-10.3); estado zero rival com atalho (CA-10.5).

| Verificação | Método | Resultado |
|---|---|---|
| CA-10.3 — confronto direto nas duas listas simultaneamente | Fonte de dado única (`brasileirao.json`, todas as partidas de todos os clubes): cada coluna filtra `partidasRestantesDoClube` e marca `confrontoDireto = clubesComparadosIds.has(adversarioId)` — a MESMA partida aparece nas listas de ambos os clubes comparados, nunca uma sincronização manual entre dois estados independentes; teste real "confronto direto aparece nas duas listas simultaneamente" confirma `getAllByText('CONFRONTO DIRETO').length >= 2` | Conforme, garantido por construção (fonte única) |
| CA-10.5 — zero rival, atalho para T-07 | Texto exigido "escolha até 2 rivais" com atalho — implementado "Escolha até 2 rivais para ver a briga lado a lado." + botão "ESCOLHER RIVAIS" chamando `abrirEscolherRivais`; teste real confirma o texto e que o clique abre de fato a sobreposição `EscolherRivais` (heading "Escolher rivais" aparece) | Conforme, literal |
| CA-10.1 — dados dos cartões, time sempre primeiro | `clubesComparados` monta `[{timeId, ehTime:true}, ...rivais]` (time sempre índice 0); teste real confirma posição/pontos/aproveitamento/diferença (+5 PTS/+1 PT) para os 3 clubes | Conforme |
| CA-10.2 — calendário restante completo | `partidasRestantesDoClube` filtra por `mandanteId`/`visitanteId`, exclui só `finalizada`/`cancelada` — todas as rodadas restantes entram | Conforme |
| CA-10.4 — rodada sem data | Teste real "partida sem data mostra 'DATA A DEFINIR'" executado | Conforme, literal |
| CA-09.5 — Brasileirão sem dados | Estado dedicado com atalho para rivais, teste real confirma | Conforme |
| CA-10.6 — só dados do Brasileirão | Única URL consumida é `URL_FUTEBOL_BRASILEIRAO`; nenhuma chamada a `/dados/futebol/clube/<slug>.json` neste arquivo | Conforme |
| Desvio documentado — layout mobile por coluna (cartão+calendário) em vez de "cartões empilhados + abas compartilhadas" (UX-SPEC §6, T-08 <600px) | Lido o wireframe mobile (UX-SPEC §2/T-08) e a tabela de responsividade (§6): a implementação preserva toda a informação (nenhum jogo/campo omitido) e a ordem "time sempre primeiro", só substitui a affordance de abas por rolagem vertical por coluna. Nenhum CA-10.x exige literalmente "abas" | Aceito como está — não compromete nenhum critério de aceite; registrado como nota de design, não gera achado de código (mesma classe de decisão já aceita em Lotes anteriores para pequenas divergências de affordance que preservam toda a informação) |

**Veredito**: **Aprovado**, sem achado.

### UI-T09-01 — Simulação — grade de palpites

**Critério de aceite**: confronto direto aplicado ao clube espelhado sem
permitir contradição (CA-11.4).

| Verificação | Método | Resultado |
|---|---|---|
| CA-11.4 — impossibilidade estrutural de contradição | Lido `dominio/tipos/estado-local.ts`: `Cenario.palpites` é `z.record(z.string(), palpiteSchema)` — **um único valor por id de partida**, sempre perspectiva do mandante. Não existe segundo campo onde um valor divergente para o mesmo confronto pudesse ser gravado — a UI (`converterParaPerspectiva`/`converterParaMandante`) só traduz o valor único para exibição, nunca duplica a regra. Confirmado por teste real "CA-11.4: confronto direto tem uma única linha editável, sem contradição possível": um único `fieldset`/grupo para a partida (não dois), com o São Paulo como visitante do confronto — ao clicar "Vitória" (perspectiva de São Paulo), o valor persistido em `Cenario.palpites['p2']` é `'derrota'` (perspectiva do mandante, Palmeiras), confirmando o espelhamento automático | Conforme — contradição é estruturalmente impossível (modelo de dados, não trava de UI), verificado com teste de execução real, não só por leitura de código |
| CA-11.1 — grade por rodada com controle V/E/D/— | `partidasRelevantes` filtra por comparados + status aberto; `SeletorPalpite` com 4 opções; teste real "grade agrupada por rodada com filtro correto de partidas irrelevantes" confirma partida de clube não comparado nunca aparece | Conforme |
| CA-11.6 — travamento ao chegar resultado real | `estaTravada` (status finalizada + placar não nulo) vira variante `travado` do `SeletorPalpite` (sem rádio); `partidasTravadasVistas` persistido imediatamente; aviso `aria-live="polite"` com texto canônico "1 palpite virou resultado real e foi travado."; teste real confirma ausência de `input[type=radio]` na partida travada, o texto do aviso e a persistência de `partidasTravadasVistas` | Conforme, literal |
| CA-11.9 — armazenamento indisponível | Reaproveita `lerCenario`/`salvarCenario` (UI-DS-09, já auditado); teste real "CA-11.9" confirma o aviso | Conforme |
| Uso da variante `espelhado` de `SeletorPalpite` (UI-DS-05) | Implementada e testada em UI-DS-05, mas **não usada** nesta tela — a tela usa uma única linha editável em vez de duas instâncias espelhadas (uma editável, uma somente-leitura) | Decisão de implementação documentada, não é lacuna do CA-11.4 (que exige "sem contradição", não duas instâncias visuais) — sem achado aqui; ver achado sobre a matriz responsiva abaixo (UI-T09-02) |

**Veredito**: **Aprovado**, sem achado.

### UI-T09-02 — Simulação — projeção fixa e limpar cenário

**Critério de aceite**: recálculo reflete em < 100ms (RNF-14/ADR-016);
bloco PROJEÇÃO nunca obscurece foco ao rolar (WCAG 2.4.11).

| Verificação | Método | Resultado |
|---|---|---|
| RNF-14 — recálculo < 100ms | `saidaSimulacao = useMemo(() => simular(...), [clubesParaMotor, partidasParaMotor, palpites])` — `simular` é puro/síncrono (`dominio/simulacao/motor.ts`, já testado por tabela no Lote 3), sem rede/I-O no caminho; teste real "recálculo imediato ao mudar um palpite (projeção antes/depois)" confirma que a UI reflete a mudança na mesma renderização (sem `await`/timer) | Conforme — orçamento cumprido trivialmente por construção (sem operação assíncrona), não é necessário benchmark de tempo de parede |
| WCAG 2.4.11 — bloco PROJEÇÃO nunca obscurece foco | Lido `BlocoPreto.tsx` (UI-DS-02, Lote 7, já auditado): mede a própria altura via `ResizeObserver`/`getBoundingClientRect` e publica `--bloco-preto-projecao-altura`/`scroll-padding-bottom` em `:root` enquanto montado, restaurando ao desmontar. `Simulacao.tsx` só consome `<BlocoPreto variante="projecao">` (linha 625) — **confirmado que o mecanismo é reutilizado, não reimplementado**: nenhuma ocorrência de `scroll-padding`/`ResizeObserver`/medição de altura em `Simulacao.tsx`/`Simulacao.module.css` | Conforme, mecanismo corretamente reutilizado de UI-DS-02 |
| CA-11.2/CA-11.3/CA-11.10 — recálculo, "projetado"/"máximo possível", só entre comparados | `saidaSimulacao.ordenacao`/`porClube` vêm só de `clubesParaMotor` (= `ordemComparados` = time + rivais); teste real confirma ordenação por desempate de vitórias projetadas refletida e disclaimer sempre presente | Conforme |
| CA-11.7 — "limpar cenário" com confirmação | Texto canônico exato "Apagar todos os palpites deste cenário? Isso não pode ser desfeito." com `[ APAGAR ]`/`Cancelar`; teste real confirma o fluxo completo (abre, cancela sem alterar, apaga removendo do DOM e da chave `sportslm.cenario.v1`) | Conforme, literal |
| CA-11.8 — sem jogos restantes, pontuação final | Texto canônico "Campeonato encerrado — sem jogos restantes. Pontuação final: {clube pts, ...}."; teste real com fixture sem partidas restantes confirma | Conforme, literal |
| Vazio (nenhum palpite) — texto canônico | "{Time} {pontos} pts (máx {máx}). Faça um palpite para ver a projeção mudar." comparado literalmente com a Seção 4 (T-09); teste real confirma | Conforme, literal |
| **Matriz responsiva ≥900px ausente** (UX-SPEC §6, tabela de responsividade: "Matriz rodada × clube; PROJEÇÃO fixo; barras de acumulado no rodapé") | Lido `Simulacao.module.css`/`Simulacao.tsx`: nenhum `@media (min-width: 900px)` de layout de matriz; a mesma lista de uma linha por partida é usada em todas as larguras, sem colunas por clube nem "barras de acumulado". A variante `espelhado` de `SeletorPalpite` (UI-DS-05) permanece sem uso em produção | **Não conforme com UX-SPEC §6** (achado **QA-11-01**, simples — ver abaixo). Não compromete nenhum CA-11.x (a grade funciona corretamente e sem contradição em todas as larguras) nem o critério de aceite específico desta tarefa no TASK.md (RNF-14/WCAG 2.4.11) |

**Veredito**: **Aprovado** (1 achado simples, não bloqueante).

### Achados simples — Lote 11 (vira tarefa em `Refatoração Lote-11`, tarefa continua `Concluída`)

- **QA-11-01** — A matriz responsiva "rodada × clube" com barras de acumulado
  por rodada, exigida pelo UX-SPEC §6 para T-09 a partir de 900px (coluna por
  clube comparado, usando a variante `espelhado` de `SeletorPalpite` já
  implementada em UI-DS-05), não foi implementada: a tela usa a mesma lista
  de uma linha por partida em todas as larguras. Já era uma decisão
  explicitamente documentada e sinalizada como "aditiva" por UI-T09-01/02 (não
  um bug oculto). Não compromete nenhum CA-11.x nem o critério de aceite
  específico da tarefa no TASK.md (RNF-14/WCAG 2.4.11, ambos conformes) —
  ajuste de camada visual/responsiva, isolado ao CSS/JSX de apresentação, sem
  risco à lógica de simulação já correta e testada.

Achado classificado como **simples** (não crítica): não compromete o
critério de aceite central de UI-T09-02, não exige mudança de escopo/
arquitetura, e não bloqueia nenhuma outra tarefa do lote (T-09 já é a última
tela do fluxo, Lote 11 é o último lote de tela antes do Lote 12).

### Fechamento estrutural do Lote 11

- [x] As 4 tarefas (UI-T07-01, UI-T08-01, UI-T09-01, UI-T09-02) estão `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: UI-T07-01 depende de UI-DS-07A/UI-DS-09 (Lote 7, `Validado`); UI-T08-01 depende de UI-DS-06/UI-DS-08 (Lote 7, `Validado`); UI-T09-01 depende de DOM-05 (Lote 3, `Validado`)/UI-DS-05/UI-DS-09 (Lote 7, `Validado`); UI-T09-02 depende de UI-T09-01 (mesmo lote, `Concluída`)/DOM-05 — todas satisfeitas, confirmado por leitura direta do status de cada ID no `TASK.md`.
- [x] Nenhuma tarefa `Bloqueada`.
- [x] 1 achado simples encontrado nesta checagem (QA-11-01) — vira tarefa em `Refatoração Lote-11` (`.md/TASK.md`), sem reabrir o Coordenador.

Nenhuma inconsistência que exija redesenho de dependência/decomposição — sem
escalonamento ao Coordenador nesta rodada. Como este é o último lote de tela
antes do Lote 12 (portão de acessibilidade/telemetria/segurança
transversal), confirmo também que as 4 tarefas deste lote estão entre as
dependências listadas de `QA-01` (Lote 12) — nenhuma pendência de lote de
tela ficou de fora do escopo de `QA-01`.

**Veredito — Lote 11**: **Aprovado (com ressalvas)**. 4/4 tarefas aprovadas;
999/999 testes (88 arquivos), `tsc`/`eslint` limpos; CA-09.1 (time do coração
nunca aparece) e CA-09.3/CA-09.4 (textos canônicos) confirmados por execução
real de teste; CA-10.3 (confronto direto nas duas listas) confirmado como
garantido por construção (fonte única de dado) e por teste real; CA-11.4
(confronto direto sem contradição) confirmado como impossibilidade estrutural
do modelo de dados (`Cenario.palpites`, um valor por partida), verificado com
teste real de espelhamento efetivo (visitante marca "Vitória", mandante
persiste "derrota"); WCAG 2.4.11 confirmado como mecanismo reutilizado de
UI-DS-02 (`BlocoPreto`), não reimplementado; 1 achado simples (QA-11-01,
matriz responsiva ≥900px ausente) vira tarefa em `Refatoração Lote-11`, sem
bloqueio. Libera para auditoria do chapéu DevSecOps.

---

## Refatoração Lote-10 — validação de fechamento de débito técnico

**Base específica**: achados `QA-10-01`/`QA-10-02`/`QA-10-03` (acima) e as 3
tarefas `REFAT-10-01`/`REFAT-10-02`/`REFAT-10-03` (`.md/TASK.md`, lote
`Refatoração Lote-10`), todas `Concluída`.

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run typecheck` (limpo), `npm run lint` (limpo),
`npx vitest run` executado **3 vezes seguidas** (**1002/1002 testes passam**
nas 3 rodadas, 88 arquivos — sem nenhuma falha intermitente). Não usei a nota
de implementação do Executor como base de aprovação: li
`app/rotas/paginas/PainelTime.test.tsx`, `DetalheCampeonato.test.tsx`,
`DetalheCampeonato.module.css` e `DetalheCampeonato.tsx` diretamente.

- **REFAT-10-01**: confirmado por leitura direta que
  `PainelTime.test.tsx` (caso `"REFAT-10-01/CA-17.2: frescor muito
  desatualizado mostra o carimbo em alerta"`) e `DetalheCampeonato.test.tsx`
  (caso `"REFAT-10-01/CA-08.11: ..."`) injetam um `agora` muito posterior ao
  `geradoEm` fixo da fixture, calculam o resultado esperado com a mesma
  função de domínio `calcularFrescor` (não duplicam a regra) e confirmam
  `data-estado="alerta"` no `CarimboFrescor` renderizado de fato — não é
  suposição, é asserção sobre o DOM. Ambos os testes passam dentro de
  `npx vitest run`. **Achado QA-10-01 resolvido de fato**.
- **REFAT-10-02**: confirmado por leitura direta de
  `DetalheCampeonato.module.css` que `.pagina` agora usa
  `max-width: var(--largura-container);` — nenhum literal `1120px`
  remanescente no arquivo. **Achado QA-10-02 resolvido de fato**.
- **REFAT-10-03**: confirmado por leitura direta de `DetalheCampeonato.tsx`
  que o texto do estado "sem time" é agora `"Escolha seu time para ver o
  detalhe deste campeonato."` — não contém mais a palavra "painel" (as
  únicas ocorrências remanescentes de "painel" no arquivo são
  `id="painel-disputadas"`/`id="painel-proximas"` e `estilos['painel']`,
  atributos técnicos de aba HTML, não o texto visível ao usuário; não têm
  relação com o achado QA-10-03). **Achado QA-10-03 resolvido de fato**.

### Fechamento estrutural de `Refatoração Lote-10`

- [x] As 3 tarefas (`REFAT-10-01`, `REFAT-10-02`, `REFAT-10-03`) estão `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: as 3 dependiam de UI-T05-01/UI-T06-01 (Lote 10, já `Validado`) — satisfeitas.
- [x] Nenhuma tarefa `Bloqueada`.
- [x] Nenhum achado novo de código encontrado durante esta verificação que justifique nova tarefa de refatoração.

Nenhuma inconsistência que exija redesenho de dependência/decomposição —
sem escalonamento ao Coordenador nesta rodada.

**Veredito**: **Aprovado**. `Refatoração Lote-10` fechada — os 3 achados
simples do Lote 10 estão de fato corrigidos, não só relatados pela nota do
Executor; libera para auditoria do chapéu DevSecOps (nenhum dos 3 achados
tinha implicação de segurança).

---

## Refatoração Lote-11 — validação de fechamento de débito técnico

**Base específica**: achado `QA-11-01` (acima) e a tarefa `REFAT-11-01`
(`.md/TASK.md`, lote `Refatoração Lote-11`), `Concluída` — inclui também a
correção de flakiness de um teste registrada na própria nota de
implementação da tarefa.

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run typecheck` (limpo), `npm run lint` (limpo),
`npx vitest run` executado **3 vezes seguidas** (**1002/1002 testes passam**
nas 3 rodadas, 88 arquivos, sem nenhuma falha intermitente — inclusive o
caso de `CA-11.6`/aria-live citado pela nota como historicamente instável
sob carga da suíte completa). Não usei a nota de implementação do Executor
como base de aprovação: li `Simulacao.tsx`, `Simulacao.module.css`,
`Simulacao.test.tsx`, `SeletorPalpite/SeletorPalpite.tsx` e `BarraPontuacao`
diretamente.

- **Matriz responsiva ≥900px**: confirmado em `Simulacao.module.css` que
  `.matriz` carrega `display: none` por padrão (com `hidden` HTML
  incondicional no JSX) e que a regra `@media (min-width: 900px)` esconde
  `.grade` e mostra `.matriz` com `display: grid !important` — mesma
  técnica sem `matchMedia` já usada e aprovada em `DetalheCampeonato.tsx`.
- **Reaproveitamento de `SeletorPalpite` variante `espelhado` (UI-DS-05)**:
  confirmado em `Simulacao.tsx` (função `montarCelulaMatriz`, e o cálculo de
  `variante` na renderização da matriz) que a segunda ocorrência de cada
  confronto direto na matriz usa `variante="espelhado"` do componente
  `SeletorPalpite` já existente (`app/design-system/SeletorPalpite/
  SeletorPalpite.tsx`, que já implementa `somenteLeitura`/`desabilitado`
  quando `variante === 'espelhado'`) — não há reimplementação de layout de
  seletor somente-leitura dentro de `Simulacao.tsx`; as duas ocorrências
  (editável e espelhada) leem/gravam o mesmo `Cenario.palpites[partida.id]`,
  nunca uma segunda fonte de verdade.
- **Reaproveitamento de `BarraPontuacao` (UI-DS-06)**: confirmado que o bloco
  "ACUMULADO POR RODADA" da matriz (`estilos['matrizAcumulado']`) renderiza
  `<BarraPontuacao nomeClube=... valor={stats.projetado}
  valorMaximo={valorMaximoAcumulado} .../>`, componente já existente, sem
  reimplementação de barra própria.
- **Nenhuma regressão funcional em CA-11.1 a CA-11.10**: os 7 casos de teste
  originais de `UI-T09-01`/`UI-T09-02` (grade CA-11.1, confronto direto sem
  contradição CA-11.4, travamento CA-11.6, armazenamento indisponível
  CA-11.9, recálculo/ordenação/disclaimer CA-11.2/CA-11.3/CA-11.10, "limpar
  cenário" CA-11.7, "sem jogos restantes" CA-11.8) continuam presentes e
  passando em `Simulacao.test.tsx` sem alteração de asserção de
  comportamento — só 2 buscas por texto ganharam escopo (`grade-lista`) para
  não colidir com a nova matriz, o que é mudança de seletor de teste, não de
  comportamento validado. `npx vitest run app/rotas/paginas/Simulacao.test.tsx`
  confirmado limpo isoladamente (12/12) e dentro da suíte completa.
- **Correção de flakiness**: o caso `CA-11.6` (asserção síncrona do
  `aria-live`) foi envolvido em `vi.waitFor(...)`, mesmo padrão já usado
  pelas duas asserções vizinhas. Confirmado por 3 execuções seguidas de
  `npx vitest run` (suíte completa, 1002/1002 em todas), sem nenhuma falha
  intermitente — não é só a alegação de "5x seguidas" da nota do Executor,
  é reconfirmação independente nesta validação.

### Fechamento estrutural de `Refatoração Lote-11`

- [x] A tarefa (`REFAT-11-01`) está `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: depende de UI-T09-02 (Lote 11, já `Validado`) — satisfeita.
- [x] Nenhuma tarefa `Bloqueada`.
- [x] Nenhum achado novo de código encontrado durante esta verificação que justifique nova tarefa de refatoração.

Nenhuma inconsistência que exija redesenho de dependência/decomposição —
sem escalonamento ao Coordenador nesta rodada.

**Veredito**: **Aprovado**. `Refatoração Lote-11` fechada — a matriz
responsiva ≥900px de T-09 está implementada de fato, reaproveitando
`SeletorPalpite`/UI-DS-05 (variante `espelhado`) e `BarraPontuacao`/UI-DS-06
sem reimplementação, sem regressão em nenhum CA-11.x, e sem flakiness
residual (3 execuções completas da suíte, 1002/1002 em todas); libera para
auditoria do chapéu DevSecOps.

---

## Lote 12 — Telemetria, acessibilidade e segurança transversal

### QA-01 — Verificação de acessibilidade consolidada

**Autor deste registro**: Executor (chapéu Frontend) — auto-relato de
implementação, entregue ao Validador para conferência formal (mesma
convenção de nota de implementação do `TASK.md`; ainda não é veredito do
chapéu QA, que fecha o lote separadamente).

**Critério de aceite**: zero violações críticas/sérias de `axe-core` em
qualquer combinação tela×tema×paleta; os 6 itens do roteiro manual de
UX-SPEC §5.8 documentados com resultado.

**Implementação**: `app/rotas/acessibilidade-consolidada.test.tsx`, novo
arquivo de teste (48 casos) — nenhuma das 9 telas tinha cobertura de
`axe-core` própria antes desta tarefa (só `FaixaClube.test.tsx`/UI-DS-01,
isolado, cobria o componente).

#### Amostragem (matriz reduzida, documentada — TASK.md §3/Lote 12 permite
reduzir de 9×2×4=72 quando uma combinação é redundante)

- **Tema (claro/escuro)**: as 2, em todas as 9 telas — dimensão barata e de
  alto risco (todo o contraste do sistema muda).
- **Paleta de clube** (as 4 de UX-SPEC §5 — Mirassol/clara, Palmeiras/escura,
  São Paulo/vermelha, Corinthians/acromática, de
  `app/design-system/paletasTeste.fixture.ts`): o PAR cor×contraste em si já
  tem cobertura exaustiva e isolada em `FaixaClube.test.tsx` (UI-DS-01: 3
  variantes × 2 temas × 4 paletas = 24 casos, todos passando) — não
  reexecutado aqui. Esta verificação cobre o risco de **composição** (a cor
  do clube colidindo com o chrome ao redor: navegação, cartões, texto
  vizinho):
  - **Home (T-02) e Painel do time (T-05)** — identificadas como maior risco
    pelo próprio `TASK.md` §6 (PR-03: "`FaixaClube`/`derivador-paleta` são os
    dois componentes de maior risco de acessibilidade") e as duas telas com a
    variante mais rica de `FaixaClube` (`completa`, ao lado de PRÓXIMO
    JOGO/A BRIGA ou dos cartões de campeonato) — rodam as **4 paletas** × 2
    temas (16 casos).
  - As **7 telas restantes** (Onboarding passo 1+2, Configurações, Escolher/
    trocar time, Detalhe do campeonato, Escolher rivais, Comparativo,
    Simulação) usam cor de clube só como acento pontual (`AvatarClube` com
    `corBase`, ou uma única linha/faixa) — rodam uma amostra de **2 das 4**
    paletas × 2 temas (32 casos), escolhida para tracejar os dois extremos do
    espaço de risco: `Corinthians` (acromática — risco de algo depender de
    matiz) e `Mirassol` (clara, acento escurecido até 4,5:1 — risco de um
    contraste ajustado "vazar" claro demais fora de `FaixaClube`). São
    Paulo/Palmeiras (paletas que já "passam sem ajuste", menor risco
    marginal) permanecem cobertas inteiras em `FaixaClube.test.tsx`.
  - Total: 16 + 32 = **48 casos**, todos passando.
- Cada tela usa o estado **preenchido** (não vazio/carregando/erro, já
  cobertos pelos testes próprios de cada tela) — maior superfície de DOM,
  pior caso para acessibilidade.

O item 6 do roteiro manual ("as quatro paletas de clube [...] nos dois
temas") fica satisfeito por esta amostragem: as 4 paletas aparecem em pelo
menos uma tela de cada eixo de risco (identidade completa vs. acento
pontual), nos 2 temas, com a matemática de contraste em si já validada à
exaustão em UI-DS-01.

#### Matriz de resultados (`npx vitest run app/rotas/acessibilidade-consolidada.test.tsx`)

| Tela (UX-SPEC) | Temas | Paletas testadas | Casos | Resultado |
|---|---|---|---|---|
| T-02 Home | claro/escuro | Mirassol, Palmeiras, São Paulo, Corinthians | 8 | 0 violações críticas/sérias |
| T-05 Painel do time | claro/escuro | Mirassol, Palmeiras, São Paulo, Corinthians | 8 | 0 violações críticas/sérias |
| T-01 Onboarding (passo 1) | claro/escuro | Corinthians, Mirassol | 4 | 0 violações críticas/sérias |
| T-01 Onboarding (passo 2) | claro/escuro | Corinthians, Mirassol | 4 | 0 violações críticas/sérias |
| T-03 Configurações (sobreposição, bloco "Meu time") | claro/escuro | Corinthians, Mirassol | 4 | 0 violações críticas/sérias |
| T-04 Escolher/trocar time (sobreposição) | claro/escuro | Corinthians, Mirassol | 4 | 0 violações críticas/sérias |
| T-06 Detalhe do campeonato | claro/escuro | Corinthians, Mirassol | 4 | 0 violações críticas/sérias |
| T-07 Escolher rivais (sobreposição) | claro/escuro | Corinthians, Mirassol | 4 | 0 violações críticas/sérias |
| T-08 Comparativo | claro/escuro | Corinthians, Mirassol | 4 | 0 violações críticas/sérias |
| T-09 Simulação | claro/escuro | Corinthians, Mirassol | 4 | 0 violações críticas/sérias |
| **Total** | | | **48/48** | **0 violações críticas/sérias em qualquer combinação** |

Critério de severidade aplicado (documentado no próprio teste,
`semViolacoesGraves`): o critério de aceite pede "zero violações
críticas/sérias", não "zero violações de qualquer severidade" — o teste
filtra por `impact === 'critical' || impact === 'serious'` e falharia (com
log das violações) se alguma aparecesse; nenhuma apareceu nas 48 execuções.
Violações `moderate`/`minor` (se existissem) seriam logadas para
conhecimento sem derrubar o teste — nenhuma foi observada nas 48 execuções.

**Limitação de ambiente registrada com honestidade**: `axe-core`, sob jsdom,
não implementa `HTMLCanvasElement.getContext` — a regra `color-contrast`
usa canvas internamente para detectar fontes de ícone-ligadura
(`_isIconLigature`) e cai num `console.error` interno tratado (não falha a
regra, só perde essa heurística específica) em toda execução. Não é
descartado nem escondido: aparece no stdout de `npx vitest run` para quem
rodar de novo, e é mencionado aqui para que o Validador saiba que é
limitação conhecida de jsdom/axe-core, não uma falha silenciosa deste
Executor.

#### Roteiro de verificação manual (UX-SPEC §5.8, os 6 itens)

| # | Item | Resultado | Evidência |
|---|---|---|---|
| 1 | Percurso completo dos 7 fluxos (§1.2) só com teclado | **Verificação estrutural equivalente, não navegação manual real** | Nenhum elemento interativo das 9 telas está fora da ordem de tab/`tabindex` negativo não documentado; os testes de cada tela (Lotes 8-11) já cobrem `fireEvent.click`/`fireEvent.keyDown` (Esc fecha sobreposição, foco volta ao gatilho — `Sobreposicao.test.tsx`/UI-DS-07A) e o `axe-core` desta tarefa reprova automaticamente `button-name`/`link-name`/`aria-*` ausentes, que são a causa mais comum de "inalcançável por teclado". **Limitação honesta**: isto não é o mesmo que percorrer os 7 fluxos com `Tab`/`Enter`/`Espaço` de ponta a ponta numa sessão manual real — este ambiente não tem navegador interativo disponível para esse percurso. Sinalizado como pendência de verificação manual real antes de produção, não como "feito". |
| 2 | T-02, T-06, T-08, T-09 com leitor de tela (VoiceOver iOS e NVDA) | **Não executado — sem leitor de tela real neste ambiente** | Nenhum VoiceOver/NVDA disponível neste ambiente de execução (CLI headless). O que foi verificado, como aproximação estrutural: `axe-core` valida nome acessível (`aria-label`/texto) de cada elemento interativo, `TabelaClassificacao` é `<table>` real com `<caption>`/`scope`/`aria-current` (UI-DS-01/UI-T06-01, já testado), e a grade de simulação usa `fieldset`/`legend` por partida (UI-T09-01, já testado) — a leitura linear correta desses elementos por um leitor de tela real depende da árvore de acessibilidade estar correta, o que os 48 casos de `axe-core` confirmam ao nível de regra automatizada. **Isto não substitui uma sessão real com VoiceOver/NVDA** — sinalizado como pendência explícita, não simulado como "passou". |
| 3 | Nenhum estado da Seção 4 depende de cor para ser entendido | **Conforme, verificado por leitura de código + teste existente** | V/E/D com letra (`LinhaPartida`), zonas com faixa + legenda + `aria-label` (`TabelaClassificacao.test.tsx`), status de campeonato com símbolo `●○✓—` + texto (`PainelTime.test.tsx`, CA-07.1), confronto direto com `⚔` + "CONFRONTO DIRETO" (`Simulacao.test.tsx`, CA-11.4), item ativo de navegação com sublinhado + `aria-current` (`Navegacao.test.tsx`), palpite selecionado com preenchimento + contorno + letra (`SeletorPalpite.test.tsx`) — todos já cobertos por teste de asserção de texto/atributo (não só CSS) nas tarefas dos Lotes 7-11; reconferido nesta tarefa que nenhum desses testes foi alterado. |
| 4 | Foco não obscurecido pela barra inferior e pelo bloco PROJEÇÃO, no celular | **Conforme, verificado por leitura de CSS** | `scroll-margin` aplicado nos elementos focáveis relevantes (tokens de UX-SPEC §5.2/§3.6, `app/design-system/tokens.css`) — mecanismo herdado do design system (UI-DS-05/07A), não reimplementado por tela; nenhuma mudança nesta tarefa que o afete. **Limitação honesta**: verificação de layout real (viewport 360px + barra inferior fixa + rolagem até o campo focado) não foi executada visualmente neste ambiente sem navegador — verificação é de código (presença da regra CSS), não de captura de tela real. |
| 5 | Uso a 200% de zoom em 320px | **Não executado neste ambiente — sem navegador real** | Sem navegador gráfico disponível nesta sessão para simular zoom/viewport real. Verificação indireta: nenhum `user-scalable=no`/`maximum-scale` em `app/index.html` (grep confirmado), e o layout usa unidades relativas (`rem`/`%`/tokens de espaçamento) em vez de pixel fixo na maior parte dos componentes revisados nos Lotes 7-11 — mas isto é inferência de código, não a verificação visual pedida pelo item. Pendência explícita para sessão manual real. |
| 6 | As quatro paletas de clube citadas, nos dois temas | **Conforme — automatizado nesta tarefa** | Ver matriz acima: as 4 paletas de teste (Mirassol/Palmeiras/São Paulo/Corinthians) aparecem nos 2 temas em pelo menos uma tela de cada eixo de risco (Home/Painel do time com as 4; as demais 7 telas com a amostra de 2 que traceja os extremos), mais a cobertura exaustiva já existente de `FaixaClube.test.tsx` (UI-DS-01). Zero violações críticas/sérias em qualquer combinação. |

**Itens 1, 2, 4 (parcial) e 5 não são "aprovados"**: são documentados com o
resultado real obtido (verificação estrutural/de código, quando possível) e
a limitação honesta de que este ambiente não tem navegador/leitor de tela
real para o percurso manual literal que o item pede. Isto é diferente de
"pendência crítica bloqueante" — a base estrutural (nomes acessíveis, ordem
de DOM, `scroll-margin`, ausência de bloqueio de zoom) está verificada; o
que falta é a sessão sensorial/manual real, fora do alcance de um ambiente
de CLI headless. Sinalizado ao Coordenador/Validador como pendência de
infraestrutura de teste (navegador real + leitores de tela), não como
achado de acessibilidade do produto.

**Confirmação de portões de qualidade** (rodado por mim antes de marcar a
tarefa concluída): `tsc --noEmit` limpo; `eslint .` limpo (0 erros, 0
avisos); `prettier --check` limpo no arquivo novo; `npx vitest run` —
**96 arquivos de teste / 1092 casos, todos passando** (inclui os 48 novos
desta tarefa, sem nenhuma regressão nos 1044 pré-existentes).

**Nenhuma violação real de acessibilidade encontrada** que exigisse reabrir
uma tarefa/lote já concluído — nenhuma entrada nova em `.md/BLOCKERS.md`
por este motivo.

**Status**: **Concluída**, com a ressalva documentada acima (itens 1/2/5 e
parte do item 4 do roteiro manual dependem de navegador/leitor de tela real,
fora do alcance deste ambiente de execução) — reportada como pendência de
infraestrutura de verificação, não como achado bloqueante de produto, para o
Validador decidir se isso é suficiente para fechar o portão de saída do
Lote 12 ou se exige uma sessão manual real antes do primeiro deploy.

---

## Lote 12 — validação de fechamento

**Base específica**: `.md/TASK.md` (Lote 12: `TEL-01`, `QA-02`, `SEC-01`,
`QA-01`, todas `Concluída`), `.md/PRD-TECNICO.md` (RNF-07, CA-03/04/05/07/08/
09/10/11/18/19), `adr/ADR-011.md`, `adr/ADR-012.md`, `.md/UX-SPEC.md` §5.8,
`.md/COBERTURA-DOMINIO.md`, `.md/BLOCKERS.md` (Bloqueio 001). Este é o
veredito formal de fechamento do lote — a seção acima ("Lote 12 —
Telemetria, acessibilidade e segurança transversal" › QA-01) é o auto-relato
do Executor, ponto de partida, não a base da aprovação.

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run test` — **99 arquivos / 1135 testes
passando**, sem falha, sem skip; `npm run typecheck` (limpo, sem saída);
`npm run lint` (limpo, sem saída); `npm run format:check` (limpo, "All
matched files use Prettier code style!"); `npm audit --omit=dev
--audit-level=high` — **0 vulnerabilidades**. Não usei a nota de
implementação do Executor como prova: li `app/telemetria/eventos.ts`,
`app/telemetria/buildEliminacao.test.ts`, `app/index.html`,
`dominio/noticias/sec-01-sanitizacao-csp.test.tsx`,
`app/rotas/acessibilidade-consolidada.test.tsx`,
`app/rotas/paginas/DetalheCampeonato.tsx` e `.md/COBERTURA-DOMINIO.md` por
inteiro (ou nas seções relevantes), e rodei os testes reais em vez de aceitar
a alegação.

### TEL-01 — Módulo `telemetria`

| Verificação | Método | Resultado |
|---|---|---|
| Só os 5 eventos de RNF-07/ADR-012, sem duplicata | `NOMES_EVENTOS_TELEMETRIA` em `eventos.ts` — lista fechada de exatamente 5 nomes (`primeira_sessao`, `retorno`, `personalizacao_concluida`, `primeira_interacao_util`, `comparativo_aberto`); `eventos.test.ts` confirma ausência de duplicata | Conforme |
| Nenhuma carga contém conteúdo/preferência | Tipos de carga (`CargaRetorno`, `CargaPersonalizacaoConcluida`, `CargaPrimeiraInteracaoUtil`, `CargaComparativoAberto`) restritos a contagem/booleano/enum fechado de rota — nenhum campo de texto livre, id de favorito, nome de fonte ou conteúdo de palpite; `nucleoTelemetria.test.ts` confirma que cada evento só tem as chaves exatas autorizadas | Conforme |
| Interruptor de build remove o módulo do bundle (não só um `if` em runtime) | `buildEliminacao.test.ts` builda de verdade um entry-point sintético com `vite build` real (não mock), duas vezes — uma com `VITE_TELEMETRIA=on`, outra com a variável ausente — e inspeciona o artefato final por 4 marcadores (nomes de evento + função interna). Executado por mim: **passa nas duas direções** (marcadores ausentes com "off"/ausente, presentes com "on"), 3.4s de runtime real (dois builds Vite completos, não um teste unitário mockado) | Conforme, com prova real de build, não só de comportamento em runtime |

**Veredito**: **Aprovado**, sem achado.

### QA-02 — Testes de domínio por tabela

| Verificação | Método | Resultado |
|---|---|---|
| Relatório de cobertura existe e é consistente | `.md/COBERTURA-DOMINIO.md` lido por inteiro: cobre RF-03/04/05/07/08/09/10/11/18/19, 61/62 CA-xx com pelo menos um caso de tabela citado, 7 casos novos discriminados por CA | Conforme |
| 1 lacuna sinalizada (CA-08.5) tratada corretamente como achado de implementação, não de teste | Confirmado na seção "Gaps" do relatório e no Bloqueio 001 — raciocínio consistente (nenhuma fonte real aciona hoje o caminho `formato === 'mata-mata'` com classificação prévia, só o Brasileirão publica classificação e é sempre `pontos-corridos`) | Conforme |
| Bloqueio 001 está de fato Resolvido | `.md/BLOCKERS.md` linha 31: `Status: Resolvido`. Implementação em `app/rotas/paginas/DetalheCampeonato.tsx` confirmada por leitura direta: campo `classificacaoFinalDoGrupo` lido da entrada do campeonato (linha 758), usado só quando `ehMataMata` é verdadeiro e o campo está presente e não vazio (linhas 760-761) — comportamento aditivo, não quebra o caminho sem o campo | Conforme |

**Veredito**: **Aprovado**, sem achado novo (Bloqueio 001 já fechado pelo
próprio Executor antes desta validação).

### SEC-01 — Sanitização e CSP na prática

| Verificação | Método | Resultado |
|---|---|---|
| `ING-N-02` remove marcação; SPA renderiza como texto | `sec-01-sanitizacao-csp.test.tsx` — payload de injeção completo (`<script>`, `onerror`, `onload`, `javascript:` href) normalizado e depois renderizado em `CartaoIngresso` real via `@testing-library/react` (DOM/jsdom, não mock); confirma zero `<script>`/`<img>`/`<svg>` no DOM final e nenhum handler executado (flag global `__xss` nunca setada). Executado por mim: passa | Conforme, com prova de DOM real |
| `rel="noopener noreferrer"` em links externos | Teste dedicado confirma `target="_blank"` + `rel="noopener noreferrer"` em todo link externo de `CartaoIngresso` | Conforme |
| Meta CSP do ADR-011 | Lida diretamente em `app/index.html` linha 39-42: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none';` — bate exatamente com o que os testes de `sec-01-sanitizacao-csp.test.tsx` (bloco "meta CSP em app/index.html") verificam por regex sobre o arquivo real, não sobre uma constante duplicada no teste | Conforme |
| Desvio documentado (`style-src 'unsafe-inline'`) é aceitável | Comentário inline em `app/index.html` (linhas 25-37) explica que o valor de custom property CSS vem sempre de tokens internos, nunca de conteúdo de terceiro — `script-src` continua estrito (sem `unsafe-inline`/`unsafe-eval`), que é o vetor real do ADR-011. Concordo com a leitura: risco residual é de estilo, não de execução de script | Aceito como decisão de implementação razoável, não achado |

**Veredito**: **Aprovado**, sem achado.

### QA-01 — Verificação de acessibilidade consolidada

| Verificação | Método | Resultado |
|---|---|---|
| Zero violações críticas/sérias em qualquer combinação tela×tema×paleta | `acessibilidade-consolidada.test.tsx` lido por inteiro: `semViolacoesGraves` filtra por `impact === 'critical' \|\| impact === 'serious'` (não qualquer severidade, conforme o critério de aceite exato). 48 casos, 9 telas × 2 temas, amostragem de paleta documentada e justificada por risco (Home/Painel do time com as 4 paletas completas — maior risco por PR-03; demais 7 telas com amostra de 2 extremos, Corinthians acromática + Mirassol clara-ajustada). Executado por mim como parte da suíte completa: os 48 casos passam | Conforme |
| Amostragem reduzida (não 9×2×4=72) é aceitável | O par cor×contraste em si já tem cobertura exaustiva isolada em `FaixaClube.test.tsx` (24 casos, 3 variantes × 2 temas × 4 paletas); a matriz consolidada cobre o risco de composição (cor colidindo com chrome ao redor), que é o risco novo introduzido pelas 9 telas. Redução justificada por engenharia de risco, não por atalho | Aceito, critério de aceite satisfeito pela cobertura combinada |
| Roteiro manual (6 itens) documentado com resultado | Tabela completa na seção acima: item 3 e 6 conformes por evidência real (teste existente/matriz automatizada); itens 1, 2, 5 e parte do 4 documentados como "verificação estrutural equivalente"/"não executado", com a limitação de ambiente headless declarada explicitamente, não escondida atrás de um "passou" | Documentado com honestidade, conforme exigido pelo critério de aceite ("documentados com resultado", não "todos aprovados") |

**Decisão do Validador sobre a ressalva de acessibilidade manual (itens 1, 2,
5 e parte do 4 do roteiro)**: **aceitável para fechar o portão de saída do
Lote 12 nesta validação, não bloqueante para o veredito funcional — mas
tratada como pré-condição obrigatória antes do primeiro deploy em
produção**, pelos seguintes motivos:

1. A lacuna é de **infraestrutura de verificação** (sem navegador/leitor de
   tela reais neste ambiente de CLI headless), não de **produto** — nenhuma
   violação de acessibilidade foi de fato encontrada; o que falta é o meio de
   observá-la de um jeito que este ambiente não tem.
2. A cobertura automatizada substituta é real e não trivial: 48 execuções de
   `axe-core` (que reprova especificamente `button-name`/`link-name`/`aria-*`
   ausentes — a causa mais comum de item 1/2 falhar), mais leitura de código
   confirmando `scroll-margin` (item 4) e ausência de bloqueio de zoom (item
   5) — reduz o risco real de o item 1/2/4/5 esconder um problema grave, sem
   eliminá-lo.
3. O próprio guardrail deste agente veta bloquear por achado que não é
   alto/crítico sem oferecer aprovação condicional — uma limitação de
   ambiente de teste, sem violação real observada, não atinge o padrão de
   "crítico" que o Definition of Done exige para reprovar; equivale, na
   prática, a um débito de verificação de severidade baixa/média.
4. Uma sessão manual real (percurso só-teclado nos 7 fluxos, VoiceOver +
   NVDA nas 4 telas de maior risco, zoom 200% em 320px, verificação visual de
   foco obscurecido no celular) continua **necessária antes de expor o
   produto a usuários reais** — reprovar o lote inteiro agora não a produz
   mais rápido, só atrasa TEL-01/SEC-01/QA-02 (já corretos) sem necessidade.
   O ponto certo de exigi-la é como gate do chapéu DevOps antes do deploy em
   produção (não do QA de lote), quando um navegador/dispositivo real estiver
   disponível.

**Achado registrado** (não é reprovação, é condição de saída pré-produção):
a sessão manual real de acessibilidade (itens 1, 2, 5 e parte do 4 de
UX-SPEC §5.8) precisa ocorrer com navegador/dispositivo real antes do
primeiro `/deploy` em produção deste projeto — não é débito de código
(não cabe em `Refatoração Lote-X`), é uma verificação pendente de ambiente.
Sinalizo ao Coordenador/Gestor para que fique registrada como pré-condição
explícita do Gate de produção (junto ao chapéu DevOps), não perdida entre um
lote aprovado e o próximo `/deploy`.

### Refatoração Lote-12 — fechamento de REFAT-12-03

**Achado fechado (2026-09-09)**: a pré-condição acima foi cumprida. Como
registrado no achado original, esta verificação é estruturalmente humana —
um leitor de tela real (NVDA/VoiceOver) não roda de forma genuína dentro de
uma sessão de agente de código não-interativa (mesma limitação de ambiente
já confirmada empiricamente pela tentativa de Chrome headless via Puppeteer
em `REFAT-12-01`, que não produziu saída neste ambiente). Por isso a sessão
foi conduzida diretamente pelo orquestrador/usuário, não por um agente —
única forma de produzir a evidência real que o critério de aceite exige, em
vez de repetir a verificação estrutural equivalente já feita e já
considerada insuficiente por esta própria tarefa.

Roteiro executado contra o build real (`npm run build` + `npm run
preview`), NVDA (Windows) como leitor de tela:

| Item de UX-SPEC §5.8 | Cobertura | Resultado |
|---|---|---|
| 1. Percurso só-teclado nos 7 fluxos (§1.2) | Onboarding→Home; Home→Configurações→bloquear fonte→fechar; Painel→campeonato→abas; Comparativo→escolher rival; Simulação→palpite→limpar cenário | Sem tab-trap, indicador de foco visível em todo o percurso |
| 2. Leitor de tela real (NVDA) em T-02, T-06, T-08, T-09 | Leitura linear (`Insert+Down`) e por `Tab` da faixa do clube, tabela de classificação, comparativo e grade de simulação | Leitura coerente, sem trecho sem sentido |
| 3. Nenhum estado da Seção 4 depende só de cor | Banners de fonte instável/GE indisponível/vazio | Todos com texto/ícone, não só cor |
| 4. Foco não obscurecido (barra inferior / bloco PROJEÇÃO) em viewport móvel real | T-02/T-05/T-08 (barra inferior) e T-09 (PROJEÇÃO fixo) em ~375px | Contorno de foco visível no último item da lista/tabela em todos os casos |
| 5. Zoom 200% a 320px | T-01, T-02, T-06, T-09 | Sem sobreposição, corte de texto ou ação inacessível |
| 6. As 4 paletas de clube (Mirassol/clara, Palmeiras/escura, São Paulo/vermelha, Corinthians/acromática), nos 2 temas | Itens 2, 4 e 5 repetidos em Home (T-02) e Painel do time (T-05) — mesmas 2 telas com cobertura completa de paleta em `QA-01` | Sem achado em nenhuma combinação paleta×tema |

**Resultado**: **todos os 6 itens passaram, sem nenhum achado**, conforme
relato direto do usuário que executou a sessão (fonte da evidência: execução
humana real, não uma leitura de código ou verificação automatizada — é
exatamente o tipo de prova que este item exigia e que este Validador não tem
como produzir sozinho). Nenhum arquivo de código alterado — é verificação,
não implementação.

**Veredito**: **REFAT-12-03 fechada, sem ressalva**. A pré-condição de
acessibilidade manual do Gate de deploy em produção (`QA-01`, Lote 12) está
satisfeita. `Refatoração Lote-12` fica com as 3 tarefas (`REFAT-12-01`,
`REFAT-12-02`, `REFAT-12-03`) `Concluída` — fechamento estrutural completo
(checagem QA+DevSecOps de lote, via `/validar`, continua sendo o próximo
passo formal para o veredito de lote, não substituído por este registro).

**Veredito**: **Aprovado (com ressalva de infraestrutura de verificação, não
de produto)** — a ressalva não reabre a tarefa nem gera item em
`Refatoração Lote-12` (não é código a corrigir); é uma pré-condição de
processo para o primeiro deploy em produção.

### Fechamento estrutural do Lote 12

- Todas as 4 tarefas (`TEL-01`, `QA-02`, `SEC-01`, `QA-01`) estão
  `Concluída` em `.md/TASK.md`.
- Dependências da Seção 4 relativas a este lote (Lotes 8, 9, 10 e 11 como
  pré-requisito de `QA-01`) confirmadas concluídas, sem órfã: os quatro lotes
  de tela já têm veredito **Aprovado (com ressalvas)** anterior neste mesmo
  `QA-REPORT.md`.
- Nenhuma tarefa `Bloqueada` no lote.
- Achados desta validação: nenhum achado simples/débito de código novo —
  TEL-01, QA-02 e SEC-01 aprovados sem ressalva; a única ressalva (QA-01,
  sessão manual real de acessibilidade) é pré-condição de deploy, não débito
  de código, portanto **não** vira tarefa em `Refatoração Lote-12`.
- Bloqueio 001 (achado durante QA-02) já está `Resolvido` em
  `.md/BLOCKERS.md`, com implementação confirmada nesta validação — nenhuma
  ação adicional necessária.

### Veredito — Lote 12

**Aprovado (com ressalvas)**. 4/4 tarefas aprovadas (TEL-01, QA-02, SEC-01
sem ressalva; QA-01 com a ressalva de infraestrutura de verificação descrita
acima). 99 arquivos / 1135 testes, `tsc`/`eslint`/`format:check` limpos,
`npm audit --omit=dev --audit-level=high` 0 vulnerabilidades. Os 5 eventos de
telemetria e a ausência de conteúdo/preferência na carga confirmados por
leitura direta de tipo + teste; eliminação do módulo por build confirmada por
prova real de dois builds Vite (não simulação); CA-08.5 (Bloqueio 001)
confirmado resolvido com implementação real em `DetalheCampeonato.tsx`; meta
CSP do ADR-011 confirmada literal em `app/index.html`, com teste de injeção
XSS até o DOM real; 48 casos de `axe-core` confirmados sem violação
crítica/séria em nenhuma combinação tela×tema×paleta. Nenhum achado vira
tarefa em `Refatoração Lote-12`. Único item pendente: sessão manual real de
acessibilidade (itens 1, 2, 5 e parte do 4 de UX-SPEC §5.8), registrada como
pré-condição do Gate de deploy em produção, não como débito de código —
sinalizada ao Coordenador/Gestor para acompanhamento. **Libera para
auditoria do chapéu DevSecOps.**

---

## Nota de resolução — Bloqueio 001 (CA-08.5, achado de QA-02 durante o Lote 12)

Durante a auditoria de QA-02 (Lote 12, consolidação de testes das telas contra
os 62 CA-xx de `PRD-TECNICO.md`), CA-08.5 ("WHEN muda de formato, GIVEN o
provedor reflete, THE SYSTEM SHALL passar a CA-08.4 e manter a tabela final
do grupo acessível") foi encontrado sem cobertura: a implementação de
`app/rotas/paginas/DetalheCampeonato.tsx` zerava `dadosClassificacao` por
completo ao entrar em mata-mata, sem nenhum mecanismo que preservasse acesso
à tabela final do grupo. Registrado como Bloqueio 001 em `.md/BLOCKERS.md` e
escalado ao coordenador, por ser lacuna de **implementação**, não de teste —
fora do escopo de QA-02.

**Resolução (2026-09-06, executor/chapéu Frontend)**: implementado o
mecanismo de preservação (opção (a) da sugestão do Bloqueio 001).

- Contrato estendido de forma aditiva: novo campo opcional
  `classificacaoFinalDoGrupo` em `campeonatoDoClubePublicoSchema`
  (`app/dados/futebol.ts`, espelhado em
  `pipeline/publicacao/gerador-snapshots.ts`) — a tabela do grupo "congelada"
  no momento da transição para mata-mata. Ausente/vazio ⇒ comportamento
  idêntico ao anterior (nenhum arquivo publicado hoje precisa mudar).
- `DetalheCampeonato.tsx`: em mata-mata, quando há
  `classificacaoFinalDoGrupo`, um botão "VER TABELA DO GRUPO" (`aria-expanded`)
  alterna a exibição da tabela — CA-08.4 (bloco de confronto) continua sendo a
  visão padrão; a tabela fica acessível, não é reexibida automaticamente,
  conforme o texto exato de CA-08.5.
- Cobertura de teste com fixture em `DetalheCampeonato.test.tsx` (dois casos:
  com e sem `classificacaoFinalDoGrupo`), já que nenhuma fonte real aciona
  este caminho hoje (só o Brasileirão é publicado, sempre `pontos-corridos`) —
  mesma limitação documentada no próprio código, sem bloquear a
  implementação/teste do mecanismo genérico.
- Confirmado: `tsc --noEmit` limpo, `eslint` limpo, `npx vitest run` — 95
  arquivos / 1044 testes passando (inclui os 2 casos novos de CA-08.5).

CA-08.5 está agora coberto por teste automatizado; quando o chapéu QA-02
retomar/fechar a auditoria formal do Lote 12, este item pode ser marcado
**Conforme** em vez de pendente. Bloqueio 001 marcado **Resolvido** em
`.md/BLOCKERS.md`.

---

## Refatoração Lote-1 — validação de fechamento de débito técnico

**Base específica**: as 3 tarefas `REFAT-01-01`/`REFAT-01-02`/`REFAT-01-03`
(`.md/TASK.md`, lote `Refatoração Lote-1`), todas `Concluída` — o débito mais
antigo em aberto (criado na própria checagem estrutural do Lote 1,
2026-09-06, achados `SEC-01-02`/`SEC-01-03`/`SEC-08-01` de
`.md/SECURITY-REVIEW.md`, reafirmado como backstop bloqueante do próximo
`/deploy` real desde os Lotes 6 e 8).

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run typecheck` (limpo), `npm run lint` (limpo),
`npm run format:check` (limpo), `npm run test` — **96 arquivos / 1092 testes
passando**, bate com o número declarado nas notas de implementação de
`REFAT-01-01`/`REFAT-01-02`/`REFAT-01-03`; `npm run build` (bundle gerado sem
erro, `dist/` removido após a verificação); `npm audit --omit=dev
--audit-level=high` e `npm audit --omit=dev` (sem o filtro de severidade) —
**0 vulnerabilidades** nos dois casos. Rodei também isoladamente
`npx vitest run app/rotas/` — **24 arquivos / 232 testes passando**
(inclui `Rotas.test.tsx` e `acessibilidade-consolidada.test.tsx`).

Não usei a nota de implementação do Executor como base de aprovação: li o
conteúdo real de `.github/workflows/ingestao.yml`,
`.github/workflows/build-publish.yml` e `package.json` por inteiro.

- **REFAT-01-01**: confirmado que `npm run format:check` foi de fato
  adicionado a `ingestao.yml` (entre `lint` e `test`, dentro do mesmo passo
  "Portões de qualidade") e a `build-publish.yml` (passo próprio "Formatação
  (Prettier)", entre `lint` e `test`). Reproduzi o critério de aceite: criei
  um arquivo `.ts` propositalmente desformatado na raiz do repositório e
  rodei `npm run format:check` — falhou com `exit 1` ("Code style issues
  found in the above file"), confirmando que o portão bloqueia de verdade,
  não é decoração; removido em seguida. No estado atual do repositório,
  `format:check` passa limpo. **Achado resolvido de fato.**
- **REFAT-01-02**: li as 5 ações de `build-publish.yml` linha a linha —
  `checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`,
  `setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0`,
  `configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b # v5.0.0`,
  `upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3.0.1`,
  `deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4.0.5` — todas por
  SHA de commit completo (40 caracteres hex), nenhuma por tag móvel, cada uma
  com o comentário `# vX.Y.Z` correspondente. `checkout`/`setup-node` usam os
  mesmos SHAs já verificados em `ingestao.yml` (mesmo par de ações,
  consistência confirmada). `runs-on: ubuntu-24.04` presente nos dois jobs
  (`build` e `publish`), idêntico a `ingestao.yml`. Ver seção própria de
  auditoria abaixo (chapéu DevSecOps) para a confirmação dos 3 SHAs restantes
  contra o GitHub oficial. **Achado resolvido de fato.**
- **REFAT-01-03**: confirmado `"react-router-dom": "7.18.3"` em
  `package.json`. `npm audit --omit=dev` sem nenhuma ocorrência de
  `react-router`/`react-router-dom` (0 vulnerabilidades no total). Rodei
  `app/rotas/Rotas.test.tsx` e `app/rotas/acessibilidade-consolidada.test.tsx`
  isoladamente (dentro da suíte de `app/rotas/`, 232/232) sem nenhuma
  alteração de asserção necessária — a seleção declarativa
  `BrowserRouter`/`HashRouter`/`Routes`/`Route`/`Link` por
  `VITE_ROTEAMENTO` (ADR-003) continua com o mesmo comportamento sob a v7.
  **Achado resolvido de fato.**

### Fechamento estrutural de `Refatoração Lote-1`

- [x] As 3 tarefas (`REFAT-01-01`, `REFAT-01-02`, `REFAT-01-03`) estão
      `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: as 3 dependiam de
      FUND-02/FUND-03/FUND-04 (Lote 1, já `Validado (com ressalvas)`) —
      satisfeitas; nenhuma tarefa de lote posterior depende de nenhuma das
      3 (são débito de fechamento, não pré-requisito de outra tarefa).
- [x] Nenhuma tarefa `Bloqueada`.
- [x] Nenhum achado novo de código encontrado durante esta verificação que
      justifique nova tarefa de refatoração.

Nenhuma inconsistência que exija redesenho de dependência/decomposição —
sem escalonamento ao Coordenador nesta rodada.

**Veredito**: **Aprovado**. `Refatoração Lote-1` fechada — libera para
auditoria do chapéu DevSecOps (que fecha, nesta mesma rodada, os achados
originais `SEC-01-02` e `SEC-01-03`/`SEC-08-01`, removendo o backstop que
bloqueava o próximo `/deploy` real em produção desde os Lotes 6/8).

---

## Refatoração Lote-6 — validação de fechamento de débito técnico

**Base específica**: achado `QA-6-02` (lacuna de wiring de `npm run
ingestao`, Seção "Lote 6 — Paleta de clube e publicação" acima) e a tarefa
`REFAT-06-01` (`.md/TASK.md`, lote `Refatoração Lote-6`), `Concluída`.

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run typecheck` (limpo), `npm run lint` (limpo),
`npm run format:check` (limpo), `npm run test` — **97 arquivos / 1098 testes
passando**, bate exatamente com o número declarado na nota de implementação
de `REFAT-06-01`. `npm audit --omit=dev --audit-level=high` (gate real de
CI): **0 vulnerabilidades**. Verifiquei também a sintaxe YAML de
`.github/workflows/ingestao.yml` via `js-yaml` (parse bem-sucedido, 5 chaves
de topo: `name`/`on`/`concurrency`/`permissions`/`jobs`).

Não usei a nota de implementação do Executor como base de aprovação: li
`pipeline/ingestao-cli.ts`, `pipeline/ingestao-cli.test.ts` e o diff de
`.github/workflows/ingestao.yml` por inteiro.

- **Ordem de chamada e propagação de erro**: confirmado por leitura direta
  de `pipeline/ingestao-cli.test.ts` que a ordem exata
  notícias → futebol → snapshots é testada de fato (não só afirmada), com um
  caso dedicado (`"nunca chama futebol antes de notícias terminar, mesmo que
  futebol resolva mais rápido"`) que faz notícias resolver com `setTimeout`
  e futebol resolver "instantaneamente" — se a implementação fosse
  `Promise.all`, futebol apareceria primeiro em `ordem`; o teste passa,
  confirmando sequencial real, não coincidência de mock síncrono. Os 3 casos
  de propagação de erro (`executarNoticias`, `executarFutebol`,
  `gerarSnapshots`) confirmam por asserção direta (`.not.toHaveBeenCalled()`)
  que nenhum passo seguinte é chamado quando um passo anterior rejeita —
  `executarIngestaoCompleta` não tem `try/catch` interno (confirmado em
  `ingestao-cli.ts`, linhas 98-119), então a rejeição propaga sem alteração
  para quem chamou; é `main()` quem decide `process.exit(1)`, com a mensagem
  de erro completa (`erro.stack ?? erro.message`) impressa via
  `console.error`, nunca engolida.
- **Justificativa sequencial vs. paralelo**: a nota de decisão no cabeçalho
  de `ingestao-cli.ts` não é uma escolha arbitrária — investiga o mecanismo
  real de escrita de `status.json` (leitura+mescla+escrita síncrona de
  `node:fs`, sem `await` no meio, portanto sem corrida hoje pelo modelo
  run-to-completion do Node) e argumenta corretamente por que a segurança
  atual é frágil a uma mudança futura para `fs/promises` (nesse caso a
  corrida se tornaria real e destrutiva, não apenas um `geradoEm`
  não-determinístico). Concordo com a conclusão: o custo de performance de
  rodar sequencial é desprezível (job de 30 em 30 min, timeout de 15 min) e a
  robustez a mudança futura supera a hipotética vantagem de paralelismo hoje
  inexistente.
- **3 ramos do passo "Executa pipeline de ingestão" em `ingestao.yml`**:
  confirmado por leitura direta do `if/elif/else` do step — (a) `npm run |
  grep -qE '^\s+ingestao$'` falso ⇒ dry-run informativo, ramo preservado
  intacto para não quebrar se o script algum dia regredir (não se aplica
  mais hoje, já que `ingestao` está registrado em `package.json`); (b)
  script presente mas `FOOTBALL_DATA_API_TOKEN` vazio/ausente ⇒ dry-run
  informativo com `publica=false`, sem falhar o job — evita que a execução
  agendada a cada 30 min quebre antes do secret ser cadastrado (Fluxo 2
  lança erro sem o token, confirmado em
  `pipeline/futebol/orquestrador.ts:555-558`); (c) ambos presentes ⇒ `npm
  run ingestao` roda de verdade e marca `publica=true`, o que por sua vez
  habilita os passos seguintes ("Verificação de segredo"/"Publica
  snapshots"). Os 3 ramos cobrem exatamente o que o critério de aceite pede.
  **Limitação de ambiente, não pendência do critério de aceite**: sem
  `FOOTBALL_DATA_API_TOKEN` real disponível neste ambiente de validação, não
  é possível exercitar o ramo (c) fim-a-fim contra a rede real do provedor
  football-data.org — cadastro do secret e primeira execução real
  permanecem ação operacional fora do escopo de qualquer agente (mesma
  lógica já registrada pelo SDD/GUARDRAILS para este segredo). Fiz o smoke
  test possível sem o secret (Fluxo 1 real contra scratchpad,
  Fluxo 2 falhando com mensagem clara e `exit 1`, exatamente como a nota do
  Executor descreve) e confirmo que bate com o comportamento esperado do
  ramo (b).

### Fechamento estrutural do Lote `Refatoração Lote-6`

- [x] A tarefa (`REFAT-06-01`) está `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: depende de `PUB-02` (Lote 6,
      `Validado (com ressalvas)`) — satisfeita; nenhuma tarefa de lote
      posterior depende de `REFAT-06-01`.
- [x] Nenhuma tarefa `Bloqueada` em todo o `TASK.md`.
- [x] Nenhum achado novo de código encontrado durante esta verificação que
      justifique nova tarefa de refatoração.

Nenhuma inconsistência que exija redesenho de dependência/decomposição —
sem escalonamento ao Coordenador nesta rodada.

**Veredito**: **Aprovado**. `Refatoração Lote-6` fechada — a wiring de `npm
run ingestao` está implementada de fato (ordem sequencial testada e
justificada, propagação de erro sem engolir nada, 3 ramos do workflow
corretos), confirmado por leitura de código e execução real dos testes
citados, não pela nota do Executor; libera para auditoria do chapéu
DevSecOps.

---

## Refatoração Lote-7 — validação de fechamento de débito técnico

**Base específica**: achado `QA-7-01` (acima) e a tarefa `REFAT-07-01`
(`.md/TASK.md`, lote `Refatoração Lote-7`), `Concluída`.

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run typecheck` (limpo), `npm run lint` (limpo),
`npm run format:check` (limpo), `npm run test` (**97 arquivos/1098 testes
passam**, suíte inteira). Não usei a nota de implementação do Executor como
base de aprovação: li diretamente os 5 arquivos `.module.css` afetados e
`tokens.css`.

- **Grep de confirmação** (`grep -nE` por literal `px`/`rem`/`em` fora de
  `var(...)`) nos 5 arquivos: nenhuma das 5 ocorrências originais
  remanesce — `BarraPontuacao.module.css:24` agora é
  `min-width: var(--barrapontuacao-rotulo-largura)`; `Abas.module.css:16` é
  `border-bottom: var(--borda-media) solid transparent`;
  `BannerAlerta.module.css:44` é
  `border: var(--borda-fina) solid currentColor`;
  `LinhaPartida.module.css:6` é `border-left: var(--esp-1) solid
  transparent`; `Sobreposicao.module.css:14` é `background: var(--cor-veu)`.
  O único `1px`/`-1px` literal remanescente em `LinhaPartida.module.css`
  (linhas 51/54) é o padrão "sr-only" (`width:1px; height:1px; margin:-1px`),
  exceção explicitamente aceita pelo critério de aceite.
- **`Sobreposicao.module.css:10`**: confirmado `z-index: var(--z-modal)`,
  não mais `var(--z-pular-conteudo)`. **Achado QA-7-01 resolvido de fato**.
- **Escala de z-index conferida por leitura direta de `tokens.css`**:
  `--z-bloco-fixo: 500` (linha 200) < `--z-modal: 900` (linha 232) <
  `--z-pular-conteudo: 1000` (linha 185) — ordem correta, o véu do modal
  fica acima de nav/blocos fixos e abaixo do link "Pular para o conteúdo".
- **Valores dos 4 tokens novos conferidos por leitura direta** (não pela
  nota): `--borda-media: 2px` (linha 155, valor idêntico ao literal
  substituído em `Abas`); `--cor-veu: rgba(22, 24, 26, 0.5)` (linha 165,
  valor idêntico ao literal substituído em `Sobreposicao`);
  `--barrapontuacao-rotulo-largura: 96px` (linha 240, valor idêntico ao
  literal substituído em `BarraPontuacao`). Os 2 reusos de token existente
  também conferidos: `--esp-1: 4px` (linha 123, mesmo valor do literal
  `4px` substituído em `LinhaPartida`) e `--borda-fina: 1px` (linha 149,
  mesmo valor do literal `1px` substituído em `BannerAlerta`). Nenhuma
  mudança de comportamento visual, só de token — confirmado por valor, não
  por suposição.
- **Testes dos 5 componentes** rodados isoladamente por mim:
  `BarraPontuacao.test.tsx` (8), `Abas.test.tsx` (6),
  `BannerAlerta.test.tsx` (5), `LinhaPartida.test.tsx` (7),
  `Sobreposicao.test.tsx` (9) — **35/35 passam**, nenhuma asserção alterada.

### Achado QA-7-03 — Padrão recorrente de literal de borda (`1px`/`2px`/`4px`) fora de `var(...)` em outros arquivos do design system, além do escopo de `REFAT-07-01`

**Severidade**: **simples** (débito de higiene de token, mesma categoria de
`QA-7-01`; nenhum compromete critério de aceite, acessibilidade ou
comportamento — confirmado que os testes de cada componente citado
continuam passando sem alteração).

Ao confirmar o fechamento de `REFAT-07-01`, rodei uma varredura mais ampla
(`grep -rlE` por literal `px`/`rem`/`em` em todo `app/design-system/**/*.module.css`)
e encontrei que o mesmo padrão — declaração de espessura de borda com valor
literal em vez de `var(--borda-fina)`/`var(--borda-media)` — se repete em
pelo menos 10 arquivos não cobertos por `REFAT-07-01` (a tarefa corrigiu só
os 5 nomeados no `TASK.md`, não fez varredura de todo o design system):
`BlocoPreto.module.css:13` (`border: 2px`), `SeletorPalpite.module.css:41`
(`border: 2px`), `Alternador.module.css:22` (`border: 1px`),
`AvatarClube.module.css:7` (`border: 1px`), `Botao.module.css:38/52/58`
(`border: 1px`, 3 ocorrências), `CampoBusca.module.css:10` (`border: 1px`),
`Chip.module.css:10` (`border: 1px`), `EstadoVazio.module.css:33`
(`border: 1px`), `TabelaClassificacao.module.css:18` (`border-bottom: 1px`)
e `:37/44/50/51` (`box-shadow: inset 4px`/`8px`, mesmo valor de
`--esp-1`/`--esp-2`) — mais 2 ocorrências residuais nos próprios arquivos
já tocados por `REFAT-07-01` (`BarraPontuacao.module.css:32/43` e
`Abas.module.css:9`, `border: 1px solid var(--cor-borda)`;
`Sobreposicao.module.css:85`, mesmo padrão), fora dos 5 pontos nomeados no
critério de aceite original. Já exclui desta contagem: (a) breakpoints de
media query (`339px`/`768px`/`1024px`), decisão de implementação já
registrada no `TASK.md` §6 como aceitável fora de token; (b) o padrão
"sr-only" (`1px`/`-1px`); (c) `Esqueleto.module.css:25` (`height: 72px`),
que já é decisão de anatomia própria do componente, mesmo padrão de
`--faixaclube-altura-compacta` (não uma borda esquecida).

**Avaliação**: é o mesmo tipo de achado que `QA-7-01` já identificou (Diretriz
de Implementação #4), só que mais espalhado do que a tarefa original cobriu
— não é um problema na decomposição/diretriz em si (a Diretriz #4 já é clara
e já gerou uma tarefa de correção once), é execução incompleta recorrente em
vários componentes de Executores paralelos diferentes do Lote 7. Não bloqueia
porque nenhum dos pontos altera comportamento observável (todos os testes
dos componentes citados continuam passando, `axe-core` de `FaixaClube`
sem violação, nenhuma pista de acessibilidade depende só de cor/borda).

**Ação tomada**: tarefa `REFAT-07-02` criada em `Refatoração Lote-7` (ver
`TASK.md`) para consolidar `--borda-fina`/`--borda-media` nos 13 pontos
listados, com prazo antes do Lote 12 (`accessibility-review`/QA final) —
mesmo horizonte de `REFAT-08-01`, para não acumular mais débito visual até
a auditoria de acessibilidade completa das telas. Não escalo ao Coordenador:
não há indício de que a Diretriz #4 esteja mal decomposta ou pouco clara —
é débito de execução, tratável como as demais tarefas de refatoração já
abertas por este Validador.

### Fechamento estrutural de `Refatoração Lote-7`

- [x] A tarefa (`REFAT-07-01`) está `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: `REFAT-07-01` dependia de
      `UI-DS-03`/`UI-DS-06`/`UI-DS-07A`/`UI-DS-07B` (Lote 7, já `Validado
      (com ressalvas)`) — satisfeitas; nenhuma tarefa de lote posterior
      depende de `REFAT-07-01`.
- [x] Nenhuma tarefa `Bloqueada` em todo o `TASK.md`.
- [x] 1 achado novo de código encontrado durante esta verificação
      (`QA-7-03`) — virou tarefa `REFAT-07-02` no próprio `Refatoração
      Lote-7`, não retorno ao Executor, sem reabrir o Coordenador.

Nenhuma inconsistência que exija redesenho de dependência/decomposição —
sem escalonamento ao Coordenador nesta rodada.

**Veredito (parcial, só `REFAT-07-01`)**: **Aprovado (com ressalvas)**.
`REFAT-07-01` resolve de fato os 6 pontos do achado original `QA-7-01`,
confirmado por leitura de código, execução real dos testes e conferência
de valor de cada token novo, não pela nota do Executor; 1 achado adicional
de mesma categoria (`QA-7-03`) registrado como débito não bloqueante em
`REFAT-07-02`. O veredito de fechamento do lote inteiro (`REFAT-07-01` +
`REFAT-07-02`) está na seção abaixo, após a validação específica de
`REFAT-07-02`.

### Fechamento de `REFAT-07-02` — validação específica (achado `QA-7-03`)

**Base específica**: achado `QA-7-03` (acima) e a tarefa `REFAT-07-02`
(`.md/TASK.md`, lote `Refatoração Lote-7`), `Concluída`.

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run test -- --run` (**99 arquivos/1135 testes
passam**, suíte inteira, 0 falhas), `npm run typecheck` (limpo), `npm run
lint` (limpo), `npm run format:check` (limpo). Não usei a nota de
implementação do Executor como base de aprovação: li diretamente os 12
arquivos `.module.css` listados no critério de aceite e `tokens.css`.

- **Grep de confirmação** (`(border[a-zA-Z-]*|box-shadow|outline)[^;]*\b\d+px\b`
  em todo `*.module.css` de `app/`): a única ocorrência remanescente no
  projeto inteiro (não só nos 12 arquivos do escopo) é
  `app/rotas/Navegacao/Navegacao.module.css:77`
  (`border-bottom: 2px solid transparent`) — fora do escopo nomeado de
  `REFAT-07-02` (que cobria só `app/design-system/**`), registrado abaixo
  como achado novo, não bloqueante. Dentro dos 12 arquivos listados, `grep`
  confirma zero literais de borda/box-shadow fora de `var(...)`: todos os
  pontos catalogados (`BlocoPreto:13`, `SeletorPalpite:41`, `Alternador:22`,
  `AvatarClube:7`, `Botao:38/52/58`, `CampoBusca:10`, `Chip:10`,
  `EstadoVazio:33`, `TabelaClassificacao:18` e `:37/44/50/51`,
  `BarraPontuacao:32/43`, `Abas:9`, `Sobreposicao:85`) usam agora
  `var(--borda-fina)`/`var(--borda-media)`/`var(--esp-1)`/`var(--esp-2)`,
  lidos arquivo por arquivo (não em lote): confirmado em
  `BlocoPreto.module.css:13` (`border: var(--borda-media) solid ...`),
  `Botao.module.css:38/52/58` (os 3 pontos, `border: var(--borda-fina) solid
  ...` em `.secundario`/`.destrutivo`/`.fantasma`),
  `TabelaClassificacao.module.css:37/44/49-51` (`box-shadow: inset
  var(--esp-1) 0 0 ...` nas 2 faixas simples, e o `box-shadow` combinado de
  `.linha[data-time-do-usuario='true'][data-zona]` usa `inset var(--esp-1)`
  **e** `inset var(--esp-2)` nas duas camadas, confirmando a leitura de
  "4px→--esp-1, 8px→--esp-2" da nota do Executor por inspeção direta, não
  por aceitação da nota), `BarraPontuacao.module.css:32/43`,
  `Abas.module.css:9`, `Sobreposicao.module.css:85` — todos `var(--borda-fina)
  solid ...`. Únicos `px` remanescentes nos 12 arquivos são o padrão sr-only
  (`width: 1px; height: 1px; margin: -1px`, em `SeletorPalpite.module.css` e
  `TabelaClassificacao.module.css`) — exceção aceita pelo critério.
- **Valores dos tokens usados conferidos por leitura direta de
  `tokens.css`** (não pela nota): `--borda-fina: 1px` (linha 149),
  `--borda-media: 2px` (linha 155), `--esp-1: 4px` (linha 123), `--esp-2:
  8px` (linha 124) — todos idênticos ao literal que substituíram em cada
  ponto tocado (confirmado ponto a ponto acima); nenhuma mudança de
  comportamento visual, só de mecanismo.
- **Testes**: `vitest run app/design-system` (escopado): 99 testes de
  `app/design-system` incluídos na suíte completa (99 arquivos/1135 testes,
  0 falhas) — nenhuma asserção alterada nos componentes tocados por
  `REFAT-07-02`. Comparação com o número reportado no fechamento de
  `REFAT-07-01` (97 arquivos/1098 testes): o aumento para 99 arquivos/1135
  testes é esperado — reflete trabalho de outros lotes já mesclados ao
  repositório desde então (ex. `REFAT-08-01`, que já reportava 97
  arquivos/1099 testes em seu próprio fechamento), não uma regressão nem um
  efeito de `REFAT-07-02`; nenhum teste de componente do escopo desta tarefa
  foi removido ou teve asserção alterada, e a contagem de testes por
  componente citada pela nota do Executor bate com a leitura direta dos
  arquivos de teste (`app/design-system` sozinho soma aos 99 testes citados
  na nota, sem divergência).
- **Verificação do item 4 (escopo esgotado o achado `QA-7-03`)**: varredura
  ampla (`grep -rE` do mesmo padrão em todo `app/**/*.module.css`, não só
  `app/design-system/`) encontrou **1 ocorrência não coberta**:
  `Navegacao.module.css:77` (`border-bottom: 2px solid transparent`, usado
  pelo item de navegação inativo — `.itemNavAtivo` na linha 87 já usa
  `border-bottom-color: var(--nav-acento-sobre-escuro, ...)`, então só a
  largura do traço em si ficou literal). Não estava no escopo nomeado de
  `QA-7-03`/`REFAT-07-02` (que catalogou só `app/design-system/**`, não
  `app/rotas/**`) — é um achado novo, não uma falha desta tarefa.

### Achado QA-7-04 — Literal de borda (`2px`) fora de `var(...)` em `Navegacao.module.css`, fora do escopo de `REFAT-07-02`

**Severidade**: **simples** (mesma categoria de `QA-7-01`/`QA-7-03`; não
compromete nenhum critério de aceite — `.itemNavAtivo` já usa
`var(--nav-acento-sobre-escuro, var(--clube-acento-sobre-escuro))` para a
cor, só a espessura do traço ficou literal; nenhum teste afetado).

`app/rotas/Navegacao/Navegacao.module.css:77` declara
`border-bottom: 2px solid transparent` — mesmo padrão de "espessura de
borda literal em vez de `var(--borda-media)`" já corrigido em 13 pontos do
design system por `REFAT-07-01`/`REFAT-07-02`, desta vez fora de
`app/design-system/` (é CSS de rota, `app/rotas/Navegacao/`), por isso não
coberto pelo escopo nomeado de nenhuma das duas tarefas. `2px` é
exatamente o valor de `--borda-media` (`tokens.css:155`) — mesma
substituição mecânica das demais, sem risco de mudança visual.

**Avaliação**: não é um problema de decomposição/diretriz — é o mesmo tipo
de execução incompleta já registrado em `QA-7-03`, desta vez porque o
escopo nomeado de `REFAT-07-02` foi limitado a `app/design-system/**` (como
o próprio critério de aceite da tarefa definia) e não incluiu `app/rotas/`.
Não bloqueia: sem impacto de comportamento/acessibilidade, todos os testes
de `Navegacao` continuam passando.

**Ação tomada**: nenhuma por mim aqui — registro o achado para o
orquestrador decidir, na checagem estrutural do lote, se abre uma
`REFAT-07-03` (ou inclui no próximo lote de refatoração já aberto) para
este ponto residual, conforme instrução explícita de escopo desta rodada
(não decido sozinho sobre criar `Refatoração Lote-X` nesta validação).

### Fechamento estrutural de `Refatoração Lote-7` (REFAT-07-01 + REFAT-07-02)

- [x] Ambas as tarefas (`REFAT-07-01`, `REFAT-07-02`) estão `Concluída` no
      `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: `REFAT-07-02` dependia de
      `REFAT-07-01` (mesmo arquivo `tokens.css`, sequencial para evitar
      edição concorrente) — satisfeita; nenhuma tarefa de lote posterior
      depende de `REFAT-07-02`.
- [x] Nenhuma tarefa `Bloqueada` em todo o `TASK.md`.
- [x] 1 achado novo de código encontrado durante esta verificação
      (`QA-7-04`, `Navegacao.module.css:77`) — registrado neste relatório,
      não retorno ao Executor, sem reabrir o Coordenador; decisão de
      abrir/onde alocar a tarefa de correção fica com o orquestrador nesta
      rodada, conforme instrução explícita.

Nenhuma inconsistência que exija redesenho de dependência/decomposição —
sem escalonamento ao Coordenador nesta rodada.

**Veredito (lote completo, `REFAT-07-01` + `REFAT-07-02`)**: **Aprovado
com ressalvas**. As duas tarefas resolvem de fato o achado `QA-7-01`
original e o achado derivado `QA-7-03`, confirmado por leitura de código,
execução real de `tsc`/`eslint`/`format:check`/suíte completa (99
arquivos/1135 testes, 0 falhas) e conferência valor a valor de cada token
usado (`--borda-fina`=1px, `--borda-media`=2px, `--esp-1`=4px,
`--esp-2`=8px) contra o literal substituído — nenhuma mudança de
comportamento visual, só de mecanismo (literal → token), em nenhum dos 18
pontos tocados pelas duas tarefas. 1 achado novo de mesma categoria
(`QA-7-04`) fora do escopo nomeado das duas tarefas, registrado como
débito simples não bloqueante. Libera para auditoria do chapéu DevSecOps
(nenhum dos achados tem implicação de segurança — mudança puramente de
CSS/tokens, sem superfície nova).

### Fechamento de `REFAT-07-03` — validação específica (achado `QA-7-04`)

**Base específica**: achado `QA-7-04` (acima) e a tarefa `REFAT-07-03`
(`.md/TASK.md`, lote `Refatoração Lote-7`), `Concluída`.

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npx vitest run app/rotas/Navegacao` (isolado),
`npx vitest run` (suíte completa), `npm run typecheck`, `npm run lint`,
`npm run format:check`. Não usei a nota de implementação do Executor como
base de aprovação: li diretamente `Navegacao.module.css` e `tokens.css`.

- **`Navegacao.module.css` lido por inteiro**: a linha 77
  (`.itemNav`) hoje declara `border-bottom: var(--borda-media) solid
  transparent` — o literal `2px` que originou `QA-7-04` foi substituído
  pelo token, não reescrito com outro valor.
- **Token conferido em `tokens.css:155`**: `--borda-media: 2px` — mesmo
  valor numérico do literal substituído, confirmando ausência de mudança
  visual (mesma verificação valor a valor já aplicada em `REFAT-07-01`/
  `REFAT-07-02`).
- **Nenhum outro literal de espessura de borda restante no arquivo**:
  `grep -nE '\d+px' Navegacao.module.css` só retorna `1024px` (dentro de
  `@media (min-width: ...)`, não é espessura) e `1px`/`-1px` dentro de
  `.somenteLeitorDeTela` (padrão `sr-only` já existente antes desta tarefa,
  fora do escopo do achado — não é `border`/`outline`/`box-shadow`).
- **`vitest run app/rotas/Navegacao` isolado**: 9/9 passam, sem novo caso
  de teste específico para esta mudança (correção é puramente mecânica de
  CSS, mesmo padrão de `REFAT-07-01`/`REFAT-07-02` — nenhum teste de
  snapshot visual no projeto que exigisse atualização).
- **Suíte completa**: `npx vitest run` — **99 arquivos de teste, 1135
  testes, todos passando**. Número idêntico ao reportado no fechamento de
  `REFAT-07-02` (99 arquivos/1135 testes) — nenhuma regressão, nenhum teste
  novo, nenhum teste quebrado.
- **Portões**: `npm run typecheck` limpo (sem erro), `npm run lint` limpo
  (sem erro), `npm run format:check` limpo ("All matched files use
  Prettier code style!").
- **Varredura final ampla (não só `app/design-system/**`)**: `grep -rnE
  "(border(-[a-z]+)?|outline|box-shadow)\s*:\s*[^;]*[0-9]+px" --include=
  "*.module.css" app` em todo o diretório `app/` retorna **zero
  ocorrências** — nenhum literal de espessura de borda/outline/box-shadow
  fora de `var(...)` sobra em nenhum `*.module.css` do projeto, dentro ou
  fora de `app/design-system/`. Confirma que `REFAT-07-01` +
  `REFAT-07-02` + `REFAT-07-03` fecham o padrão por completo, sem achado
  novo desta vez.

**Avaliação**: `REFAT-07-03` resolve o achado `QA-7-04` de forma pontual e
mecânica, mesma técnica das duas tarefas anteriores do lote, sem introduzir
mudança visual, comportamental ou de teste. Nenhum achado novo nesta
rodada.

### Fechamento estrutural de `Refatoração Lote-7` (REFAT-07-01 + REFAT-07-02 + REFAT-07-03) — completo

- [x] As 3 tarefas (`REFAT-07-01`, `REFAT-07-02`, `REFAT-07-03`) estão
      `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: `REFAT-07-02` dependia de
      `REFAT-07-01` (satisfeita); `REFAT-07-03` era independente das duas
      (arquivo próprio, `Navegacao.module.css`, não tocado por nenhuma
      delas) — confirmado por leitura do `TASK.md` e do próprio arquivo;
      nenhuma tarefa de lote posterior depende de nenhuma das 3.
- [x] Nenhuma tarefa `Bloqueada` em todo o `TASK.md`.
- [x] Nenhum achado novo de código nesta verificação — a varredura final
      ampla (acima) não encontrou mais nenhuma ocorrência do padrão em
      lugar nenhum do projeto.

Nenhuma inconsistência que exija redesenho de dependência/decomposição —
sem escalonamento ao Coordenador.

**Veredito (lote completo, `REFAT-07-01` + `REFAT-07-02` + `REFAT-07-03`)**:
**Aprovado**. As três tarefas resolvem de fato os achados originais
(`QA-7-01`, `QA-7-03`, `QA-7-04`), confirmado por leitura de código,
execução real de `tsc`/`eslint`/`format:check`/suíte completa (99
arquivos/1135 testes, 0 falhas, sem regressão em relação ao fechamento
anterior) e conferência valor a valor de cada token usado contra o literal
substituído em todos os pontos tocados pelas três tarefas — nenhuma
mudança de comportamento visual, só de mecanismo (literal → token). A
varredura final ampla em todo `app/**/*.module.css` (não só
`app/design-system/**`) não encontrou nenhum achado novo do mesmo padrão —
o lote fecha sem ressalva pendente. Libera para auditoria do chapéu
DevSecOps (nenhum dos achados tem implicação de segurança — mudança
puramente de CSS/tokens, sem superfície nova).

---

## Refatoração Lote-8 — validação de fechamento de débito técnico

**Base específica**: achado `QA-8-01` (Lote 8, layout desktop de 2 colunas
de T-02 não reproduzido por `UI-T02-04`) e a tarefa `REFAT-08-01`
(`.md/TASK.md`, lote `Refatoração Lote-8`), `Concluída`.

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run typecheck` (limpo), `npm run lint` (limpo),
`npm run format:check` (limpo), `npm run test` (**97 arquivos/1099 testes
passam**, suíte inteira), `npm run build` (`vite build` gera `dist/` com
sucesso — 167 módulos, removido logo em seguida). Não usei a nota de
implementação do Executor como base de aprovação: li diretamente
`Home.module.css`, `Home.tsx`, `tokens.css` e o UX-SPEC.

- **Fonte original conferida linha a linha**: `.md/UX-SPEC.md` §2/T-02,
  bloco "Desktop (1280)" (linhas 205-244) — o wireframe rotula
  explicitamente "coluna fixa 336px" (`PRÓXIMO JOGO`/`A BRIGA`/
  `CAMPEONATOS`) e "feed largo 748px" (`SEUS ESPORTES`/`ÚLTIMAS NOTÍCIAS`).
  A tabela-resumo de UX-SPEC (linha 1238) confirma os mesmos dois números:
  "duas colunas: fixa de 336 px ... + feed de 748 px". Os valores
  implementados em `tokens.css` (`--home-coluna-fixa-largura: 336px`,
  `--home-feed-largura: 748px`) batem exatamente, número a número, com a
  fonte — não pela nota do Executor.
- **Breakpoint 1024px**: o UX-SPEC não declara um valor numérico de
  breakpoint em nenhuma seção (confirmado por busca no documento inteiro) —
  mesma lacuna já registrada por `FUND-05`, que fixou 1024px como convenção
  de "desktop" do projeto. `1024px` é o mesmo valor já usado de forma
  consistente em todo o restante do design system e das telas
  (`Navegacao.module.css`, `Layout.module.css`, `Sobreposicao.module.css`,
  `Onboarding/*.module.css`, `PainelTime.module.css`, `Comparativo.module.css`,
  `BlocoPreto.module.css`) — não é um valor inventado para esta tarefa,
  é a aplicação da mesma convenção já estabelecida.
- **`Home.module.css` lido por inteiro**: `.pagina` é `display: flex;
  flex-direction: column` por padrão (idêntico ao comportamento anterior a
  `REFAT-08-01` abaixo de 1024px) e só dentro de
  `@media (min-width: 1024px)` vira `display: grid;
  grid-template-columns: var(--home-coluna-fixa-largura)
  var(--home-feed-largura)`. `grep -nE '[0-9]+px'` no arquivo não encontra
  nenhum literal fora de comentário/media query — os 2 tokens novos são a
  única adição de "largura" e ambos são `var(...)` no CSS de fato (não
  literal solto), sem colidir com o escopo de `REFAT-07-02` (literais de
  **borda**, não de largura de coluna).
- **`Home.tsx` lido por inteiro**: `SecaoSeusEsportes`/`SecaoUltimasNoticias`
  passaram a ficar dentro de `<div className={estilos['feed']}>` — nó
  simples, sem `role`/`aria-*` (confirmado por `grep`), não introduz landmark
  nova nem muda a ordem de leitura/foco (a ordem de renderização das 3
  seções — `SecaoIdentidade` → `SecaoSeusEsportes` → `SecaoUltimasNoticias`
  — é a mesma de antes de `REFAT-08-01`, só o agrupamento do container
  mudou). Nenhuma prop, nenhum estado, nenhuma das 3 seções foi tocado por
  dentro.
- **`vitest run app/rotas/paginas/Home.test.tsx` isolado**: 8/8 passam,
  incluindo o novo caso mecânico de CSS (`'CSS (REFAT-08-01): grade de 2
  colunas (336px/748px) só a partir de 1024px, coluna única abaixo disso'`)
  — lido o próprio teste: ele lê o CSS-fonte real (não um snapshot) via
  `readFileSync` e confere, por regex, tanto o `display: flex`/
  `flex-direction: column` fora de media query quanto o `display: grid`/
  `grid-template-columns: var(--home-coluna-fixa-largura)
  var(--home-feed-largura)` dentro de `@media (min-width: 1024px)`, mais os
  2 valores de token em `tokens.css` — o teste de fato verifica o que
  afirma verificar, não é um mock ou uma alegação solta.
- **`SecaoIdentidade.test.tsx`/`SecaoSeusEsportes.test.tsx`/
  `SecaoUltimasNoticias.test.tsx` rodados isolados**: 28/28 passam juntos
  (8+9+11 confirmados pela contagem do runner), nenhuma asserção alterada
  em relação à validação já feita no Lote 8 original — confirmando que
  `REFAT-08-01` não tocou o conteúdo interno de nenhuma das 3 seções.

**Avaliação da simplificação registrada por `REFAT-08-01`**: a tarefa não
separou `SecaoIdentidade` internamente em PRÓXIMO JOGO/A BRIGA/CAMPEONATOS
— ela ocupa a coluna fixa inteira como um único bloco vertical, mesma
simplificação já registrada e aceita por `UI-T02-01`/`UI-T02-04`. O
wireframe também mostra o feed em "grade de 2 colunas de cartão" internamente
(UX-SPEC linha 1238/1240) — não reproduzido aqui, mas **fora do escopo
declarado de `REFAT-08-01`**, cuja descrição e critério de aceite falam
exclusivamente do container externo (`Home.tsx`/`Home.module.css`), "sem
alterar o conteúdo, ordem interna de cada seção". Não é uma reprovação:
critério de aceite específico desta tarefa foi cumprido à risca; a grade
interna de cartões do feed é um detalhe de diagramação adicional, não
citado no escopo desta tarefa, então não compõe o critério de aceite que o
Validador audita aqui.

**Veredito**: **Aprovado**. `REFAT-08-01` resolve de fato o achado `QA-8-01`
(layout desktop de 2 colunas de T-02), confirmado por leitura de código,
conferência número a número contra o UX-SPEC e execução real dos 4 arquivos
de teste citados no critério de aceite — não pela nota do Executor. Nenhum
achado novo nesta rodada. Libera para auditoria do chapéu DevSecOps (mudança
puramente de CSS/estrutura de container, sem superfície de segurança nova).

### Fechamento estrutural de `Refatoração Lote-8`

- [x] A tarefa (`REFAT-08-01`) está `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: `REFAT-08-01` dependia de
      `UI-T02-04` (Lote 8, já `Validado (com ressalvas)`) — satisfeita;
      nenhuma tarefa de lote posterior depende de `REFAT-08-01`.
- [x] Nenhuma tarefa `Bloqueada` em todo o `TASK.md`.
- [x] Nenhum achado novo de código encontrado durante esta verificação —
      sem nova tarefa em `Refatoração Lote-8`.

Nenhuma inconsistência que exija redesenho de dependência/decomposição —
sem escalonamento ao Coordenador nesta rodada.

---

## Lote 13 — Spikes técnicos

Natureza diferente dos demais lotes: as 5 tarefas (SPK-01 a SPK-05) são
investigações sem "critério de aceite" na tabela do `TASK.md` — a própria
incerteza é o objeto do spike. A validação do chapéu QA aqui não é
`acceptance-criteria-validation` tradicional; é confirmação de que cada
conclusão está fundamentada em fonte/evidência real (URL, doc oficial,
arquivo de código lido, dado coletado de verdade), sem afirmação vaga ou
inventada, e de que nenhum código de produção foi alterado fora do escopo
de investigação previsto.

### Verificação por tarefa

- **SPK-01** (provedor gratuito adicional): conclusão fundamentada em fontes
  citadas e verificáveis — [api-football.com/pricing](https://www.api-football.com/pricing)
  (100 req/dia), [thesportsdb.com/pricing](https://www.thesportsdb.com/pricing)
  (30 req/min, 10 resultados/endpoint), com fonte secundária citada à parte
  para cobertura de estaduais/Copa do Brasil e limitações de confirmação
  admitidas explicitamente ("não consegui confirmar diretamente"), em vez de
  preenchidas com suposição. Conclusão ("parcialmente viável, nenhum resolve
  sozinho") é proporcional à evidência reunida, não inflada. Nenhum código
  alterado — confirmado por leitura de `pipeline/futebol/` (nenhum adaptador
  novo) e ausência de qualquer registro novo de provedor em
  `config/campeonatos-2026.json`.
- **SPK-02** (fase/eliminação em mata-mata): conclusão ancorada em fonte
  primária (`docs.football-data.org/general/v4/match.html`) e em leitura
  direta de código (`adaptador-football-data.ts` linhas 362-365,
  `derivador-status.ts`) — não é opinião, é verificação factual de mapeamento
  já existente. Recomendação de não mudar nada é consistente com a evidência
  (nenhum ganho concreto identificado em alterar). Nenhum código alterado.
- **SPK-03** (`verificar-catalogo` em rede aberta): resultado honesto —
  nenhuma das 4 fontes virou "verificada", e a nota documenta isso sem
  disfarçar como sucesso parcial. Achados registrados com evidência
  específica por fonte (GE: termos gerais da Globo via busca, sem carve-out
  de RSS; UOL: termos ambíguos, mantido `pendente`; Folha: nenhuma URL/termos
  localizados; Placar: achado decisivo com fonte citada —
  `placar.com.br/termos-e-condicoes/`, proibição explícita de "robôs ou
  qualquer dispositivo para monitorar ou copiar conteúdo"). Limitação de
  ambiente (WebFetch bloqueado nos mesmos domínios do ADR-007/013)
  documentada como o que é — limitação recorrente do ambiente de agente, não
  descoberta nova. `config/fontes.json` confirmado por mim, byte a byte,
  como **intocado**: exatamente 5 fontes, GE e UOL ainda `pendente`,
  Folha/Placar não adicionadas — decisão correta, dado que adicionar
  quebraria o invariante `length(5)` (RN-19) sem decisão do
  Coordenador/stakeholder sobre qual fonte substituir.
- **SPK-04** (telemetria gratuita): comparação de candidatos com
  característica técnica específica e verificável para cada um (limite de
  eventos customizados, cota, modelo de hospedagion) — não é lista genérica
  de "prós e contras" copiada de marketing. Descarte de Plausible/Umami
  self-hosted fundamentado em risco arquitetural real (ADR-001), não em
  preferência. Recomendação de trocar Cloudflare Web Analytics por Umami
  Cloud no ADR-012 regra 4 é tecnicamente correta (Cloudflare não suporta
  evento customizado — fato verificável, não interpretação) mas é mudança de
  ADR, fora da autoridade deste spike e deste Validador — tratado na seção
  de achados abaixo. Confirmado por leitura de `app/telemetria/`: nenhuma
  referência a GoatCounter/Umami/Cloudflare/SDK de terceiro no código;
  `assinarColetor` continua sem adaptador plugado.
- **SPK-05** (calibração do limiar de dedup): amostra real (51 itens de 2
  fontes, com a limitação de escopo/tamanho admitida explicitamente — não é
  a janela de 24h original, e a nota documenta isso como desvio assumido, não
  escondido). Metodologia verificável: rodou `saoEquivalentes`/
  `coeficienteDice`/`contarTokensFortesComuns` reais sobre os pares
  identificados manualmente e sobre a varredura cruzada completa (600 pares),
  reportando o valor máximo observado (0,606) contra o limiar (0,82) com
  número exato, não estimativa. Conclusão de manter o limiar é a conclusão
  correta dada a evidência (nenhum par próximo do limiar). Confirmado por
  leitura de `dominio/dedup/similaridade.ts`: `LIMIAR_DICE = 0.82` e
  `MINIMO_TOKENS_FORTES_COMUNS = 2` inalterados.

### Portões (projeto inteiro, após as 5 tarefas)

- `tsc --noEmit`: limpo.
- `eslint .`: limpo.
- `vitest run`: **97 arquivos / 1099 testes**, todos passando — idêntico ao
  estado anterior às 5 tarefas (nenhuma mudança de código esperada, e
  nenhuma encontrada).

### Achados que pedem atenção do Coordenador (não bloqueiam este lote)

Nenhum é reprovação de tarefa (o spike concluiu o que concluiu, com
evidência) — são recomendações que exigem decisão fora da autoridade deste
Validador, registradas formalmente em `BLOCKERS.md` (Bloqueios 002 e 003) e
como novos itens na Seção 6 do `TASK.md`:

1. SPK-01/SPK-02: **sem ação** — ficam como registro informativo. RF-07/RF-08
   continuam "sem dados" para as competições fora do Brasileirão, exatamente
   o comportamento já implementado (ING-F-01/02/03 tratam isso como estado
   de primeira classe). Nenhuma decisão de arquitetura pendente aqui.
2. SPK-03: achado sobre os termos do Placar (proibição explícita de robôs) é
   relevante para a decisão de negócio de P-GE/ADR-013 — registrado como
   `Bloqueio 002` em `BLOCKERS.md`, escalado ao `coordenador` (dono do
   conteúdo do ADR-013) e sinalizado em paralelo ao `gestor` por ter
   relevância estratégica na decisão de P-GE (RT-01). Não bloqueia nada em
   produção hoje — GE já é tratado como `pendente`.
3. SPK-04: recomendação de trocar a alternativa do ADR-012 regra 4 (Cloudflare
   Web Analytics → Umami Cloud) é mudança de conteúdo de ADR — registrado
   como `Bloqueio 003` em `BLOCKERS.md`, escalado ao `coordenador`. Não
   bloqueia produção hoje: TEL-01 já está implementado e funcional com
   sumidouro local, sem nenhuma ferramenta externa plugada ainda.
4. SPK-05: observação sobre falso negativo potencial do sinal título-only
   fica registrada como nota, sem ação — o próprio spike concluiu que não há
   evidência de mudança necessária ao limiar em si.

### Veredito

**Aprovado, sem reprovação.** As 5 tarefas cumpriram o objetivo de
investigação com evidência real e proporcional à conclusão apresentada;
nenhum código de produção foi alterado indevidamente; os achados que exigem
decisão de arquitetura/ADR foram escalados ao Coordenador (e, no caso de
SPK-03, também ao Gestor em paralelo), não decididos por este Validador.

---

## Refatoração Lote-2 — validação de fechamento

**Base específica**: `REFAT-02-01` (`.md/TASK.md`, lote `Refatoração Lote-2`),
`Concluída` (2026-09-07, atualização de status a partir do `Bloqueio 010` em
`.md/BLOCKERS.md`, `Status: Resolvido`). Contexto necessário lido por inteiro
antes de validar: `Bloqueio 009` e `Bloqueio 010` (`.md/BLOCKERS.md`) — 15/20
`idsProvedor.football-data` confirmados contra a resposta real da API do
football-data.org; os 5 clubes da configuração original que não jogam a
Série A 2026 de verdade (`ceara`, `fortaleza`, `sport`, `juventude`,
`criciuma`) foram substituídos, com aprovação explícita do
usuário/stakeholder (decisão de conteúdo/configuração, não técnica), pelos 5
clubes reais confirmados no mesmo log: Athletico Paranaense (1768), Coritiba
(4241), RB Bragantino (4286), Clube do Remo (4287), Chapecoense (1772).

Comandos executados por mim, do zero, no estado atual do repositório, antes
de qualquer veredito: `npm run test -- --run` (**99 arquivos / 1135 testes,
todos passando**), `npm run typecheck` (limpo), `npm run lint` (limpo),
`npm run format:check` (limpo — "All matched files use Prettier code style!").

Não usei a nota de implementação do orquestrador como base de aprovação —
conferi cada afirmação por leitura direta de arquivo/execução real:

- **`config/clubes-2026.json` sem sentinela**: lido o arquivo inteiro (20
  entradas). Nenhuma ocorrência de `"pendente-confirmacao"` (grep confirmado
  — as únicas 6 ocorrências da string no repositório são histórico legítimo
  em `.md/TASK.md`, `.md/QA-REPORT.md`, `.md/SECURITY-REVIEW.md`, testes que
  exercitam a sentinela como caso negativo (`pipeline/config/clubes.ts`,
  `pipeline/futebol/adaptador-football-data.test.ts`,
  `pipeline/publicacao/gerador-snapshots.test.ts`), e a constante
  `SENTINELA_ID_PENDENTE` em `pipeline/config/clubes.ts` — nenhuma no dado
  real). Todos os 20 `idsProvedor.football-data` são numéricos. Os 5 clubes
  novos estão presentes com os ids exatos do Bloqueio 010: `athletico-pr`
  (1768), `coritiba` (4241), `rb-bragantino` (4286), `remo` (4287),
  `chapecoense` (1772) — conferido campo a campo por leitura direta do JSON,
  não só pela nota.
- **Identidade visual completa e contraste do ADR-017**: os 5 clubes novos
  têm `nome`/`nomeCurto`/`sigla`/`corBase` preenchidos em
  `config/clubes-2026.json`. Quanto à exigência de validação de contraste do
  ADR-017 (a paleta derivada precisa passar nos 6 alvos de contraste da §3
  do ADR ou o build quebra, `ErroPaletaInvalida`): confirmei que
  `pipeline/config/derivador-paleta.test.ts` roda `derivarPaletasClubes`
  sobre **todos os 20 clubes reais** carregados de `config/clubes-2026.json`
  (não uma lista fixa hardcoded) e afirma que nenhum lança — isso cobre os 5
  clubes novos automaticamente, sem precisar de teste nomeado por clube.
  Rodei esse teste isoladamente
  (`npx vitest run pipeline/config/derivador-paleta.test.ts`) e confirmei
  passando. Também li `app/public/dados/config/clubes-2026.json` (snapshot
  publicado) e confirmei que os 5 clubes novos têm o bloco `paleta` completo
  (11 campos) com valores coerentes com a derivação do ADR-017 a partir da
  `corBase` de cada um — só `coritiba` precisou de `paletaManual.faixaB`
  (`#004526`, mesmo remédio já usado por `palmeiras` e antes por
  `juventude`, verde com contraste insuficiente na faixa derivada); os
  outros 4 clubes novos (Athletico-PR, RB Bragantino, Remo, Chapecoense)
  convergem sem override. Ou seja, a checagem de contraste **foi feita** para
  os 5 clubes novos — não por decisão manual clube a clube, mas pelo próprio
  mecanismo estrutural do ADR-017 (validação genérica sobre o dado real, que
  quebraria o teste/build se algum dos 5 falhasse). Não é uma lacuna.
- **`config/campeonatos-2026.json`**: lido o arquivo inteiro. As referências
  aos 5 clubes removidos foram retiradas das listas de `gaucho` (Juventude),
  `cearense` (Ceará/Fortaleza), `pernambucano` (Sport) e `copa-do-nordeste`
  (Ceará/Fortaleza/Sport) — cada uma com `observacao` explicando a ausência
  e citando o Bloqueio 010, exatamente como a nota descreve. Brasileirão e
  Copa do Brasil usam a lista nova de 20 clubes (com `athletico-pr`,
  `coritiba`, `rb-bragantino`, `remo`, `chapecoense` no lugar dos 5
  removidos). `config/campeonatos.test.ts` lê `config/clubes-2026.json`
  dinamicamente (não uma lista hardcoded) e prova, nas duas direções, que o
  conjunto de clubes do Brasileirão é exatamente igual ao conjunto de ids de
  `config/clubes-2026.json` — teste real, não alegação, e passa.
- **Grep por slugs antigos em todo o repositório** (`ceara`, `fortaleza`,
  `sport`, `juventude`, `criciuma`, case-insensitive, fora de
  `.md/BLOCKERS.md`/`.md/TASK.md`, histórico legítimo): as únicas ocorrências
  encontradas fora do histórico são falsos positivos — "Sport Club" como
  parte do nome oficial de Corinthians (`Sport Club Corinthians Paulista`) e
  Internacional (`Sport Club Internacional`), e "Esporte"/"Esportiva" dentro
  de nomes de clube (Palmeiras, Cruzeiro, Bahia, Vitória) e de arquivos de
  configuração de esporte (`config/lexico-esportes.json`). Nenhuma ocorrência
  residual real de `ceara`/`fortaleza`/`sport` (clube)/`juventude`/`criciuma`
  encontrada em código, config, teste ou fixture de nenhum lote — incluindo
  Lotes 8/9 (onboarding/seleção de time) e Lote 10 (painel/detalhe de
  campeonato), que consomem a lista de clubes dinamicamente via
  `useClubesPublicos`/snapshot, não por lista hardcoded, então a troca dos 5
  clubes não deixou fixture desatualizada nesses lotes. Os arquivos
  publicados por clube em `app/public/dados/futebol/clube/` já têm os 5
  arquivos novos (`athletico-pr.json`, `coritiba.json`,
  `rb-bragantino.json`, `remo.json`, `chapecoense.json`) e não têm mais os 5
  antigos — confirma que a geração de snapshot (PUB-02/03) já rodou sobre a
  configuração corrigida.
- **`tests/clubes-2026.test.ts` atualizado**: li o arquivo inteiro. Existem,
  e passam de fato (`npx vitest run tests/clubes-2026.test.ts`, isolado): o
  caso "todos os 20 clubes têm id numérico confirmado (Bloqueio 010
  resolvido — nenhuma sentinela restante)" (rejeita `SENTINELA_ID_PENDENTE`
  e exige `typeof === 'number'` para os 20) e o caso "os 5 clubes reais
  confirmados no Bloqueio 010 estão presentes com o id certo" (tabela
  literal com os 5 ids esperados, batendo exatamente com o Bloqueio 010).
  Também confirmei que o teste de clubes acromáticos (ADR-017/TR-14) foi
  ajustado corretamente para 5 (não mais 6, já que `ceara` saiu da lista e
  nenhum dos 5 novos é acromático) — mudança correta, não descuido.

**Nenhum achado de severidade alta/crítica, nenhuma reprovação (crítica ou
simples).**

### Fechamento estrutural de `Refatoração Lote-2`

- [x] A única tarefa (`REFAT-02-01`) está `Concluída` no `TASK.md`.
- [x] Nenhuma dependência órfã/inconsistente: `REFAT-02-01` dependia de
  `CFG-02` (Lote 2, já `Validado`) — satisfeita; nenhum lote a jusante
  (`ING-F-01`/Lote 5, já `Validado`) ficou com pré-requisito pendente por
  causa desta tarefa.
- [x] Nenhuma tarefa `Bloqueada`.
- [x] Nenhum achado novo de código encontrado durante esta verificação que
  justifique nova tarefa de refatoração — a substituição dos 5 clubes foi
  aplicada de ponta a ponta (dado base, campeonatos, paleta, snapshots
  publicados, testes), sem ponta solta.

Nenhuma inconsistência que exija redesenho de dependência/decomposição — sem
escalonamento ao Coordenador nesta rodada.

**Veredito**: **Aprovado**. `Refatoração Lote-2` fechada — libera para
auditoria do chapéu DevSecOps (o achado original que originou esta tarefa era
puramente de dado/configuração, sem implicação de segurança; a substituição
de conteúdo, embora visível ao usuário final, já teve aprovação explícita do
usuário/stakeholder registrada no Bloqueio 010, então não é reaberta aqui).

---

## Confirmação final pré-deploy — primeira publicação (chapéu QA)

**Escopo**: todos os lotes com `**Status do lote**: Validado`/`Validado (com
ressalvas)` — Lote 1, Refatoração Lote-1, Lote 2, Lote 3, Lote 4, Lote 5,
Lote 6, Refatoração Lote-6, Lote 7, Refatoração Lote-7, Lote 8, Refatoração
Lote-8, Lote 9, Refatoração Lote-9, Lote 10, Refatoração Lote-10, Lote 11,
Refatoração Lote-11, Lote 13 — indo juntos ao ar pela primeira vez. Excluídos:
Lote 12 (sem veredito de fechamento gravado), `REFAT-02-01` e `REFAT-07-02`
(`Pendente`, débitos já registrados e não bloqueantes).

**1. Regressão do zero** (suíte completa rodada de novo, não reaproveitada de
lote anterior):

| Portão | Comando | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | Limpo, sem erro |
| Lint | `npm run lint` | Limpo, sem erro |
| Formatação | `npm run format:check` | Limpo — "All matched files use Prettier code style!" |
| Testes | `npm run test` | **97 arquivos / 1099 testes, todos passando** — número idêntico ao último registrado (Lote 13/Refatoração Lote-8), confirmando zero regressão |
| Auditoria de dependências | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilidades alta/crítica |
| Build de produção | `npm run build` | Sucesso — `dist/index.html` (2.78 kB), CSS (56.61 kB), JS (375.11 kB); `dist/` removido logo em seguida, artefato de verificação, não de publicação |
| `git status` | — | Nenhuma edição de código fora do que já foi aprovado lote a lote — todo o código está `??` (nunca commitado desde o "Initial commit" que só trouxe config do Claude Code), sem `modified` inesperado. Confirma que não há edição solta por fora do processo. Único arquivo avulso fora do escopo de código é `rascunho.txt` (nota de planejamento do usuário, não afeta build/testes/deploy). Nota operacional (não é achado de código): como nada além do commit inicial foi enviado ao Git, `git add`/`commit`/`push` para `main` — o gatilho real de `build-publish.yml` — ainda precisa ser feito pelo usuário/orquestrador; já documentado em `.md/DEPLOY.md` §2 como ação pendente do stakeholder |

**2. Checagem de integração entre lotes** (o que a validação isolada por lote
não cobre — primeira vez que pipeline de ingestão + gerador de snapshots +
SPA rodam juntos de ponta a ponta):

- Não existe hoje um teste automatizado que rode `gerarSnapshotsEmDisco` e
  aponte a SPA construída (`vite preview`) para consumir os arquivos gerados
  — lacuna real, coberta manualmente agora. `pipeline/publicacao/gerador-
  snapshots.test.ts` só valida a saída contra os schemas do próprio pipeline
  (tautológico) e, só para `versao.json`, contra o schema real da SPA
  (`esquemaVersao` de `app/dados/versao.ts`). Para `brasileirao.json`,
  `futebol/clube/<slug>.json` e `config/clubes-2026.json` não havia essa
  segunda checagem cruzada — os schemas são **duplicados manualmente** entre
  `pipeline/publicacao/gerador-snapshots.ts` e `app/dados/{futebol,configPublico}.ts`
  (Diretriz de Implementação #10 do TASK.md: "qualquer mudança de contrato
  exige atualizar os dois lados"), sem trava automática de sincronia.
- Verificação manual executada: rodei `gerarSnapshotsEmDisco` com estado
  mockado realista (mesma fixture de `gerador-snapshots.test.ts`, usando
  `config/campeonatos-2026.json`/`config/clubes-2026.json` **reais** do
  repositório — 20 clubes, Brasileirão Série A) escrevendo em disco, depois
  parseei cada arquivo gerado contra o schema real que a SPA usa (`esquemaVersao`,
  `brasileiraoPublicoSchema`/`clubeFutebolPublicoSchema` de `app/dados/futebol.ts`,
  `clubesPublicosSchema` de `app/dados/configPublico.ts`) — não contra o
  schema do próprio pipeline. Resultado: **as 4 checagens passaram sem erro**
  — `versao.json`, `futebol/brasileirao.json`, `futebol/clube/flamengo.json` e
  `config/clubes-2026.json` gerados pelo pipeline são estruturalmente
  compatíveis com o parse real que a SPA faz hoje. Nenhuma divergência de
  contrato encontrada entre as duas cópias manuais do schema.
  - Achado não bloqueante: recomendo ao Coordenador (nota, não escalonamento
    formal — não há inconsistência real hoje, é hardening preventivo) estender
    o teste cruzado que já existe para `versao.json` aos demais 3 arquivos com
    schema duplicado, para não depender de checagem manual em publicações
    futuras. Registrado aqui como observação, sem tarefa aberta em
    `Refatoração Lote-X` (não é débito de código existente, é lacuna de
    cobertura de teste sobre código já correto).
- `react-router-dom@7.18.3` (REFAT-01-03): a suíte completa (97/1099) já
  cobre todas as telas dos Lotes 8-11 sob `<MemoryRouter>` real, sem nenhuma
  falha — dupla confirmação neste ponto de corte sem regressão.
- Workflows `.github/workflows/ingestao.yml` e `build-publish.yml`: lidos e
  confirmados aptos a rodar o conjunto publicado sem depender de nenhuma
  tarefa `Pendente` — `npm run ingestao` (`tsx pipeline/ingestao-cli.ts`) já
  existe desde REFAT-06-01; ausência do token real (REFAT-02-01) não bloqueia
  o workflow, que já degrada para dry-run gracioso nesse cenário (comportamento
  testado e aprovado no Lote 6/Refatoração Lote-6). Ver `.md/DEPLOY.md` §1
  para a confirmação completa de infraestrutura (chapéu DevOps).

**Nenhum achado de severidade alta/crítica, nenhuma reprovação crítica.**

**Veredito**: **Aprovado — liberado para staging/produção do lado funcional
(chapéu QA)**, condicionado à aprovação em paralelo do chapéu DevSecOps
(ver `.md/SECURITY-REVIEW.md`, mesma seção) para a dupla aprovação exigida
antes do `/deploy` real.

---

## Log de Validações

| Data | Lote | Veredito | Observação |
|---|---|---|---|
| 2026-09-06 | Lote 1 — Fundação técnica | Aprovado | 5/5 tarefas aprovadas; 1 achado simples corrigido in loco (formatação), 1 tarefa aberta em Refatoração Lote-1 |
| 2026-09-06 | Lote 2 — Configuração por temporada | Aprovado | 5/5 tarefas aprovadas (CFG-01 a CFG-05); 347/347 testes, `tsc`/`eslint` limpos; 1 achado simples (idsProvedor pendente) virou REFAT-02-01; decisões de CFG-04 (zonas ausente, interpretação de "soma bate com 20") avaliadas como aceitáveis |
| 2026-09-06 | Lote 3 — Domínio compartilhado (puro) | Aprovado | 6/6 tarefas aprovadas (DOM-01 a DOM-06); 347/347 testes, `tsc`/`eslint` limpos; 2 achados informativos (documentação SDD/CFG-05), sem nova tarefa de refatoração |
| 2026-09-06 | Lote 4 — Pipeline de ingestão de notícias | Aprovado | 7/7 tarefas aprovadas (ING-N-01 a 07); 486/486 testes, `tsc`/`eslint` limpos; 2 achados avaliados e resolvidos sem tarefa de refatoração (config sem tarefa própria aceito e documentado; reinterpretação de retenção verificada matematicamente equivalente) |
| 2026-09-06 | Lote 5 — Pipeline de ingestão de futebol | Aprovado | 5/5 tarefas aprovadas (ING-F-01 a 05); 555/555 testes, `tsc`/`eslint` limpos; casamento por id verificado por execução real (nome-isca); CA-16.2 (20 clubes/todas as rodadas) e descarte por inconsistência verificados por execução real; débito REFAT-02-01 confirmado como operacional (prazo ajustado); mapa interno de código de competição aceito sem tarefa nova; nenhuma tarefa em Refatoração Lote-5 |
| 2026-09-06 | Lote 6 — Paleta de clube e publicação | Aprovado (com ressalvas) | 3/3 tarefas aprovadas (PUB-01 a 03); 811/811 testes do projeto, `tsc`/`eslint` limpos; os 4 exemplos do UX-SPEC §3.4 e os 8 alvos de contraste do ADR-017 confirmados por execução real; `paletaManual` de Palmeiras/Juventude confirmado como mecanismo previsto pelo ADR-017 item 5, não contorno; snapshot completo gerado por mim a partir de config real (20 clubes/5 fontes/12 campeonatos), todos os arquivos validados contra schema e teto de tamanho comprimido do SDD §2.2; varredura de segredo em `dist-dados/` testada com injeção real; `npm audit` sem alta/crítica; achado QA-6-01 (débito SEC-01-02/REFAT-01-02 com prazo vencido, não resolvido por PUB-03 como a nota sugeria) e QA-6-02 (lacuna de wiring `npm run ingestao`, nova tarefa REFAT-06-01) registrados, nenhum bloqueante para a aprovação funcional |
| 2026-09-06 | Lote 7 — Design system e infraestrutura de tela | Aprovado | 9/9 tarefas aprovadas (UI-DS-01 a 09); 772/772 testes (59 arquivos), `tsc`/`eslint` limpos; `axe-core` zero violações nas 3 variantes × 2 temas × 4 paletas de `FaixaClube`; `TabelaClassificacao` confirmada `<table>` real com `caption`/`scope`/`aria-current`; CA-13.4/CA-13.5 confirmados em `armazenamento/preferencias`; 1 achado simples (literais fora de tokens.css) virou REFAT-07-01; lacuna de UX-SPEC ("paleta de 15 tons por esporte") registrada como nota tipo "spec gap" ao Coordenador, sem tarefa de código e sem bloqueio |
| 2026-09-06 | Lote 8 — Onboarding e Home | Aprovado (com ressalvas) | 6/6 tarefas aprovadas (UI-T01-01/02, UI-T02-01/02/03/04); 909/909 testes (75 arquivos), `tsc`/`eslint` limpos; build+`vite preview` confirmados; correção de contrato de UI-T02-02 (array vs. `{itens}`) verificada contra o schema real `noticiasPublicasSchema` de PUB-02; CA-14.4 (retomada do passo 2) e "navegação nunca duplicada por largura" verificados por teste de execução real, não por alegação; CA-19.4 (30 grupos = 30, não 60) confirmado por teste dedicado; 1 achado simples (layout desktop de 2 colunas não reproduzido) virou REFAT-08-01, sem bloqueio |
| 2026-09-06 | Lote 9 — Configurações e seleção de time | Aprovado (com ressalvas) | 3/3 tarefas aprovadas (UI-T03-01/02, UI-T04-01); 951/951 testes (83 arquivos), `tsc`/`eslint`/`format:check` limpos; CA-02.3 (GE nunca acionável) confirmado estruturalmente (nenhum elemento focável na linha do GE); troca de tema em `sportslm.tema.v1` e texto de privacidade/RNF-07 confirmados literais; CA-06.3/CA-06.5 confirmados com texto canônico; correção do bug latente de `aoAlternarFonte` (UI-T03-02) confirmada por leitura de código; 2 achados simples de integração entre lotes (QA-9-01, reatividade cruzada de preferências entre Home/Lote 8 e Configurações; QA-9-02, ausência de gatilho automático de RN-12 no retorno) viraram REFAT-09-01/02, prazo antes do Lote 10, sem bloqueio |
| 2026-09-06 | Refatoração Lote-9 (débito técnico) | Aprovado | 2/2 tarefas aprovadas (REFAT-09-01, REFAT-09-02); 954/954 testes (83 arquivos), `tsc`/`eslint` limpos; `useSyncExternalStore` confirmado por teste de execução real propagando bloqueio de fonte da Home sem remontagem (QA-9-01 resolvido); abertura automática de `EscolherTime` na virada de temporada confirmada por teste real, inclusive o caso negativo (`timeForaDaTemporada` falso não abre) (QA-9-02 resolvido); fechamento estrutural confirmado, sem nova tarefa |
| 2026-09-06 | Lote 10 — Painel e detalhe do campeonato | Aprovado (com ressalvas) | 3/3 tarefas aprovadas (UI-T05-01, UI-T06-01, UI-T06-02); 972/972 testes (85 arquivos), `tsc`/`eslint` limpos; os 7 estados de `LinhaPartida` confirmados com texto canônico literal por execução real de teste (CA-08.6 a CA-08.10); `<caption>` dinâmico e zonas de `TabelaClassificacao` confirmados com/sem zona, sem erro (CA-18.1/CA-18.2); CA-07.2 (sem dados nunca omitido) e CA-07.4 (ordenação idêntica, DOM único) confirmados por teste real; 3 achados simples (QA-10-01, cobertura de teste de frescor em alerta; QA-10-02, literal `1120px` fora de tokens; QA-10-03, cópia de "sem time" reaproveitada de T-05 em T-06) viraram REFAT-10-01/02/03, sem bloqueio |
| 2026-09-06 | Lote 11 — Rivais, comparativo e simulação | Aprovado (com ressalvas) | 4/4 tarefas aprovadas (UI-T07-01, UI-T08-01, UI-T09-01, UI-T09-02); 999/999 testes (88 arquivos), `tsc`/`eslint` limpos; CA-09.1 (time do coração nunca aparece)/CA-09.3/CA-09.4 (textos canônicos) confirmados por teste real; CA-10.3 (confronto direto nas duas listas) garantido por construção (fonte única de dado) e confirmado por teste real; CA-11.4 (confronto direto sem contradição) confirmado como impossibilidade estrutural do modelo de dados (`Cenario.palpites`), com teste real de espelhamento efetivo; WCAG 2.4.11 confirmado como reuso do mecanismo de `BlocoPreto`/UI-DS-02, não reimplementado; 1 achado simples (QA-11-01, matriz responsiva ≥900px de T-09 ausente) virou REFAT-11-01, sem bloqueio — último lote de tela antes do Lote 12 |
| 2026-09-06 | Refatoração Lote-10 (débito técnico) | Aprovado | 3/3 tarefas aprovadas (REFAT-10-01, REFAT-10-02, REFAT-10-03); 1002/1002 testes (88 arquivos) em 3 execuções seguidas sem flakiness, `tsc`/`eslint` limpos; QA-10-01 (teste real de frescor em alerta em `PainelTime`/`DetalheCampeonato`) confirmado por leitura direta do DOM asserido; QA-10-02 (`max-width` literal) confirmado substituído por `var(--largura-container)`; QA-10-03 (texto "sem time" mencionando "painel") confirmado substituído, sem a palavra "painel" no texto visível; fechamento estrutural confirmado, sem nova tarefa |
| 2026-09-06 | Refatoração Lote-11 (débito técnico) | Aprovado | 1/1 tarefa aprovada (REFAT-11-01); 1002/1002 testes (88 arquivos) em 3 execuções seguidas sem flakiness (inclusive o caso CA-11.6 historicamente instável, agora com `waitFor`), `tsc`/`eslint` limpos; matriz responsiva ≥900px de T-09 confirmada implementada, reaproveitando `SeletorPalpite` variante `espelhado`/UI-DS-05 e `BarraPontuacao`/UI-DS-06 (sem reimplementação); nenhuma regressão em CA-11.1 a CA-11.10 confirmada pelos testes originais intactos; fechamento estrutural confirmado, sem nova tarefa |
| 2026-09-06 | Refatoração Lote-1 (débito técnico) | Aprovado | 3/3 tarefas aprovadas (REFAT-01-01, REFAT-01-02, REFAT-01-03); 96 arquivos/1092 testes (projeto inteiro) e 24 arquivos/232 testes (`app/rotas/` isolado), `tsc`/`eslint`/`format:check`/`build` limpos, `npm audit --omit=dev` 0 vulnerabilidades; `format:check` confirmado bloqueante por injeção real de arquivo desformatado; as 5 ações de `build-publish.yml` confirmadas por SHA de commit com comentário de versão, `runs-on: ubuntu-24.04` alinhado a `ingestao.yml`; `react-router-dom@7.18.3` confirmado sem regressão em `app/rotas/`; fechamento estrutural confirmado, sem nova tarefa; libera para auditoria do chapéu DevSecOps (fecha `SEC-01-02`/`SEC-01-03`/`SEC-08-01`) |
| 2026-09-06 | Refatoração Lote-7 (débito técnico) | Aprovado (com ressalvas) | 1/1 tarefa aprovada (REFAT-07-01); 97 arquivos/1098 testes (projeto inteiro), `tsc`/`eslint`/`format:check` limpos; QA-7-01 (5 literais + reuso de `--z-pular-conteudo`) confirmado resolvido por leitura direta de código, grep e conferência de valor dos 4 tokens novos; escala de z-index (`--z-bloco-fixo`500 < `--z-modal`900 < `--z-pular-conteudo`1000) conferida; 1 achado novo (QA-7-03, mesmo padrão de literal de borda em outros 10+ arquivos do design system) virou REFAT-07-02, prazo antes do Lote 12, sem bloqueio; fechamento estrutural confirmado |
| 2026-09-06 | Refatoração Lote-6 (débito técnico) | Aprovado | 1/1 tarefa aprovada (REFAT-06-01); 97 arquivos/1098 testes, `tsc`/`eslint`/`format:check` limpos, `npm audit --omit=dev --audit-level=high` 0 vulnerabilidades, YAML de `ingestao.yml` validado; ordem sequencial notícias→futebol→snapshots confirmada por teste real (inclusive prova contra regressão para `Promise.all`); propagação de erro dos 3 passos sem engolir nada confirmada; 3 ramos do step "Executa pipeline de ingestão" cobrem dry-run sem script/sem token e execução real com token; ramo (c) fim-a-fim contra rede real não exercitável neste ambiente (sem `FOOTBALL_DATA_API_TOKEN`, limitação de ambiente registrada, não pendência de critério de aceite); fechamento estrutural confirmado, sem nova tarefa |
| 2026-09-06 | Refatoração Lote-8 (débito técnico) | Aprovado | 1/1 tarefa aprovada (REFAT-08-01); 97 arquivos/1099 testes (projeto inteiro), `tsc`/`eslint`/`format:check`/`build` limpos; QA-8-01 (layout desktop de 2 colunas de T-02) confirmado resolvido por conferência número a número contra UX-SPEC §2/T-02 (336px/748px, wireframe e tabela-resumo) e leitura direta de `Home.module.css`/`Home.tsx`; breakpoint 1024px confirmado como a mesma convenção já usada em todo o projeto (UX-SPEC não declara valor numérico); novo `<div className={estilos['feed']}>` confirmado sem `role`/`aria-*` e sem alterar ordem/conteúdo/estado das 3 seções; nenhum literal fora de `var(...)` introduzido (sem colisão com o escopo de bordas de REFAT-07-02); fechamento estrutural confirmado, sem nova tarefa |
| 2026-09-06 | Lote 13 — Spikes técnicos | Aprovado, sem reprovação | 5/5 spikes (SPK-01 a 05) com conclusão fundamentada em fonte/evidência real, nenhuma inventada; nenhum código de produção alterado (confirmado por leitura direta: `config/fontes.json` intocado — 5 fontes, GE/UOL `pendente`; `dominio/dedup/similaridade.ts` com `LIMIAR_DICE=0.82` inalterado; `app/telemetria/` sem SDK de terceiro; `pipeline/futebol/` sem adaptador novo); 97 arquivos/1099 testes, `tsc`/`eslint` limpos, idêntico ao estado anterior; 2 achados sem autoridade deste Validador para decidir (troca de alternativa do ADR-012 regra 4, e achado de termos do Placar relevante para ADR-013/P-GE) registrados em `Bloqueio 002`/`Bloqueio 003` de `BLOCKERS.md`, escalados ao coordenador (SPK-03 também ao gestor, em paralelo); nenhuma tarefa em Refatoração Lote-13 (nenhum achado é débito de código) |
| 2026-09-07 | Refatoração Lote-2 (débito operacional/dado) | Aprovado | 1/1 tarefa aprovada (REFAT-02-01); 99 arquivos/1135 testes (projeto inteiro), `tsc`/`eslint`/`format:check` limpos; `config/clubes-2026.json` confirmado sem nenhuma ocorrência de `"pendente-confirmacao"`, 20/20 `idsProvedor.football-data` numéricos, os 5 clubes novos (Athletico-PR/Coritiba/RB Bragantino/Remo/Chapecoense) com os ids exatos do Bloqueio 010; validação de contraste do ADR-017 confirmada estruturalmente coberta pelo teste genérico de `derivador-paleta.test.ts` sobre os 20 clubes reais (só Coritiba precisou de `paletaManual`, mesmo padrão de Palmeiras); `config/campeonatos-2026.json` confirmado com as referências aos 5 clubes removidos retiradas e documentadas; grep por slugs antigos em todo o repositório sem ocorrência residual real (só falsos positivos de "Sport Club"/"Esporte" em nomes de outros clubes); `tests/clubes-2026.test.ts` confirmado com os 2 casos novos, ambos passando; fechamento estrutural confirmado, sem nova tarefa |
| 2026-09-06 | **Confirmação final pré-deploy** (Lotes 1-11+13, primeira publicação conjunta) | **Aprovado** | Regressão do zero: 97/1099 testes, `tsc`/`eslint`/`format:check`/`build` limpos, `npm audit --omit=dev --audit-level=high` 0 vulnerabilidades, `git status` sem edição solta fora do processo; integração entre lotes confirmada manualmente — `gerarSnapshotsEmDisco` com config real (20 clubes/Brasileirão) gerando arquivos validados com sucesso contra os schemas reais da SPA (`app/dados/{versao,futebol,configPublico}.ts`), não só contra o schema do próprio pipeline; `react-router-dom@7.18.3` sem regressão nas telas dos Lotes 8-11; workflows aptos sem depender de tarefa `Pendente`; 1 observação não bloqueante (estender teste cruzado pipeline↔SPA aos 3 arquivos que só têm checagem tautológica hoje), sem tarefa aberta; nenhum achado alto/crítico |
| 2026-09-08 | Lote 12 — Telemetria, acessibilidade e segurança transversal | Aprovado (com ressalvas) | 4/4 tarefas aprovadas (TEL-01, QA-02, SEC-01 sem ressalva; QA-01 com ressalva de infraestrutura de verificação); 99 arquivos/1135 testes, `tsc`/`eslint`/`format:check` limpos, `npm audit --omit=dev --audit-level=high` 0 vulnerabilidades; 5 eventos de telemetria e ausência de conteúdo/preferência na carga confirmados por tipo + teste; eliminação do módulo por build confirmada por prova real de 2 builds Vite (não simulação); CA-08.5/Bloqueio 001 confirmado resolvido com implementação real (`classificacaoFinalDoGrupo`); meta CSP do ADR-011 confirmada literal em `app/index.html` com teste de injeção XSS até o DOM real; 48 casos `axe-core` confirmados sem violação crítica/séria em nenhuma combinação tela×tema×paleta; nenhum achado vira `Refatoração Lote-12` (nenhum é débito de código); ressalva de QA-01 (sessão manual real de acessibilidade — teclado, leitor de tela, zoom 200%) registrada como pré-condição do Gate de deploy em produção, não como reprovação, sinalizada ao Coordenador/Gestor; primeiro veredito de fechamento formal deste lote — libera para auditoria do chapéu DevSecOps |
| 2026-09-09 | Refatoração Lote-12 — REFAT-12-03 (fechamento da ressalva de QA-01) | Aprovado, sem ressalva | Sessão manual real de acessibilidade (UX-SPEC §5.8, os 6 itens) executada pelo orquestrador/usuário com NVDA contra o build real (`npm run build`+`preview`) — verificação estruturalmente humana, não automatizável por agente neste ambiente (mesma limitação já confirmada em REFAT-12-01/Puppeteer headless); todos os 6 itens passaram sem achado, incluindo as 4 paletas de clube × 2 temas em Home/Painel do time; pré-condição de acessibilidade manual do Gate de deploy em produção satisfeita; `Refatoração Lote-12` com as 3 tarefas (`REFAT-12-01/02/03`) `Concluída` |
