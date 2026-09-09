// @vitest-environment jsdom
// app/rotas/paginas/Home.test.tsx — UI-T02-04 (TASK.md Lote 8)
//
// Cobre a integração das seções da Home (identidade + feed único de
// notícias, ver otimização mobile de 2026-09-09 em `Home/SecaoNoticias.tsx`)
// numa única rota `/`, os pontos de integração de sobreposição (ESCOLHER MEU
// TIME → T-04, "Escolher esportes" → T-03) e o encadeamento de CA-02.4
// (totalFontesBloqueaveis, ver `SecaoNoticias.test.tsx` para os casos
// daquele componente isoladamente).

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProvedorSobreposicoes } from '../SobreposicoesContext';
import { Home } from './Home';
import { URL_VERSAO } from '../../dados/versao';
import { ClienteSnapshot } from '../../dados/clienteSnapshot';
import type { CatalogoOnboarding } from './Onboarding/catalogoOnboarding';
import type { ItemNoticia } from '../../../dominio/tipos/noticias';

const URL_NOTICIAS = '/dados/noticias.json';
const URL_STATUS = '/dados/ingestao/status.json';

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
      { id: 'volei-quadra', nome: 'Vôlei', ordem: 2 },
    ],
    clubes: [],
    referencias: {
      esportesValidos: new Set(['futebol', 'volei-quadra']),
      fontesValidas: new Set(['ge', 'fonte-a', 'fonte-b']),
      clubesValidos: new Set(['spa']),
    },
    temporadaAtual: 2026,
  };
}

const FONTES_FAKE = [
  { id: 'ge', nome: 'ge', fixa: true, esportesCobertos: ['futebol', 'volei-quadra'] },
  { id: 'fonte-a', nome: 'Fonte A', fixa: false, esportesCobertos: ['futebol'] },
  { id: 'fonte-b', nome: 'Fonte B', fixa: false, esportesCobertos: ['futebol'] },
];

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

function criarClienteSnapshot(itens: ItemNoticia[]): ClienteSnapshot {
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
    if (chave === URL_NOTICIAS) {
      return { ok: true, status: 200, json: async () => itens } as Response;
    }
    if (chave === URL_STATUS) {
      return { ok: true, status: 200, json: async () => ({ fontes: {} }) } as Response;
    }
    // Demais URLs (config/futebol de `SecaoIdentidade`, fora do escopo deste
    // teste de composição — coberto por `SecaoIdentidade.test.tsx`): falha
    // graciosa, capturada internamente por `ClienteSnapshot`/`useClubesPublicos`.
    throw new Error(`URL não modelada neste teste de composição: ${chave}`);
  });
  return new ClienteSnapshot({ buscar });
}

async function esvaziarMicrotarefas(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function renderizarHome(propriedades: Parameters<typeof Home>[0] = {}) {
  const armazenamento = propriedades.armazenamento ?? new ArmazenamentoFalso();
  return render(
    <MemoryRouter>
      {/* REFAT-09-01: mesmo armazenamento repassado a `Configuracoes`/
       * `EscolherTime` (via `ProvedorSobreposicoes`) — replica a realidade de
       * produção, onde as três sempre compartilham o mesmo
       * `globalThis.localStorage`, e permite ao teste abaixo verificar a
       * propagação reativa sem depender do `localStorage` real do jsdom. */}
      <ProvedorSobreposicoes
        armazenamento={armazenamento}
        carregarCatalogo={catalogoFake}
        fontesBrutas={FONTES_FAKE}
      >
        <Home
          armazenamento={armazenamento}
          carregarCatalogo={catalogoFake}
          fontesBrutas={FONTES_FAKE}
          opcoesClubesPublicos={{
            buscar: vi.fn(
              async () => ({ ok: true, json: async () => [] }) as unknown as Response,
            ),
          }}
          {...propriedades}
        />
      </ProvedorSobreposicoes>
    </MemoryRouter>,
  );
}

describe('Home (UI-T02-04 — integração de identidade + feed único de notícias)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('compõe as seções (identidade, feed único de notícias) numa única tela', async () => {
    const cliente = criarClienteSnapshot([]);
    renderizarHome({ clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    // CA-14.3 — sem time salvo (armazenamento vazio): convite único.
    expect(
      screen.getByText(
        'Escolha seu time para ver o painel com todos os campeonatos do ano.',
      ),
    ).toBeTruthy();
    // CA-05.4 (revista) — zero favoritos não bloqueia mais o feed, só convida.
    expect(screen.getByRole('heading', { name: 'Notícias' })).toBeTruthy();
    expect(
      screen.getByText('Escolha até 3 esportes favoritos para filtrar as notícias aqui.'),
    ).toBeTruthy();
  });

  it('"ESCOLHER MEU TIME" (dentro de SecaoIdentidade) abre a sobreposição T-04', async () => {
    const cliente = criarClienteSnapshot([]);
    renderizarHome({ clienteSnapshot: cliente });
    await esvaziarMicrotarefas();

    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'ESCOLHER MEU TIME' }));

    expect(screen.getByRole('dialog', { name: 'Escolher time' })).toBeTruthy();
  });

  it('"Escolher esportes" (CA-05.4) abre a sobreposição T-03 de Configurações', async () => {
    const cliente = criarClienteSnapshot([]);
    renderizarHome({ clienteSnapshot: cliente });
    await esvaziarMicrotarefas();

    fireEvent.click(screen.getByRole('button', { name: 'Escolher esportes' }));

    expect(screen.getByRole('dialog', { name: 'Configurações' })).toBeTruthy();
  });

  it('CA-02.4: encadeia `totalFontesBloqueaveis` de `config/fontes.json` até o banner de "Você bloqueou N fontes"', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify({
        versaoEsquema: 1,
        temporada: 2026,
        favoritos: [],
        fontesBloqueadas: ['fonte-a', 'fonte-b'],
        timeId: null,
        rivais: [],
        atualizadoEm: '2026-09-05T09:00:00-03:00',
      }),
    );
    const cliente = criarClienteSnapshot([
      item({ id: 'a'.padEnd(20, '0'), fonteId: 'ge' }),
    ]);

    renderizarHome({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    expect(
      screen.getByText('Você bloqueou 2 fontes. Estas notícias vêm do ge.'),
    ).toBeTruthy();
  });

  it('REFAT-09-01: bloquear uma fonte em Configurações (aberta a partir da Home) reflete no feed sem navegar/remontar', async () => {
    const armazenamento = new ArmazenamentoFalso();
    const cliente = criarClienteSnapshot([
      item({
        id: 'a'.padEnd(20, '0'),
        fonteId: 'fonte-a',
        titulo: 'Notícia da Fonte A',
      }),
      item({ id: 'b'.padEnd(20, '0'), fonteId: 'ge', titulo: 'Notícia do GE' }),
    ]);

    renderizarHome({ armazenamento, clienteSnapshot: cliente });
    await esvaziarMicrotarefas();

    // Antes de bloquear: as duas notícias aparecem no feed único de notícias.
    expect(screen.getByText('Notícia da Fonte A')).toBeTruthy();
    expect(screen.getByText('Notícia do GE')).toBeTruthy();

    // Abre Configurações a partir da própria Home (sem navegar).
    fireEvent.click(screen.getByRole('button', { name: 'Escolher esportes' }));
    const dialogo = screen.getByRole('dialog', { name: 'Configurações' });

    // Bloqueia "Fonte A" (Alternador com role="switch", CA-02.1/CA-02.2).
    fireEvent.click(within(dialogo).getByRole('switch', { name: 'Fonte A' }));

    // Fecha a sobreposição — nenhuma navegação, `Home` nunca é remontada.
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // CA-02.1: o feed já reflete o bloqueio, sem recarregar/remontar a página.
    expect(screen.queryByText('Notícia da Fonte A')).toBeNull();
    expect(screen.getByText('Notícia do GE')).toBeTruthy();
  });

  it('REFAT-09-02: time salvo fora da temporada corrente abre T-04 sozinha, com o banner de CA-06.5', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify({
        versaoEsquema: 1,
        temporada: 2025,
        favoritos: [],
        fontesBloqueadas: [],
        timeId: 'cruzeiro', // fora de `clubesValidos` (só 'spa') do catálogo fake.
        rivais: [],
        atualizadoEm: '2026-09-05T09:00:00-03:00',
      }),
    );
    const cliente = criarClienteSnapshot([]);

    renderizarHome({ armazenamento, clienteSnapshot: cliente });
    await esvaziarMicrotarefas();

    const dialogo = screen.getByRole('dialog', { name: 'Escolher time' });
    expect(
      within(dialogo).getByText(
        'Cruzeiro não está na Série A de 2026; escolha um novo time para continuar. Seus esportes favoritos e fontes bloqueadas foram mantidos.',
      ),
    ).toBeTruthy();
  });

  it('REFAT-09-02: `timeForaDaTemporada` falso não abre T-04 automaticamente', async () => {
    const cliente = criarClienteSnapshot([]);
    renderizarHome({ clienteSnapshot: cliente });
    await esvaziarMicrotarefas();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('CSS (REFAT-08-01): grade de 2 colunas (336px/748px) só a partir de 1024px, coluna única abaixo disso', () => {
    const caminhoCss = resolve(
      dirname(fileURLToPath(import.meta.url)),
      'Home.module.css',
    );
    const css = readFileSync(caminhoCss, 'utf-8');

    // Abaixo de 1024px: coluna única (flex column), sem grade.
    expect(css).toMatch(/\.pagina\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/\.pagina\s*\{[^}]*flex-direction:\s*column/);

    // A partir de 1024px: grade de 2 colunas com as larguras exatas do
    // wireframe desktop (UX-SPEC §2/T-02), via tokens (Diretriz #4), nunca
    // literais soltos no CSS do componente.
    expect(css).toMatch(
      /@media \(min-width: 1024px\) \{\s*\.pagina\s*\{[^}]*display:\s*grid/,
    );
    expect(css).toMatch(
      /@media \(min-width: 1024px\) \{\s*\.pagina\s*\{[^}]*grid-template-columns:\s*var\(--home-coluna-fixa-largura\)\s*var\(--home-feed-largura\)/,
    );

    const tokensCss = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../design-system/tokens.css'),
      'utf-8',
    );
    expect(tokensCss).toMatch(/--home-coluna-fixa-largura:\s*336px/);
    expect(tokensCss).toMatch(/--home-feed-largura:\s*748px/);
  });
});
