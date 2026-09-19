# ADR-021 — Cota do provedor: espaçamento de chamadas, prioridade por liga e isolamento de falha

- **Status**: Aceito
- **Data**: 2026-09-18
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-24, CA-24.1 a CA-24.3, CA-20.5, RNF-17, RNF-18, RNF-19, RN-22,
  RT-08 (SDD §6.1)
- **Relaciona-se com**: ADR-002 (ingestão em CI; prioridade por categoria), ADR-006
  (`orcamento` no adaptador). **Complementa** o ADR-002 — a ordem por categoria dele
  passa a ser critério de desempate dentro de cada faixa de RN-22; não é substituído.

## Contexto

O plano gratuito do TheSportsDB (chave demo pública `123`) permite **30 requisições por
minuto**, sem cadastro. Com 7 ligas o custo real de um ciclo é: 2 chamadas por liga sem
tabela (`eventspastleague` + `eventsnextleague`) e 3 por liga com tabela
(`lookuptable`) — no máximo ~20 chamadas por ciclo, mas hoje: (a) o adaptador dispara as
duas chamadas de partidas em paralelo (`Promise.all`), sem espaçamento; (b) o coletor
assume custo fixo de 2 por liga (`CUSTO_REQUISICOES_POR_COMPETICAO`), subcontando as ligas
com tabela; (c) a ordem é só por categoria; (d) o loop do orquestrador faz `.parse` de Zod
**fora** de `try/catch`, então um schema inválido de uma liga aborta o ciclo inteiro.
Além disso a chave `123` é pública e compartilhada — um 429 pode ocorrer mesmo dentro do
nosso orçamento.

## Decisão

1. **Espaçador de requisições por provedor.** Novo módulo `pipeline/futebol/
   espacador-requisicoes.ts`: janela deslizante de 60 s com teto de **28** requisições
   (margem de 2 sobre o limite de 30) e intervalo mínimo de **2,2 s** entre chamadas
   consecutivas; relógio e `sleep` injetáveis (teste sem tempo real). Todo `fetch` do
   adaptador passa por ele. **Chamadas ao mesmo provedor são sempre seriais** —
   `Promise.all` entre chamadas do mesmo provedor é proibido (GUARDRAILS, proposta G-1).
   Ciclo de ~20 chamadas ≈ 45-50 s, dentro do job de CI.
2. **Custo declarado pelo adaptador.** A porta ganha `custoEstimado?(ref): number`
   (TheSportsDB: 2 ou 3 conforme `politicaTabela`; padrão 2 para os demais). O coletor usa
   isso no teto proativo em vez da constante 2. Teto por ciclo permanece
   `orcamento.porMinuto` (30), agora com custo correto.
3. **Prioridade (RN-22), decidida em ordem:** faixa 1 — liga em janela ativa **com jogo
   nas próximas 48 h** (calculado sobre o estado anterior publicado, injetado no coletor
   como `proximoJogoPorCompeticao`); faixa 2 — liga em janela ativa; faixa 3 — fora da
   janela (**não consulta**, sem requisição, CA-20.2). Dentro da faixa, ordem por
   categoria do ADR-002 (Brasileirão, continental, Copa do Brasil, estadual/regional,
   Supercopa). Sem estado anterior → faixa 2.
4. **Limite excedido (CA-24.2).** HTTP 429 (ou o equivalente que o SPK-06 encontrar, ex.:
   corpo 200 com mensagem de limite) **suspende o provedor pelo resto do ciclo**, sem
   nova tentativa no mesmo ciclo; a liga corrente e as seguintes ficam
   `pausado-por-cota`, mantendo o dado anterior; `pausadoPorCota` global sinaliza (já
   existente, CA-16.4). Ligas de outro provedor não são afetadas.
5. **Isolamento de falha por liga (RNF-17, CA-20.5).** Qualquer exceção no processamento
   de uma liga — rede, HTTP, Zod da resposta, Zod do domínio, verificação — vira
   `falha` **daquela liga** (mensagem sem segredo), mantém o estado anterior dela e o
   ciclo continua. O `try/catch` deixa de existir só no coletor e passa a envolver todo o
   processamento por liga no orquestrador (COB-19).
6. **Cadência por liga não é adicionada.** A cadência global do SDD §2.4 (≥55 min em dia
   de jogo, ≥5h30 nos demais) fica como está: com ≤ 20 chamadas por ciclo e a faixa 3 sem
   consulta, a cota não é o gargalo; cadência por liga adicionaria estado sem ganho
   mensurável (revisitar se SPK-06 mostrar limite diário oculto).
7. **Se o SPK-06 mostrar que `eventspastleague`/`eventsnextleague` truncam demais (P12)**,
   ordem de contingência, cada uma exigindo novo ADR antes de virar código: (1)
   `eventsseason.php` da liga; (2) `eventslast`/`eventsnext` por clube rastreado (até 40
   chamadas — só em ciclos espaçados); (3) lacuna assumida com "sem dados" honesto (I-32).
   Nenhuma fonte paga, cadastro ou API alternativa (RN-13, CA-24.3).
8. **Observabilidade (RNF-19).** Cada ciclo registra, por liga: horário, liga, resultado,
   nº de partidas, nº de requisições, descartes por motivo (contagens, sem conteúdo de
   terceiro além de ids/nomes de diagnóstico) — no log do CI e em `status.json`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Confiar só no teto por execução já existente | Não impede rajada em <1 s nem corrige o subcontagem de custo |
| Backoff/retentativa em 429 dentro do ciclo | Chave compartilhada: insistir agrava; o próximo ciclo (30 min) é a retentativa natural |
| Cadência por liga persistida | Estado extra sem necessidade demonstrada (item 6) |
| Paralelizar ligas para encurtar o ciclo | O ciclo já cabe em ~1 min; paralelismo é o que estoura a cota |

## Consequências

**Positivas**: garantia estrutural (testável com relógio falso) de ≤ 28 req/min; ordem de
degradação previsível (a última liga a ser atualizada é a menos relevante); uma liga
quebrada não derruba as outras; log suficiente para diagnosticar.

**Negativas**: ciclo mais lento (~1 min de espera deliberada); custo de teste com relógio
injetado; `custoEstimado` é estimativa (o limite reativo de 429 continua sendo a rede de
segurança); a chave demo pública pode ter 429 fora do nosso controle — a lacuna é
exibida como "atualização pausada por limite do provedor".

## Se virar produto

Chave paga com cota dedicada e SLA (RN-13: decisão do stakeholder); cron de borda;
alerta automático em N ciclos consecutivos com `pausado-por-cota`.
