import type { Partida } from '../../dominio/tipos/futebol';

/** Mescla partidas entre ciclos (ADR-022 item 2). Pura, sem mutação.
 * `finalizada` nunca regride; ausente nas novas é mantida; nas demais a nova
 * vence. Ordem: dataHora asc (null por último), depois id. */
export function mesclarPartidas(
  anteriores: readonly Partida[],
  novas: readonly Partida[],
): Partida[] {
  const mapa = new Map<string, Partida>();
  for (const p of anteriores) mapa.set(p.id, p);
  for (const nova of novas) {
    const atual = mapa.get(nova.id);
    if (atual?.status === 'finalizada' && nova.status !== 'finalizada') continue;
    mapa.set(nova.id, nova);
  }
  return [...mapa.values()].sort((a, b) => {
    if (a.dataHora !== b.dataHora) {
      if (a.dataHora === null) return 1;
      if (b.dataHora === null) return -1;
      return a.dataHora < b.dataHora ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
