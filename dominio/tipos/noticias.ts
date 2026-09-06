// dominio/tipos/noticias.ts — DOM-01 (TASK.md Lote 3)
//
// `Fonte` e `ItemNoticia` (SDD §5.1). Módulo puro, sem I/O (GUARDRAILS.md §5).
//
// Decisão de reaproveitamento registrada (TASK.md §6): `config/fontes.schema.ts`
// (CFG-05) já valida o arquivo de configuração `config/fontes.json` com um
// schema estruturalmente muito próximo deste `Fonte`. Não reexportamos daqui
// por dois motivos: (1) direção de dependência — `dominio/` não importa de
// `config/` (SDD §2.1); (2) CFG-05 usa uma cópia antiga do enum de esporte
// (ver nota em `dominio/tipos/esportes.ts`), então importar o schema de lá
// traria de volta o enum errado. O schema abaixo é a definição canônica do
// tipo `Fonte` de runtime (SDD §5.1); `config/fontes.schema.ts` continua
// validando o arquivo de configuração por temporada — mesmo formato de dado,
// propósito de validação diferente (config estática vs. tipo de domínio
// compartilhado). Reconciliar as duas cópias do enum de esporte é a mesma
// lacuna já sinalizada ao Coordenador em `dominio/tipos/esportes.ts`.

import { z } from 'zod';
import { esporteIdSchema, esporteOuTriagemSchema } from './esportes';

/** `Fonte.termos` — condições de uso da fonte de notícia (RN-01/RN-17). */
export const termosFonteSchema = z.object({
  url: z.string().url().nullable(),
  verificadoEm: z.string().nullable(), // ISO 8601, ou null se nunca verificado
  uso: z.enum(['nao-comercial', 'livre']),
});

/** Um feed (RSS/Atom) da fonte. */
export const feedFonteSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  formato: z.enum(['rss', 'atom']),
  esporteFixado: esporteIdSchema.nullable(),
});

/** `Fonte.verificacao` — estado de verificação do catálogo (ADR-007). */
export const verificacaoFonteSchema = z.object({
  estado: z.enum(['verificada', 'pendente', 'falhou']),
  em: z.string().nullable(),
});

/** `Fonte` (SDD §5.1): uma das 5 fontes do catálogo de notícias (RN-03/RN-19). */
export const fonteSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  fixa: z.boolean(), // true só para o GE (RN-03)
  esportesCobertos: z.array(esporteIdSchema),
  termos: termosFonteSchema,
  frequenciaMaximaMin: z.number().int().positive(), // CA-15.7
  feeds: z.array(feedFonteSchema),
  verificacao: verificacaoFonteSchema,
});

export type Fonte = z.infer<typeof fonteSchema>;

/** `ItemNoticia` (SDD §5.1): item normalizado, classificado e (opcionalmente)
 * deduplicado, pronto para o contrato público (`noticias.json`, SDD §2.2). */
export const itemNoticiaSchema = z.object({
  id: z.string().min(1), // sha256 do link canônico (CA-15.3)
  fonteId: z.string().min(1),
  feedId: z.string().min(1),
  titulo: z.string().min(1).max(180), // texto puro (CA-04.3)
  resumo: z.string().max(300).nullable(), // texto puro, '…' se truncado (CA-04.3)
  link: z
    .string()
    .url()
    .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
      message: 'link deve ser http(s) absoluto (ADR-011)',
    }),
  publicadoEm: z.string(), // ISO -03:00
  dataEstimada: z.boolean(), // true → rótulo "horário estimado" (CA-04.6)
  esporte: esporteOuTriagemSchema,
  origemClassificacao: z.enum(['feed-fixado', 'categoria', 'lexico', 'nao-classificado']),
  grupoId: z.string().min(1).nullable(), // deduplicação (ADR-009)
  ingeridoEm: z.string(),
});

export type ItemNoticia = z.infer<typeof itemNoticiaSchema>;
