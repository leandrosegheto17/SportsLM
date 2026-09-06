import type { ReactElement } from 'react';
import estilos from './SeloFonte.module.css';

export type EstadoSeloFonte = 'ativa' | 'bloqueada' | 'instavel' | 'fixa';

interface PropriedadesSeloFonte {
  readonly nome: string;
  readonly estado: EstadoSeloFonte;
}

const TEXTO_POR_ESTADO: Record<EstadoSeloFonte, string> = {
  ativa: 'ATIVA',
  bloqueada: 'BLOQUEADA',
  instavel: 'INSTÁVEL',
  fixa: 'FONTE FIXA',
};

/**
 * `SeloFonte` (UX-SPEC §3.8): nome + ponto de estado + texto. O ponto
 * (`aria-hidden`) é só reforço visual — o estado em si é sempre um texto em
 * caixa alta (`TEXTO_POR_ESTADO`), nunca só a cor do ponto (Diretriz de
 * Implementação #7 / WCAG 1.4.1).
 */
export function SeloFonte({ nome, estado }: PropriedadesSeloFonte): ReactElement {
  return (
    <span className={estilos['selo']} data-estado={estado}>
      <span className={estilos['ponto']} aria-hidden="true" />
      <span className={estilos['nome']}>{nome}</span>
      <span className={estilos['texto']}>{TEXTO_POR_ESTADO[estado]}</span>
    </span>
  );
}
