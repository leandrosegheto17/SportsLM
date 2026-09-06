import type { ReactElement } from 'react';
import estilos from './Esqueleto.module.css';

export type VarianteEsqueleto = 'cartao' | 'linha-tabela' | 'faixa' | 'bloco';

interface PropriedadesEsqueleto {
  readonly variante: VarianteEsqueleto;
  /** Quantos blocos repetir (ex.: "8 linhas de tabela", UX-SPEC §4/T-06). */
  readonly quantidade?: number;
}

/**
 * `Esqueleto` (UX-SPEC §3.8): blocos em `--cor-superficie-2` com a forma do
 * conteúdo. Variantes cartão · linha de tabela · faixa · bloco.
 *
 * Acessibilidade: os blocos visuais são puramente decorativos (`aria-hidden`)
 * — o estado "carregando" é anunciado uma única vez por um texto em
 * `role="status"`/`aria-live="polite"` (nunca por cor sozinha, e nunca N
 * anúncios repetidos por bloco).
 */
export function Esqueleto({
  variante,
  quantidade = 1,
}: PropriedadesEsqueleto): ReactElement {
  const blocos = Array.from({ length: quantidade }, (_valor, indice) => indice);

  return (
    <div className={estilos['container']} role="status" aria-label="Carregando">
      {blocos.map((indice) => (
        <span
          key={indice}
          className={estilos['bloco']}
          data-variante={variante}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
