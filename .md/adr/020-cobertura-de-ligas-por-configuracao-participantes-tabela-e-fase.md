# ADR-020 — Cobertura de ligas por configuração: referência do provedor, participantes, tabela e fase

- **Status**: Aceito
- **Data**: 2026-09-18
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-20, RF-22, RF-25, CA-20.3, CA-20.4, CA-22.2, CA-22.4, CA-25.1
  a CA-25.4, RN-05, RN-20, RN-21
- **Relaciona-se com**: ADR-006 (adaptador + mapa de cobertura), ADR-007 (configuração
  verificada), SDD §2.6. **Não substitui** nenhum ADR.

## Contexto

Estender a integração TheSportsDB de 2 ligas (Paulista, Carioca) para as 7 do recorte
(Copa do Brasil, Libertadores, Sul-Americana, Paulista, Carioca, Gaúcho, Mineiro) expôs
quatro lacunas de arquitetura no código atual (`orquestrador.ts`,
`adaptador-thesportsdb.ts`):

1. o id de liga vive num mapa local (`REFS_COMPETICAO_THESPORTSDB`) — CA-25.1 pede
   "apenas configuração";
2. `clubes` de Libertadores/Sul-Americana está vazio (RN-05), então nenhum
   `ParticipacaoClube` existe para elas;
3. `temTabela` é fixo por liga, mas Libertadores/Sul-Americana começam em grupos e
   terminam em mata-mata (CA-20.3, CA-08.5);
4. `verificarConsistenciaCompeticao` exige nº de linhas da tabela == nº de clubes
   configurados, o que reprova mata-mata (0 linhas) e formatos mistos (clube brasileiro
   que entra direto no mata-mata não aparece na tabela de grupos).

## Decisão

1. **O id do provedor vira campo da configuração.** `CampeonatoConfigSchema` ganha
   `refProvedor?: { id: string; temporada?: string }` — `id` é o identificador da
   competição **no provedor** (`"BSA"` no football-data.org, `"5767"` no TheSportsDB),
   `temporada` no formato do provedor. Obrigatório quando `provedor !== null`, proibido
   quando `null` (`refine`). Os mapas locais `CODIGOS_COMPETICAO_FOOTBALL_DATA` e
   `REFS_COMPETICAO_THESPORTSDB` são removidos; `construirReferencia` lê da config.
   Adicionar liga passa a ser edição de JSON (CA-25.1), sem lógica por competição.
2. **Participantes das continentais: configuração manual verificada, com diagnóstico de
   descoberta — nunca auto-inclusão.** A lista `clubes` continua sendo config versionada
   (RN-05: "lista configurada por temporada, cruzada com participação efetiva segundo o
   provedor"), preenchida por spike/tarefa contra o provedor (SPK-07 → COB-04). A ingestão
   **cruza** os clubes da Série A (por id) que aparecem nos eventos/tabela da liga com a
   lista configurada e emite o diagnóstico `participante-nao-configurado` (no log por
   liga e no `status.json`) — o humano decide incluir. Motivos: participação muda o
   conjunto de `ParticipacaoClube` (e a ordem/cartões do Painel) e não deve variar
   sozinha por uma resposta truncada ou ruidosa do provedor; a config é o único lugar
   auditável por temporada (ADR-007); nenhuma requisição extra.
3. **Política de tabela derivada do `formato`, não fixa por liga.** `mata-mata` → nunca
   consulta tabela (0 requisição); `grupos` e `pontos-corridos` → sempre; `misto` →
   **tenta** a cada ciclo e trata `table: null`/vazia como "sem tabela agora" (não erro,
   CA-20.4). `RefCompeticaoTheSportsDB.temTabela` é substituído por
   `politicaTabela: 'nunca' | 'sempre' | 'tentar'`, derivada do `formato` em um único
   lugar.
4. **Retenção da tabela final de grupos (CA-20.3/CA-08.5).** Em `formato: 'misto'`, se o
   lote novo vem com classificação vazia e o estado anterior tinha linhas, o orquestrador
   **retém** as linhas anteriores (não as apaga). A SPA identifica "tabela final" porque
   a competição já tem partida de fase de mata-mata (UX-SPEC T-06).
5. **Consistência por formato (evolui CA-16.6, sem afrouxá-lo onde ele vale).**
   `pontos-corridos`/`grupos`: nº de linhas == clubes configurados (como hoje) e sem
   duplicata; `misto`: linhas ≤ clubes configurados, sem duplicata, todas de clube
   configurado; `mata-mata`: sem exigência de tabela. Demais verificações (pontos =
   3V+E, saldo, `finalizada` sem placar, data antes do início) valem em todos.
6. **Fase vem do provedor, sem inferência.** `Partida.fase` recebe o campo de fase do
   provedor que o SPK-06 confirmar (hoje: `strGroup`). Sem campo confiável → `null`.
7. **Eliminação só com evidência (RT-06/P13).** O derivador (ADR-006 item 6) afirma
   "eliminado" em mata-mata só com derrota **comprovada**: ida e volta finalizadas contra
   o mesmo adversário na mesma fase com agregado perdido, ou derrota em fase reconhecida
   como jogo único. Ausência de partida futura **não** basta (o sorteio/calendário da
   fase seguinte pode não estar no provedor, ou ter sido truncado). Agregado empatado,
   jogo único empatado (pênaltis desconhecidos, CA-22.4) ou fase ambígua → `sem-dados`;
   vitória sem próxima fase conhecida → `em-andamento` sem fase.
8. **Escopo é configuração e teste**: só Paulista, Carioca, Gaúcho, Mineiro, Copa do
   Brasil, Libertadores e Sul-Americana podem ter `provedor: "thesportsdb"` (CA-25.4,
   RN-20); teste de config falha se outra competição ganhar o provedor. Gaúcho/Mineiro
   sem id verificado ficam `provedor: null` + `observacao` (CA-25.2).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Descoberta automática de participantes (ingestão preenche `clubes`) | Config deixa de ser fonte auditável; resposta truncada (P12) removeria/adicionaria clubes sozinha; reescrita de arquivo em CI |
| `temTabela` como campo da config por liga | Continua fixo — não resolve a mudança de fase dentro da mesma liga |
| Detectar fase por chamada extra a `lookuptable` só quando há partida de grupo | Complexidade sem ganho: `tentar` já custa +1 requisição só em 2 ligas |
| Manter mapas locais no orquestrador | Contraria CA-25.1; cada liga nova exige código |
| Inferir eliminação por ausência de jogo futuro (comportamento atual) | Rotula como "eliminado" um time que venceu e aguarda sorteio — pior que "sem dados" (RN-21) |

## Consequências

**Positivas**: nova liga = JSON + fixture; comportamento por formato explícito; lacunas
(participante ausente, id de liga sem verificação) aparecem em diagnóstico em vez de
mudar dado silenciosamente.

**Negativas**: participantes das continentais dependem de ação humana por temporada (e
por mudança de fase, ex.: brasileiro que cai da Libertadores para a Sul-Americana —
detectado pelo diagnóstico, corrigido na config); `refProvedor` passa a existir no
arquivo de configuração público (não é segredo; ver COB-02 sobre orçamento de tamanho);
o derivador fica mais conservador, então mais cartões de mata-mata podem mostrar "sem
dados" (aceito, RN-21).

**Efeito em artefatos já validados** (sem reabri-los): `derivador-status.ts`
(ING-F-03, Lote 5) muda de comportamento **apenas** para formatos com eliminação por
mata-mata; o caminho `pontos-corridos` do Brasileirão não muda. Os testes de mata-mata
existentes serão revisados dentro de COB-14.

## Se virar produto

Provedor pago com tabelas de fase e "quem avançou" explícitos elimina os itens 6-7;
participantes viriam do próprio provedor com verificação automatizada.
