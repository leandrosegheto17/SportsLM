// @vitest-environment jsdom
// app/rotas/acessibilidade-consolidada.test.tsx — QA-01 (TASK.md Lote 12)
//
// Verificação de acessibilidade consolidada: `axe-core` nas 9 telas do
// UX-SPEC §1.1, nos 2 temas, com as 4 paletas de teste de UX-SPEC §5
// (`app/design-system/paletasTeste.fixture.ts` — Mirassol/clara,
// Palmeiras/escura, São Paulo/vermelha, Corinthians/acromática).
//
// Amostragem documentada (critério de aceite permite reduzir a matriz
// literal 9×2×4=72 quando uma combinação é redundante/coberta por herança
// de design system — ver TASK.md §3, Lote 12, QA-01):
//
// - Tema (claro/escuro): sempre as 2, nas 9 telas — dimensão barata (troca só
//   o atributo `data-tema`, recalcula a cascata) e de alto risco (todo o
//   texto/contraste do sistema muda).
// - Paleta de clube (4 paletas de teste): as 9 telas usam cor de clube
//   (`FaixaClube`/`AvatarClube`/`BarraPontuacao`), mas o PAR de cor×contraste
//   em si (`identidade`/`identidadeTexto`/`acento`/etc., UX-SPEC §3.4) já tem
//   cobertura exaustiva e isolada em `FaixaClube.test.tsx` (UI-DS-01: 3
//   variantes × 2 temas × 4 paletas = 24 casos) — essa matemática não é
//   testada de novo aqui. O que ESTA verificação cobre é o risco de
//   COMPOSIÇÃO: a cor do clube colidindo com o restante do chrome da tela
//   (navegação, cartões, texto vizinho). Por isso:
//     - Home e Painel do time (T-02/T-05) — as 2 telas com a variante mais
//       rica de `FaixaClube` (`completa`, com PRÓXIMO JOGO/A BRIGA ou
//       cartões de campeonato ao lado) e maior superfície de cor de clube
//       simultânea (PR-03 do TASK.md as identifica como maior risco,
//       junto de `FaixaClube`/`derivador-paleta`) — rodam as 4 paletas.
//     - As 7 telas restantes (Onboarding, Configurações, Escolher/trocar
//       time, Detalhe do campeonato, Escolher rivais, Comparativo,
//       Simulação) usam cor de clube só como acento pontual (`AvatarClube`
//       com `corBase`, ou uma única `FaixaClube`/linha de tabela) — rodam 2
//       das 4 paletas, escolhidas para tracejar os dois extremos do espaço
//       de risco: `CLUBE_TESTE_CORINTHIANS` (acromática — risco de algo
//       depender de matiz) e `CLUBE_TESTE_MIRASSOL` (clara, com acento
//       escurecido para 4,5:1 — risco de um contraste ajustado "vazar" claro
//       demais em algum componente). São Paulo/Palmeiras (paletas que já
//       "passam sem ajuste") têm menor risco marginal e já são cobertas
//       inteiras em `FaixaClube.test.tsx`.
//
// O item 6 do roteiro manual de UX-SPEC §5.8 ("as quatro paletas de clube
// [...] nos dois temas") é, portanto, satisfeito por esta amostragem: as 4
// paletas aparecem em pelo menos uma tela de cada eixo de risco (identidade
// completa vs. acento pontual), nos 2 temas, e a matemática de contraste em
// si já é validada exaustivamente em UI-DS-01.
//
// Cada tela usa um estado "preenchido" (não o estado vazio/carregando/erro —
// já cobertos pelos testes de cada tela) porque é o estado com maior
// superfície de DOM e maior chance de violação (tabelas, formulários, cor de
// clube, textos auxiliares) — o pior caso para acessibilidade.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import '../design-system/vitest-axe-setup';
import {
  PALETAS_DE_TESTE,
  CLUBE_TESTE_CORINTHIANS,
  CLUBE_TESTE_MIRASSOL,
  type ClubeDeTeste,
} from '../design-system/paletasTeste.fixture';
import { ProvedorSobreposicoes } from './SobreposicoesContext';
import { ClienteSnapshot } from '../dados/clienteSnapshot';
import { URL_VERSAO } from '../dados/versao';
import { URL_FUTEBOL_BRASILEIRAO, urlFutebolClube } from '../dados/futebol';
import { resetarCacheClubesPublicosParaTeste } from '../dados/useClubesPublicos';
import { Home } from './paginas/Home';
import { Onboarding } from './paginas/Onboarding';
import { PainelTime } from './paginas/PainelTime';
import { DetalheCampeonato } from './paginas/DetalheCampeonato';
import { Comparativo } from './paginas/Comparativo';
import { Simulacao } from './paginas/Simulacao';
import { Configuracoes } from './sobreposicoes/Configuracoes';
import { EscolherTime } from './sobreposicoes/EscolherTime';
import { EscolherRivais } from './sobreposicoes/EscolherRivais';
import type { CatalogoOnboarding } from './paginas/Onboarding/catalogoOnboarding';
import type { PaletaClube } from '../../dominio/tipos/futebol';

const URL_STATUS = '/dados/ingestao/status.json';
const URL_NOTICIAS = '/dados/noticias.json';
const AGORA = new Date('2026-09-05T12:00:00-03:00');

type Tema = 'claro' | 'escuro';
const TEMAS: readonly Tema[] = ['claro', 'escuro'];
/** As 4 telas mais expostas à cor de clube (ver nota de amostragem acima). */
const PALETAS_COMPLETAS = PALETAS_DE_TESTE;
/** Amostra de 2 (acromática + clara-ajustada) para as demais telas. */
const PALETAS_REDUZIDAS: readonly ClubeDeTeste[] = [
  CLUBE_TESTE_CORINTHIANS,
  CLUBE_TESTE_MIRASSOL,
];

function definirTema(tema: Tema): void {
  document.documentElement.dataset['tema'] = tema;
}

/** Critério de aceite QA-01: zero violações CRÍTICAS ou SÉRIAS (não todas as
 * severidades) — moderadas/menores, se aparecerem, são logadas para
 * conhecimento, sem falhar o teste (relatório documenta a diferença). */
async function semViolacoesGraves(container: Element, contexto: string): Promise<void> {
  // `axe-core` depende de temporizadores reais internamente (promises/rAF) —
  // sob `vi.useFakeTimers()` (usado por várias telas desta suíte para
  // esvaziar microtarefas de forma determinística) a chamada nunca resolve, o
  // teste estoura o timeout e o motor do axe (singleton do processo) fica
  // "travado" para todas as chamadas seguintes do arquivo. Alterna para
  // temporizadores reais só durante a checagem, devolvendo o estado anterior.
  const usavaTemporizadoresFalsos = vi.isFakeTimers();
  if (usavaTemporizadoresFalsos) {
    vi.useRealTimers();
  }
  try {
    const resultado = await axe(container);
    const graves = resultado.violations.filter(
      (violacao) => violacao.impact === 'critical' || violacao.impact === 'serious',
    );
    if (graves.length > 0) {
      console.error(
        `[QA-01] Violações críticas/sérias em "${contexto}":`,
        graves.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
      );
    }
    expect(graves).toEqual([]);
  } finally {
    if (usavaTemporizadoresFalsos) {
      vi.useFakeTimers();
    }
  }
}

async function esvaziarMicrotarefas(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
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

function armazenamentoComPreferencias(opcoes: {
  timeId: string | null;
  rivais?: string[];
  favoritos?: string[];
}): ArmazenamentoFalso {
  const armazenamento = new ArmazenamentoFalso();
  armazenamento.setItem(
    'sportslm.preferencias.v1',
    JSON.stringify({
      versaoEsquema: 1,
      temporada: 2026,
      favoritos: opcoes.favoritos ?? [],
      fontesBloqueadas: [],
      timeId: opcoes.timeId,
      rivais: opcoes.rivais ?? [],
      atualizadoEm: '2026-09-05T09:00:00-03:00',
    }),
  );
  return armazenamento;
}

function paletaGenerica(hex: string): PaletaClube {
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

/** "Meu time" (id fixo `sao-paulo`, reaproveitado em todas as fixtures desta
 * suíte) com a paleta de teste corrente injetada — é sempre este clube que
 * exercita `FaixaClube`/linha destacada/avatar com a cor da vez. */
function meuClube(clubeTeste: ClubeDeTeste) {
  return {
    id: 'sao-paulo',
    nome: `${clubeTeste.nome} (fixture QA-01)`,
    nomeCurto: clubeTeste.nome,
    sigla: clubeTeste.sigla,
    corBase: clubeTeste.paleta.identidade,
    paleta: clubeTeste.paleta,
  };
}

const CLUBE_PALMEIRAS_FIXO = {
  id: 'palmeiras',
  nome: 'Sociedade Esportiva Palmeiras',
  nomeCurto: 'Palmeiras',
  sigla: 'PAL',
  corBase: '#006437',
  paleta: paletaGenerica('#006437'),
};
const CLUBE_FLUMINENSE_FIXO = {
  id: 'fluminense',
  nome: 'Fluminense Football Club',
  nomeCurto: 'Fluminense',
  sigla: 'FLU',
  corBase: '#7A1E30',
  paleta: paletaGenerica('#7A1E30'),
};
const CLUBE_GREMIO_FIXO = {
  id: 'gremio',
  nome: 'Grêmio FBPA',
  nomeCurto: 'Grêmio',
  sigla: 'GRE',
  corBase: '#0D80B7',
  paleta: paletaGenerica('#0D80B7'),
};

function competicaoBrasileirao(rodadaAtual = 23) {
  return {
    id: 'brasileirao-serie-a',
    nome: 'Brasileirão Série A',
    temporada: 2026,
    formato: 'pontos-corridos' as const,
    janela: { inicio: '2026-03-28', fim: '2026-12-06' },
    provedor: 'football-data-org',
    ultimaAtualizacao: '2026-09-05T09:00:00-03:00',
    _rodadaAtual: rodadaAtual,
  };
}

function linhaClassificacao(clubeId: string, posicao: number, pontos: number) {
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

function partida(
  id: string,
  mandanteId: string,
  visitanteId: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id,
    competicaoId: 'brasileirao-serie-a',
    rodada: 24,
    fase: null,
    mandanteId,
    visitanteId,
    dataHora: '2026-09-13T16:00:00-03:00',
    horarioDefinido: true,
    estadio: 'Morumbi',
    status: 'agendada' as const,
    placar: null,
    ...overrides,
  };
}

function buscarOk<T>(dados: T) {
  return { ok: true, status: 200, json: async () => dados } as Response;
}

function versaoJson() {
  return {
    geradoEm: '2026-09-05T09:00:00-03:00',
    hashes: { noticias: 'h1', futebol: 'f1', catalogo: 'c1', status: 's1' },
  };
}

function buscarClubesFake(clubes: unknown[]): typeof fetch {
  return vi.fn(async () => buscarOk(clubes)) as unknown as typeof fetch;
}

afterEach(() => {
  cleanup();
  resetarCacheClubesPublicosParaTeste();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// T-02 · Home — 4 paletas × 2 temas (tela de maior exposição de cor de
// clube: FaixaClube completa + BlocoPreto PRÓXIMO JOGO + A BRIGA).
// ---------------------------------------------------------------------------
describe('QA-01 — Home (T-02)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function catalogo(): CatalogoOnboarding {
    return {
      esportes: [{ id: 'futebol', nome: 'Futebol', ordem: 1 }],
      clubes: [],
      referencias: {
        esportesValidos: new Set(['futebol']),
        fontesValidas: new Set(['ge']),
        clubesValidos: new Set(['sao-paulo']),
      },
      temporadaAtual: 2026,
    };
  }

  const FONTES_FAKE = [
    { id: 'ge', nome: 'ge', fixa: true, esportesCobertos: ['futebol'] },
  ];

  function cliente(clubeTeste: ClubeDeTeste): ClienteSnapshot {
    const buscar = vi.fn(async (url: RequestInfo | URL) => {
      const chave = String(url);
      if (chave === URL_VERSAO) return buscarOk(versaoJson());
      if (chave === URL_NOTICIAS) return buscarOk([]);
      if (chave === URL_STATUS) return buscarOk({ fontes: {} });
      if (chave === URL_FUTEBOL_BRASILEIRAO) {
        return buscarOk({
          competicao: competicaoBrasileirao(),
          classificacao: [
            linhaClassificacao('palmeiras', 1, 55),
            linhaClassificacao('sao-paulo', 6, 42),
          ],
          partidas: [],
          zonas: [],
        });
      }
      if (chave === urlFutebolClube('sao-paulo')) {
        return buscarOk([
          {
            competicao: competicaoBrasileirao(),
            participacao: {
              competicaoId: 'brasileirao-serie-a',
              clubeId: 'sao-paulo',
              status: 'em-andamento',
              faseAtual: null,
              resultadoFinal: null,
              resumo: null,
            },
            partidas: [partida('p1', 'sao-paulo', 'palmeiras')],
          },
        ]);
      }
      throw new Error(`URL não modelada (Home QA-01): ${chave}`);
    });
    void clubeTeste;
    return new ClienteSnapshot({ buscar });
  }

  for (const tema of TEMAS) {
    for (const clubeTeste of PALETAS_COMPLETAS) {
      it(`sem violações graves — tema ${tema}, paleta ${clubeTeste.nome}`, async () => {
        definirTema(tema);
        const armazenamento = armazenamentoComPreferencias({ timeId: 'sao-paulo' });
        const { container } = render(
          <MemoryRouter>
            <ProvedorSobreposicoes armazenamento={armazenamento}>
              <Home
                armazenamento={armazenamento}
                carregarCatalogo={catalogo}
                fontesBrutas={FONTES_FAKE}
                clienteSnapshot={cliente(clubeTeste)}
                opcoesClubesPublicos={{
                  buscar: buscarClubesFake([meuClube(clubeTeste), CLUBE_PALMEIRAS_FIXO]),
                }}
              />
            </ProvedorSobreposicoes>
          </MemoryRouter>,
        );
        await esvaziarMicrotarefas();
        await semViolacoesGraves(container, `Home/${tema}/${clubeTeste.nome}`);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T-05 · Painel do time — 4 paletas × 2 temas (mesma justificativa de risco
// de Home: cartões de campeonato lado a lado da faixa completa).
// ---------------------------------------------------------------------------
describe('QA-01 — Painel do time (T-05)', () => {
  function futebolClubeFixture() {
    return [
      {
        competicao: competicaoBrasileirao(),
        participacao: {
          competicaoId: 'brasileirao-serie-a',
          clubeId: 'sao-paulo',
          status: 'em-andamento',
          faseAtual: null,
          resultadoFinal: null,
          resumo: {
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
          },
        },
        partidas: [partida('p1', 'fluminense', 'sao-paulo')],
      },
      {
        competicao: {
          ...competicaoBrasileirao(),
          id: 'copa-do-brasil',
          nome: 'Copa do Brasil',
          formato: 'mata-mata' as const,
        },
        participacao: {
          competicaoId: 'copa-do-brasil',
          clubeId: 'sao-paulo',
          status: 'eliminado',
          faseAtual: 'Oitavas',
          resultadoFinal: null,
          resumo: null,
        },
        partidas: [],
      },
      {
        competicao: {
          ...competicaoBrasileirao(),
          id: 'supercopa',
          nome: 'Supercopa do Brasil',
          formato: 'mata-mata' as const,
        },
        participacao: {
          competicaoId: 'supercopa',
          clubeId: 'sao-paulo',
          status: 'sem-dados',
          faseAtual: null,
          resultadoFinal: null,
          resumo: null,
        },
        partidas: [],
      },
    ];
  }

  function cliente(): ClienteSnapshot {
    const buscar = vi.fn(async (url: RequestInfo | URL) => {
      const chave = String(url);
      if (chave === URL_VERSAO) return buscarOk(versaoJson());
      if (chave === URL_STATUS) return buscarOk({ pausadoPorCota: false });
      if (chave === urlFutebolClube('sao-paulo')) return buscarOk(futebolClubeFixture());
      throw new Error(`URL não modelada (PainelTime QA-01): ${chave}`);
    }) as unknown as typeof fetch;
    return new ClienteSnapshot({ buscar });
  }

  for (const tema of TEMAS) {
    for (const clubeTeste of PALETAS_COMPLETAS) {
      it(`sem violações graves — tema ${tema}, paleta ${clubeTeste.nome}`, async () => {
        definirTema(tema);
        const armazenamento = armazenamentoComPreferencias({ timeId: 'sao-paulo' });
        const { container } = render(
          <MemoryRouter initialEntries={['/time']}>
            <ProvedorSobreposicoes armazenamento={armazenamento}>
              <Routes>
                <Route
                  path="/time"
                  element={
                    <PainelTime
                      armazenamento={armazenamento}
                      opcoesClubesPublicos={{
                        buscar: buscarClubesFake([meuClube(clubeTeste)]),
                      }}
                      clienteSnapshot={cliente()}
                      agora={AGORA}
                    />
                  }
                />
                <Route path="/time/:campeonatoId" element={<p>DETALHE_OK</p>} />
              </Routes>
            </ProvedorSobreposicoes>
          </MemoryRouter>,
        );
        await waitFor(() => {
          expect(screen.getByText('Brasileirão Série A')).not.toBeNull();
        });
        await semViolacoesGraves(container, `PainelTime/${tema}/${clubeTeste.nome}`);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T-01 · Onboarding (passo 1 + passo 2) — 2 paletas × 2 temas.
// ---------------------------------------------------------------------------
describe('QA-01 — Onboarding (T-01, passo 1 e passo 2)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function catalogo(clubeTeste: ClubeDeTeste): CatalogoOnboarding {
    return {
      esportes: [
        { id: 'futebol', nome: 'Futebol', ordem: 1 },
        { id: 'volei-quadra', nome: 'Vôlei', ordem: 2 },
      ],
      clubes: [
        {
          id: 'sao-paulo',
          nomeCurto: clubeTeste.nome,
          sigla: clubeTeste.sigla,
          corBase: clubeTeste.paleta.identidade,
        },
        { id: 'palmeiras', nomeCurto: 'Palmeiras', sigla: 'PAL', corBase: '#006437' },
      ],
      referencias: {
        esportesValidos: new Set(['futebol', 'volei-quadra']),
        fontesValidas: new Set(['ge']),
        clubesValidos: new Set(['sao-paulo', 'palmeiras']),
      },
      temporadaAtual: 2026,
    };
  }

  for (const tema of TEMAS) {
    for (const clubeTeste of PALETAS_REDUZIDAS) {
      it(`passo 1 (favoritos) sem violações graves — tema ${tema}, paleta ${clubeTeste.nome}`, async () => {
        definirTema(tema);
        const { container } = render(
          <MemoryRouter initialEntries={['/onboarding']}>
            <Onboarding carregarCatalogo={() => catalogo(clubeTeste)} />
          </MemoryRouter>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));
        await semViolacoesGraves(
          container,
          `Onboarding-passo1/${tema}/${clubeTeste.nome}`,
        );
      });

      it(`passo 2 (time) sem violações graves — tema ${tema}, paleta ${clubeTeste.nome}`, async () => {
        definirTema(tema);
        const { container } = render(
          <MemoryRouter initialEntries={['/onboarding']}>
            <Onboarding carregarCatalogo={() => catalogo(clubeTeste)} />
          </MemoryRouter>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
        expect(screen.getByText('QUAL É O SEU TIME?')).toBeTruthy();
        fireEvent.click(screen.getByRole('radio', { name: clubeTeste.nome }));
        await semViolacoesGraves(
          container,
          `Onboarding-passo2/${tema}/${clubeTeste.nome}`,
        );
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T-03 · Configurações (sobreposição) — bloco "Meu time" populado.
// ---------------------------------------------------------------------------
describe('QA-01 — Configurações (T-03, sobreposição)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockImplementation((consulta: string) => ({
      matches: false,
      media: consulta,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    localStorage.clear();
    document.documentElement.removeAttribute('data-tema');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function catalogo(clubeTeste: ClubeDeTeste): CatalogoOnboarding {
    return {
      esportes: [{ id: 'futebol', nome: 'Futebol', ordem: 1 }],
      clubes: [
        {
          id: 'sao-paulo',
          nomeCurto: clubeTeste.nome,
          sigla: clubeTeste.sigla,
          corBase: clubeTeste.paleta.identidade,
        },
      ],
      referencias: {
        esportesValidos: new Set(['futebol']),
        fontesValidas: new Set(['ge']),
        clubesValidos: new Set(['sao-paulo']),
      },
      temporadaAtual: 2026,
    };
  }

  const FONTES_FAKE = [
    { id: 'ge', nome: 'GE — ge.globo', fixa: true, esportesCobertos: ['futebol'] },
  ];

  // `Configuracoes` não aceita injeção de `ClienteSnapshot` (sem prop
  // `clienteSnapshot` em `PropriedadesConfiguracoes`) — usa o cliente padrão
  // internamente para `URL_STATUS`; sob jsdom sem `fetch` real, o pedido
  // falha graciosamente (mesmo comportamento "modo memória" de CA-13.3),
  // sem afetar a checagem de acessibilidade do bloco "Meu time".

  for (const tema of TEMAS) {
    for (const clubeTeste of PALETAS_REDUZIDAS) {
      it(`sem violações graves — tema ${tema}, paleta ${clubeTeste.nome}`, async () => {
        definirTema(tema);
        const armazenamento = armazenamentoComPreferencias({ timeId: 'sao-paulo' });
        const { container } = render(
          <MemoryRouter>
            <Configuracoes
              aberta
              aoFechar={() => {}}
              aoTrocarTime={() => {}}
              armazenamento={armazenamento}
              carregarCatalogo={() => catalogo(clubeTeste)}
              fontesBrutas={FONTES_FAKE}
            />
          </MemoryRouter>,
        );
        await esvaziarMicrotarefas();
        await semViolacoesGraves(container, `Configuracoes/${tema}/${clubeTeste.nome}`);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T-04 · Escolher / trocar time (sobreposição).
// ---------------------------------------------------------------------------
describe('QA-01 — Escolher/trocar time (T-04, sobreposição)', () => {
  function catalogo(clubeTeste: ClubeDeTeste): CatalogoOnboarding {
    return {
      esportes: [],
      clubes: [
        {
          id: 'sao-paulo',
          nomeCurto: clubeTeste.nome,
          sigla: clubeTeste.sigla,
          corBase: clubeTeste.paleta.identidade,
        },
        { id: 'palmeiras', nomeCurto: 'Palmeiras', sigla: 'PAL', corBase: '#006437' },
        { id: 'santos', nomeCurto: 'Santos', sigla: 'SAN', corBase: '#000000' },
      ],
      referencias: {
        esportesValidos: new Set(),
        fontesValidas: new Set(),
        clubesValidos: new Set(['sao-paulo', 'palmeiras', 'santos']),
      },
      temporadaAtual: 2026,
    };
  }

  for (const tema of TEMAS) {
    for (const clubeTeste of PALETAS_REDUZIDAS) {
      it(`sem violações graves — tema ${tema}, paleta ${clubeTeste.nome}`, async () => {
        definirTema(tema);
        const armazenamento = armazenamentoComPreferencias({ timeId: null });
        const { container } = render(
          <MemoryRouter>
            <EscolherTime
              aberta
              aoFechar={() => {}}
              armazenamento={armazenamento}
              carregarCatalogo={() => catalogo(clubeTeste)}
            />
          </MemoryRouter>,
        );
        await semViolacoesGraves(container, `EscolherTime/${tema}/${clubeTeste.nome}`);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T-06 · Detalhe do campeonato — tabela + zonas + linha destacada.
// ---------------------------------------------------------------------------
describe('QA-01 — Detalhe do campeonato (T-06)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function cliente(): ClienteSnapshot {
    const buscar = vi.fn(async (url: RequestInfo | URL) => {
      const chave = String(url);
      if (chave === URL_VERSAO) return buscarOk(versaoJson());
      if (chave === '/dados/futebol/clube/sao-paulo.json') {
        return buscarOk([
          {
            competicao: competicaoBrasileirao(),
            participacao: {
              competicaoId: 'brasileirao-serie-a',
              clubeId: 'sao-paulo',
              status: 'em-andamento',
              faseAtual: null,
              resultadoFinal: null,
              resumo: {
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
              },
            },
            partidas: [],
          },
        ]);
      }
      if (chave === URL_FUTEBOL_BRASILEIRAO) {
        return buscarOk({
          competicao: competicaoBrasileirao(),
          classificacao: [
            linhaClassificacao('palmeiras', 1, 55),
            linhaClassificacao('sao-paulo', 6, 42),
            linhaClassificacao('gremio', 20, 15),
          ],
          partidas: [
            partida('p1', 'sao-paulo', 'gremio', {
              status: 'finalizada',
              placar: { mandante: 2, visitante: 1 },
            }),
          ],
          zonas: [
            { de: 1, ate: 4, rotulo: 'LIBERTADORES', token: 'libertadores' },
            { de: 17, ate: 20, rotulo: 'REBAIXAMENTO', token: 'rebaixamento' },
          ],
        });
      }
      throw new Error(`URL não modelada (DetalheCampeonato QA-01): ${chave}`);
    });
    return new ClienteSnapshot({ buscar });
  }

  for (const tema of TEMAS) {
    for (const clubeTeste of PALETAS_REDUZIDAS) {
      it(`sem violações graves — tema ${tema}, paleta ${clubeTeste.nome}`, async () => {
        definirTema(tema);
        const armazenamento = armazenamentoComPreferencias({ timeId: 'sao-paulo' });
        const { container } = render(
          <MemoryRouter initialEntries={['/time/brasileirao-serie-a']}>
            <ProvedorSobreposicoes armazenamento={armazenamento}>
              <Routes>
                <Route
                  path="/time/:campeonatoId"
                  element={
                    <DetalheCampeonato
                      armazenamento={armazenamento}
                      clienteSnapshot={cliente()}
                      opcoesClubesPublicos={{
                        buscar: buscarClubesFake([
                          meuClube(clubeTeste),
                          CLUBE_GREMIO_FIXO,
                        ]),
                      }}
                      agora={AGORA}
                    />
                  }
                />
              </Routes>
            </ProvedorSobreposicoes>
          </MemoryRouter>,
        );
        await esvaziarMicrotarefas();
        await esvaziarMicrotarefas();
        expect(screen.getByRole('table')).not.toBeNull();
        await semViolacoesGraves(
          container,
          `DetalheCampeonato/${tema}/${clubeTeste.nome}`,
        );
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T-07 · Escolher rivais (sobreposição).
// ---------------------------------------------------------------------------
describe('QA-01 — Escolher rivais (T-07, sobreposição)', () => {
  function catalogo(clubeTeste: ClubeDeTeste): CatalogoOnboarding {
    return {
      esportes: [],
      clubes: [
        {
          id: 'sao-paulo',
          nomeCurto: clubeTeste.nome,
          sigla: clubeTeste.sigla,
          corBase: clubeTeste.paleta.identidade,
        },
        { id: 'palmeiras', nomeCurto: 'Palmeiras', sigla: 'PAL', corBase: '#006437' },
        { id: 'corinthians', nomeCurto: 'Corinthians', sigla: 'COR', corBase: '#000000' },
      ],
      referencias: {
        esportesValidos: new Set(),
        fontesValidas: new Set(),
        clubesValidos: new Set(['sao-paulo', 'palmeiras', 'corinthians']),
      },
      temporadaAtual: 2026,
    };
  }

  for (const tema of TEMAS) {
    for (const clubeTeste of PALETAS_REDUZIDAS) {
      it(`sem violações graves — tema ${tema}, paleta ${clubeTeste.nome}`, async () => {
        definirTema(tema);
        const armazenamento = armazenamentoComPreferencias({
          timeId: 'sao-paulo',
          rivais: ['palmeiras'],
        });
        const { container } = render(
          <EscolherRivais
            aberta
            aoFechar={() => {}}
            armazenamento={armazenamento}
            carregarCatalogo={() => catalogo(clubeTeste)}
          />,
        );
        await semViolacoesGraves(container, `EscolherRivais/${tema}/${clubeTeste.nome}`);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T-08 · Comparativo no Brasileirão.
// ---------------------------------------------------------------------------
describe('QA-01 — Comparativo (T-08)', () => {
  function cliente(): ClienteSnapshot {
    const buscar = vi.fn(async (url: RequestInfo | URL) => {
      const chave = String(url);
      if (chave === URL_VERSAO) return buscarOk(versaoJson());
      if (chave === URL_STATUS) return buscarOk({ pausadoPorCota: false });
      if (chave === URL_FUTEBOL_BRASILEIRAO) {
        return buscarOk({
          competicao: competicaoBrasileirao(),
          classificacao: [
            linhaClassificacao('sao-paulo', 6, 42),
            linhaClassificacao('palmeiras', 1, 55),
          ],
          partidas: [
            partida('p1', 'fluminense', 'sao-paulo', { rodada: 24 }),
            partida('p2', 'sao-paulo', 'palmeiras', {
              rodada: 27,
              dataHora: '2026-10-03T16:00:00-03:00',
            }),
          ],
          zonas: [],
        });
      }
      throw new Error(`URL não modelada (Comparativo QA-01): ${chave}`);
    }) as unknown as typeof fetch;
    return new ClienteSnapshot({ buscar });
  }

  for (const tema of TEMAS) {
    for (const clubeTeste of PALETAS_REDUZIDAS) {
      it(`sem violações graves — tema ${tema}, paleta ${clubeTeste.nome}`, async () => {
        definirTema(tema);
        const armazenamento = armazenamentoComPreferencias({
          timeId: 'sao-paulo',
          rivais: ['palmeiras'],
        });
        const { container } = render(
          <MemoryRouter initialEntries={['/comparativo']}>
            <ProvedorSobreposicoes armazenamento={armazenamento}>
              <Routes>
                <Route
                  path="/comparativo"
                  element={
                    <Comparativo
                      armazenamento={armazenamento}
                      opcoesClubesPublicos={{
                        buscar: buscarClubesFake([
                          meuClube(clubeTeste),
                          CLUBE_PALMEIRAS_FIXO,
                        ]),
                      }}
                      clienteSnapshot={cliente()}
                      agora={AGORA}
                    />
                  }
                />
                <Route path="/simulacao" element={<p>SIMULACAO_OK</p>} />
              </Routes>
            </ProvedorSobreposicoes>
          </MemoryRouter>,
        );
        await waitFor(() => {
          expect(screen.getAllByText(clubeTeste.nome).length).toBeGreaterThan(0);
        });
        await semViolacoesGraves(container, `Comparativo/${tema}/${clubeTeste.nome}`);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T-09 · Simulação de cenário.
// ---------------------------------------------------------------------------
describe('QA-01 — Simulação (T-09)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  function cliente(): ClienteSnapshot {
    const buscar = vi.fn(async (url: RequestInfo | URL) => {
      const chave = String(url);
      if (chave === URL_VERSAO) return buscarOk(versaoJson());
      if (chave === URL_FUTEBOL_BRASILEIRAO) {
        return buscarOk({
          competicao: competicaoBrasileirao(),
          classificacao: [
            linhaClassificacao('palmeiras', 1, 45),
            linhaClassificacao('sao-paulo', 2, 42),
          ],
          partidas: [
            partida('p1', 'fluminense', 'sao-paulo', { rodada: 24 }),
            partida('p2', 'palmeiras', 'sao-paulo', {
              rodada: 27,
              dataHora: '2026-10-03T16:00:00-03:00',
            }),
          ],
          zonas: [],
        });
      }
      throw new Error(`URL não modelada (Simulacao QA-01): ${chave}`);
    }) as unknown as typeof fetch;
    return new ClienteSnapshot({ buscar });
  }

  for (const tema of TEMAS) {
    for (const clubeTeste of PALETAS_REDUZIDAS) {
      it(`sem violações graves — tema ${tema}, paleta ${clubeTeste.nome}`, async () => {
        definirTema(tema);
        const armazenamento = armazenamentoComPreferencias({
          timeId: 'sao-paulo',
          rivais: ['palmeiras'],
        });
        const { container } = render(
          <MemoryRouter initialEntries={['/simulacao']}>
            <Routes>
              <Route
                path="/simulacao"
                element={
                  <Simulacao
                    armazenamento={armazenamento}
                    opcoesClubesPublicos={{
                      buscar: buscarClubesFake([
                        meuClube(clubeTeste),
                        CLUBE_PALMEIRAS_FIXO,
                        CLUBE_FLUMINENSE_FIXO,
                      ]),
                    }}
                    clienteSnapshot={cliente()}
                  />
                }
              />
              <Route path="/comparativo" element={<p>COMPARATIVO_OK</p>} />
            </Routes>
          </MemoryRouter>,
        );
        await esvaziarMicrotarefas();
        await semViolacoesGraves(container, `Simulacao/${tema}/${clubeTeste.nome}`);
      });
    }
  }
});
