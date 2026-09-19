# ADR-019 — Adversário fora da Série A entra no contrato como dado de exibição da `Partida`

- **Status**: Aceito
- **Data**: 2026-09-18
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-21, RN-23, CA-21.1 a CA-21.3, RNF-20, CA-16.6; GUARDRAILS §5
  (mudança de contrato exige concordância do Coordenador — esta é a concordância)
- **Relaciona-se com**: ADR-006 (item 3: casamento por id, nunca por nome), ADR-011
  (conteúdo de terceiro é texto puro), ADR-017 (cor de clube só para clube da Série A)

## Contexto

Copa do Brasil, Libertadores e Sul-Americana têm adversários que não estão nos 20 clubes
de `clubes-2026.json` (times de outras séries, clubes estrangeiros). Hoje
`adaptador-thesportsdb.ts` **descarta** qualquer partida em que um dos lados não casa por
`idsProvedor.thesportsdb` (`clube-nao-mapeado`), o que apagaria quase todo o calendário
dessas competições. `Partida.mandanteId`/`visitanteId` são `slug` obrigatórios e são lidos
em ~27 arquivos (motor de simulação, Comparativo, Painel, Detalhe, Home).

O PRD-TECNICO pede: manter a partida com o adversário pelo nome do provedor, identidade
visual neutra, sem entidade cadastrada (RN-23), sem relaxar o casamento do clube da Série
A (CA-21.3), e descartar jogo sem nenhum clube da Série A (CA-21.2).

## Decisão

1. **`Partida` ganha um campo opcional aditivo**:

   ```ts
   interface Partida {
     /* ...campos existentes inalterados... */
     externo?: { lado: 'mandante' | 'visitante'; nome: string };   // ADR-019
   }
   ```

2. **O lado externo mantém um id sintético estável**: `externo-<idTeam do provedor>`
   (ex.: `externo-134567`), que satisfaz o `slugSchema` já existente em
   `mandanteId`/`visitanteId`. Nenhum tipo existente muda de assinatura — ver
   "Alternativas". O id vem do **id do provedor**, nunca de slug do nome.
3. **Invariantes (Zod `refine` em `partidaSchema`)**: `externo` presente ⇔ exatamente um
   dos dois ids começa com `externo-`; `externo.lado` coincide com o lado desse id; o
   outro lado é sempre um clube da Série A (nunca `externo-`); `nome` é texto puro,
   aparado, 1 a 60 caracteres, sem caractere de controle (entrada de terceiro, ADR-011).
   Partida sem `externo` é idêntica ao contrato de hoje — o Brasileirão e o motor de
   simulação não mudam.
4. **Regras do adaptador (RF-21)**: (a) um lado Série A + um lado desconhecido → mantém,
   com `externo`; (b) nenhum lado Série A → **descarta** e conta como `fora-do-recorte`
   (não é inconsistência, é o comportamento esperado — CA-21.2); (c) ambos Série A →
   como hoje. Na classificação, linha de clube não mapeado é ignorada **sem** registrar
   inconsistência; a tabela publicada mostra só clubes da Série A (posição do provedor
   preservada).
5. **Clube da Série A sem `idsProvedor.thesportsdb` (CA-21.3)** continua sendo
   inconsistência: como o id ausente faz o clube parecer "externo", o adaptador compara o
   nome do provedor com nome/nome curto dos 20 clubes **apenas como diagnóstico**; se
   bater, a partida é descartada e registrada como `clube-serie-a-sem-id` — **nunca**
   casada por nome, **nunca** exibida como externo. O pré-requisito real é preencher os
   ids (COB-03).
6. **Apresentação (SPA)**: o adversário externo é renderizado como nó de texto com o nome
   do provedor; onde houver avatar, usa `AvatarClube` sem `corIdentidade` (fallback neutro
   de `tokens.css`) com até 3 iniciais do nome; nunca usa cor de clube, escudo, link nem
   página própria (RN-23, GUARDRAILS §6). Toda resolução de nome de lado passa por **um**
   helper (COB-22) — nenhuma tela faz `clubes.find(...)?.nome ?? id` (que exibiria
   `externo-134567`).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| `mandanteId`/`visitanteId` passam a `string \| null` + campo de nome | Quebra tipagem em ~27 arquivos, incluindo o motor de simulação (que só vê Brasileirão); alto raio de mudança para um caso que só ocorre em 3 competições |
| Cadastrar adversários em `clubes-2026.json` | Viola RN-23 (centenas de clubes, cor/escudo/página), amplia ADR-017 e a auditoria de contraste sem ganho |
| Casar/derivar id do adversário pelo nome | Viola ADR-006 item 3 e CA-16.6 (fonte clássica de erro silencioso) |
| Campo separado `adversario` e ids nulos só em partida externa | Equivale à 1ª alternativa; o id sintético dá o mesmo resultado sem tocar tipos |

## Consequências

**Positivas**: contrato aditivo (campo opcional, partidas antigas continuam válidas);
Brasileirão e simulação intocados; casamento por id preservado onde importa; a lacuna de
id de clube da Série A continua barulhenta em vez de silenciosa.

**Negativas**: id sintético `externo-*` é convenção — consumidores que ignorarem o helper
exibirão o id cru (mitigado por teste de contrato em COB-22/COB-21 e verificação de
grep no COB-30); nome do provedor pode divergir entre competições para o mesmo clube
(aceito: não há entidade para reconciliar); a tabela publicada de estaduais/continentais é
parcial (só Série A), o que a UI declara em texto (UX-SPEC T-06).

**Segurança**: `externo.nome` é entrada de terceiro — limite de tamanho e caracteres na
ingestão (Zod), renderização só como texto (SDD §7.4).

## Se virar produto

Cadastro de clubes com licenciamento de escudo e reconciliação de nomes entre provedores;
o campo `externo` vira referência a uma entidade `ClubeExterno`.
