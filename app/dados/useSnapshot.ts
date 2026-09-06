// app/dados/useSnapshot.ts — UI-DS-08 (TASK.md Lote 7)
//
// Hook de leitura de um arquivo do contrato público de dados (SDD §2.2):
// busca na montagem, revalida `versao.json` a cada 5 minutos enquanto a aba
// está visível (Page Visibility API) e rebusca `url` só se o hash da `chave`
// correspondente mudou. Sem sondagem cega (nenhum polling do arquivo em si),
// sem WebSocket.
//
// A lógica de fato (cache, dedup, comparação de hash) vive em
// `clienteSnapshot.ts`, sem React — este arquivo só liga o ciclo de vida do
// componente (montagem/desmontagem, timer, evento de visibilidade) a ela.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { z } from 'zod';
import {
  clienteSnapshotPadrao,
  type ClienteSnapshot,
  type EstadoSnapshot,
} from './clienteSnapshot';
import type { ChaveDeHash } from './versao';

/** 5 minutos (SDD §2.2) — único timer deste hook; guardado por instância,
 * mas a busca real é deduplicada pelo `ClienteSnapshot` entre instâncias. */
export const INTERVALO_REVALIDACAO_MS = 5 * 60 * 1000;

export interface OpcoesUseSnapshot {
  /** Injeção do cliente para teste; padrão é a instância única da SPA. */
  cliente?: ClienteSnapshot;
}

/**
 * Lê e mantém atualizado o snapshot de `url` (um dos arquivos do contrato de
 * SDD §2.2), validado por `esquema`. `chave` identifica qual hash de
 * `versao.json` governa a revalidação de `url` (`noticias` | `futebol` |
 * `catalogo` | `status`).
 */
export function useSnapshot<T>(
  url: string,
  chave: ChaveDeHash,
  esquema: z.ZodType<T>,
  opcoes: OpcoesUseSnapshot = {},
): EstadoSnapshot<T> {
  const cliente = opcoes.cliente ?? clienteSnapshotPadrao;

  const estado = useSyncExternalStore<EstadoSnapshot<T>>(
    (ouvir) => cliente.assinar(url, ouvir),
    () => cliente.obterEstado<T>(url),
    () => cliente.obterEstado<T>(url),
  );

  // Ref para a operação de garantir a versão mais recente sem recriar o
  // efeito (e o timer) a cada render — só `url`/`chave`/`cliente` recriam o
  // efeito; `esquema` é sempre uma constante de módulo na prática.
  const garantirRef = useRef<() => void>(() => undefined);
  garantirRef.current = () => {
    void cliente.garantir(url, chave, esquema);
  };

  useEffect(() => {
    garantirRef.current();

    const intervalo = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        garantirRef.current();
      }
    }, INTERVALO_REVALIDACAO_MS);

    const aoMudarVisibilidade = (): void => {
      if (document.visibilityState === 'visible') {
        garantirRef.current();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', aoMudarVisibilidade);
    }

    return () => {
      clearInterval(intervalo);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      }
    };
    // Dependências intencionalmente sem `esquema`: é sempre uma constante de
    // módulo (schema Zod definido fora do componente), nunca recriada por
    // render — incluí-la recriaria o timer sem necessidade.
  }, [url, chave, cliente]);

  return estado;
}
