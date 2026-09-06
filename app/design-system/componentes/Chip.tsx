import type { ReactElement } from 'react';
import estilos from './Chip.module.css';

interface PropriedadesChipBase {
  readonly rotulo: string;
}

interface PropriedadesChipSelecionavel extends PropriedadesChipBase {
  readonly variante: 'selecionavel';
  readonly selecionado: boolean;
  readonly aoAlternar: () => void;
  readonly disabled?: boolean;
}

interface PropriedadesChipRemovivel extends PropriedadesChipBase {
  readonly variante: 'removivel';
  readonly aoRemover: () => void;
  /** Nome acessível do botão de remoção (ex.: "Remover Futebol"). */
  readonly rotuloRemover: string;
}

interface PropriedadesChipInformativo extends PropriedadesChipBase {
  readonly variante: 'informativo';
}

export type PropriedadesChip =
  | PropriedadesChipSelecionavel
  | PropriedadesChipRemovivel
  | PropriedadesChipInformativo;

/**
 * `Chip` — UI-DS-07A (UX-SPEC §3.8: "44 px, raio sm, caixa alta"; variantes
 * selecionável · removível · informativo).
 *
 * Selecionável e removível usam `<button>` nativo (operável por
 * teclado). Informativo (ex.: "FONTE FIXA") não é interativo — não recebe
 * foco, coerente com não ter nenhuma ação associada.
 *
 * WCAG 1.4.1 (Diretriz de Implementação #7): o estado selecionado nunca
 * depende só da cor de fundo — o marcador "✓" texto é renderizado junto,
 * além de `aria-pressed`.
 */
export function Chip(propriedades: PropriedadesChip): ReactElement {
  if (propriedades.variante === 'informativo') {
    return (
      <span className={`${estilos['chip']} ${estilos['informativo']}`}>
        {propriedades.rotulo}
      </span>
    );
  }

  if (propriedades.variante === 'removivel') {
    return (
      <span className={`${estilos['chip']} ${estilos['removivel']}`}>
        {propriedades.rotulo}
        <button
          type="button"
          className={estilos['botaoRemover']}
          onClick={propriedades.aoRemover}
          aria-label={propriedades.rotuloRemover}
        >
          ✕
        </button>
      </span>
    );
  }

  const { selecionado, aoAlternar, rotulo, disabled } = propriedades;
  return (
    <button
      type="button"
      className={`${estilos['chip']} ${estilos['selecionavel']} ${
        selecionado ? estilos['selecionado'] : ''
      }`.trim()}
      aria-pressed={selecionado}
      onClick={aoAlternar}
      disabled={disabled}
    >
      {selecionado ? <span aria-hidden="true">✓ </span> : null}
      {rotulo}
    </button>
  );
}
