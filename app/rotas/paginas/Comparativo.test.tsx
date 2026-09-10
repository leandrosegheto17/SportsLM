// @vitest-environment jsdom
// app/rotas/paginas/Comparativo.test.tsx — UI-T08-01 (TASK.md Lote 11)

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClienteSnapshot } from '../../dados/clienteSnapshot';
import { URL_VERSAO } from '../../dados/versao';
import { URL_FUTEBOL_BRASILEIRAO } from '../../dados/futebol';
import { resetarCacheClubesPublicosParaTeste } from '../../dados/useClubesPublicos';
import { ProvedorSobreposicoes } from '../SobreposicoesContext';
import { Comparativo } from './Comparativo';

const URL_STATUS = '/dados/ingestao/status.json';

function paleta(hex: string) {
  return {
    acromatico: false,
    identidade: hex,
    faixaB: hex,
    identidadeTexto: '#FFFFFF',
    acento: hex,
    acentoSobreEscuro: '#FF6B6B',
    suave: '#FDE7E8',
    suaveEscuro: '#3A1013',
    identidadeEscuro: hex,
    faixaBEscuro: hex,
    identidadeTextoEscuro: '#FFFFFF',
  };
}

const CLUBES_FIXTURE = [
  {
    id: 'sao-paulo',
    nome: 'São Paulo Futebol Clube',
    nomeCurto: 'São Paulo',
    sigla: 'SPA',
    corBase: '#E30613',
    paleta: paleta('#E30613'),
  },
  {
    id: 'palmeiras',
    nome: 'Sociedade Esportiva Palmeiras',
    nomeCurto: 'Palmeiras',
    sigla: 'PAL',
    corBase: '#006437',
    paleta: paleta('#006437'),
  },
  {
    id: 'corinthians',
    nome: 'Sport Club Corinthians Paulista',
    nomeCurto: 'Corinthians',
    sigla: 'COR',
    corBase: '#000000',
    paleta: paleta('#000000'),
  },
];

function linha(
  clubeId: string,
  posicao: number,
  pontos: number,
  extra: Partial<{
    jogos: number;
    v: number;
    e: number;
    d: number;
    sg: number;
    aproveitamento: number;
    ultimosCinco: ('V' | 'E' | 'D')[];
  }> = {},
) {
  return {
    competicaoId: 'brasileirao-serie-a',
    grupo: null,
    posicao,
    clubeId,
    pontos,
    jogos: extra.jogos ?? 23,
    v: extra.v ?? 12,
    e: extra.e ?? 6,
    d: extra.d ?? 5,
    gp: 38,
    gc: 24,
    sg: extra.sg ?? 14,
    aproveitamento: extra.aproveitamento ?? 61.4,
    ultimosCinco: extra.ultimosCinco ?? (['V', 'E', 'D', 'V', 'V'] as const),
  };
}

function partida(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'p1',
    competicaoId: 'brasileirao-serie-a',
    rodada: 24,
    fase: null,
    mandanteId: 'fluminense',
    visitanteId: 'sao-paulo',
    dataHora: '2026-09-13T16:00:00-03:00',
    horarioDefinido: true,
    estadio: 'Maracanã',
    status: 'agendada',
    placar: null,
    ...over,
  };
}

const BRASILEIRAO_FIXTURE = {
  competicao: {
    id: 'brasileirao-serie-a',
    nome: 'Brasileirão Série A',
    temporada: 2026,
    formato: 'pontos-corridos' as const,
    janela: { inicio: '2026-01-01', fim: '2026-12-01' },
    provedor: 'football-data-org',
    ultimaAtualizacao: '2026-09-05T10:00:00-03:00',
  },
  classificacao: [
    linha('sao-paulo', 6, 42),
    linha('palmeiras', 1, 47, { sg: 21, aproveitamento: 68.1 }),
    linha('corinthians', 5, 43, { sg: 9, aproveitamento: 62.3 }),
  ],
  partidas: [
    partida({ id: 'p1', mandanteId: 'fluminense', visitanteId: 'sao-paulo', rodada: 24 }),
    partida({
      id: 'p2',
      mandanteId: 'sao-paulo',
      visitanteId: 'palmeiras',
      rodada: 27,
      dataHora: '2026-10-03T16:00:00-03:00',
    }),
    partida({
      id: 'p3',
      mandanteId: 'palmeiras',
      visitanteId: 'sao-paulo',
      rodada: 27,
      dataHora: '2026-10-03T16:00:00-03:00',
    }),
    partida({
      id: 'p4',
      mandanteId: 'corinthians',
      visitanteId: 'gremio',
      rodada: 24,
      dataHora: null,
    }),
  ],
  zonas: [],
};

function armazenamentoComPreferencias(
  timeId: string | null,
  rivais: string[],
): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  let dados = JSON.stringify({
    versaoEsquema: 1,
    temporada: 2026,
    favoritos: [],
    fontesBloqueadas: [],
    timeId,
    rivais,
    atualizadoEm: '2026-09-05T10:00:00-03:00',
  });
  return {
    getItem: (chave: string) => (chave === 'sportslm.preferencias.v1' ? dados : null),
    setItem: (chave: string, valor: string) => {
      if (chave === 'sportslm.preferencias.v1') dados = valor;
    },
    removeItem: () => undefined,
  };
}

function criarClienteSnapshotFake(
  opcoes: { erroBrasileirao?: boolean; brasileiraoFixture?: unknown } = {},
): ClienteSnapshot {
  const versaoJson = {
    geradoEm: '2026-09-05T10:00:00-03:00',
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
        json: async () => ({ pausadoPorCota: false }),
      } as Response;
    }
    if (chave === URL_FUTEBOL_BRASILEIRAO) {
      if (opcoes.erroBrasileirao) {
        return { ok: false, status: 500, json: async () => ({}) } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => opcoes.brasileiraoFixture ?? BRASILEIRAO_FIXTURE,
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
}): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/comparativo']}>
      <ProvedorSobreposicoes armazenamento={props.armazenamento}>
        <Routes>
          <Route
            path="/comparativo"
            element={
              <Comparativo
                armazenamento={props.armazenamento}
                opcoesClubesPublicos={{ buscar: buscarClubesFake() }}
                clienteSnapshot={props.clienteSnapshot ?? criarClienteSnapshotFake()}
                agora={new Date('2026-09-05T12:00:00-03:00')}
              />
            }
          />
          <Route path="/simulacao" element={<p>SIMULACAO_OK</p>} />
        </Routes>
      </ProvedorSobreposicoes>
    </MemoryRouter>,
  );
}

describe('Comparativo (UI-T08-01 — UX-SPEC T-08)', () => {
  afterEach(() => {
    cleanup();
    resetarCacheClubesPublicosParaTeste();
    vi.restoreAllMocks();
  });

  it('sem time salvo: mostra convite e abre EscolherTime ao clicar', () => {
    renderizar({ armazenamento: armazenamentoComPreferencias(null, []) });

    expect(
      screen.getByText(/Escolha seu time para ver o comparativo com seus rivais/),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'ESCOLHER MEU TIME' }));
    expect(screen.getByRole('heading', { name: /escolher|trocar/i })).toBeTruthy();
  });

  it('UX-15-02: sem time salvo (CA-14.3), a `FaixaClube` não aparece', () => {
    renderizar({ armazenamento: armazenamentoComPreferencias(null, []) });

    expect(
      screen.getByText(/Escolha seu time para ver o comparativo com seus rivais/),
    ).not.toBeNull();
    // Nem a variante `completa` nem a `neutra` de `FaixaClube` aparecem no
    // estado "sem time" — o convite atual (EstadoVazio) continua sozinho.
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('CA-10.5: sem rival escolhido, mostra o convite canônico com atalho para T-07', async () => {
    renderizar({ armazenamento: armazenamentoComPreferencias('sao-paulo', []) });

    await waitFor(() => {
      expect(
        screen.getByText('Escolha até 2 rivais para ver a briga lado a lado.'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'ESCOLHER RIVAIS' }));
    expect(screen.getByRole('heading', { name: /escolher rivais/i })).toBeTruthy();
  });

  it('UX-15-02 (CA-10.5): com time salvo mas zero rival, a `FaixaClube` completa do time do coração aparece', async () => {
    renderizar({ armazenamento: armazenamentoComPreferencias('sao-paulo', []) });

    await waitFor(() => {
      expect(
        screen.getByRole('group', { name: /São Paulo.*Brasileirão Série A.*2026/s }),
      ).not.toBeNull();
    });
  });

  it('CA-10.1: mostra posição, pontos, aproveitamento e diferença dos clubes comparados, time sempre primeiro', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias('sao-paulo', [
        'palmeiras',
        'corinthians',
      ]),
    });

    await waitFor(() => {
      expect(screen.getByText('SEU TIME')).not.toBeNull();
    });

    const secoes = ['São Paulo', 'Palmeiras', 'Corinthians'];
    for (const nome of secoes) {
      expect(screen.getByLabelText(nome)).not.toBeNull();
    }

    expect(screen.getByText('+5 PTS')).not.toBeNull();
    expect(screen.getByText('+1 PT')).not.toBeNull();

    // UX-15-02: `FaixaClube` completa do time do coração (São Paulo), no topo
    // da tela preenchida — não confundir com o `role="group"` da própria
    // seção "São Paulo" (aria-label exato distinto, ver `getByLabelText`
    // acima, que casa string exata).
    expect(
      screen.getByRole('group', { name: /São Paulo.*Brasileirão Série A.*2026/s }),
    ).not.toBeNull();
  });

  it('CA-10.3: confronto direto aparece nas duas listas simultaneamente', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias('sao-paulo', ['palmeiras']),
    });

    await waitFor(() => {
      expect(screen.getAllByText('CONFRONTO DIRETO').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('CA-10.4: partida sem data mostra "DATA A DEFINIR"', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias('corinthians', ['sao-paulo']),
    });

    await waitFor(() => {
      expect(screen.getByText(/DATA A DEFINIR/)).not.toBeNull();
    });
  });

  it('UX-15-02: estado carregando (antes do Brasileirão/clubes chegarem) já mostra alguma `FaixaClube` (com time salvo, nunca ausente)', () => {
    // Sem `await`/`waitFor`: captura a tela no instante inicial, antes das
    // promises de clubes/Brasileirão resolverem — mesmo padrão de asserção
    // síncrona já usado no teste "sem time salvo" acima. Não afirma a
    // variante exata (pode ser `neutra` até `clubes` carregar e virar
    // `completa`, ver `Comparativo.tsx`) — só que a faixa nunca fica
    // ausente enquanto há time salvo, diferente do estado CA-14.3.
    renderizar({
      armazenamento: armazenamentoComPreferencias('sao-paulo', ['palmeiras']),
    });

    expect(screen.getByRole('group')).not.toBeNull();
  });

  it('Erro sem dado anterior: mostra "Não conseguimos carregar o comparativo." com Tentar de novo', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias('sao-paulo', ['palmeiras']),
      clienteSnapshot: criarClienteSnapshotFake({ erroBrasileirao: true }),
    });

    await waitFor(() => {
      expect(screen.getByText('Não conseguimos carregar o comparativo.')).not.toBeNull();
    });
    expect(screen.getByRole('button', { name: 'TENTAR DE NOVO' })).not.toBeNull();

    // UX-15-02: mesmo no estado de erro (com time salvo), a `FaixaClube`
    // aparece — sem dados de posição/pontos ainda (Brasileirão não chegou a
    // carregar), então cai na variante `completa` sem o bloco de número.
    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'São Paulo.' })).not.toBeNull();
    });
  });

  it('CA-09.5: classificação vazia mostra o estado "sem dados" com atalho para rivais', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias('sao-paulo', ['palmeiras']),
      clienteSnapshot: criarClienteSnapshotFake({
        brasileiraoFixture: { ...BRASILEIRAO_FIXTURE, classificacao: [] },
      }),
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Sem dados disponíveis no momento\. Você já pode escolher/),
      ).not.toBeNull();
    });

    // UX-15-02: Brasileirão sem dados publicados (CA-09.5) ainda mostra a
    // `FaixaClube` — sem posição/pontos, porque `classificacao` está vazia.
    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'São Paulo.' })).not.toBeNull();
    });
  });

  it('CA-10.2: lista todos os jogos que faltam do clube, por rodada, com adversário e mando', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias('sao-paulo', ['palmeiras']),
      clienteSnapshot: criarClienteSnapshotFake({
        brasileiraoFixture: {
          ...BRASILEIRAO_FIXTURE,
          partidas: [
            partida({
              id: 'sp-1',
              mandanteId: 'fluminense',
              visitanteId: 'sao-paulo',
              rodada: 24,
              dataHora: '2026-09-13T16:00:00-03:00',
            }),
            partida({
              id: 'sp-2',
              mandanteId: 'sao-paulo',
              visitanteId: 'botafogo',
              rodada: 25,
              dataHora: '2026-09-20T16:00:00-03:00',
            }),
            // Já disputada — nunca deve aparecer entre os "jogos que faltam".
            partida({
              id: 'sp-0',
              mandanteId: 'sao-paulo',
              visitanteId: 'gremio',
              rodada: 20,
              status: 'finalizada',
              placar: { mandante: 1, visitante: 0 },
            }),
          ],
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByLabelText('São Paulo')).not.toBeNull();
    });

    const secaoSaoPaulo = screen.getByLabelText('São Paulo');
    expect(secaoSaoPaulo.textContent).toContain('fluminense');
    expect(secaoSaoPaulo.textContent).toContain('fora');
    expect(secaoSaoPaulo.textContent).toContain('botafogo');
    expect(secaoSaoPaulo.textContent).toContain('casa');
    expect(secaoSaoPaulo.textContent).not.toContain('gremio');
    expect(secaoSaoPaulo.textContent).toContain('2 jogos restantes');
  });

  it('CA-10.6: busca dados exclusivamente do Brasileirão — nenhuma outra competição é consultada', async () => {
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
        return {
          ok: true,
          status: 200,
          json: async () => ({ pausadoPorCota: false }),
        } as Response;
      }
      if (chave === URL_FUTEBOL_BRASILEIRAO) {
        return {
          ok: true,
          status: 200,
          json: async () => BRASILEIRAO_FIXTURE,
        } as Response;
      }
      throw new Error(`URL inesperada: ${chave}`);
    });

    renderizar({
      armazenamento: armazenamentoComPreferencias('sao-paulo', ['palmeiras']),
      clienteSnapshot: new ClienteSnapshot({ buscar: buscar as unknown as typeof fetch }),
    });

    await waitFor(() => {
      expect(screen.getByText('SEU TIME')).not.toBeNull();
    });

    const urlsConsultadas = buscar.mock.calls.map((chamada) => String(chamada[0]));
    // Nenhuma URL de outro campeonato (RN-11/CA-10.6: só o Brasileirão).
    expect(urlsConsultadas.every((url) => !url.includes('/futebol/clube/'))).toBe(true);
    expect(urlsConsultadas).toContain(URL_FUTEBOL_BRASILEIRAO);
  });

  it('CA-09.6: Brasileirão ainda não começou — aviso de que todas as rodadas contam como restantes', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias('sao-paulo', ['palmeiras']),
      clienteSnapshot: criarClienteSnapshotFake({
        brasileiraoFixture: {
          ...BRASILEIRAO_FIXTURE,
          classificacao: BRASILEIRAO_FIXTURE.classificacao.map((l) => ({
            ...l,
            jogos: 0,
          })),
        },
      }),
    });

    await waitFor(() => {
      expect(
        screen.getByText(/ainda não começou\. Todas as 38 rodadas contam como restantes/),
      ).not.toBeNull();
    });

    // UX-15-02: Brasileirão não iniciado também mostra a `FaixaClube`, com o
    // número (posição/pontos da fixture, que não são zerados por esta
    // variação de teste — só `jogos` é zerado).
    expect(
      screen.getByRole('group', { name: /São Paulo.*Brasileirão Série A.*2026/s }),
    ).not.toBeNull();
  });

  it('CA-09.7: Brasileirão encerrado — mantém rivais e comparativo (situação final), sem aviso de "não começou"', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias('sao-paulo', ['palmeiras']),
      clienteSnapshot: criarClienteSnapshotFake({
        brasileiraoFixture: {
          ...BRASILEIRAO_FIXTURE,
          partidas: BRASILEIRAO_FIXTURE.partidas.map((p) => ({
            ...p,
            status: 'finalizada',
            placar: { mandante: 1, visitante: 1 },
          })),
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('SEU TIME')).not.toBeNull();
    });

    // Comparativo continua mostrando a situação (final) normalmente.
    expect(screen.queryByText(/ainda não começou/)).toBeNull();
    expect(screen.getByLabelText('São Paulo')).not.toBeNull();
    expect(screen.getByLabelText('Palmeiras')).not.toBeNull();
  });

  it('navega para /simulacao ao clicar em "ABRIR SIMULAÇÃO"', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias('sao-paulo', ['palmeiras']),
    });

    const botao = await screen.findByRole('button', { name: 'ABRIR SIMULAÇÃO' });
    fireEvent.click(botao);

    expect(await screen.findByText('SIMULACAO_OK')).not.toBeNull();
  });
});
