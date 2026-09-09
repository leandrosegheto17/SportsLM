# ADR-007 — Catálogo de fontes como configuração verificada, com estado de fonte em runtime

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-01, RF-02, RF-15, RN-01, RN-08, RN-19, I-25, CA-01.4
- **Riscos atacados**: R4 (fonte descontinuada — Lance/410 Gone), P1

**Nota de atualização (2026-09-08)**: o número fixo de fontes (Seção "Contexto"
abaixo, RN-19) mudou de 5 para **7** por decisão direta do stakeholder, fora
deste fluxo de arquitetura — `ogol.com.br` e `Superesportes` foram adicionadas
ao catálogo, ambas `verificacao.estado: pendente` (ver `.md/BLOCKERS.md`
Bloqueio 011 e `.md/PRD-TECNICO.md` RN-19 atualizado). O mecanismo desenhado
neste ADR (configuração verificada, estado de fonte em runtime, troca via
`config/fontes.json` sem mudar código) continua válido e é exatamente o que
permitiu essa ampliação sem redesenho — só o número fixo em
`catalogoFontesSchema`/`catalogoFontesPublicoSchema` (`.length(N)`) precisou
mudar de 5 para 7, nos dois arquivos que o declaram.

**Nota de atualização (2026-09-09)**: número fixo ampliado de 7 para **12**,
mesma mecânica (`.length(N)` nos dois arquivos), a partir de um bug real
reportado pelo usuário — ver `.md/BLOCKERS.md` Bloqueio 012 para a causa raiz
(URLs de feed da Gazeta Esportiva desatualizadas, 404) e a busca de 5 fontes
novas (F1Mania.net, Motorsport.com Brasil, Estadão Esportes, R7 Esporte,
Torcedores.com) mais 2 feeds novos numa fonte já existente (ESPN Brasil —
NBA e F1). De novo, nenhum redesenho de arquitetura foi necessário — o
mecanismo de configuração verificada absorveu a mudança como já previsto por
este ADR.

## Contexto

O catálogo é fechado em 5 fontes (RN-19) e a troca da 5ª por um substituto ordenado
precisa ser **alteração de configuração, não de código** (CA-01.4/I-25). Além disso,
fonte some: o feed do Lance retornou **410 Gone** em 2026-09-05 — evidência direta de
que uma URL de feed válida hoje pode desaparecer.

Verificação feita nesta rodada pelo Coordenador, com a ferramenta de fetch do
ambiente:

| Fonte | Resultado desta rodada |
|---|---|
| ESPN Brasil (`https://www.espn.com.br/espn/rss/news`) | **Reverificada e ativa**: RSS 2.0 válido, canal "www.espn.com.br - TOP", 21 itens, mais recente em 2026-09-05, 14 de 21 com resumo |
| Gazeta Esportiva, Terra Esportes | Mantidas como verificadas pelo BA em 2026-09-05 |
| **UOL Esporte** (`rss.uol.com.br/feed/esporte.xml`) | **Não verificável**: o domínio é bloqueado pela ferramenta deste ambiente (mesma limitação do BA). Um caminho alternativo encontrado em busca (`www3.uol.com.br/xml/midiaindoor/...`) também é bloqueado e, por ser um feed de "mídia indoor", teria termos próprios — **não** é substituto aceitável sem leitura dos termos |
| Folha Esporte (substituto 1) | **Não verificável**: domínio bloqueado pela ferramenta |
| Placar (substituto 2) | **HTTP 403 reproduzido** — bloqueio a acesso automatizado |
| **GE** | Ver ADR-013 (premissa crítica P-GE) |

Conclusão honesta: **nem a candidata nem os dois substitutos ordenados podem ser
verificados a partir deste ambiente**. Chutar qual funciona seria inventar evidência.

## Decisão

1. **O catálogo é um arquivo de configuração versionado**, `config/fontes.json`, e a
   ingestão não tem nenhuma fonte embutida em código:

   ```jsonc
   {
     "id": "espn-br",
     "nome": "ESPN Brasil",
     "fixa": false,                       // true só para o GE (RN-03)
     "esportesCobertos": ["futebol", "automobilismo", "mma", "basquete", "tenis"],
     "termos": { "url": "...", "verificadoEm": "2026-09-05", "uso": "nao-comercial" },
     "frequenciaMaximaMin": 30,           // CA-15.7
     "feeds": [
       { "id": "espn-top", "url": "https://www.espn.com.br/espn/rss/news",
         "formato": "rss", "esporteFixado": null }
     ],
     "verificacao": { "estado": "verificada", "em": "2026-09-05", "por": "coordenador" },
     "substitutos": []
   }
   ```

2. **Uma fonte pode ter vários feeds**, e cada feed pode ter `esporteFixado`. É assim
   que a Gazeta Esportiva (feeds por esporte: basquete, tênis, vôlei, automobilismo,
   futsal, natação, atletismo, ciclismo) amplia a cobertura dos 15 esportes sem
   depender de classificação por texto (ver ADR-008). Teto: **8 feeds por fonte** e
   ~18 requisições HTTP por execução de ingestão de notícias.

3. **Três estados de verificação**, explícitos no arquivo: `verificada`,
   `pendente`, `falhou`. O estado é fato registrado com data, não suposição.

4. **Script `verificar-catalogo`** (`npm run verificar-catalogo`), executável fora do
   ambiente restrito, que para cada feed do catálogo checa: HTTP 200, `Content-Type`
   de XML, parse válido, ≥ 1 item com título e link, e data do item mais recente. A
   saída atualiza o bloco `verificacao` do arquivo. **Este script é o mecanismo formal
   de fechamento de P1** — a verificação do UOL/Folha/Placar é uma execução dele numa
   rede sem o bloqueio deste ambiente, não uma nova rodada de agente.

5. **Substituição da 5ª fonte é edição de configuração** (I-25): trocar o bloco do
   `uol` pelo do `folha` e registrar a troca na tabela da Seção 3 do SDD. Nenhuma
   linha de código muda. **A substituição nunca é automática em runtime** — o catálogo
   tem exatamente 5 fontes por regra de negócio (RN-19), e trocar quem está no
   catálogo é decisão registrada, não efeito colateral de um timeout.

6. **Estado de fonte em runtime** (`instável`, RN-08) vive em `estado/status.json`,
   separado da configuração: falhas consecutivas por > 6 h (12 tentativas seguidas na
   cadência de 30 min) **ou** nenhum item novo por > 72 h → `instavel: true` com
   `instavelDesde`. Sai do estado ao entregar um item (CA-15.6/FL-06). A fonte
   **permanece no catálogo** e seus itens em cache continuam sendo exibidos
   (CA-04.5).

7. **Comportamento se a 5ª fonte não estiver verificada quando o desenvolvimento
   começar**: o produto opera com as fontes verificadas, e a 5ª aparece na lista com
   estado "instável desde <data>" — nunca some da lista (CA-01.2) e nunca é
   substituída em silêncio. O catálogo continua com 5 entradas.

## Consequências

**Positivas**: resiliência real ao cenário Lance/410; substituição barata e auditável;
cobertura dos 15 esportes melhorada por configuração de feeds, sem código.

**Negativas**: o arquivo de configuração vira artefato crítico — erro nele derruba a
ingestão de uma fonte. Mitigação: validação de esquema (Zod) do `fontes.json` no
arranque do pipeline e no CI, com falha ruidosa.

**Pendência registrada**: P1 permanece **parcialmente aberta** — 3 de 5 fontes
verificadas por ferramenta (ESPN, Gazeta, Terra), GE em P-GE (ADR-013) e a 5ª
dependendo da execução manual do `verificar-catalogo`.

## Se virar produto

Verificação automática do catálogo em cadência semanal no CI, com alerta em falha; e
revisão jurídica dos termos de cada fonte (R1/R4), hoje fora do roster.
