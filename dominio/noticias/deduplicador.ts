// dominio/noticias/deduplicador.ts — ING-N-04 (TASK.md Lote 4)
//
// Integra o motor puro de deduplicação de `dominio/dedup/` (DOM-03) ao fluxo
// de ingestão de notícias, sobre a saída real de `normalizador-item`
// (`ItemNormalizado`, ING-N-02): agrupa itens de fontes distintas dentro da
// janela de 12h por similaridade de título, gravando `grupoId` em cada item
// (RN-16, ADR-009).
//
// Decisão de localização registrada (TASK.md — texto da própria tarefa
// ING-N-04 pede essa decisão explícita, TASK.md §6): fica em `dominio/`, não
// em `pipeline/`. Esta função só orquestra as funções puras já existentes de
// `dominio/dedup/` (`agruparItens`) sobre uma lista de `ItemNormalizado` — não
// há `fetch`, não há `Date.now()` (a janela de 12h compara `publicadoEm` de um
// item com o de outro, nunca com "agora", exatamente como `saoEquivalentes` já
// fazia em DOM-03) e nenhuma dependência de runtime nova. É uma transformação
// pura de lista para lista, então mora em `dominio/`, ao lado do módulo que
// define o tipo que ela consome (`dominio/noticias/normalizador-item.ts`,
// ING-N-02), e não em `dominio/dedup/` para não acoplar o módulo genérico de
// dedup (reaproveitado pelo cliente para escolher representante, ADR-009) ao
// tipo específico de notícia da ingestão.
//
// Decisão de tipo registrada (TASK.md §6, não é mudança de contrato): a saída
// de `normalizador-item` (`ItemNormalizado`) **não tem `id`** — o próprio
// cabeçalho de ING-N-02 registra que `id` (sha256 do link canônico, CA-15.3)
// depende de `crypto`, indisponível de forma pura em `dominio/`, e por isso é
// atribuído pela orquestração (ING-N-07), antes da etapa de deduplicação (a
// ordem do SDD §2.3 é: normaliza → classifica → grava no estado [com `id`] →
// deduplica). Como `saoEquivalentes`/`agruparItens` (DOM-03) exigem um `id`
// estável por item (para não comparar um item consigo mesmo e para montar o
// `grupoId`), esta função recebe `ItemNormalizadoComId` — `ItemNormalizado`
// (ING-N-02) mais o campo `id` que a orquestração já terá atribuído no ponto
// em que o deduplicador roda. Nenhum campo é inventado aqui: é o mesmo
// `ItemNormalizado` real, só com o pré-requisito de identidade que o próprio
// SDD já define como resolvido antes desta etapa do fluxo.

import { agruparItens, type ItemParaDeduplicacao } from '../dedup';
import type { ItemNormalizado } from './normalizador-item';

/** `ItemNormalizado` (ING-N-02) já com `id` atribuído pela orquestração
 * (sha256 do link canônico, CA-15.3) — pré-requisito para a deduplicação
 * (RN-16/ADR-009), que precisa de um identificador estável por item. */
export type ItemNormalizadoComId = ItemNormalizado & { readonly id: string };

/** `ItemNormalizadoComId` com `grupoId` já resolvido (RN-16/ADR-009):
 * `null` quando o item não fica em nenhum grupo de 2+ membros (CA-19.3). */
export type ItemNormalizadoDeduplicado = ItemNormalizadoComId & {
  readonly grupoId: string | null;
};

/** Projeta um `ItemNormalizadoComId` para o formato mínimo exigido pelo
 * motor puro de dedup (`ItemParaDeduplicacao`, DOM-03) — mesma estratégia de
 * desacoplamento estrutural já usada por `dominio/dedup/similaridade.ts`. */
function paraItemDeDeduplicacao(item: ItemNormalizadoComId): ItemParaDeduplicacao {
  return {
    id: item.id,
    fonteId: item.fonteId,
    titulo: item.titulo,
    publicadoEm: item.publicadoEm,
  };
}

/**
 * Aplica a deduplicação (RN-16, ADR-009) a uma lista real de itens
 * normalizados da ingestão (`ItemNormalizadoComId`): agrupa por trigramas +
 * tokens fortes dentro da janela de 12h entre fontes distintas
 * (`dominio/dedup/agruparItens`, DOM-03) e grava `grupoId` em cada item —
 * `null` para os que não formaram grupo (CA-19.3). Função pura: não muta a
 * lista recebida, preserva a ordem de entrada, sem I/O e sem `Date.now()`.
 */
export function deduplicarItensNormalizados<T extends ItemNormalizadoComId>(
  itens: readonly T[],
): readonly (T & { readonly grupoId: string | null })[] {
  const mapaGrupoPorId = agruparItens(itens.map(paraItemDeDeduplicacao));
  return itens.map((item) => ({
    ...item,
    grupoId: mapaGrupoPorId.get(item.id) ?? null,
  }));
}
