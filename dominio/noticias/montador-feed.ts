// dominio/noticias/montador-feed.ts — UI-T02-03 (TASK.md Lote 8)
//
// Montagem do feed "Últimas notícias" (RF-04/RF-19, T-02) a partir dos itens
// publicados em `/dados/noticias.json` (já com `grupoId` gravado na ingestão,
// ADR-009): aplica o bloqueio de fontes do torcedor, escolhe o representante
// de cada grupo (`escolherRepresentante`, DOM-03 — "a escolha do
// representante depende do bloqueio local do usuário, então roda no
// cliente", ADR-009), ordena por data de publicação (RN-18, mais recente
// primeiro) e corta no limite de 30 (CA-19.4: grupo conta como 1). Módulo
// puro, sem I/O (GUARDRAILS.md §5): recebe os itens e o conjunto de fontes
// bloqueadas já resolvidos por quem chama (a leitura de `localStorage`/rede é
// responsabilidade de `app/`).
//
// Reaproveitamento registrado (TASK.md §6): a tarefa paralela UI-T02-02
// (`SecaoSeusEsportes`) já resolve a mesma escolha de representante por
// grupo, mas por composição local dentro do próprio componente (não exporta
// um módulo de domínio reaproveitável) — replicar a lógica pura aqui, em
// `dominio/`, é intencional: RF-19 é um requisito transversal ao produto
// (não só a esta tela), e esta implementação vem com sua própria suíte de
// testes por tabela cobrindo CA-19.1 a CA-19.4 diretamente (Diretriz de
// Implementação #11), sem depender de outra tarefa paralela terminar.

import type { ItemNoticia } from '../tipos/noticias';
import { escolherRepresentante } from '../dedup';

/** CA-19.4: "conta os 30, dado grupos, conta cada grupo como 1" — 30 é o
 * tamanho do feed "Últimas notícias" (RF-04/CA-04.1). */
export const LIMITE_PADRAO_FEED_NOTICIAS = 30;

/** Um item pronto para exibição no feed: o representante do grupo (ou o
 * próprio item, se RN-16 não foi atingido — CA-19.3) mais a lista de outras
 * fontes do mesmo grupo, já sem as bloqueadas (CA-19.1/CA-19.2). */
export interface ItemFeedNoticias {
  readonly representante: ItemNoticia;
  /** Ids de fonte dos demais membros do grupo, entre as não bloqueadas,
   * excluindo o próprio representante — vazio quando o item não faz parte de
   * nenhum grupo (CA-19.3) ou quando é o único membro não bloqueado. */
  readonly outrasFontesIds: readonly string[];
}

function instanteComparavel(publicadoEmIso: string): number {
  const instante = Date.parse(publicadoEmIso);
  // Data inválida nunca deveria chegar aqui (CA-04.6 já resolve isso na
  // ingestão, gravando o horário de ingestão como estimado) — na dúvida,
  // manda para o fim da lista em vez de lançar (mesma postura defensiva de
  // `dominio/frescor.ts`).
  return Number.isNaN(instante) ? Number.NEGATIVE_INFINITY : instante;
}

/**
 * Monta o feed "Últimas notícias" (CA-04.1 a CA-04.8, CA-19.1 a CA-19.4):
 *
 * 1. Descarta item `'fora-do-recorte'` (CA-04.8 — defensivo: o contrato
 *    público já não deveria trazer nenhum, SDD §2.2, "sem itens
 *    fora-do-recorte").
 * 2. Agrupa por `grupoId` (item sem grupo forma um grupo unitário) e escolhe
 *    o representante entre as fontes não bloqueadas (ADR-009/DOM-03) — grupo
 *    inteiramente bloqueado não aparece (CA-19.2).
 * 3. Ordena os representantes por `publicadoEm` decrescente (RN-18/CA-04.1).
 * 4. Corta em `limite` (padrão 30) — cada grupo já conta como 1 (CA-19.4).
 */
export function montarFeedNoticias(
  itens: readonly ItemNoticia[],
  fontesBloqueadas: ReadonlySet<string>,
  limite: number = LIMITE_PADRAO_FEED_NOTICIAS,
): readonly ItemFeedNoticias[] {
  const semGrupo: ItemNoticia[] = [];
  const gruposPorId = new Map<string, ItemNoticia[]>();

  for (const item of itens) {
    if (item.esporte === 'fora-do-recorte') continue; // CA-04.8

    if (item.grupoId === null) {
      semGrupo.push(item);
      continue;
    }

    const membros = gruposPorId.get(item.grupoId);
    if (membros) {
      membros.push(item);
    } else {
      gruposPorId.set(item.grupoId, [item]);
    }
  }

  const resultado: ItemFeedNoticias[] = [];

  for (const item of semGrupo) {
    if (fontesBloqueadas.has(item.fonteId)) continue;
    resultado.push({ representante: item, outrasFontesIds: [] });
  }

  for (const membros of gruposPorId.values()) {
    const representante = escolherRepresentante(membros, fontesBloqueadas);
    if (representante === null) continue; // CA-19.2: grupo todo bloqueado

    const outrasFontesIds = membros
      .filter(
        (membro) =>
          membro.id !== representante.id && !fontesBloqueadas.has(membro.fonteId),
      )
      .map((membro) => membro.fonteId);

    resultado.push({ representante, outrasFontesIds });
  }

  resultado.sort(
    (a, b) =>
      instanteComparavel(b.representante.publicadoEm) -
      instanteComparavel(a.representante.publicadoEm),
  );

  return resultado.slice(0, limite);
}
