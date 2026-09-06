// @vitest-environment jsdom
// app/rotas/paginas/PainelTime.test.tsx — UI-T05-01 (TASK.md Lote 10)

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calcularFrescor } from '../../../dominio/frescor';
import { ClienteSnapshot } from '../../dados/clienteSnapshot';
import { URL_VERSAO } from '../../dados/versao';
import { urlFutebolClube } from '../../dados/futebol';
import { resetarCacheClubesPublicosParaTeste } from '../../dados/useClubesPublicos';
import { ProvedorSobreposicoes } from '../SobreposicoesContext';
import { PainelTime } from './PainelTime';

const URL_STATUS = '/dados/ingestao/status.json';
const GERADO_EM_FIXTURE = '2026-09-05T10:00:00-03:00';
const INTERVALO_FUTEBOL_MINUTOS_TESTE = 6 * 60;

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
    id: 'fluminense',
    nome: 'Fluminense Football Club',
    nomeCurto: 'Fluminense',
    sigla: 'FLU',
    corBase: '#7A1E30',
    paleta: PALETA_SAO_PAULO,
  },
];

function competicao(
  id: string,
  nome: string,
  formato: 'pontos-corridos' | 'mata-mata' | 'grupos' | 'misto',
) {
  return {
    id,
    nome,
    temporada: 2026,
    formato,
    janela: { inicio: '2026-01-01', fim: '2026-12-01' },
    provedor: id === 'supercopa-do-brasil' ? null : 'football-data-org',
    ultimaAtualizacao: '2026-09-05T10:00:00-03:00',
  };
}

const PARTIDA_PROXIMA = {
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

const RESUMO_BRASILEIRAO = {
  jogos: 23,
  v: 12,
  e: 6,
  d: 5,
  gp: 38,
  gc: 24,
  sg: 14,
  pontos: 42,
  aproveitamento: 61.4,
  posicao: 6,
};

const FUTEBOL_CLUBE_FIXTURE = [
  {
    competicao: competicao(
      'brasileirao-serie-a',
      'Brasileirão Série A',
      'pontos-corridos',
    ),
    participacao: {
      competicaoId: 'brasileirao-serie-a',
      clubeId: 'sao-paulo',
      status: 'em-andamento' as const,
      faseAtual: null,
      resultadoFinal: null,
      resumo: RESUMO_BRASILEIRAO,
    },
    partidas: [PARTIDA_PROXIMA],
  },
  {
    competicao: competicao('copa-do-brasil', 'Copa do Brasil', 'mata-mata'),
    participacao: {
      competicaoId: 'copa-do-brasil',
      clubeId: 'sao-paulo',
      status: 'eliminado' as const,
      faseAtual: 'Oitavas',
      resultadoFinal: null,
      resumo: null,
    },
    partidas: [
      {
        id: 'p2',
        competicaoId: 'copa-do-brasil',
        rodada: null,
        fase: 'Oitavas',
        mandanteId: 'sao-paulo',
        visitanteId: 'fluminense',
        dataHora: '2026-08-13T21:30:00-03:00',
        horarioDefinido: true,
        estadio: null,
        status: 'finalizada' as const,
        placar: { mandante: 0, visitante: 1 },
      },
    ],
  },
  {
    competicao: competicao('paulista', 'Campeonato Paulista', 'grupos'),
    participacao: {
      competicaoId: 'paulista',
      clubeId: 'sao-paulo',
      status: 'concluido' as const,
      faseAtual: null,
      resultadoFinal: 'Campeão',
      resumo: null,
    },
    partidas: [],
  },
  {
    competicao: competicao('supercopa-do-brasil', 'Supercopa do Brasil', 'mata-mata'),
    participacao: {
      competicaoId: 'supercopa-do-brasil',
      clubeId: 'sao-paulo',
      status: 'sem-dados' as const,
      faseAtual: null,
      resultadoFinal: null,
      resumo: null,
    },
    partidas: [],
  },
];

function armazenamentoComTime(
  timeId: string | null,
): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
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
    setItem: () => undefined,
    removeItem: () => undefined,
  };
}

function criarClienteSnapshotFake(
  opcoes: {
    erroFutebol?: boolean;
    futebolClubeFixture?: unknown;
    pausadoPorCota?: boolean;
  } = {},
): ClienteSnapshot {
  const versaoJson = {
    geradoEm: GERADO_EM_FIXTURE,
    hashes: { noticias: 'h1', futebol: 'f1', catalogo: 'c1', status: 's1' },
  };

  const buscar = vi.fn(async (url: RequestInfo | URL) => {
    const chave = String(url);
    if (chave === URL_VERSAO) {
      return { ok: true, status: 200, json: async () => versaoJson } as Response;
    }
    if (chave === URL_STATUS) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ pausadoPorCota: opcoes.pausadoPorCota ?? false }),
      } as Response;
    }
    if (chave === urlFutebolClube('sao-paulo')) {
      if (opcoes.erroFutebol) {
        return { ok: false, status: 500, json: async () => ({}) } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => opcoes.futebolClubeFixture ?? FUTEBOL_CLUBE_FIXTURE,
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
  armazenamento: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  clienteSnapshot?: ClienteSnapshot;
  agora?: Date;
}): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/time']}>
      <ProvedorSobreposicoes armazenamento={props.armazenamento}>
        <Routes>
          <Route
            path="/time"
            element={
              <PainelTime
                armazenamento={props.armazenamento}
                opcoesClubesPublicos={{ buscar: buscarClubesFake() }}
                clienteSnapshot={props.clienteSnapshot ?? criarClienteSnapshotFake()}
                agora={props.agora ?? new Date('2026-09-05T12:00:00-03:00')}
              />
            }
          />
          <Route path="/time/:campeonatoId" element={<p>DETALHE_OK</p>} />
        </Routes>
      </ProvedorSobreposicoes>
    </MemoryRouter>,
  );
}

describe('PainelTime (UI-T05-01 — UX-SPEC T-05)', () => {
  afterEach(() => {
    cleanup();
    resetarCacheClubesPublicosParaTeste();
    vi.restoreAllMocks();
  });

  it('CA-14.3: sem time salvo, mostra faixa neutra + convite único e abre EscolherTime ao clicar', () => {
    renderizar({ armazenamento: armazenamentoComTime(null) });

    expect(
      screen.getByText(
        'Escolha seu time para ver o painel com todos os campeonatos do ano.',
      ),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'ESCOLHER MEU TIME' }));
    // T-04 (`EscolherTime`) monta ao lado, controlada por `ProvedorSobreposicoes`.
    expect(screen.getByRole('heading', { name: /escolher|trocar/i })).toBeTruthy();
  });

  it('CA-07.2: cartão "sem dados" nunca é omitido, mesmo com outros 3 status presentes', async () => {
    renderizar({ armazenamento: armazenamentoComTime('sao-paulo') });

    await waitFor(() => {
      expect(screen.getByText('Supercopa do Brasil — SEM DADOS')).not.toBeNull();
    });
    expect(screen.getByText('Cobertura indisponível nesta versão.')).not.toBeNull();
  });

  it('CA-07.4: ordena em-andamento → eliminado → concluído → sem-dados (mesma ordem sempre)', async () => {
    renderizar({ armazenamento: armazenamentoComTime('sao-paulo') });

    await waitFor(() => {
      expect(screen.getByText('Brasileirão Série A')).not.toBeNull();
    });

    const nomes = screen
      .getAllByText(
        /^(Brasileirão Série A|Copa do Brasil|Campeonato Paulista|Supercopa do Brasil( — SEM DADOS)?)$/,
      )
      .map((el) => el.textContent);

    expect(nomes).toEqual([
      'Brasileirão Série A',
      'Copa do Brasil',
      'Campeonato Paulista',
      'Supercopa do Brasil — SEM DADOS',
    ]);
  });

  it('CA-07.1: mostra o texto de status canônico por campeonato', async () => {
    renderizar({ armazenamento: armazenamentoComTime('sao-paulo') });

    await waitFor(() => {
      expect(screen.getByText(/Em andamento/)).not.toBeNull();
    });
    expect(screen.getByText(/Eliminado na Oitavas/)).not.toBeNull();
    expect(screen.getByText(/Concluído — Campeão/)).not.toBeNull();
  });

  it('CA-07.5: destaca o próximo jogo do time no cabeçalho', async () => {
    renderizar({ armazenamento: armazenamentoComTime('sao-paulo') });

    await waitFor(() => {
      expect(screen.getByText('Próximo jogo')).not.toBeNull();
    });
    expect(screen.getByText(/Fluminense/)).not.toBeNull();
    expect(screen.getByText(/24ª rodada/)).not.toBeNull();
  });

  it('navega para /time/:campeonatoId ao clicar num cartão (T-06)', async () => {
    renderizar({ armazenamento: armazenamentoComTime('sao-paulo') });

    const link = await screen.findByRole('link', { name: /Brasileirão Série A/ });
    fireEvent.click(link);

    expect(await screen.findByText('DETALHE_OK')).not.toBeNull();
  });

  it('Erro sem dado anterior: mostra "Não conseguimos carregar o painel agora." com Tentar de novo', async () => {
    renderizar({
      armazenamento: armazenamentoComTime('sao-paulo'),
      clienteSnapshot: criarClienteSnapshotFake({ erroFutebol: true }),
    });

    await waitFor(() => {
      expect(screen.getByText('Não conseguimos carregar o painel agora.')).not.toBeNull();
    });
    expect(screen.getByRole('button', { name: 'TENTAR DE NOVO' })).not.toBeNull();
  });

  it('CA-06.4/CA-17.3: array publicado vazio mostra o estado "sem dados" da faixa', async () => {
    renderizar({
      armazenamento: armazenamentoComTime('sao-paulo'),
      clienteSnapshot: criarClienteSnapshotFake({ futebolClubeFixture: [] }),
    });

    await waitFor(() => {
      expect(screen.getByText(/Sem dados disponíveis no momento\./)).not.toBeNull();
    });
  });

  it('REFAT-10-01/CA-17.2: frescor muito desatualizado mostra o carimbo em alerta', async () => {
    // `geradoEm` fica fixo em GERADO_EM_FIXTURE (fixture do cliente); injetamos
    // um `agora` bem mais de 12h depois (2× o intervalo de 6h do futebol,
    // RN-09) para acionar `emAlerta` — mesma função `calcularFrescor` já
    // testada por tabela em `dominio/frescor.test.ts`, aqui confirmando que a
    // tela de fato encadeia o resultado ao `CarimboFrescor`.
    const agoraMuitoDepois = new Date('2026-09-07T00:00:01-03:00');
    renderizar({
      armazenamento: armazenamentoComTime('sao-paulo'),
      agora: agoraMuitoDepois,
    });

    await waitFor(() => {
      expect(screen.getByText('Brasileirão Série A')).not.toBeNull();
    });

    const esperado = calcularFrescor(
      agoraMuitoDepois,
      new Date(GERADO_EM_FIXTURE),
      INTERVALO_FUTEBOL_MINUTOS_TESTE,
    );
    expect(esperado.emAlerta).toBe(true);

    const carimboTexto = screen.getByText(esperado.atualizadoHa);
    expect(carimboTexto.closest('[data-estado]')?.getAttribute('data-estado')).toBe(
      'alerta',
    );
  });

  it('CA-16.4/CA-17.4: pausa por cota mostra o carimbo de frescor pausado', async () => {
    renderizar({
      armazenamento: armazenamentoComTime('sao-paulo'),
      clienteSnapshot: criarClienteSnapshotFake({ pausadoPorCota: true }),
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Atualização pausada por limite do provedor\./),
      ).not.toBeNull();
    });
  });
});
