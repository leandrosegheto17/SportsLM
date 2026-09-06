// app/dados/clienteSnapshot.test.ts — UI-DS-08 (TASK.md Lote 7)
//
// Cobre o critério de aceite em nível de núcleo (sem React): rebusca só o
// arquivo cujo hash mudou, versao.json buscado com `no-cache`, deduplicação
// de chamadas concorrentes, e degradação sem quebrar em caso de falha.

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ClienteSnapshot } from './clienteSnapshot';
import { URL_VERSAO } from './versao';

const URL_NOTICIAS = '/dados/noticias.json';
const URL_STATUS = '/dados/ingestao/status.json';
const URL_BRASILEIRAO = '/dados/futebol/brasileirao.json';
const URL_CLUBE_PALMEIRAS = '/dados/futebol/clube/palmeiras.json';

const esquemaNoticias = z.object({
  itens: z.array(z.object({ id: z.string(), titulo: z.string() })),
});

const esquemaStatus = z.object({ geradoEm: z.string(), pausadoPorCota: z.boolean() });

const esquemaFutebol = z.object({ clubes: z.array(z.string()) });

function versaoComHashes(hashes: {
  noticias: string;
  futebol: string;
  catalogo: string;
  status: string;
}): unknown {
  return { geradoEm: '2026-09-05T10:00:00-03:00', hashes };
}

/** Fetch fake por tabela: mapa `url -> resposta[]` (uma por chamada, na ordem). */
function criarBuscarFake(
  respostas: Record<string, Array<{ ok?: boolean; corpo?: unknown }>>,
) {
  const chamadas: string[] = [];
  const buscar = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const chave = String(url);
    chamadas.push(chave);
    const fila = respostas[chave];
    if (!fila || fila.length === 0) {
      throw new Error(`sem resposta configurada para ${chave}`);
    }
    const proxima = fila.length > 1 ? fila.shift()! : fila[0]!;
    void init;
    return {
      ok: proxima.ok ?? true,
      status: proxima.ok === false ? 500 : 200,
      json: async () => proxima.corpo,
    } as Response;
  });
  return { buscar, chamadas };
}

describe('ClienteSnapshot (UI-DS-08)', () => {
  it('busca versao.json com no-cache e o arquivo pedido na primeira chamada', async () => {
    const { buscar, chamadas } = criarBuscarFake({
      [URL_VERSAO]: [
        {
          corpo: versaoComHashes({
            noticias: 'h1',
            futebol: 'f1',
            catalogo: 'c1',
            status: 's1',
          }),
        },
      ],
      [URL_NOTICIAS]: [{ corpo: { itens: [{ id: '1', titulo: 'Gol' }] } }],
    });
    const cliente = new ClienteSnapshot({ buscar });

    await cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias);

    expect(chamadas).toEqual([URL_VERSAO, URL_NOTICIAS]);
    expect(buscar).toHaveBeenCalledWith(URL_VERSAO, { cache: 'no-cache' });
    const estado = cliente.obterEstado(URL_NOTICIAS);
    expect(estado.dados).toEqual({ itens: [{ id: '1', titulo: 'Gol' }] });
    expect(estado.carregando).toBe(false);
    expect(estado.geradoEm).toBe('2026-09-05T10:00:00-03:00');
  });

  it('NÃO rebusca o arquivo se o hash da chave não mudou (revalidação sem novidade)', async () => {
    const { buscar, chamadas } = criarBuscarFake({
      [URL_VERSAO]: [
        {
          corpo: versaoComHashes({
            noticias: 'h1',
            futebol: 'f1',
            catalogo: 'c1',
            status: 's1',
          }),
        },
        {
          corpo: versaoComHashes({
            noticias: 'h1',
            futebol: 'f1',
            catalogo: 'c1',
            status: 's1',
          }),
        },
      ],
      [URL_NOTICIAS]: [{ corpo: { itens: [] } }],
    });
    const cliente = new ClienteSnapshot({ buscar });

    await cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias);
    await cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias);

    // versao.json é buscado nas duas revalidações, mas noticias.json só uma vez.
    expect(chamadas).toEqual([URL_VERSAO, URL_NOTICIAS, URL_VERSAO]);
  });

  it('rebusca só o arquivo cujo hash mudou, deixando os demais intactos', async () => {
    const { buscar, chamadas } = criarBuscarFake({
      [URL_VERSAO]: [
        versaoComHashes({ noticias: 'h1', futebol: 'f1', catalogo: 'c1', status: 's1' }),
        versaoComHashes({ noticias: 'h2', futebol: 'f1', catalogo: 'c1', status: 's1' }),
      ].map((corpo) => ({ corpo })),
      [URL_NOTICIAS]: [
        { corpo: { itens: [{ id: '1', titulo: 'Velho' }] } },
        { corpo: { itens: [{ id: '2', titulo: 'Novo' }] } },
      ],
      [URL_STATUS]: [
        { corpo: { geradoEm: '2026-09-05T10:00:00-03:00', pausadoPorCota: false } },
      ],
    });
    const cliente = new ClienteSnapshot({ buscar });

    await cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias);
    await cliente.garantir(URL_STATUS, 'status', esquemaStatus);

    // Segunda rodada: só o hash de "noticias" mudou.
    await cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias);
    await cliente.garantir(URL_STATUS, 'status', esquemaStatus);

    expect(chamadas).toEqual([
      URL_VERSAO,
      URL_NOTICIAS,
      URL_VERSAO,
      URL_STATUS,
      URL_VERSAO,
      URL_NOTICIAS, // rebuscado: hash "noticias" mudou
      URL_VERSAO, // status.json NÃO rebuscado: hash "status" não mudou
    ]);
    expect(cliente.obterEstado(URL_NOTICIAS).dados).toEqual({
      itens: [{ id: '2', titulo: 'Novo' }],
    });
  });

  it('duas URLs do grupo "futebol" (brasileirao.json e clube/<slug>.json) revalidam pelo mesmo hash, cada uma no seu próprio cache', async () => {
    const { buscar, chamadas } = criarBuscarFake({
      [URL_VERSAO]: [
        {
          corpo: versaoComHashes({
            noticias: 'h1',
            futebol: 'f1',
            catalogo: 'c1',
            status: 's1',
          }),
        },
      ],
      [URL_BRASILEIRAO]: [{ corpo: { clubes: ['palmeiras', 'flamengo'] } }],
      [URL_CLUBE_PALMEIRAS]: [{ corpo: { clubes: ['palmeiras'] } }],
    });
    const cliente = new ClienteSnapshot({ buscar });

    await cliente.garantir(URL_BRASILEIRAO, 'futebol', esquemaFutebol);
    await cliente.garantir(URL_CLUBE_PALMEIRAS, 'futebol', esquemaFutebol);

    // Cada `garantir` (não concorrente com o outro) faz sua própria checagem
    // de versao.json — é barato (<1 KB, `no-cache`) e é o que garante que
    // cada URL veja a versão mais recente; chamadas concorrentes (mesmo
    // instante) deduplicam essa mesma busca, ver teste abaixo.
    expect(chamadas).toEqual([
      URL_VERSAO,
      URL_BRASILEIRAO,
      URL_VERSAO,
      URL_CLUBE_PALMEIRAS,
    ]);
    expect(cliente.obterEstado(URL_BRASILEIRAO).dados).toEqual({
      clubes: ['palmeiras', 'flamengo'],
    });
    expect(cliente.obterEstado(URL_CLUBE_PALMEIRAS).dados).toEqual({
      clubes: ['palmeiras'],
    });
  });

  it('deduplica chamadas concorrentes para a mesma URL (um único fetch em voo)', async () => {
    const { buscar, chamadas } = criarBuscarFake({
      [URL_VERSAO]: [
        {
          corpo: versaoComHashes({
            noticias: 'h1',
            futebol: 'f1',
            catalogo: 'c1',
            status: 's1',
          }),
        },
      ],
      [URL_NOTICIAS]: [{ corpo: { itens: [] } }],
    });
    const cliente = new ClienteSnapshot({ buscar });

    await Promise.all([
      cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias),
      cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias),
      cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias),
    ]);

    expect(chamadas).toEqual([URL_VERSAO, URL_NOTICIAS]);
  });

  it('versao.json com esquema inválido mantém o estado anterior, sem quebrar (descarte silencioso)', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { buscar } = criarBuscarFake({
      [URL_VERSAO]: [
        {
          corpo: versaoComHashes({
            noticias: 'h1',
            futebol: 'f1',
            catalogo: 'c1',
            status: 's1',
          }),
        },
        { corpo: { formato: 'inesperado' } },
      ],
      [URL_NOTICIAS]: [{ corpo: { itens: [{ id: '1', titulo: 'Gol' }] } }],
    });
    const cliente = new ClienteSnapshot({ buscar });

    await cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias);
    await cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias);

    const estado = cliente.obterEstado(URL_NOTICIAS);
    expect(estado.dados).toEqual({ itens: [{ id: '1', titulo: 'Gol' }] });
    expect(estado.erro).toBeNull();
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it('falha ao buscar o arquivo preserva o último dado válido e registra o erro', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { buscar } = criarBuscarFake({
      [URL_VERSAO]: [
        {
          corpo: versaoComHashes({
            noticias: 'h1',
            futebol: 'f1',
            catalogo: 'c1',
            status: 's1',
          }),
        },
        {
          corpo: versaoComHashes({
            noticias: 'h2',
            futebol: 'f1',
            catalogo: 'c1',
            status: 's1',
          }),
        },
      ],
      [URL_NOTICIAS]: [{ corpo: { itens: [{ id: '1', titulo: 'Gol' }] } }, { ok: false }],
    });
    const cliente = new ClienteSnapshot({ buscar });

    await cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias);
    await cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias);

    const estado = cliente.obterEstado(URL_NOTICIAS);
    expect(estado.dados).toEqual({ itens: [{ id: '1', titulo: 'Gol' }] }); // preservado
    expect(estado.erro).not.toBeNull();
    vi.restoreAllMocks();
  });

  it('notifica assinantes só quando o estado de fato muda', async () => {
    const { buscar } = criarBuscarFake({
      [URL_VERSAO]: [
        {
          corpo: versaoComHashes({
            noticias: 'h1',
            futebol: 'f1',
            catalogo: 'c1',
            status: 's1',
          }),
        },
      ],
      [URL_NOTICIAS]: [{ corpo: { itens: [] } }],
    });
    const cliente = new ClienteSnapshot({ buscar });
    const ouvinte = vi.fn();
    const cancelar = cliente.assinar(URL_NOTICIAS, ouvinte);

    await cliente.garantir(URL_NOTICIAS, 'noticias', esquemaNoticias);

    expect(ouvinte).toHaveBeenCalledTimes(1);
    cancelar();
  });
});
