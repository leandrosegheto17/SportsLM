// dominio/dedup/agrupamento.ts — DOM-03 (TASK.md Lote 3)
//
// Agrupamento por união transitiva (union-find) sobre o critério de
// equivalência de RN-16/ADR-009, com `grupoId` estável por hash dos ids
// ordenados dos membros (ADR-009 passo 5). Módulo puro, sem I/O
// (GUARDRAILS.md §5) — roda tanto na ingestão (pipeline, Node) quanto no
// cliente (SPA, navegador), por isso não usa `node:crypto` (não disponível
// no navegador): o hash abaixo é um hash não-criptográfico determinístico
// (FNV-1a de 32 bits), suficiente para gerar um id estável — não é usado
// para nenhum propósito de segurança.

import { saoEquivalentes, type ItemParaDeduplicacao } from './similaridade';

/** Hash FNV-1a de 32 bits, em hexadecimal — determinístico e puro-JS (roda
 * em Node e no navegador, ao contrário de `node:crypto`). */
function hashFnv1a(texto: string): string {
  let hash = 0x811c9dc5;
  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

class UniaoConjuntosDisjuntos {
  private readonly pai = new Map<string, string>();

  constructor(ids: readonly string[]) {
    for (const id of ids) {
      this.pai.set(id, id);
    }
  }

  encontrar(id: string): string {
    const paiAtual = this.pai.get(id);
    if (paiAtual === undefined) {
      throw new Error(`id desconhecido na união de conjuntos: ${id}`);
    }
    if (paiAtual === id) {
      return id;
    }
    const raiz = this.encontrar(paiAtual);
    this.pai.set(id, raiz); // compressão de caminho
    return raiz;
  }

  unir(idA: string, idB: string): void {
    const raizA = this.encontrar(idA);
    const raizB = this.encontrar(idB);
    if (raizA !== raizB) {
      // Escolha determinística de raiz (menor id) para não depender da
      // ordem de chamada — mantém o resultado estável independente da
      // ordem dos pares avaliados.
      if (raizA < raizB) {
        this.pai.set(raizB, raizA);
      } else {
        this.pai.set(raizA, raizB);
      }
    }
  }
}

/** `grupoId` estável (ADR-009 passo 5): hash dos ids ordenados dos membros,
 * prefixado para deixar claro que é um id de grupo de deduplicação. */
export function calcularGrupoId(idsMembros: readonly string[]): string {
  const ordenados = [...idsMembros].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return `grp-${hashFnv1a(ordenados.join('|'))}`;
}

/**
 * Agrupa itens por união transitiva (RN-16/ADR-009 passo 5): calcula todos
 * os pares candidatos (O(n²), trivial para os volumes do produto — SDD §2.2)
 * e une conjuntos cujo par atende `saoEquivalentes`. Retorna um mapa
 * `id do item -> grupoId`, contendo **apenas** os itens que ficaram em um
 * grupo de 2 ou mais membros (CA-19.1); itens sem par equivalente (CA-19.3)
 * simplesmente não aparecem no mapa — cabe ao chamador tratar ausência como
 * `grupoId: null`.
 */
export function agruparItens(
  itens: readonly ItemParaDeduplicacao[],
): ReadonlyMap<string, string> {
  const ids = itens.map((item) => item.id);
  const uniao = new UniaoConjuntosDisjuntos(ids);

  for (let i = 0; i < itens.length; i += 1) {
    const itemA = itens[i];
    if (itemA === undefined) {
      continue;
    }
    for (let j = i + 1; j < itens.length; j += 1) {
      const itemB = itens[j];
      if (itemB !== undefined && saoEquivalentes(itemA, itemB)) {
        uniao.unir(itemA.id, itemB.id);
      }
    }
  }

  const membrosPorRaiz = new Map<string, string[]>();
  for (const id of ids) {
    const raiz = uniao.encontrar(id);
    const membros = membrosPorRaiz.get(raiz);
    if (membros) {
      membros.push(id);
    } else {
      membrosPorRaiz.set(raiz, [id]);
    }
  }

  const resultado = new Map<string, string>();
  for (const membros of membrosPorRaiz.values()) {
    if (membros.length < 2) {
      continue; // singleton: não é grupo (CA-19.3).
    }
    const grupoId = calcularGrupoId(membros);
    for (const id of membros) {
      resultado.set(id, grupoId);
    }
  }
  return resultado;
}
