// dominio/frescor.ts — DOM-06 (TASK.md Lote 3)
//
// Cálculo de "atualizado há <tempo>" (RF-17, CA-17.1) e do limite de alerta de
// frescor por conjunto (RN-09: 2× o intervalo — CA-17.2). Módulo puro, sem I/O
// (GUARDRAILS.md §5, SDD §2.1): o relógio (`agora`) sempre entra por parâmetro,
// nunca `Date.now()`.
//
// "Por conjunto" (CA-17.5, SDD §2.5): este módulo não guarda estado nenhum —
// cada carimbo (notícias, futebol de um clube, comparativo, simulação, etc.)
// é uma chamada independente a `calcularFrescor`, com o `geradoEm` e o
// `intervaloMinutos` daquele conjunto específico (SDD §5: 30 min para
// notícias; ~1 h em dia de jogo de clube da Série A e ~6 h fora dele, para
// futebol). A independência dos carimbos é responsabilidade de quem chama
// (um carimbo por conjunto), não deste módulo.

/**
 * Uma unidade de `Intl.RelativeTimeFormat` com o correspondente em
 * milissegundos, usada para escolher a granularidade do texto (segundos,
 * minutos, horas, dias, meses ou anos) a partir da diferença entre `agora` e
 * `geradoEm`. Ordem crescente — a primeira unidade cujo `emMs` ainda cobre a
 * diferença é a escolhida.
 */
const SEGUNDO_EM_MS = 1_000;
const MINUTO_EM_MS = 60_000;
const HORA_EM_MS = 3_600_000;
const DIA_EM_MS = 86_400_000;
const MES_EM_MS = 2_592_000_000; // 30 dias, aproximação (sem calendário no domínio)
const ANO_EM_MS = 31_536_000_000; // 365 dias, mesma aproximação

/** Unidades em ordem decrescente — a primeira cujo `emMs` a diferença ainda cobre é a escolhida. */
const UNIDADES: ReadonlyArray<{ unidade: Intl.RelativeTimeFormatUnit; emMs: number }> = [
  { unidade: 'year', emMs: ANO_EM_MS },
  { unidade: 'month', emMs: MES_EM_MS },
  { unidade: 'day', emMs: DIA_EM_MS },
  { unidade: 'hour', emMs: HORA_EM_MS },
  { unidade: 'minute', emMs: MINUTO_EM_MS },
];

/**
 * Escolhe a unidade e a quantidade (arredondada, negativa = passado) a usar
 * com `Intl.RelativeTimeFormat` para representar a diferença `diffMsAbsoluto`
 * (sempre tratada como `>= 0`, isto é, `geradoEm` no passado ou igual a
 * `agora`).
 */
function escolherUnidade(diffMsAbsoluto: number): {
  unidade: Intl.RelativeTimeFormatUnit;
  valor: number;
} {
  // Abaixo de 1 segundo: trata como "agora" (evita "há 0 segundos").
  if (diffMsAbsoluto < SEGUNDO_EM_MS) {
    return { unidade: 'second', valor: 0 };
  }

  for (const candidata of UNIDADES) {
    if (diffMsAbsoluto >= candidata.emMs) {
      return {
        unidade: candidata.unidade,
        valor: Math.round(diffMsAbsoluto / candidata.emMs),
      };
    }
  }

  // Nenhuma unidade >= minuto cobre a diferença: fica em segundos.
  return { unidade: 'second', valor: Math.round(diffMsAbsoluto / SEGUNDO_EM_MS) };
}

/**
 * Formata "atualizado há <tempo>" (CA-17.1) a partir de `geradoEm` em relação
 * a `agora`, com `Intl.RelativeTimeFormat` (`locale`, padrão `pt-BR` —
 * `America/Sao_Paulo`/pt-BR é o único locale do produto, RNF-02).
 *
 * `geradoEm` no futuro em relação a `agora` (relógio do dado adiantado em
 * relação ao relógio informado — não deveria acontecer, mas o pipeline não
 * garante isso ao domínio) é tratado como "agora" (diferença zerada), nunca
 * produz "daqui a X" — decisão de robustez registrada aqui, não um requisito
 * do PRD-TECNICO.
 */
export function formatarAtualizadoHa(
  agora: Date,
  geradoEm: Date,
  locale = 'pt-BR',
): string {
  const diffMs = Math.max(0, agora.getTime() - geradoEm.getTime());
  const { unidade, valor } = escolherUnidade(diffMs);

  if (valor === 0) {
    return 'atualizado agora';
  }

  // `numeric: 'always'` força o texto canônico "há <tempo>" (CA-17.1) — com
  // `'auto'`, o `Intl.RelativeTimeFormat` produziria idiomatismos como
  // "ontem"/"amanhã" para 1 dia, fora do template exigido pelo CA.
  const formatador = new Intl.RelativeTimeFormat(locale, {
    numeric: 'always',
    style: 'long',
  });
  const trecho = formatador.format(-valor, unidade);
  return `atualizado ${trecho}`;
}

/**
 * RN-09 — limite de alerta de frescor: 2× o intervalo de atualização do
 * conjunto (SDD §2.5/§5, "a confirmar" no PRD-TECNICO quanto ao multiplicador
 * exato, mas 2× é o valor confirmado em SDD §5 e usado aqui).
 */
export function calcularLimiteAlertaMinutos(intervaloMinutos: number): number {
  return intervaloMinutos * 2;
}

/**
 * CA-17.2 — verifica se a diferença entre `agora` e `geradoEm` já excede o
 * limite de alerta (RN-09, 2× `intervaloMinutos`). "Excede" é estritamente
 * maior que o limite ("passou de 2× o intervalo", SDD §2.5) — no limite exato
 * ainda não está em alerta.
 */
export function estaEmAlerta(
  agora: Date,
  geradoEm: Date,
  intervaloMinutos: number,
): boolean {
  const diffMs = Math.max(0, agora.getTime() - geradoEm.getTime());
  const limiteMs = calcularLimiteAlertaMinutos(intervaloMinutos) * 60_000;
  return diffMs > limiteMs;
}

/** Resultado do cálculo de frescor de um único conjunto (CA-17.5: um por conjunto). */
export interface FrescorConjunto {
  /** Texto canônico pronto para exibição, ex.: `"atualizado há 12 minutos"` (CA-17.1). */
  atualizadoHa: string;
  /** `true` quando o conjunto excede RN-09 (2× o intervalo) — carimbo em alerta (CA-17.2). */
  emAlerta: boolean;
}

/**
 * Calcula o frescor completo de um conjunto (texto "atualizado há <tempo>" +
 * estado de alerta) a partir de `geradoEm` (dado real do conjunto) e do
 * `intervaloMinutos` daquele conjunto (30 min notícias; ~1 h/~6 h futebol,
 * conforme SDD §5) — nunca lê o relógio do sistema; `agora` sempre por
 * parâmetro (GUARDRAILS.md §5).
 */
export function calcularFrescor(
  agora: Date,
  geradoEm: Date,
  intervaloMinutos: number,
  locale = 'pt-BR',
): FrescorConjunto {
  return {
    atualizadoHa: formatarAtualizadoHa(agora, geradoEm, locale),
    emAlerta: estaEmAlerta(agora, geradoEm, intervaloMinutos),
  };
}
