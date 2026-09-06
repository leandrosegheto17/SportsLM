# ADR-005 — Persistência local em `localStorage`, com esquema versionado e modo memória

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-13 (CA-13.1 a CA-13.5), RF-11 (CA-11.9), RF-14, RN-12, RNF-07
- **Depende de**: ADR-001

## Contexto

Precisa persistir, por dispositivo/navegador e sem conta: até 3 esportes favoritos,
fontes bloqueadas, time do coração, até 2 rivais, cenário de simulação (Should) e
preferência de tema. Nenhum dado pessoal (RNF-07/CA-13.5).

Volume máximo real: favoritos (3 ids) + bloqueios (4 ids) + time (1 id) + rivais
(2 ids) + tema + até 3 clubes × até 38 palpites = ~114 palpites. Serializado em JSON
compacto: **abaixo de 10 KB**.

Restrição de experiência relevante: no primeiro pintar da tela é preciso saber se
há preferências salvas, para decidir entre onboarding e home (CA-13.2/CA-14.1). Se
essa leitura for assíncrona, o usuário vê um piscar de onboarding indevido.

## Alternativas consideradas

| Alternativa | Contras |
|---|---|
| **IndexedDB** | API assíncrona: a decisão onboarding-vs-home passa a acontecer depois do primeiro pintar (piscar visível); complexidade desproporcional para 10 KB |
| Cookies | Enviados em toda requisição, limite de 4 KB, e criam discussão de consentimento sem necessidade |
| Cache API / OPFS | Fora de propósito para preferências |
| **`localStorage`** | Síncrono e bloqueante (aceitável para 10 KB), limite ~5 MB, indisponível em alguns modos privados |

## Decisão

Usar **`localStorage`**, com quatro chaves independentes e esquema versionado:

| Chave | Conteúdo | Perda aceitável |
|---|---|---|
| `sportslm.preferencias.v1` | favoritos, fontes bloqueadas, time, rivais | Reinicia onboarding (CA-13.3) |
| `sportslm.cenario.v1` | palpites por partida, por temporada+time+rivais | Cenário perdido (CA-11.9, Should) |
| `sportslm.tema.v1` | `claro` \| `escuro` \| `sistema` | Volta a `sistema` |
| `sportslm.anonimo.v1` | identificador anônimo de telemetria (ADR-012) | Recontagem de coorte |

Regras:

1. **Escrita imediata** a cada alteração (CA-13.1), com *debounce* de 250 ms apenas
   para a grade de palpites (evita gravar a cada tecla numa navegação por teclado).
2. **Leitura validada por esquema** (Zod) na inicialização. Campo inválido é
   descartado individualmente, os válidos são mantidos e o usuário é informado do que
   foi descartado (CA-13.4). Para o time do coração fora da lista da temporada, o
   caminho é CA-06.5 (RN-12), com descarte de rivais e cenário.
3. **Chave de escopo do cenário**: `temporada:time:rivais-ordenados`. Trocar de time
   ou de rival invalida o cenário por construção (CA-06.3/CA-09.4) — não é preciso
   varrer palpites órfãos.
4. **Modo memória**: se `localStorage` lançar exceção (modo privado, cota, política de
   armazenamento), o produto entra em modo memória — tudo funciona na sessão, nada é
   gravado — e exibe o aviso previsto em CA-11.9/CA-13.3. A detecção é uma escrita de
   teste (`__teste__`) no arranque, dentro de `try/catch`.
5. **Migração**: o sufixo `.vN` é parte do contrato. Um esquema novo lê o anterior por
   uma função de migração explícita ou descarta com aviso; nunca faz leitura
   "otimista" de formato desconhecido.
6. **Nada de dado pessoal** (CA-13.5): apenas identificadores de configuração do
   próprio produto e um identificador anônimo aleatório de telemetria.

## Consequências

**Positivas**: decisão onboarding-vs-home tomada antes do primeiro pintar (sem
piscar); implementação simples e testável; degradação prevista e comunicada.

**Negativas**: `localStorage` é síncrono — aceitável em ≤ 10 KB, mas vira regra dura:
**nada além de preferências entra nele** (nunca o cache de notícias ou de futebol, que
são snapshots servidos pela rede). Isso vai para `GUARDRAILS.md`.

**Dívida aceita**: sem sincronização e sem exportar/importar preferências. Se o
testador limpar o navegador, perde a configuração — comportamento previsto em CA-13.3.

## Se virar produto

Conta opcional com sincronização; exportar/importar preferências; migração do cenário
para armazenamento remoto por usuário.
