// config/lexico-esportes.schema.ts — ING-N-03 (TASK.md Lote 4, ADR-008)
//
// Schema Zod de validação de `config/lexico-esportes.json`: o léxico
// ponderado do nível 3 da cascata de classificação sem IA (ADR-008). Módulo
// puro (sem I/O), no mesmo padrão de `config/esportes.schema.ts` (CFG-01):
// reexporta `esporteIdSchema`/`EsporteId` de lá em vez de duplicar a lista
// dos 15 ids (mesma reconciliação já aplicada em `config/fontes.schema.ts`,
// CFG-05).
//
// Formato do arquivo (ver `dominio/esportes/classificador.ts`, que consome a
// mesma forma de dado depois de carregado por quem chama):
//   { "porEsporte": [ { "esporte": EsporteId, "termos": [{ "termo", "peso" }] } ],
//     "foraDoRecorte": [ { "nome": string, "termos": [...] } ] }

import { z } from 'zod';
import { esporteIdSchema } from './esportes.schema';

export { esporteIdSchema };
export type EsporteId = z.infer<typeof esporteIdSchema>;

/** Peso do termo (ADR-008): 3 = nome do esporte/termo inequívoco, 2 =
 * entidade (clube, liga, sigla), 1 = termo ambíguo. */
export const pesoLexicoSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const termoLexicoSchema = z.object({
  termo: z.string().min(1),
  peso: pesoLexicoSchema,
});

export const entradaLexicoEsporteSchema = z.object({
  esporte: esporteIdSchema,
  termos: z.array(termoLexicoSchema).min(1),
});

export const entradaLexicoForaDoRecorteSchema = z.object({
  nome: z.string().min(1),
  termos: z.array(termoLexicoSchema).min(1),
});

/** Valida o arquivo inteiro: um `porEsporte` por esporte (sem duplicata, sem
 * esporte faltando dos 15 da Seção 2A) e ao menos 1 entrada em
 * `foraDoRecorte` (ADR-008 cita 10 esportes reconhecidos fora do recorte). */
export const lexicoEsportesSchema = z
  .object({
    porEsporte: z.array(entradaLexicoEsporteSchema),
    foraDoRecorte: z.array(entradaLexicoForaDoRecorteSchema).min(1),
  })
  .superRefine((lexico, ctx) => {
    const idsVistos = new Set<EsporteId>();
    lexico.porEsporte.forEach((entrada, indice) => {
      if (idsVistos.has(entrada.esporte)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `esporte duplicado no léxico: ${entrada.esporte}`,
          path: ['porEsporte', indice, 'esporte'],
        });
      }
      idsVistos.add(entrada.esporte);
    });

    for (const id of esporteIdSchema.options) {
      if (!idsVistos.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `esporte da Seção 2A sem entrada no léxico: ${id}`,
          path: ['porEsporte'],
        });
      }
    }
  });

export type LexicoEsportesConfig = z.infer<typeof lexicoEsportesSchema>;
