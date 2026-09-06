// app/telemetria/eventos.ts — TEL-01 (TASK.md Lote 12)
//
// Tipos e a lista fechada dos 5 eventos de RNF-07/ADR-012 regra 1. Nenhum
// campo aqui carrega conteúdo ou preferência do torcedor (nome de fonte,
// favoritos, time, palpite, URL) — só o que a tabela do ADR-012 autoriza
// como "Carga": contagens, booleanos e um enum fechado de rota. Isso é
// verificado por teste (`eventos.test.ts`): a forma de cada evento nunca
// ganha um campo a mais sem que o teste de tabela também mude.
//
// Vive em `app/telemetria/`, não em `dominio/` (SDD §2.1): o carimbo de
// tempo usa `Date.now()`, proibido em `dominio/`.

/** Lista fechada (ADR-012 regra 1) — qualquer evento fora daqui é achado do
 * Validador, não uma extensão válida deste módulo. */
export const NOMES_EVENTOS_TELEMETRIA = [
  'primeira_sessao',
  'retorno',
  'personalizacao_concluida',
  'primeira_interacao_util',
  'comparativo_aberto',
] as const;

export type NomeEventoTelemetria = (typeof NOMES_EVENTOS_TELEMETRIA)[number];

/** `retorno` — ADR-012: "dias desde a primeira sessão". */
export interface CargaRetorno {
  readonly diasDesdePrimeiraSessao: number;
}

/** `personalizacao_concluida` — ADR-012: "quantidade de favoritos; se há
 * time". Nunca a lista de favoritos nem o id do time (isso seria conteúdo). */
export interface CargaPersonalizacaoConcluida {
  readonly quantidadeFavoritos: number;
  readonly temTimeDefinido: boolean;
}

/** `primeira_interacao_util` — ADR-012: "milissegundos desde o início da
 * navegação". */
export interface CargaPrimeiraInteracaoUtil {
  readonly milissegundosAteInteracao: number;
}

/** `comparativo_aberto` — ADR-012: "qual das duas" (`/comparativo` ou
 * `/simulacao`), nunca conteúdo do comparativo/simulação em si. */
export interface CargaComparativoAberto {
  readonly rota: 'comparativo' | 'simulacao';
}

/** `primeira_sessao` — ADR-012: "—" (sem carga além do comum). */
export type CargaEvento<N extends NomeEventoTelemetria> = N extends 'retorno'
  ? CargaRetorno
  : N extends 'personalizacao_concluida'
    ? CargaPersonalizacaoConcluida
    : N extends 'primeira_interacao_util'
      ? CargaPrimeiraInteracaoUtil
      : N extends 'comparativo_aberto'
        ? CargaComparativoAberto
        : undefined;

/**
 * Forma final de um evento pronto para o coletor (ADR-012 regra 3): nome,
 * identificador anônimo, carimbo de tempo e a carga da tabela — nada além
 * disso. `idAnonimo` nunca é enviado com nenhum outro atributo do torcedor.
 */
export interface EventoTelemetria<N extends NomeEventoTelemetria = NomeEventoTelemetria> {
  readonly nome: N;
  readonly timestampMs: number;
  readonly idAnonimo: string;
  readonly carga: CargaEvento<N>;
}
