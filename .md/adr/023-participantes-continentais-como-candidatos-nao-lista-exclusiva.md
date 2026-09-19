# ADR-023 — Participantes das continentais são candidatos configurados, não lista exclusiva por clube

- **Status**: Aceito
- **Data**: 2026-09-18
- **Decisor**: Usuário (regra de negócio, decisão registrada na sessão de 2026-09-18) +
  Coordenador (chapéu Software Architect, forma técnica)
- **Requisitos afetados**: RN-05, RF-20, CA-25.x, I-28, I-32
- **Relaciona-se com**: **ADR-020 item 2** (lista `clubes` é config versionada + diagnóstico
  `participante-nao-configurado`; este ADR **refina** sem superseder: a config continua
  sendo a fonte, muda a interpretação e uma regra de teste). ADR-020 não é editado.

## Contexto

O SPK-07 achou Botafogo nas duas listas (Libertadores 4501 e Sul-Americana 4724). O usuário
esclareceu: um clube pode **cair da Libertadores para a Sul-Americana** (caso Botafogo);
logo participação continental **não é fixa por clube** nem exclusiva.

## Decisão

1. Em `libertadores` e `sul-americana`, `clubes` = **candidatos**: união dos clubes da Série
   A que, segundo a fonte verificada, estão ou estiveram na competição **na temporada**
   (inclui quem migrou). Um clube em **ambas** é legítimo e **não é erro** de config, de
   consistência nem de diagnóstico.
2. **Quem de fato jogou** é determinado pela evidência do provedor (partidas e tabela
   vistas), não pela lista. A UI mostra o cartão da competição para o candidato; se o
   clube não tem partida vista na competição, o estado é o de "sem jogos/dados" honesto
   (mesmo texto-canônico do T-05), nunca zeros nem omissão silenciosa.
3. Nenhuma regra de teste exige exclusividade entre continentais; a regra existente
   "todo clube listado existe no Brasileirão" permanece. Migração no meio da temporada
   (ex.: eliminado da Libertadores que cai na Sul-Americana) é ajuste manual de config
   versionada, com `observacao` + data (ADR-020 item 2); o diagnóstico
   `participante-nao-configurado` sinaliza o clube visto e não listado — nunca auto-inclusão.
4. A tabela `misto` (ADR-020 item 5) aceita linhas ≤ candidatos; um candidato ausente da
   tabela não é inconsistência.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Lista exclusiva por clube (uma continental) | Contraria a regra de negócio; Botafogo seria "erro" |
| Descoberta automática de participantes | Rejeitada no ADR-020 (config auditável; resposta truncada) |

## Consequências

**Positivas**: reflete o torneio real; sem falso erro. **Negativas**: cartão de competição
sem jogos para candidato que migrou; revisão humana por temporada; o SPK-07 pode estar
defasado (perfil do time).
