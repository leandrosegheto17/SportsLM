// @vitest-environment jsdom
// app/rotas/paginas/Home/FaixaClubeDoTime.test.tsx — REFAT-10-01

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClienteSnapshot } from '../../../dados/clienteSnapshot';
import { URL_VERSAO } from '../../../dados/versao';
import { URL_FUTEBOL_BRASILEIRAO } from '../../../dados/futebol';
import { resetarCacheClubesPublicosParaTeste } from '../../../dados/useClubesPublicos';
import { FaixaClubeDoTime } from './FaixaClubeDoTime';

const PALETA_PALMEIRAS = {
  acromatico: false,
  identidade: '#006437',
  faixaB: '#004526',
  identidadeTexto: '#FFFFFF',
  acento: '#006437',
  acentoSobreEscuro: '#4CAF6E',
  suave: '#E5F3EB',
  suaveEscuro: '#0D2A18',
  identidadeEscuro: '#00B85A',
  faixaBEscuro: '#005C29',
  identidadeTextoEscuro: '#FFFFFF',
};

const CLUBES_FIXTURE = [
  {
    id: 'palmeiras',
    nome: 'Sociedade Esportiva Palmeiras',
    nomeCurto: 'Palmeiras',
    sigla: 'PAL',
    corBase: '#006437',
    paleta: PALETA_PALMEIRAS,
  },
];

const BRASILEIRAO_FIXTURE = {
  competicao: {
    id: 'brasileirao-serie-a',
    nome: 'Brasileirão Série A',
    temporada: 2026,
    formato: 'pontos-corridos' as const,
    janela: { inicio: '2026-01-28', fim: '2026-12-02' },
    provedor: 'football-data-org',
    ultimaAtualizacao: '2026-09-07T10:00:00-03:00',
  },
  classificacao: [
    {
      competicaoId: 'brasileirao-serie-a',
      grupo: null,
      posicao: 2,
      clubeId: 'palmeiras',
      pontos: 53,
      jogos: 23,
      v: 16,
      e: 5,
      d: 2,
      gp: 40,
      gc: 15,
      sg: 25,
      aproveitamento: 76.8,
      ultimosCinco: ['V', 'V', 'E', 'V', 'D'] as const,
    },
  ],
  partidas: [],
  zonas: [],
};

function armazenamentoComTime(timeId: string | null): Pick<Storage, 'getItem'> {
  return {
    getItem: (chave: string) => {
      if (chave !== 'sportslm.preferencias.v1') return null;
      return JSON.stringify({
        versaoEsquema: 1,
        temporada: 2026,
        favoritos: [],
        fontesBloqueadas: [],
        timeId,
        rivais: [],
        atualizadoEm: '2026-09-07T10:00:00-03:00',
      });
    },
  };
}

function criarClienteSnapshotFake(): ClienteSnapshot {
  const versaoJson = {
    geradoEm: '2026-09-07T10:00:00-03:00',
    hashes: { noticias: 'h1', futebol: 'f1', catalogo: 'c1', status: 's1' },
  };
  const buscar = vi.fn(async (url: RequestInfo | URL) => {
    const chave = String(url);
    if (chave === URL_VERSAO) {
      return { ok: true, status: 200, json: async () => versaoJson } as Response;
    }
    if (chave === URL_FUTEBOL_BRASILEIRAO) {
      return { ok: true, status: 200, json: async () => BRASILEIRAO_FIXTURE } as Response;
    }
    throw new Error(`URL inesperada: ${chave}`);
  }) as unknown as typeof fetch;
  return new ClienteSnapshot({ buscar });
}

function buscarClubesFake(): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => CLUBES_FIXTURE,
  })) as unknown as typeof fetch;
}

function renderizar(timeId: string | null): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <FaixaClubeDoTime
        armazenamento={armazenamentoComTime(timeId)}
        opcoesClubesPublicos={{ buscar: buscarClubesFake() }}
        clienteSnapshot={criarClienteSnapshotFake()}
      />
    </MemoryRouter>,
  );
}

describe('FaixaClubeDoTime (REFAT-10-01 — faixa full-width acima das colunas da Home)', () => {
  afterEach(() => {
    cleanup();
    resetarCacheClubesPublicosParaTeste();
    vi.restoreAllMocks();
  });

  it('sem time salvo, renderiza a variante neutra', () => {
    renderizar(null);
    expect(screen.queryByText('Palmeiras')).toBeNull();
  });

  it('com time salvo, renderiza nome, posição e pontos do clube (variante completa)', async () => {
    renderizar('palmeiras');
    expect(await screen.findByText('Palmeiras')).not.toBeNull();
    expect(await screen.findByText('2º')).not.toBeNull();
    expect(screen.getByText(/53/)).not.toBeNull();
  });

  it('a faixa completa aponta para /time (mesmo destino de SecaoIdentidade)', async () => {
    renderizar('palmeiras');
    const link = await screen.findByRole('link');
    expect(link.getAttribute('href')).toBe('/time');
  });
});
