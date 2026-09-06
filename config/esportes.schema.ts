// config/esportes.schema.ts — CFG-01
//
// Schema Zod de validação de `config/esportes.json` (SDD §2.6, RN-06,
// PRD-TECNICO.md Seção 2A). Módulo puro (sem I/O) — a leitura do arquivo em
// disco fica fora daqui (feita por quem consome, ex.: teste, pipeline ou SPA
// via `resolveJsonModule`), conforme a regra de pureza de `dominio/`
// (GUARDRAILS.md §5). Colocado em `config/`, não em `dominio/`, porque é
// específico da validação deste arquivo de configuração por temporada — o
// módulo `dominio/esportes` mais amplo (helpers de esporte válido/inválido,
// ordenação — DOM-02, Lote 3) é responsabilidade de tarefa própria e pode
// importar/reexportar `EsporteId` daqui quando existir, sem duplicar a lista.

import { z } from 'zod';

/** Os 15 ids estáveis da Seção 2A do PRD-TECNICO (RN-06). Nunca reordenar nem
 * remover um id existente — trocar a lista de esportes é mudança de RN-06,
 * decidida pelo Coordenador/stakeholder, não pelo Executor. */
export const ESPORTE_IDS = [
  'futebol',
  'volei-quadra',
  'formula1',
  'basquete',
  'tenis',
  'volei-praia',
  'natacao',
  'mma',
  'ginastica-artistica',
  'surfe',
  'skate',
  'judo',
  'atletismo',
  'futsal',
  'futebol-americano',
] as const;

export const esporteIdSchema = z.enum(ESPORTE_IDS);

export type EsporteId = z.infer<typeof esporteIdSchema>;

export const esporteSchema = z.object({
  id: esporteIdSchema,
  nome: z.string().min(1),
  ordem: z.number().int().min(1).max(ESPORTE_IDS.length),
});

export type Esporte = z.infer<typeof esporteSchema>;

/** Valida a lista inteira de `config/esportes.json`: exatamente os 15 ids da
 * Seção 2A, sem duplicata, com `ordem` batendo com a posição no arquivo
 * (RN-06 — "configuração ordenada"). */
export const esportesSchema = z
  .array(esporteSchema)
  .length(ESPORTE_IDS.length)
  .superRefine((esportes, ctx) => {
    const idsVistos = new Set<EsporteId>();

    esportes.forEach((esporte, indice) => {
      if (idsVistos.has(esporte.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `id de esporte duplicado: ${esporte.id}`,
          path: [indice, 'id'],
        });
      }
      idsVistos.add(esporte.id);

      const ordemEsperada = indice + 1;
      if (esporte.ordem !== ordemEsperada) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ordem inconsistente com a posição no arquivo: esperado ${ordemEsperada}, recebido ${esporte.ordem}`,
          path: [indice, 'ordem'],
        });
      }
    });

    for (const id of ESPORTE_IDS) {
      if (!idsVistos.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `id de esporte da Seção 2A ausente: ${id}`,
          path: [],
        });
      }
    }
  });
