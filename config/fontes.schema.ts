// config/fontes.schema.ts — CFG-05
//
// Schema Zod + tipo derivado para `config/fontes.json` (catálogo de fontes de
// notícia), conforme a interface `Fonte` do SDD §5.1 e o formato de arquivo
// definido no ADR-007.
//
// Nota de implementação (reconciliada após achado de revisão inline do
// Executor de DOM-01, Lote 3): `EsporteId` não é mais duplicado aqui — é
// reexportado de `config/esportes.schema.ts` (CFG-01), que é o canônico dos
// 15 ids da Seção 2A do PRD-TECNICO. Antes deste ajuste, este arquivo mantinha
// uma cópia própria com 3 slugs divergentes (`volei`/`automobilismo`/
// `ginastica` em vez de `volei-quadra`/`formula1`/`ginastica-artistica`), o
// que teria colidido silenciosamente com `volei-praia` e demais consumidores
// do catálogo. `dominio/esportes` (DOM-02, Lote 3) também deve reexportar
// daqui/de CFG-01 quando existir, nunca duplicar a lista de novo.

import { z } from 'zod';
import { esporteIdSchema } from './esportes.schema';

export { esporteIdSchema };
export type EsporteId = z.infer<typeof esporteIdSchema>;

const feedSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  formato: z.enum(['rss', 'atom']),
  esporteFixado: esporteIdSchema.nullable(),
});

const termosSchema = z.object({
  url: z.string().url().nullable(),
  verificadoEm: z.string().nullable(), // ISO 8601, ou null se nunca verificado
  uso: z.enum(['nao-comercial', 'livre']),
});

const verificacaoSchema = z.object({
  estado: z.enum(['verificada', 'pendente', 'falhou']),
  em: z.string().nullable(), // ISO 8601, ou null se nunca verificado (ADR-007)
  // Campo extra do exemplo do ADR-007 (auditoria de quem verificou); opcional
  // porque a interface `Fonte` do SDD §5.1 não o exige.
  por: z.string().optional(),
});

export const fonteSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  fixa: z.boolean(), // true só para o GE (RN-03)
  esportesCobertos: z.array(esporteIdSchema),
  termos: termosSchema,
  frequenciaMaximaMin: z.number().int().positive(), // CA-15.7
  // Teto de 8 feeds por fonte (ADR-007, ~18 requisições HTTP por execução).
  feeds: z.array(feedSchema).max(8),
  verificacao: verificacaoSchema,
  // Substitutos ordenados para a troca da 5ª fonte, sem mudar código
  // (RN-19/I-25/ADR-007 item 5). Só relevante para a fonte "candidata".
  substitutos: z.array(z.string()).optional(),
});

export type Fonte = z.infer<typeof fonteSchema>;

// RN-19: o catálogo de notícias tem exatamente 7 fontes (decisão direta do
// stakeholder, 2026-09-08 — ver `.md/BLOCKERS.md` Bloqueio 011 e nota de
// atualização em `.md/adr/007-catalogo-de-fontes-como-configuracao-verificada.md`;
// regra original previa 5, fixas desde o ADR-007).
export const catalogoFontesSchema = z.array(fonteSchema).length(7);

export type CatalogoFontes = z.infer<typeof catalogoFontesSchema>;
