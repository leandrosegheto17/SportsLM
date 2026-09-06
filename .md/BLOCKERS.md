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
