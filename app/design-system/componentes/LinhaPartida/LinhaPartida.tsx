import type { ReactElement } from 'react';
import estilos from './LinhaPartida.module.css';

export type MandoPartida = 'casa' | 'fora';
export type ResultadoPartida = 'V' | 'E' | 'D';

interface PropriedadesDisputada {
  readonly variante: 'disputada';
  readonly data: string;
  readonly rodadaOuFase: string;
  readonly resultado: ResultadoPartida;
  readonly mandante: string;
  readonly visitante: string;
  readonly placarMandante: number;
  readonly placarVisitante: number;
  readonly mando: MandoPartida;
}

interface PropriedadesProxima {
  readonly variante: 'proxima';
  readonly data: string;
  readonly horario: string;
  readonly rodadaOuFase: string;
  readonly mandante: string;
  readonly visitante: string;
  readonly mando: MandoPartida;
  readonly estadio?: string;
}

interface PropriedadesSemHorario {
  readonly variante: 'sem-horario';
  readonly data: string;
  readonly rodadaOuFase: string;
  readonly mandante: string;
  readonly visitante: string;
  readonly mando: MandoPartida;
  readonly estadio?: string;
}

interface PropriedadesSemData {
  readonly variante: 'sem-data';
  readonly rodadaOuFase: string;
  readonly mandante: string;
  readonly visitante: string;
  readonly mando: MandoPartida;
}

interface PropriedadesAguardando {
  readonly variante: 'aguardando';
  readonly data: string;
  readonly rodadaOuFase: string;
  readonly mandante: string;
  readonly visitante: string;
}

interface PropriedadesAdiada {
  readonly variante: 'adiada';
  readonly novaData: string;
  readonly mandante: string;
  readonly visitante: string;
  readonly mando: MandoPartida;
}

interface PropriedadesCancelada {
  readonly variante: 'cancelada';
  readonly mandante: string;
  readonly visitante: string;
  readonly mando?: MandoPartida;
}

export type PropriedadesLinhaPartida =
  | PropriedadesDisputada
  | PropriedadesProxima
  | PropriedadesSemHorario
  | PropriedadesSemData
  | PropriedadesAguardando
  | PropriedadesAdiada
  | PropriedadesCancelada;

const ROTULO_RESULTADO: Record<ResultadoPartida, string> = {
  V: 'Vitória',
  E: 'Empate',
  D: 'Derrota',
};

const ROTULO_MANDO: Record<MandoPartida, string> = {
  casa: 'casa',
  fora: 'fora',
};

function confronto(mandante: string, visitante: string): string {
  return `${mandante} × ${visitante}`;
}

/**
 * `LinhaPartida` (UX-SPEC §3.8): data, confronto, mando, placar ou horário,
 * marcador V/E/D. Variantes disputada · próxima · sem horário · sem data ·
 * adiada · cancelada · aguardando (UX-SPEC §3.8, wireframe T-06 "DISPUTADAS"/
 * "PRÓXIMAS", CA-08.7 a CA-08.10, CA-08.9, CA-10.4).
 *
 * Renderiza um `<li>` — o componente que a usa é responsável por envolver a
 * lista em `<ul>`/`<ol>`, conforme a tela (Diretriz de não-mistura). O
 * marcador V/E/D é sempre letra + texto (`ROTULO_RESULTADO`), nunca só a cor
 * da barra lateral (Diretriz de Implementação #7).
 */
export function LinhaPartida(propriedades: PropriedadesLinhaPartida): ReactElement {
  const { variante, mandante, visitante } = propriedades;

  return (
    <li
      className={estilos['linha']}
      data-variante={variante}
      data-resultado={variante === 'disputada' ? propriedades.resultado : undefined}
    >
      {variante === 'disputada' ? (
        <>
          <span className={estilos['cabecalho']}>
            {propriedades.data} · {propriedades.rodadaOuFase}
          </span>
          <span className={estilos['corpo']} data-resultado={propriedades.resultado}>
            <span className={estilos['marcadorResultado']}>
              ({propriedades.resultado})
            </span>{' '}
            <span className={estilos['somenteLeitorDeTela']}>
              {ROTULO_RESULTADO[propriedades.resultado]}:{' '}
            </span>
            {mandante} {propriedades.placarMandante} × {propriedades.placarVisitante}{' '}
            {visitante} · {ROTULO_MANDO[propriedades.mando]}
          </span>
        </>
      ) : null}

      {variante === 'proxima' ? (
        <>
          <span className={estilos['cabecalho']}>
            {propriedades.data} · {propriedades.horario} · {propriedades.rodadaOuFase}
          </span>
          <span className={estilos['corpo']}>
            {confronto(mandante, visitante)} · {ROTULO_MANDO[propriedades.mando]}
            {propriedades.estadio ? ` · ${propriedades.estadio}` : ''}
          </span>
        </>
      ) : null}

      {variante === 'sem-horario' ? (
        <>
          <span className={estilos['cabecalho']}>
            {propriedades.data} · HORÁRIO A DEFINIR · {propriedades.rodadaOuFase}
          </span>
          <span className={estilos['corpo']}>
            {confronto(mandante, visitante)} · {ROTULO_MANDO[propriedades.mando]}
            {propriedades.estadio ? ` · ${propriedades.estadio}` : ''}
          </span>
        </>
      ) : null}

      {variante === 'sem-data' ? (
        <>
          <span className={estilos['cabecalho']}>
            DATA A DEFINIR · {propriedades.rodadaOuFase}
          </span>
          <span className={estilos['corpo']}>
            {confronto(mandante, visitante)} · {ROTULO_MANDO[propriedades.mando]}
          </span>
        </>
      ) : null}

      {variante === 'aguardando' ? (
        <>
          <span className={estilos['cabecalho']}>
            <span aria-hidden="true">⏳</span> AGUARDANDO RESULTADO
          </span>
          <span className={estilos['corpo']}>
            {propriedades.data} · {propriedades.rodadaOuFase} ·{' '}
            {confronto(mandante, visitante)}
          </span>
        </>
      ) : null}

      {variante === 'adiada' ? (
        <>
          <span className={estilos['cabecalho']}>
            <span aria-hidden="true">⚠</span> ADIADA — NOVA DATA: {propriedades.novaData}
          </span>
          <span className={estilos['corpo']}>
            {confronto(mandante, visitante)} · {ROTULO_MANDO[propriedades.mando]}
          </span>
        </>
      ) : null}

      {variante === 'cancelada' ? (
        <>
          <span className={estilos['cabecalho']}>Cancelada</span>
          <span className={estilos['corpo']}>
            {confronto(mandante, visitante)}
            {propriedades.mando ? ` · ${ROTULO_MANDO[propriedades.mando]}` : ''}
          </span>
        </>
      ) : null}
    </li>
  );
}
