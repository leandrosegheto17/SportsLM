// dominio/dedup/representante.ts — DOM-03 (TASK.md Lote 3)
//
// Escolha do representante de um grupo de deduplicação (RN-16, ADR-009):
// o snapshot publicado só traz `grupoId` — a escolha do representante
// depende do bloqueio de fontes, que é local do usuário (CA-19.2), então
// roda no cliente. Módulo puro, sem I/O (GUARDRAILS.md §5).

import type { ItemParaDeduplicacao } from './similaridade';

/**
 * Escolhe o representante de um grupo (ADR-009): o item mais antigo
 * (`publicadoEm`) entre as fontes **não bloqueadas** (CA-19.2 — "omitir a
 * bloqueada e promover a próxima mais antiga"). Retorna `null` quando todos
 * os membros do grupo têm a fonte bloqueada (o grupo não aparece, ADR-009).
 * Item com `publicadoEm` inválido nunca é escolhido como representante
 * (mesma cautela de "na dúvida, não agrupar" de RN-16) — só é ignorado se
 * houver alternativa válida; na ausência de qualquer item com data válida,
 * cai para a ordem de entrada como último recurso, sem lançar.
 */
export function escolherRepresentante<T extends ItemParaDeduplicacao>(
  itens: readonly T[],
  fontesBloqueadas: ReadonlySet<string>,
): T | null {
  const candidatos = itens.filter((item) => !fontesBloqueadas.has(item.fonteId));
  if (candidatos.length === 0) {
    return null;
  }

  let melhor: T | null = null;
  let melhorInstante = Number.POSITIVE_INFINITY;
  for (const candidato of candidatos) {
    const instante = Date.parse(candidato.publicadoEm);
    const instanteComparavel = Number.isNaN(instante)
      ? Number.POSITIVE_INFINITY
      : instante;
    if (melhor === null || instanteComparavel < melhorInstante) {
      melhor = candidato;
      melhorInstante = instanteComparavel;
    }
  }
  return melhor;
}
