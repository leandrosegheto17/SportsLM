// @vitest-environment jsdom
// app/dados/useSnapshot.test.tsx — UI-DS-08 (TASK.md Lote 7)
//
// Cobre os três critérios de aceite no nível do hook React: (1) revalida
// `versao.json` a cada 5 min só enquanto a aba está visível (Page Visibility
// API, sem sondagem cega); (2) rebusca seletivamente por hash; (3) funciona
// fim-a-fim com uma fixture que segue o contrato de dados do SDD §2.2 —
// aqui usando o schema real de `ItemNoticia` de `dominio/tipos`.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { itemNoticiaSchema } from '../../dominio/tipos/noticias';
import { ClienteSnapshot } from './clienteSnapshot';
import { INTERVALO_REVALIDACAO_MS, useSnapshot } from './useSnapshot';
import { URL_VERSAO } from './versao';

const URL_NOTICIAS = '/dados/noticias.json';

/** Fixture no formato do contrato público (SDD §2.2/§5.1) — usada até PUB-02
 * (Lote 6) publicar o snapshot real; validada pelo schema de domínio real. */
const esquemaNoticiasPublico = z.object({ itens: z.array(itemNoticiaSchema) });

const fixtureNoticias = {
  itens: [
    {
      id: 'a'.repeat(64),
      fonteId: 'ge',
      feedId: 'ge-futebol',
      titulo: 'Palmeiras vence e assume a ponta',
      resumo: 'Resumo da partida…',
      link: 'https://ge.globo.com/materia',
      publicadoEm: '2026-09-05T09:00:00-03:00',
      dataEstimada: false,
      esporte: 'futebol' as const,
      origemClassificacao: 'feed-fixado' as const,
      grupoId: null,
      ingeridoEm: '2026-09-05T09:05:00-03:00',
    },
  ],
};

function definirVisibilidade(estado: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => estado,
  });
}

function versao(hashes: {
  noticias: string;
  futebol: string;
  catalogo: string;
  status: string;
}) {
  return { geradoEm: '2026-09-05T10:00:00-03:00', hashes };
}

function criarBuscarFake(respostasNoticias: unknown[]) {
  let versaoAtual = versao({
    noticias: 'h1',
    futebol: 'f1',
    catalogo: 'c1',
    status: 's1',
  });
  const setarVersao = (v: typeof versaoAtual): void => {
    versaoAtual = v;
  };
  let indiceNoticias = 0;
  const chamadas: string[] = [];

  const buscar = vi.fn(async (url: RequestInfo | URL) => {
    const chave = String(url);
    chamadas.push(chave);
    if (chave === URL_VERSAO) {
      return { ok: true, status: 200, json: async () => versaoAtual } as Response;
    }
    if (chave === URL_NOTICIAS) {
      const corpo =
        respostasNoticias[Math.min(indiceNoticias, respostasNoticias.length - 1)];
      indiceNoticias += 1;
      return { ok: true, status: 200, json: async () => corpo } as Response;
    }
    throw new Error(`URL inesperada: ${chave}`);
  });

  return { buscar, chamadas, setarVersao };
}

/** Com `vi.useFakeTimers()` ativo, `@testing-library`'s `waitFor` trava (seu
 * polling interno usa `setTimeout`, que fica congelado). Em vez disso,
 * avançamos o relógio falso em 0ms via `act`, que a Vitest documenta como a
 * forma correta de esvaziar a fila de microtarefas pendentes (as promessas do
 * `fetch` fake resolvem por microtask, não por timer real). */
async function esvaziarMicrotarefas(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('useSnapshot (UI-DS-08)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    definirVisibilidade('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('funciona com a fixture do contrato do SDD §2.2 (ItemNoticia real de dominio/tipos)', async () => {
    const { buscar } = criarBuscarFake([fixtureNoticias]);
    const cliente = new ClienteSnapshot({ buscar });

    const { result } = renderHook(() =>
      useSnapshot(URL_NOTICIAS, 'noticias', esquemaNoticiasPublico, { cliente }),
    );

    await esvaziarMicrotarefas();
    expect(result.current.carregando).toBe(false);

    expect(result.current.dados?.itens[0]?.titulo).toBe(
      'Palmeiras vence e assume a ponta',
    );
    expect(result.current.erro).toBeNull();
  });

  it('revalida a cada 5 minutos enquanto a aba está visível', async () => {
    const { buscar, chamadas } = criarBuscarFake([fixtureNoticias, fixtureNoticias]);
    const cliente = new ClienteSnapshot({ buscar });

    renderHook(() =>
      useSnapshot(URL_NOTICIAS, 'noticias', esquemaNoticiasPublico, { cliente }),
    );

    await esvaziarMicrotarefas();
    expect(chamadas).toEqual([URL_VERSAO, URL_NOTICIAS]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_REVALIDACAO_MS);
    });

    // versao.json é revalidado; noticias.json não muda de hash nesta fixture.
    expect(chamadas).toEqual([URL_VERSAO, URL_NOTICIAS, URL_VERSAO]);
  });

  it('NÃO revalida enquanto a aba está oculta (sem sondagem cega)', async () => {
    const { buscar, chamadas } = criarBuscarFake([fixtureNoticias]);
    const cliente = new ClienteSnapshot({ buscar });

    renderHook(() =>
      useSnapshot(URL_NOTICIAS, 'noticias', esquemaNoticiasPublico, { cliente }),
    );
    await esvaziarMicrotarefas();
    expect(chamadas).toEqual([URL_VERSAO, URL_NOTICIAS]);

    definirVisibilidade('hidden');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_REVALIDACAO_MS * 2);
    });

    // Nenhuma nova chamada: o timer disparou, mas a aba estava oculta.
    expect(chamadas).toEqual([URL_VERSAO, URL_NOTICIAS]);
  });

  it('revalida imediatamente ao a aba voltar a ficar visível', async () => {
    const { buscar, chamadas } = criarBuscarFake([fixtureNoticias, fixtureNoticias]);
    const cliente = new ClienteSnapshot({ buscar });

    renderHook(() =>
      useSnapshot(URL_NOTICIAS, 'noticias', esquemaNoticiasPublico, { cliente }),
    );
    await esvaziarMicrotarefas();
    expect(chamadas).toEqual([URL_VERSAO, URL_NOTICIAS]);

    definirVisibilidade('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    definirVisibilidade('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await esvaziarMicrotarefas();

    expect(chamadas).toEqual([URL_VERSAO, URL_NOTICIAS, URL_VERSAO]);
  });

  it('rebusca noticias.json só quando o hash de "noticias" muda (rebusca seletiva)', async () => {
    const fixtureNova = {
      itens: [{ ...fixtureNoticias.itens[0]!, titulo: 'Atualizado' }],
    };
    const { buscar, chamadas, setarVersao } = criarBuscarFake([
      fixtureNoticias,
      fixtureNova,
    ]);
    const cliente = new ClienteSnapshot({ buscar });

    const { result } = renderHook(() =>
      useSnapshot(URL_NOTICIAS, 'noticias', esquemaNoticiasPublico, { cliente }),
    );
    await esvaziarMicrotarefas();
    expect(result.current.carregando).toBe(false);
    expect(result.current.dados?.itens[0]?.titulo).toBe(
      'Palmeiras vence e assume a ponta',
    );

    // Primeira revalidação: hash igual -> não rebusca o arquivo.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_REVALIDACAO_MS);
    });
    expect(chamadas).toEqual([URL_VERSAO, URL_NOTICIAS, URL_VERSAO]);
    expect(result.current.dados?.itens[0]?.titulo).toBe(
      'Palmeiras vence e assume a ponta',
    );

    // Hash de "noticias" muda -> próxima revalidação rebusca só esse arquivo.
    setarVersao(versao({ noticias: 'h2', futebol: 'f1', catalogo: 'c1', status: 's1' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_REVALIDACAO_MS);
    });

    expect(chamadas).toEqual([
      URL_VERSAO,
      URL_NOTICIAS,
      URL_VERSAO,
      URL_VERSAO,
      URL_NOTICIAS,
    ]);
    await esvaziarMicrotarefas();
    expect(result.current.dados?.itens[0]?.titulo).toBe('Atualizado');
  });
});
