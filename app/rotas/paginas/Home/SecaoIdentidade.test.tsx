// @vitest-environment jsdom
// app/rotas/paginas/Home/SecaoIdentidade.test.tsx — UI-T02-01 (TASK.md Lote 8)

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClienteSnapshot } from '../../../dados/clienteSnapshot';
import { URL_VERSAO } from '../../../dados/versao';
import { URL_FUTEBOL_BRASILEIRAO, urlFutebolClube } from '../../../dados/futebol';
import { resetarCacheClubesPublicosParaTeste } from '../../../dados/useClubesPublicos';
import { SecaoIdentidade } from './SecaoIdentidade';

const PALETA_SAO_PAULO = {
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

const PALETA_PALMEIRAS = {
  ...PALETA_SAO_PAULO,
  identidade: '#006437',
  identidadeEscuro: '#00B85A',
};

const CLUBES_FIXTURE = [
  {
    id: 'sao-paulo',
    nome: 'São Paulo Futebol Clube',
    nomeCurto: 'São Paulo',
    sigla: 'SPA',
    corBase: '#E30613',
    paleta: PALETA_SAO_PAULO,
  },
  {
    id: 'palmeiras',
    nome: 'Sociedade Esportiva Palmeiras',
    nomeCurto: 'Palmeiras',
    sigla: 'PAL',
    corBase: '#006437',
    paleta: PALETA_PALMEIRAS,
  },
  {
    id: 'fluminense',
    nome: 'Fluminense Football Club',
    nomeCurto: 'Fluminense',
    sigla: 'FLU',
    corBase: '#7A1E30',
    paleta: PALETA_SAO_PAULO,
  },
];

const COMPETICAO = {
  id: 'brasileirao-serie-a',
  nome: 'Brasileirão Série A',
  temporada: 2026,
  formato: 'pontos-corridos' as const,
  janela: { inicio: '2026-03-01', fim: '2026-12-01' },
  provedor: 'football-data-org',
  ultimaAtualizacao: '2026-09-05T10:00:00-03:00',
};

function linha(clubeId: string, posicao: number, pontos: number) {
  return {
    competicaoId: 'brasileirao-serie-a',
    grupo: null,
    posicao,
    clubeId,
    pontos,
    jogos: 23,
    v: 12,
    e: 6,
    d: 5,
    gp: 38,
    gc: 24,
    sg: 14,
    aproveitamento: 61.4,
    ultimosCinco: ['V', 'E', 'D', 'V', 'V'] as const,
  };
}

const BRASILEIRAO_FIXTURE = {
  competicao: COMPETICAO,
  classificacao: [linha('palmeiras', 1, 47), linha('sao-paulo', 6, 42)],
  partidas: [],
  zonas: [],
};

const PARTIDA_FIXTURE = {
  id: 'p1',
  competicaoId: 'brasileirao-serie-a',
  rodada: 24,
  fase: null,
  mandanteId: 'fluminense',
  visitanteId: 'sao-paulo',
  dataHora: '2026-09-13T16:00:00-03:00',
  horarioDefinido: true,
  estadio: 'Maracanã',
  status: 'agendada' as const,
  placar: null,
};

const FUTEBOL_CLUBE_FIXTURE = [
  {
    competicao: COMPETICAO,
    participacao: {
      competicaoId: 'brasileirao-serie-a',
      clubeId: 'sao-paulo',
      status: 'em-andamento' as const,
      faseAtual: null,
      resultadoFinal: null,
      resumo: null,
    },
    partidas: [PARTIDA_FIXTURE],
  },
];

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
        atualizadoEm: '2026-09-05T10:00:00-03:00',
      });
    },
  };
}

function criarClienteSnapshotFake(): ClienteSnapshot {
  const versaoJson = {
    geradoEm: '2026-09-05T10:00:00-03:00',
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
    if (chave === urlFutebolClube('sao-paulo')) {
      return {
        ok: true,
        status: 200,
        json: async () => FUTEBOL_CLUBE_FIXTURE,
      } as Response;
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

function renderizar(props: {
  armazenamento: Pick<Storage, 'getItem'>;
  clienteSnapshot?: ClienteSnapshot;
  aoEscolherTime?: () => void;
}): ReturnType<typeof render> {
  const propsOpcionais = props.aoEscolherTime
    ? { aoEscolherTime: props.aoEscolherTime }
    : {};
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <SecaoIdentidade
              armazenamento={props.armazenamento}
              opcoesClubesPublicos={{ buscar: buscarClubesFake() }}
              clienteSnapshot={props.clienteSnapshot ?? criarClienteSnapshotFake()}
              {...propsOpcionais}
            />
          }
        />
        <Route path="/simulacao" element={<p>SIMULACAO_OK</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SecaoIdentidade (UI-T02-01 — UX-SPEC T-02)', () => {
  afterEach(() => {
    cleanup();
    resetarCacheClubesPublicosParaTeste();
    vi.restoreAllMocks();
  });

  it('CA-14.3: sem time salvo, mostra faixa neutra + convite único, sem PRÓXIMO JOGO/A BRIGA', () => {
    const aoEscolherTime = vi.fn();
    renderizar({ armazenamento: armazenamentoComTime(null), aoEscolherTime });

    expect(
      screen.getByText(
        'Escolha seu time para ver o painel com todos os campeonatos do ano.',
      ),
    ).not.toBeNull();
    expect(screen.queryByText(/PRÓXIMO JOGO/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'ESCOLHER MEU TIME' }));
    expect(aoEscolherTime).toHaveBeenCalledTimes(1);
  });

  it('com time salvo: nunca mostra o convite de "sem time" (CA-14.3 só se aplica sem time)', () => {
    renderizar({ armazenamento: armazenamentoComTime('sao-paulo') });

    expect(
      screen.queryByText(
        'Escolha seu time para ver o painel com todos os campeonatos do ano.',
      ),
    ).toBeNull();
  });

  it('exibe nome do clube, PRÓXIMO JOGO e A BRIGA quando os três dados chegam', async () => {
    renderizar({ armazenamento: armazenamentoComTime('sao-paulo') });

    await waitFor(() => {
      expect(screen.getAllByText(/São Paulo/).length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(screen.getByText(/Fluminense/)).not.toBeNull();
    });
    expect(screen.getByText(/24ª rodada/)).not.toBeNull();
    expect(screen.getByText(/Maracanã/)).not.toBeNull();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'SIMULAR OS JOGOS QUE FALTAM' }),
      ).not.toBeNull();
    });
    // "6º" também aparece no número de posição da própria `FaixaClube`
    // (variante completa) — daí `getAllByText` em vez de `getByText`.
    expect(screen.getAllByText('1º').length).toBeGreaterThan(0);
    expect(screen.getAllByText('6º').length).toBeGreaterThan(0);
  });

  it('atalho "SIMULAR OS JOGOS QUE FALTAM" leva a /simulacao (T-09)', async () => {
    renderizar({ armazenamento: armazenamentoComTime('sao-paulo') });

    const botao = await screen.findByRole('button', {
      name: 'SIMULAR OS JOGOS QUE FALTAM',
    });
    fireEvent.click(botao);

    expect(await screen.findByText('SIMULACAO_OK')).not.toBeNull();
  });
});
