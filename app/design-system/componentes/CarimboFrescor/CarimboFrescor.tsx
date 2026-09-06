import type { ReactElement } from 'react';
import estilos from './CarimboFrescor.module.css';

export type EstadoCarimboFrescor = 'normal' | 'alerta' | 'sem-dados' | 'pausado';

interface PropriedadesCarimboFrescor {
  readonly estado: EstadoCarimboFrescor;
  /**
   * Texto canônico já formatado pela tela chamadora (RF-17: "atualizado há
   * <tempo>", "Sem dados disponíveis no momento", "Atualização pausada por
   * limite do provedor...", CA-17.1 a CA-17.4 — Diretriz de Implementação #9,
   * este componente nunca compõe o texto).
   */
  readonly texto: string;
  /** ISO 8601 do momento do dado, para `<time dateTime>` (CA-17.1). Ausente
   * em `sem-dados` (E1: nunca houve atualização, CA-17.3). */
  readonly dataHoraIso?: string;
}

/** `ⓘ` para normal/sem-dados/pausado, `⚠` para alerta (RF-17, CA-17.2) —
 * ícone sempre acompanhado do texto (UX-SPEC §3.7), nunca a única pista. */
const ICONE_POR_ESTADO: Record<EstadoCarimboFrescor, string> = {
  normal: 'ⓘ',
  alerta: '⚠',
  'sem-dados': 'ⓘ',
  pausado: 'ⓘ',
};

/**
 * `CarimboFrescor` (UX-SPEC §3.8, RF-17): `ⓘ`/`⚠` + `<time>`, em `--txt-meta`.
 * Variantes normal · alerta · sem dados · pausado.
 */
export function CarimboFrescor({
  estado,
  texto,
  dataHoraIso,
}: PropriedadesCarimboFrescor): ReactElement {
  return (
    <span className={estilos['carimbo']} data-estado={estado}>
      <span aria-hidden="true">{ICONE_POR_ESTADO[estado]}</span>{' '}
      {dataHoraIso !== undefined ? (
        <time dateTime={dataHoraIso}>{texto}</time>
      ) : (
        <span>{texto}</span>
      )}
    </span>
  );
}
