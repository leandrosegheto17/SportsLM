// @vitest-environment jsdom
// app/rotas/paginas/Home/SecaoSeusEsportes.test.tsx — UI-T02-02 (TASK.md Lote 8)
//
// Cobre CA-05.1 (10 mais recentes dos favoritos), CA-05.2 (filtro por chip
// sem reload), CA-05.3 (favoritos sem notícia), CA-05.4 (zero favoritos) e
// CA-04.7 ("geral" nunca aparece nesta seção).

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ClienteSnapshot } from '../../../dados/clienteSnapshot';
import { URL_VERSAO } from '../../../dados/versao';
import { SecaoSeusEsportes } from './SecaoSeusEsportes';
import type { ItemNoticia } from '../../../../dominio/tipos/noticias';

const URL_NOTICIAS = '/dados/noticias.json';

function item(sobrescritas: Partial<ItemNoticia>): ItemNoticia {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`.padEnd(20, '0'),
    fonteId: 'ge',
    feedId: 'ge-futebol',
    titulo: 'Título de exemplo',
    resumo: null,
    link: 'https://exemplo.com/materia',
    publicadoEm: '2026-09-05T09:00:00-03:00',
    dataEstimada: false,
    esporte: 'futebol',
    origemClassificacao: 'feed-fixado',
    grupoId: null,
    ingeridoEm: '2026-09-05T09:05:00-03:00',
    ...sobrescritas,
  };
}

function versao(hash = 'h1') {
  return {
    geradoEm: '2026-09-05T10:00:00-03:00',
    hashes: { noticias: hash, futebol: 'f1', catalogo: 'c1', status: 's1' },
  };
}

function criarClienteComItens(itens: ItemNoticia[]): ClienteSnapshot {
  const buscar = vi.fn(async (url: RequestInfo | URL) => {
    const chave = String(url);
    if (chave === URL_VERSAO) {
      return { ok: true, status: 200, json: async () => versao() } as Response;
    }
    if (chave === URL_NOTICIAS) {
      return { ok: true, status: 200, json: async () => itens } as Response;
    }
    throw new Error(`URL inesperada: ${chave}`);
  });
  return new ClienteSnapshot({ buscar });
}

function criarClienteComFalha(): ClienteSnapshot {
  const buscar = vi.fn(async (url: RequestInfo | URL) => {
    const chave = String(url);
    if (chave === URL_VERSAO) {
      return { ok: true, status: 200, json: async () => versao() } as Response;
    }
    if (chave === URL_NOTICIAS) {
      return { ok: false, status: 500, json: async () => ({}) } as Response;
    }
    throw new Error(`URL inesperada: ${chave}`);
  });
  return new ClienteSnapshot({ buscar });
}

async function esvaziarMicrotarefas(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

const AGORA = new Date('2026-09-05T10:00:00-03:00');
const NOMES_ESPORTES = {
  futebol: 'Futebol',
  'volei-quadra': 'Vôlei',
  basquete: 'Basquete',
} as const;

describe('SecaoSeusEsportes (UI-T02-02)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('CA-05.4: zero favoritos exibe o convite canônico com atalho', () => {
    const aoEscolherEsportes = vi.fn();
    const cliente = criarClienteComItens([]);

    render(
      <MemoryRouter>
        <SecaoSeusEsportes
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          aoEscolherEsportes={aoEscolherEsportes}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        'Escolha até 3 esportes favoritos para ver o que mais te interessa aqui.',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Escolher esportes' }));
    expect(aoEscolherEsportes).toHaveBeenCalledTimes(1);
  });

  it('mostra esqueleto enquanto carrega, antes da primeira resposta', () => {
    const cliente = criarClienteComItens([item({ esporte: 'futebol' })]);

    render(
      <MemoryRouter>
        <SecaoSeusEsportes
          favoritos={['futebol', 'volei-quadra']}
          nomesEsportes={NOMES_ESPORTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Carregando' })).toBeTruthy();
  });

  it('CA-05.1/CA-04.7: exibe só itens dos favoritos, nunca "geral", até 10, mais recentes primeiro', async () => {
    const itens = [
      item({ id: 'geral-1'.padEnd(20, '0'), esporte: 'geral', titulo: 'Item geral' }),
      item({
        id: 'basquete-1'.padEnd(20, '0'),
        esporte: 'basquete',
        titulo: 'Item de basquete (não favorito)',
      }),
      item({
        id: 'futebol-velho'.padEnd(20, '0'),
        esporte: 'futebol',
        titulo: 'Notícia antiga de futebol',
        publicadoEm: '2026-09-01T09:00:00-03:00',
      }),
      item({
        id: 'futebol-novo'.padEnd(20, '0'),
        esporte: 'futebol',
        titulo: 'Notícia recente de futebol',
        publicadoEm: '2026-09-05T08:00:00-03:00',
      }),
      item({
        id: 'volei-1'.padEnd(20, '0'),
        esporte: 'volei-quadra',
        titulo: 'Notícia de vôlei',
        publicadoEm: '2026-09-05T07:00:00-03:00',
      }),
    ];
    const cliente = criarClienteComItens(itens);

    render(
      <MemoryRouter>
        <SecaoSeusEsportes
          favoritos={['futebol', 'volei-quadra']}
          nomesEsportes={NOMES_ESPORTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.queryByText('Item geral')).toBeNull();
    expect(screen.queryByText('Item de basquete (não favorito)')).toBeNull();

    const lista = screen.getByRole('list');
    const titulos = within(lista)
      .getAllByRole('link')
      .map((link) => link.textContent ?? '');

    // Mais recente primeiro (Notícia recente > vôlei > antiga).
    expect(titulos[0]).toContain('Notícia recente de futebol');
    expect(titulos[1]).toContain('Notícia de vôlei');
    expect(titulos[2]).toContain('Notícia antiga de futebol');
    expect(titulos).toHaveLength(3);
  });

  it('CA-05.1: nunca exibe mais de 10 itens', async () => {
    const itens = Array.from({ length: 15 }, (_valor, indice) =>
      item({
        id: `futebol-${String(indice)}`.padEnd(20, '0'),
        esporte: 'futebol',
        titulo: `Notícia ${String(indice)}`,
        publicadoEm: new Date(AGORA.getTime() - indice * 60_000).toISOString(),
      }),
    );
    const cliente = criarClienteComItens(itens);

    render(
      <MemoryRouter>
        <SecaoSeusEsportes
          favoritos={['futebol']}
          nomesEsportes={NOMES_ESPORTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    const lista = screen.getByRole('list');
    expect(within(lista).getAllByRole('link')).toHaveLength(10);
  });

  it('exclui itens de fontes bloqueadas', async () => {
    const itens = [
      item({
        id: 'bloqueado-1'.padEnd(20, '0'),
        esporte: 'futebol',
        fonteId: 'uol-esporte',
        titulo: 'Notícia bloqueada',
      }),
      item({
        id: 'liberado-1'.padEnd(20, '0'),
        esporte: 'futebol',
        fonteId: 'ge',
        titulo: 'Notícia liberada',
      }),
    ];
    const cliente = criarClienteComItens(itens);

    render(
      <MemoryRouter>
        <SecaoSeusEsportes
          favoritos={['futebol']}
          nomesEsportes={NOMES_ESPORTES}
          fontesBloqueadas={['uol-esporte']}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.queryByText('Notícia bloqueada')).toBeNull();
    expect(screen.getByText('Notícia liberada')).toBeTruthy();
  });

  it('CA-05.2: filtro por chip funciona sem reload (estado em memória)', async () => {
    const itens = [
      item({
        id: 'futebol-1'.padEnd(20, '0'),
        esporte: 'futebol',
        titulo: 'Notícia de futebol',
      }),
      item({
        id: 'volei-1'.padEnd(20, '0'),
        esporte: 'volei-quadra',
        titulo: 'Notícia de vôlei',
      }),
    ];
    const cliente = criarClienteComItens(itens);

    render(
      <MemoryRouter>
        <SecaoSeusEsportes
          favoritos={['futebol', 'volei-quadra']}
          nomesEsportes={NOMES_ESPORTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText('Notícia de futebol')).toBeTruthy();
    expect(screen.getByText('Notícia de vôlei')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Vôlei' }));

    expect(screen.queryByText('Notícia de futebol')).toBeNull();
    expect(screen.getByText('Notícia de vôlei')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));

    expect(screen.getByText('Notícia de futebol')).toBeTruthy();
    expect(screen.getByText('Notícia de vôlei')).toBeTruthy();
  });

  it('não mostra chips de filtro com um único favorito', async () => {
    const cliente = criarClienteComItens([item({ esporte: 'futebol' })]);

    render(
      <MemoryRouter>
        <SecaoSeusEsportes
          favoritos={['futebol']}
          nomesEsportes={NOMES_ESPORTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(
      screen.queryByRole('group', { name: 'Filtrar por esporte favorito' }),
    ).toBeNull();
  });

  it('CA-05.3: favoritos sem notícia exibe o texto canônico com a lista de favoritos', async () => {
    const cliente = criarClienteComItens([item({ esporte: 'basquete' })]);

    render(
      <MemoryRouter>
        <SecaoSeusEsportes
          favoritos={['futebol', 'volei-quadra']}
          nomesEsportes={NOMES_ESPORTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(
      screen.getByText(/Sem notícias recentes de Futebol e Vôlei — atualizado/),
    ).toBeTruthy();
  });

  it('CA-05.5: item de esporte fora do futebol não exibe tabela, calendário ou resultado — só a notícia', async () => {
    const cliente = criarClienteComItens([
      item({
        id: 'volei-1'.padEnd(20, '0'),
        esporte: 'volei-quadra',
        titulo: 'Notícia de vôlei',
      }),
    ]);

    render(
      <MemoryRouter>
        <SecaoSeusEsportes
          favoritos={['volei-quadra']}
          nomesEsportes={NOMES_ESPORTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText('Notícia de vôlei')).toBeTruthy();
    // Nenhum elemento de tabela/calendário/placar — só o item de notícia.
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText(/tabela|classificação|calendário|placar/i)).toBeNull();
  });

  it('exibe erro com atalho de nova tentativa quando a busca falha sem dado anterior', async () => {
    const cliente = criarClienteComFalha();

    render(
      <MemoryRouter>
        <SecaoSeusEsportes
          favoritos={['futebol']}
          nomesEsportes={NOMES_ESPORTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(
      screen.getByText(
        'Não conseguimos carregar as notícias agora. Verifique sua conexão.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  });
});
