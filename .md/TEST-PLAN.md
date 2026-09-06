# TEST-PLAN.md — SportsLM

**Status**: versão inicial, criada durante a validação do Lote 1 (2026-09-06)
**Autor**: Validador (chapéu QA, skill `test-strategy-planning`)
**Base**: `.md/PRD-TECNICO.md`, `.md/TASK.md`, `.md/UX-SPEC.md`, `.md/SDD.md`.
**Nota de processo**: este documento deveria ter sido produzido em paralelo ao
início da implementação do Lote 1 (ver EXECUTION-FLOW.md — o chapéu QA planeja
estratégia assim que `TASK.md`/`SDD.md` são aprovados, sem esperar lote
terminar). Não existia até agora; é criado retroativamente aqui e passa a valer
dali para frente. Não bloqueia a validação do Lote 1, que já rodou os portões
mecânicos abaixo com sucesso.

---

## 1. Escopo geral de teste

Sem backend em runtime (ADR-001): não há teste de API/contrato de servidor no
sentido tradicional. A superfície de teste é:

1. **Pipeline** (`pipeline/`, futuros `dominio/`) — funções puras, testadas por
   tabela (Vitest), rodando em Node, sem I/O real em teste (fixtures/mocks).
2. **SPA** (`app/`) — componentes e hooks, testados com Vitest + Testing
   Library + jsdom; sem E2E de navegador real nesta fase (RNF-01 não exige
   matriz de navegadores formal — ver TASK.md §6, item 8).
3. **CI/CD** (`.github/workflows/`) — verificado por execução real dos scripts
   que os workflows chamam (`npm run typecheck/lint/test/build/verificar-segredos`)
   mais leitura manual de YAML (sem `actionlint` disponível no ambiente).

## 2. Tipos de teste por chapéu do Executor

| Tipo | Onde roda | Ferramenta | Portão de CI? |
|---|---|---|---|
| Unitário/tabela (domínio puro) | `dominio/`, `pipeline/` | Vitest | Sim — `npm test` |
| Componente/hook (SPA) | `app/` | Vitest + Testing Library + jsdom | Sim — `npm test` |
| Tipos estáticos | Todo o projeto | `tsc --noEmit` | Sim |
| Estilo/lint (incl. pureza de `dominio/`) | Todo o projeto | ESLint (flat config, `no-restricted-imports/globals/syntax`) | Sim |
| Formatação | Todo o projeto | Prettier (`format:check`) | **Não está no CI ainda** (achado desta rodada — ver QA-REPORT.md, Refatoração Lote-1) |
| Segurança de artefato (segredo) | `dist/` (build) e `dist-dados/` (ingestão) | `verificar-segredos.mjs` / grep no workflow | Sim, bloqueante |
| Auditoria de dependências | `package-lock.json` | `npm audit --omit=dev` | Sim (alta/crítica bloqueia; moderada é débito) |
| Acessibilidade (`axe-core`) | Telas reais | A partir do Lote 7 (componentes) — ainda não aplicável ao Lote 1 (shell sem conteúdo de tela) | Planejado para Lote 7+ (QA-01, Lote 12) |
| Integração cruzada Backend×Frontend | Pipeline → snapshot público → SPA | A partir do Lote 6 (`gerador-snapshots`) — não aplicável ainda | Planejado |

## 3. Estratégia por lote (visão inicial, revisada a cada lote concluído)

- **Lote 1 (Fundação técnica)**: validar que os portões (tipo/lint/teste/build/
  segredo) existem e funcionam de verdade — inclusive testando o caminho de
  falha proposital (segredo injetado, import ilegal em `dominio/`), não só o
  caminho feliz. Sem UI/domínio de negócio ainda para testar por CA-xx.
- **Lotes 2-3 (Config/Domínio)**: foco em teste por tabela cobrindo os CA-xx
  citados nas próprias tarefas (RN-05/06/15/19, CA-03/04/07/08/11/17/18/19).
  `DOM-05` (simulação) e `DOM-03` (dedup) recebem atenção extra — são os
  módulos de maior risco lógico do domínio.
- **Lotes 4-5 (Ingestão)**: teste de integração do "job completo" (ING-N-07,
  ING-F-05) com fontes/provedor mockados, verificando o encadeamento real dos
  componentes, não só cada um isoladamente.
- **Lote 6 (Publicação)**: primeira oportunidade de teste de integração
  cruzada real Backend→Frontend — snapshot publicado deve casar com o schema
  que `UI-DS-08 (useSnapshot)` espera.
- **Lotes 7-11 (Design system e telas)**: `axe-core` obrigatório por
  componente/tela, tema × paleta (mínimo 4 paletas representativas de
  UX-SPEC §5), os 4 estados de tela (vazio/carregando/erro/preenchido), WCAG
  1.4.1 (nenhuma pista só de cor).
- **Lote 12 (Telemetria/acessibilidade/segurança transversal)**: `QA-01`
  consolida `axe-core` nas 9 telas × 2 temas × 4 paletas; `SEC-01` testa XSS
  em item de feed mockado e CSP.
- **Não-funcional**: performance de recálculo de simulação (<100ms, RNF-14) a
  partir de UI-T09-02; onboarding em no máximo 2 confirmações (RNF-04) a
  partir de UI-T01-02.

## 4. Fora de escopo desta fase

- Testes de carga/performance de infraestrutura (protótipo sem SLA, RNF-15).
- Matriz formal de navegadores (TASK.md §6, item 8).
- Teste jurídico/compliance de termos de fonte (fora do roster técnico).

---

## Log de Revisões

| Data | Lote em validação | Mudança |
|---|---|---|
| 2026-09-06 | Lote 1 | Criação da versão inicial, junto com o primeiro `QA-REPORT.md`/`SECURITY-REVIEW.md` |
