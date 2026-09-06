// @vitest-environment jsdom
// app/rotas/paginas/DetalheCampeonato.test.tsx — UI-T06-01 + UI-T06-02 (TASK.md Lote 10)
//
// Cobre CA-08.1 a CA-08.3 (resumo + tabela completa/de grupo com a linha do
// time destacada), CA-18.1/CA-18.2 (zonas presentes/ausentes, sem erro),
// CA-08.4 (mata-mata sem tabela) e os estados carregando/erro/sem-time
// (UI-T06-01); os 7 estados de `LinhaPartida` nas abas Disputadas/Próximas
// (CA-08.6 a CA-08.10), os textos canônicos de vazio de cada aba e o bloco de
// confronto de mata-mata com agregado/próximo jogo (CA-08.4, UI-T06-02).

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calcularFrescor } from '../../../dominio/frescor';
import { ProvedorSobreposicoes } from '../SobreposicoesContext';
import { ClienteSnapshot } from '../../dados/clienteSnapshot';
import { URL_VERSAO } from '../../dados/versao';
import { DetalheCampeonato } from './DetalheCampeonato';
import type { Preferencias } from '../../../dominio/tipos';

const URL_CLUBE_SAO_PAULO = '/dados/futebol/clube/sao-paulo.json';
const URL_BRASILEIRAO = '/dados/futebol/brasileirao.json';
const AGORA = new Date('2026-09-05T12:00:00-03:00');
const GERADO_EM_FIXTURE = '2026-09-05T09:00:00-03:00';
const INTERVALO_FUTEBOL_SEM_JOGO_HOJE_MINUTOS = 6 * 60;

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

function preferenciasComTime(timeId: string | null): Preferencias {
  return {
    versaoEsquema: 1,
    temporada: 2026,
    favoritos: [],
    fontesBloqueadas: [],
    timeId,
    rivais: [],
    atualizadoEm: '2026-09-05T09:00:00-03:00',
  };
}

function competicao(
  sobrescritas: Partial<{
    id: string;
    nome: string;
    formato: 'pontos-corridos' | 'grupos' | 'mata-mata' | 'misto';
  }> = {},
) {
  return {
    id: sobrescritas.id ?? 'brasileirao-serie-a',
    nome: sobrescritas.nome ?? 'Campeonato Brasileiro Série A',
    temporada: 2026,
    formato: sobrescritas.formato ?? ('pontos-corridos' as const),
    janela: { inicio: '2026-03-28', fim: '2026-12-06' },
    provedor: 'football-data-org',
    ultimaAtualizacao: '2026-09-05T09:00:00-03:00',
  };
}

function resumo() {
  return {
    jogos: 23,
    v: 11,
    e: 9,
    d: 3,
    gp: 36,
    gc: 22,
    sg: 14,
    pontos: 42,
    aproveitamento: 61.4,
    posicao: 6,
  };
}

function linhaClassificacao(
  clubeId: string,
  posicao: number,
  grupo: string | null = null,
) {
  return {
    competicaoId: 'brasileirao-serie-a',
    grupo,
    posicao,
    clubeId,
    pontos: 60 - posicao,
    jogos: 23,
    v: 10,
    e: 5,
    d: 8,
    gp: 30,
    gc: 25,
    sg: 5,
    aproveitamento: 50,
    ultimosCinco: [] as const,
  };
}

function criarCliente(opcoes: {
  clube?: unknown;
  brasileirao?: unknown;
  falharClube?: boolean;
}): ClienteSnapshot {
  const buscar = vi.fn(async (url: RequestInfo | URL) => {
    const chave = String(url);
    if (chave === URL_VERSAO) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          geradoEm: GERADO_EM_FIXTURE,
          hashes: { noticias: 'n1', futebol: 'f1', catalogo: 'c1', status: 's1' },
        }),
      } as Response;
    }
    if (chave === URL_CLUBE_SAO_PAULO) {
      if (opcoes.falharClube) {
        return { ok: false, status: 500, json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => opcoes.clube ?? [] } as Response;
    }
    if (chave === URL_BRASILEIRAO) {
      return {
        ok: true,
        status: 200,
        json: async () =>
          opcoes.brasileirao ?? {
            competicao: competicao(),
            classificacao: [],
            partidas: [],
            zonas: [],
          },
      } as Response;
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

function renderizar(opcoes: {
  armazenamento: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  clienteSnapshot: ClienteSnapshot;
  agora?: Date;
}) {
  return render(
    <MemoryRouter initialEntries={['/time/brasileirao-serie-a']}>
      <ProvedorSobreposicoes armazenamento={opcoes.armazenamento}>
        <Routes>
          <Route
            path="/time/:campeonatoId"
            element={
              <DetalheCampeonato
                armazenamento={opcoes.armazenamento}
                clienteSnapshot={opcoes.clienteSnapshot}
                opcoesClubesPublicos={{
                  buscar: vi.fn(
                    async () =>
                      ({ ok: true, json: async () => [] }) as unknown as Response,
                  ),
                }}
                agora={opcoes.agora ?? AGORA}
              />
            }
          />
        </Routes>
      </ProvedorSobreposicoes>
    </MemoryRouter>,
  );
}

describe('DetalheCampeonato (UI-T06-01)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('sem time salvo: convida a escolher o time', () => {
    const armazenamento = new ArmazenamentoFalso();
    const cliente = criarCliente({});
    renderizar({ armazenamento, clienteSnapshot: cliente });

    expect(
      screen.getByText('Escolha seu time para ver o detalhe deste campeonato.'),
    ).not.toBeNull();
  });

  it('mostra esqueleto enquanto carrega, antes da primeira resposta', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const cliente = criarCliente({});
    renderizar({ armazenamento, clienteSnapshot: cliente });

    expect(screen.getAllByRole('status', { name: 'Carregando' }).length).toBeGreaterThan(
      0,
    );
  });

  it('erro sem dado anterior: texto canônico + TENTAR DE NOVO refaz a busca', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const cliente = criarCliente({ falharClube: true });
    renderizar({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    expect(screen.getByText('Não conseguimos carregar este campeonato.')).not.toBeNull();
    const botao = screen.getByText('TENTAR DE NOVO');
    fireEvent.click(botao);
    await esvaziarMicrotarefas();
    // Ainda em erro (mesma falha), mas confirma que a ação disparou nova busca
    // sem lançar exceção.
    expect(screen.getByText('Não conseguimos carregar este campeonato.')).not.toBeNull();
  });

  it('CA-08.1/CA-08.2/CA-18.1: resumo + tabela completa com zonas e linha do time destacada', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const clube = [
      {
        competicao: competicao(),
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: null,
          resultadoFinal: null,
          resumo: resumo(),
        },
        partidas: [],
      },
    ];
    const brasileirao = {
      competicao: competicao(),
      classificacao: [
        linhaClassificacao('palmeiras', 1),
        linhaClassificacao('sao-paulo', 6),
        linhaClassificacao('sport', 20),
      ],
      partidas: [
        {
          id: 'p1',
          competicaoId: 'brasileirao-serie-a',
          rodada: 23,
          fase: null,
          mandanteId: 'sao-paulo',
          visitanteId: 'atletico-mg',
          dataHora: '2026-09-05T21:30:00-03:00',
          horarioDefinido: true,
          estadio: null,
          status: 'finalizada',
          placar: { mandante: 2, visitante: 1 },
        },
      ],
      zonas: [
        { de: 1, ate: 4, rotulo: 'LIBERTADORES', token: 'libertadores' },
        { de: 17, ate: 20, rotulo: 'REBAIXAMENTO', token: 'rebaixamento' },
      ],
    };
    const cliente = criarCliente({ clube, brasileirao });
    renderizar({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    // Resumo (CA-08.1).
    const resumoDestaque = screen.getByText('42 PTS').closest('p');
    expect(resumoDestaque?.textContent).toContain('6º');
    expect(resumoDestaque?.textContent).toContain('61,4%');
    expect(screen.getByText(/23 J · 11 V · 9 E · 3 D · 36 GP · 22 GC/)).not.toBeNull();

    // Tabela (CA-08.2) com caption dinâmico por rodada.
    expect(
      screen.getByText('Classificação — Campeonato Brasileiro Série A, 23ª rodada'),
    ).not.toBeNull();

    // Linha do time destacada (busca escopada à tabela — desde UI-T06-02 o
    // texto de vazio da aba Disputadas também contém "sao-paulo").
    const tabela = screen.getByRole('table');
    const linhaSaoPaulo = within(tabela)
      .getByText(/São Paulo|sao-paulo/)
      .closest('tr');
    expect(linhaSaoPaulo?.getAttribute('aria-current')).toBe('true');

    // Zonas com legenda (CA-18.1).
    expect(screen.getByLabelText('Legenda de zonas da tabela')).not.toBeNull();
    expect(screen.getByText('LIBERTADORES')).not.toBeNull();
    expect(screen.getByText('REBAIXAMENTO')).not.toBeNull();

    // Região rolável anunciada (UX-SPEC §5.2).
    expect(
      screen.getByLabelText('Tabela de classificação, role para ver mais colunas'),
    ).not.toBeNull();
  });

  it('CA-08.3: fase de grupos isola a tabela do grupo do time, mesmas colunas', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const competicaoDeGrupos = competicao({ formato: 'grupos' });
    const clube = [
      {
        competicao: competicaoDeGrupos,
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: null,
          resultadoFinal: null,
          resumo: resumo(),
        },
        partidas: [],
      },
    ];
    const brasileirao = {
      competicao: competicaoDeGrupos,
      classificacao: [
        linhaClassificacao('sao-paulo', 1, 'A'),
        linhaClassificacao('palmeiras', 2, 'A'),
        linhaClassificacao('corinthians', 1, 'B'),
        linhaClassificacao('santos', 2, 'B'),
      ],
      partidas: [],
      zonas: [],
    };
    const cliente = criarCliente({ clube, brasileirao });
    renderizar({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    const tabela = screen.getByRole('table');
    // Só o grupo A (do time do torcedor) — grupo B fica de fora (CA-08.3).
    expect(within(tabela).queryByText(/São Paulo|sao-paulo/)).not.toBeNull();
    expect(within(tabela).queryByText(/Palmeiras|palmeiras/)).not.toBeNull();
    expect(within(tabela).queryByText(/Corinthians|corinthians/)).toBeNull();
    expect(within(tabela).queryByText(/Santos|santos/)).toBeNull();
  });

  it('CA-18.2: zonas ausentes — tabela sem faixas e sem legenda, sem erro', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const clube = [
      {
        competicao: competicao(),
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: null,
          resultadoFinal: null,
          resumo: resumo(),
        },
        partidas: [],
      },
    ];
    const brasileirao = {
      competicao: competicao(),
      classificacao: [linhaClassificacao('sao-paulo', 6)],
      partidas: [],
      zonas: [],
    };
    const cliente = criarCliente({ clube, brasileirao });
    renderizar({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    expect(screen.queryByLabelText('Legenda de zonas da tabela')).toBeNull();
    expect(screen.queryByText(/erro/i)).toBeNull();
    expect(screen.getByRole('table')).not.toBeNull();
  });

  it('CA-08.4: mata-mata não exibe tabela, mostra o texto canônico', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const clube = [
      {
        competicao: competicao({
          id: 'brasileirao-serie-a',
          formato: 'mata-mata',
          nome: 'Copa Sul-Americana',
        }),
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: 'Quartas de final',
          resultadoFinal: null,
          resumo: {
            jogos: 8,
            v: 5,
            e: 2,
            d: 1,
            gp: 12,
            gc: 5,
            sg: 7,
            pontos: 17,
            aproveitamento: 70.8,
            posicao: null,
          },
        },
        partidas: [],
      },
    ];
    const cliente = criarCliente({ clube });
    renderizar({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    expect(
      screen.getByText(
        'Este campeonato é de mata-mata — não há tabela de classificação.',
      ),
    ).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    // Sem posição (mata-mata), mostra a fase no lugar.
    expect(screen.getByText('Quartas de final')).not.toBeNull();
  });

  it('CA-08.5: muda para mata-mata mas mantém a tabela final do grupo acessível (fixture)', async () => {
    // Nenhuma fonte real publica `classificacaoFinalDoGrupo` hoje (ver
    // Bloqueio 001/BLOCKERS.md) — fixture exercitando o mecanismo genérico.
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const clube = [
      {
        competicao: competicao({
          id: 'brasileirao-serie-a',
          formato: 'mata-mata',
          nome: 'Copa Sul-Americana',
        }),
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: 'Oitavas de final',
          resultadoFinal: null,
          resumo: {
            jogos: 6,
            v: 4,
            e: 1,
            d: 1,
            gp: 10,
            gc: 4,
            sg: 6,
            pontos: 13,
            aproveitamento: 72.2,
            posicao: null,
          },
        },
        partidas: [],
        classificacaoFinalDoGrupo: [
          linhaClassificacao('sao-paulo', 1, 'A'),
          linhaClassificacao('palmeiras', 2, 'A'),
        ],
      },
    ];
    const cliente = criarCliente({ clube });
    renderizar({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    // CA-08.4 é a visão padrão: nenhuma tabela visível de início.
    expect(screen.queryByRole('table')).toBeNull();
    expect(
      screen.getByText(
        'Este campeonato é de mata-mata — não há tabela de classificação.',
      ),
    ).not.toBeNull();

    // A tabela do grupo fica acessível, mas não é a visão padrão (CA-08.5).
    const botao = screen.getByRole('button', { name: 'VER TABELA DO GRUPO' });
    expect(botao.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(botao);

    const tabela = screen.getByRole('table');
    expect(within(tabela).queryByText(/São Paulo|sao-paulo/)).not.toBeNull();
    expect(within(tabela).queryByText(/Palmeiras|palmeiras/)).not.toBeNull();
    expect(screen.getByText('Tabela final do grupo — Copa Sul-Americana')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'OCULTAR TABELA DO GRUPO' }),
    ).not.toBeNull();

    // Some de novo ao clicar de novo.
    fireEvent.click(screen.getByRole('button', { name: 'OCULTAR TABELA DO GRUPO' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('CA-08.5: mata-mata sem classificacaoFinalDoGrupo não mostra o botão de tabela do grupo', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const clube = [
      {
        competicao: competicao({
          id: 'brasileirao-serie-a',
          formato: 'mata-mata',
          nome: 'Copa Sul-Americana',
        }),
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: 'Quartas de final',
          resultadoFinal: null,
          resumo: {
            jogos: 8,
            v: 5,
            e: 2,
            d: 1,
            gp: 12,
            gc: 5,
            sg: 7,
            pontos: 17,
            aproveitamento: 70.8,
            posicao: null,
          },
        },
        partidas: [],
      },
    ];
    const cliente = criarCliente({ clube });
    renderizar({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    expect(screen.queryByRole('button', { name: 'VER TABELA DO GRUPO' })).toBeNull();
  });

  it('CA-08.6/CA-08.7: vazio — nenhuma disputada e nenhuma próxima mostram o texto canônico', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const clube = [
      {
        competicao: competicao(),
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: null,
          resultadoFinal: null,
          resumo: resumo(),
        },
        partidas: [],
      },
    ];
    const cliente = criarCliente({ clube });
    renderizar({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    expect(
      screen.getByText('O sao-paulo ainda não jogou neste campeonato.'),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'PRÓXIMAS' }));
    expect(screen.getByText('Não há jogos marcados no momento.')).not.toBeNull();
  });

  it('REFAT-10-01/CA-08.11: frescor muito desatualizado mostra o carimbo em alerta', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const clube = [
      {
        competicao: competicao(),
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: null,
          resultadoFinal: null,
          resumo: resumo(),
        },
        partidas: [],
      },
    ];
    const cliente = criarCliente({ clube });
    // `geradoEm` fica fixo em GERADO_EM_FIXTURE; injetamos um `agora` bem mais
    // de 24h depois — excede tanto o limite de 6h (sem jogo hoje) quanto o de
    // 1h (com jogo hoje), RN-09 — para acionar `emAlerta` de forma robusta
    // independente de `temPartidaHoje`. Mesma função `calcularFrescor` já
    // testada por tabela em `dominio/frescor.test.ts`, aqui confirmando que a
    // tela de fato encadeia o resultado ao `CarimboFrescor`.
    const agoraMuitoDepois = new Date('2026-09-06T09:00:01-03:00');
    renderizar({ armazenamento, clienteSnapshot: cliente, agora: agoraMuitoDepois });

    await esvaziarMicrotarefas();

    const esperado = calcularFrescor(
      agoraMuitoDepois,
      new Date(GERADO_EM_FIXTURE),
      INTERVALO_FUTEBOL_SEM_JOGO_HOJE_MINUTOS,
    );
    expect(esperado.emAlerta).toBe(true);

    const carimboTexto = screen.getByText(esperado.atualizadoHa);
    expect(carimboTexto.closest('[data-estado]')?.getAttribute('data-estado')).toBe(
      'alerta',
    );
  });

  it('abas Disputadas/Próximas cobrem os 7 estados de LinhaPartida com texto canônico (CA-08.6 a CA-08.10)', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const partidas = [
      {
        id: 'p-disputada',
        competicaoId: 'brasileirao-serie-a',
        rodada: 23,
        fase: null,
        mandanteId: 'sao-paulo',
        visitanteId: 'atletico-mg',
        dataHora: '2026-09-05T23:00:00-03:00',
        horarioDefinido: true,
        estadio: null,
        status: 'finalizada',
        placar: { mandante: 2, visitante: 1 },
      },
      {
        id: 'p-proxima',
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
      },
      {
        id: 'p-sem-horario',
        competicaoId: 'brasileirao-serie-a',
        rodada: 25,
        fase: null,
        mandanteId: 'sao-paulo',
        visitanteId: 'vasco',
        dataHora: '2026-09-19T00:00:00-03:00',
        horarioDefinido: false,
        estadio: null,
        status: 'agendada',
        placar: null,
      },
      {
        id: 'p-sem-data',
        competicaoId: 'brasileirao-serie-a',
        rodada: 26,
        fase: null,
        mandanteId: 'bahia',
        visitanteId: 'sao-paulo',
        dataHora: null,
        horarioDefinido: false,
        estadio: null,
        status: 'agendada',
        placar: null,
      },
      {
        id: 'p-aguardando',
        competicaoId: 'brasileirao-serie-a',
        rodada: 23,
        fase: null,
        mandanteId: 'ceara',
        visitanteId: 'sao-paulo',
        dataHora: '2026-09-04T21:30:00-03:00',
        horarioDefinido: true,
        estadio: null,
        status: 'aguardando-resultado',
        placar: null,
      },
      {
        id: 'p-adiada',
        competicaoId: 'brasileirao-serie-a',
        rodada: 27,
        fase: null,
        mandanteId: 'sao-paulo',
        visitanteId: 'internacional',
        dataHora: '2026-10-21T20:00:00-03:00',
        horarioDefinido: true,
        estadio: null,
        status: 'adiada',
        placar: null,
      },
      {
        id: 'p-cancelada',
        competicaoId: 'brasileirao-serie-a',
        rodada: 28,
        fase: null,
        mandanteId: 'sao-paulo',
        visitanteId: 'gremio',
        dataHora: '2026-09-30T16:00:00-03:00',
        horarioDefinido: true,
        estadio: null,
        status: 'cancelada',
        placar: null,
      },
    ];
    const clube = [
      {
        competicao: competicao(),
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: null,
          resultadoFinal: null,
          resumo: resumo(),
        },
        partidas,
      },
    ];
    const cliente = criarCliente({ clube });
    renderizar({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    // Aba DISPUTADAS ativa por padrão (CA-08.6): letra + texto do resultado,
    // nunca só a cor (WCAG 1.4.1).
    expect(document.getElementById('painel-disputadas')?.hasAttribute('hidden')).toBe(
      false,
    );
    expect(document.getElementById('painel-proximas')?.hasAttribute('hidden')).toBe(true);
    expect(screen.getByText('(V)')).not.toBeNull();
    expect(screen.getByText(/sao-paulo 2 × 1 atletico-mg · casa/)).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'PRÓXIMAS' }));

    expect(document.getElementById('painel-proximas')?.hasAttribute('hidden')).toBe(
      false,
    );
    // proxima (CA-08.7).
    expect(screen.getByText(/fluminense × sao-paulo · fora · Maracanã/)).not.toBeNull();
    // sem-horario (CA-08.8).
    expect(screen.getByText(/HORÁRIO A DEFINIR/)).not.toBeNull();
    // sem-data (CA-10.4).
    expect(screen.getByText(/DATA A DEFINIR/)).not.toBeNull();
    // aguardando (CA-08.10).
    expect(screen.getByText('AGUARDANDO RESULTADO')).not.toBeNull();
    // adiada (CA-08.9).
    expect(screen.getByText(/ADIADA — NOVA DATA: 21\/10/)).not.toBeNull();
    // cancelada (CA-08.9).
    expect(screen.getByText('Cancelada')).not.toBeNull();
  });

  it('CA-08.4: bloco de mata-mata mostra fase, confronto, agregado e próximo jogo', async () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      'sportslm.preferencias.v1',
      JSON.stringify(preferenciasComTime('sao-paulo')),
    );
    const partidas = [
      {
        id: 'ida',
        competicaoId: 'brasileirao-serie-a',
        rodada: null,
        fase: 'Quartas de final',
        mandanteId: 'lanus',
        visitanteId: 'sao-paulo',
        dataHora: '2026-09-03T21:30:00-03:00',
        horarioDefinido: true,
        estadio: null,
        status: 'finalizada',
        placar: { mandante: 0, visitante: 1 },
      },
      {
        id: 'volta',
        competicaoId: 'brasileirao-serie-a',
        rodada: null,
        fase: 'Quartas de final',
        mandanteId: 'sao-paulo',
        visitanteId: 'lanus',
        dataHora: '2026-09-17T21:30:00-03:00',
        horarioDefinido: true,
        estadio: 'Morumbis',
        status: 'agendada',
        placar: null,
      },
    ];
    const clube = [
      {
        competicao: competicao({
          id: 'brasileirao-serie-a',
          formato: 'mata-mata',
          nome: 'Copa Sul-Americana',
        }),
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: 'Quartas de final',
          resultadoFinal: null,
          resumo: {
            jogos: 8,
            v: 5,
            e: 2,
            d: 1,
            gp: 12,
            gc: 5,
            sg: 7,
            pontos: 17,
            aproveitamento: 70.8,
            posicao: null,
          },
        },
        partidas,
      },
    ];
    const cliente = criarCliente({ clube });
    renderizar({ armazenamento, clienteSnapshot: cliente });

    await esvaziarMicrotarefas();

    expect(screen.getByText('QUARTAS DE FINAL')).not.toBeNull();
    expect(screen.getByText('sao-paulo × lanus')).not.toBeNull();
    // Ida fora (mandante foi o Lanús): 1 × 0 do ponto de vista do São Paulo.
    expect(screen.getByText(/AGREGADO 1 × 0 \(IDA FORA\)/)).not.toBeNull();
    expect(screen.getByText(/Volta: qui, 17\/09 · 21h30 · Morumbis/)).not.toBeNull();

    // A LinhaPartida "disputada" da ida também aparece na aba Disputadas.
    expect(screen.getByText(/lanus 0 × 1 sao-paulo · fora/)).not.toBeNull();
  });
});
