# ADR-002 — Ingestão periódica em CI agendado, com estado versionado em branch de dados

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-15, RF-16, RF-17, RN-08, RN-09, RNF-06, RNF-11, CA-16.4
- **Depende de**: ADR-001

## Contexto

A ingestão precisa rodar sozinha, periodicamente, guardar estado entre execuções
(deduplicação por link canônico, retenção de 7 dias, "instável desde <data>", última
atualização por campeonato) e não pode expor a chave do provedor de futebol.

Intervalos exigidos (RNF-06): notícias ≤ 30 min; futebol ≤ 1 h em dia de jogo de
clube da Série A e ≤ 6 h nos demais dias. Alerta de desatualização = 2× o intervalo.

## Alternativas consideradas

| Alternativa | Contras que pesaram |
|---|---|
| Máquina/VPS com `cron` | Custo e servidor para manter — desproporcional ao protótipo |
| Serviço de agendamento externo (cron-job.org e afins) chamando um endpoint | Precisa de um endpoint, ou seja, de um backend (contraria ADR-001) |
| **GitHub Actions com `schedule`** | Cron é "melhor esforço": execuções podem atrasar ou ser puladas em horário de pico; minutos do plano gratuito são finitos em repositório privado |
| Cloudflare Cron Triggers | Bom, mas adiciona um segundo fornecedor sem ganho no protótipo (ver ADR-001, alternativa B) |

**Dois workflows separados (notícias e futebol) foi descartado**: dois jobs escrevendo
na mesma branch de estado disputariam o `push` (conflito de concorrência real), e a
soma de execuções estoura o plano gratuito de repositório privado
(48/dia + 24/dia ≈ 2.160 execuções/mês contra 2.000 minutos gratuitos).

## Decisão

**Um único workflow agendado, `ingestao`, a cada 30 minutos**, com
`concurrency: { group: ingestao, cancel-in-progress: false }`. Dentro dele:

1. **Passo notícias** — roda em toda execução (cadência efetiva de 30 min, satisfaz
   RNF-06 exatamente).
2. **Passo futebol** — decide internamente se chama o provedor:
   - há partida de clube da Série A hoje (America/Sao_Paulo) e a última atualização
     tem ≥ 55 min → atualiza;
   - não há partida hoje e a última atualização tem ≥ 5 h 30 min → atualiza;
   - caso contrário → sai sem consumir cota, registrando "pulado por cadência".
3. **Passo publicação** — regenera os snapshots públicos e publica no hosting
   estático apenas se algo mudou (comparação por hash de conteúdo).

Custo: ~1.440 execuções/mês, dentro dos 2.000 minutos gratuitos de repositório
privado; ilimitado se o repositório for público.

**Estado entre execuções**: branch órfã `dados`, com os arquivos de estado interno
(`estado/noticias.json`, `estado/futebol.json`, `estado/status.json`), commitada ao
final de cada execução com mensagem `chore(ingestao): <ISO>`. Retenção de 7 dias e
teto por fonte mantêm o arquivo pequeno (dezenas de KB).

**Segredos**: token do provedor de futebol em *GitHub Secrets*, injetado só como
variável de ambiente do job. Regra dura: nenhum segredo pode aparecer em arquivo do
`dist/` publicado (verificável por `grep` no bundle — ver Seção 7 do SDD).

**Priorização dentro da cota (CA-16.4)**, aplicada na ordem:
1. Brasileirão Série A (tabela + calendário completo) — insumo do diferencial;
2. competições continentais em fase ativa;
3. Copa do Brasil em fase ativa;
4. estaduais/regionais dentro da janela de calendário da temporada;
5. Supercopa.

Competição fora da janela de calendário configurada **não consome requisição**; o
último dado ingerido é mantido com o status final. Quando a cota se esgota, o passo
suspende, marca `pausadoPorCota: true` no `status.json` e a interface exibe
"atualização pausada por limite do provedor" (CA-16.4/CA-17.4).

## Consequências

**Positivas**
- Um único ponto de escrita no estado — sem corrida entre jobs.
- Histórico de ingestão auditável de graça (cada execução é um commit).
- Cota do provedor sob controle explícito, por configuração, não por acidente.

**Negativas / dívida aceita**
- `schedule` do GitHub Actions é melhor esforço: uma execução pode ser adiada em
  dezenas de minutos. Mitigação: o carimbo de frescor vem sempre do dado real
  (`geradoEm`), nunca do horário esperado; o limite de alerta de 2× absorve uma
  execução perdida (CA-17.2).
- Sem alerta automático de falha (RNF-11 no nível protótipo): a falha aparece na tela
  como fonte instável (RN-08) e no `status.json`. Para o GE, um evento de severidade
  alta é registrado e vira banner no cabeçalho (CA-01.3/CA-15.6).
- A branch de dados cresce um commit a cada 30 min. Mitigação: branch órfã, sem
  histórico relevante para o código; pode ser reescrita periodicamente sem impacto.

## Se virar produto

Trocar o agendador de CI por cron de borda (1 min de granularidade), estado em banco
gerenciado, alerta automático em falha do GE e em esgotamento de cota, e retenção
configurável maior que 7 dias.
