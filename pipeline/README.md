# pipeline/

Ingestão executada em CI agendado (SDD §2.1-A, ADR-002). Node.js 22, TypeScript
estrito. Dependências de runtime autorizadas: `fast-xml-parser`, `zod` (SDD §3).

Conteúdo real (`coletor-rss`, `normalizador-item`, `classificador-esportes`,
`deduplicador`, `avaliador-fontes`, `retencao`, `coletor-futebol`,
`adaptador-football-data`, `derivador-status`, `derivador-paleta`,
`gerador-snapshots`) entra a partir do Lote 4/5/6 — este arquivo só documenta a
estrutura criada em FUND-01.

`gerador-snapshots` (PUB-02, Lote 6) vive em `pipeline/publicacao/` e é o
ponto de integração final: lê o estado interno de `pipeline/noticias/
orquestrador.ts` (ING-N-07) e `pipeline/futebol/orquestrador.ts` (ING-F-05) +
`config/*.json` (com a paleta derivada por PUB-01), e produz todos os
arquivos do contrato público do SDD §2.2 em `dist-dados/` (mesma convenção já
usada por `.github/workflows/ingestao.yml`/FUND-02).
