# ADR-001 — Dados pré-computados e publicação estática (sem backend em runtime)

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RNF-05, RNF-10, RNF-12, RNF-13, RN-09, RF-15, RF-16, RF-17
- **Contexto de projeto**: protótipo (RNF-15) — sem SLA, dezenas de usuários, custo zero

## Contexto

Todo dado que o SportsLM exibe é de terceiros (5 feeds de notícia + provedor de dados
de futebol) e é **idêntico para todos os usuários**: não existe conta, não existe
login e a personalização (favoritos, bloqueio de fontes, time, rivais, palpites) é
100% local por dispositivo (RF-13, Q6). O produto nunca é "ao vivo" (RN-09) e não
pode fazer chamada síncrona a terceiro no momento em que a tela renderiza (RNF-05).

Isso significa que não há nenhuma computação por usuário que exija servidor. O que
existe é um **processo periódico de ingestão** e um **conjunto de dados público
versionado no tempo**.

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| **A. Backend em runtime** (Node + SQLite/Postgres em PaaS free tier) | Modelo familiar; API sob medida; refresh sob demanda | Custo/ops recorrentes; free tiers hibernam (cold start de 10-30 s ataca diretamente M3 < 10 s); precisa de backup, migrations, monitoramento — tudo desproporcional a um protótipo sem SLA |
| **B. Serverless de borda** (Cloudflare Workers + KV/D1, cron triggers) | Zero custo real; cron de 1 min; runtime programável | Um fornecedor a mais, com conta e segredos próprios; código de runtime a depurar; ganho nulo enquanto não houver lógica por usuário |
| **C. Dados pré-computados em CI + publicação estática** | Custo zero; sem servidor para operar; cota de terceiros consumida uma vez por ciclo (não por usuário); RNF-05 atendido por construção; superfície de ataque mínima | Granularidade de atualização limitada à cadência do agendador; snapshot precisa carregar um superconjunto dos dados para o filtro client-side; sem lógica por usuário |
| **D. Navegador chama os feeds/APIs direto** | Nenhuma infraestrutura | Inviável: CORS nos feeds RSS; chave de API exposta no bundle; cota multiplicada por usuário; viola RNF-05 e a frequência máxima declarada pela fonte (CA-15.7) |

## Decisão

Adotar a **alternativa C**. A arquitetura é:

```
[Fontes RSS/Atom]  [Provedor de futebol]
        \                  /
         v                v
   Pipeline de ingestão (Node/TS, agendado — ver ADR-002)
                  |
                  v
   Estado interno normalizado (JSON versionado, branch de dados)
                  |
                  v
   Gerador de snapshots públicos (JSON estático, contrato da Seção 2 do SDD)
                  |
                  v
   Hosting estático  ──HTTP GET──>  SPA (React/TS) + localStorage
```

A SPA só faz `GET` de arquivos JSON estáticos da própria origem. Nenhuma chamada a
terceiro acontece a partir do navegador (única exceção: o beacon de telemetria —
ADR-012).

## Consequências

**Positivas**
- Custo de operação: zero. Compatível com "só gratuito" (RN-13/RNF-10).
- RNF-05 atendido por construção: a tela nunca espera um terceiro.
- Cota do provedor não escala com usuários (defende R2/CA-16.4).
- Sem banco exposto, sem sessão, sem endpoint mutável — elimina classes inteiras de
  vulnerabilidade (ver Seção 7 do SDD).
- Resiliência natural: se a ingestão falha, o snapshot anterior continua servido
  (CA-15.5, CA-16.3) e o carimbo de frescor envelhece honestamente (CA-17.2).

**Negativas**
- Nunca haverá sincronização entre dispositivos (já excluída pelo escopo — Q6).
- O snapshot de notícias precisa conter mais que 30 itens, porque o filtro por fonte
  bloqueada e por favorito acontece no cliente. Dimensionado e limitado na Seção 2
  do SDD (retenção 7 dias, teto de 60 itens por fonte).
- "Atualizar agora" na interface só rebusca o snapshot; não força uma nova ingestão.
  A tela precisa ser honesta sobre isso (tratado no UX-SPEC, T-02).
- Sem observabilidade de runtime: o que existe é o log do agendador e um
  `status.json` (RNF-11, nível protótipo).

**Dívida técnica aceita conscientemente**
- Ausência de camada de API própria: se um dia houver conta/sync, essa camada terá
  de ser criada do zero. Aceita porque o contrato de snapshot (Seção 2 do SDD) é o
  mesmo modelo de dados que uma API futura exporia — a migração é de transporte, não
  de domínio.

## Se virar produto (RNF-15)

Migrar o pipeline para a alternativa B (borda serverless), mantendo o mesmo modelo de
domínio e o mesmo contrato de dados, e introduzir uma API de leitura com cache de
borda. O gatilho é a chegada de qualquer um destes: conta de usuário, sincronização
entre dispositivos, notificação, ou frescor abaixo de 5 minutos.
