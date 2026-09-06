// dominio/dedup/index.ts — DOM-03 (TASK.md Lote 3)
//
// Ponto único de importação do módulo de deduplicação de manchetes
// (RN-16, ADR-009). Módulo puro, sem I/O (GUARDRAILS.md §5) — só reexporta.

export * from './normalizacao';
export * from './similaridade';
export * from './agrupamento';
export * from './representante';
