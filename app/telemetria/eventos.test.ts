// app/telemetria/eventos.test.ts — TEL-01 (TASK.md Lote 12)

import { describe, expect, it } from 'vitest';
import { NOMES_EVENTOS_TELEMETRIA } from './eventos';

describe('eventos (ADR-012 regra 1 — lista fechada)', () => {
  it('tem exatamente os 5 eventos de RNF-07, nesta ordem', () => {
    expect(NOMES_EVENTOS_TELEMETRIA).toEqual([
      'primeira_sessao',
      'retorno',
      'personalizacao_concluida',
      'primeira_interacao_util',
      'comparativo_aberto',
    ]);
  });

  it('não tem nenhum evento duplicado', () => {
    expect(new Set(NOMES_EVENTOS_TELEMETRIA).size).toBe(NOMES_EVENTOS_TELEMETRIA.length);
  });
});
