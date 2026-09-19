// app/dados/useStatusFutebol.ts — COB-26: `futebol[...]` do status.json, tolerante.
import { z } from 'zod';
import { useSnapshot } from './useSnapshot';
import type { ClienteSnapshot, EstadoSnapshot } from './clienteSnapshot';

export const URL_STATUS_INGESTAO = '/dados/ingestao/status.json';

const CONHECIDOS = [
  'atualizada',
  'inconsistente',
  'fora-da-janela',
  'sem-cobertura',
  'provedor-nao-registrado',
  'pausado-por-cota',
  'sem-dados-provedor',
  'falha',
];

/** Valor desconhecido de `resultado` vira `falha` (nunca quebra a validação). */
const resultadoTolerante = z
  .string()
  .transform((v) => (CONHECIDOS.includes(v) ? v : 'falha'));

export const statusFutebolSchema = z
  .object({
    futebol: z
      .record(
        z.string(),
        z.object({
          resultado: resultadoTolerante,
          ultimaAtualizacao: z.string().nullable().optional().default(null),
        }),
      )
      .default({}),
  })
  .transform((s) => s.futebol);

export type StatusFutebol = z.infer<typeof statusFutebolSchema>;

export function useStatusFutebol(
  cliente?: ClienteSnapshot,
): EstadoSnapshot<StatusFutebol> {
  return useSnapshot<StatusFutebol>(
    URL_STATUS_INGESTAO,
    'status',
    statusFutebolSchema as unknown as z.ZodType<StatusFutebol>,
    cliente ? { cliente } : undefined,
  );
}
