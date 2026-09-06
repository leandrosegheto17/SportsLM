import type { ReactElement } from 'react';
import { useTituloDocumento } from '../useTituloDocumento';

interface PropriedadesPaginaPlaceholder {
  /** Id da tela no UX-SPEC §1.1 (ex.: "T-02"). */
  readonly idTela: string;
  /** Nome canônico da tela, usado em `<title>` e no `<h1>`. */
  readonly nomeDaTela: string;
  /** Rota registrada em `Rotas.tsx`, só para conferência visual em dev. */
  readonly rota: string;
}

/**
 * Placeholder comum às 6 rotas do shell (FUND-04). Conteúdo real de cada tela
 * chega nos Lotes 8-11 — aqui só existe o suficiente para provar que a rota
 * resolve, que o título muda e que a navegação funciona.
 */
export function PaginaPlaceholder({
  idTela,
  nomeDaTela,
  rota,
}: PropriedadesPaginaPlaceholder): ReactElement {
  useTituloDocumento(nomeDaTela);

  return (
    <article>
      <h1>{nomeDaTela}</h1>
      <p>
        Placeholder de {idTela} ({rota}). Conteúdo real ainda não implementado (FUND-04 —
        shell de rotas).
      </p>
    </article>
  );
}
