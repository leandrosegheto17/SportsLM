// dominio/noticias/index.ts — ING-N-02 (TASK.md Lote 4)
//
// Ponto único de importação do módulo `noticias` (pipeline de ingestão de
// notícias, FL-06/RF-15). Módulo puro, sem I/O (GUARDRAILS.md §5) — só reexporta.

export * from './normalizador-item';
export * from './deduplicador';
export * from './avaliador-fontes';
export * from './montador-feed';
