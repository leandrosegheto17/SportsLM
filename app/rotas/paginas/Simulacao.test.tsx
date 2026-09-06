// @vitest-environment jsdom
// app/rotas/paginas/Simulacao.test.tsx — UI-T09-01/UI-T09-02 (TASK.md Lote 11)

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClienteSnapshot } from '../../dados/clienteSnapshot';
import { URL_VERSAO } from '../../dados/versao';
import { URL_FUTEBOL_BRASILEIRAO } from '../../dados/futebol';
import { resetarCacheClubesPublicosParaTeste } from '../../dados/useClubesPublicos';
import {
  construirEscopoCenario,
  CHAVE_ARMAZENAMENTO_CENARIO,
} from '../../armazenamento/cenario';
import { CHAVE_ARMAZENAMENTO_PREFERENCIAS } from '../../armazenamento/preferencias';
import { Simulacao } from './Simulacao';

const PALETA = {
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
    nome: 'São Paulo FC',
    nomeCurto: 'São Paulo',
    sigla: 'SPA',
    corBase: '#E30613',
    paleta: PALETA,
  },
  {
    id: 'palmeiras',
    nome: 'Sociedade Esportiva Palmeiras',
    nomeCurto: 'Palmeiras',
    sigla: 'PAL',
    corBase: '#006437',
    paleta: PALETA,
  },
  {
    id: 'fluminense',
    nome: 'Fluminense FC',
    nomeCurto: 'Fluminense',
    sigla: 'FLU',
    corBase: '#7A1E30',
    paleta: PALETA,
  },
  {
    id: 'gremio',
    nome: 'Grêmio FBPA',
    nomeCurto: 'Grêmio',
    sigla: 'GRE',
    corBase: '#0D80B7',
    paleta: PALETA,
  },
];

function competicao() {
  return {
    id: 'brasileirao-serie-a',
    nome: 'Brasileirão Série A',
    temporada: 2026,
    formato: 'pontos-corridos' as const,
    janela: { inicio: '2026-04-01', fim: '2026-12-06' },
    provedor: 'football-data-org',
    ultimaAtualizacao: '2026-09-05T10:00:00-03:00',
  };
}

// p1 — não confronto direto (Fluminense não é comparado): São Paulo fora.
const PARTIDA_SIMPLES = {
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

// p2 — confronto direto: Palmeiras (mandante) x São Paulo (visitante), os
// dois comparados (CA-11.4).
const PARTIDA_CONFRONTO_DIRETO = {
  id: 'p2',
  competicaoId: 'brasileirao-serie-a',
  rodada: 27,
  fase: null,
  mandanteId: 'palmeiras',
  visitanteId: 'sao-paulo',
  dataHora: '2026-10-03T16:00:00-03:00',
  horarioDefinido: true,
  estadio: 'Allianz Parque',
  status: 'agendada' as const,
  placar: null,
};

// p3 — já finalizada, tinha palpite registrado (CA-11.6): trava e sinaliza.
const PARTIDA_TRAVADA = {
  id: 'p3',
  competicaoId: 'brasileirao-serie-a',
  rodada: 20,
  fase: null,
  mandanteId: 'sao-paulo',
  visitanteId: 'gremio',
  dataHora: '2026-08-20T20:00:00-03:00',
  horarioDefinido: true,
  estadio: 'Morumbi',
  status: 'finalizada' as const,
  placar: { mandante: 2, visitante: 0 },
};

// p4 — irrelevante (nenhum clube comparado envolvido): nunca deve aparecer.
const PARTIDA_IRRELEVANTE = {
  id: 'p4',
  competicaoId: 'brasileirao-serie-a',
  rodada: 24,
  fase: null,
  mandanteId: 'gremio',
  visitanteId: 'fluminense',
  dataHora: '2026-09-13T18:30:00-03:00',
  horarioDefinido: true,
  estadio: null,
  status: 'agendada' as const,
  placar: null,
};

function linhaClassificacao(clubeId: string, pontos: number, posicao: number) {
  return {
    competicaoId: 'brasileirao-serie-a',
    grupo: null,
    posicao,
    clubeId,
    pontos,
    jogos: 24,
    v: Math.floor(pontos / 3),
    e: 0,
    d: 24 - Math.floor(pontos / 3),
    gp: 30,
    gc: 20,
    sg: 10,
    aproveitamento: (pontos / (24 * 3)) * 100,
    ultimosCinco: [],
  };
}

// UI-T09-02: pontuação atual (ponto de partida do motor) — São Paulo 42,
// Palmeiras 45, Grêmio 30.
const CLASSIFICACAO_FIXTURE = [
  linhaClassificacao('palmeiras', 45, 1),
  linhaClassificacao('sao-paulo', 42, 2),
  linhaClassificacao('gremio', 30, 10),
];

const BRASILEIRAO_FIXTURE = {
  competicao: competicao(),
  classificacao: CLASSIFICACAO_FIXTURE,
  partidas: [
    PARTIDA_SIMPLES,
    PARTIDA_CONFRONTO_DIRETO,
    PARTIDA_TRAVADA,
    PARTIDA_IRRELEVANTE,
  ],
  zonas: [],
};

// UI-T09-02 (CA-11.8): nenhuma partida restante relevante — usada para o
// estado "campeonato encerrado".
const BRASILEIRAO_FIXTURE_SEM_JOGOS_RESTANTES = {
  competicao: competicao(),
  classificacao: CLASSIFICACAO_FIXTURE,
  partidas: [],
  zonas: [],
};

const ESCOPO = construirEscopoCenario(2026, 'sao-paulo', ['palmeiras']);

function criarArmazenamentoFalso(inicial: Record<string, string> = {}): Storage {
  const dados = new Map<string, string>(Object.entries(inicial));
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => {
      dados.set(chave, valor);
    },
    removeItem: (chave: string) => {
      dados.delete(chave);
    },
    clear: () => dados.clear(),
    key: (indice: number) => Array.from(dados.keys())[indice] ?? null,
    get length() {
      return dados.size;
    },
  };
}

function armazenamentoComPreferencias(opcoes: {
  timeId: string | null;
  rivais?: string[];
  cenario?: unknown;
  indisponivel?: boolean;
}): Storage {
  const inicial: Record<string, string> = {
    [CHAVE_ARMAZENAMENTO_PREFERENCIAS]: JSON.stringify({
      versaoEsquema: 1,
      temporada: 2026,
      favoritos: [],
      fontesBloqueadas: [],
      timeId: opcoes.timeId,
      rivais: opcoes.rivais ?? [],
      atualizadoEm: '2026-09-05T10:00:00-03:00',
    }),
  };
  if (opcoes.cenario !== undefined) {
    inicial[CHAVE_ARMAZENAMENTO_CENARIO] = JSON.stringify(opcoes.cenario);
  }
  const base = criarArmazenamentoFalso(inicial);
  if (opcoes.indisponivel) {
    return {
      ...base,
      setItem: () => {
        throw new Error('indisponível');
      },
    };
  }
  return base;
}

function criarClienteSnapshotFake(
  opcoes: { erro?: boolean; fixture?: unknown } = {},
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
    if (chave === URL_FUTEBOL_BRASILEIRAO) {
      if (opcoes.erro) {
        return { ok: false, status: 500, json: async () => ({}) } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => opcoes.fixture ?? BRASILEIRAO_FIXTURE,
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
  armazenamento: Storage;
  clienteSnapshot?: ClienteSnapshot;
}): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/simulacao']}>
      <Routes>
        <Route
          path="/simulacao"
          element={
            <Simulacao
              armazenamento={props.armazenamento}
              opcoesClubesPublicos={{ buscar: buscarClubesFake() }}
              clienteSnapshot={props.clienteSnapshot ?? criarClienteSnapshotFake()}
            />
          }
        />
        <Route path="/comparativo" element={<p>COMPARATIVO_OK</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Simulacao (UI-T09-01 — UX-SPEC T-09)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    resetarCacheClubesPublicosParaTeste();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sem time salvo: mostra estado vazio, sem buscar dados', async () => {
    renderizar({ armazenamento: armazenamentoComPreferencias({ timeId: null }) });
    expect(
      screen.getByText('Escolha seu time para simular a disputa com seus rivais.'),
    ).not.toBeNull();
  });

  it('carregando: mostra esqueleto antes dos dados chegarem', () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias({
        timeId: 'sao-paulo',
        rivais: ['palmeiras'],
      }),
    });
    expect(screen.getAllByRole('status', { name: 'Carregando' }).length).toBeGreaterThan(
      0,
    );
  });

  it('erro ao carregar: mostra estado vazio com ação de tentar de novo', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias({
        timeId: 'sao-paulo',
        rivais: ['palmeiras'],
      }),
      clienteSnapshot: criarClienteSnapshotFake({ erro: true }),
    });
    await vi.waitFor(() => {
      expect(
        screen.getByText('Não conseguimos carregar o calendário restante.'),
      ).not.toBeNull();
    });
    expect(screen.getByRole('button', { name: 'TENTAR DE NOVO' })).not.toBeNull();
  });

  it('CA-11.1: exibe a grade agrupada por rodada, com as partidas restantes relevantes', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias({
        timeId: 'sao-paulo',
        rivais: ['palmeiras'],
      }),
    });

    await vi.waitFor(() => {
      expect(screen.getByText(/24ª RODADA/)).not.toBeNull();
    });

    // Partida simples (não confronto direto): legenda com mando "fora".
    expect(
      screen.getByRole('group', { name: 'São Paulo × Fluminense · fora' }),
    ).not.toBeNull();

    // Partida irrelevante (nenhum clube comparado): nunca aparece.
    expect(screen.queryByText(/Grêmio × Fluminense/)).toBeNull();
  });

  it('CA-11.4: confronto direto tem uma única linha editável, sem contradição possível', async () => {
    const armazenamento = armazenamentoComPreferencias({
      timeId: 'sao-paulo',
      rivais: ['palmeiras'],
    });
    renderizar({ armazenamento });

    await vi.waitFor(() => {
      expect(screen.getByText(/27ª RODADA/)).not.toBeNull();
    });

    // REFAT-11-01: a matriz de desktop (`matriz-desktop`, sempre no DOM,
    // escondida por `hidden` fora de ≥900px) repete o mesmo rótulo "CONFRONTO
    // DIRETO" numa segunda ocorrência (variante `espelhado`) — a busca abaixo
    // é escopada à lista mobile (`grade-lista`) para continuar única; a
    // asserção em si é a mesma de antes desta tarefa.
    const gradeLista = screen.getByTestId('grade-lista');
    expect(within(gradeLista).getByText(/CONFRONTO DIRETO/)).not.toBeNull();
    // Só um `SeletorPalpite` (um `fieldset`/grupo) para a partida de confronto
    // direto — nunca duas instâncias (uma por clube) que pudessem divergir.
    const grupoConfronto = screen.getByRole('group', { name: /São Paulo × Palmeiras/ });
    expect(grupoConfronto).not.toBeNull();

    // São Paulo é o visitante em p2 (mandante: Palmeiras) — ao escolher
    // "Vitória" (perspectiva de São Paulo), o valor persistido (perspectiva
    // do mandante) deve ser o espelhado: "derrota" para o Palmeiras.
    fireEvent.click(within(grupoConfronto).getByRole('radio', { name: 'Vitória' }));
    vi.advanceTimersByTime(300);

    const salvo = JSON.parse(
      armazenamento.getItem(CHAVE_ARMAZENAMENTO_CENARIO) ?? '{}',
    ) as { palpites: Record<string, string> };
    expect(salvo.palpites['p2']).toBe('derrota');
  });

  it('REFAT-11-01: matriz de desktop (escondida abaixo de 900px) tem uma coluna por clube comparado, confronto direto espelhado e barras de acumulado', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias({
        timeId: 'sao-paulo',
        rivais: ['palmeiras'],
      }),
    });

    await vi.waitFor(() => {
      expect(screen.getByText(/27ª RODADA/)).not.toBeNull();
    });

    const matriz = screen.getByTestId('matriz-desktop');
    // Abaixo de 900px, a matriz fica fora da árvore de acessibilidade —
    // `grade-lista` continua sendo a única grade visível (critério de
    // aceite: "abaixo de 900px a lista atual permanece inalterada").
    expect(matriz).toHaveProperty('hidden', true);

    // Cabeçalho: uma coluna por clube comparado (São Paulo + Palmeiras).
    expect(within(matriz).getByText('SÃO PAULO')).not.toBeNull();
    expect(within(matriz).getByText('PALMEIRAS')).not.toBeNull();

    // Confronto direto (p2): a matriz mostra as DUAS ocorrências — uma
    // editável (coluna de referência) e uma espelhada somente leitura
    // (coluna do outro clube comparado). Cada coluna rotula a legenda pelo
    // adversário (mesmo padrão do wireframe desktop), então as duas
    // ocorrências de "p2" são identificadas pelo `name` do grupo de rádio
    // (`palpite-p2::matriz::<clube>`), não por um texto combinado.
    const gruposConfronto = Array.from(matriz.querySelectorAll('fieldset')).filter(
      (fieldset) =>
        fieldset
          .querySelector('input')
          ?.getAttribute('name')
          ?.startsWith('palpite-p2::matriz::'),
    );
    expect(gruposConfronto).toHaveLength(2);
    const radiosDesabilitados = gruposConfronto.filter(
      (grupo) =>
        grupo.querySelector('input[type="radio"]')?.hasAttribute('disabled') === true,
    );
    const radiosEditaveis = gruposConfronto.filter(
      (grupo) =>
        grupo.querySelector('input[type="radio"]')?.hasAttribute('disabled') === false,
    );
    // Exatamente uma editável e uma espelhada (somente leitura) — nunca as
    // duas editáveis (o que reabriria a contradição de CA-11.4).
    expect(radiosDesabilitados).toHaveLength(1);
    expect(radiosEditaveis).toHaveLength(1);

    // Barras de acumulado por clube comparado (UI-DS-06/`BarraPontuacao`).
    const trilhosAcumulado = matriz.querySelectorAll(
      '[data-testid="barra-pontuacao-trilho"]',
    );
    expect(trilhosAcumulado.length).toBe(2);
  });

  it('CA-11.6: partida com resultado real ingerido trava e sinaliza (aria-live)', async () => {
    const armazenamento = armazenamentoComPreferencias({
      timeId: 'sao-paulo',
      rivais: ['palmeiras'],
      cenario: {
        versaoEsquema: 1,
        escopo: ESCOPO,
        palpites: { p3: 'vitoria' },
        partidasTravadasVistas: [],
      },
    });
    renderizar({ armazenamento });

    // REFAT-11-01: a matriz de desktop também mostra "DISPUTADA" para a
    // mesma partida travada (`estilos['matrizCelula']`) — escopado à lista
    // mobile pelo mesmo motivo da asserção de "CONFRONTO DIRETO" acima.
    await vi.waitFor(() => {
      expect(
        within(screen.getByTestId('grade-lista')).getByText(/DISPUTADA/),
      ).not.toBeNull();
    });

    // Sem rádio para a partida travada (RN-14/CA-11.6: não editável).
    const grupoTravado = screen.getByRole('group', { name: /São Paulo × Grêmio/ });
    expect(grupoTravado.querySelectorAll('input[type="radio"]').length).toBe(0);

    // Anúncio do aria-live também depende do mesmo efeito assíncrono das
    // asserções vizinhas (persistência de `partidasTravadasVistas`) — sob
    // carga (suíte inteira em paralelo) pode não ter renderizado ainda no
    // instante síncrono, daí o `waitFor` (mesmo padrão das duas asserções ao
    // redor, corrigindo flakiness reportado na revisão).
    await vi.waitFor(() => {
      expect(
        screen.getByText('1 palpite virou resultado real e foi travado.'),
      ).not.toBeNull();
    });

    // Persiste imediatamente `partidasTravadasVistas` (não reanuncia depois).
    await vi.waitFor(() => {
      const salvo = JSON.parse(
        armazenamento.getItem(CHAVE_ARMAZENAMENTO_CENARIO) ?? '{}',
      ) as { partidasTravadasVistas: string[] };
      expect(salvo.partidasTravadasVistas).toContain('p3');
    });

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(
      screen.queryByText('1 palpite virou resultado real e foi travado.'),
    ).toBeNull();
  });

  it('CA-11.9: armazenamento indisponível avisa que o cenário não será lembrado', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias({
        timeId: 'sao-paulo',
        rivais: ['palmeiras'],
        indisponivel: true,
      }),
    });

    await vi.waitFor(() => {
      expect(
        screen.getByText(
          'Seu navegador não está guardando dados. Você pode simular normalmente, mas o cenário não será lembrado.',
        ),
      ).not.toBeNull();
    });
  });

  it('CA-11.3 (vazio, sem palpite): bloco PROJEÇÃO mostra só o time do torcedor + CTA', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias({
        timeId: 'sao-paulo',
        rivais: ['palmeiras'],
      }),
    });

    // Sem nenhum palpite salvo: São Paulo 42 pts atuais + 2 partidas restantes
    // relevantes (p1, p2) em aberto, cada uma valendo até 3 no teto (CA-11.3).
    await vi.waitFor(() => {
      expect(
        screen.getByText(
          'São Paulo 42 pts (máx 48). Faça um palpite para ver a projeção mudar.',
        ),
      ).not.toBeNull();
    });
  });

  it('CA-11.2/CA-11.3/CA-11.10: recalcula a projeção imediatamente ao mudar um palpite', async () => {
    const armazenamento = armazenamentoComPreferencias({
      timeId: 'sao-paulo',
      rivais: ['palmeiras'],
    });
    const { container } = renderizar({ armazenamento });

    await vi.waitFor(() => {
      expect(screen.getByText(/24ª RODADA/)).not.toBeNull();
    });

    // São Paulo é visitante em p1 (Fluminense × São Paulo) — escolher
    // "Vitória" projeta +3 para São Paulo (42 → 45).
    const grupoSimples = screen.getByRole('group', {
      name: 'São Paulo × Fluminense · fora',
    });
    fireEvent.click(within(grupoSimples).getByRole('radio', { name: 'Vitória' }));

    const blocoProjecao = container.querySelector('[data-variante="projecao"]');
    expect(blocoProjecao).not.toBeNull();

    await vi.waitFor(() => {
      expect(blocoProjecao?.textContent).toContain('45 PTS');
    });
    // Palmeiras (rival) segue com a pontuação atual, sem palpite próprio.
    expect(blocoProjecao?.textContent).toContain('45 PTS'); // Palmeiras 45 (atual)
    expect(blocoProjecao?.textContent).toContain('MÁX 48');
    // CA-11.10: ordenação só entre os comparados, nunca a posição na tabela.
    expect(blocoProjecao?.textContent).toContain(
      'Projeção entre os 2 clubes comparados. Não é a posição na tabela. Partida sem palpite conta 0 ponto.',
    );
    // Desempate por vitórias projetadas (CA-11.5/ADR-010): São Paulo (1
    // vitória) fica à frente de Palmeiras (0) no empate em pontos.
    const indiceSaoPaulo = blocoProjecao?.textContent?.indexOf('SÃO PAULO') ?? -1;
    const indicePalmeiras = blocoProjecao?.textContent?.indexOf('PALMEIRAS') ?? -1;
    expect(indiceSaoPaulo).toBeGreaterThanOrEqual(0);
    expect(indicePalmeiras).toBeGreaterThan(indiceSaoPaulo);
  });

  it('CA-11.8: sem jogos restantes exibe o texto canônico com a pontuação final', async () => {
    renderizar({
      armazenamento: armazenamentoComPreferencias({
        timeId: 'sao-paulo',
        rivais: ['palmeiras'],
      }),
      clienteSnapshot: criarClienteSnapshotFake({
        fixture: BRASILEIRAO_FIXTURE_SEM_JOGOS_RESTANTES,
      }),
    });

    await vi.waitFor(() => {
      expect(
        screen.getByText(
          'Campeonato encerrado — sem jogos restantes. Pontuação final: Palmeiras 45, São Paulo 42.',
        ),
      ).not.toBeNull();
    });
  });

  it('CA-11.7: "limpar cenário" exige confirmação antes de remover os palpites', async () => {
    const armazenamento = armazenamentoComPreferencias({
      timeId: 'sao-paulo',
      rivais: ['palmeiras'],
      cenario: {
        versaoEsquema: 1,
        escopo: ESCOPO,
        palpites: { p1: 'derrota' },
        partidasTravadasVistas: [],
      },
    });
    renderizar({ armazenamento });

    await vi.waitFor(() => {
      expect(screen.getByText(/24ª RODADA/)).not.toBeNull();
    });

    const grupoSimples = screen.getByRole('group', {
      name: 'São Paulo × Fluminense · fora',
    });
    // Palpite salvo (mandante 'derrota' → perspectiva do visitante São Paulo
    // é 'vitoria') já vem selecionado.
    expect(within(grupoSimples).getByRole('radio', { name: 'Vitória' })).toHaveProperty(
      'checked',
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'LIMPAR CENÁRIO' }));

    expect(
      screen.getByText(
        'Apagar todos os palpites deste cenário? Isso não pode ser desfeito.',
      ),
    ).not.toBeNull();

    // Cancelar: nada muda.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByText(
        'Apagar todos os palpites deste cenário? Isso não pode ser desfeito.',
      ),
    ).toBeNull();
    expect(within(grupoSimples).getByRole('radio', { name: 'Vitória' })).toHaveProperty(
      'checked',
      true,
    );

    // Confirmar: remove o palpite e o cenário salvo.
    fireEvent.click(screen.getByRole('button', { name: 'LIMPAR CENÁRIO' }));
    fireEvent.click(screen.getByRole('button', { name: 'APAGAR' }));

    expect(within(grupoSimples).getByRole('radio', { name: 'Vitória' })).toHaveProperty(
      'checked',
      false,
    );
    expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_CENARIO)).toBeNull();
  });
});
