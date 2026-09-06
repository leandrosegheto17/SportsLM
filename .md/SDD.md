# SDD.md — SportsLM

**Status**: entregue para revisão do usuário — Loop B, rodada 1 (2026-09-05)
**Autor**: Coordenador (chapéu Software Architect)
**Base**: `.md/PRD-TECNICO.md` (rodada 3, liberado), `.md/PRD.md` (rodada 3),
`.md/CTO-REVIEW.md` (Gate 1 + adendos das rodadas 2 e 3).
**Consumidores**: executor, validador, gestor.

Este documento define **como o produto é construído**. Não redefine requisito nem
escopo: onde uma restrição técnica esbarra num requisito, o fato é registrado como
risco (Seção 6) e sinalizado ao Gestor, não resolvido por conta própria.

Contexto que atravessa tudo: **protótipo** (RNF-15/RAN-20) — sem SLA, dezenas de
usuários, custo de operação zero, uso não comercial. Cada decisão traz o que mudaria
se virar produto (ADR-015).

Toda decisão relevante tem ADR em `.md/adr/` — a Seção 4 é o índice.

---

## 1. Visão Geral

### 1.1 O que o sistema é, em uma frase

Um **agregador de leitura**: um processo agendado busca 5 feeds de notícia e um
provedor de dados de futebol, normaliza tudo em um conjunto de arquivos JSON
públicos, e uma aplicação Web de página única lê esses arquivos e aplica, **no
navegador**, a personalização que o torcedor guardou no próprio dispositivo.

### 1.2 As três propriedades que moldam a arquitetura

| # | Propriedade do produto | Consequência arquitetural |
|---|---|---|
| 1 | **O dado é igual para todos.** Não há conta, não há login, não há nada calculado por usuário no servidor (Q6, RF-13) | Não é preciso backend em runtime. O dado pode ser pré-computado uma vez e servido como arquivo estático (ADR-001) |
| 2 | **Nada é ao vivo** (RN-09) e a tela não pode esperar por terceiro (RNF-05) | Ingestão periódica, desacoplada da renderização; carimbo de frescor visível em toda tela (RF-17) |
| 3 | **Toda personalização é local** — favoritos, bloqueios, time, rivais, palpites (RF-13) | O snapshot público carrega um superconjunto do que a tela mostra; o filtro é client-side (ADR-005) |

Dessas três sai a decisão estruturante: **sem backend em runtime** (ADR-001). Não é
economia: é a consequência direta de o produto não ter estado por usuário no
servidor.

### 1.3 Diagrama de contexto

```
   ┌──────────────────────┐        ┌───────────────────────────┐
   │  5 feeds RSS/Atom    │        │  Provedor de futebol      │
   │  GE*, ESPN Brasil,   │        │  football-data.org        │
   │  Gazeta, Terra, UOL* │        │  (Brasileirão Série A)    │
   └──────────┬───────────┘        └────────────┬──────────────┘
              │ HTTP GET (só na ingestão)       │ HTTP GET + token
              ▼                                 ▼
   ┌───────────────────────────────────────────────────────────┐
   │  PIPELINE DE INGESTÃO  (Node/TS, agendado a cada 30 min)  │
   │  coleta → sanitiza → classifica → deduplica → normaliza   │
   └───────────────┬───────────────────────────────────────────┘
                   │ escreve estado interno (branch `dados`)
                   ▼
   ┌───────────────────────────────────────────────────────────┐
   │  GERADOR DE SNAPSHOTS  → JSON público versionado          │
   └───────────────┬───────────────────────────────────────────┘
                   │ publica
                   ▼
   ┌───────────────────────────────────────────────────────────┐
   │  HOSTING ESTÁTICO (CDN)  —  index.html + assets + /dados  │
   └───────────────┬───────────────────────────────────────────┘
                   │ HTTP GET (mesma origem, sem CORS)
                   ▼
   ┌───────────────────────────────────────────────────────────┐
   │  SPA React/TS   ←→   localStorage (preferências, cenário) │
   │  filtro local · dedup por bloqueio · motor de simulação   │
   └───────────────────────────────────────────────────────────┘

   * GE: premissa P-GE em aberto (ADR-013). UOL: 5ª fonte não verificável
     neste ambiente (ADR-007). Nenhum dos dois bloqueia a arquitetura.
```

### 1.4 Fronteiras e responsabilidades

| Fronteira | Responsável | O que nunca faz |
|---|---|---|
| Ingestão | Confiabilidade e legalidade da entrada: só feed oficial/API com termos; sanitiza; valida esquema; respeita cota e frequência | Nunca raspa HTML; nunca busca a página da matéria; nunca "conserta" dado inválido |
| Domínio | Regras: classificação, deduplicação, status de campeonato, pontuação da simulação | Nunca conhece formato de provedor nem de RSS |
| Snapshot | Contrato público entre pipeline e SPA | Nunca contém segredo, dado pessoal, item fora do recorte ou HTML |
| SPA | Apresentação e personalização local | Nunca chama terceiro (exceto o beacon de telemetria); nunca guarda dado de conteúdo em `localStorage` |

### 1.5 Rastreabilidade requisito → componente

| Requisito | Componente principal |
|---|---|
| RF-01, RF-02 | `config/fontes.json` + `ui/configuracoes` + `estado/status.json` |
| RF-03, RF-05 | `dominio/esportes` + `ui/home/secao-favoritos` |
| RF-04, RF-19 | `ingestao/noticias` + `dominio/dedup` + `ui/home/feed` |
| RF-06, RF-09 | `config/clubes-2026.json` + `ui/selecao-clube` |
| RF-07, RF-08, RF-18 | `ingestao/futebol` + `dominio/campeonatos` + `ui/painel` |
| RF-10, RF-11 | `dominio/simulacao` + `ui/comparativo` + `ui/simulacao` |
| RF-13, RF-14 | `armazenamento/preferencias` + `ui/onboarding` |
| RF-15, RF-16, RF-17 | `pipeline` + `estado/status.json` + `ui/carimbo-frescor` |

---

## 2. Componentes e Fluxo de Dados

### 2.1 Mapa de componentes

**A. Pipeline de ingestão** (executa em CI agendado — ADR-002)

| Componente | Responsabilidade | Requisitos |
|---|---|---|
| `coletor-rss` | Busca cada feed do catálogo; respeita `frequenciaMaximaMin`; registra tentativa, horário e resultado | CA-15.1, CA-15.7, RNF-11 |
| `normalizador-item` | Decodifica, remove marcação, corta (título 180 / resumo 300), valida esquema, resolve data e fuso | CA-15.2, CA-04.3, CA-04.6, ADR-011 |
| `classificador-esportes` | Cascata de 4 níveis, sem IA | CA-15.4, ADR-008 |
| `deduplicador` | Trigramas + tokens fortes, janela de 12 h, fontes distintas | RN-16, ADR-009 |
| `avaliador-fontes` | Aplica RN-08 (instável/estável) e emite evento de severidade alta para o GE | CA-15.6, CA-01.2 |
| `retencao` | Descarta item com mais de 7 dias fora dos 30 de qualquer visão | CA-15.8, RN-07 |
| `coletor-futebol` | Orquestra os adaptadores por prioridade e janela de calendário; controla cota | CA-16.1, CA-16.4, ADR-006 |
| `adaptador-football-data` | Traduz o provedor para o domínio; mapeia clubes por id | CA-16.6, ADR-006 |
| `derivador-status` | Calcula status do campeonato (não iniciado / em andamento / eliminado / concluído / sem dados) e a fase | CA-07.1, CA-07.3, P8 |
| `derivador-paleta` | Deriva a paleta de identidade de cada clube a partir da cor oficial e **valida as razões de contraste**; falha de validação quebra o build | CA-06.1, RNF-03, ADR-017 |
| `gerador-snapshots` | Produz os arquivos públicos; publica só se o conteúdo mudou | RF-17 |

**B. Domínio compartilhado** (TypeScript puro, usado pelo pipeline e pela SPA)

`tipos` · `esportes` · `dedup` (escolha de representante) · `campeonatos` (ordenação
de CA-07.4) · `simulacao` (ADR-010) · `frescor` (cálculo de "atualizado há X" e do
limite de alerta de 2×).

Regra dura: **nada em `dominio/` importa rede, `localStorage`, React ou `Date.now`** —
o relógio entra sempre por parâmetro. É o que torna tudo testável por tabela.

**C. Aplicação Web**

`app/rotas` (ADR-003) · `dados/useSnapshot` (busca + cache + revalidação por
`versao.json`) · `armazenamento/preferencias` e `armazenamento/cenario` (ADR-005) ·
`ui/*` (uma pasta por tela do UX-SPEC) · `ui/componentes` (design system da Seção 3 do
UX-SPEC) · `telemetria` (ADR-012, removível por build).

### 2.2 Contrato público de dados (o "API contract" desta arquitetura)

Todos os caminhos são relativos à raiz publicada. Este é o contrato entre o pipeline e
a SPA — mudança aqui é mudança de contrato e exige nota no `TASK.md`.

| Arquivo | Conteúdo | Tamanho alvo (comprimido) | Cache |
|---|---|---|---|
| `/dados/versao.json` | `{ geradoEm, hashes: { noticias, futebol, catalogo, status } }` | < 1 KB | `no-cache` |
| `/dados/catalogo-fontes.json` | As 5 fontes com nome, esportes cobertos, `fixa`, estado de verificação | < 2 KB | curto |
| `/dados/noticias.json` | Itens normalizados dentro da retenção, com `grupoId`; **sem** itens `fora-do-recorte` | ≤ 60 KB | curto |
| `/dados/futebol/brasileirao.json` | Classificação + **todas** as partidas dos 20 clubes, todas as rodadas + zonas | ≤ 40 KB | curto |
| `/dados/futebol/clube/<slug>.json` | Campeonatos do clube, status por campeonato, resumo, partidas por campeonato | ≤ 25 KB cada | curto |
| `/dados/config/esportes.json` | Os 15 esportes, ordenados (RN-06) | < 2 KB | longo |
| `/dados/config/clubes-2026.json` | 20 clubes: nome, nome curto, sigla, cor base e **paleta de identidade derivada e validada** (ADR-017) | < 8 KB | longo |
| `/dados/config/campeonatos-2026.json` | Lista da temporada, janelas, formato, cobertura | < 4 KB | longo |
| `/dados/config/zonas-2026.json` | Faixas da tabela (RN-15); ausente = sem faixas (CA-18.2) | < 1 KB | longo |
| `/dados/ingestao/status.json` | Por fonte/provedor: última tentativa, resultado, contagem, `instavel`, `instavelDesde`, `pausadoPorCota` | < 4 KB | `no-cache` |

**Dimensionamento de `noticias.json`** (justifica o superconjunto): o feed mostra 30
itens das fontes **não bloqueadas**; se o usuário bloquear 4 das 5, ainda precisam
existir 30 itens da fonte restante. Regra: reter 7 dias com teto de **60 itens por
fonte** → ≤ 300 itens × ~350 bytes ≈ 105 KB brutos, ~30 KB comprimidos. Dentro do
orçamento de ADR-016.

**Revalidação**: a SPA busca `versao.json` na abertura e a cada 5 minutos enquanto a
aba está visível; se algum hash mudou, rebusca só o arquivo correspondente. Sem
sondagem cega, sem WebSocket.

### 2.3 Fluxo 1 — Ingestão de notícias (FL-06, RF-15)

```
a cada 30 min
  └─ para cada fonte do catálogo
       ├─ frequência máxima atingida? ──sim──> pula, registra tentativa (CA-15.7)
       ├─ GET do feed
       │    ├─ falhou ──> mantém itens; registra; avalia RN-08
       │    │              └─ é o GE? ──> evento de severidade alta (CA-15.6)
       │    └─ ok ──> para cada item
       │              ├─ link não http(s) ──> descarta e registra (ADR-011)
       │              ├─ já ingerido (hash do link canônico)? ──> ignora (CA-15.3)
       │              ├─ normaliza + sanitiza + resolve data (CA-04.6)
       │              ├─ classifica (ADR-008)
       │              │    └─ fora-do-recorte ──> guarda, não publica (CA-15.4/CA-04.8)
       │              └─ grava no estado
       └─ deduplica a janela de 12 h (ADR-009) → aplica retenção de 7 dias (CA-15.8)
```

### 2.4 Fluxo 2 — Ingestão de dados de futebol (FL-07, RF-16)

```
a cada 30 min
  ├─ cadência: há jogo de clube da Série A hoje? (≥55 min) : (≥5h30) ──não──> sai
  ├─ cota disponível? ──não──> pausadoPorCota = true; sinaliza (CA-16.4/CA-17.4)
  └─ para cada competição da temporada, na ordem de prioridade do ADR-002
       ├─ fora da janela de calendário ──> não consome requisição
       ├─ provedor = null ──> registra "sem cobertura" (CA-16.5 → CA-07.2)
       ├─ obtém classificação e partidas pelo adaptador
       ├─ inconsistente? ──> descarta, mantém o anterior, registra (CA-16.6)
       ├─ é o Brasileirão? ──> guarda TODAS as rodadas restantes de TODOS
       │                       os 20 clubes (CA-16.2 — insumo de RF-10/RF-11)
       └─ atualiza `ultimaAtualizacao` da competição (CA-16.1)
```

**Verificações mínimas de consistência (CA-16.6)**: pontos = 3V + E; jogos = V+E+D;
saldo = GP − GC; número de clubes na tabela igual ao configurado; nenhuma partida com
data anterior ao início da competição; nenhuma partida `finalizada` sem placar. Falha
em qualquer uma → descarta o lote da competição e mantém o anterior.

### 2.5 Fluxo 3 — Leitura na tela (FL-02, FL-03, FL-04)

```
abertura
  ├─ lê localStorage (síncrono) ──> decide onboarding × home ANTES do 1º pintar
  ├─ GET versao.json + noticias.json + catalogo-fontes.json + status.json
  ├─ aplica bloqueios ──> escolhe representante de cada grupo (ADR-009)
  ├─ ordena por data desc ──> corta em 30 (grupo conta 1 — CA-19.4)
  ├─ monta "Seus esportes": 10 itens mais recentes dos favoritos, nunca `geral`
  └─ carimbo de frescor por conjunto, independente (CA-17.5)

rota /time e adiante
  └─ GET clube/<slug>.json (+ brasileirao.json em /comparativo e /simulacao)
```

**Regra de frescor (RF-17)**: cada conjunto (notícias, futebol) exibe seu próprio
carimbo, calculado a partir de `geradoEm` do dado real. Passou de **2× o intervalo**
(60 min para notícias; 2 h em dia de jogo e 12 h fora dele, para futebol) → carimbo em
alerta com "pode estar desatualizado" (CA-17.2/CA-08.11). Nunca houve atualização →
"sem dados disponíveis no momento", sem erro técnico (CA-17.3).

### 2.6 Configuração por temporada (RN-04, RN-05, RN-15, RN-06)

Tudo que muda de ano é arquivo, não código: lista de clubes da Série A, lista de
campeonatos com janelas e formato, zonas da tabela, lista dos 15 esportes, catálogo de
fontes, léxico de classificação, limiar de deduplicação. A virada de temporada
(RN-12/CA-06.5) é detectada comparando a `temporada` corrente da configuração com a
que está gravada nas preferências locais.

---

## 3. Stack Tecnológica

| Camada | Escolha | Justificativa | Trade-off / alternativa considerada |
|---|---|---|---|
| Linguagem (toda) | **TypeScript 5.x**, modo estrito | Um só idioma para pipeline, domínio e SPA; o domínio é literalmente compartilhado, sem duplicação de regra | Mais cerimônia que JS puro; alternativa Python no pipeline foi recusada por obrigar a reimplementar as regras de domínio duas vezes |
| Execução do pipeline | **Node.js 22 LTS** | `fetch` nativo, `Intl` completo, suporte longo | Alternativa Deno/Bun: menos previsível em CI |
| Agendamento e publicação | **GitHub Actions (`schedule`) + hosting estático do mesmo fornecedor** | Custo zero, um único fornecedor, segredos no cofre do CI, histórico de ingestão de graça | Cron é melhor esforço (pode atrasar); Cloudflare Workers seria mais preciso e foi registrado como caminho de produção — ADR-002 |
| Parse de feed | **`fast-xml-parser`** | Trata RSS 2.0 e Atom, tolerante a XML mal formado (comum em feed de portal), sem dependências transitivas pesadas | Alternativa `xml2js` (abandonada) e parser próprio (custo alto para ganho nulo) |
| Validação de esquema | **Zod** | Uma definição gera tipo e validador; usada nas 3 fronteiras: feed, provedor, `localStorage` | Peso no bundle da SPA (~14 KB gz) — aceito, é o que impede dado inválido virar tela quebrada |
| UI | **React 18 + Vite** | Ecossistema, testes maduros, previsibilidade para execução paralela por múltiplas instâncias do Executor | Bundle base maior que Svelte — ADR-004 |
| Rotas | **`react-router-dom`**, modo configurável | Histórico de navegação real, foco por rota | ADR-003 |
| Estilo | **CSS Modules + tokens em CSS custom properties** | Auditoria direta contra o UX-SPEC; tema claro/escuro por troca de bloco de variáveis; zero runtime | Mais CSS à mão que Tailwind; consistência vira regra de `GUARDRAILS.md` |
| Datas e fuso | **`Intl` nativo** (`DateTimeFormat`, `RelativeTimeFormat`), fuso fixo `America/Sao_Paulo` | Zero bytes de biblioteca; pt-BR e "há 12 minutos" nativos | Sem `date-fns`/`dayjs`; aritmética de data fica manual no pipeline (contida em um módulo) |
| Provedor de futebol | **football-data.org** (plano gratuito) | Único gratuito com **termos públicos** e cobertura verificada do Brasileirão Série A: tabela + calendário completo | Não cobre Copa do Brasil, continentais nem estaduais → RT-02 e spike SP-01 |
| Fontes de notícia | **RSS/Atom oficiais**, catálogo em configuração | RN-01/RN-19; substituição sem código (I-25) | 2 das 5 não verificáveis neste ambiente — ADR-007, ADR-013 |
| Testes | **Vitest + Testing Library + axe-core** | Mesmo executor para domínio, pipeline e UI; acessibilidade automatizada desde o começo | E2E completo fora de escopo do protótipo (ADR-015) |
| Telemetria | Serviço sem cookie, plano gratuito não comercial; **desligável por build** | RNF-07; M1-M4 | Dependência de terceiro em runtime; plano a confirmar — SP-04 (ADR-012) |
| Qualidade de código | ESLint + Prettier + `tsc --noEmit` no CI | Portão objetivo para o Validador | — |

**Bibliotecas de runtime autorizadas** (lista fechada; qualquer inclusão passa por
`GUARDRAILS.md`): pipeline — `fast-xml-parser`, `zod`; SPA — `react`, `react-dom`,
`react-router-dom`, `zod`.

### 3.1 Catálogo de fontes — estado da verificação em 2026-09-05

| # | Fonte | Estado | Evidência desta rodada |
|---|---|---|---|
| 1 | **GE — ge.globo** (fixa, RN-03) | **Pendente — P-GE** | Domínio bloqueado pela ferramenta deste ambiente. Busca na web só devolveu diretórios de terceiros e uma URL em formato legado, sem data — **não** tratado como verificação. Ver ADR-013 |
| 2 | ESPN Brasil | **Verificada (reverificada por mim)** | `https://www.espn.com.br/espn/rss/news` → RSS 2.0 válido, canal "www.espn.com.br - TOP", 21 itens, mais recente 2026-09-05, 14/21 com resumo |
| 3 | Gazeta Esportiva | Verificada (BA, 2026-09-05) | Página oficial de RSS ativa, com feeds por esporte — usados como feeds fixados (ADR-008) |
| 4 | Terra Esportes | Verificada (BA, 2026-09-05) | RSS 2.0, 10 itens, todos com resumo |
| 5 | **UOL Esporte** (candidata) | **Não verificável neste ambiente** | `rss.uol.com.br` e `www3.uol.com.br` bloqueados pela ferramenta. Um caminho de "mídia indoor" encontrado em busca **não** é substituto: teria termos próprios |
| S1 | Folha Esporte (substituto 1) | **Não verificável neste ambiente** | `feeds.folha.uol.com.br` bloqueado pela ferramenta |
| S2 | Placar (substituto 2) | **HTTP 403 reproduzido** | Bloqueio a acesso automatizado confirmado |

**Conclusão honesta**: 3 das 5 fontes estão verificadas por ferramenta. O fechamento
de P1 é a execução do script `verificar-catalogo` (ADR-007) a partir de uma rede sem o
bloqueio deste ambiente — é uma ação operacional, não uma nova rodada de agente. Até
lá, a 5ª fonte fica no catálogo com estado de verificação `pendente` e a interface a
mostra como "instável desde \<data\>" (CA-01.2), sem sumir e sem substituição
silenciosa.

### 3.2 Parâmetros "a confirmar" do PRD-TECNICO, agora fixados

| Parâmetro | Origem | Valor fixado | Onde |
|---|---|---|---|
| Tamanho do resumo | CA-04.3 | **300 caracteres**, corte em fronteira de palavra, `…` | ADR-011 |
| Itens da seção de favoritos | CA-05.1 / I-02 | **10** | UX-SPEC T-02 |
| Retenção de itens | RN-07 | **7 dias**, teto de 60 itens por fonte | §2.2 |
| Intervalo de notícias | RNF-06 | **30 min** | ADR-002 |
| Intervalo de futebol | RNF-06 | **~1 h** em dia de jogo de clube da Série A; **~6 h** nos demais | ADR-002 |
| Limite de alerta de frescor | RN-09 | **2×** o intervalo | §2.5 |
| Fonte instável | RN-08 | falhas consecutivas por > **6 h** (12 tentativas) **ou** sem item novo por > **72 h** | ADR-007 |
| Limiar de deduplicação | RN-16 | Dice de trigramas ≥ **0,82** **e** ≥ 2 tokens fortes em comum, janela ≤ **12 h**, fontes distintas | ADR-009 |
| Nível WCAG | RNF-03 / I-19 | **WCAG 2.2 AA** | ADR-014 |
| Navegadores | RNF-01 | Chrome Android e Safari iOS 16.4+ como primários; ver matriz | ADR-016 |
| Priorização dentro da cota | CA-16.4 | Brasileirão → continentais → Copa do Brasil → estaduais/regionais → Supercopa, restrito à janela de calendário | ADR-002 |
| Reflexo do palpite | RNF-14 | orçamento **< 100 ms** (requisito: < 1 s) | ADR-016 |

---

## 4. Decisões Arquiteturais — índice de ADRs

ADRs são imutáveis. Mudança de decisão gera novo ADR com `Superseded by` no anterior.

| ADR | Título | Status | Requisitos-chave |
|---|---|---|---|
| [001](adr/001-arquitetura-de-dados-pre-computados-e-publicacao-estatica.md) | Dados pré-computados e publicação estática (sem backend em runtime) | Aceito | RNF-05, RNF-10, RNF-12, RNF-13 |
| [002](adr/002-ingestao-periodica-em-ci-agendado-com-estado-versionado.md) | Ingestão periódica em CI agendado, com estado versionado em branch de dados | Aceito | RF-15, RF-16, RNF-06, RNF-11, CA-16.4 |
| [003](adr/003-aplicacao-de-pagina-unica-com-rotas-no-cliente.md) | Aplicação de página única com rotas no cliente (refina I-03) | Aceito | RNF-01, RAN-16, I-03 |
| [004](adr/004-stack-de-frontend-react-typescript-vite.md) | Stack de frontend: React + TypeScript + Vite, CSS Modules com tokens | Aceito | RNF-01, RNF-04, M3 |
| [005](adr/005-persistencia-local-em-localstorage-com-esquema-versionado.md) | Persistência local em `localStorage`, esquema versionado e modo memória | Aceito | RF-13, CA-11.9, RN-12 |
| [006](adr/006-camada-de-adaptacao-por-provedor-de-futebol.md) | Camada de adaptação por provedor de futebol, com mapa de cobertura | Aceito | RF-07, RF-16, RN-05, RN-13 |
| [007](adr/007-catalogo-de-fontes-como-configuracao-verificada.md) | Catálogo de fontes como configuração verificada, com estado em runtime | Aceito | RF-01, RN-08, RN-19, I-25 |
| [008](adr/008-classificacao-de-esportes-por-regras-sem-ia.md) | Classificação de notícia em esporte por regras determinísticas (sem IA) | Aceito | CA-15.4, RN-06, RN-18 |
| [009](adr/009-deduplicacao-deterministica-por-similaridade-de-titulo.md) | Deduplicação determinística por similaridade de trigramas | Aceito | RF-19, RN-16 |
| [010](adr/010-motor-de-simulacao-puro-e-deterministico-no-cliente.md) | Motor de simulação puro e determinístico, no cliente | Aceito | RF-10, RF-11, RN-14, RNF-14 |
| [011](adr/011-sanitizacao-de-conteudo-de-terceiros-e-politica-de-seguranca.md) | Sanitização de conteúdo de terceiros e política de segurança de conteúdo | Aceito | RN-02, RN-17, RNF-08, I-14 |
| [012](adr/012-telemetria-minima-anonima-com-identificador-local.md) | Telemetria mínima anônima, com identificador local e desligável | Aceito | RNF-07, M1-M4 |
| [013](adr/013-comportamento-do-produto-sem-forma-legitima-de-consumir-o-ge.md) | Comportamento do produto caso o GE não seja consumível legitimamente | Aceito | RN-03, RN-01, P-GE |
| [014](adr/014-nivel-de-acessibilidade-alvo-wcag-2-2-aa.md) | Nível de acessibilidade alvo: WCAG 2.2 AA | Aceito | RNF-03, I-19 |
| [015](adr/015-perfil-de-prototipo-e-gatilhos-de-promocao-a-produto.md) | Perfil de protótipo e gatilhos de promoção a produto | Aceito | RNF-07 a RNF-15, RAN-20 |
| [016](adr/016-matriz-de-navegadores-e-orcamento-de-desempenho.md) | Matriz de navegadores e orçamento de desempenho | Aceito | RNF-01, RNF-04, M3 |
| [017](adr/017-cor-de-identidade-derivada-do-clube-com-contraste-pre-computado.md) | Cor de identidade derivada do clube, com paleta acessível pré-computada no pipeline | Aceito | RNF-03, CA-06.1 |

**Nota da rodada 2 do Loop B (2026-09-05)**: o stakeholder escolheu a direção visual
"Camisa", em que a identidade do clube governa a tela. Isso tornou a cor do clube uma
**entrada de contraste**, não mais um detalhe cosmético, e gerou o ADR-017 e o ajuste
do modelo `Clube` na Seção 5.2. Nenhum ADR anterior foi substituído — a justificativa
está no próprio ADR-017.

**Lacunas de detalhe resolvidas por mim, registradas para auditoria** (nenhuma muda
requisito):

1. **Ordenação de grupo deduplicado**: o grupo ocupa a posição da data do
   representante (o item mais antigo entre as fontes não bloqueadas), para que a ordem
   da tela nunca contradiga a data exibida — ADR-009.
2. **Snapshot público não inclui itens `fora-do-recorte`**: eles existem no estado
   interno (CA-15.4 pede armazenar) mas não trafegam para o navegador (CA-04.8 proíbe
   exibir) — §2.2.
3. **Chave de escopo do cenário** = `temporada:time:rivais-ordenados`, o que torna
   CA-06.3 e CA-09.4 automáticos em vez de limpeza manual — ADR-005.
4. **Derivação de fase/eliminação** quando o provedor não a expõe, com queda para
   "sem dados" em caso de ambiguidade — ADR-006, premissa P8.

---

## 5. Modelo de Dados de Alto Nível

Não há banco de dados. O "esquema" são os tipos do domínio, materializados em JSON e
validados por Zod nas fronteiras. Datas sempre em ISO 8601 com deslocamento `-03:00`.

### 5.1 Notícias

```ts
type EsporteId =
  | 'futebol' | 'volei' | 'automobilismo' | 'basquete' | 'tenis'
  | 'volei-praia' | 'natacao' | 'mma' | 'ginastica' | 'surfe'
  | 'skate' | 'judo' | 'atletismo' | 'futsal' | 'futebol-americano';

interface Fonte {
  id: string; nome: string; fixa: boolean;          // fixa: só o GE (RN-03)
  esportesCobertos: EsporteId[];
  termos: { url: string | null; verificadoEm: string | null; uso: 'nao-comercial' | 'livre' };
  frequenciaMaximaMin: number;                      // CA-15.7
  feeds: { id: string; url: string; formato: 'rss' | 'atom'; esporteFixado: EsporteId | null }[];
  verificacao: { estado: 'verificada' | 'pendente' | 'falhou'; em: string | null };
}

interface ItemNoticia {
  id: string;              // sha256 do link canônico  (CA-15.3)
  fonteId: string; feedId: string;
  titulo: string;          // texto puro, ≤ 180
  resumo: string | null;   // texto puro, ≤ 300, com '…' se truncado (CA-04.3)
  link: string;            // http(s) absoluto, validado (ADR-011)
  publicadoEm: string;     // ISO -03:00
  dataEstimada: boolean;   // true → rótulo "horário estimado" (CA-04.6)
  esporte: EsporteId | 'geral' | 'fora-do-recorte';
  origemClassificacao: 'feed-fixado' | 'categoria' | 'lexico' | 'nao-classificado';
  grupoId: string | null;  // deduplicação (ADR-009)
  ingeridoEm: string;
}
```

Invariantes: `esporte = 'geral'` nunca entra na seção de favoritos (CA-04.7);
`esporte = 'fora-do-recorte'` nunca sai do estado interno (CA-04.8); `link` sempre
`http(s)`; item sem título ou sem link é descartado na ingestão (FL-06).

### 5.2 Futebol

```ts
interface Clube {
  id: string;              // slug estável: 'palmeiras', 'atletico-mg'
  nome: string; nomeCurto: string; sigla: string;   // 'PAL', 'CAM'
  corBase: string;         // cor oficial do clube — ENTRADA da derivação
  paleta: PaletaClube;     // DERIVADA e validada no pipeline (ADR-017)
  paletaManual?: Partial<PaletaClube>;              // override, sujeito à mesma validação
  idsProvedor: Record<string, string | number>;     // casamento por id, nunca por nome
}

// ADR-017: a cor do clube deixou de ser cosmética e virou entrada de contraste.
// Derivada e verificada na ingestão; o navegador só aplica como custom properties.
interface PaletaClube {
  acromatico: boolean;             // clube preto e branco (Corinthians, Botafogo…)
  identidade: string;              // preenchimento de superfície grande (cor oficial)
  faixaB: string;                  // 2º stop da listra diagonal
  identidadeTexto: string;         // ≥ 4,5:1 sobre identidade E sobre faixaB
  acento: string;                  // ≥ 4,5:1 vs fundo e superfície claros
  acentoSobreEscuro: string;       // ≥ 4,5:1 vs navegação preta e fundo escuro
  suave: string; suaveEscuro: string;                // ≥ 4,5:1 com a tinta
  identidadeEscuro: string; faixaBEscuro: string; identidadeTextoEscuro: string;
}

interface Competicao {
  id: string;              // 'brasileirao-serie-a', 'paulista'
  nome: string; temporada: number;
  formato: 'pontos-corridos' | 'grupos' | 'mata-mata' | 'misto';
  janela: { inicio: string; fim: string };          // controla consumo de cota
  provedor: string | null;                          // null = sem cobertura (CA-07.2)
  ultimaAtualizacao: string | null;
}

interface ParticipacaoClube {
  competicaoId: string; clubeId: string;
  status: 'nao-iniciado' | 'em-andamento' | 'eliminado' | 'concluido' | 'sem-dados';
  faseAtual: string | null;      // 'Fase de grupos', 'Oitavas'
  resultadoFinal: string | null; // 'Campeão', 'Vice', 'Eliminado nas quartas'
  resumo: { jogos; v; e; d; gp; gc; sg; pontos; aproveitamento; posicao: number | null } | null;
}

interface Partida {
  id: string; competicaoId: string;
  rodada: number | null; fase: string | null;
  mandanteId: string; visitanteId: string;
  dataHora: string | null;       // null → "data a definir" (CA-10.4)
  horarioDefinido: boolean;      // false → "horário a definir" (CA-08.8)
  estadio: string | null;
  status: 'agendada' | 'aguardando-resultado' | 'finalizada' | 'adiada' | 'cancelada';
  placar: { mandante: number; visitante: number } | null;
}

interface LinhaClassificacao {
  competicaoId: string; grupo: string | null; posicao: number; clubeId: string;
  pontos; jogos; v; e; d; gp; gc; sg; aproveitamento: number;   // pontos ÷ (jogos×3), % (I-13)
  ultimosCinco: ('V' | 'E' | 'D')[];                            // CA-10.1
}

interface Zona { de: number; ate: number; rotulo: string; token: string }  // RN-15/RF-18
```

Invariantes: partida encerrada sem resultado ingerido fica em "próximas" com
`aguardando-resultado` (CA-08.10); `provedor: null` produz "sem dados" e **nunca**
omite o campeonato (CA-07.2); a ordenação de campeonatos de CA-07.4 é
`em-andamento` (pela data do próximo jogo) → `nao-iniciado` → `eliminado` →
`concluido` → `sem-dados`.

### 5.3 Estado local (nunca sai do dispositivo)

```ts
interface Preferencias {
  versaoEsquema: 1; temporada: number;
  favoritos: EsporteId[];        // 0 a 3 (RN-06)
  fontesBloqueadas: string[];    // nunca contém a fonte fixa (RN-03)
  timeId: string | null;
  rivais: string[];              // 0 a 2, sempre ≠ timeId (RN-11)
  atualizadoEm: string;
}

interface Cenario {
  versaoEsquema: 1;
  escopo: string;                            // 'temporada:time:rivais-ordenados'
  palpites: Record<string, 'vitoria' | 'empate' | 'derrota'>;  // por id de partida
  partidasTravadasVistas: string[];          // base do aviso de CA-11.6
}
```

Invariantes: nenhum dado pessoal (CA-13.5); referência inválida é descartada
individualmente com aviso (CA-13.4); time fora da lista da temporada dispara CA-06.5
(RN-12) descartando rivais e cenário.

### 5.4 Observabilidade da ingestão (`status.json`, RNF-11)

Por fonte e por provedor: `ultimaTentativa`, `resultado` (`ok` | `falha` | `pulado`),
`itensNovos`, `falhasConsecutivas`, `instavel`, `instavelDesde`, `severidade`
(`alta` só para o GE), e globalmente `geradoEm`, `pausadoPorCota`,
`distribuicaoClassificacao`, `gruposFormados`. É o único mecanismo de diagnóstico do
protótipo, e alimenta diretamente os estados visíveis de RF-17.

---

## 6. Riscos Técnicos, Gargalos e Dívida Aceita

### 6.1 Riscos

| # | Risco | Sev. | Impacto | Mitigação nesta arquitetura | Gatilho de escalonamento |
|---|---|---|---|---|---|
| **RT-01** | **P-GE**: não foi possível verificar feed oficial nem termos do GE, que é fonte obrigatória e não bloqueável (RN-03) | **Alta** | Se não houver forma legítima, RN-03 é insatisfazível como está e o produto perde a fonte que o stakeholder considera indispensável — pode afetar M1 | Produto opera degradado e honesto: GE listado como "fonte fixa" e "instável desde \<data\>", banner no cabeçalho, evento de severidade alta, feed servido pelas demais (ADR-013). Nenhuma solução por scraping ou API sem termos | **Reabre o Gate 1** restrito a este ponto (gatilho já registrado no `CTO-REVIEW.md`). Decisão do stakeholder entre relaxar RN-03, trocar a fonte fixa ou negociar com o publicador |
| **RT-02** | **Cobertura de campeonatos**: só o Brasileirão Série A tem fonte gratuita com termos públicos validada. Estaduais, regionais, Copa do Brasil e continentais não têm | **Alta** | RF-07/RF-08 ficam **parcialmente atendidos**: entre janeiro e junho, boa parte dos cards do painel pode exibir "sem dados". O painel do time — metade do produto — nasce incompleto | Mapa de cobertura em configuração; "sem dados" + "cobertura indisponível nesta versão", nunca omissão (CA-07.2); adaptadores permitem somar provedor sem redesenho (ADR-006) | **Spike SP-01** no Loop C. Se a única saída for provedor pago, é **consulta obrigatória ao stakeholder** (RN-13) — decisão de negócio, não do Coordenador (R5) |
| **RT-03** | **Fonte de notícia some ou muda** — evidência direta: Lance 410 Gone | Média | Perda silenciosa de cobertura | Catálogo em configuração com verificação datada; estado "instável" (RN-08) visível na tela; script `verificar-catalogo`; substitutos ordenados (ADR-007) | Se 2 das 5 caírem simultaneamente, sinalizar ao Gestor |
| **RT-04** | **5ª fonte não verificável**: UOL, Folha e Placar são inacessíveis a partir deste ambiente | Média | Catálogo entra em desenvolvimento com 3 de 5 fontes comprovadas | Estado de verificação explícito; produto funciona com as verificadas; troca é configuração (I-25) | Execução do `verificar-catalogo` em rede aberta fecha P1 |
| **RT-05** | **Classificação por regras erra o esporte** (sem IA por decisão) | Média | Item errado na seção de favoritos degrada a confiança na personalização (M2) | Cascata com feeds mono-esporte fixados antes de qualquer inferência; queda para `geral`, que nunca entra na seção de favoritos; taxa de `geral` medida por execução (ADR-008) | Taxa de `geral` > 35% → revisar léxico/feeds |
| **RT-06** | **Fase e eliminação em mata-mata** (P8): provedor pode não expor | Média | Status errado no painel é pior que status ausente | Derivação a partir das partidas; ambiguidade → "sem dados" (ADR-006) | Parte do SP-01 |
| **RT-07** | **Agendador de CI é melhor esforço**: execução pode atrasar ou ser pulada | Média | Frescor pior que o alvo em horário de pico | Carimbo sempre a partir do dado real; alerta de 2× absorve uma execução perdida; publicação só quando há mudança | Atraso recorrente > 2× → migrar para cron de borda (ADR-002) |
| **RT-08** | **Cota do provedor** (R2) | Baixa hoje, Média depois | Com football-data.org o custo é de 2 requisições por execução — folga enorme. O risco só aparece com um segundo provedor: no plano gratuito de 100 req/dia da API-Football, 8 competições × 2 chamadas × 6 execuções ≈ 96/dia, no limite | Prioridade fixa + janela de calendário + suspensão com aviso na tela (CA-16.4) | O SP-01 precisa medir **cota**, não só cobertura |
| **RT-09** | **`localStorage` indisponível** (modo privado, política de armazenamento) | Média | Preferências e cenário não persistem | Modo memória com aviso explícito (CA-11.9/CA-13.3) | — |
| **RT-10** | **Mudança de formato de campeonato no meio da temporada** (CA-08.5) | Baixa | Tabela de grupo precisa continuar acessível após virar mata-mata | `formato: 'misto'` e retenção da tabela final do grupo | — |
| **RT-11** | **Injeção via conteúdo de terceiro** (XSS pelo feed) | Média (probabilidade baixa, impacto alto) | Execução de script na origem do produto | Sanitização na ingestão + renderização como texto + CSP + proibição de `dangerouslySetInnerHTML` (ADR-011) | Qualquer achado do Validador é bloqueante |
| **RT-12** | **Licenciamento** (R1/R4): termos das fontes não foram lidos por ninguém com competência jurídica | Média no protótipo / **Alta se virar produto** | Exposição jurídica | Uso não comercial, só título+resumo+link, sem imagem, sem texto integral, atribuição sempre visível (RN-02/RN-17) | **Revisão jurídica obrigatória antes de qualquer lançamento** — dono é o stakeholder, fora do roster |
| **RT-13** | **Sem `frame-ancestors`** no hosting estático | Baixa | Produto pode ser embutido em iframe de terceiro | Não há sessão nem ação de estado a sequestrar; débito registrado | Migrar de hosting ou promover a produto |
| **RT-14** | **Telemetria depende de terceiro e de plano gratuito não confirmado** | Baixa | Sem telemetria, M1-M4 ficam inverificáveis | Interruptor de build; duas opções gratuitas mapeadas | **Spike SP-04** |

### 6.2 Gargalos de desempenho e escalabilidade

Na escala de protótipo (dezenas de usuários), **não há gargalo de servidor**: o
conteúdo é estático em CDN e a carga não cresce com usuários. Os limites reais são
outros três, todos já orçados: tamanho do snapshot de notícias (§2.2), tamanho do
bundle inicial (ADR-016) e a cota do provedor de futebol (RT-08). A escalabilidade
horizontal é a do CDN — de graça.

### 6.3 Dívida técnica aceita conscientemente

| Dívida | Por que é aceita agora | Custo de pagar depois |
|---|---|---|
| Sem backend, sem API, sem banco | Não existe estado por usuário no servidor (ADR-001) | Alto — é um projeto próprio se vier conta/sincronização |
| Sem monitoramento nem alerta | RNF-11 nível protótipo; falha aparece na tela como fonte instável | Baixo |
| Sem E2E, sem teste de carga | RNF-12/RNF-13 relaxados | Médio |
| Sem `frame-ancestors` / cabeçalhos de segurança | Hosting estático não os expõe; sem sessão a proteger (RT-13) | Baixo — troca de hosting |
| Sem escudos oficiais de clube | Direito de marca não revisado (R1) | Baixo — é troca de componente de avatar |
| Sem cache offline / PWA | Não pedido; evita bugs de cache obsoleto | Baixo |
| Léxico de classificação mantido à mão | Alternativa exigiria IA, proibida (Q8) | Médio |

### 6.4 Decisões pendentes do stakeholder (não decididas aqui)

| # | Decisão | Por que não é minha | Bloqueia |
|---|---|---|---|
| **D1** | Provedor **pago** para estaduais, regionais, Copa do Brasil e continentais, caso o SP-01 conclua que não existe alternativa gratuita elegível | RN-13: pago exige consulta e aprovação explícita do stakeholder | Completude de RF-07/RF-08. Não bloqueia o Loop C: o painel funciona com "sem dados" |
| **D2** | Resolução de **P-GE** e, se não houver forma legítima, escolha entre relaxar RN-03, trocar a fonte fixa ou negociar com o publicador | Regra de negócio inegociável do stakeholder; reabre o Gate 1 | RF-01 entrar em desenvolvimento (dependência já declarada em PRD-TECNICO §5.1) |
| **D3** | **Revisão jurídica** dos termos das 5 fontes e do provedor (R1/R4) | Fora do roster técnico | Qualquer decisão de lançamento comercial |
| **D4** | Confirmação das **posições 12-15** da lista de esportes (P3) | Decisão de produto | Nada: a lista é configuração (`esportes.json`) e trocar é editar um arquivo |
| **D5** | **Escudos oficiais dos clubes** na interface: hoje decidi por avatar com iniciais e cor, por risco de marca e por peso de rede. Se o stakeholder quiser escudos, é decisão dele, com licenciamento | Direito de imagem/marca | Nada — troca de um componente |

### 6.5 Candidatos a spike técnico no Loop C

| Spike | Pergunta a responder | Por que é spike |
|---|---|---|
| **SP-01** | Existe provedor **gratuito, com termos públicos**, que cubra estaduais, regionais, Copa do Brasil e continentais com tabela e calendário, dentro de uma cota viável? Testar TheSportsDB (tem a liga Paulista, id 5767, com resultados de 2026; classificação **não** confirmada) e API-Football com conta real (página de cobertura devolveu 403 à ferramenta). Medir **cobertura e cota** | Incerteza alta, resposta exige conta real e medição; determina se RT-02 vira D1 |
| **SP-02** | O provedor identifica fase e eliminação em mata-mata, ou é preciso derivar das partidas? (P8) | Depende de dado real do provedor; muda o `derivador-status` |
| **SP-03** | Execução do `verificar-catalogo` em rede aberta: UOL, Folha, Placar e **GE** — feeds e termos | Fecha P1 e P-GE; é operacional, mas precisa de resultado antes de configurar RF-01 |
| **SP-04** | Ferramenta de telemetria: plano gratuito, termos, e se cobre os 5 eventos sem cookie | Determina se M1-M4 são medíveis |
| **SP-05** | Calibrar o limiar de deduplicação com uma amostra real de 24 h dos feeds verificados | Limiar de 0,82 é fundamentado, mas só dado real confirma; erro para o lado seguro já está garantido |

---

## 7. Requisitos de Segurança

Requisitos de **arquitetura**. A análise tática (SAST, dependências, segredos, OWASP,
hardening) é do Validador, no chapéu DevSecOps.

### 7.1 Superfície de ataque

O que **não existe** e, portanto, não é vetor: banco de dados, endpoint mutável,
sessão, cookie, upload, conteúdo gerado por usuário, integração de pagamento,
administração. A superfície real é: (a) conteúdo de terceiro renderizado no
navegador, (b) o segredo do provedor de futebol no CI, (c) o pipeline de publicação,
(d) o armazenamento local.

### 7.2 Autenticação e autorização

| Item | Requisito |
|---|---|
| Usuário final | **Não há autenticação** — por decisão de produto (Q6). Não existe recurso protegido por usuário; toda preferência é local e sem valor para terceiros |
| Pipeline → provedor de futebol | Token em cofre de segredos do CI, injetado só como variável de ambiente do job. **Proibido** em código, em arquivo de configuração ou em qualquer artefato publicado |
| Publicação | Credencial do CI com escopo mínimo: escrever na branch de dados e publicar o site. Nada além |
| Autorização | Não aplicável no cliente: não há operação privilegiada. O único controle de acesso é o do repositório |

**Verificação obrigatória (bloqueante)**: varredura do diretório publicado por padrões
de segredo (`token`, `api_key`, `Bearer`, chaves de 32+ caracteres) a cada
publicação. Segredo encontrado = falha da construção, sem exceção.

### 7.3 Criptografia e transporte

- **HTTPS obrigatório** em tudo: fetch dos feeds, chamadas ao provedor, entrega ao
  navegador. Feed que só exista em HTTP puro é **inelegível** — vai como regra em
  `GUARDRAILS.md`.
- **Sem dado sensível em repouso**: não há dado pessoal para criptografar (RNF-07). O
  `localStorage` guarda apenas identificadores de configuração e um identificador
  anônimo — criptografá-los daria falsa sensação de segurança, já que a chave estaria
  no mesmo dispositivo.
- **Integridade do dado publicado**: `versao.json` traz o hash de cada snapshot; a SPA
  usa o hash para invalidar cache, o que também detecta publicação parcial.

### 7.4 Validação de entrada e conteúdo de terceiros — o requisito central

1. **Toda** entrada externa (item de feed, resposta de provedor) passa por validação
   de esquema (Zod) antes de entrar no domínio. Falha → descarte com registro, nunca
   correção heurística.
2. Título e resumo têm **toda** marcação removida na ingestão; o cliente renderiza
   como nó de texto. `dangerouslySetInnerHTML` é **proibido no projeto inteiro**
   (regra de `GUARDRAILS.md`, verificável por busca).
3. `link` só é aceito com esquema `http`/`https`, absoluto; qualquer outro descarta o
   item. Revalidado também no cliente antes de renderizar o `href`.
4. Links externos sempre com `rel="noopener noreferrer"`.
5. **Política de Segurança de Conteúdo** por `<meta>` (ADR-011), com `connect-src`
   restrito a `'self'` e ao host de telemetria (ou só `'self'` com telemetria
   desligada).
6. **Sem imagem de terceiro** (I-14) e **sem texto integral** (RN-02) — implementado
   no pipeline, não confiado à disciplina da interface.

### 7.5 Isolamento

| Fronteira | Isolamento |
|---|---|
| Ingestão × apresentação | Processos e momentos distintos; a SPA não tem como disparar ingestão nem alcançar credencial |
| Segredo × artefato publicado | Segredo só existe no ambiente do job; verificação de vazamento bloqueia a publicação |
| Domínio × provedores | Adaptadores; nenhum tipo de terceiro atravessa para o domínio ou para o snapshot (ADR-006) |
| Dado do usuário × rede | Preferências e cenário **nunca** são transmitidos. A telemetria envia apenas os 5 eventos da tabela do ADR-012, sem conteúdo |
| Entre usuários | Não existe dado compartilhado entre usuários — não há o que vazar de um para outro |

### 7.6 Privacidade e conformidade

- Sem conta, sem dado pessoal, sem cookie, sem rastreio entre sites (RNF-07).
- Identificador anônimo local, aleatório, reiniciável e desligável (ADR-012).
- Uso **não comercial** enquanto protótipo (RNF-08); qualquer mudança reabre R1/R4 e
  exige revisão jurídica **antes** (ADR-015).
- Atribuição de fonte sempre visível (RN-17); atribuição do provedor junto ao carimbo
  de frescor quando os termos exigirem (CA-17.4).
- Frequência máxima declarada por cada fonte é respeitada por configuração (CA-15.7) —
  é requisito de conformidade com os termos, não de desempenho.

### 7.7 Cadeia de suprimentos

- Lista fechada de dependências de runtime (§3); inclusão exige `GUARDRAILS.md`.
- `package-lock.json` versionado; instalação determinística no CI.
- Auditoria de dependências a cada construção; vulnerabilidade alta ou crítica em
  dependência de runtime bloqueia a publicação.
- Ações de CI fixadas por versão, nunca por referência móvel.

### 7.8 O que o Validador deve verificar (entrada para `SECURITY-REVIEW.md`)

1. Nenhum segredo no diretório publicado.
2. Nenhuma ocorrência de `dangerouslySetInnerHTML` ou de HTML de terceiro renderizado.
3. Todo `href` externo com esquema validado e `rel` correto.
4. CSP presente e efetiva; `connect-src` coerente com o estado da telemetria.
5. Validação de esquema presente nas três fronteiras (feed, provedor, `localStorage`).
6. Nenhum dado de preferência trafegando para fora do dispositivo.
7. Nenhuma chamada a terceiro a partir do navegador além do beacon de telemetria.
8. Auditoria de dependências limpa nas dependências de runtime.
9. Nenhum acesso a fonte fora do catálogo configurado, e nenhum acesso por scraping.

---

**Entrega**: `SDD.md` + 16 ADRs em `.md/adr/`. O `UX-SPEC.md` foi produzido em seguida,
na mesma sequência interna, e respeita as restrições deste documento (ver Seção 7 do
`UX-SPEC.md`). O `TASK.md` e o `GUARDRAILS.md` são o Loop C, após aprovação do usuário.
