import type { ButtonHTMLAttributes, ReactElement } from 'react';
import estilos from './Botao.module.css';

export type VarianteBotao =
  | 'primario'
  | 'secundario'
  | 'terciario'
  | 'destrutivo'
  | 'fantasma';

export interface PropriedadesBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variante?: VarianteBotao;
}

/**
 * `Botao` — UI-DS-07A (UX-SPEC §3.8, tabela de componentes de base).
 *
 * `<button>` nativo: operável por teclado (Enter/Espaço) e por foco visível
 * (`:focus-visible`, tokens.css) sem nenhum código adicional aqui — nenhuma
 * `div` com `onClick` é usada em lugar de elemento interativo nativo.
 * `type="button"` por padrão para nunca submeter formulário por acidente
 * (pode ser sobrescrito via `type="submit"` quando o chamador precisar).
 */
export function Botao({
  variante = 'primario',
  type = 'button',
  className,
  ...resto
}: PropriedadesBotao): ReactElement {
  const classes = [estilos['botao'], estilos[variante]];
  if (className) {
    classes.push(className);
  }

  return <button type={type} className={classes.join(' ')} {...resto} />;
}
