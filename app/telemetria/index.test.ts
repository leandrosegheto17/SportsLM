// app/telemetria/index.test.ts — TEL-01 (TASK.md Lote 12)
//
// Confirma o comportamento em runtime do interruptor de build via
// `vi.stubEnv` (que também reflete em `import.meta.env` no Vitest). A
// eliminação de fato do módulo do bundle de produção — não só a checagem em
// runtime — é confirmada separadamente em `buildEliminacao.test.ts`, com um
// `vite build` real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparEventosRegistrados, obterEventosRegistrados } from './coletor';
import {
  registrarComparativoAberto,
  registrarPersonalizacaoConcluida,
  registrarPrimeiraInteracaoUtil,
  registrarPrimeiraSessao,
  registrarRetorno,
  telemetriaHabilitada,
} from './index';

beforeEach(() => {
  limparEventosRegistrados();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('telemetriaHabilitada', () => {
  it('é falsa quando VITE_TELEMETRIA não é "on" (padrão seguro, opt-in)', () => {
    expect(telemetriaHabilitada()).toBe(false);

    vi.stubEnv('VITE_TELEMETRIA', 'off');
    expect(telemetriaHabilitada()).toBe(false);

    vi.stubEnv('VITE_TELEMETRIA', 'qualquer-outra-coisa');
    expect(telemetriaHabilitada()).toBe(false);
  });

  it('é verdadeira só quando VITE_TELEMETRIA=on', () => {
    vi.stubEnv('VITE_TELEMETRIA', 'on');
    expect(telemetriaHabilitada()).toBe(true);
  });
});

describe('API pública gated pelo interruptor de build', () => {
  it('com o interruptor desligado, nenhuma das 5 funções registra evento', () => {
    vi.stubEnv('VITE_TELEMETRIA', 'off');

    registrarPrimeiraSessao();
    registrarRetorno(1);
    registrarPersonalizacaoConcluida(2, true);
    registrarPrimeiraInteracaoUtil(500);
    registrarComparativoAberto('comparativo');

    expect(obterEventosRegistrados()).toEqual([]);
  });

  it('com o interruptor ligado, as 5 funções registram evento', () => {
    vi.stubEnv('VITE_TELEMETRIA', 'on');

    registrarPrimeiraSessao();
    registrarRetorno(1);
    registrarPersonalizacaoConcluida(2, true);
    registrarPrimeiraInteracaoUtil(500);
    registrarComparativoAberto('comparativo');

    expect(obterEventosRegistrados()).toHaveLength(5);
  });
});
