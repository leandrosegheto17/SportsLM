// pipeline/futebol/orquestrador.ts — ING-F-05 (TASK.md Lote 5)
//
// Orquestração do Fluxo 2 — Ingestão de dados de futebol (SDD §2.4, FL-07/
// RF-16): liga ING-F-01 (`adaptador-football-data`, via ING-F-02) → ING-F-02
// (`coletor-futebol`) → ING-F-04 (`verificacao-consistencia`) → ING-F-03
// (`derivador-status`), na ordem exata do diagrama do SDD, grava
// `ultimaAtualizacao` por competição e a porção de futebol do
// `ingestao/status.json` (SDD §5.4). Este módulo faz I/O de disco (e, via
// `coletarFutebol`, de rede) — mora em `pipeline/`, não em `dominio/`
// (GUARDRAILS.md §5).
//
// Regra central deste orquestrador (SDD §2.4, CA-16.6): "inconsistente? ->
// descarta, mantém o anterior, registra". Nunca escreve um lote inconsistente
// por cima do snapshot anterior de uma competição — o mesmo vale para
// `falha`, `pausado-por-cota`, `provedor-nao-registrado` e `fora-da-janela`
// (nenhum desses tipos de resultado de `coletarFutebol` produz dado novo).
//
// Duas camadas, mesmo padrão de `pipeline/noticias/orquestrador.ts`
// (ING-N-07), para que o critério de aceite ("execução de ponta a ponta com
// provedor mockado") seja testável sem tocar disco nem rede real:
//   1. `executarFluxoFutebol` — pura o suficiente para teste: recebe
//      configuração/estado anterior já carregados e um registro de
//      provedores (injetável, nunca `fetch` direto aqui), e devolve o novo
//      estado + a porção de futebol do status, sem escrever nada em disco.
//   2. `executarIngestaoFutebolEmDisco` — wrapper de I/O: lê
//      `config/campeonatos-2026.json` e `config/clubes-2026.json`, o estado
//      anterior do disco, monta o adaptador `football-data.org` real (token
//      via variável de ambiente, nunca hardcoded — TASK.md §1, diretriz 12),
//      chama (1), grava o novo estado e mescla `ingestao/status.json` sem
//      apagar a porção de notícias (mesma disciplina de `mesclarStatus` do
//      ING-N-07).
//
// Nota de lacuna sinalizada (TASK.md §6-style, desvio pequeno — não bloqueia
// esta tarefa): `CampeonatoConfigSchema` (CFG-03) não tem um campo para o
// "código/id de competição" específico de cada provedor (ex.: `'BSA'` no
// football-data.org, ADR-006 item 4, ou o `idLigaProvedor` do TheSportsDB) —
// só guarda o id genérico do provedor (`provedor: "football-data-org"` /
// `"thesportsdb"`). Este módulo usa mapas internos por provedor
// (removidos no COB-05: `refProvedor` da config, ADR-020) só para
// o wrapper de disco; a camada pura (`executarFluxoFutebol`) não depende
// disso — quem chama já injeta o registro de provedores pronto. Sinalizado ao
// Coordenador para, se mais competições ganharem cobertura real, CFG-03
// ganhar um campo explícito em vez destes mapas locais.
//
// SPK-01 (Paulista/Carioca via TheSportsDB, decisão do usuário 2026-09-17):
// as duas competições já têm `provedor: "thesportsdb"` em CFG-03 e
// `idsProvedor.thesportsdb` mapeado nos clubes que as disputam — mas ambas
// estão fora da janela de calendário 2026 (`2026-01-14`–`2026-03-22`, já
// encerrada) no momento desta implementação. `foraDaJanela`
// (`coletor-futebol.ts`) pula a consulta ao provedor até `2027-01-14`; até
// lá, as duas aparecem como "sem dados" (mesmo comportamento de hoje) — o
// wiring fica pronto e passa a valer sozinho quando a janela de 2027 abrir,
// sem trabalho adicional. Copa do Brasil ficou fora desta rodada (mata-mata
// sem conceito de classificação; `numeroClubesEsperado`/
// `verificarConsistenciaCompeticao` não tem um caminho definido para esse
// formato ainda — próxima rodada, por decisão do usuário).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import {
  coletarFutebol,
  CUSTO_REQUISICOES_POR_COMPETICAO,
  registrarProvedor,
  type OpcoesColeta,
  type ProvedorRegistrado,
} from './coletor-futebol';
import {
  criarAdaptadorFootballData,
  type RefCompeticaoFootballData,
  type InconsistenciaClube,
} from './adaptador-football-data';
import {
  criarAdaptadorTheSportsDB,
  type RefCompeticaoTheSportsDB,
} from './adaptador-thesportsdb';
import { resolverTabelaPublicada } from './retencao-tabela';
import { mesclarPartidas } from './mesclar-partidas';
import { classificarResultadoLiga } from './classificar-resultado-liga';
import { diagnosticarParticipantes } from './participantes';
import { linhaLogLiga, montarResumoLiga, type MotivoDescarte } from './resumo-liga';
import { carregarClubesSerieA2026, type ClubeBase } from '../config/clubes';
import {
  ConfigCampeonatosSchema,
  type CampeonatoConfig,
} from '../../config/campeonatos.schema';
import {
  verificarConsistenciaCompeticao,
  derivarStatusCampeonato,
  type MotivoInconsistencia,
  type PartidaParaDerivacaoStatus,
} from '../../dominio/campeonatos';
import {
  competicaoSchema,
  linhaClassificacaoSchema,
  partidaSchema,
  participacaoClubeSchema,
  type Competicao,
  type LinhaClassificacao,
  type Partida,
  type ParticipacaoClube,
} from '../../dominio/tipos/futebol';

// --- Estado interno (SDD/ADR-002: branch órfã `dados`, `estado/futebol.json`) --

/** Estado persistido por competição, entre execuções. */
export interface CompeticaoEstado {
  readonly competicao: Competicao;
  readonly linhas: readonly LinhaClassificacao[];
  readonly partidas: readonly Partida[];
  readonly participacoes: readonly ParticipacaoClube[];
}

/** Estado interno do Fluxo 2, versionado na branch `dados` entre execuções. */
export interface EstadoFutebol {
  readonly competicoes: Record<string, CompeticaoEstado>;
}

/** Estado inicial válido (primeira execução, sem `estado/futebol.json` prévio). */
export function estadoFutebolVazio(): EstadoFutebol {
  return { competicoes: {} };
}

// --- Status (porção de futebol do `ingestao/status.json`, SDD §5.4) -----------

export type ResultadoCompeticaoStatus =
  | 'atualizada'
  | 'inconsistente'
  | 'fora-da-janela'
  | 'sem-cobertura'
  | 'provedor-nao-registrado'
  | 'pausado-por-cota'
  | 'sem-dados-provedor'
  | 'falha';

export interface StatusCompeticaoFutebol {
  readonly resultado: ResultadoCompeticaoStatus;
  /** `Competicao.ultimaAtualizacao` corrente (pode ser de uma execução
   * anterior, quando este lote foi descartado/pulado). */
  readonly ultimaAtualizacao: string | null;
  readonly motivosInconsistencia?: readonly MotivoInconsistencia[];
  readonly mensagemErro?: string;
  /** Partidas publicadas da liga (COB-20). */
  readonly partidas?: number;
  /** Requisições estimadas gastas nesta liga (custo declarado do provedor). */
  readonly requisicoes?: number;
  readonly descartes?: Record<MotivoDescarte, number>;
  /** Clubes vistos no provedor e ausentes da config (ADR-020 item 2). */
  readonly participantesNaoConfigurados?: readonly string[];
}

/**
 * Porção de futebol do `ingestao/status.json` global (SDD §5.4). A porção de
 * notícias (`fontes`, `distribuicaoClassificacao`, `gruposFormados` —
 * ING-N-07) é responsabilidade de `pipeline/noticias/orquestrador.ts`; este
 * módulo só lê/preserva essas chaves se já existirem em disco (ver
 * `mesclarStatusFutebol`), nunca as inventa nem as apaga.
 */
export interface StatusIngestaoFutebol {
  readonly geradoEm: string;
  readonly futebol: Record<string, StatusCompeticaoFutebol>;
  /** Requisições efetivamente usadas por provedor nesta execução (CA-16.1). */
  readonly provedores: Record<string, number>;
  /** `true` quando ao menos um provedor foi suspenso por cota esgotada nesta
   * execução (CA-16.4/CA-17.4) — o texto exato exibido na SPA é
   * responsabilidade de quem consome este status, não deste módulo. */
  readonly pausadoPorCota: boolean;
}

export interface ResultadoFluxoFutebol {
  readonly novoEstado: EstadoFutebol;
  readonly status: StatusIngestaoFutebol;
  /**
   * Inconsistências de clube não mapeado (CA-16.6/ADR-006 item 3) coletadas
   * em toda competição com `resultado.tipo === 'atualizada'` nesta execução —
   * de `classificacao.inconsistencias` (sempre `InconsistenciaClube[]`) e da
   * fatia `tipo === 'clube-nao-mapeado'` de `partidas.inconsistencias`
   * (superconjunto que também inclui `partida-status-desconhecido`, Bloqueio
   * 008, fora do escopo aqui).
   *
   * Bloqueio 009 (`.md/BLOCKERS.md`): antes desta mudança, essas
   * inconsistências eram computadas por `adaptador-football-data.ts` mas
   * nunca ficavam visíveis em lugar nenhum — quem chama este orquestrador
   * (`pipeline/ingestao-cli.ts`) agora loga `idProvedor`/
   * `nomeProvedorDiagnostico` de cada uma, nunca o token do provedor (que
   * nunca circula por aqui).
   */
  readonly inconsistenciasClube: readonly InconsistenciaClube[];
  /** Uma linha de log por liga processada (RNF-19), sem segredo/corpo. */
  readonly linhasLogPorLiga?: readonly string[];
}

export interface OpcoesFluxoFutebol {
  /** Competições da temporada (CFG-03) a considerar nesta execução. */
  readonly campeonatos: readonly CampeonatoConfig[];
  /** Registro de provedores disponíveis nesta execução (ING-F-02) — chave =
   * mesma string usada em `CampeonatoConfig.provedor`. */
  readonly provedores: Record<string, ProvedorRegistrado>;
  readonly estadoAnterior: EstadoFutebol;
  readonly agora: Date;
  readonly limitesPorExecucao?: Record<string, number>;
}

const JANELA_PROXIMO_JOGO_MS = 48 * 60 * 60 * 1000;
const PREFIXO_ID_EXTERNO = 'externo-';
const PROVEDOR_ACUMULA = 'thesportsdb';

/** Próximo jogo (<= 48 h) por competição, do estado anterior (RN-22/ADR-021). */
function proximoJogoDoEstado(
  estado: EstadoFutebol,
  agora: Date,
): Record<string, string | null> {
  const mapa: Record<string, string | null> = {};
  for (const [id, ce] of Object.entries(estado.competicoes)) {
    let melhor: number | null = null;
    for (const p of ce.partidas) {
      if (p.status !== 'agendada' || p.dataHora === null) continue;
      const t = new Date(p.dataHora).getTime();
      const delta = t - agora.getTime();
      if (Number.isFinite(delta) && delta >= 0 && delta <= JANELA_PROXIMO_JOGO_MS) {
        if (melhor === null || t < melhor) melhor = t;
      }
    }
    mapa[id] = melhor === null ? null : new Date(melhor).toISOString();
  }
  return mapa;
}

// --- Construção de `Competicao`/`ParticipacaoClube` a partir de um lote -------

function construirCompeticao(
  config: CampeonatoConfig,
  ultimaAtualizacao: string | null,
  tabelaParcial = false,
): Competicao {
  return {
    id: config.id,
    nome: config.nome,
    temporada: config.temporada,
    formato: config.formato,
    janela: config.janela,
    provedor: config.provedor,
    ultimaAtualizacao,
    ...(tabelaParcial ? { tabelaParcial: true } : {}),
  };
}

/** Mapeia a partida para o derivador, com adversário e lado do clube (ADR-020
 * item 7). `faseJogoUnico` fica indefinido: sem prova, não se afirma jogo único. */
export function paraDerivacao(partida: Partida, clubeId: string): PartidaParaDerivacaoStatus {
  const clubeEhMandante = partida.mandanteId === clubeId;
  return {
    adversarioId: clubeEhMandante ? partida.visitanteId : partida.mandanteId,
    clubeEhMandante,
    fase: partida.fase,
    dataHora: partida.dataHora,
    status: partida.status,
    placar: partida.placar,
  };
}

/**
 * Constrói `ParticipacaoClube[]` (SDD §5.2) para todo clube configurado na
 * competição (CA-07.2 — nenhum clube fica sem participação, mesmo sem dado
 * algum: `derivarStatusCampeonato` já cai para `nao-iniciado`/`sem-dados` com
 * `partidas: []`, ING-F-03).
 *
 * `resultadoFinal` é sempre `null` aqui — a mesma decisão de escopo registrada
 * em `derivador-status.ts` (ING-F-03): inferir "Campeão"/"Vice" a partir de
 * mandante/placar da final exigiria um palpite sobre o significado da fase,
 * o que o ADR-006 (item 6) proíbe. Fica para uma fonte de dado que exponha o
 * resultado final explicitamente, se algum dia existir (fora do escopo desta
 * tarefa e de ING-F-03).
 */
function construirParticipacoes(
  config: CampeonatoConfig,
  linhas: readonly LinhaClassificacao[],
  partidas: readonly Partida[],
  agora: Date,
): ParticipacaoClube[] {
  return config.clubes.map((clubeId) => {
    const partidasDoClube = partidas.filter(
      (p) => p.mandanteId === clubeId || p.visitanteId === clubeId,
    );
    const { status, faseAtual } = derivarStatusCampeonato({
      formato: config.formato,
      janela: config.janela,
      partidas: partidasDoClube.map((p) => paraDerivacao(p, clubeId)),
      agora,
    });
    const linha = linhas.find((l) => l.clubeId === clubeId) ?? null;

    return participacaoClubeSchema.parse({
      competicaoId: config.id,
      clubeId,
      status,
      faseAtual,
      resultadoFinal: null,
      resumo:
        linha === null
          ? null
          : {
              jogos: linha.jogos,
              v: linha.v,
              e: linha.e,
              d: linha.d,
              gp: linha.gp,
              gc: linha.gc,
              sg: linha.sg,
              pontos: linha.pontos,
              aproveitamento: linha.aproveitamento,
              posicao: linha.posicao,
            },
    } satisfies z.infer<typeof participacaoClubeSchema>);
  });
}

/** Garante que a competição exista no novo estado mesmo sem lote novo válido
 * nesta execução (CA-07.2 — nunca omite o campeonato). Usado quando ainda não
 * havia estado anterior para ela. */
function competicaoInicialSemDados(
  config: CampeonatoConfig,
  agora: Date,
): CompeticaoEstado {
  return {
    competicao: construirCompeticao(config, null),
    linhas: [],
    partidas: [],
    participacoes: construirParticipacoes(config, [], [], agora),
  };
}

/** Mensagem curta, sem corpo de resposta/stack (RNF-17). */
function mensagemCurta(erro: unknown): string {
  const m = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
  return m.replace(/s+/g, ' ').slice(0, 200);
}

/**
 * Executa o Fluxo 2 (SDD §2.4) de ponta a ponta: coleta por prioridade e cota
 * (ING-F-02, que já embute a tradução do provedor via adaptador registrado,
 * ex. ING-F-01) → verifica consistência do lote (ING-F-04) → descarta e
 * mantém o anterior se inconsistente, ou deriva `ParticipacaoClube`
 * (ING-F-03) e grava `ultimaAtualizacao` se consistente.
 *
 * Não faz I/O de disco — a rede só é tocada através do `ProvedorRegistrado`
 * injetado em `opcoes.provedores` (mesma disciplina de `coletarFutebol`).
 */
export async function executarFluxoFutebol(
  opcoes: OpcoesFluxoFutebol,
): Promise<ResultadoFluxoFutebol> {
  const opcoesColeta: OpcoesColeta = {
    campeonatos: [...opcoes.campeonatos],
    agora: opcoes.agora,
    provedores: opcoes.provedores,
    proximoJogoPorCompeticao: proximoJogoDoEstado(opcoes.estadoAnterior, opcoes.agora),
    ...(opcoes.limitesPorExecucao !== undefined
      ? { limitesPorExecucao: opcoes.limitesPorExecucao }
      : {}),
  };
  const coleta = await coletarFutebol(opcoesColeta);

  const configPorId = new Map(opcoes.campeonatos.map((c) => [c.id, c]));
  const competicoes: Record<string, CompeticaoEstado> = {
    ...opcoes.estadoAnterior.competicoes,
  };
  const statusFutebol: Record<string, StatusCompeticaoFutebol> = {};
  const inconsistenciasClube: InconsistenciaClube[] = [];
  const linhasLogPorLiga: string[] = [];

  for (const resultado of coleta.resultados) {
    const config = configPorId.get(resultado.competicaoId);
    if (config === undefined) continue; // defensivo: nunca deveria faltar

    // RNF-17/CA-20.5: excecao no processamento de UMA liga (ex.: ZodError)
    // vira `falha` so dela; estado anterior mantido, ciclo continua.
    try {
      const anterior = competicoes[resultado.competicaoId];

      if (resultado.tipo !== 'atualizada') {
        // Nenhum destes tipos produz dado novo (CA-16.1/16.3/16.4/16.5): mantém
        // o estado anterior intocado; só garante que o campeonato exista
        // (CA-07.2) quando esta é a primeira vez que o vemos.
        if (anterior === undefined) {
          competicoes[resultado.competicaoId] = competicaoInicialSemDados(
            config,
            opcoes.agora,
          );
        }
        const statusEntry: StatusCompeticaoFutebol = {
          resultado: resultado.tipo,
          ultimaAtualizacao:
            competicoes[resultado.competicaoId]?.competicao.ultimaAtualizacao ?? null,
        };
        statusFutebol[resultado.competicaoId] =
          resultado.tipo === 'falha'
            ? { ...statusEntry, mensagemErro: resultado.mensagemErro }
            : statusEntry;
        linhasLogPorLiga.push(
          linhaLogLiga({
            horario: opcoes.agora,
            liga: resultado.competicaoId,
            resultado: resultado.tipo,
            resumo: montarResumoLiga({
              partidas: 0,
              requisicoes: 0,
              foraDoRecorte: 0,
              inconsistencias: [],
            }),
          }),
        );
        continue;
      }

      // Coleta as inconsistências de clube não mapeado deste lote (Bloqueio
      // 009) independentemente de o lote acabar sendo aceito ou descartado por
      // `verificarConsistenciaCompeticao` a seguir — o diagnóstico de "qual
      // clube o provedor manda com que id" vale mesmo quando o lote como um
      // todo é inconsistente por outro motivo.
      inconsistenciasClube.push(
        ...resultado.classificacao.inconsistencias.filter(
          (i): i is InconsistenciaClube => i.tipo === 'clube-nao-mapeado',
        ),
      );
      inconsistenciasClube.push(
        ...resultado.partidas.inconsistencias.filter(
          (i): i is InconsistenciaClube => i.tipo === 'clube-nao-mapeado',
        ),
      );

      const inconsistenciasPartida = resultado.partidas.inconsistencias;
      const registroProvedor =
        config.provedor === null ? undefined : opcoes.provedores[config.provedor];
      // ADR-022: só ligas TheSportsDB acumulam partidas entre ciclos; o
      // Brasileirão (football-data) publica o lote como veio.
      const partidasLote =
        config.provedor === PROVEDOR_ACUMULA
          ? mesclarPartidas(anterior?.partidas ?? [], resultado.partidas.partidas)
          : resultado.partidas.partidas;
      const tabelaParcial = resultado.classificacao.parcial === true;
      const resumo = montarResumoLiga({
        partidas: partidasLote.length,
        requisicoes:
          registroProvedor?.adaptador.custoEstimado?.(
            registroProvedor.construirReferencia(config),
          ) ?? CUSTO_REQUISICOES_POR_COMPETICAO,
        foraDoRecorte: resultado.partidas.foraDoRecorte ?? 0,
        inconsistencias: inconsistenciasPartida,
      });
      const registrarLog = (r: string): void => {
        linhasLogPorLiga.push(
          linhaLogLiga({
            horario: opcoes.agora,
            liga: resultado.competicaoId,
            resultado: r,
            resumo,
          }),
        );
      };

      // Sem eventos nem tabela do provedor: não carimba ultimaAtualizacao.
      const classificado = classificarResultadoLiga({
        linhas: resultado.classificacao.linhas,
        partidas: resultado.partidas.partidas,
        descartes: [
          ...resultado.classificacao.inconsistencias,
          ...inconsistenciasPartida,
        ].map((i) => ({ motivo: i.tipo })),
      });
      if (classificado === 'sem-dados-provedor') {
        if (anterior === undefined) {
          competicoes[resultado.competicaoId] = competicaoInicialSemDados(
            config,
            opcoes.agora,
          );
        }
        statusFutebol[resultado.competicaoId] = {
          resultado: 'sem-dados-provedor',
          ultimaAtualizacao:
            competicoes[resultado.competicaoId]?.competicao.ultimaAtualizacao ?? null,
        };
        registrarLog('sem-dados-provedor');
        continue;
      }

      // tipo === 'atualizada': verifica consistência (ING-F-04) antes de
      // aceitar o lote (CA-16.6).
      const consistencia = verificarConsistenciaCompeticao({
        linhas: resultado.classificacao.linhas,
        partidas: partidasLote,
        formato: config.formato,
        clubesConfigurados: config.clubes,
        numeroClubesEsperado: config.clubes.length,
        inicioCompeticao: config.janela.inicio,
        ...(tabelaParcial ? { tabelaParcial: true } : {}),
      });

      if (!consistencia.consistente) {
        // Descarta o lote da competição e mantém o anterior (SDD §2.4/CA-16.6) —
        // nunca escreve por cima com dado inconsistente.
        if (anterior === undefined) {
          competicoes[resultado.competicaoId] = competicaoInicialSemDados(
            config,
            opcoes.agora,
          );
        }
        registrarLog('inconsistente');
        statusFutebol[resultado.competicaoId] = {
          resultado: 'inconsistente',
          ultimaAtualizacao:
            competicoes[resultado.competicaoId]?.competicao.ultimaAtualizacao ?? null,
          motivosInconsistencia: consistencia.motivos,
        };
        continue;
      }

      // Lote consistente: aceita, deriva status/fase por clube (ING-F-03) e
      // grava `ultimaAtualizacao` (CA-16.1).
      const ultimaAtualizacao = opcoes.agora.toISOString();
      const linhasValidadas = resolverTabelaPublicada(
        config.formato,
        resultado.classificacao.linhas,
        anterior?.linhas ?? [],
      ).map((l) => linhaClassificacaoSchema.parse(l));
      const partidasValidadas = partidasLote.map((p) =>
        partidaSchema.parse(p),
      );
      const competicao = competicaoSchema.parse(
        construirCompeticao(config, ultimaAtualizacao, tabelaParcial),
      );
      const participacoes = construirParticipacoes(
        config,
        linhasValidadas,
        partidasValidadas,
        opcoes.agora,
      );

      competicoes[resultado.competicaoId] = {
        competicao,
        linhas: linhasValidadas,
        partidas: partidasValidadas,
        participacoes,
      };
      const idsVistos = [
        ...linhasValidadas.map((l) => l.clubeId),
        ...partidasValidadas.flatMap((p) => [p.mandanteId, p.visitanteId]),
      ].filter((id) => !id.startsWith(PREFIXO_ID_EXTERNO));
      const diagnostico = diagnosticarParticipantes(idsVistos, config.clubes);
      statusFutebol[resultado.competicaoId] = {
        resultado: 'atualizada',
        ultimaAtualizacao,
        partidas: resumo.partidas,
        requisicoes: resumo.requisicoes,
        descartes: resumo.descartes,
        participantesNaoConfigurados: [...diagnostico.naoConfigurados],
      };
      registrarLog('atualizada');
    } catch (erro) {
      if (competicoes[resultado.competicaoId] === undefined) {
        competicoes[resultado.competicaoId] = competicaoInicialSemDados(
          config,
          opcoes.agora,
        );
      }
      statusFutebol[resultado.competicaoId] = {
        resultado: 'falha',
        ultimaAtualizacao:
          competicoes[resultado.competicaoId]?.competicao.ultimaAtualizacao ?? null,
        mensagemErro: mensagemCurta(erro),
      };
    }
  }

  const status: StatusIngestaoFutebol = {
    geradoEm: opcoes.agora.toISOString(),
    futebol: statusFutebol,
    provedores: coleta.requisicoesUsadas,
    pausadoPorCota: coleta.provedoresPausadosPorCota.length > 0,
  };

  return {
    novoEstado: { competicoes },
    status,
    inconsistenciasClube,
    linhasLogPorLiga,
  };
}

// ---------------------------------------------------------------------------
// Camada de I/O (leitura/gravação em disco + rede real) — wrapper fino sobre
// a função pura acima. Caminhos configuráveis por variável de ambiente/
// parâmetro (nunca hardcode de caminho de produção — mesma disciplina de
// `pipeline/noticias/orquestrador.ts`).
// ---------------------------------------------------------------------------

const RAIZ_PROJETO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Diretório do estado interno (ADR-002: branch órfã `dados`, `estado/*.json`).
 * Configurável via `SPORTSLM_DIR_ESTADO` (mesma variável de ING-N-07, para que
 * as duas orquestrações apontem para o mesmo checkout da branch `dados`). */
function dirEstado(): string {
  return process.env['SPORTSLM_DIR_ESTADO'] ?? join(RAIZ_PROJETO, 'estado');
}

/** Política de tabela do TheSportsDB derivada do formato (ADR-020 item 3). */
function politicaTabelaPorFormato(
  formato: CampeonatoConfig['formato'],
): RefCompeticaoTheSportsDB['politicaTabela'] {
  if (formato === 'mata-mata') return 'nunca';
  if (formato === 'misto') return 'tentar';
  return 'sempre';
}

/** `refProvedor` da config (ADR-020); erro claro nomeando a competição. */
function refProvedorObrigatorio(campeonato: CampeonatoConfig): {
  id: string;
  temporada?: string | undefined;
} {
  if (campeonato.refProvedor === undefined) {
    throw new Error(
      `competição "${campeonato.id}" sem "refProvedor" em config/campeonatos-2026.json (ADR-020)`,
    );
  }
  return campeonato.refProvedor;
}

const competicaoEstadoSchema = z.object({
  competicao: competicaoSchema,
  linhas: z.array(linhaClassificacaoSchema),
  partidas: z.array(partidaSchema),
  participacoes: z.array(participacaoClubeSchema),
});

const estadoFutebolSchema = z.object({
  competicoes: z.record(z.string(), competicaoEstadoSchema),
});

function lerJsonSeExistir(caminho: string): unknown {
  if (!existsSync(caminho)) return undefined;
  return JSON.parse(readFileSync(caminho, 'utf8')) as unknown;
}

/** Carrega o estado anterior de `{dirEstado}/futebol.json`; estado vazio
 * (primeira execução) se o arquivo não existir ou for inválido — mesma
 * cautela de `carregarEstadoNoticias` (ING-N-07): estado interno corrompido
 * nunca deve travar a ingestão. */
export function carregarEstadoFutebol(
  caminho: string = join(dirEstado(), 'futebol.json'),
): EstadoFutebol {
  const bruto = lerJsonSeExistir(caminho);
  if (bruto === undefined) return estadoFutebolVazio();
  const resultado = estadoFutebolSchema.safeParse(bruto);
  if (!resultado.success) {
    console.warn(
      `estado/futebol.json inválido em ${caminho}; iniciando do zero.`,
      resultado.error,
    );
    return estadoFutebolVazio();
  }
  return resultado.data;
}

function gravarJson(caminho: string, dado: unknown): void {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, `${JSON.stringify(dado, null, 2)}\n`, 'utf8');
}

/** Grava o novo estado interno em `{dirEstado}/futebol.json`. */
export function gravarEstadoFutebol(
  estado: EstadoFutebol,
  caminho: string = join(dirEstado(), 'futebol.json'),
): void {
  gravarJson(caminho, estado);
}

/**
 * Mescla a porção de futebol no `ingestao/status.json` existente (se houver)
 * sem apagar a porção de notícias (`fontes`/`distribuicaoClassificacao`/
 * `gruposFormados`, escritas por ING-N-07/`mesclarStatus`) — leitura + mescla,
 * nunca substituição cega (mesma disciplina do lado de notícias).
 */
export function mesclarStatusFutebol(
  statusFutebol: StatusIngestaoFutebol,
  caminho: string,
): Record<string, unknown> {
  const existente = lerJsonSeExistir(caminho);
  const base: Record<string, unknown> =
    existente !== undefined && typeof existente === 'object' && existente !== null
      ? (existente as Record<string, unknown>)
      : {};
  return {
    ...base,
    geradoEm: statusFutebol.geradoEm,
    futebol: statusFutebol.futebol,
    provedores: statusFutebol.provedores,
    pausadoPorCota: statusFutebol.pausadoPorCota,
  };
}

/** Grava `ingestao/status.json` mesclado (ver `mesclarStatusFutebol`). */
export function gravarStatusFutebol(
  statusFutebol: StatusIngestaoFutebol,
  caminho: string = join(dirEstado(), 'ingestao', 'status.json'),
): void {
  gravarJson(caminho, mesclarStatusFutebol(statusFutebol, caminho));
}

/** Carrega e valida `config/campeonatos-2026.json` (CFG-03). */
export function carregarCampeonatosDominio(
  caminho: string = join(RAIZ_PROJETO, 'config', 'campeonatos-2026.json'),
): CampeonatoConfig[] {
  const bruto = JSON.parse(readFileSync(caminho, 'utf8')) as unknown;
  return ConfigCampeonatosSchema.parse(bruto).campeonatos;
}

/**
 * Monta o registro de provedores disponíveis para a execução real:
 * `football-data.org` (Brasileirão, ADR-006 item 4) e `TheSportsDB`
 * (Paulista/Carioca, SPK-01 — ver nota no topo do arquivo). Token do
 * football-data.org injetado via variável de ambiente
 * `FOOTBALL_DATA_API_TOKEN` (segredo do job de CI, TASK.md §1 diretriz 12 —
 * nunca hardcoded, nunca lido por `adaptador-football-data.ts` diretamente).
 * TheSportsDB usa a chave demo pública (`BASE_URL_THESPORTSDB`, sem segredo).
 */
export function montarProvedoresPadrao(
  clubes: ClubeBase[],
  token: string,
): Record<string, ProvedorRegistrado> {
  const adaptadorFootballData = criarAdaptadorFootballData({ token, clubes });
  const registroFootballData = registrarProvedor<RefCompeticaoFootballData>(
    adaptadorFootballData,
    (campeonato) => {
      const { id: codigoCompeticao } = refProvedorObrigatorio(campeonato);
      return { competicaoId: campeonato.id, codigoCompeticao };
    },
  );

  const adaptadorTheSportsDB = criarAdaptadorTheSportsDB({ clubes });
  const registroTheSportsDB = registrarProvedor<RefCompeticaoTheSportsDB>(
    adaptadorTheSportsDB,
    (campeonato) => {
      const { id, temporada } = refProvedorObrigatorio(campeonato);
      const comTabelaCompleta =
        (campeonato.formato === 'grupos' || campeonato.formato === 'pontos-corridos') &&
        campeonato.clubes.length > 0;
      return {
        competicaoId: campeonato.id,
        idLigaProvedor: id,
        idLiga: Number(id), // ADR-022: exposto para o eventsday (COB-33)
        politicaTabela: politicaTabelaPorFormato(campeonato.formato),
        ...(temporada !== undefined ? { temporadaProvedor: temporada } : {}),
        ...(comTabelaCompleta ? { clubesEsperados: campeonato.clubes.length } : {}),
      };
    },
  );

  // Chave = mesma string usada em `CampeonatoConfig.provedor` (CFG-03) —
  // deliberadamente distinta de `adaptador.id` (`"football-data"`/
  // `"thesportsdb"`, usado só para `Clube.idsProvedor`, ver nota em
  // `coletor-futebol.ts`).
  return {
    'football-data-org': registroFootballData,
    thesportsdb: registroTheSportsDB,
  };
}

export interface OpcoesIngestaoFutebolEmDisco {
  agora?: Date;
  caminhoCampeonatos?: string;
  caminhoClubes?: string;
  caminhoEstado?: string;
  caminhoStatus?: string;
  limitesPorExecucao?: Record<string, number>;
  /** Registro de provedores a usar; por padrão, monta `football-data.org`
   * real com o token de `FOOTBALL_DATA_API_TOKEN` (variável de ambiente do
   * job de CI). Permite injeção só para composição/teste avançado deste
   * wrapper — o critério de aceite de ponta a ponta com provedor mockado é
   * coberto via `executarFluxoFutebol` diretamente. */
  provedores?: Record<string, ProvedorRegistrado>;
}

/**
 * Wrapper de I/O do Fluxo 2: lê configuração + estado anterior do disco,
 * monta o(s) provedor(es) real(is), executa `executarFluxoFutebol`, grava o
 * novo estado interno e mescla `ingestao/status.json`. É o ponto de entrada
 * esperado por um futuro `npm run ingestao` (wiring do script em si é decisão
 * de PUB-02/PUB-03, mesma nota de `pipeline/noticias/orquestrador.ts`).
 */
export async function executarIngestaoFutebolEmDisco(
  opcoes: OpcoesIngestaoFutebolEmDisco = {},
): Promise<ResultadoFluxoFutebol> {
  const agora = opcoes.agora ?? new Date();
  const campeonatos = carregarCampeonatosDominio(opcoes.caminhoCampeonatos);
  const clubes = carregarClubesSerieA2026(opcoes.caminhoClubes);
  const caminhoEstado = opcoes.caminhoEstado ?? join(dirEstado(), 'futebol.json');
  const caminhoStatus =
    opcoes.caminhoStatus ?? join(dirEstado(), 'ingestao', 'status.json');
  const estadoAnterior = carregarEstadoFutebol(caminhoEstado);

  let provedores = opcoes.provedores;
  if (provedores === undefined) {
    const token = process.env['FOOTBALL_DATA_API_TOKEN'];
    if (token === undefined || token.length === 0) {
      throw new Error(
        'FOOTBALL_DATA_API_TOKEN não definido — segredo do provedor deve vir do ' +
          'ambiente do job de CI (TASK.md §1, diretriz 12).',
      );
    }
    provedores = montarProvedoresPadrao(clubes, token);
  }

  const opcoesFluxo: OpcoesFluxoFutebol = {
    campeonatos,
    provedores,
    estadoAnterior,
    agora,
    ...(opcoes.limitesPorExecucao !== undefined
      ? { limitesPorExecucao: opcoes.limitesPorExecucao }
      : {}),
  };
  const resultado = await executarFluxoFutebol(opcoesFluxo);

  gravarEstadoFutebol(resultado.novoEstado, caminhoEstado);
  gravarStatusFutebol(resultado.status, caminhoStatus);

  return resultado;
}
