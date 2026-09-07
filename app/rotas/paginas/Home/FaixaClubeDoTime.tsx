// app/rotas/paginas/Home/FaixaClubeDoTime.tsx — REFAT-10-01 (ajuste de layout
// da Home, a pedido do usuário)
//
// Extrai só a renderização de `FaixaClube` (a "faixa vermelha" do clube) de
// dentro de `SecaoIdentidade`, para que a Home possa colocá-la full-width,
// acima da grade de duas colunas — antes, a faixa nascia dentro de
// `.blocoIdentidade` (coluna fixa de 336px em telas ≥1024px), cortando quase
// todo o conteúdo dela (nome, posição, pontos) nesse formato estreito.
//
// Reaproveita os mesmos hooks de dado que `SecaoIdentidade` (`useClubesPublicos`,
// `useSnapshot` do Brasileirão) — ambos deduplicam a busca real por instância
// (cache module-level/`ClienteSnapshot` compartilhado, ver `useClubesPublicos.ts`/
// `useSnapshot.ts`), então ter os dois componentes lendo o mesmo dado não
// dispara uma segunda requisição de rede.
//
// Overlap deliberado com `SecaoIdentidade` (em vez de um hook novo
// compartilhado): a única lógica repetida é o cálculo de `clubeParaFaixa`/
// posição/pontos a partir dos mesmos dados já buscados — poucas linhas, sem
// I/O próprio. Extrair um hook comum agora seria abstração prematura para
// evitar ~15 linhas duplicadas; se um terceiro consumidor precisar do mesmo
// cálculo, aí sim vale extrair.

import { useMemo, type ReactElement } from 'react';
import { FaixaClube, type ClubeParaFaixa } from '../../../design-system/FaixaClube';
import { useSnapshot } from '../../../dados/useSnapshot';
import type { ClienteSnapshot } from '../../../dados/clienteSnapshot';
import {
  useClubesPublicos,
  type OpcoesUseClubesPublicos,
} from '../../../dados/useClubesPublicos';
import {
  brasileiraoPublicoSchema,
  URL_FUTEBOL_BRASILEIRAO,
} from '../../../dados/futebol';
import { lerTimeIdSalvo } from './SecaoIdentidade';

export interface PropriedadesFaixaClubeDoTime {
  /** Injeção de teste; padrão é `globalThis.localStorage` (mesmo padrão de
   * `SecaoIdentidade`). */
  readonly armazenamento?: Pick<Storage, 'getItem'>;
  readonly opcoesClubesPublicos?: OpcoesUseClubesPublicos;
  readonly clienteSnapshot?: ClienteSnapshot;
}

/** REFAT-10-01 — só a faixa do clube (`FaixaClube`), full-width, acima da
 * grade de duas colunas da Home. */
export function FaixaClubeDoTime({
  armazenamento,
  opcoesClubesPublicos,
  clienteSnapshot,
}: PropriedadesFaixaClubeDoTime): ReactElement {
  const timeId = useMemo(() => lerTimeIdSalvo(armazenamento), [armazenamento]);
  const { clubes } = useClubesPublicos(opcoesClubesPublicos);
  const opcoesSnapshot = clienteSnapshot ? { cliente: clienteSnapshot } : undefined;
  const brasileirao = useSnapshot(
    URL_FUTEBOL_BRASILEIRAO,
    'futebol',
    brasileiraoPublicoSchema,
    opcoesSnapshot,
  );

  if (timeId === null) {
    return <FaixaClube variante="neutra" />;
  }

  const clubeSelecionado = clubes?.find((clube) => clube.id === timeId);
  const clubeParaFaixa: ClubeParaFaixa | undefined = clubeSelecionado
    ? {
        nome: clubeSelecionado.nomeCurto,
        sigla: clubeSelecionado.sigla,
        paleta: clubeSelecionado.paleta,
      }
    : undefined;

  if (!clubeParaFaixa) {
    return <FaixaClube variante="neutra" />;
  }

  const linhaDoTimeNoBrasileirao = brasileirao.dados?.classificacao.find(
    (linha) => linha.clubeId === timeId,
  );
  // `exactOptionalPropertyTypes` (Diretriz #1): props opcionais só entram no
  // objeto quando têm valor — nunca `undefined` explícito.
  const propsTemporada =
    brasileirao.dados !== null
      ? { temporada: brasileirao.dados.competicao.temporada }
      : {};

  return (
    <FaixaClube
      variante="completa"
      clube={clubeParaFaixa}
      href="/time"
      competicaoNome={brasileirao.dados?.competicao.nome ?? 'Brasileirão Série A'}
      {...propsTemporada}
      posicao={linhaDoTimeNoBrasileirao?.posicao ?? null}
      pontos={linhaDoTimeNoBrasileirao?.pontos ?? null}
    />
  );
}
