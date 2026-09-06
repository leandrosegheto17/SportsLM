// dominio/tipos/estado-local.ts — DOM-01 (TASK.md Lote 3)
//
// `Preferencias` e `Cenario` (SDD §5.3): estado local do dispositivo (ADR-005),
// nunca sai do dispositivo, nunca dado pessoal (CA-13.5). Módulo puro, sem I/O
// (GUARDRAILS.md §5) — a leitura/escrita real de `localStorage` é
// responsabilidade de `armazenamento/preferencias`/`armazenamento/cenario`
// (UI-DS-09, Lote 7), que importa estes schemas para validar o conteúdo lido
// antes de confiar nele (TASK.md Diretriz #6/GUARDRAILS.md §4).

import { z } from 'zod';
import { esporteIdSchema } from './esportes';
import { slugSchema } from './comuns';

/** `Preferencias` (SDD §5.3). */
export const preferenciasSchema = z.object({
  versaoEsquema: z.literal(1),
  temporada: z.number().int(),
  favoritos: z.array(esporteIdSchema).max(3), // 0 a 3 (RN-06)
  fontesBloqueadas: z.array(z.string().min(1)), // nunca contém a fonte fixa (RN-03)
  timeId: slugSchema.nullable(),
  rivais: z.array(slugSchema).max(2), // 0 a 2, sempre ≠ timeId (RN-11)
  atualizadoEm: z.string(),
});

export type Preferencias = z.infer<typeof preferenciasSchema>;

/** Palpite de uma partida no cenário de simulação (RN-14). */
export const palpiteSchema = z.enum(['vitoria', 'empate', 'derrota']);

export type Palpite = z.infer<typeof palpiteSchema>;

/** `Cenario` (SDD §5.3). */
export const cenarioSchema = z.object({
  versaoEsquema: z.literal(1),
  escopo: z.string().min(1), // 'temporada:time:rivais-ordenados'
  palpites: z.record(z.string(), palpiteSchema), // por id de partida
  partidasTravadasVistas: z.array(z.string()), // base do aviso de CA-11.6
});

export type Cenario = z.infer<typeof cenarioSchema>;
