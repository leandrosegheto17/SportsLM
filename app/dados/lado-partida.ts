// COB-22 (ADR-019 item 6): único ponto de resolução de nome/identidade de lado.
import type { Partida } from '../../dominio/tipos';
import type { ClubePublico } from './configPublico';

export type LadoResolvido =
  | { tipo: 'clube'; clube: ClubePublico }
  | { tipo: 'externo'; nome: string; iniciais: string };

const PREFIXO = 'externo-';

function iniciaisDe(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function resolverLado(
  partida: Partida,
  lado: 'mandante' | 'visitante',
  clubes: readonly ClubePublico[] | null | undefined,
): LadoResolvido {
  const id = lado === 'mandante' ? partida.mandanteId : partida.visitanteId;
  const clube = clubes?.find((c) => c.id === id);
  if (clube) return { tipo: 'clube', clube };
  const nome =
    partida.externo?.lado === lado
      ? partida.externo.nome
      : id.startsWith(PREFIXO)
        ? id.slice(PREFIXO.length)
        : id;
  return { tipo: 'externo', nome, iniciais: iniciaisDe(nome) };
}

/** Adversário de `timeId`; `mando` é o mando do adversário. `null` se o time não joga. */
export function adversarioDe(
  partida: Partida,
  timeId: string,
  clubes?: readonly ClubePublico[] | null,
): { lado: LadoResolvido; mando: 'mandante' | 'visitante' } | null {
  const mando =
    partida.mandanteId === timeId
      ? 'visitante'
      : partida.visitanteId === timeId
        ? 'mandante'
        : null;
  return mando ? { lado: resolverLado(partida, mando, clubes), mando } : null;
}
