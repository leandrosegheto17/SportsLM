# ADR-024 — Decisões do usuário: calendário parcial, tabela parcial publicada com marca e cartões continentais

- **Status**: Aceito
- **Data**: 2026-09-18
- **Decisor**: Usuário (P-A a P-D, resposta na sessão de 2026-09-18); forma técnica: Coordenador
- **Relaciona-se com**: ADR-022 (**altera o item 5 "tabela parcial não é publicada" — este ADR
  o supersede nesse ponto apenas**; o resto do ADR-022 vale), ADR-023 (adendo: item 2 fixa o
  comportamento de UI), ADR-020 (item 5, consistência por formato), ADR-021.

## Decisões

1. **P-A — cobertura reduzida aceita.** Se o SPK-08 invalidar o `eventsday`, as ligas de
   mata-mata ficam com o que o provedor gratuito devolver (poucos jogos) e a tela diz
   "calendário parcial". Provedor pago não é reaberto (RN-13 mantida).
2. **P-B — sem backfill.** Só jogos vistos a partir do início da ingestão. Texto na tela
   (T-05 e T-06): "Calendário parcial — a fonte gratuita informa poucos jogos por consulta."
   Incondicional para competição TheSportsDB de formato `mata-mata` ou `misto` (e estaduais).
3. **P-C — Botafogo com dois cartões.** Todo candidato configurado (ADR-023) tem cartão da
   competição; sem partida vista, o cartão é "SEM JOGOS" com o motivo canônico do T-05
   (nunca omitido, nunca zeros).
4. **P-D — tabela parcial do provedor é publicada, com marca.** Substitui o item 5 do
   ADR-022. Contrato: `Competicao.tabelaParcial?: boolean` (opcional; ausente = completa),
   definida no adaptador (COB-08) quando o provedor devolve menos linhas do que os clubes
   configurados que deveriam aparecer. Em `tabelaParcial`, a consistência (COB-40) passa a
   exigir linhas ≤ clubes configurados, sem duplicata, só clubes configurados, pontos/saldo
   íntegros por linha; nunca `falha`. Diagnóstico `tabela-parcial-provedor` continua no log.
   A tela mostra o aviso "Tabela parcial — a fonte gratuita informa só parte da
   classificação." (distinto da nota antiga "só os clubes da Série A", que trata de outra
   coisa: filtrar externos). Posição exibida é a do provedor; nunca recalculada.

## Consequências

**Positivas**: informação parcial honesta em vez de vazio. **Negativas**: campo novo no
contrato/snapshot (opcional, retrocompatível); risco de leitor interpretar posição parcial
como completa (mitigado pelo aviso textual + símbolo, WCAG 1.4.1); definição de "parcial"
por contagem de clubes configurados é heurística (revisar com dado real do SPK-08/2027).
