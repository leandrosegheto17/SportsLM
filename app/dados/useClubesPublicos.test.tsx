// @vitest-environment jsdom
// app/dados/useClubesPublicos.test.tsx — UI-T02-01 (TASK.md Lote 8)

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetarCacheClubesPublicosParaTeste,
  useClubesPublicos,
} from './useClubesPublicos';
import { URL_CONFIG_CLUBES } from './configPublico';

const PALETA_FIXTURE = {
  acromatico: false,
  identidade: '#E30613',
  faixaB: '#B10510',
  identidadeTexto: '#FFFFFF',
  acento: '#E30613',
  acentoSobreEscuro: '#FF6B6B',
  suave: '#FDE7E8',
  suaveEscuro: '#3A1013',
  identidadeEscuro: '#8C040C',
  faixaBEscuro: '#5C0308',
  identidadeTextoEscuro: '#FFFFFF',
};

const CLUBE_FIXTURE = {
  id: 'sao-paulo',
  nome: 'São Paulo Futebol Clube',
  nomeCurto: 'São Paulo',
  sigla: 'SPA',
  corBase: '#E30613',
  paleta: PALETA_FIXTURE,
};

afterEach(() => {
  resetarCacheClubesPublicosParaTeste();
  vi.restoreAllMocks();
});

describe('useClubesPublicos (UI-T02-01)', () => {
  it('busca uma única vez, valida contra o schema e devolve os clubes', async () => {
    const buscar = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [CLUBE_FIXTURE],
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useClubesPublicos({ buscar }));

    expect(result.current.carregando).toBe(true);

    await waitFor(() => {
      expect(result.current.carregando).toBe(false);
    });

    expect(result.current.clubes?.[0]?.id).toBe('sao-paulo');
    expect(result.current.erro).toBeNull();
    expect(buscar).toHaveBeenCalledWith(URL_CONFIG_CLUBES);
  });

  it('compartilha a busca entre instâncias (cache module-level, sem 1 fetch por componente)', async () => {
    const buscar = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [CLUBE_FIXTURE],
    })) as unknown as typeof fetch;

    const primeira = renderHook(() => useClubesPublicos({ buscar }));
    const segunda = renderHook(() => useClubesPublicos({ buscar }));

    await waitFor(() => {
      expect(primeira.result.current.carregando).toBe(false);
      expect(segunda.result.current.carregando).toBe(false);
    });

    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('degrada com `erro` preenchido quando o esquema é inválido, sem lançar', async () => {
    const buscar = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ id: 'x' }],
    })) as unknown as typeof fetch;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = renderHook(() => useClubesPublicos({ buscar }));

    await waitFor(() => {
      expect(result.current.carregando).toBe(false);
    });

    expect(result.current.clubes).toBeNull();
    expect(result.current.erro).not.toBeNull();
  });

  it('degrada com `erro` preenchido em falha de rede (HTTP não-ok), sem lançar', async () => {
    const buscar = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => null,
    })) as unknown as typeof fetch;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { result } = renderHook(() => useClubesPublicos({ buscar }));

    await waitFor(() => {
      expect(result.current.carregando).toBe(false);
    });

    expect(result.current.clubes).toBeNull();
    expect(result.current.erro).toContain('500');
  });
});
