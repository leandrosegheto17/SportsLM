// config/categorias-fonte.schema.ts — ING-N-03 (TASK.md Lote 4, ADR-008)
//
// Schema Zod de validação de `config/categorias-fonte.json`: o mapa do
// nível 2 da cascata de classificação sem IA (ADR-008) — por `fonteId`, um
// mapa de categoria/tag do item (já normalizada: minúsculas, sem
// acento/pontuação, mesma regra de `dominio/esportes/classificador.ts` →
// `normalizarTexto`) para o `EsporteId` correspondente.
//
// Decisão registrada (não bloqueia ING-N-03): nenhuma fonte do catálogo
// (`config/fontes.json`, CFG-05) tem hoje uma tag `<category>` de item
// confirmada por observação real do feed — confirmar isso exige rodar
// `coletor-rss` (ING-N-01) contra o feed de verdade e inspecionar o XML, o
// que é trabalho operacional fora do escopo desta tarefa (mesmo espírito da
// "sentinela pendente-confirmacao" de CFG-02 e do "arquivo pode ficar
// ausente/vazio" de CFG-04: não inventar dado não confirmado). Por isso o
// arquivo publicado nesta tarefa é `{}` — estado inicial válido (nenhuma
// fonte com categoria mapeada ainda), e o nível 2 da cascata simplesmente não
// encontra correspondência para nenhuma fonte até alguém popular este mapa a
// partir de tags reais observadas. Recomendo ao Coordenador uma tarefa futura
// de "inspecionar `<category>` real de cada feed e popular este arquivo"
// quando o pipeline já estiver rodando de verdade.

import { z } from 'zod';
import { esporteIdSchema } from './esportes.schema';

export { esporteIdSchema };

/** Por fonte (`Fonte.id`), um mapa de categoria normalizada → `EsporteId`. */
export const mapaCategoriasPorFonteSchema = z.record(
  z.string().min(1),
  z.record(z.string().min(1), esporteIdSchema),
);

export type MapaCategoriasPorFonteConfig = z.infer<typeof mapaCategoriasPorFonteSchema>;
