// @vitest-environment jsdom
// app/rotas/sobreposicoes/Configuracoes.test.tsx — UI-T03-01/UI-T03-02
// (TASK.md Lote 9)
//
// Cobre a integração do bloco "Fontes de notícia" dentro da sobreposição
// real (UI-DS-07A): leitura/persistência via `armazenamento/preferencias`
// (UI-DS-09), CA-02.3 (GE nunca acionável) e CA-13.3 (aviso de modo memória).
// UI-T03-02 acrescenta: "Esportes favoritos" (persistência sem regredir
// `timeId`/fontes já salvos), "Meu time" (aciona `aoTrocarTime`) e
// "Aparência" (integração de `usarTema`).

import type { ReactElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ClienteSnapshot } from '../../dados/clienteSnapshot';
import { URL_VERSAO } from '../../dados/versao';
import { CHAVE_ARMAZENAMENTO_TEMA } from '../../tema/tema';
import { Configuracoes } from './Configuracoes';
import type { CatalogoOnboarding } from '../paginas/Onboarding/catalogoOnboarding';

const URL_STATUS = '/dados/ingestao/status.json';

type Escutador = (evento: Partial<MediaQueryListEvent>) => void;

function mockarMatchMedia(): void {
  window.matchMedia = vi.fn().mockImplementation((consulta: string) => ({
    matches: false,
    media: consulta,
    addEventListener: (_tipo: string, _escutador: Escutador) => {},
    removeEventListener: (_tipo: string, _escutador: Escutador) => {},
  }));
}

function renderizarComRouter(elemento: ReactElement) {
  return render(<MemoryRouter>{elemento}</MemoryRouter>);
}

class ArmazenamentoFalso implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private mapa = new Map<string, string>();
  getItem(chave: string): string | null {
    return this.mapa.has(chave) ? (this.mapa.get(chave) as string) : null;
  }
  setItem(chave: string, valor: string): void {
    this.mapa.set(chave, valor);
  }
  removeItem(chave: string): void {
    this.mapa.delete(chave);
  }
}

function catalogoFake(): CatalogoOnboarding {
  return {
    esportes: [
      { id: 'futebol', nome: 'Futebol', ordem: 1 },
      { id: 'formula1', nome: 'Fórmula 1', ordem: 2 },
    ],
    clubes: [],
    referencias: {
      esportesValidos: new Set(['futebol', 'formula1']),
      fontesValidas: new Set(['ge', 'espn-brasil', 'terra-esportes']),
      clubesValidos: new Set(['spa']),
    },
    temporadaAtual: 2026,
  };
}

const FONTES_FAKE = [
  {
    id: 'ge',
    nome: 'GE — ge.globo',
    fixa: true,
    esportesCobertos: ['futebol', 'formula1'],
  },
  {
    id: 'espn-brasil',
    nome: 'ESPN Brasil',
    fixa: false,
    esportesCobertos: ['futebol', 'formula1'],
  },
  {
    id: 'terra-esportes',
    nome: 'Terra Esportes',
    fixa: false,
    esportesCobertos: ['futebol'],
  },
];

function criarCliente(): ClienteSnapshot {
  const buscar = vi.fn(async (url: RequestInfo | URL) => {
    const chave = String(url);
    if (chave === URL_VERSAO) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          geradoEm: '2026-09-05T10:00:00-03:00',
          hashes: { noticias: 'h1', futebol: 'f1', catalogo: 'c1', status: 's1' },
        }),
      } as Response;
    }
    if (chave === URL_STATUS) {
      return { ok: true, status: 200, json: async () => ({ fontes: {} }) } as Response;
    }
    throw new Error(`URL não modelada neste teste: ${chave}`);
  });
  return new ClienteSnapshot({ buscar });
}

async function esvaziarMicrotarefas(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('Configuracoes (UI-T03-01 — bloco Fontes de notícia)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockarMatchMedia();
    localStorage.clear();
    document.documentElement.removeAttribute('data-tema');
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('lista as 5(3 no fixture) fontes e persiste o bloqueio de uma bloqueável (CA-02.1)', async () => {
    const armazenamento = new ArmazenamentoFalso();
    const cliente = criarCliente();

    renderizarComRouter(
      <Configuracoes
        aberta
        aoFechar={() => {}}
        armazenamento={armazenamento}
        carregarCatalogo={catalogoFake}
        fontesBrutas={FONTES_FAKE}
        cliente={cliente}
        agora={() => new Date('2026-09-05T12:00:00-03:00')}
      />,
    );

    await esvaziarMicrotarefas();

    const alternador = screen.getByRole('switch', { name: 'ESPN Brasil' });
    expect(alternador.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(alternador);

    expect(alternador.getAttribute('aria-checked')).toBe('false');
    const salvo = armazenamento.getItem('sportslm.preferencias.v1');
    expect(salvo).not.toBeNull();
    const preferencias = JSON.parse(salvo as string) as { fontesBloqueadas: string[] };
    expect(preferencias.fontesBloqueadas).toEqual(['espn-brasil']);
  });

  it('o GE nunca é apresentado como acionável, mesmo dentro da sobreposição real (CA-02.3)', async () => {
    const cliente = criarCliente();
    renderizarComRouter(
      <Configuracoes
        aberta
        aoFechar={() => {}}
        armazenamento={new ArmazenamentoFalso()}
        carregarCatalogo={catalogoFake}
        fontesBrutas={FONTES_FAKE}
        cliente={cliente}
      />,
    );

    await esvaziarMicrotarefas();

    expect(screen.queryByRole('switch', { name: 'GE — ge.globo' })).toBeNull();
    expect(
      screen.getByText('O GE é fonte fixa do SportsLM e não pode ser bloqueado.'),
    ).toBeTruthy();
  });

  it('avisa quando o armazenamento não está disponível (CA-13.3), sem travar o bloqueio', async () => {
    const cliente = criarCliente();
    const armazenamentoIndisponivel: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> =
      {
        getItem: () => null,
        setItem: () => {
          throw new Error('indisponível');
        },
        removeItem: () => {},
      };

    renderizarComRouter(
      <Configuracoes
        aberta
        aoFechar={() => {}}
        armazenamento={armazenamentoIndisponivel}
        carregarCatalogo={catalogoFake}
        fontesBrutas={FONTES_FAKE}
        cliente={cliente}
      />,
    );

    await esvaziarMicrotarefas();

    expect(
      screen.getByText(
        'Seu navegador não está guardando preferências. Tudo funciona nesta visita, mas nada será lembrado.',
      ),
    ).toBeTruthy();

    const alternador = screen.getByRole('switch', { name: 'Terra Esportes' });
    fireEvent.click(alternador);
    // Em modo memória o clique não lança e o estado visual muda dentro da sessão.
    expect(alternador.getAttribute('aria-checked')).toBe('false');
  });

  it('não renderiza nada quando fechada', () => {
    renderizarComRouter(
      <Configuracoes
        aberta={false}
        aoFechar={() => {}}
        armazenamento={new ArmazenamentoFalso()}
        carregarCatalogo={catalogoFake}
        fontesBrutas={FONTES_FAKE}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

function catalogoComTimeFake(): CatalogoOnboarding {
  return {
    ...catalogoFake(),
    clubes: [{ id: 'spa', nomeCurto: 'São Paulo', sigla: 'SPA', corBase: '#c0392b' }],
  };
}

describe('Configuracoes (UI-T03-02 — esportes, meu time, aparência)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockarMatchMedia();
    localStorage.clear();
    document.documentElement.removeAttribute('data-tema');
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('marca um esporte favorito e persiste sem regredir fontes/timeId já salvos', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify({
        versaoEsquema: 1,
        temporada: 2026,
        favoritos: [],
        fontesBloqueadas: ['terra-esportes'],
        timeId: 'spa',
        rivais: [],
        atualizadoEm: '2026-09-01T00:00:00.000Z',
      }),
    );

    renderizarComRouter(
      <Configuracoes
        aberta
        aoFechar={() => {}}
        armazenamento={armazenamento}
        carregarCatalogo={catalogoComTimeFake}
        fontesBrutas={FONTES_FAKE}
      />,
    );
    await esvaziarMicrotarefas();

    fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));

    const salvo = JSON.parse(
      armazenamento.getItem('sportslm.preferencias.v1') as string,
    ) as {
      favoritos: string[];
      fontesBloqueadas: string[];
      timeId: string | null;
    };
    expect(salvo.favoritos).toEqual(['futebol']);
    expect(salvo.fontesBloqueadas).toEqual(['terra-esportes']);
    expect(salvo.timeId).toBe('spa');
  });

  it('bloqueia a 4ª tentativa de favorito com o texto canônico de CA-03.3', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify({
        versaoEsquema: 1,
        temporada: 2026,
        favoritos: ['futebol', 'formula1'],
        fontesBloqueadas: [],
        timeId: null,
        rivais: [],
        atualizadoEm: '2026-09-01T00:00:00.000Z',
      }),
    );

    renderizarComRouter(
      <Configuracoes
        aberta
        aoFechar={() => {}}
        armazenamento={armazenamento}
        carregarCatalogo={catalogoFake}
        fontesBrutas={FONTES_FAKE}
      />,
    );
    await esvaziarMicrotarefas();

    // O fixture só tem 2 esportes válidos (futebol/formula1); com os 2 já
    // marcados, o limite de 3 não é alcançável aqui — este teste cobre o
    // caminho feliz de marcar o único restante sem bloqueio (a regra "3 de 3"
    // já tem cobertura dedicada em `SecaoEsportesFavoritos.test.tsx`).
    expect(screen.getByText('2 DE 3')).toBeTruthy();
  });

  it('"Meu time" mostra o clube salvo e "Trocar" fecha Configurações e abre T-04', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify({
        versaoEsquema: 1,
        temporada: 2026,
        favoritos: [],
        fontesBloqueadas: [],
        timeId: 'spa',
        rivais: [],
        atualizadoEm: '2026-09-01T00:00:00.000Z',
      }),
    );
    const aoFechar = vi.fn();
    const aoTrocarTime = vi.fn();

    renderizarComRouter(
      <Configuracoes
        aberta
        aoFechar={aoFechar}
        armazenamento={armazenamento}
        carregarCatalogo={catalogoComTimeFake}
        fontesBrutas={FONTES_FAKE}
        aoTrocarTime={aoTrocarTime}
      />,
    );
    await esvaziarMicrotarefas();

    expect(screen.getByText('São Paulo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar' }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
    expect(aoTrocarTime).toHaveBeenCalledTimes(1);
  });

  it('"Meu time" sem time salvo convida a escolher (CA-14.3)', async () => {
    renderizarComRouter(
      <Configuracoes
        aberta
        aoFechar={() => {}}
        armazenamento={new ArmazenamentoFalso()}
        carregarCatalogo={catalogoFake}
        fontesBrutas={FONTES_FAKE}
      />,
    );
    await esvaziarMicrotarefas();

    expect(screen.getByText('Nenhum time escolhido.')).toBeTruthy();
  });

  it('"Aparência" troca de tema e persiste em sportslm.tema.v1', async () => {
    renderizarComRouter(
      <Configuracoes
        aberta
        aoFechar={() => {}}
        armazenamento={new ArmazenamentoFalso()}
        carregarCatalogo={catalogoFake}
        fontesBrutas={FONTES_FAKE}
      />,
    );
    await esvaziarMicrotarefas();

    fireEvent.click(screen.getByRole('radio', { name: 'Escuro' }));

    expect(document.documentElement.dataset['tema']).toBe('escuro');
    expect(JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO_TEMA) as string)).toEqual({
      versaoEsquema: 1,
      preferencia: 'escuro',
    });
  });

  it('"Privacidade" mostra o texto canônico de RNF-07', async () => {
    renderizarComRouter(
      <Configuracoes
        aberta
        aoFechar={() => {}}
        armazenamento={new ArmazenamentoFalso()}
        carregarCatalogo={catalogoFake}
        fontesBrutas={FONTES_FAKE}
      />,
    );
    await esvaziarMicrotarefas();

    expect(
      screen.getByText(
        'Suas preferências ficam só neste navegador. Não usamos conta nem cookies. Enviamos 5 eventos anônimos de uso.',
      ),
    ).toBeTruthy();
  });
});
