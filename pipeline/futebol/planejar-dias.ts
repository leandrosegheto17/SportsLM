/** COB-32 (ADR-022): planejador puro de dias-alvo (AAAA-MM-DD, UTC) para eventsday. */
export type FaixaRn22 = 1 | 2;

export interface EntradaPlanejarDias {
  /** Instante atual (UTC). */
  readonly hoje: Date;
  /** Data (AAAA-MM-DD) do evento de eventsnextleague, ou null. */
  readonly proximoEvento: string | null;
  /** Data (AAAA-MM-DD) do evento de eventspastleague, ou null. */
  readonly ultimoEvento: string | null;
  readonly faixa: FaixaRn22;
  /** Dias já cobertos pelo estado acumulado (só afeta a faixa 2). */
  readonly diasCobertos?: readonly string[];
}

export const MAX_DIAS_ALVO = 5;
const DIA_MS = 86_400_000;
const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

function formatarDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function planejarDias(entrada: EntradaPlanejarDias): readonly string[] {
  const base = Date.UTC(
    entrada.hoje.getUTCFullYear(),
    entrada.hoje.getUTCMonth(),
    entrada.hoje.getUTCDate(),
  );
  const ancoras = [entrada.ultimoEvento, entrada.proximoEvento].filter(
    (d): d is string => d !== null && FORMATO.test(d),
  );
  let dias: string[];
  if (entrada.faixa === 1) {
    const trio = [-1, 0, 1].map((n) => formatarDia(new Date(base + n * DIA_MS)));
    dias = [...trio, ...ancoras];
  } else {
    const cobertos = new Set(entrada.diasCobertos ?? []);
    dias = ancoras.filter((d) => !cobertos.has(d));
  }
  return [...new Set(dias)].sort().slice(0, MAX_DIAS_ALVO);
}
