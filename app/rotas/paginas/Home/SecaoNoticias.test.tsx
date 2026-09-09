// @vitest-environment jsdom
// app/rotas/paginas/Home/SecaoNoticias.test.tsx — otimização mobile da Home (2026-09-09)
//
// Sucessora de SecaoSeusEsportes.test.tsx (UI-T02-02) + SecaoUltimasNoticias.test.tsx
// (UI-T02-03), removidos junto da fusão das duas seções (ver nota de topo de
// SecaoNoticias.tsx). Cobre CA-04.1/04.4/04.5/04.6 (feed geral), CA-19.1/19.2/19.4
// (dedup), CA-01.3/ADR-013 (GE indisponível), CA-02.4 (todas as fontes bloqueadas),
// CA-05.2/05.3 (revistas: filtro por chip sobre o feed único) e o novo comportamento
// não bloqueante de CA-05.4 (zero favoritos não esconde mais o feed geral).

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ClienteSnapshot } from '../../../dados/clienteSnapshot';
import { URL_VERSAO } from '../../../dados/versao';
import { SecaoNoticias } from './SecaoNoticias';
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
  basquete: 'Basquete',
  geral: 'Geral',
} as const;
const NOMES_FONTES = {
  ge: 'ge',
  'espn-brasil': 'ESPN Brasil',
  'gazeta-esportiva': 'Gazeta Esportiva',
  'uol-esporte': 'UOL Esporte',
} as const;

describe('SecaoNoticias', () => {
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
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
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
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          fontesBloqueadas={['uol-esporte']}
          aoEscolherEsportes={vi.fn()}
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

  it('CA-04.1/CA-19.4: mostra no máximo 30 itens em "Todos", com grupo contando como 1', async () => {
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
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
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
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
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
        fonteId: 'uol-esporte',
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
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          fontesBloqueadas={['uol-esporte']}
          aoEscolherEsportes={vi.fn()}
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
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText('horário estimado')).toBeTruthy();
  });

  it('CA-04.4: zero itens no feed inteiro exibe o texto canônico de vazio', async () => {
    const cliente = criarCliente({ itens: [] });

    render(
      <MemoryRouter>
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
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
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
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

  it('CA-04.5: fonte não bloqueada instável mostra o banner "1 fonte instável"', async () => {
    const cliente = criarCliente({
      itens: [item({ id: 'a'.padEnd(20, '0'), fonteId: 'uol-esporte' })],
      status: {
        'uol-esporte': { instavel: true, instavelDesde: '2026-09-04T00:00:00-03:00' },
      },
    });

    render(
      <MemoryRouter>
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText('1 fonte instável: UOL Esporte')).toBeTruthy();
  });

  it('ADR-013/CA-01.3: GE instável mostra o banner canônico de GE indisponível', async () => {
    const cliente = criarCliente({
      itens: [item({ id: 'a'.padEnd(20, '0'), fonteId: 'espn-brasil' })],
      status: { ge: { instavel: true, instavelDesde: '2026-09-04T00:00:00-03:00' } },
    });

    render(
      <MemoryRouter>
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
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
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          fontesBloqueadas={[
            'espn-brasil',
            'gazeta-esportiva',
            'terra-esportes',
            'uol-esporte',
          ]}
          totalFontesBloqueaveis={4}
          aoEscolherEsportes={vi.fn()}
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

  it('CA-05.4 (revista): zero favoritos NÃO bloqueia o feed geral, só convida a escolher', async () => {
    const aoEscolherEsportes = vi.fn();
    const cliente = criarCliente({
      itens: [item({ id: 'geral-1'.padEnd(20, '0'), titulo: 'Notícia geral qualquer' })],
    });

    render(
      <MemoryRouter>
        <SecaoNoticias
          favoritos={[]}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={aoEscolherEsportes}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText('Notícia geral qualquer')).toBeTruthy();
    expect(
      screen.getByText('Escolha até 3 esportes favoritos para filtrar as notícias aqui.'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('group', { name: 'Filtrar notícias por esporte favorito' }),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Escolher esportes' }));
    expect(aoEscolherEsportes).toHaveBeenCalledTimes(1);
  });

  it('mostra os chips de filtro mesmo com um único favorito (comportamento novo, ver nota de topo)', async () => {
    const cliente = criarCliente({ itens: [item({ id: 'a'.padEnd(20, '0') })] });

    render(
      <MemoryRouter>
        <SecaoNoticias
          favoritos={['futebol']}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(
      screen.getByRole('group', { name: 'Filtrar notícias por esporte favorito' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Todos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Futebol' })).toBeTruthy();
  });

  it('CA-05.2 (revista): filtro por chip funciona sem reload sobre o feed único, "geral" só em "Todos"', async () => {
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
      item({ id: 'geral-1'.padEnd(20, '0'), esporte: 'geral', titulo: 'Notícia geral' }),
    ];
    const cliente = criarCliente({ itens });

    render(
      <MemoryRouter>
        <SecaoNoticias
          favoritos={['futebol', 'volei-quadra']}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.getByText('Notícia de futebol')).toBeTruthy();
    expect(screen.getByText('Notícia de vôlei')).toBeTruthy();
    expect(screen.getByText('Notícia geral')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Vôlei' }));

    expect(screen.queryByText('Notícia de futebol')).toBeNull();
    expect(screen.queryByText('Notícia geral')).toBeNull();
    expect(screen.getByText('Notícia de vôlei')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));

    expect(screen.getByText('Notícia de futebol')).toBeTruthy();
    expect(screen.getByText('Notícia de vôlei')).toBeTruthy();
    expect(screen.getByText('Notícia geral')).toBeTruthy();
  });

  it('filtro por esporte não perde itens por causa do corte de 30 de "Todos" (filtra antes de cortar)', async () => {
    const itens: ItemNoticia[] = [];
    for (let i = 0; i < 32; i += 1) {
      itens.push(
        item({
          id: `basquete-${String(i)}`.padEnd(20, '0'),
          esporte: 'basquete',
          titulo: `Notícia de basquete ${String(i)}`,
          publicadoEm: new Date(AGORA.getTime() - i * 60_000).toISOString(),
        }),
      );
    }
    // O item de futebol favorito é o mais antigo de todos — cairia fora dos
    // 30 mais recentes do feed geral, mas não deveria sumir ao filtrar por
    // "Futebol" (o filtro corre sobre o feed completo, não sobre os 30 já
    // cortados de "Todos").
    itens.push(
      item({
        id: 'futebol-antigo'.padEnd(20, '0'),
        esporte: 'futebol',
        titulo: 'Notícia de futebol mais antiga',
        publicadoEm: new Date(AGORA.getTime() - 60 * 60_000).toISOString(),
      }),
    );
    const cliente = criarCliente({ itens });

    render(
      <MemoryRouter>
        <SecaoNoticias
          favoritos={['futebol']}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    expect(screen.queryByText('Notícia de futebol mais antiga')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));

    expect(screen.getByText('Notícia de futebol mais antiga')).toBeTruthy();
  });

  it('CA-05.3 (revista): sem itens no escopo do chip selecionado exibe o texto canônico', async () => {
    const cliente = criarCliente({
      itens: [item({ id: 'a'.padEnd(20, '0'), esporte: 'basquete' })],
    });

    render(
      <MemoryRouter>
        <SecaoNoticias
          favoritos={['futebol']}
          nomesEsportes={NOMES_ESPORTES}
          nomesFontes={NOMES_FONTES}
          aoEscolherEsportes={vi.fn()}
          agora={AGORA}
          cliente={cliente}
        />
      </MemoryRouter>,
    );

    await esvaziarMicrotarefas();

    fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));

    expect(
      screen.getByText(/Sem notícias recentes de Futebol — atualizado/),
    ).toBeTruthy();
  });

  describe('chip "Meu time" (busca de texto)', () => {
    it('aparece só quando `nomeTime` é definido', async () => {
      const cliente = criarCliente({ itens: [item({ id: 'a'.padEnd(20, '0') })] });

      const { rerender } = render(
        <MemoryRouter>
          <SecaoNoticias
            favoritos={[]}
            nomesEsportes={NOMES_ESPORTES}
            nomesFontes={NOMES_FONTES}
            aoEscolherEsportes={vi.fn()}
            agora={AGORA}
            cliente={cliente}
          />
        </MemoryRouter>,
      );
      await esvaziarMicrotarefas();
      expect(screen.queryByRole('button', { name: 'Meu time' })).toBeNull();

      rerender(
        <MemoryRouter>
          <SecaoNoticias
            favoritos={[]}
            nomesEsportes={NOMES_ESPORTES}
            nomesFontes={NOMES_FONTES}
            aoEscolherEsportes={vi.fn()}
            agora={AGORA}
            cliente={cliente}
            nomeTime="Flamengo"
          />
        </MemoryRouter>,
      );
      expect(screen.getByRole('button', { name: 'Meu time' })).toBeTruthy();
    });

    it('filtra por título/resumo mencionando o time, tolerante a acento e caixa', async () => {
      const itens = [
        item({
          id: 'flamengo-1'.padEnd(20, '0'),
          titulo: 'FLAMENGO vence clássico no fim do jogo',
        }),
        item({
          id: 'flamengo-2'.padEnd(20, '0'),
          titulo: 'Técnico do rubro-negro projeta próxima rodada',
          resumo: 'Comentário sobre o flamengo antes do jogo decisivo.',
        }),
        item({
          id: 'outro-1'.padEnd(20, '0'),
          titulo: 'Corinthians anuncia reforço para a próxima temporada',
        }),
      ];
      const cliente = criarCliente({ itens });

      render(
        <MemoryRouter>
          <SecaoNoticias
            favoritos={[]}
            nomesEsportes={NOMES_ESPORTES}
            nomesFontes={NOMES_FONTES}
            aoEscolherEsportes={vi.fn()}
            agora={AGORA}
            cliente={cliente}
            nomeTime="Flamengo"
          />
        </MemoryRouter>,
      );

      await esvaziarMicrotarefas();

      fireEvent.click(screen.getByRole('button', { name: 'Meu time' }));

      expect(screen.getByText('FLAMENGO vence clássico no fim do jogo')).toBeTruthy();
      expect(
        screen.getByText('Técnico do rubro-negro projeta próxima rodada'),
      ).toBeTruthy();
      expect(
        screen.queryByText('Corinthians anuncia reforço para a próxima temporada'),
      ).toBeNull();
    });

    it('estado vazio da aba "Meu time" cita o nome do time, não "seu time" genérico', async () => {
      const cliente = criarCliente({
        itens: [item({ id: 'a'.padEnd(20, '0'), titulo: 'Corinthians anuncia reforço' })],
      });

      render(
        <MemoryRouter>
          <SecaoNoticias
            favoritos={[]}
            nomesEsportes={NOMES_ESPORTES}
            nomesFontes={NOMES_FONTES}
            aoEscolherEsportes={vi.fn()}
            agora={AGORA}
            cliente={cliente}
            nomeTime="Flamengo"
          />
        </MemoryRouter>,
      );

      await esvaziarMicrotarefas();

      fireEvent.click(screen.getByRole('button', { name: 'Meu time' }));

      expect(screen.getByText(/Sem notícias recentes de Flamengo/)).toBeTruthy();
    });
  });
});
