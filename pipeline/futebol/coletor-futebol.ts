// pipeline/futebol/coletor-futebol.ts — ING-F-02 (TASK.md Lote 5)
//
// Orquestra os adaptadores de provedor de futebol (`ProvedorFutebol`,
// ADR-006 item 1) por prioridade e janela de calendário, controlando a cota
// (CA-16.1, CA-16.4, ADR-006, ADR-002 "Priorização dentro da cota"). Não
// traduz resposta de provedor (isso é cada adaptador, ex.: ING-F-01) nem
// persiste estado entre execuções (`status.json`, `ultimaAtualizacao` por
// competição — isso é ING-F-05, que liga ING-F-01→02→03→04). `pipeline/` faz
// I/O (chama adaptadores) — mora fora de `dominio/` (GUARDRAILS.md §5).
//
// --- Ordem de prioridade dentro da cota (ADR-002, tabela do SDD §5) --------
// 1. Brasileirão Série A (categoria `brasileirao`);
// 2. competições continentais (`continental`);
// 3. Copa do Brasil (`copa-do-brasil`);
// 4. estaduais/regionais (`estadual`/`regional`, mesma prioridade entre si);
// 5. Supercopa (`supercopa`).
// Dentro do mesmo nível de prioridade, a ordem relativa da configuração de
// entrada é preservada (`Array.prototype.sort` é estável).
//
// --- Extensibilidade a múltiplos provedores (nota de decisão, TASK.md §6) --
// Hoje só existe o adaptador `football-data.org` (ING-F-01), mas SPK-01 pode
// trazer um segundo provedor. Este módulo nunca importa nem referencia
// `adaptador-football-data.ts` nem qualquer código de competição específico
// de provedor (ex.: `'BSA'`): quem integra um provedor chama
// `registrarProvedor(adaptador, construirReferencia)`, informando como
// transformar a configuração genérica de um campeonato (`CampeonatoConfig`,
// CFG-03) na referência que aquele provedor específico entende (ex.:
// `RefCompeticaoFootballData.codigoCompeticao`). O coletor nunca precisa
// conhecer esse formato — cada provedor é uma entrada opaca no registro,
// indexada pela mesma string usada em `CampeonatoConfig.provedor`
// (`config/campeonatos-2026.json`, ex.: `"football-data-org"`). Isso é
// deliberadamente diferente do id interno do adaptador (`ProvedorFutebol.id`,
// ex.: `"football-data"`, usado como chave de `Clube.idsProvedor` — ADR-006
// item 3): o coletor só precisa da chave de registro, nunca do id interno do
// adaptador.
//
// --- Controle de cota (CA-16.1/CA-16.4) ------------------------------------
// Cada competição custa exatamente 2 requisições ao provedor
// (`obterClassificacao` + `obterPartidas`) — fato estrutural da porta
// `ProvedorFutebol`, não um número específico de um provedor. O coletor
// combina duas defesas, nenhuma delas hardcoded a football-data.org:
// (a) **proativa** — antes de chamar o provedor para uma competição, se o
//     teto de requisições desta execução (`limitesPorExecucao[provedorId]`,
//     ou, na ausência dele, `adaptador.orcamento.porMinuto`) seria
//     ultrapassado, o coletor nem tenta a chamada: marca o provedor como
//     pausado e sinaliza `pausado-por-cota` para essa e todas as competições
//     seguintes que dependeriam do mesmo provedor nesta execução;
// (b) **reativa** — se o adaptador lança um erro cujo texto documenta HTTP
//     429 (convenção padrão de "limite de requisições excedido" nas APIs
//     REST, não específica de um provedor — é exatamente o que
//     `adaptador-football-data.ts` lança hoje, CA-16.3/16.4), o coletor trata
//     como cota esgotada: suspende o provedor pelo resto desta execução e
//     registra a competição corrente como `pausado-por-cota`.
// Qualquer outra falha (rede, HTTP 4xx/5xx que não seja limite de
// requisições, resposta inválida) vira `falha` — CA-16.3 ("mantém dados
// anteriores, registra e sinaliza") é responsabilidade de quem persiste o
// resultado (ING-F-05): este coletor só relata sucesso/falha por competição,
// nunca decide sozinho manter ou descartar um snapshot anterior.

import type {
  CampeonatoConfig,
  CategoriaCampeonato,
} from '../../config/campeonatos.schema';
import type { LinhaClassificacao, Partida } from '../../dominio/tipos/futebol';
import type {
  InconsistenciaClube,
  InconsistenciaPartida,
} from './adaptador-football-data';

/** Custo fixo, em requisições, de coletar uma competição — chamar
 * `obterClassificacao` e `obterPartidas` uma vez cada (ADR-006 item 1). */
export const CUSTO_REQUISICOES_POR_COMPETICAO = 2;

/**
 * Porta genérica de provedor de futebol (ADR-006 item 1), parametrizada pela
 * referência de competição específica de cada provedor (`TRef`). Compatível
 * estruturalmente com o que `criarAdaptadorFootballData` (ING-F-01) devolve
 * — o superconjunto `{ dados, inconsistencias }` documentado no cabeçalho
 * daquele módulo.
 */
export interface ProvedorFutebolPort<TRef = unknown> {
  readonly id: string;
  readonly orcamento: { porMinuto?: number; porDia?: number };
  obterClassificacao(
    ref: TRef,
  ): Promise<{ linhas: LinhaClassificacao[]; inconsistencias: InconsistenciaClube[] }>;
  obterPartidas(
    ref: TRef,
  ): Promise<{ partidas: Partida[]; inconsistencias: InconsistenciaPartida[] }>;
}

/** Entrada opaca do registro de provedores — ver `registrarProvedor`. */
export interface ProvedorRegistrado {
  readonly adaptador: {
    readonly orcamento: { porMinuto?: number; porDia?: number };
    obterClassificacao: (ref: unknown) => Promise<{
      linhas: LinhaClassificacao[];
      inconsistencias: InconsistenciaClube[];
    }>;
    obterPartidas: (
      ref: unknown,
    ) => Promise<{ partidas: Partida[]; inconsistencias: InconsistenciaPartida[] }>;
  };
  readonly construirReferencia: (campeonato: CampeonatoConfig) => unknown;
}

/**
 * Registra um provedor para orquestração pelo coletor, isolando o tipo de
 * referência específico do provedor (`TRef`) atrás de uma fronteira segura —
 * o coletor em si nunca vê `TRef`, só `unknown`. Quem chama sabe transformar
 * `CampeonatoConfig` (genérico, CFG-03) na referência que o provedor entende
 * (`construirReferencia`); isso mantém o coletor genérico o bastante para um
 * segundo provedor (SPK-01) sem abstração especulativa além disso.
 */
export function registrarProvedor<TRef>(
  adaptador: ProvedorFutebolPort<TRef>,
  construirReferencia: (campeonato: CampeonatoConfig) => TRef,
): ProvedorRegistrado {
  return {
    adaptador: {
      orcamento: adaptador.orcamento,
      obterClassificacao: (ref) => adaptador.obterClassificacao(ref as TRef),
      obterPartidas: (ref) => adaptador.obterPartidas(ref as TRef),
    },
    construirReferencia: (campeonato) => construirReferencia(campeonato),
  };
}

// --- Resultado por competição ----------------------------------------------

export interface ResultadoCompeticaoAtualizada {
  competicaoId: string;
  categoria: CategoriaCampeonato;
  tipo: 'atualizada';
  classificacao: { linhas: LinhaClassificacao[]; inconsistencias: InconsistenciaClube[] };
  partidas: { partidas: Partida[]; inconsistencias: InconsistenciaPartida[] };
}

/** Fora da janela de calendário da competição (não consome requisição, ADR-002)
 * ou sem cobertura de provedor (`provedor: null`, CA-16.5/CA-07.2) ou
 * suspensa por cota esgotada nesta execução (CA-16.4). */
export interface ResultadoCompeticaoSemAtualizacao {
  competicaoId: string;
  categoria: CategoriaCampeonato;
  tipo: 'fora-da-janela' | 'sem-cobertura' | 'pausado-por-cota';
}

/** `CampeonatoConfig.provedor` aponta para um id que não foi registrado nesta
 * execução (ex.: um segundo provedor ainda não integrado, SPK-01) — diferente
 * de `provedor: null` (sem cobertura confirmada, CA-16.5). */
export interface ResultadoCompeticaoProvedorNaoRegistrado {
  competicaoId: string;
  categoria: CategoriaCampeonato;
  tipo: 'provedor-nao-registrado';
  provedorId: string;
}

/** Falha ao consultar o provedor que não é cota esgotada (CA-16.3) — quem
 * mantém o dado anterior é quem persiste o resultado (ING-F-05), não este
 * coletor. */
export interface ResultadoCompeticaoFalha {
  competicaoId: string;
  categoria: CategoriaCampeonato;
  tipo: 'falha';
  mensagemErro: string;
}

export type ResultadoCompeticao =
  | ResultadoCompeticaoAtualizada
  | ResultadoCompeticaoSemAtualizacao
  | ResultadoCompeticaoProvedorNaoRegistrado
  | ResultadoCompeticaoFalha;

export interface ResultadoColeta {
  /** Um item por competição de entrada, na ordem de prioridade em que foram
   * processadas (ADR-002) — não na ordem original de `campeonatos`. */
  resultados: ResultadoCompeticao[];
  /** Ids de provedor (chave do registro) suspensos por cota esgotada nesta
   * execução — sinal para CA-16.4/CA-17.4 ("atualização pausada por limite
   * do provedor"); o texto exato exibido na SPA é responsabilidade de quem
   * consome este resultado, não deste módulo (TASK.md §1, diretriz 9). */
  provedoresPausadosPorCota: string[];
  /** Requisições efetivamente enviadas a cada provedor nesta execução. */
  requisicoesUsadas: Record<string, number>;
}

export interface OpcoesColeta {
  /** Competições da temporada (CFG-03) a considerar nesta execução. */
  campeonatos: CampeonatoConfig[];
  /** Instante da execução — controla a janela de calendário (comparação por
   * data UTC; ajustar `agora` para o fuso de referência, se necessário, é
   * responsabilidade de quem chama). */
  agora: Date;
  /** Registro de provedores disponíveis nesta execução, chave = mesma string
   * usada em `CampeonatoConfig.provedor`. Mais de um provedor pode coexistir
   * (SPK-01) — o coletor nunca assume que existe só um. */
  provedores: Record<string, ProvedorRegistrado>;
  /**
   * Teto de requisições por provedor nesta execução (controle proativo de
   * cota). Quando ausente para um provedor, usa
   * `adaptador.orcamento.porMinuto` como teto conservador — cada execução do
   * job roda bem dentro de um minuto (SDD §2.4 — plano gratuito de
   * football-data.org: 2 requisições por execução contra 10/min de folga).
   * Se nem um nem outro estiverem definidos, o coletor não impõe teto
   * proativo para aquele provedor (só reage a erro de cota esgotada vindo do
   * próprio provedor).
   */
  limitesPorExecucao?: Record<string, number>;
}

// --- Prioridade (ADR-002) ---------------------------------------------------

const ORDEM_PRIORIDADE_CATEGORIA: Record<CategoriaCampeonato, number> = {
  brasileirao: 0,
  continental: 1,
  'copa-do-brasil': 2,
  estadual: 3,
  regional: 3,
  supercopa: 4,
};

function ordenarPorPrioridade(campeonatos: CampeonatoConfig[]): CampeonatoConfig[] {
  return [...campeonatos].sort(
    (a, b) =>
      ORDEM_PRIORIDADE_CATEGORIA[a.categoria] - ORDEM_PRIORIDADE_CATEGORIA[b.categoria],
  );
}

// --- Janela de calendário ----------------------------------------------------

/** `true` quando `agora` está fora de `[janela.inicio, janela.fim]` (datas
 * `AAAA-MM-DD`, comparação lexicográfica — mesma convenção de
 * `config/campeonatos.schema.ts`). Fora da janela não consome requisição
 * (ADR-002). */
function foraDaJanela(janela: { inicio: string; fim: string }, agora: Date): boolean {
  const dataAtual = agora.toISOString().slice(0, 10);
  return dataAtual < janela.inicio || dataAtual > janela.fim;
}

// --- Detecção de cota esgotada (CA-16.4) -------------------------------------

const PADRAO_HTTP_COTA_ESGOTADA = /HTTP 429\b/;

/** `true` quando o erro do provedor documenta HTTP 429 ("Too Many Requests"
 * — convenção padrão de limite de requisições excedido, não específica de um
 * provedor; é o que `adaptador-football-data.ts` lança hoje para qualquer
 * resposta HTTP não-ok, TASK.md/ING-F-01). */
function pareceCotaEsgotada(erro: unknown): boolean {
  return erro instanceof Error && PADRAO_HTTP_COTA_ESGOTADA.test(erro.message);
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

// --- Orquestração ------------------------------------------------------------

/**
 * Orquestra a coleta de futebol desta execução: ordena por prioridade
 * (ADR-002), pula competição fora da janela ou sem cobertura, chama o
 * provedor registrado respeitando a cota (proativa e reativa, CA-16.1/16.4) e
 * devolve um resultado por competição. Não traduz nem persiste nada — isso é
 * papel de cada adaptador (ING-F-01) e de quem liga o fluxo (ING-F-05).
 */
export async function coletarFutebol(opcoes: OpcoesColeta): Promise<ResultadoColeta> {
  const ordenados = ordenarPorPrioridade(opcoes.campeonatos);
  const resultados: ResultadoCompeticao[] = [];
  const requisicoesUsadas: Record<string, number> = {};
  const provedoresPausados = new Set<string>();

  for (const campeonato of ordenados) {
    const base = { competicaoId: campeonato.id, categoria: campeonato.categoria };

    if (foraDaJanela(campeonato.janela, opcoes.agora)) {
      resultados.push({ ...base, tipo: 'fora-da-janela' });
      continue;
    }

    if (campeonato.provedor === null) {
      resultados.push({ ...base, tipo: 'sem-cobertura' });
      continue;
    }

    const provedorId = campeonato.provedor;
    const registro = opcoes.provedores[provedorId];
    if (registro === undefined) {
      resultados.push({ ...base, tipo: 'provedor-nao-registrado', provedorId });
      continue;
    }

    if (provedoresPausados.has(provedorId)) {
      resultados.push({ ...base, tipo: 'pausado-por-cota' });
      continue;
    }

    const usadasAtuais = requisicoesUsadas[provedorId] ?? 0;
    const limite =
      opcoes.limitesPorExecucao?.[provedorId] ?? registro.adaptador.orcamento.porMinuto;
    if (
      limite !== undefined &&
      usadasAtuais + CUSTO_REQUISICOES_POR_COMPETICAO > limite
    ) {
      provedoresPausados.add(provedorId);
      resultados.push({ ...base, tipo: 'pausado-por-cota' });
      continue;
    }

    const referencia = registro.construirReferencia(campeonato);
    try {
      requisicoesUsadas[provedorId] = usadasAtuais + 1;
      const classificacao = await registro.adaptador.obterClassificacao(referencia);
      requisicoesUsadas[provedorId] = (requisicoesUsadas[provedorId] ?? 0) + 1;
      const partidas = await registro.adaptador.obterPartidas(referencia);
      resultados.push({ ...base, tipo: 'atualizada', classificacao, partidas });
    } catch (erro) {
      if (pareceCotaEsgotada(erro)) {
        provedoresPausados.add(provedorId);
        resultados.push({ ...base, tipo: 'pausado-por-cota' });
      } else {
        resultados.push({ ...base, tipo: 'falha', mensagemErro: mensagemDeErro(erro) });
      }
    }
  }

  return {
    resultados,
    provedoresPausadosPorCota: [...provedoresPausados],
    requisicoesUsadas,
  };
}
