# GUARDRAILS.md — SportsLM

**Status**: rascunho inicial — Loop C (2026-09-05), aguardando aprovação do Gestor
(chapéu CTO), conforme PIPELINE-CONVENTIONS.md §5. Depois de aprovado, vale para
todos os agentes.
**Autor**: Coordenador (chapéu Tech Lead, skill `guardrails-drafting`)
**Base**: `.md/CTO-REVIEW.md` (Gate 1 + adendos), `.md/SDD.md` (Seções 3, 6, 7) e os
17 ADRs em `.md/adr/`.

Regras inegociáveis do projeto. Mudança aqui exige justificativa e, se mudar uma
decisão arquitetural já tomada, um novo ADR.

---

## 1. Escopo e natureza do produto

- **Protótipo, sem SLA, sem prazo, uso não-comercial** (RNF-15, ADR-015). Qualquer
  decisão de promover a produto reabre RNF-07/08/11/12/13 e a ressalva R1/R4 do
  `CTO-REVIEW.md` **antes** da mudança, não depois.
- **Sem funcionalidade de IA/LLM** (Q8, RN-18). Nenhuma tarefa introduz modelo de
  linguagem, resumo gerado ou ranking por comportamento.
- **Sem conta, sem login, sem dado pessoal** (Q6, RF-13, RNF-07). Nenhum estado por
  usuário é calculado no servidor.

## 2. Dependências e bibliotecas

- **Bibliotecas de runtime — lista fechada** (SDD §3):
  - Pipeline: `fast-xml-parser`, `zod`.
  - SPA: `react`, `react-dom`, `react-router-dom`, `zod`.
  - Qualquer inclusão de dependência de runtime fora desta lista exige atualização
    deste arquivo, com justificativa, **antes** do merge.
- **`package-lock.json` versionado**; instalação determinística no CI (SDD §7.7).
- **Ações de CI fixadas por versão**, nunca por referência móvel (`@latest`,
  branch) (SDD §7.7).
- Auditoria de dependências a cada build; vulnerabilidade alta/crítica em
  dependência de runtime **bloqueia** a publicação.

## 3. Dados de terceiros — fontes e provedores

- **Só fonte/provedor gratuito** (RN-13). Qualquer opção paga exige consulta e
  aprovação explícita do stakeholder **antes** da adoção — nunca decisão do
  Executor, do Validador nem do Coordenador sozinho.
- **Só feed oficial (RSS/Atom) ou API com termos públicos** (RN-01). Proibido:
  scraping de HTML, API não documentada, "engenharia reversa" de endpoint.
- **Catálogo de notícias tem exatamente 7 fontes** (ampliado de 5 por decisão
  direta do stakeholder, 2026-09-08 — `.md/BLOCKERS.md` Bloqueio 011), com o GE
  sempre presente e não-bloqueável (RN-03, RN-19). Adicionar/trocar fonte é
  alteração de configuração (`config/fontes.json`) + schema (`.length(N)` em
  `config/fontes.schema.ts`/`pipeline/publicacao/gerador-snapshots.ts`), nunca
  mudança de lógica de coleta.
- **Nunca texto integral nem imagem de terceiro** (RN-02, I-14). Só título, fonte,
  esporte, data/hora, resumo curto (≤ 300 caracteres) e link para o original.
- **Atribuição de fonte sempre visível** (RN-17); respeitar `frequenciaMaximaMin`
  declarada por fonte (CA-15.7) — é requisito de conformidade com os termos, não
  de desempenho, e não é ajustável por conveniência de implementação.
- **HTTPS obrigatório** em toda busca externa; feed só em HTTP puro é inelegível
  para o catálogo (SDD §7.3).

## 4. Segurança de conteúdo

- **`dangerouslySetInnerHTML` é proibido no projeto inteiro.** Título e resumo de
  notícia são sempre nó de texto puro. Verificável por busca simples no CI.
- **Toda entrada externa passa por validação de esquema (Zod)** antes de entrar
  no domínio: feed, resposta de provedor, `localStorage`. Falha é descarte com
  registro — nunca correção heurística "para não quebrar a tela".
- **`link` só aceito com esquema `http`/`https` absoluto**; revalidado também no
  cliente antes de renderizar `href`. Links externos sempre com
  `rel="noopener noreferrer"`.
- **Política de Segurança de Conteúdo (CSP)** obrigatória via `<meta>`, com
  `connect-src` restrito a `'self'` e ao host de telemetria (ou só `'self'` com
  telemetria desligada).
- **Nenhum segredo em código, arquivo de configuração ou artefato publicado.**
  Token de provedor só como variável de ambiente do job de CI. Varredura de
  segredo no diretório publicado é portão bloqueante a cada publicação.

## 5. Arquitetura e domínio

- **Sem backend em runtime, sem banco de dados** (ADR-001). Toda personalização é
  local (`localStorage`), nunca sincronizada com servidor.
- **`dominio/` é puro**: proibido importar rede, `localStorage`, React ou
  `Date.now()` dentro de qualquer módulo de `dominio/`. O relógio sempre entra
  por parâmetro. Regra de lint (`no-restricted-imports`) é o portão automático.
- **Contrato público de dados** (`/dados/*.json`, SDD §2.2) é fixo: mudança de
  formato, campo ou caminho de arquivo é mudança de contrato — exige nota
  explícita e concordância do Coordenador antes de implementar, não decisão
  unilateral do Executor.
- **Nada "ao vivo"** (RN-09): sem push, sem WebSocket, sem sondagem cega. Toda
  tela que mostra dado buscado exibe carimbo de frescor (RF-17).
- **Sem personalização algorítmica** (RN-18): ordenação sempre por data; sem
  ranking por comportamento do usuário.
- **Classificação de esporte é por regras determinísticas, nunca por IA** (ADR-008).

## 6. Design e acessibilidade

- **WCAG 2.2 AA é critério de aceite, não recomendação** (ADR-014). `axe-core`
  com zero violações críticas/sérias é portão de CI para toda tela nova.
- **Nada depende só de cor** (WCAG 1.4.1): todo estado com significado (V/E/D,
  zona, status de fonte/campeonato, confronto direto, item ativo de navegação,
  palpite selecionado) tem pista textual ou de símbolo redundante à cor.
- **Cor de clube nunca é usada em**: anel de foco, mensagem de erro/aviso, zona
  de classificação, V/E/D. Essas usam sempre as cores fixas do sistema.
- **Nenhum valor literal de cor/tamanho/espaçamento fora do arquivo de tokens**,
  exceto cor de clube (que vive em `clubes-2026.json`, validada no pipeline —
  ADR-017).
- **Alvo de toque mínimo 44×44px**; nenhum texto abaixo de 12px; campo de entrada
  nunca abaixo de 16px.
- **Toda tela tem os 4 estados** (vazio, carregando, erro, sucesso) no mesmo PR
  que a introduz, ou justificativa explícita registrada de por que não se aplica.
- **Textos de estado são canônicos** (UX-SPEC §1.4): usar literalmente o texto
  definido, nunca parafrasear.
- **Sem imagem de terceiro nem escudo oficial de clube** nesta versão (I-14,
  SDD §6.4 D5) — identidade visual é sigla + cor derivada.

## 7. Governança de decisão técnica

- **ADRs são imutáveis.** Mudança de decisão arquitetural é sempre um novo ADR
  com `Superseded by` no anterior — nunca edição do ADR existente.
- **Nenhum requisito de negócio é decidido por Coordenador, Executor ou
  Validador.** Requisito tecnicamente inviável ou desproporcional em custo/prazo
  é sinalizado ao Gestor, nunca cortado ou mudado silenciosamente.
- **Decisão paga/custo recorrente exige aprovação explícita do stakeholder**
  (RN-13) — registrada em `BLOCKERS.md`, nunca assumida.
- **Lacuna estrutural encontrada na implementação ou na revisão** (exige
  redesenho de dependência/decomposição) é escalada ao Coordenador via
  `BLOCKERS.md`; lacuna de **detalhe** é decidida e documentada no próprio
  artefato (TASK.md Seção 6, ou equivalente).

---

**Nota de rascunho**: este é o rascunho inicial (skill `guardrails-drafting`),
extraído de `CTO-REVIEW.md` + `SDD.md` + ADRs no momento do `TASK.md`. Conforme
PIPELINE-CONVENTIONS.md §5, mudança estrutural ou exceção neste documento é
aprovada pelo Gestor (chapéu CTO) — não pelo usuário. O usuário (orquestrador)
segue aprovando `SDD.md`, `UX-SPEC.md` e `TASK.md` diretamente.

## Log de Alterações

| Data | Proposto por | Aprovado por | Mudança | Motivo |
|---|---|---|---|---|
| 2026-09-05 | coordenador | gestor | Criação da versão inicial (7 seções) | Base: CTO-REVIEW.md + SDD.md + 17 ADRs |
