# UX-SPEC.md — SportsLM

**Status**: entregue para revisão do usuário — Loop B, **rodada 3** (2026-09-09)
**Autor**: Coordenador (chapéu UX/UI)
**Base**: `.md/PRD-TECNICO.md` (rodada 3), `.md/PRD.md` (rodada 3), `.md/SDD.md` e os
17 ADRs em `.md/adr/`.
**Consumidores**: executor, validador, gestor.

**O que mudou da rodada 2 para a rodada 3**: o usuário revisou, fora deste repositório,
um exercício de brainstorm visual (canvas de exploração com 5 direções) para as 3 telas
mobile principais e confirmou a direção já em produção (a "Direção B — Camisa" desta
Seção 3, inalterada), com **um único ajuste pontual**: a faixa do clube precisa ter a
**mesma aparência compacta nas três telas principais** — Notícias (T-02), Meu Time
(T-05) e Comparativo (T-08) —, sempre a variante **completa** de `FaixaClube` (Seção
3.8): mesmo avatar, nome, campeonato e pontos, sem variantes divergentes de altura ou
conteúdo entre telas. Concretamente:
- **T-05** usava uma faixa mais alta, com o botão "[ TROCAR TIME ]" embutido dentro
  dela — uma variante que só existia ali. Passa a usar a faixa completa idêntica à da
  Home; "Trocar time" continua existindo na tela, mas como botão fantasma separado,
  logo abaixo da faixa, não mais dentro dela.
- **T-08** não tinha faixa do clube nenhuma — a tela começava direto no cabeçalho
  "COMPARATIVO · BRASILEIRÃO 2026". Passa a abrir com a mesma faixa completa das
  outras duas telas, antes desse cabeçalho.
- **T-02** já era a referência e não muda.

Isso é reuso de composição do mesmo componente `FaixaClube` (já especificado como
reutilizável na Seção 3.8 da rodada 2) em mais lugares — não altera a Seção 3 (Design
System), nem introduz componente novo, nem contradiz o ADR-017 (a cor e a lógica de
contraste da faixa são as mesmas já validadas). Por isso não há novo ADR: é ajuste de
Seção 2 (Wireframes), com reflexos pontuais nas Seções 3.8, 4 e 6 só onde elas citavam
a forma antiga da faixa em T-05/T-08. Fluxos, requisitos, textos de estado e critérios
de aceite **não mudaram**.

**O que mudou da rodada 1 para a rodada 2**: o stakeholder viu três direções visuais
desenhadas a partir da rodada 1 e escolheu a **Direção B — "Camisa"**, com o pedido
literal "design moderno, divertido e que remeta a esportes". A Seção 3 (Design System)
foi **reescrita do zero**; as Seções 2, 4, 6 e 7 foram revistas para refletir a nova
linguagem e a nova estrutura da home. Fluxos, requisitos, textos de estado e casos de
exceção **não mudaram** — o que mudou é forma e hierarquia visual.

A direção coloca a **identidade do clube governando a tela**. Isso transformou a cor do
clube em entrada de contraste, e gerou o
[ADR-017](adr/017-cor-de-identidade-derivada-do-clube-com-contraste-pre-computado.md),
que é pré-requisito de leitura da Seção 3.

**Nível de acessibilidade**: WCAG 2.2 AA
([ADR-014](adr/014-nivel-de-acessibilidade-alvo-wcag-2-2-aa.md)) — inalterado e não
negociável.

**Design system**: green-field, **todos os componentes são novos**. A Seção 3.8
destaca os seis que não são padrões conhecidos.

Este documento é suficiente para montar um mockup estático sem inventar nada: valores
definitivos, contraste declarado, conteúdo real em pt-BR.

---

## 1. Fluxos de Tela

### 1.1 Inventário de telas

| Id | Tela | Rota / forma | Requisitos | Fluxo do PRD-TECNICO |
|---|---|---|---|---|
| **T-01** | Onboarding (2 passos) | `/onboarding` | RF-14, RF-03, RF-06 | FL-01 |
| **T-02** | Home — faixa do clube, blocos do time e feed | `/` | RF-04, RF-05, RF-17, RF-19 | FL-02 |
| **T-03** | Configurações — fontes, esportes, tema, privacidade | sobreposição | RF-01, RF-02, RF-03 | FL-02 |
| **T-04** | Escolher / trocar time | sobreposição | RF-06 | FL-01, FL-03 |
| **T-05** | Painel do time — campeonatos do ano | `/time` | RF-07, RF-17 | FL-03 |
| **T-06** | Detalhe do campeonato | `/time/:campeonatoId` | RF-08, RF-18 | FL-03 |
| **T-07** | Escolher rivais | sobreposição | RF-09 | FL-04 |
| **T-08** | Comparativo no Brasileirão | `/comparativo` | RF-10 | FL-04 |
| **T-09** | Simulação de cenário | `/simulacao` | RF-11 | FL-05 |

RF-13 é comportamento invisível com efeitos visíveis (T-03); RF-15/RF-16 são
processos; RF-17 é o componente **CarimboFrescor**, presente em T-02, T-05, T-06, T-08
e T-09.

### 1.2 Cobertura de fluxos: todo fluxo do PRD-TECNICO tem tela

| Fluxo | Telas que o realizam |
|---|---|
| FL-01 Onboarding e retorno | T-01 → T-02; ramo de virada de temporada em T-04 |
| FL-02 Home, feed, favoritos, bloqueio | T-02 + T-03 |
| FL-03 Painel do time por campeonato | T-05 → T-06 (T-04 quando não há time) |
| FL-04 Rivais e comparativo | T-07 → T-08 |
| FL-05 Simulação | T-09 |
| FL-06 Ingestão de notícias | Sem tela — efeitos em T-02 (carimbo, fonte instável) e T-03 (estado da fonte) |
| FL-07 Ingestão de futebol | Sem tela — efeitos em T-05/T-06/T-08 (carimbo, "sem dados", pausa por cota) |

### 1.3 Mapa de navegação

```
                          ┌──────────────┐
   primeiro acesso ─────► │  T-01        │ passo 1 favoritos → passo 2 time
                          │  Onboarding  │ (ambos puláveis)
                          └──────┬───────┘
                                 ▼
      ┌──────────────────────────────────────────────────────┐
      │  T-02 HOME  (rota inicial de todo retorno)           │
      │  faixa do clube ─► T-05  ·  ⚙ ─► T-03 (sobreposição) │
      └───────┬──────────────────────────────┬───────────────┘
              │ nav "MEU TIME"               │ nav "COMPARATIVO"
              ▼                              ▼
      ┌───────────────┐               ┌──────────────────┐
      │ T-05 Painel   │               │ T-08 Comparativo │
      │  sem time ─► T-04             │  sem rival ─► T-07
      └───────┬───────┘               └────────┬─────────┘
              ▼                                ▼
      ┌───────────────┐               ┌──────────────────┐
      │ T-06 Campeonato│              │ T-09 Simulação   │
      └───────────────┘               └──────────────────┘
```

**Regras de navegação**
- Os três itens (`NOTÍCIAS`, `MEU TIME`, `COMPARATIVO`) estão sempre visíveis, em
  caixa alta, na barra preta. O item ativo é **sublinhado com a cor de acento do
  clube** (`--clube-acento-sobre-escuro`) e marcado com `aria-current="page"` — o
  sublinhado nunca é a única pista.
- A **faixa do clube** na home é clicável e leva ao painel (T-05).
- `Simulação` é alcançada de dentro do comparativo e pelo bloco "A BRIGA" da home.
- Sobreposições fecham com `Esc`, com toque fora e com "Fechar"; o foco volta ao
  gatilho.
- Onboarding só aparece quando não há preferência recuperável (CA-13.3/CA-14.1).

### 1.4 Regras transversais de conteúdo

- **Idioma e formato**: pt-BR; `dd/mm`; `dd/mm/aaaa`; `20h30`; fuso America/Sao_Paulo
  (RNF-02). Tempo relativo até 24 h; acima disso, data e hora absolutas.
- **Nunca prometer tempo real**: nenhuma tela usa "ao vivo", "agora" ou "tempo real".
- **Vocabulário fixo** (WCAG 3.2.6): "sem dados disponíveis no momento", "cobertura
  indisponível nesta versão", "fonte fixa", "horário estimado", "horário a definir",
  "data a definir", "aguardando resultado", "instável desde", "pode estar
  desatualizado", "atualização pausada por limite do provedor". Redações canônicas,
  sem variação.
- **Caixa alta é decoração tipográfica, nunca conteúdo**: rótulos em caixa alta são
  escritos em caixa normal no HTML e transformados por `text-transform`, para que o
  leitor de tela não soletre.
- **Notícia abre fora do produto** (CA-04.2), em nova aba, com aviso no nome
  acessível.

---

## 2. Wireframes

Convenções: `[ ]` botão · `( )` chip · `▸` avançar · `◉ ○` rádio · `☑ ☐` alternador ·
`⚠` alerta · `▓` faixa/barra do clube · `▚` listra diagonal · `█` bloco preto ·
`▌` barra colorida de 6 px · `···` continua.
Larguras: **mobile 360 px** e **desktop 1280 px** (contêiner 1120 px).
Conteúdo é exemplo realista. Os clubes são da Série A; a lista real é configuração
(`clubes-2026.json`).

---

### T-02 · Home — a tela que define a direção

**Mobile (360)**
```
┌──────────────────────────────────────────────┐
│█ SportsLM                            ◐   ⚙  █│ nav preta #16181A, 56px, fixa
├──────────────────────────────────────────────┤
│▚▚▚ FAIXA DO CLUBE — listras diagonais ▚▚▚▚▚▚│ 116px, cor do clube
│▚                                            ▚│ contorno 1px tinta (obrigatório)
│▚  ⬤    SÃO PAULO                     6      ▚│ avatar 44px claro c/ sigla
│▚  SPA   BRASILEIRÃO SÉRIE A · 2026  42 PTS  ▚│ nome 32/34 peso 800
│▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚│ nº 72px peso 800 (camisa)
├──────────────────────────────────────────────┤
│ ⚠ O GE está indisponível no momento — as     │ âmbar #FFF3D1 / texto #7A5300
│   notícias abaixo vêm das outras fontes.     │
├──────────────────────────────────────────────┤
│ ┌█ PRÓXIMO JOGO ██████┐┌█ A BRIGA ██████████┐ │ 2 colunas lado a lado (2026-09-09,
│ │ DOM 13/09 · 16H00   ││ 1º PAL 47 ▓▓▓▓▓▓▓▓ │ │ otimização mobile — reduz pela
│ │ Flu × São Paulo     ││ 5º COR 43 ▓▓▓▓▓▓   │ │ metade a altura dos dois blocos
│ │ fora · Maracanã     ││ 6º SPA 42 ▓▓▓▓ seu │ │ antes das notícias); corpo mais
│ │                     ││ [ SIMULAR ]        │ │ denso (padding compacto), tira
│ └─────────────────────┘└────────────────────┘ │ preta/borda tinta 2px mantidas
├──────────────────────────────────────────────┤
│ NOTÍCIAS                   ATUALIZADO HÁ 12MIN│ 28/32 peso 800, -0,02em — título
│ ⓘ Escolha até 3 esportes favoritos para      │ único (fusão de "Seus esportes" +
│   filtrar as notícias aqui.  [Escolher]      │ "Últimas notícias", 2026-09-09);
│ ⚠ 1 FONTE INSTÁVEL: UOL ESPORTE              │ banner só aparece com 0 favoritos,
│ ( TODOS )( FUTEBOL )( VÔLEI )( MEU TIME )   →│ nunca esconde o feed abaixo
│ ┌▌─────────────────────────────────────────┐ │ chips: 1 linha, rolagem horizontal
│ │▌ [FÓRMULA 1]  ESPN Brasil · há 3 min     │ │ ▌ barra 6px na cor do esporte
│ │▌ Verstappen crava a pole em Monza com    │ │ etiqueta tonal caixa alta
│ │▌ 1min19s344 e supera Norris por 87 milé… │ │ 24/30 peso 800 (manchete principal)
│ └──────────────────────────────────────────┘ │ cartão branco, raio 6px, borda fina
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ [FUTEBOL]  ge +2 fontes · há 34 min     │ │ grupo deduplicado (CA-19.1)
│ │▌ Palmeiras confirma lesão de zagueiro    │ │
│ │▌ e desfalque por três semanas            │ │
│ │▌ TAMBÉM EM: ESPN BRASIL · GAZETA         │ │ 12/16 caixa alta, links
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ [GERAL]  Gazeta · ⓘ 05/09 · 14h02       │ │ ⓘ = horário estimado (CA-04.6);
│ │▌ COB divulga calendário de seletivas     │ │ "geral" só aparece no chip "Todos"
│ │▌ para os Jogos de 2028                   │ │
│ └──────────────────────────────────────────┘ │
│ ···  (30 itens no filtro atual — rolagem     │
│      vertical; chips trocam o filtro, RN-07) │
├──────────────────────────────────────────────┤
│█ NOTÍCIAS    MEU TIME    COMPARATIVO        █│ barra inferior preta fixa, 64px
│█ ▔▔▔▔▔▔▔▔                                   █│ sublinhado na cor do clube
└──────────────────────────────────────────────┘
```

**Ordem no celular, e por quê**: faixa do clube → PRÓXIMO JOGO/A BRIGA (lado a
lado) → NOTÍCIAS. **Revisado em 2026-09-09, a pedido do usuário**: antes PRÓXIMO
JOGO e A BRIGA ficavam empilhados (~230 px) e SEUS ESPORTES/ÚLTIMAS NOTÍCIAS eram
duas seções distintas — o torcedor precisava rolar bastante para ver a primeira
notícia no mobile. Agora os dois blocos do time ficam lado a lado (metade da
altura) e as duas seções de notícia se fundem num único feed "NOTÍCIAS", filtrável
por chip (Todos/esporte favorito/Meu time), o que também elimina um cabeçalho e um
carimbo de frescor duplicados. A faixa do clube não muda — continua a maior
prioridade visual da tela (ver "Hierarquia visual" abaixo). **Sem time escolhido**,
PRÓXIMO JOGO/A BRIGA são substituídos por um único bloco de convite de 96 px e o
feed de notícias sobe.

**Desktop (1280)**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│█ SportsLM        NOTÍCIAS      MEU TIME      COMPARATIVO                           ◐ TEMA      ⚙    █│
│█                 ▔▔▔▔▔▔▔▔                                                                           █│
├──────────────────────────────────────────────────────────────────────────────────────────────────────┤
│▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚│
│▚                                                                                                    ▚│
│▚   ⬤       SÃO PAULO                                                                     6         ▚│
│▚  SPA      BRASILEIRÃO SÉRIE A · 2026                                                   42 PTS     ▚│
│▚                                                                                                    ▚│
│▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚│
│ ⚠  O GE está indisponível no momento — as notícias abaixo vêm das outras fontes.                     │
├────────────────────────────────────┬─────────────────────────────────────────────────────────────────┤
│  coluna fixa 336px                 │  feed largo 748px                                               │
│ ┌█ PRÓXIMO JOGO ██████████████████┐│  SEUS ESPORTES                            ATUALIZADO HÁ 12 MIN  │
│ │                                 ││  ( TODOS ) ( FUTEBOL ) ( VÔLEI ) ( FÓRMULA 1 )                  │
│ │  DOM, 13/09 · 16H00             ││ ┌▌────────────────────────────┐ ┌▌────────────────────────────┐ │
│ │  Fluminense ×                   ││ │▌ [FUTEBOL]  ge · há 8 min   │ │▌ [VÔLEI] Terra · há 21 min  │ │
│ │  São Paulo                      ││ │▌ São Paulo vence o          │ │▌ Brasil bate a Itália por   │ │
│ │  fora · 24ª rodada              ││ │▌ Atlético-MG por 2 a 1 no   │ │▌ 3 sets a 1 e vai à final   │ │
│ │  Maracanã                       ││ │▌ Morumbis e encosta no G-6  │ │▌ do Mundial feminino        │ │
│ └─────────────────────────────────┘│ │▌ Tricolor chegou aos 42…    │ │▌ Seleção fecha a fase…      │ │
│ ┌█ A BRIGA NO BRASILEIRÃO ████████┐│ └─────────────────────────────┘ └─────────────────────────────┘ │
│ │  1º  PAL  47  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ││  ···                                                            │
│ │  5º  COR  43  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ││                                                                 │
│ │  6º  SPA  42  ▓▓▓▓▓▓▓▓▓▓▓▓▓ seu││  ÚLTIMAS NOTÍCIAS                         ATUALIZADO HÁ 12 MIN  │
│ │                                 ││  ⚠ 1 FONTE INSTÁVEL: UOL ESPORTE                                │
│ │ [ SIMULAR OS JOGOS QUE FALTAM ] ││ ┌▌────────────────────────────┐ ┌▌────────────────────────────┐ │
│ └─────────────────────────────────┘│ │▌ [FÓRMULA 1] ESPN · há 3min │ │▌ [FUTEBOL] ge +2 · há 34min │ │
│ ┌█ CAMPEONATOS DE 2026 ███████████┐│ │▌ Verstappen crava a pole em │ │▌ Palmeiras confirma lesão   │ │
│ │  ● Brasileirão — 24ª rodada     ││ │▌ Monza com 1min19s344 e     │ │▌ de zagueiro e desfalque    │ │
│ │  ● Sul-Americana — Quartas      ││ │▌ supera Norris por 87 milé… │ │▌ por três semanas           │ │
│ │  ○ Copa do Brasil — eliminado   ││ │                             │ │▌ TAMBÉM EM: ESPN · GAZETA   │ │
│ │  ✓ Paulista — campeão           ││ └─────────────────────────────┘ └─────────────────────────────┘ │
│ │  — Supercopa — sem dados        ││  ···  (30 itens, grade de 2 colunas)                            │
│ │              [ VER PAINEL ▸ ]   ││                                                                 │
│ └─────────────────────────────────┘│                                                                 │
└────────────────────────────────────┴─────────────────────────────────────────────────────────────────┘
```

**Revisado em 2026-09-09**: a coluna de feed (748px) também passa a ser um único
"NOTÍCIAS" com chips de filtro no topo (mesma fusão do mobile) em vez de "SEUS
ESPORTES" e "ÚLTIMAS NOTÍCIAS" como duas seções empilhadas — um só cabeçalho/
carimbo de frescor, mesmo comportamento de filtro do mobile.

**Hierarquia visual, do mais forte ao mais fraco**: (1) faixa do clube com o número de
camisa — é a primeira coisa que o olho encontra e é o que dá a personalidade;
(2) blocos pretos do time, que se destacam por contorno e não por cor; (3) títulos de
seção em 28/32 peso 800; (4) manchete principal de cada seção em 24/30 peso 800, as
demais em 18/24 peso 700; (5) etiquetas e metadados em caixa alta pequena, que amarram
o ritmo esportivo sem competir com a leitura; (6) carimbo de frescor, discreto e
sempre presente.

---

### T-01 · Onboarding — passo 1 de 2 (favoritos)

Sem time escolhido ainda, a identidade é a **neutra** (tinta com listras cinza,
ADR-017 §5): a tela "acende" quando o torcedor escolhe o clube no passo 2.

**Mobile (360)**
```
┌──────────────────────────────────────────────┐
│▚▚▚ faixa neutra — listras tinta/cinza ▚▚▚▚▚▚│ 72px
│▚  SPORTSLM                                  ▚│ 32/34 peso 800
├──────────────────────────────────────────────┤
│ PASSO 1 DE 2                                 │ 12/16 peso 700 +1,2px
│ ██████████████████░░░░░░░░░░░░░░░░           │ barra 6px, tinta
│                                              │
│ QUAIS ESPORTES VOCÊ                          │ 28/32 peso 800, -0,02em
│ QUER EM DESTAQUE?                            │
│ Escolha até 3. Dá para mudar depois.         │ 16/24 secundário
│                                              │
│ ( ✓ FUTEBOL )( ✓ VÔLEI )( FÓRMULA 1 )        │ chips 44px, caixa alta 12/16
│ ( BASQUETE )( TÊNIS )( VÔLEI DE PRAIA )      │
│ ( NATAÇÃO )( MMA / UFC )( GINÁSTICA )        │
│ ( SURFE )( SKATE )( JUDÔ )                   │
│ ( ATLETISMO )( FUTSAL )( NFL )               │
│                                              │
│ 2 DE 3 ESCOLHIDOS                            │ 12/16 peso 700
├──────────────────────────────────────────────┤
│ [         CONTINUAR         ]     Pular      │ botão tinta (sem clube ainda)
└──────────────────────────────────────────────┘
```

**Desktop (1280)** — faixa neutra em toda a largura; conteúdo em coluna central de
640 px; chips em 3 a 4 por linha; barra de ação centrada.

**Tentativa de 4º favorito (CA-03.3)**: chips não selecionados ganham
`aria-disabled="true"`, o contador vira "3 DE 3 ESCOLHIDOS" e aparece, em `aria-live`:
**"Até 3 esportes favoritos; desmarque um para trocar."**

---

### T-01 · Onboarding — passo 2 de 2 (time do coração)

**Mobile (360)**
```
┌──────────────────────────────────────────────┐
│▚▚▚ faixa neutra ▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚│
├──────────────────────────────────────────────┤
│ ←  PASSO 2 DE 2                              │
│ ████████████████████████████████████         │
│                                              │
│ QUAL É O SEU TIME?                           │ 28/32 peso 800
│ Clubes da Série A de 2026.                   │
│                                              │
│ 🔍 Buscar time                               │ 48px, raio 6px
│                                              │
│ ◉ ⬤SPA  SÃO PAULO                            │ linha 56px, avatar 32px
│ ○ ⬤PAL  PALMEIRAS                            │ nome 18/24 peso 700
│ ○ ⬤COR  CORINTHIANS                          │ avatar: sigla sobre a cor do clube
│ ○ ⬤FLA  FLAMENGO                             │ (acromáticos: tinta)
│ ○ ⬤CRU  CRUZEIRO                             │
│ ···  (20 clubes)                             │
├──────────────────────────────────────────────┤
│ [         CONFIRMAR         ]     Pular      │
└──────────────────────────────────────────────┘
```

Ao confirmar, a faixa neutra é substituída pela faixa do clube na transição para a
home — 150 ms, desligada sob `prefers-reduced-motion`.

**Desktop (1280)** — lista em 3 colunas na coluna central de 640 px.

---

### T-03 · Configurações (sobreposição)

**Mobile (360)** — folha que ocupa 92% da altura
```
┌──────────────────────────────────────────────┐
│█ CONFIGURAÇÕES                       Fechar ✕│ cabeçalho preto, 56px
├──────────────────────────────────────────────┤
│ FONTES DE NOTÍCIA                            │ 12/16 peso 700 +1,2px
│ Desmarque para não ver as notícias da fonte. │ 14/20 secundário
│                                              │
│ ┌▌─────────────────────────────────────────┐ │ ▌ barra 6px tinta
│ │▌ ge                        ( FONTE FIXA )│ │ chip informativo, sem alternador
│ │▌ Multi-esporte                           │ │
│ │▌ ⚠ INSTÁVEL DESDE 05/09, 09H12           │ │ âmbar
│ │▌ O GE é fonte fixa do SportsLM e não     │ │
│ │▌ pode ser bloqueado.                     │ │
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ ESPN BRASIL                          ☑  │ │ alternador 44px
│ │▌ Futebol, F1, MMA, basquete, tênis       │ │
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ GAZETA ESPORTIVA                     ☑  │ │
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ TERRA ESPORTES                       ☐  │ │ barra em cinza quando bloqueada
│ │▌ Multi-esporte · BLOQUEADA               │ │
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ UOL ESPORTE                          ☑  │ │
│ │▌ ⚠ INSTÁVEL DESDE 04/09                  │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ESPORTES FAVORITOS                    2 DE 3 │
│ ( ✓ FUTEBOL )( ✓ VÔLEI )( FÓRMULA 1 )( … )   │
│                                              │
│ MEU TIME                                     │
│ ⬤SPA  SÃO PAULO                    [ TROCAR ]│
│                                              │
│ APARÊNCIA                                    │
│ ◉ Igual ao sistema   ○ Claro   ○ Escuro      │
│                                              │
│ PRIVACIDADE                                  │
│ Suas preferências ficam só neste navegador.  │
│ Não usamos conta nem cookies.                │
│ Enviamos 5 eventos anônimos de uso.          │
│ [ Ver quais ]   [ Desativar e apagar id ]    │
└──────────────────────────────────────────────┘
```

**Desktop (1280)** — modal centrado de 640 px, altura máxima de 80vh com rolagem
interna, cabeçalho preto fixo; esportes em 3 colunas.

O bloco do GE é o primeiro da lista e **não tem alternador** — tem o chip "FONTE FIXA"
e a frase explicativa (CA-02.3). Alternador desabilitado seria ambíguo e mal anunciado
por leitor de tela.

---

### T-04 · Escolher / trocar time (sobreposição)

**Mobile (360)**
```
┌──────────────────────────────────────────────┐
│█ ESCOLHER TIME                       Fechar ✕│
│  Clubes da Série A de 2026                   │
├──────────────────────────────────────────────┤
│ 🔍 são                                    ✕  │
│                                              │
│ ◉ ⬤SPA  SÃO PAULO                            │
│ ○ ⬤SAN  SANTOS                               │
│                                              │
│ ⚠ Trocar de time redefine seus rivais e      │ âmbar #FFF3D1 / #7A5300
│   apaga a simulação salva.                   │ (CA-06.3), só ao trocar
├──────────────────────────────────────────────┤
│ [        CONFIRMAR TROCA        ]            │
└──────────────────────────────────────────────┘
```

**Desktop (1280)** — modal de 560 px, lista em 2 colunas.

**Virada de temporada (CA-06.5)**: mesma sobreposição, com banner no topo — **"Cruzeiro
não está na Série A de 2027; escolha um novo time para continuar. Seus esportes
favoritos e fontes bloqueadas foram mantidos."**

---

### T-05 · Painel do time

**Mobile (360)**
```
┌──────────────────────────────────────────────┐
│█ SportsLM                            ◐   ⚙  █│
├──────────────────────────────────────────────┤
│▚▚▚ FAIXA DO CLUBE — listras diagonais ▚▚▚▚▚▚│ 116px — `FaixaClube` completa,
│▚                                            ▚│ idêntica à da Home (T-02);
│▚  ⬤    SÃO PAULO                     6      ▚│ "TROCAR TIME" não mora mais
│▚  SPA   BRASILEIRÃO SÉRIE A · 2026  42 PTS  ▚│ dentro dela (ver abaixo)
│▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚│
├──────────────────────────────────────────────┤
│                        [ TROCAR TIME ]       │ botão fantasma, 44px, fora da
├──────────────────────────────────────────────┤ faixa, alinhado à direita
│ ┌█ PRÓXIMO JOGO ███████████████████████████┐ │
│ │  DOM, 13/09 · 16H00                      │ │
│ │  Fluminense × São Paulo                  │ │
│ │  fora · 24ª rodada · Maracanã            │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ CAMPEONATOS DE 2026     ATUALIZADO HÁ 42 MIN │ 28/32 peso 800
│                                              │
│ ┌▌─────────────────────────────────────────┐ │ ▌ cor do clube
│ │▌ BRASILEIRÃO SÉRIE A                   ▸ │ │ 18/24 peso 700
│ │▌ ● EM ANDAMENTO — 24ª RODADA             │ │ ponto + texto (nunca só cor)
│ │▌ 6º · 42 PTS · 23 J · 12V 6E 5D          │ │ 15/20 peso 700 tabular
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ COPA SUL-AMERICANA                    ▸ │ │
│ │▌ ● EM ANDAMENTO — QUARTAS DE FINAL       │ │
│ │▌ Próximo: qui, 17/09 · 21h30             │ │
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │ ▌ cinza quando encerrado
│ │▌ COPA DO BRASIL                        ▸ │ │
│ │▌ ○ ELIMINADO NAS OITAVAS · 13/08         │ │
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ CAMPEONATO PAULISTA                   ▸ │ │
│ │▌ ✓ CONCLUÍDO — CAMPEÃO                   │ │
│ └──────────────────────────────────────────┘ │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │ borda tracejada, sem barra
│   SUPERCOPA REI                              │ sem cor de clube, sem vermelho
│   — SEM DADOS                                │
│   Cobertura indisponível nesta versão.       │ 14/20 secundário (legível)
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
├──────────────────────────────────────────────┤
│█ NOTÍCIAS    MEU TIME    COMPARATIVO        █│
│█             ▔▔▔▔▔▔▔▔                       █│
└──────────────────────────────────────────────┘
```

**Desktop (1280)**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│█ SportsLM        NOTÍCIAS      MEU TIME      COMPARATIVO                           ◐ TEMA      ⚙    █│
│█                               ▔▔▔▔▔▔▔▔                                                             █│
├──────────────────────────────────────────────────────────────────────────────────────────────────────┤
│▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚│
│▚                                                                                                    ▚│ `FaixaClube` completa, idêntica
│▚   ⬤       SÃO PAULO                                                                     6         ▚│ à da Home (T-02) — sem
│▚  SPA      BRASILEIRÃO SÉRIE A · 2026                                                   42 PTS     ▚│ "TROCAR TIME" dentro dela
│▚                                                                                                    ▚│
│▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚│
│                                                                      [ TROCAR TIME ]                  │ botão fantasma, fora da faixa
├────────────────────────────────────┬─────────────────────────────────────────────────────────────────┤
│ ┌█ PRÓXIMO JOGO ██████████████████┐│ CAMPEONATOS DE 2026                     ATUALIZADO HÁ 42 MIN    │
│ │  DOM, 13/09 · 16H00             ││ 6 campeonatos · 1 sem cobertura                                 │
│ │  Fluminense ×                   ││                                                                 │
│ │  São Paulo                      ││ ┌▌──────────────────────┐ ┌▌──────────────────────┐            │
│ │  fora · 24ª rodada · Maracanã   ││ │▌ BRASILEIRÃO SÉRIE A ▸│ │▌ COPA SUL-AMERICANA  ▸│            │
│ └─────────────────────────────────┘│ │▌ ● EM ANDAMENTO      │ │▌ ● EM ANDAMENTO       │            │
│ ┌█ A BRIGA NO BRASILEIRÃO ████████┐│ │▌ 24ª rodada          │ │▌ Quartas de final     │            │
│ │  1º PAL 47 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ││ │▌ 6º · 42 PTS         │ │▌ qui, 17/09 · 21h30   │            │
│ │  5º COR 43 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    ││ └──────────────────────┘ └──────────────────────┘            │
│ │  6º SPA 42 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ seu ││ ┌▌──────────────────────┐ ┌▌──────────────────────┐            │
│ │  [ SIMULAR OS JOGOS QUE FALTAM]││ │▌ COPA DO BRASIL      ▸│ │▌ CAMPEONATO PAULISTA ▸│            │
│ └─────────────────────────────────┘│ │▌ ○ ELIMINADO NAS      │ │▌ ✓ CONCLUÍDO —        │            │
│                                    │ │▌   OITAVAS · 13/08    │ │▌   CAMPEÃO            │            │
│                                    │ └──────────────────────┘ └──────────────────────┘            │
│                                    │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                                       │
│                                    │   SUPERCOPA REI                                                │
│                                    │   — SEM DADOS                                                  │
│                                    │   Cobertura indisponível nesta versão.                         │
│                                    │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘                                       │
└────────────────────────────────────┴─────────────────────────────────────────────────────────────────┘
```

**Ordenação dos cartões** (CA-07.4), igual nas duas larguras: em andamento (pela data
do próximo jogo) → não iniciados → eliminados → concluídos → sem dados.

**Revisado em 2026-09-09, a pedido do usuário**: a faixa aqui era uma variante própria
desta tela — mais alta, com "[ TROCAR TIME ]" embutido dentro dela. Isso divergia da
faixa da Home (T-02) e criava uma segunda variante de `FaixaClube` sem necessidade.
Agora T-05 usa a mesma `FaixaClube` completa da Home, com o mesmo conteúdo (avatar,
nome, campeonato, pontos); "Trocar time" continua acessível, só que como botão
fantasma separado, logo abaixo da faixa.

---

### T-06 · Detalhe do campeonato

**Mobile (360)** — Brasileirão (pontos corridos, com zonas)
```
┌──────────────────────────────────────────────┐
│█ ←  BRASILEIRÃO SÉRIE A                     █│ cabeçalho preto, voltar 44px
├──────────────────────────────────────────────┤
│ ⚠ ATUALIZADO HÁ 7 H — PODE ESTAR DESATUALIZADO│ âmbar (CA-08.11)
├──────────────────────────────────────────────┤
│ ┌█ RESUMO ██████████████████████████████████┐│
│ │  6º       42 PTS       61,4%              ││ nº 48px peso 800 (camisa menor)
│ │  23 J · 12 V · 6 E · 5 D · 38 GP · 24 GC  ││ 15/20 peso 700 tabular
│ │  SALDO +14                                ││
│ └───────────────────────────────────────────┘│
│ [ TABELA ][ DISPUTADAS ][ PRÓXIMAS ]         │ abas 44px, ativa sublinhada
├──────────────────────────────────────────────┤
│ ┌───┬──────────────┬───┬───┬────┬────┐       │ região rolável anunciada
│ │ # │ CLUBE        │ P │ J │ SG │ %  │  →    │ cabeçalho 12/16 caixa alta
│ ├───┼──────────────┼───┼───┼────┼────┤       │
│ │▌1 │ PAL Palmeiras│47 │23 │+21 │68,1│       │ ▌ faixa da zona, 4px
│ │▌2 │ BOT Botafogo │45 │23 │+18 │65,2│       │
│ │▌3 │ FLA Flamengo │44 │23 │+19 │63,8│       │
│ │▌4 │ CRU Cruzeiro │43 │23 │+12 │62,3│       │
│ │▌5 │ COR Corinth. │43 │23 │ +9 │62,3│       │
│ │▌6 │►SPA São Paulo│42 │23 │+14 │61,4│       │ linha do time: fundo --clube-suave
│ │▌7 │ CAM Atlético │40 │23 │ +7 │58,0│       │ + barra esquerda na cor do clube
│ │ …                                  │       │
│ │▌19│ JUV Juventude│21 │23 │−19 │30,4│       │
│ │▌20│ SPT Sport    │18 │23 │−25 │26,1│       │
│ └───┴──────────────┴───┴───┴────┴────┘       │
│ ▌LIBERTADORES  ▌PRÉ-LIBERTADORES             │ legenda (CA-18.1)
│ ▌SUL-AMERICANA ▌REBAIXAMENTO                 │
└──────────────────────────────────────────────┘
```

Aba **DISPUTADAS** (CA-08.6):
```
│ SÁB, 05/09 · 23ª RODADA                      │ 12/16 caixa alta
│ ┌▌─────────────────────────────────────────┐ │ ▌ verde (vitória)
│ │▌ (V) São Paulo 2 × 1 Atlético-MG · casa  │ │ letra + cor
│ └──────────────────────────────────────────┘ │
│ DOM, 30/08 · 22ª RODADA                      │
│ ┌▌─────────────────────────────────────────┐ │ ▌ cinza (empate)
│ │▌ (E) Grêmio 1 × 1 São Paulo · fora       │ │
│ └──────────────────────────────────────────┘ │
│ QUA, 27/08 · 21ª RODADA                      │
│ ┌▌─────────────────────────────────────────┐ │ ▌ vermelho (derrota)
│ │▌ (D) São Paulo 0 × 2 Palmeiras · casa    │ │
│ └──────────────────────────────────────────┘ │
```

Aba **PRÓXIMAS** (CA-08.7 a CA-08.10):
```
│ DOM, 13/09 · 16H00 · 24ª RODADA              │
│   Fluminense × São Paulo · fora · Maracanã   │
│ SÁB, 19/09 · HORÁRIO A DEFINIR · 25ª RODADA  │
│   São Paulo × Vasco · casa · Morumbis        │
│ DATA A DEFINIR · 26ª RODADA                  │
│   Bahia × São Paulo · fora                   │
│ ⏳ AGUARDANDO RESULTADO                       │
│   sex, 04/09 · 23ª rodada · Ceará × São Paulo│
│ ⚠ ADIADA — NOVA DATA: 21/10                  │
│   São Paulo × Internacional · casa           │
```

**Mata-mata (CA-08.4)** — sem tabela:
```
│█ ←  COPA SUL-AMERICANA                      █│
│ ┌█ RESUMO ██████████████████████████████████┐│
│ │  QUARTAS DE FINAL                         ││
│ │  8 J · 5 V · 2 E · 1 D                    ││
│ └───────────────────────────────────────────┘│
│ ┌█ QUARTAS DE FINAL █████████████████████████┐│
│ │  São Paulo × Lanús                        ││ 24/30 peso 800
│ │  AGREGADO 1 × 0 (IDA FORA)                ││
│ │  Volta: qui, 17/09 · 21h30 · Morumbis     ││
│ └───────────────────────────────────────────┘│
│ [ DISPUTADAS ][ PRÓXIMAS ]                   │
```

**Desktop (1280)** — resumo em bloco preto de largura total; **sem abas**: tabela
completa de 10 colunas (`# · CLUBE · P · J · V · E · D · GP · GC · SG · %`) em cima,
sem rolagem, e "DISPUTADAS" e "PRÓXIMAS" lado a lado em duas colunas de 540 px abaixo.

---

### T-07 · Escolher rivais (sobreposição)

**Mobile (360)**
```
┌──────────────────────────────────────────────┐
│█ ESCOLHER RIVAIS                     Fechar ✕│
│  Até 2 clubes da Série A, além do seu time.  │
├──────────────────────────────────────────────┤
│ SELECIONADOS                                 │
│ ( ⬤PAL PALMEIRAS ✕ )  ( ⬤COR CORINTHIANS ✕ ) │ chips com cor do rival
│                                              │
│ ⚠ Até 2 rivais; remova um para trocar.       │ só ao tentar o 3º (CA-09.3)
│                                              │
│ 🔍 Buscar clube                              │
│ ☑ ⬤PAL  PALMEIRAS                            │
│ ☑ ⬤COR  CORINTHIANS                          │
│ ☐ ⬤FLA  FLAMENGO                             │
│ ☐ ⬤CRU  CRUZEIRO                             │
│ ☐ ⬤BOT  BOTAFOGO                             │
│ ···  (19 clubes — seu time não aparece)      │
├──────────────────────────────────────────────┤
│ [       CONFIRMAR RIVAIS       ]             │
└──────────────────────────────────────────────┘
```

**Remoção com palpites (CA-09.4)**: confirmação em linha — **"Remover Corinthians? Os
palpites dele na simulação serão apagados."** com `[ REMOVER ]` e `Cancelar`.

**Desktop (1280)** — modal de 560 px, lista em 2 colunas.

---

### T-08 · Comparativo no Brasileirão

**Mobile (360)** — cartões empilhados, o time do coração sempre primeiro
```
┌──────────────────────────────────────────────┐
│▚▚▚ FAIXA DO CLUBE — listras diagonais ▚▚▚▚▚▚│ 116px — `FaixaClube` completa,
│▚                                            ▚│ idêntica à da Home (T-02) e do
│▚  ⬤    SÃO PAULO                     6      ▚│ Painel (T-05) — novo nesta
│▚  SPA   BRASILEIRÃO SÉRIE A · 2026  42 PTS  ▚│ tela (rodada 3)
│▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚│
├──────────────────────────────────────────────┤
│█ COMPARATIVO · BRASILEIRÃO 2026             █│
├──────────────────────────────────────────────┤
│ ATUALIZADO HÁ 42 MIN                         │
│ ┌▌─────────────────────────────────────────┐ │ ▌ 6px na cor do CLUBE DO CORAÇÃO
│ │▌ ⬤SPA  SÃO PAULO              SEU TIME   │ │ selo em --clube-suave
│ │▌                                         │ │
│ │▌  6      42 PTS      61,4%               │ │ nº 48px peso 800
│ │▌  23 J · 12V 6E 5D · SALDO +14           │ │
│ │▌  ÚLTIMOS 5:  V  E  D  V  V              │ │ letra + cor fixa do sistema
│ │▌  15 JOGOS RESTANTES                     │ │
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │ ▌ na cor do rival
│ │▌ ⬤PAL  PALMEIRAS                         │ │
│ │▌  1      47 PTS      68,1%      +5 PTS   │ │ diferença com sinal
│ │▌  23 J · 14V 5E 4D · SALDO +21           │ │
│ │▌  ÚLTIMOS 5:  V  V  E  V  D              │ │
│ │▌  15 JOGOS RESTANTES                     │ │
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ ⬤COR  CORINTHIANS                       │ │
│ │▌  5      43 PTS      62,3%      +1 PT    │ │
│ │▌  23 J · 12V 7E 4D · SALDO +9            │ │
│ │▌  ÚLTIMOS 5:  E  V  V  D  E              │ │
│ │▌  15 JOGOS RESTANTES                     │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ JOGOS QUE FALTAM                             │ 28/32 peso 800
│ [ SÃO PAULO ][ PALMEIRAS ][ CORINTHIANS ]    │ abas
│ 24ª · dom, 13/09 · Fluminense (fora)         │
│ 25ª · sáb, 19/09 · Vasco (casa)              │
│ 26ª · data a definir · Bahia (fora)          │
│ ⚔ 27ª · sáb, 03/10 · Palmeiras (casa)        │
│      CONFRONTO DIRETO                        │ ícone + texto (CA-10.3)
│ ···  (15 jogos)                              │
├──────────────────────────────────────────────┤
│ [        ABRIR SIMULAÇÃO        ]            │ ação primária, cor do clube
├──────────────────────────────────────────────┤
│█ NOTÍCIAS    MEU TIME    COMPARATIVO        █│
│█                         ▔▔▔▔▔▔▔▔▔▔▔        █│
└──────────────────────────────────────────────┘
```

**Desktop (1280)**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚│
│▚   ⬤       SÃO PAULO                                                                     6         ▚│ `FaixaClube` completa, idêntica
│▚  SPA      BRASILEIRÃO SÉRIE A · 2026                                                   42 PTS     ▚│ à da Home (T-02) e do Painel
│▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚│ (T-05) — novo nesta tela
├──────────────────────────────────────────────────────────────────────────────────────────────────────┤
│█ COMPARATIVO · BRASILEIRÃO 2026            ATUALIZADO HÁ 42 MIN          [ ABRIR SIMULAÇÃO ]        █│
├────────────────────────────────┬────────────────────────────────┬────────────────────────────────────┤
│▌⬤SPA SÃO PAULO      SEU TIME   │▌⬤PAL PALMEIRAS                 │▌⬤COR CORINTHIANS                   │
│▌                               │▌                               │▌                                   │
│▌ 6     42 PTS    61,4%         │▌ 1     47 PTS   68,1%   +5 PTS │▌ 5     43 PTS   62,3%     +1 PT    │
│▌ 23 J · 12V 6E 5D · SALDO +14  │▌ 23 J · 14V 5E 4D · SALDO +21  │▌ 23 J · 12V 7E 4D · SALDO +9       │
│▌ ÚLTIMOS 5: V E D V V          │▌ ÚLTIMOS 5: V V E V D          │▌ ÚLTIMOS 5: E V V D E              │
│▌ 15 JOGOS RESTANTES            │▌ 15 JOGOS RESTANTES            │▌ 15 JOGOS RESTANTES                │
├────────────────────────────────┼────────────────────────────────┼────────────────────────────────────┤
│ JOGOS QUE FALTAM               │ JOGOS QUE FALTAM               │ JOGOS QUE FALTAM                   │
│ 24ª dom 13/09 Fluminense (F)   │ 24ª sáb 12/09 Ceará (C)        │ 24ª dom 13/09 Grêmio (C)           │
│ 25ª sáb 19/09 Vasco (C)        │ 25ª dom 20/09 Botafogo (F)     │ 25ª sáb 19/09 Mirassol (F)         │
│ 26ª  data a definir  Bahia (F) │ 26ª  data a definir  Sport (C) │ 26ª sáb 26/09 Fortaleza (C)        │
│ ⚔ 27ª sáb 03/10 Palmeiras (C)  │ ⚔ 27ª sáb 03/10 São Paulo (F)  │ 27ª dom 04/10 Vitória (F)          │
│    CONFRONTO DIRETO            │    CONFRONTO DIRETO            │                                    │
│ ···                            │ ···                            │ ···                                │
└────────────────────────────────┴────────────────────────────────┴────────────────────────────────────┘
```

Cada coluna usa a barra de 6 px na cor **daquele** clube — é o que faz a comparação
ser lida de relance, que é o que o stakeholder pediu ("ver a briga").

**Revisado em 2026-09-09, a pedido do usuário**: a tela não tinha faixa do clube — o
comparativo começava direto no cabeçalho "COMPARATIVO · BRASILEIRÃO 2026". Isso quebrava
a consistência de identidade que a Home (T-02) e o Painel (T-05) já tinham. Agora as três
telas principais abrem com a mesma `FaixaClube` completa (Seção 3.8), sem variantes
divergentes de altura ou conteúdo entre elas — o cartão "SEU TIME" logo abaixo continua
existindo e não muda: ele é `CartaoIngresso`, não `FaixaClube`, e cumpre outro papel
(comparar, não identificar a tela).

---

### T-09 · Simulação de cenário

**Mobile (360)**
```
┌──────────────────────────────────────────────┐
│█ ←  SIMULAÇÃO · BRASILEIRÃO 2026            █│
├──────────────────────────────────────────────┤
│ ┌█ PROJEÇÃO ████████████████████████████████┐│ bloco preto fixo ao rolar
│ │  1º ⬤PAL PALMEIRAS     58 PTS   MÁX 92    ││ 24/30 peso 800
│ │  2º ⬤SPA SÃO PAULO     55 PTS   MÁX 87    ││ linha do time: --clube-suave
│ │  3º ⬤COR CORINTHIANS   49 PTS   MÁX 88    ││
│ │  Projeção entre os 3 clubes comparados.   ││ 14/20 — NUNCA omitir
│ │  Não é a posição na tabela.               ││ (CA-11.10)
│ │  Partida sem palpite conta 0 ponto.       ││ 12/16 secundário
│ └───────────────────────────────────────────┘│
│                                              │
│ ⓘ 2 palpites viraram resultado real e foram  │ aria-live (CA-11.6)
│   travados.                            [OK]  │
│                                              │
│ 24ª RODADA · 13/09                           │ 12/16 caixa alta +1,2px
│ ┌▌─────────────────────────────────────────┐ │ ▌ cor do clube da linha
│ │▌ São Paulo × Fluminense · fora           │ │ legend do fieldset
│ │▌  ( V )  ( E )  ( D )  ( — )             │ │ rádios 44px, letra + preenchimento
│ │▌    ◉                                    │ │
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ Palmeiras × Ceará · casa                │ │
│ │▌  ( V )  ( E )  ( D )  ( — )             │ │
│ │▌                        ◉                │ │ sem palpite (padrão)
│ └──────────────────────────────────────────┘ │
│ ┌▌─────────────────────────────────────────┐ │ ▌ cinza quando travada
│ │▌ Corinthians × Grêmio · casa   🔒 DISPUTADA│ │
│ │▌ RESULTADO REAL: 2 × 0 · VITÓRIA         │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ 27ª RODADA · 03/10                           │
│ ┌▌─────────────────────────────────────────┐ │
│ │▌ ⚔ São Paulo × Palmeiras                 │ │
│ │▌ CONFRONTO DIRETO                        │ │
│ │▌  ( V )  ( E )  ( D )  ( — )             │ │
│ │▌           ◉                             │ │
│ │▌ Empate: 1 ponto para cada.              │ │ espelho explicado em texto
│ └──────────────────────────────────────────┘ │
│ ···  (15 rodadas)                            │
├──────────────────────────────────────────────┤
│ [ LIMPAR CENÁRIO ]                           │ destrutiva, secundária
└──────────────────────────────────────────────┘
```

**Desktop (1280)** — matriz por rodada, um clube por coluna
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│█ ←  SIMULAÇÃO · BRASILEIRÃO 2026                                              [ LIMPAR CENÁRIO ]    █│
├──────────────────────────────────────────────────────────────────────────────────────────────────────┤
│█ PROJEÇÃO ██████████████████████████████████████████████████████████████████████████████████████████ │
│  1º ⬤PAL PALMEIRAS 58 PTS (MÁX 92)   2º ⬤SPA SÃO PAULO 55 PTS (MÁX 87)   3º ⬤COR CORINTHIANS 49 (88) │
│  Projeção entre os 3 clubes comparados. Não é a posição na tabela.  Sem palpite conta 0; máximo, 3.   │
├────────────┬───────────────────────────┬───────────────────────────┬─────────────────────────────────┤
│ RODADA     │ ⬤SPA SÃO PAULO            │ ⬤PAL PALMEIRAS            │ ⬤COR CORINTHIANS                │
├────────────┼───────────────────────────┼───────────────────────────┼─────────────────────────────────┤
│ 24ª        │ Fluminense (F)            │ Ceará (C)                 │ Grêmio (C)        🔒 2 × 0      │
│ 13/09      │ (V)(E)(D)(—)   ◉V         │ (V)(E)(D)(—)      ◉—      │ DISPUTADA · VITÓRIA             │
├────────────┼───────────────────────────┼───────────────────────────┼─────────────────────────────────┤
│ 25ª        │ Vasco (C)                 │ Botafogo (F)              │ Mirassol (F)                    │
│ 19/09      │ (V)(E)(D)(—)   ◉V         │ (V)(E)(D)(—)  ◉E          │ (V)(E)(D)(—)   ◉V               │
├────────────┼───────────────────────────┼───────────────────────────┼─────────────────────────────────┤
│ 27ª  ⚔     │ Palmeiras (C)             │ São Paulo (F)             │ Vitória (F)                     │
│ 03/10      │ (V)(E)(D)(—)     ◉E       │ (V)(E)(D)(—)     ◉E       │ (V)(E)(D)(—)      ◉—            │
│            │ CONFRONTO DIRETO — espelhado                          │                                 │
├────────────┴───────────────────────────┴───────────────────────────┴─────────────────────────────────┤
│ ACUMULADO POR RODADA                                                                                 │
│ PAL ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  58        barras na cor de cada clube                              │
│ SPA ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   55                                                                 │
│ COR ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      49                                                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Hierarquia**: (1) bloco PROJEÇÃO fixo no topo — é a resposta que o usuário procura e
ele precisa vê-la mudar ao palpitar; (2) o aviso de que a projeção é só entre os
comparados, dentro do mesmo bloco, sem chance de rolar para fora da tela; (3) a grade
de palpites; (4) "LIMPAR CENÁRIO" como ação destrutiva secundária, sempre com
confirmação (CA-11.7).

---

## 3. Design System — direção "Camisa"

Sistema **novo**, que substitui integralmente o da rodada 1. Valores definitivos, com
contraste calculado e declarado. Nenhum valor literal de cor, tamanho ou espaçamento
aparece no código fora do arquivo de tokens — a **única exceção** são as cores de clube,
que vivem em `clubes-2026.json` porque são dado de configuração validado (ADR-017).

### 3.1 Princípios da direção

1. **O clube governa a tela.** Faixa listrada no topo, número de camisa, barras e
   botão primário na cor do time.
2. **Base clara e quente**, não branco clínico: papel `#FAF7F2`, cartões brancos.
3. **Preto estrutura, cor identifica.** Navegação, tiras de bloco e contornos são
   tinta; a cor é do clube. Isso mantém a tela legível com 20 paletas diferentes.
4. **Tipografia pesada e apertada**, com rótulos em caixa alta espaçada — vocabulário
   de placar e de ingresso.
5. **Cartão com cara de ingresso**: raio pequeno, borda fina, barra colorida de 6 px na
   esquerda, etiqueta tonal em caixa alta.
6. **Nada de imagem**: listras e barras são CSS; sem escudo, sem foto (I-14, ADR-016).

### 3.2 Cores do sistema — tema claro

| Token | Valor | Contraste | Onde é usado |
|---|---|---|---|
| `--cor-fundo` | `#FAF7F2` | — | Papel da página |
| `--cor-superficie` | `#FFFFFF` | — | Cartão de notícia, cartão de campeonato, modal |
| `--cor-superficie-2` | `#F1ECE4` | — | Linha alternada de tabela, bloco do GE |
| `--cor-borda` | `#E4DFD6` | 1,2:1 vs fundo | Separadores e bordas decorativas |
| `--cor-borda-forte` | `#16181A` | **16,8:1** vs fundo | Contorno de 2 px dos blocos pretos e contorno obrigatório de 1 px de qualquer superfície na cor do clube |
| `--cor-tinta` | `#16181A` | **16,8:1** vs fundo | Texto principal, navegação, tiras de bloco |
| `--cor-texto-secundario` | `#5C6570` | **5,5:1** vs fundo | Resumo, metadados, carimbo |
| `--cor-nav` | `#16181A` | — | Barra de navegação |
| `--cor-nav-texto` | `#A8B0BA` | **8,2:1** vs nav | Item inativo da navegação |
| `--cor-nav-texto-ativo` | `#FFFFFF` | **18,0:1** vs nav | Item ativo |
| `--cor-aviso-fundo` | `#FFF3D1` | — | Banner de alerta, aviso de troca de time |
| `--cor-aviso-texto` | `#7A5300` | **6,2:1** vs aviso-fundo · **6,4:1** vs fundo | "instável desde", "pode estar desatualizado" |
| `--cor-erro-fundo` | `#FDECEA` | — | Bloco de erro |
| `--cor-erro-texto` | `#B3261E` | **6,1:1** vs fundo | Erro de carregamento |
| `--cor-vitoria` | `#0E6B45` | **6,1:1** vs fundo | Letra **V** |
| `--cor-empate` | `#5C6570` | **5,5:1** vs fundo | Letra **E** |
| `--cor-derrota` | `#B3261E` | **6,1:1** vs fundo | Letra **D** |
| `--cor-foco` | `#1F6FB2` | **4,9:1** vs fundo | Anel de foco — **nunca** cor de clube |
| `--cor-esmaecido` | `#8A9099` | 3,0:1 | **Só** borda tracejada e ícone do cartão "sem dados"; nunca texto pequeno |

**Zonas da tabela** (RF-18) — faixa de 4 px + legenda textual + `aria-label` na linha:
`--zona-libertadores #0E6B45` · `--zona-pre-libertadores #1F6FB2` ·
`--zona-sul-americana #5C6570` · `--zona-rebaixamento #B3261E`. São **cores fixas do
sistema**, nunca do clube — zona é informação, e informação não pode mudar de cor
conforme o time do usuário.

### 3.3 Cores do sistema — tema escuro

| Token | Valor | Contraste |
|---|---|---|
| `--cor-fundo` | `#121316` | — |
| `--cor-superficie` | `#1A1C20` | — |
| `--cor-superficie-2` | `#24272C` | — |
| `--cor-borda` | `#2C3037` | — |
| `--cor-borda-forte` | `#7A828C` | **4,8:1** vs fundo |
| `--cor-tinta` (texto) | `#F2EFEA` | **16,3:1** vs fundo |
| `--cor-texto-secundario` | `#A8B0BA` | **8,6:1** vs fundo |
| `--cor-nav` | `#0A0B0D` | 1,05:1 vs fundo → **exige borda inferior de 1 px em `--cor-borda`** |
| `--cor-nav-texto` / `--cor-nav-texto-ativo` | `#A8B0BA` / `#FFFFFF` | 8,0:1 / 17,5:1 vs nav |
| `--cor-aviso-fundo` / `--cor-aviso-texto` | `#33290F` / `#F5C860` | **12,0:1** vs fundo |
| `--cor-erro-texto` | `#F2857C` | **7,5:1** vs fundo |
| `--cor-vitoria` / `--cor-empate` / `--cor-derrota` | `#4FC98D` / `#A8B0BA` / `#F2857C` | 9,1 / 8,6 / 7,5 |
| `--cor-foco` | `#7FC0F0` | **9,5:1** vs fundo |

**Comportamento**: padrão `prefers-color-scheme`; o usuário escolhe em T-03 entre
"Igual ao sistema", "Claro" e "Escuro" (persistido em `sportslm.tema.v1`). No tema
escuro, elevação é feita por **borda**, nunca por sombra, e os "blocos pretos" viram
blocos de `--cor-superficie-2` com contorno de 2 px em `--cor-borda-forte` — o preto
sobre preto não funcionaria.

### 3.4 Cores de clube — os seis tokens derivados

Derivados da cor oficial e **validados no pipeline** (ADR-017). O navegador só aplica.

| Token | Papel | Alvo de contraste |
|---|---|---|
| `--clube-identidade` | Faixa do topo, barra de 6 px do cartão, botão primário, barra de pontuação, avatar | **Sem alvo de cor** — em troca, toda superfície que o usa tem contorno de 1 px em `--cor-borda-forte` (WCAG 1.4.11 por delimitação) |
| `--clube-faixa-b` | Segundo tom da listra diagonal | Idem |
| `--clube-identidade-texto` | Texto e ícone **sobre** a identidade (nome do clube, número de camisa, rótulo do botão) | **≥ 4,5:1** contra identidade **e** contra faixa-b |
| `--clube-acento` | Cor em tamanho de texto sobre fundo claro: número, link, ênfase | **≥ 4,5:1** vs `--cor-fundo` e vs `--cor-superficie` |
| `--clube-acento-sobre-escuro` | Sublinhado do item ativo na navegação preta; ênfase no tema escuro | **≥ 4,5:1** vs `--cor-nav` e vs fundo escuro |
| `--clube-suave` / `--clube-suave-escuro` | Fundo tonal: linha do time na tabela, selo "SEU TIME", etiqueta de esporte | `--cor-tinta` sobre ele **≥ 4,5:1** |

**Por que dois tokens de cor e não um** — é o ponto que faz a direção funcionar com
qualquer clube: a cor **crua** fica onde ela é reconhecida (superfície grande) e a cor
**ajustada** fica onde ela precisa ser legível (tamanho de texto). O amarelo do Mirassol
continua amarelo vivo na faixa, com texto preto por cima, e vira âmbar escuro só nos
números e links.

**Exemplos derivados** (para conferência do mockup):

| Clube | corBase | identidade | identidade-texto | acento | Observação |
|---|---|---|---|---|---|
| São Paulo | `#E30613` | `#E30613` | `#FFFFFF` (4,9:1) | `#E30613` (4,6:1) | Passa sem ajuste |
| Mirassol | `#FFDD00` | `#FFDD00` | `#16181A` (13,3:1) | `~#7A5B00` | Acento escurecido até 4,5:1 |
| Corinthians | preto e branco | `#16181A` | `#FFFFFF` (18,0:1) | `#16181A` | Acromático: faixa-b `#3A3F45` |
| Palmeiras | `#006437` | `#006437` | `#FFFFFF` (7,4:1) | `#006437` | Passa sem ajuste |

**Sem time escolhido**: identidade neutra, idêntica ao tratamento acromático — tinta com
listras em `#3A3F45`. Escolher o time acende a tela.

**Regras duras**
- Cor de clube **nunca** é a única pista de significado (WCAG 1.4.1). V/E/D, zonas,
  estado de fonte e status de campeonato usam cores fixas do sistema, com letra ou
  rótulo textual.
- Cor de clube **nunca** é usada no anel de foco.
- Cor de clube **nunca** substitui `--cor-erro-texto` nem `--cor-aviso-texto`.

### 3.5 Tipografia

Pilha do sistema, **sem webfont** (ADR-016):
`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
Números de placar, tabela e projeção: `font-variant-numeric: tabular-nums`.

| Token | Tamanho / entrelinha | Peso | Espaçamento | Uso |
|---|---|---|---|---|
| `--txt-camisa` | 72 / 64 px (desktop 96 / 88) | 800 | −0,04em | Número da posição na faixa do clube |
| `--txt-camisa-sm` | 48 / 44 px | 800 | −0,03em | Número no resumo do campeonato e no comparativo |
| `--txt-display` | 32 / 34 px (desktop 40 / 40) | 800 | −0,03em | Nome do clube na faixa |
| `--txt-titulo` | 28 / 32 px | 800 | −0,02em | Título de seção ("SEUS ESPORTES") |
| `--txt-manchete` | 24 / 30 px | 800 | −0,01em | Manchete principal, nome do confronto |
| `--txt-manchete-sec` | 18 / 24 px | 700 | −0,01em | Manchetes secundárias, nome de campeonato |
| `--txt-dado` | 15 / 20 px | 700 | 0 | Números de tabela e de resumo |
| `--txt-corpo` | 16 / 24 px | 400 | 0 | Corpo padrão |
| `--txt-corpo-sm` | 14 / 20 px | 400 | 0 | Resumo da notícia, texto de apoio |
| `--txt-rotulo` | 12 / 16 px | 700 | +1,2 px, caixa alta | Rótulos de bloco, etiqueta de esporte, status |
| `--txt-meta` | 12 / 16 px | 600 | +0,6 px | Fonte, hora, carimbo de frescor |

Mínimo absoluto **12 px**; campos de entrada nunca abaixo de **16 px** (evita zoom
automático no iOS); largura de linha de texto corrido limitada a **68 caracteres**.

**Peso 800 e a pilha do sistema**: parte dos aparelhos não tem 800 e renderiza 700.
Aceito conscientemente — a alternativa seria uma webfont, que custaria o orçamento de
rede que sustenta M3 (ADR-016). Registrado como perda em §7.

### 3.6 Espaçamento, raio, sombra, alvo

- **Espaçamento** (escala de 4): `--esp-1` 4 · `--esp-2` 8 · `--esp-3` 12 ·
  `--esp-4` 16 · `--esp-5` 24 · `--esp-6` 32 · `--esp-7` 48 · `--esp-8` 64.
  Margem lateral: 16 px no celular, 24 px em tablet, contêiner de 1120 px centrado no
  desktop.
- **Raio** (deliberadamente pequeno — linguagem de ingresso, não de bolha):
  `--raio-sm` 4 px (etiqueta, chip) · `--raio-md` 6 px (cartão, botão, campo, bloco) ·
  `--raio-pill` 999 px (**apenas** avatar de clube).
- **Sombra**: a direção usa contorno, não sombra. `--sombra-overlay`
  `0 8px 24px rgba(22,24,26,.18)` é a única, exclusiva de modal e folha.
- **Barra do cartão**: 6 px, borda esquerda, sempre acompanhada de etiqueta textual.
- **Listra diagonal**: `repeating-linear-gradient(135deg, var(--clube-identidade) 0
  18px, var(--clube-faixa-b) 18px 36px)`; `aria-hidden` no elemento decorativo.
- **Alvo de toque**: mínimo **44 × 44 px** (acima do mínimo de 24 px de WCAG 2.5.8);
  8 px entre alvos adjacentes.
- **Movimento**: 120-150 ms, `ease-out`; zerado sob `prefers-reduced-motion`. Nenhuma
  animação carrega informação.
- **Foco**: `outline: 3px solid var(--cor-foco); outline-offset: 2px`. Nunca removido,
  nunca na cor do clube.

### 3.7 Ícones

SVG em linha, traço de 1,75 px (mais encorpado, coerente com a tipografia), 20 ou
24 px: engrenagem, voltar, lupa, `✕`, `⚠`, `ⓘ`, `🔒`, `⚔`, `⏳`, `◐`, `▸`.
**Todo ícone que carrega significado vem acompanhado de texto.**

### 3.8 Componentes — anatomia e variantes

Os seis primeiros são específicos desta direção e concentram o risco de implementação.

**1. `FaixaClube`** *(novo, define a direção)*
- Anatomia: fundo com listras diagonais (`identidade` + `faixaB`), contorno de 1 px em
  `--cor-borda-forte`, avatar circular de 44 px em `--cor-superficie` com a sigla em
  `--clube-acento`, nome do clube em `--txt-display`, linha secundária em
  `--txt-rotulo`, e o **número da posição** em `--txt-camisa` alinhado à direita, com
  os pontos abaixo em `--txt-rotulo`.
- Todo o texto usa `--clube-identidade-texto`.
- Variantes: **completa** (home T-02, painel T-05, comparativo T-08 — 116 px no
  celular, 140 px no desktop; **rodada 3**: passou a ser a única variante usada nas 3
  telas principais, sem divergência de altura/conteúdo entre elas); **compacta**
  (cabeçalhos internos — 72 px, sem número); **neutra** (sem time escolhido: tinta e
  cinza, sem número, com o texto "SPORTSLM").
- A faixa inteira é clicável na home (leva ao painel) e tem `aria-label` completo:
  "São Paulo, 6º lugar no Brasileirão Série A de 2026, 42 pontos. Abrir painel do
  time."
- O padrão de listras é `aria-hidden`.

**2. `BlocoPreto`** *(novo)*
- Anatomia: tira superior de 32 px em `--cor-tinta` com o rótulo em `--txt-rotulo` na
  cor `#FFFFFF`; corpo em `--cor-superficie`; contorno de 2 px em
  `--cor-borda-forte`; raio md.
- Variantes: **próximo jogo**, **a briga**, **projeção** (fixo ao rolar), **resumo do
  campeonato**, **campeonatos** (lista compacta no desktop).
- No tema escuro: corpo em `--cor-superficie-2`, tira em `--cor-superficie`, contorno
  em `--cor-borda-forte`.

**3. `CartaoIngresso`** *(novo — cartão de notícia e de campeonato)*
- Anatomia: barra de 6 px na borda esquerda; corpo branco; raio md; borda de 1 px em
  `--cor-borda`; `EtiquetaEsporte` + fonte + tempo na primeira linha; manchete;
  resumo de até 3 linhas; linha de "TAMBÉM EM:" quando é grupo.
- Cor da barra: **esporte** no feed (paleta fixa de 15 tons do sistema, não do clube),
  **clube** nos cartões de campeonato e de comparativo, **cinza** quando encerrado ou
  bloqueado, **tracejado sem barra** quando é "sem dados".
- Variantes: normal · agrupado (`+N fontes`) · horário estimado (`ⓘ`) · encerrado ·
  sem dados.
- O cartão inteiro é o alvo do link; o alvo tem no mínimo 44 px de altura.

**4. `NumeroCamisa`** *(novo)*
- Anatomia: número em `--txt-camisa` ou `--txt-camisa-sm`, tabular, com rótulo
  secundário abaixo em `--txt-rotulo`.
- Variantes: **sobre a faixa** (`--clube-identidade-texto`); **sobre fundo claro**
  (`--clube-acento`, que já garante 4,5:1); **sem posição** (mata-mata: mostra a fase
  em `--txt-manchete` no lugar do número).
- Acessível: o número não é decorativo — vem com texto associado ("6º lugar").

**5. `SeletorPalpite`** *(novo)*
- Anatomia: `fieldset` com `legend` = "24ª rodada — São Paulo x Fluminense, fora" e
  quatro rádios: `V`, `E`, `D`, `—` (padrão), de 44 px cada.
- Selecionado = preenchimento em `--clube-identidade` (ou cor fixa V/E/D no desktop,
  onde há três clubes na mesma linha) **e** contorno de 2 px **e** a letra — três
  pistas, nenhuma sozinha.
- Variantes: **editável** · **travado** (`🔒 DISPUTADA`, sem rádios, com o resultado
  real) · **espelhado** (confronto direto, com "CONFRONTO DIRETO" e a frase que explica
  o efeito).

**6. `BarraPontuacao`** *(novo)*
- Anatomia: barra horizontal preenchida na cor do clube, com o valor numérico ao lado;
  `role="img"` e `aria-label` com o valor ("Palmeiras, 47 pontos").
- Usada em "A BRIGA" e no acumulado da simulação. Escala comum a todos os clubes da
  comparação, com o máximo ancorado no maior valor da tela.

Componentes de base, também novos, na mesma linguagem:

| Componente | Anatomia | Variantes |
|---|---|---|
| `Botao` | 44 px, raio md, rótulo em `--txt-rotulo` | primário (fundo `--clube-identidade`, texto `--clube-identidade-texto`) · secundário (contorno tinta) · terciário (link) · destrutivo · fantasma (contorno claro; ex.: "Trocar time" em T-05, sempre fora da `FaixaClube` desde a rodada 3) |
| `Chip` | 44 px, raio sm, caixa alta | selecionável · removível · informativo ("FONTE FIXA") |
| `EtiquetaEsporte` | caixa alta 12/16 sobre fundo tonal do esporte, raio sm | 15 esportes + "GERAL" |
| `SeloFonte` | nome + ponto de estado + texto | ativa · bloqueada · instável · fixa |
| `Alternador` | 44 px, rótulo à esquerda | ligado · desligado · foco |
| `BannerAlerta` | ícone + texto + ação opcional | alerta (âmbar) · erro (vermelho) · informação (neutro) |
| `TabelaClassificacao` | `<table>` com `<caption>`, faixa de zona, linha do time em `--clube-suave` com barra na cor do clube | completa · reduzida · com/sem zonas |
| `LinhaPartida` | data, confronto, mando, placar ou horário, marcador V/E/D | disputada · próxima · sem horário · sem data · adiada · cancelada · aguardando |
| `Abas` | rótulos em caixa alta, ativa sublinhada em `--clube-acento` + `aria-selected` | 2 a 4 abas |
| `Sobreposicao` | cabeçalho preto com título e `✕`, corpo rolável, barra de ação | folha (celular) · modal (desktop) |
| `CampoBusca` | lupa, entrada, `✕` | vazio · preenchido · sem resultado |
| `EstadoVazio` | ícone, título em `--txt-titulo`, explicação, ação | por tela (Seção 4) |
| `Esqueleto` | blocos em `--cor-superficie-2` com a forma do conteúdo | cartão · linha de tabela · faixa · bloco |
| `AvatarClube` | círculo, sigla de 3 letras, fundo `--clube-identidade`, texto `--clube-identidade-texto` | 28 · 32 · 44 px |
| `CarimboFrescor` | `ⓘ`/`⚠` + `<time>`, em `--txt-meta` | normal · alerta · sem dados · pausado |

---

## 4. Estados de Tela

Os quatro estados de cada tela, com o **texto exato**. Os textos não mudaram da rodada
1 — o que mudou é a forma em que aparecem. Quando um estado não se aplica, há
justificativa.

### T-01 · Onboarding
| Estado | Texto na tela |
|---|---|
| Vazio | É o estado inicial: "QUAIS ESPORTES VOCÊ QUER EM DESTAQUE? / Escolha até 3. Dá para mudar depois." · contador "0 DE 3 ESCOLHIDOS" |
| Carregando | **Não se aplica** — os 15 esportes e os 20 clubes vêm de configuração já presente no carregamento inicial |
| Erro | "Não conseguimos carregar a lista de clubes agora. Você pode continuar e escolher seu time depois." + `[ CONTINUAR SEM ESCOLHER ]` |
| Preenchido | "2 DE 3 ESCOLHIDOS"; no passo 2, rádio marcado e `[ CONFIRMAR ]` habilitado |
| Visual | Faixa **neutra** em ambos os passos; a identidade do clube só aparece após a confirmação |

### T-02 · Home
| Estado | Texto na tela |
|---|---|
| Vazio (sem notícia) | "Ainda não há notícias — atualizado há 3 min." (CA-04.4) |
| Vazio (sem favorito) | Seção "SEUS ESPORTES" substituída por: "Escolha até 3 esportes favoritos para ver o que mais te interessa aqui." + `[ ESCOLHER ESPORTES ]` (CA-05.4) |
| Vazio (favoritos sem notícia) | "Sem notícias recentes de Futebol e Vôlei — atualizado há 12 min." (CA-05.3) |
| Vazio (sem time) | Faixa **neutra** com "SPORTSLM"; os blocos PRÓXIMO JOGO e A BRIGA são substituídos por um único bloco: "Escolha seu time para ver o painel com todos os campeonatos do ano." + `[ ESCOLHER MEU TIME ]`. As notícias sobem na tela |
| Vazio (todas as bloqueáveis bloqueadas) | Feed segue com o GE; abaixo: "Você bloqueou 4 fontes. Estas notícias vêm do ge." (CA-02.4) |
| Carregando | Faixa do clube já renderizada (vem de configuração local, não espera rede); 6 esqueletos de cartão no feed, 2 em favoritos, 2 blocos pretos em esqueleto; carimbo mostra "CARREGANDO…" |
| Erro | "Não conseguimos carregar as notícias agora. Verifique sua conexão." + `[ TENTAR DE NOVO ]`. Havendo dado anterior em memória, ele permanece e o erro vira faixa: "Mostrando as notícias de há 42 min — a última atualização falhou." |
| Preenchido | Wireframe da Seção 2 |
| Fonte instável | Faixa no topo do feed: "1 FONTE INSTÁVEL: UOL ESPORTE" (CA-04.5). Com o GE: banner global "O GE está indisponível no momento — as notícias abaixo vêm das outras fontes." (CA-01.3) |

### T-03 · Configurações
| Estado | Texto na tela |
|---|---|
| Vazio | **Não se aplica** — as 5 fontes e os 15 esportes vêm sempre de configuração (CA-01.1) |
| Carregando | O estado da fonte mostra "VERIFICANDO…" por no máximo 1 s enquanto o `status.json` chega |
| Erro | "Não conseguimos verificar o estado das fontes agora. Você ainda pode bloquear e desbloquear normalmente." |
| Preenchido | Wireframe da Seção 2 |
| Bloqueio impedido | "O GE é fonte fixa do SportsLM e não pode ser bloqueado." (CA-02.3) |
| Sem armazenamento | Faixa no topo: "Seu navegador não está guardando preferências. Tudo funciona nesta visita, mas nada será lembrado." (CA-13.3) |

### T-04 · Escolher / trocar time
| Estado | Texto na tela |
|---|---|
| Vazio (busca sem resultado) | "Nenhum clube encontrado para 'flamengo do sul'. A lista tem os 20 clubes da Série A de 2026." |
| Carregando | **Não se aplica** — lista de configuração local |
| Erro | "Não conseguimos carregar a lista de clubes de 2026." + `[ TENTAR DE NOVO ]` |
| Preenchido | Rádio marcado + `[ CONFIRMAR ]`; ao trocar, "Trocar de time redefine seus rivais e apaga a simulação salva." (CA-06.3) |
| Virada de temporada | "Cruzeiro não está na Série A de 2027; escolha um novo time para continuar. Seus esportes favoritos e fontes bloqueadas foram mantidos." (CA-06.5) |

### T-05 · Painel do time
| Estado | Texto na tela |
|---|---|
| Vazio (sem time) | Faixa neutra + "Escolha seu time para ver o painel com todos os campeonatos do ano." + `[ ESCOLHER MEU TIME ]` (CA-14.3) |
| Vazio (time sem dados) | Faixa do clube **com identidade completa, sem número** + "Sem dados disponíveis no momento. Assim que a próxima atualização trouxer informações do São Paulo, elas aparecem aqui." (CA-06.4 / CA-17.3) |
| Carregando | Faixa do clube completa exceto o número (que depende de dado); esqueleto do bloco de próximo jogo + 4 esqueletos de cartão |
| Erro | "Não conseguimos carregar o painel agora." + `[ TENTAR DE NOVO ]` |
| Preenchido | Wireframe da Seção 2 |
| Campeonato sem cobertura | "SUPERCOPA REI — SEM DADOS. Cobertura indisponível nesta versão." (CA-07.2) |
| Frescor em alerta | "ATUALIZADO HÁ 7 H — PODE ESTAR DESATUALIZADO" (CA-17.2) |
| Pausa por cota | "Atualização pausada por limite do provedor. Última atualização há 3 h." (CA-16.4 / CA-17.4) |
| Visual | **Revisado na rodada 3**: a faixa é a mesma variante completa da Home (T-02) e do Comparativo (T-08), sem variante própria desta tela. "Trocar time" é um botão fantasma separado, logo abaixo da faixa — não mora mais dentro dela |

### T-06 · Detalhe do campeonato
| Estado | Texto na tela |
|---|---|
| Vazio (sem partida disputada) | "O São Paulo ainda não jogou neste campeonato." |
| Vazio (sem partida futura) | "Não há jogos marcados no momento." |
| Vazio (sem tabela) | Aba "TABELA" não existe; o resumo exibe "Este campeonato é de mata-mata — não há tabela de classificação." (CA-08.4) |
| Carregando | Esqueleto de 8 linhas de tabela + 3 linhas de partida; bloco de resumo em esqueleto |
| Erro | "Não conseguimos carregar este campeonato." + `[ TENTAR DE NOVO ]` |
| Preenchido | Wireframe da Seção 2 |
| Estados de partida | "horário a definir" (CA-08.8) · "data a definir" (CA-10.4) · "Adiada — nova data: 21/10" e "Cancelada" (CA-08.9) · "Aguardando resultado" (CA-08.10) |
| Sem zonas configuradas | Tabela sem faixas e sem legenda, sem mensagem de erro (CA-18.2) |

### T-07 · Escolher rivais
| Estado | Texto na tela |
|---|---|
| Vazio | "Escolha até 2 clubes da Série A para comparar com o São Paulo." |
| Carregando | **Não se aplica** — lista de configuração local |
| Erro | "Não conseguimos carregar a lista de clubes." + `[ TENTAR DE NOVO ]` |
| Preenchido | Chips dos selecionados + `[ CONFIRMAR RIVAIS ]` |
| Limite atingido | "Até 2 rivais; remova um para trocar." (CA-09.3) |
| Remoção | "Remover Corinthians? Os palpites dele na simulação serão apagados." (CA-09.4) |

### T-08 · Comparativo
| Estado | Texto na tela |
|---|---|
| Vazio (sem rival) | "Escolha até 2 rivais para ver a briga lado a lado." + `[ ESCOLHER RIVAIS ]` (CA-10.5) |
| Vazio (Brasileirão sem dados) | "Sem dados disponíveis no momento. Você já pode escolher seus rivais; o comparativo aparece assim que os dados do Brasileirão chegarem." (CA-09.5) |
| Vazio (não iniciado) | "O Brasileirão de 2026 ainda não começou. Todas as 38 rodadas contam como restantes." (CA-09.6) |
| Carregando | 3 esqueletos de cartão comparativo + 5 linhas de calendário |
| Erro | "Não conseguimos carregar o comparativo." + `[ TENTAR DE NOVO ]` |
| Preenchido | Wireframe da Seção 2 |
| Confronto direto | "⚔ CONFRONTO DIRETO" nas duas listas (CA-10.3) |
| Visual | **Novo na rodada 3**: `FaixaClube` completa do time do coração no topo, em todos os estados acima (inclusive vazio e carregando) — o mesmo componente e conteúdo da Home (T-02) e do Painel (T-05); não depende de rival escolhido nem de dado do Brasileirão |

### T-09 · Simulação
| Estado | Texto na tela |
|---|---|
| Vazio (nenhum palpite) | Grade toda em "—"; bloco PROJEÇÃO: "São Paulo 42 pts (máx 87). Faça um palpite para ver a projeção mudar." |
| Vazio (sem jogos restantes) | "Campeonato encerrado — sem jogos restantes. Pontuação final: Palmeiras 74, São Paulo 68, Corinthians 65." (CA-11.8 / CA-09.7) |
| Carregando | Esqueleto do bloco PROJEÇÃO + 5 blocos de rodada |
| Erro | "Não conseguimos carregar o calendário restante." + `[ TENTAR DE NOVO ]` |
| Preenchido | Wireframe da Seção 2 |
| Resultado real chegou | "2 palpites viraram resultado real e foram travados." (CA-11.6), anunciado por `aria-live` |
| Sem armazenamento | "Seu navegador não está guardando dados. Você pode simular normalmente, mas o cenário não será lembrado." (CA-11.9) |
| Limpar cenário | "Apagar todos os palpites deste cenário? Isso não pode ser desfeito." + `[ APAGAR ]` `Cancelar` (CA-11.7) |

**Justificativa dos "não se aplica" de carregamento**: as listas de esportes, clubes e
fontes são configuração entregue no carregamento inicial (SDD §2.2), não recurso
buscado depois. Não existe janela de espera para elas — e é por isso que a faixa do
clube pode ser desenhada completa antes de qualquer dado de rede chegar, exceto o
número da posição.

---

## 5. Acessibilidade — WCAG 2.2 AA

Critério de aceite, não recomendação. `axe-core` com **zero violações críticas ou
sérias** em toda tela, nos dois temas **e com pelo menos quatro paletas de clube**
(uma clara tipo Mirassol, uma escura tipo Palmeiras, uma vermelha tipo São Paulo e uma
acromática tipo Corinthians).

### 5.1 Estrutura e semântica
- `<html lang="pt-BR">`; `<title>` muda a cada rota ("Comparativo · SportsLM").
- Marcos `<header>`, `<nav>`, `<main>`, `<footer>`; um único `<h1>` por rota.
- Link "Pular para o conteúdo" como primeiro elemento focável.
- Hierarquia de títulos sem salto. **Caixa alta é `text-transform`**, nunca texto
  escrito em maiúsculas no HTML — leitor de tela não deve soletrar rótulo.
- A faixa do clube é um `<a>` na home (leva ao painel) com nome acessível completo; o
  padrão de listras é `aria-hidden`.
- Tabela de classificação é `<table>` real, com `<caption>` ("Classificação do
  Brasileirão Série A 2026 — 23ª rodada"), `scope="col"`/`scope="row"`,
  `aria-current="true"` na linha do time e `aria-label` de zona na linha.
- Cada partida da simulação é um `fieldset` com `legend` descritiva.

### 5.2 Teclado
- Tudo operável por teclado, sem armadilha de foco; ordem de tabulação segue a ordem
  visual nas duas larguras.
- Sobreposições: foco no título ao abrir, contido, `Esc` fecha, foco volta ao gatilho.
- Abas: setas navegam; `Home`/`End` vão aos extremos.
- Rádios de palpite: setas mudam a opção; `Tab` sai do grupo.
- Tabela com rolagem horizontal no celular: contêiner com `tabindex="0"`,
  `role="region"`, `aria-label="Tabela de classificação, role para ver mais colunas"`.
- **Foco nunca obscurecido** (WCAG 2.4.11) pela navegação fixa, pela barra inferior nem
  pelo bloco PROJEÇÃO fixo — garantido por `scroll-margin` nos elementos focáveis.
- O anel de foco tem cor fixa; sobre superfície de clube ele continua com ≥ 3:1 porque
  usa `outline-offset` de 2 px sobre o fundo da página, não sobre a cor do clube.

### 5.3 Contraste e uso de cor
- Todos os pares do sistema estão declarados nas tabelas 3.2 e 3.3, com a razão.
- Os pares que envolvem cor de clube são **derivados e validados no build** (ADR-017);
  o Validador confere o artefato `clubes-2026.json`, não a tela clube a clube.
- `--cor-esmaecido` (3,0:1) é usada **apenas** em borda tracejada e ícone; o texto do
  cartão "sem dados" usa `--cor-texto-secundario` (5,5:1).
- **Nada depende só de cor** (WCAG 1.4.1): V/E/D têm letra; zonas têm faixa **e**
  legenda **e** `aria-label`; status de campeonato tem símbolo (`●○✓—`) **e** texto;
  estado de fonte tem texto; confronto direto tem `⚔` **e** "CONFRONTO DIRETO"; item
  ativo da navegação tem sublinhado **e** `aria-current`; palpite selecionado tem
  preenchimento **e** contorno **e** letra.
- A cor do clube é identidade, nunca informação: dois clubes de paleta parecida jamais
  causam ambiguidade, porque nome e sigla acompanham sempre.

### 5.4 Mensagens de status (4.1.3)
`aria-live="polite"`, com supressão de repetição: bloqueio de fonte ("Terra Esportes
bloqueada. 4 notícias removidas do feed") · recálculo da simulação ("São Paulo 55
pontos projetados, 2º entre os comparados") · travamento de palpites · limite de
favoritos · limite de rivais · atualização de snapshot. Nunca `assertive`.

### 5.5 Movimento, alvo e reflow
- `prefers-reduced-motion`: transições zeradas, inclusive a de "acender" a faixa do
  clube ao escolher o time.
- Alvo mínimo 44 × 44 px; 8 px entre alvos.
- Uso em 320 px sem rolagem horizontal de página; a única exceção é a rolagem interna
  anunciada da tabela.
- Zoom até 200% sem perda de conteúdo ou função; nenhum `user-scalable=no`.
- O número de camisa em 72 px reduz para 56 px abaixo de 340 px de largura, para não
  colidir com o nome do clube.

### 5.6 Formulários e erros
- Todo controle com rótulo visível associado; `placeholder` nunca é rótulo.
- Erros em texto, junto ao controle, ligados por `aria-describedby`; nunca só cor.
- Nenhum campo obrigatório — todo passo do onboarding é pulável.

### 5.7 Links externos
`aria-label="São Paulo vence o Atlético-MG por 2 a 1 — ge — abre em nova aba"`.

### 5.8 Verificação manual obrigatória
1. Percurso completo dos 7 fluxos (§1.2) só com teclado.
2. T-02, T-06, T-08 e T-09 com leitor de tela (VoiceOver iOS e NVDA), conferindo se a
   faixa do clube, a tabela e a grade de simulação fazem sentido em leitura linear.
3. Nenhum estado da Seção 4 depende de cor para ser entendido.
4. Foco não obscurecido pela barra inferior e pelo bloco PROJEÇÃO, no celular.
5. Uso a 200% de zoom em 320 px.
6. **Novo nesta rodada**: as quatro paletas de clube citadas acima, nos dois temas.

**Resultado do `accessibility-review` sobre as 9 telas: nenhuma pendência crítica.**
Quatro pontos de atenção, todos com mitigação embutida: (a) tabela no celular →
colunas reduzidas e região rolável anunciada; (b) grade de simulação bidimensional no
desktop → `fieldset` por partida com `legend` completa; (c) bloco PROJEÇÃO fixo →
`scroll-margin`; (d) **cor de clube governando a tela** → derivação validada no build,
foco e cores semânticas fora do alcance da paleta do clube.

---

## 6. Comportamento Responsivo

Mobile-first. Pontos de quebra: **360** (base), **600** (tablet retrato), **900**
(desktop pequeno), **1200** (contêiner máximo de 1120 px).

| Tela | < 600 | 600-899 | ≥ 900 |
|---|---|---|---|
| **T-02 Home** | Coluna única: faixa (116 px) → PRÓXIMO JOGO → A BRIGA → SEUS ESPORTES → ÚLTIMAS NOTÍCIAS. Navegação em barra inferior preta fixa | Faixa 128 px; blocos do time lado a lado em 2 colunas; feed em 1 coluna; navegação no topo | Faixa 140 px em largura total; **duas colunas: fixa de 336 px** (PRÓXIMO JOGO, A BRIGA, CAMPEONATOS) **+ feed de 748 px em 2 colunas de cartão** |
| T-01 Onboarding | Faixa neutra 72 px; coluna única; ação fixa no rodapé | Coluna central 560 px | Coluna central 640 px; clubes em 3 colunas |
| T-03 Configurações | Folha de baixo, 92% da altura, cabeçalho preto fixo | Modal 560 px | Modal 640 px; esportes em 3 colunas |
| T-04 / T-07 | Folha de baixo; lista em 1 coluna | Modal 520 px; 2 colunas | Modal 560 px; 2 colunas |
| T-05 Painel | Faixa completa; bloco de próximo jogo; cartões de campeonato empilhados | Campeonatos em 2 colunas | Coluna fixa de 336 px (próximo jogo + a briga) + campeonatos em grade de 2 colunas à direita |
| T-06 Campeonato | Cabeçalho preto; bloco de resumo; abas Tabela/Disputadas/Próximas; tabela com 6 colunas e rolagem interna | Tabela com 8 colunas | **Sem abas**: resumo em largura total, tabela completa de 10 colunas, e Disputadas/Próximas lado a lado em 540 px |
| T-08 Comparativo | Faixa completa; cartões empilhados (time primeiro); calendário com abas por clube | 2 colunas; calendário empilhado | 3 colunas comparáveis lado a lado, cada uma com seu calendário embaixo |
| T-09 Simulação | Lista por rodada; bloco PROJEÇÃO fixo no topo | Lista por rodada, 2 rodadas por linha | Matriz rodada × clube; PROJEÇÃO fixo; barras de acumulado no rodapé |

**Regras transversais**
- Navegação: **barra inferior preta fixa** abaixo de 600 px (alcance do polegar);
  **links no topo, na barra preta** a partir de 600 px. Nunca as duas ao mesmo tempo.
- A faixa do clube **rola com o conteúdo** — não é fixa. Fixá-la comeria a tela pequena
  e empurraria as notícias para fora do primeiro quadro.
- A barra de navegação é fixa em todas as larguras (56 px no topo, 64 px no rodapé do
  celular).
- Número de camisa: 72 px no celular (56 px abaixo de 340 px), 96 px no desktop.
- Tabela abaixo de 600 px mostra `# · CLUBE · P · J · SG · %`; o restante fica na
  rolagem interna anunciada.
- Listras diagonais mantêm 18 px de passo em todas as larguras — o padrão precisa ser
  reconhecível, não proporcional.
- Nenhuma imagem em nenhuma largura; ilustração de estado vazio é ícone SVG
  monocromático.
- Orientação paisagem no celular usa o layout de 600-899 px.

---

## 7. Restrições Técnicas Aplicadas e Trade-offs

Autochecagem contra o `SDD.md` e os ADRs. Cada linha é um ponto em que a experiência
encontrou um limite técnico ou de regra, e a decisão que tomei.

### 7.1 Trade-offs herdados da rodada 1 (mantidos)

| # | Restrição | Decisão | Impacto |
|---|---|---|---|
| **TR-1** | Dados a cada 30 min, nada ao vivo (ADR-001/002, RN-09) | Carimbo de frescor onipresente; nenhuma tela diz "ao vivo" ou "agora" | Detalhe |
| **TR-2** | Filtro por bloqueio/favorito no navegador (ADR-001) | O feed pode ter menos de 30 itens e a tela explica por quê | Detalhe |
| **TR-3** | Sem conta, persistência local (ADR-005) | Aviso explícito em T-03; modo memória avisado | Detalhe |
| **TR-4** | Campeonato sem cobertura precisa aparecer (CA-07.2) e a maioria não tem fonte gratuita (SDD RT-02) | Cartão tracejado, esmaecido, **sem barra colorida e sem vermelho**, agrupado no fim | **Relevante** — sinalizado ao Gestor com RT-02/D1 |
| **TR-5** | Simulação só entre time e rivais (CA-11.10) | Aviso permanente **dentro** do bloco PROJEÇÃO fixo, que nunca rola para fora | Detalhe, mas obrigatório |
| **TR-6** | GE não bloqueável (CA-02.3) | Sem alternador; chip "FONTE FIXA" + frase | Detalhe, com ganho de acessibilidade |
| **TR-9** | Classificação sem IA erra às vezes (ADR-008) | Etiqueta de esporte sempre visível; "GERAL" é rótulo legítimo | Detalhe |
| **TR-10** | Deduplicação conservadora (ADR-009) | "+N fontes" e "TAMBÉM EM:" viram informação útil | Detalhe |
| **TR-11** | Alvo de 44 px e contraste AA (ADR-014) | Colunas reduzidas com rolagem anunciada; nada abaixo de 12 px | Detalhe |
| **TR-12** | Rotas no cliente (ADR-003) | Sobreposições sem rota; seções profundas com rota | Detalhe |

### 7.2 Trade-offs novos, introduzidos pela direção "Camisa"

| # | Tensão | Decisão | Impacto |
|---|---|---|---|
| **TR-13** | A cor do clube governa a tela, mas o contraste passa a depender de dado de configuração, com 20 clubes e virada de temporada | Dois papéis distintos (superfície crua × acento ajustado), paleta derivada e **validada no build**, falha de validação quebra a construção | **Estrutural** — gerou o [ADR-017](adr/017-cor-de-identidade-derivada-do-clube-com-contraste-pre-computado.md) e o ajuste do modelo `Clube` no SDD §5.2 |
| **TR-14** | Seis clubes da Série A são preto e branco e não têm cor de destaque | Tratamento acromático explícito: tinta + segundo tom de listra. Não invento cor que o clube não tem | **Piora**: Corinthians, Botafogo, Santos, Vasco, Atlético-MG e Ceará ficam com identidade visual igual entre si. Diferenciados por avatar, sigla e nome |
| **TR-15** | Clube de cor clara (amarelo) — texto branco por cima é ilegível; escurecer destrói o reconhecimento | Cor crua na faixa com texto **preto**; cor escurecida só em tamanho de texto | Resolvido, com a consequência de a faixa e os números terem tons visivelmente diferentes nesses clubes |
| **TR-16** | A direção pede display peso 800; a pilha do sistema nem sempre tem 800 | Aceito cair para 700 onde não houver. **Sem webfont** | **Piora**: a "cara" da direção fica um pouco mais leve em parte dos Android e Windows. Alternativa custaria o orçamento de M3 (ADR-016) |
| **TR-17** | Os dois blocos do time ocupam ~230 px antes das notícias no celular | Mantido: é a direção escolhida e é a porta de entrada do diferencial (M4). Sem time, os blocos somem e as notícias sobem | **Piora**: a persona secundária (só notícias, sem time) vê ~116 px de faixa neutra antes do feed. Aceito por ser a persona secundária |
| **TR-18** | Navegação preta + faixa colorida + blocos pretos criam alta densidade de contraste | Cor fica nas superfícies grandes; texto e ícones são tinta ou branco; nada de texto colorido sobre fundo colorido fora do par validado | Detalhe |
| **TR-19** | Zonas da tabela e estados V/E/D poderiam usar a cor do clube | **Não usam**: são cores fixas do sistema. Informação não muda de cor conforme o time do usuário | Detalhe, e é uma regra dura |
| **TR-8** | CA-06.1 pede "identidade visual" do clube; escudo é marca registrada e I-14 veta imagem de terceiro | Mantido da rodada 1: sigla + cor, sem escudo. A nova direção **aumenta o peso dessa decisão**, porque agora a cor é o principal veículo de identidade | **Decisão do stakeholder** (SDD §6.4, D5). Com a direção "Camisa", vale reperguntar: escudos licenciados dariam bem mais força visual à faixa |

### 7.3 Impacto em ADRs e no SDD

| Artefato | Situação |
|---|---|
| **ADR-017** (novo) | Criado: derivação da paleta de clube, alvos de contraste, casos acromático e claro, identidade neutra sem time, e a decisão de **pré-computar no pipeline** em vez de calcular no navegador |
| **ADR-014** (WCAG 2.2 AA) | **Não substituído.** A decisão — nível AA não negociável — não mudou; o que mudou foi o método de verificação de parte dos tokens, que o ADR-017 estende. Substituir um ADR cuja decisão continua valendo enfraqueceria a convenção |
| **ADR-004** (CSS Modules + tokens) | **Não substituído.** Custom properties são exatamente o mecanismo que permite injetar a paleta do clube. Ganha a nota de que as cores de clube vivem em `clubes-2026.json`, única exceção à regra "nenhuma cor fora do arquivo de tokens" |
| **ADR-016** (orçamento) | **Não substituído.** Listras são `repeating-linear-gradient`, sem imagem; a paleta são custom properties. Orçamento mantido. A fricção do peso 800 está em TR-16 |
| **SDD.md §5.2** | **Ajustado**: `Clube.cor` virou `corBase` + `paleta: PaletaClube` (8 valores derivados + `acromatico`) + `paletaManual` opcional |
| **SDD.md §2.1** | **Ajustado**: novo componente de pipeline `derivador-paleta`, que deriva e valida o contraste; falha quebra o build |
| **SDD.md §2.2** | **Ajustado**: `clubes-2026.json` passa de < 4 KB para < 8 KB e passa a conter a paleta validada |
| **SDD.md §4** | **Ajustado**: ADR-017 no índice, com nota da rodada 2 |

### 7.4 O que a nova direção piora — registrado antes de decompor o TASK.md

1. **Seis clubes ficam visualmente idênticos** (TR-14). É a perda mais concreta.
2. **Peso 800 nem sempre existe** na pilha do sistema (TR-16): em parte dos aparelhos a
   direção perde impacto tipográfico.
3. **A persona secundária paga um pedágio visual** (TR-17): quem só quer notícias vê a
   faixa antes do feed.
4. **A superfície de teste de acessibilidade cresce**: antes era 1 paleta × 2 temas;
   agora é 20 paletas × 2 temas. Mitigado por validação automatizada no build, mas o
   Loop C precisa prever essa tarefa de verificação — ela não existia na rodada 1.
5. **A implementação fica mais cara**: `FaixaClube`, `BlocoPreto`, `NumeroCamisa`,
   `BarraPontuacao` e o `derivador-paleta` são trabalho novo que a rodada 1 não tinha.
   O `derivador-paleta` é do pipeline, não do frontend — o Loop C precisa colocá-lo no
   lote certo.
6. **Reversibilidade**: se o stakeholder mudar de ideia, o custo está concentrado na
   Seção 3 e nos seis componentes de 3.8. Fluxos, textos, estados, acessibilidade e
   contrato de dados não mudam — a rodada 1 provou que a espinha aguenta trocar a pele.

---

**Entrega da rodada 2**: `UX-SPEC.md` com 9 telas, 4 estados cada (ou justificativa),
design system "Camisa" completo com valores concretos e contraste declarado, regra de
derivação de cor de clube, acessibilidade WCAG 2.2 AA e wireframes em duas larguras —
suficiente para o mockup estático. `TASK.md` e `GUARDRAILS.md` são o Loop C, após
aprovação do usuário.
