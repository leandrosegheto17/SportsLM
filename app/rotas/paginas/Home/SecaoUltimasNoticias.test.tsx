// @vitest-environment jsdom
// app/rotas/paginas/Home/SecaoUltimasNoticias.test.tsx — UI-T02-03 (TASK.md Lote 8)
//
// Cobre CA-04.1 (30 mais recentes), CA-04.4 (vazio/erro), CA-04.5 (fonte
// instável), CA-04.6 (horário estimado), CA-01.3/ADR-013 (GE indisponível) e
// CA-19.1 a CA-19.4 (dedup/"TAMBÉM EM").

import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ClienteSnapshot } from '../../../dados/clienteSnapshot';
import { URL_VERSAO } from '../../../dados/versao';
import { SecaoUltimasNoticias } from './SecaoUltimasNoticias';
import type { ItemNoticia } from '../../../../dominio/tipos/noticias';

const URL_NOTICIAS = '/dados/noticias.json';
const URL_STATUS = '/dados/ingestao/status.json';

function item(sobrescritas: Partial<ItemNoticia> & Pick<ItemNoticia, 'id'>): ItemNoticia {
  return {
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

function versao(hash = 'h1', statusHash = 's1') {
  return {
    geradoEm: '2026-09-05T10:00:00-03:00',
    hashes: { noticias: hash, futebol: 'f1', catalogo: 'c1', status: statusHash },
  };
}

interface StatusFonteFixture {
  instavel: boolean;
  instavelDesde: string | null;
}

function criarCliente(opcoes: {
  itens: ItemNoticia[];
  status?: Record<string, StatusFonteFixture>;
  falharNoticias?: boolean;
}): ClienteSnapshot {
  const buscar = vi.fn(async (url: RequestInfo | URL) => {
    const chave = String(url);
    if (chave === URL_VERSAO) {
      return { ok: true, status: 200, json: async () => versao() } as Response;
    }
    if (chave === URL_NOTICIAS) {
      if (opcoes.falharNoticias) {
        return { ok: false, status: 500, json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => opcoes.itens } as Response;
    }
    if (chave === URL_STATUS) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ fontes: opcoes.status ?? {} }),
      } as Response;
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
  geral: 'Geral',
} as const;
const NOMES_FONTES = {
  ge: 'ge',
  'espn-brasil': 'ESPN Brasil',
  'gazeta-esportiva': 'Gazeta Esportiva',
  'uol-esporte': 'UOL Esporte',
} as const;

describe('SecaoUltimasNoticias (UI-T02-03)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('mostra esqueleto enquanto carrega, antes da primeira resposta', () => {
    const cliente = criarCliente({ itens: [item({ id: 'a'.padEnd(20, '0') })] });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Carregando' })).toBeTruthy();
  });

  it('CA-04.1/RN-18: exibe os itens de fontes não bloqueadas, mais recente primeiro', async () => {
    const itens = [
      item({
        id: 'antiga'.padEnd(20, '0'),
        titulo: 'Notícia antiga',
        publicadoEm: '2026-09-05T08:00:00-03:00',
      }),
      item({
        id: 'recente'.padEnd(20, '0'),
        titulo: 'Notícia recente',
        publicadoEm: '2026-09-05T09:30:00-03:00',
      }),
      item({
        id: 'bloqueada'.padEnd(20, '0'),
        fonteId: 'uol-esporte',
        titulo: 'Notícia bloqueada',
      }),
    ];
    const cliente = criarCliente({ itens });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          fontesBloqueadas={['uol-esporte']}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.queryByText('Notícia bloqueada')).toBeNull();

    const lista = screen.getByRole('list');
    const titulos = within(lista)
      .getAllByRole('link')
      .map((link) => link.textContent ?? '');
    expect(titulos[0]).toContain('Notícia recente');
    expect(titulos[1]).toContain('Notícia antiga');
    expect(titulos).toHaveLength(2);
  });

  it('CA-04.1/CA-19.4: mostra no máximo 30 itens, com grupo contando como 1', async () => {
    const itens: ItemNoticia[] = [];
    for (let i = 0; i < 35; i += 1) {
      const grupoId = `grupo-${String(i)}`;
      const publicadoEm = new Date(AGORA.getTime() - i * 60_000).toISOString();
      itens.push(
        item({ id: `${grupoId}-a`.padEnd(20, '0'), fonteId: 'ge', grupoId, publicadoEm }),
        item({
          id: `${grupoId}-b`.padEnd(20, '0'),
          fonteId: 'espn-brasil',
          grupoId,
          publicadoEm,
        }),
      );
    }
    const cliente = criarCliente({ itens });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    const lista = screen.getByRole('list');
    expect(within(lista).getAllByRole('link')).toHaveLength(30);
  });

  it('CA-19.1: grupo deduplicado mostra "também em" com a contagem de outras fontes', async () => {
    const itens = [
      item({
        id: 'rep'.padEnd(20, '0'),
        fonteId: 'ge',
        grupoId: 'grupo-1',
        titulo: 'Palmeiras confirma lesão',
        publicadoEm: '2026-09-05T09:00:00-03:00',
      }),
      item({
        id: 'outra-1'.padEnd(20, '0'),
        fonteId: 'espn-brasil',
        grupoId: 'grupo-1',
        publicadoEm: '2026-09-05T09:10:00-03:00',
      }),
      item({
        id: 'outra-2'.padEnd(20, '0'),
        fonteId: 'gazeta-esportiva',
        grupoId: 'grupo-1',
        publicadoEm: '2026-09-05T09:20:00-03:00',
      }),
    ];
    const cliente = criarCliente({ itens });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText('Palmeiras confirma lesão')).toBeTruthy();
    expect(screen.getByText('também em: +2 fontes')).toBeTruthy();
  });

  it('CA-19.2: fonte do grupo bloqueada é omitida e promove a próxima mais antiga', async () => {
    const itens = [
      item({
        id: 'mais-antigo'.padEnd(20, '0'),
        fonteId: 'uol-esporte', // será bloqueada
        grupoId: 'grupo-1',
        titulo: 'Versão bloqueada',
        publicadoEm: '2026-09-05T08:00:00-03:00',
      }),
      item({
        id: 'promovido'.padEnd(20, '0'),
        fonteId: 'ge',
        grupoId: 'grupo-1',
        titulo: 'Versão promovida',
        publicadoEm: '2026-09-05T08:30:00-03:00',
      }),
    ];
    const cliente = criarCliente({ itens });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          fontesBloqueadas={['uol-esporte']}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText('Versão promovida')).toBeTruthy();
    expect(screen.queryByText('Versão bloqueada')).toBeNull();
  });

  it('CA-04.6: item com data estimada mostra o texto canônico "horário estimado"', async () => {
    const cliente = criarCliente({
      itens: [item({ id: 'estimado'.padEnd(20, '0'), dataEstimada: true })],
    });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText('horário estimado')).toBeTruthy();
  });

  it('CA-04.4: zero itens exibe o texto canônico de vazio', async () => {
    const cliente = criarCliente({ itens: [] });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText(/Ainda não há notícias — atualizado/)).toBeTruthy();
  });

  it('exibe erro com atalho de nova tentativa quando a busca falha sem dado anterior', async () => {
    const cliente = criarCliente({ itens: [], falharNoticias: true });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
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

  it('CA-04.5: fonte não bloqueada instável mostra o banner "1 fonte instável"', async () => {
    const cliente = criarCliente({
      itens: [item({ id: 'a'.padEnd(20, '0'), fonteId: 'uol-esporte' })],
      status: {
        'uol-esporte': { instavel: true, instavelDesde: '2026-09-04T00:00:00-03:00' },
      },
    });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText('1 fonte instável: UOL Esporte')).toBeTruthy();
  });

  it('não mostra o banner de fonte instável para uma fonte bloqueada', async () => {
    const cliente = criarCliente({
      itens: [item({ id: 'a'.padEnd(20, '0'), fonteId: 'ge' })],
      status: {
        'uol-esporte': { instavel: true, instavelDesde: '2026-09-04T00:00:00-03:00' },
      },
    });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          fontesBloqueadas={['uol-esporte']}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.queryByText(/fonte instável/)).toBeNull();
  });

  it('ADR-013/CA-01.3: GE instável mostra o banner canônico de GE indisponível', async () => {
    const cliente = criarCliente({
      itens: [item({ id: 'a'.padEnd(20, '0'), fonteId: 'espn-brasil' })],
      status: {
        ge: { instavel: true, instavelDesde: '2026-09-04T00:00:00-03:00' },
      },
    });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(
      screen.getByText(
        'O GE está indisponível no momento — as notícias abaixo vêm das outras fontes.',
      ),
    ).toBeTruthy();
  });

  it('CA-02.4: todas as fontes bloqueáveis bloqueadas mostra "Você bloqueou N fontes"', async () => {
    const cliente = criarCliente({
      itens: [item({ id: 'a'.padEnd(20, '0'), fonteId: 'ge' })],
    });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          fontesBloqueadas={[
            'espn-brasil',
            'gazeta-esportiva',
            'terra-esportes',
            'uol-esporte',
          ]}
          totalFontesBloqueaveis={4}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(
      screen.getByText('Você bloqueou 4 fontes. Estas notícias vêm do ge.'),
    ).toBeTruthy();
  });

  it('CA-02.4: não aciona sem `totalFontesBloqueaveis` (degradação segura)', async () => {
    const cliente = criarCliente({
      itens: [item({ id: 'a'.padEnd(20, '0'), fonteId: 'ge' })],
    });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          fontesBloqueadas={[
            'espn-brasil',
            'gazeta-esportiva',
            'terra-esportes',
            'uol-esporte',
          ]}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.queryByText(/Você bloqueou/)).toBeNull();
  });

  it('não mostra nenhum banner de instabilidade quando todas as fontes estão estáveis', async () => {
    const cliente = criarCliente({
      itens: [item({ id: 'a'.padEnd(20, '0') })],
      status: { ge: { instavel: false, instavelDesde: null } },
    });

    render(
      <MemoryRouter>
        <SecaoUltimasNoticias
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.queryByText(/indisponível/)).toBeNull();
    expect(screen.queryByText(/instável/)).toBeNull();
  });
});
