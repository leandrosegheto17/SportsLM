import type { ReactElement } from 'react';
import estilos from './Alternador.module.css';

export interface PropriedadesAlternador {
  readonly rotulo: string;
  readonly ligado: boolean;
  readonly aoAlternar: () => void;
  readonly disabled?: boolean;
}

/**
 * `Alternador` — UI-DS-07A (UX-SPEC §3.8: "44 px, rótulo à esquerda";
 * variantes ligado · desligado · foco).
 *
 * `role="switch"` + `aria-checked` num `<button>` nativo — operável por
 * teclado (Enter/Espaço) sem handler de tecla próprio. O estado "foco" da
 * tabela é o `:focus-visible` global de tokens.css, não repetido aqui.
 *
 * WCAG 1.4.1 (Diretriz #7): o estado nunca depende só da cor — o texto
 * visível "Ligado"/"Desligado" acompanha o rótulo.
 */
export function Alternador({
  rotulo,
  ligado,
  aoAlternar,
  disabled,
}: PropriedadesAlternador): ReactElement {
  return (
    <span className={estilos['linha']}>
      <span className={estilos['rotulo']} aria-hidden="true">
        {rotulo}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={rotulo}
        className={`${estilos['trilho']} ${ligado ? estilos['ligado'] : ''}`.trim()}
        onClick={aoAlternar}
        disabled={disabled}
      >
        <span className={estilos['bolinha']} aria-hidden="true" />
        <span className={estilos['textoEstado']}>{ligado ? 'Ligado' : 'Desligado'}</span>
      </button>
    </span>
  );
}
