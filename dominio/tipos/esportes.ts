// dominio/tipos/esportes.ts — DOM-01 (TASK.md Lote 3)
//
// `EsporteId` (SDD §5.1): os 15 esportes do recorte (RN-06, PRD-TECNICO Seção
// 2A). Este módulo é a fonte canônica do tipo/validador — módulo puro, sem
// I/O (GUARDRAILS.md §5).
//
// Decisão de reaproveitamento registrada (TASK.md §6): já existem DUAS cópias
// divergentes deste enum publicadas no Lote 2, paralelo a este:
//   - `config/esportes.schema.ts` (CFG-01) usa os slugs exatos da Seção 2A do
//     PRD-TECNICO: 'volei-quadra', 'formula1', 'ginastica-artistica'.
//   - `config/fontes.schema.ts` (CFG-05) replicou uma versão mais curta/antiga
//     (comentário no próprio arquivo já previa a substituição):
//     'volei', 'automobilismo', 'ginastica'.
// Como `config/esportes.json` (o dado real publicado, fonte de verdade de
// RN-06) foi gerado a partir de CFG-01, este módulo usa os MESMOS 15 valores
// de CFG-01 (batem com a Seção 2A do PRD-TECNICO), não os de CFG-05.
//
// Direção de dependência: `dominio/` não importa de `config/` nem de
// `pipeline/` (SDD §2.1 — pipeline/config consomem `dominio`, nunca o
// contrário). Por isso os valores são definidos aqui, não reexportados de
// `config/esportes.schema.ts` — mesmo sendo idênticos. `config/esportes.schema.ts`
// já registrava a intenção de um dia reexportar de aqui; isso é refino futuro,
// fora do escopo desta tarefa (não convém editar CFG-01/05, já `Concluída`,
// sem pedido explícito do Coordenador).
//
// Lacuna de detalhe sinalizada para o Coordenador (não bloqueia DOM-01): a
// divergência de nomes entre CFG-01 e CFG-05 deveria ser reconciliada —
// `config/fontes.schema.ts`/`config/fontes.json` usam os nomes antigos, que já
// não representam os 15 ids reais de `config/esportes.json`. Recomendo uma
// tarefa de reconciliação (ou nota em BLOCKERS.md, a critério do Coordenador)
// antes que `ING-N-03` (`classificador-esportes`, Lote 4) precise casar
// `Fonte.esportesCobertos`/`feed.esporteFixado` com este `EsporteId` canônico.

import { z } from 'zod';

/** Os 15 ids estáveis da Seção 2A do PRD-TECNICO (RN-06) — idênticos aos de
 * `config/esportes.schema.ts` (CFG-01), fonte real de `config/esportes.json`. */
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

/** `EsporteId` (SDD §5.1). */
export type EsporteId = z.infer<typeof esporteIdSchema>;

/** `esporte` de `ItemNoticia` (SDD §5.1): um dos 15 ids, ou os dois valores
 * especiais de triagem da ingestão de notícias. */
export const esporteOuTriagemSchema = z.union([
  esporteIdSchema,
  z.literal('geral'),
  z.literal('fora-do-recorte'),
]);

export type EsporteOuTriagem = z.infer<typeof esporteOuTriagemSchema>;
