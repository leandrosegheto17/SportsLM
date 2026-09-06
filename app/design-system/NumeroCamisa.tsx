import type { ReactElement } from 'react';
import estilos from './NumeroCamisa.module.css';

/**
 * `NumeroCamisa` — UI-DS-04 (UX-SPEC §3.8.4).
 *
 * Três variantes:
 * - `sobre-faixa`: número sobre a identidade do clube (`--clube-identidade-texto`).
 * - `sobre-fundo-claro`: número sobre fundo claro (`--clube-acento`, 4,5:1 já
 *   garantido pela derivação de PUB-01/ADR-017).
 * - `sem-posicao`: mata-mata, sem posição de tabela — mostra a fase
 *   (ex. "Oitavas de final") em `--txt-manchete` no lugar do número.
 *
 * Critério de aceite (TASK.md, UI-DS-04): "o número não é decorativo — vem
 * com texto associado" (ex. "6º lugar"). Por isso as variantes com número
 * exigem `rotulo` (nunca opcional) — o discriminated union abaixo torna
 * impossível renderizar um número sem o texto associado em tempo de
 * compilação, não só em teste.
 */
export type NumeroCamisaProps =
  | { readonly variante: 'sobre-faixa'; readonly numero: number; readonly rotulo: string }
  | {
      readonly variante: 'sobre-fundo-claro';
      readonly numero: number;
      readonly rotulo: string;
    }
  | { readonly variante: 'sem-posicao'; readonly fase: string };

export function NumeroCamisa(props: NumeroCamisaProps): ReactElement {
  if (props.variante === 'sem-posicao') {
    return (
      <div className={estilos['container']}>
        <p className={estilos['fase']}>{props.fase}</p>
      </div>
    );
  }

  const classeVariante =
    props.variante === 'sobre-faixa' ? estilos['sobreFaixa'] : estilos['sobreFundoClaro'];

  return (
    <div className={`${estilos['container']} ${classeVariante}`}>
      <p className={estilos['numero']}>{props.numero}</p>
      <p className={estilos['rotulo']}>{props.rotulo}</p>
    </div>
  );
}
