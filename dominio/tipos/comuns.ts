// dominio/tipos/comuns.ts — DOM-01 (TASK.md Lote 3)
//
// Primitivas de validação reaproveitadas por vários tipos do domínio (SDD §5).
// Módulo puro, sem I/O (GUARDRAILS.md §5).

import { z } from 'zod';

/** Slug estável em minúsculas (ex.: `Clube.id = 'atletico-mg'`,
 * `Competicao.id = 'brasileirao-serie-a'`). Mesma convenção usada em
 * `pipeline/config/clubes.ts` (CFG-02) e `config/campeonatos.schema.ts` (CFG-03). */
export const slugSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'deve ser um slug estável em minúsculas (kebab-case)',
  );

/** Cor hexadecimal `#RRGGBB` — usada tanto pela cor base de entrada quanto
 * pelos tons derivados de `PaletaClube` (ADR-017). */
export const corHexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'deve ser uma cor hex no formato #RRGGBB');

/**
 * Data/hora ISO 8601. O SDD §5 declara "sempre com deslocamento -03:00", mas
 * a validação de deslocamento fica a cargo de quem grava o dado (pipeline) —
 * aqui validamos o formato ISO 8601 genérico (aceita qualquer deslocamento
 * válido) para não rejeitar, no domínio, um dado que a UI/pipeline decida
 * representar em UTC antes de formatar para exibição.
 */
export const dataHoraIsoSchema = z
  .string()
  .refine((valor) => !Number.isNaN(Date.parse(valor)), {
    message: 'deve ser uma data/hora ISO 8601 válida',
  });

/** `link` de `ItemNoticia`: só `http(s)` absoluto (ADR-011, GUARDRAILS.md §4). */
export const linkHttpSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
    message: 'link deve ser http(s) absoluto (ADR-011)',
  });
