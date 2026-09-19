# ADR-022 — Calendário e resultados sob o teto de 1 evento: consulta por dia (`eventsday`) e acúmulo incremental no estado

- **Status**: Aceito (condicionado ao SPK-08 — ver "Condição de validade")
- **Data**: 2026-09-18
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-20, RF-22, RF-24, CA-20.x, CA-22.3/22.4, CA-24.x, RNF-17,
  I-28, I-32, RT-15 (P12)
- **Relaciona-se com**: ADR-002 (estado versionado — é onde o acúmulo mora), ADR-006,
  ADR-019, ADR-020, **ADR-021 item 7 (este ADR executa a contingência que o item 7
  previa; o ADR-021 não é editado)**.

## Contexto

O SPK-06 mediu que `eventspastleague` e `eventsnextleague` devolvem **no máximo 1 evento
por chamada** em todas as ligas (P12 = truncam demais). O item 7 do ADR-021 listava
`eventsseason` e consulta por clube como contingência. Medição complementar (Coordenador,
2026-09-18, chave `123`, 6 chamadas reais via ferramenta de fetch — **não** são fixtures
brutas; SPK-08 refaz com o Node do projeto):

| Endpoint | Resultado | Serve? |
|---|---|---|
| `eventsseason.php?id=<liga>&s=2026` | Copa do Brasil: 4 eventos; Paulista: 14; ordem = **início da temporada** (rodada 1-2), SPK-07 mediu teto ~15 | **Não** — devolve sempre o começo do calendário, nunca os jogos recentes/próximos |
| `eventslast.php?id=<time>` / `eventsnext.php?id=<time>` | **1 evento** cada (chave do JSON é `results` no `eventslast`, `events` no `eventsnext`); mistura ligas — o próximo jogo do Flamengo veio do Brasileirão, não da Libertadores | **Não** — mesmo teto de 1, 40 chamadas para 20 clubes e sem controle de liga |
| `eventsday.php?d=AAAA-MM-DD&l=<idLiga>` | Libertadores 2026-09-17 → 1 evento real (Corinthians×Estudiantes), **que o `eventspastleague` não mostrou** (ele mostrou o do dia UTC seguinte); devolve os jogos **do dia da liga** | **Sim, é a única rota que amplia a visão** — teto por dia ainda **não medido** (varredura `s=Soccer` mundial devolveu só 3 eventos ⇒ há teto/amostragem no plano free) |
| `eventsround.php` | não testado | tratar no SPK-08 |

Uma chamada `eventsday` de Copa do Brasil (2026-02-18) retornou HTTP 502 com
`Retry-After: 60` **na ferramenta de fetch** (proxy, não o Node do projeto) — indício, não
prova, de limitação; a medição parou aí (regra "parar na primeira negação"). O formato de
negação de cota do provedor segue **não observado**.

## Decisão

1. **Consulta por dia como fonte principal do calendário.** Para cada liga TheSportsDB em
   janela ativa, o adaptador consulta `eventsday.php?d=<dia UTC>&l=<idLiga>` para um
   **conjunto pequeno de dias-alvo**: `{hoje−1, hoje, hoje+1}` (UTC; cobre o fuso — o
   `dateEvent` é UTC e o jogo noturno de Brasília cai no dia UTC seguinte) ∪ `{data do
   único evento de eventsnextleague}` ∪ `{data do único evento de eventspastleague}`.
   `eventspast/nextleague` (1 chamada cada) passam a servir como **âncoras** para descobrir
   a próxima/última data de jogo, não como calendário. Dias-alvo deduplicados, máx. 5 por
   liga por ciclo. Faixa 1 da RN-22 (jogo em ≤ 48 h) usa os 5; faixa 2 usa só as âncoras e
   os dias novos (custo ~4).
2. **Acúmulo incremental no estado (ADR-002).** A cada ciclo, as partidas vistas são
   **mescladas** às já publicadas, por chave estável (`idEvent` do provedor mapeado para o
   id da partida): partida `finalizada` nunca regride; partida que sumiu da resposta é
   **mantida**; placar/status/data mais recente do provedor vence só se a partida ainda não
   estava `finalizada`. O calendário é, portanto, **completo a partir do início da
   ingestão** (mais o que os dias-alvo alcançarem) e **parcial para trás** — sem backfill
   na primeira entrega (decisão de escopo pendente: ver pergunta ao usuário no TASK.md).
3. **Fase e rodada seguem ausentes** (SPK-06: sem campo útil). `Partida.fase = null` no
   TheSportsDB; a derivação de "eliminado" (ADR-020 item 7) só afirma com **ida e volta
   finalizadas contra o mesmo adversário** no acumulado; jogo único perdido, empate ou
   pênaltis (`PEN`) ⇒ `sem-dados`. Nunca inferir quem avançou.
4. **Cota.** Custo por liga vira **declarado como teto** (`custoEstimado` = 2 âncoras + até
   5 dias + 1 tabela conforme política = máx. 8). Com 7 ligas e estaduais+continentais
   sobrepostos o pior ciclo passa de 30 chamadas (≈ 56, ~2,5 min com o espaçador do
   ADR-021). Por isso o teto por execução do coletor **deixa de ser `porMinuto`**: passa a
   `orcamento.porExecucao` (proposto 60), enquanto o **espaçador continua garantindo ≤ 28
   req/min**. Negação (429, ou 5xx com `Retry-After`, ou o formato que o SPK-08 achar)
   continua suspendendo o provedor no ciclo (ADR-021 item 4).
5. **Corpo vazio (200 não-JSON) é resposta válida "sem dados"** em `lookuptable` (Libertadores
   e Copa do Brasil no SPK-06); `PEN` é status final (`finalizada`, sem inferir vencedor);
   tabela parcial do provedor (Paulista: 5 linhas) **não é publicada** — vira diagnóstico
   `tabela-parcial-provedor` e tabela vazia, sem `falha`.
6. **Lacuna assumida (I-32).** Onde o calendário for parcial, a UI diz isso em texto
   (nota "calendário parcial — fonte gratuita"), não omite silenciosamente. Nenhuma fonte
   paga, cadastro ou API alternativa (RN-13, CA-24.3).

## Condição de validade

Vale se o **SPK-08** confirmar, com o Node do projeto e ≤ 2 chamadas/5 s: (a) `eventsday` com
`l=<idLiga>` devolve **todos** os jogos do dia da liga (ou ao menos > 1 quando há > 1 jogo
— caso contrário o teto de 1 reaparece por dia); (b) o formato de negação. Se (a) falhar, a
contingência restante é a lacuna assumida do item 6 sozinha, com **cobertura reduzida
das ligas de mata-mata** — decisão de escopo que volta ao usuário (pergunta P-A do
TASK.md); novo ADR que supersede este.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| `eventsseason` | Devolve o início da temporada (≤ ~15), nunca recente/próximo |
| Consulta por clube (`eventslast/eventsnext` de time) | Teto de 1, mistura ligas, até 40 chamadas, ganho quase nulo |
| Só âncoras (1 past + 1 next) e acúmulo | Perde os jogos entre ciclos (30 min–5 h30) quando há > 1 jogo por dia na liga (rodadas de Copa do Brasil) |
| Chave paga / API alternativa | Proibido (RN-13, CA-24.3) — decisão de negócio |
| Backfill histórico completo na 1ª execução | Dezenas de chamadas por liga; escopo/prazo ⇒ pergunta ao usuário |

## Consequências

**Positivas**: única rota gratuita que amplia a visão; estado versionado já existe; degrada
para "parcial/sem dados" honesto; sem dependência nova.

**Negativas**: ciclo mais longo (~2,5 min no pior caso); histórico anterior à ingestão não
existe; "eliminado" aparece pouco (só com ida+volta acumuladas); custo em requisições
maior e incerto até o SPK-08; mescla de partidas é regra nova (COB-34) com risco de
regressão de dado publicado (mitigado por teste "finalizada nunca regride").

## Se virar produto

Chave paga do TheSportsDB (endpoints `eventsseason` completos, `eventsround`, premium
v2) ou provedor com calendário completo; remove o acúmulo como remendo.
