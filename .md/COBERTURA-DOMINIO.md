# Cobertura de testes por CA-xx — QA-02

Auditoria consolidada de DOM-02 a DOM-06 contra os critérios de aceite (CA-xx)
de RF-03/04/05/07/08/09/10/11/18/19 (`.md/PRD-TECNICO.md` Seção 3). Não é
reimplementação: lista onde cada CA-xx já tem pelo menos um caso de teste por
tabela — em `dominio/` (DOM-02 a DOM-06) ou em qualquer teste de tela/pipeline
que o exercite — e fecha as lacunas encontradas com casos novos.

Total: 62 critérios de aceite auditados. 61 cobertos após esta tarefa (7 casos
novos). 1 sinalizado como lacuna de implementação (não de teste), fora do
escopo desta tarefa — ver Seção "Gaps" ao final.

## RF-03 — Esportes favoritos

| CA | Coberto em |
|---|---|
| CA-03.1 | `dominio/esportes/esportes.test.ts`; `app/rotas/paginas/Onboarding/PassoFavoritos.test.tsx`; `app/rotas/paginas/Onboarding.test.tsx` |
| CA-03.2 | `app/rotas/paginas/Onboarding/PassoFavoritos.test.tsx`; `app/rotas/paginas/Onboarding.test.tsx` |
| CA-03.3 | `app/rotas/paginas/Onboarding/PassoFavoritos.test.tsx`; `app/rotas/sobreposicoes/Configuracoes/SecaoEsportesFavoritos.test.tsx` |
| CA-03.4 | `app/rotas/paginas/Onboarding/PassoFavoritos.test.tsx` |

## RF-04 — Feed das 30 notícias mais recentes

| CA | Coberto em |
|---|---|
| CA-04.1 | `dominio/noticias/montador-feed.test.ts`; `app/rotas/paginas/Home/SecaoUltimasNoticias.test.tsx` |
| CA-04.2 | `app/design-system/CartaoIngresso.test.tsx` — caso novo desta tarefa: título, fonte, esporte e horário juntos + link externo abrindo fora do produto |
| CA-04.3 | `dominio/noticias/normalizador-item.test.ts` |
| CA-04.4 | `app/rotas/paginas/Home/SecaoUltimasNoticias.test.tsx` |
| CA-04.5 | `app/rotas/paginas/Home/SecaoUltimasNoticias.test.tsx` |
| CA-04.6 | `dominio/noticias/normalizador-item.test.ts`; `app/rotas/paginas/Home/SecaoUltimasNoticias.test.tsx` |
| CA-04.7 | `dominio/esportes/classificador.test.ts`; `dominio/noticias/montador-feed.test.ts`; `app/rotas/paginas/Home/SecaoSeusEsportes.test.tsx` |
| CA-04.8 | `dominio/esportes/esportes.test.ts`; `dominio/esportes/classificador.test.ts`; `dominio/noticias/montador-feed.test.ts`; `dominio/tipos/tipos.test.ts`; `pipeline/noticias/orquestrador.test.ts`; `pipeline/publicacao/gerador-snapshots.test.ts` |

## RF-05 — Seção de destaque dos favoritos

| CA | Coberto em |
|---|---|
| CA-05.1 | `app/rotas/paginas/Home/SecaoSeusEsportes.test.tsx` |
| CA-05.2 | `app/rotas/paginas/Home/SecaoSeusEsportes.test.tsx` |
| CA-05.3 | `app/rotas/paginas/Home/SecaoSeusEsportes.test.tsx` |
| CA-05.4 | `app/rotas/paginas/Home.test.tsx`; `app/rotas/paginas/Home/SecaoSeusEsportes.test.tsx` |
| CA-05.5 | `app/rotas/paginas/Home/SecaoSeusEsportes.test.tsx` — caso novo desta tarefa: item de esporte fora do futebol não renderiza tabela/calendário/placar, só a notícia |

## RF-07 — Campeonatos do ano corrente

| CA | Coberto em |
|---|---|
| CA-07.1 | `dominio/campeonatos/derivador-status.test.ts`; `app/rotas/paginas/PainelTime.test.tsx` |
| CA-07.2 | `config/campeonatos.test.ts`; `dominio/tipos/tipos.test.ts`; `pipeline/futebol/coletor-futebol.test.ts`; `pipeline/futebol/orquestrador.test.ts`; `pipeline/publicacao/gerador-snapshots.test.ts`; `app/rotas/paginas/PainelTime.test.tsx` |
| CA-07.3 | `dominio/campeonatos/derivador-status.test.ts`; `dominio/campeonatos/ordenacao.test.ts` |
| CA-07.4 | `dominio/campeonatos/ordenacao.test.ts`; `dominio/tipos/tipos.test.ts`; `pipeline/publicacao/gerador-snapshots.test.ts`; `app/rotas/paginas/PainelTime.test.tsx` |
| CA-07.5 | `app/rotas/paginas/PainelTime.test.tsx` |

## RF-08 — Detalhe por campeonato

| CA | Coberto em |
|---|---|
| CA-08.1 | `dominio/campeonatos/aproveitamento.test.ts`; `app/rotas/paginas/DetalheCampeonato.test.tsx` |
| CA-08.2 | `app/rotas/paginas/DetalheCampeonato.test.tsx` |
| CA-08.3 | `app/rotas/paginas/DetalheCampeonato.test.tsx` — caso novo desta tarefa (`formato: 'grupos'`, tabela isola o grupo do time do torcedor); a cobertura anterior era só uma menção em docstring, sem exercitar `linha.grupo` de fato |
| CA-08.4 | `app/rotas/paginas/DetalheCampeonato.test.tsx` |
| CA-08.5 | **Não coberto — ver "Gaps" abaixo** |
| CA-08.6 | `app/design-system/componentes/LinhaPartida/LinhaPartida.test.tsx`; `app/rotas/paginas/DetalheCampeonato.test.tsx` |
| CA-08.7 | `app/design-system/componentes/LinhaPartida/LinhaPartida.test.tsx`; `app/rotas/paginas/DetalheCampeonato.test.tsx` |
| CA-08.8 | `app/design-system/componentes/LinhaPartida/LinhaPartida.test.tsx`; `app/rotas/paginas/DetalheCampeonato.test.tsx` |
| CA-08.9 | `app/design-system/componentes/LinhaPartida/LinhaPartida.test.tsx`; `app/rotas/paginas/DetalheCampeonato.test.tsx` |
| CA-08.10 | `app/design-system/componentes/LinhaPartida/LinhaPartida.test.tsx`; `app/rotas/paginas/DetalheCampeonato.test.tsx` |
| CA-08.11 | `app/rotas/paginas/DetalheCampeonato.test.tsx` |

## RF-09 — Seleção de rivais

| CA | Coberto em |
|---|---|
| CA-09.1 | `app/rotas/sobreposicoes/EscolherRivais.test.tsx` |
| CA-09.2 | `app/rotas/sobreposicoes/EscolherRivais.test.tsx` |
| CA-09.3 | `app/rotas/sobreposicoes/EscolherRivais.test.tsx` |
| CA-09.4 | `app/rotas/sobreposicoes/EscolherRivais.test.tsx`; `app/armazenamento/cenario.test.ts` |
| CA-09.5 | `app/rotas/paginas/Comparativo.test.tsx` |
| CA-09.6 | `app/rotas/paginas/Comparativo.test.tsx` — caso novo desta tarefa: Brasileirão ainda não começou (todos os comparados com 0 jogos) exibe o aviso "todas as 38 rodadas contam como restantes" |
| CA-09.7 | `app/rotas/paginas/Comparativo.test.tsx` — caso novo desta tarefa: Brasileirão encerrado mantém rivais/comparativo normalmente (situação final), sem o aviso de "não começou"; o texto "campeonato encerrado — sem jogos restantes" da simulação já estava coberto sob a tag CA-11.8 em `app/rotas/paginas/Simulacao.test.tsx`/`dominio/simulacao/motor.test.ts` (mesmo texto canônico exigido por CA-09.7) |

## RF-10 — Comparativo no Brasileirão

| CA | Coberto em |
|---|---|
| CA-10.1 | `app/rotas/paginas/Comparativo.test.tsx`; `pipeline/futebol/adaptador-football-data.test.ts` |
| CA-10.2 | `app/rotas/paginas/Comparativo.test.tsx` — caso novo desta tarefa: lista completa de jogos restantes de um clube, com adversário e mando, excluindo partida já disputada |
| CA-10.3 | `app/rotas/paginas/Comparativo.test.tsx` |
| CA-10.4 | `app/design-system/componentes/LinhaPartida/LinhaPartida.test.tsx`; `app/rotas/paginas/Comparativo.test.tsx`; `app/rotas/paginas/DetalheCampeonato.test.tsx`; `dominio/tipos/tipos.test.ts` |
| CA-10.5 | `app/rotas/paginas/Comparativo.test.tsx` |
| CA-10.6 | `app/rotas/paginas/Comparativo.test.tsx` — caso novo desta tarefa: confirma que a única URL de futebol consultada é a do Brasileirão (nenhuma URL de campeonato de clube é chamada) |

## RF-11 — Simulação de cenário

| CA | Coberto em |
|---|---|
| CA-11.1 | `app/rotas/paginas/Simulacao.test.tsx` |
| CA-11.2 | `dominio/simulacao/motor.test.ts`; `app/rotas/paginas/Simulacao.test.tsx` |
| CA-11.3 | `dominio/simulacao/motor.test.ts`; `app/rotas/paginas/Simulacao.test.tsx` |
| CA-11.4 | `dominio/simulacao/motor.test.ts`; `app/rotas/paginas/Simulacao.test.tsx` |
| CA-11.5 | `dominio/simulacao/motor.test.ts`; `app/rotas/paginas/Simulacao.test.tsx` |
| CA-11.6 | `app/rotas/paginas/Simulacao.test.tsx` |
| CA-11.7 | `app/rotas/paginas/Simulacao.test.tsx` |
| CA-11.8 | `dominio/simulacao/motor.test.ts`; `app/rotas/paginas/Simulacao.test.tsx` |
| CA-11.9 | `app/armazenamento/cenario.test.ts`; `app/rotas/paginas/Simulacao.test.tsx` |
| CA-11.10 | `dominio/simulacao/motor.test.ts`; `app/rotas/paginas/Simulacao.test.tsx` |

## RF-18 — Zonas na tabela do Brasileirão

| CA | Coberto em |
|---|---|
| CA-18.1 | `config/zonas.test.ts`; `app/design-system/componentes/TabelaClassificacao/TabelaClassificacao.test.tsx`; `app/rotas/paginas/DetalheCampeonato.test.tsx` |
| CA-18.2 | `config/zonas.test.ts`; `app/design-system/componentes/TabelaClassificacao/TabelaClassificacao.test.tsx`; `app/rotas/paginas/DetalheCampeonato.test.tsx`; `pipeline/publicacao/gerador-snapshots.test.ts` |

## RF-19 — Deduplicação de manchetes

| CA | Coberto em |
|---|---|
| CA-19.1 | `dominio/dedup/dedup.test.ts`; `dominio/noticias/deduplicador.test.ts`; `dominio/noticias/montador-feed.test.ts`; `app/design-system/CartaoIngresso.test.tsx`; `app/rotas/paginas/Home/SecaoUltimasNoticias.test.tsx` |
| CA-19.2 | `dominio/dedup/dedup.test.ts`; `dominio/noticias/montador-feed.test.ts`; `app/rotas/paginas/Home/SecaoUltimasNoticias.test.tsx` |
| CA-19.3 | `dominio/dedup/dedup.test.ts`; `dominio/noticias/deduplicador.test.ts`; `dominio/noticias/montador-feed.test.ts` |
| CA-19.4 | `dominio/dedup/dedup.test.ts`; `dominio/noticias/deduplicador.test.ts`; `dominio/noticias/montador-feed.test.ts`; `app/rotas/paginas/Home/SecaoUltimasNoticias.test.tsx` |

## Casos novos adicionados nesta tarefa (7)

1. `app/design-system/CartaoIngresso.test.tsx` — CA-04.2
2. `app/rotas/paginas/Home/SecaoSeusEsportes.test.tsx` — CA-05.5
3. `app/rotas/paginas/DetalheCampeonato.test.tsx` — CA-08.3 (comportamento real de filtro por grupo, não só menção em docstring)
4. `app/rotas/paginas/Comparativo.test.tsx` — CA-09.6
5. `app/rotas/paginas/Comparativo.test.tsx` — CA-09.7
6. `app/rotas/paginas/Comparativo.test.tsx` — CA-10.2
7. `app/rotas/paginas/Comparativo.test.tsx` — CA-10.6

## Gaps (fora do escopo de QA-02 — auditoria, não reimplementação)

- **CA-08.5** — "WHEN muda de formato, GIVEN o provedor reflete, THE SYSTEM
  SHALL passar a CA-08.4 e manter a tabela final do grupo acessível." Em
  `app/rotas/paginas/DetalheCampeonato.tsx`, `ehMataMata` zera
  `dadosClassificacao` por completo sempre que `competicao.formato ===
  'mata-mata'`, sem preservar nenhum acesso à tabela final do grupo anterior —
  não existe, hoje, nenhum mecanismo (estado, rota, aba) que mantenha essa
  tabela acessível após a virada de fase. Além disso, por decisão de detalhe já
  registrada no próprio arquivo (linhas 45–58), a única fonte de classificação
  hoje publicada é a do Brasileirão, cujo formato é sempre `'pontos-corridos'`
  — nenhum dado real jamais aciona esse caminho de código. Escrever um teste
  aqui exigiria simular um caminho de dado que não existe (`brasileirao.dados`
  respondendo por uma competição de formato `'grupos'`/`'misto'` que muda para
  `'mata-mata'`) e ainda assim o teste provaria a ausência do comportamento
  exigido pelo CA — ou seja, a lacuna é de **implementação**, não de teste.
  Como QA-02 é tarefa de auditoria/consolidação de testes (não de
  reimplementação), este item é sinalizado ao `coordenador` para decidir se
  vale a pena: (a) implementar a preservação da tabela final do grupo agora,
  mesmo sem fonte de dado real que a exercite, ou (b) adiar até que uma fonte
  de campeonato de grupos seja publicada (SPK-01 já registra que só o
  Brasileirão tem cobertura garantida de tabela hoje). Não bloqueia as demais
  61 entradas desta auditoria.
