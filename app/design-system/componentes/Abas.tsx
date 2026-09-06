import { useRef, type KeyboardEvent, type ReactElement } from 'react';
import estilos from './Abas.module.css';

export interface DefinicaoAba {
  readonly id: string;
  readonly rotulo: string;
}

export interface PropriedadesAbas {
  /** 2 a 4 abas (UX-SPEC §3.8). */
  readonly abas: readonly DefinicaoAba[];
  readonly abaAtivaId: string;
  readonly aoMudarAba: (id: string) => void;
  /** Rótulo acessível do `tablist` (ex.: "Fontes de notícia"). */
  readonly rotuloGrupo: string;
}

/**
 * `Abas` — UI-DS-07A (UX-SPEC §3.8: "rótulos em caixa alta, ativa sublinhada
 * em --clube-acento + aria-selected"; 2 a 4 abas).
 *
 * Segue o padrão WAI-ARIA de tabs com foco circulante (roving tabindex):
 * setas ←/→ movem o foco e ativam a aba (ativação automática), Home/End vão
 * para a primeira/última. Cada aba continua sendo um `<button role="tab">`
 * nativo, então Enter/Espaço também funcionam quando o foco chega por Tab.
 *
 * WCAG 1.4.1 (Diretriz #7): a aba ativa não depende só do sublinhado colorido
 * — o peso da fonte muda (`font-weight`) e `aria-selected="true"` está
 * presente para tecnologia assistiva.
 */
export function Abas({
  abas,
  abaAtivaId,
  aoMudarAba,
  rotuloGrupo,
}: PropriedadesAbas): ReactElement {
  const referencias = useRef<Map<string, HTMLButtonElement>>(new Map());

  function focarEAtivar(id: string): void {
    aoMudarAba(id);
    referencias.current.get(id)?.focus();
  }

  function aoPressionarTecla(
    evento: KeyboardEvent<HTMLButtonElement>,
    indice: number,
  ): void {
    const total = abas.length;
    if (total === 0) {
      return;
    }

    let proximoIndice: number | null = null;
    switch (evento.key) {
      case 'ArrowRight':
        proximoIndice = (indice + 1) % total;
        break;
      case 'ArrowLeft':
        proximoIndice = (indice - 1 + total) % total;
        break;
      case 'Home':
        proximoIndice = 0;
        break;
      case 'End':
        proximoIndice = total - 1;
        break;
      default:
        return;
    }

    evento.preventDefault();
    const aba = abas[proximoIndice];
    if (aba) {
      focarEAtivar(aba.id);
    }
  }

  return (
    <div className={estilos['lista']} role="tablist" aria-label={rotuloGrupo}>
      {abas.map((aba, indice) => {
        const ativa = aba.id === abaAtivaId;
        return (
          <button
            key={aba.id}
            ref={(elemento) => {
              if (elemento) {
                referencias.current.set(aba.id, elemento);
              } else {
                referencias.current.delete(aba.id);
              }
            }}
            type="button"
            role="tab"
            id={`aba-${aba.id}`}
            aria-selected={ativa}
            tabIndex={ativa ? 0 : -1}
            className={`${estilos['aba']} ${ativa ? estilos['ativa'] : ''}`.trim()}
            onClick={() => focarEAtivar(aba.id)}
            onKeyDown={(evento) => aoPressionarTecla(evento, indice)}
          >
            {aba.rotulo}
          </button>
        );
      })}
    </div>
  );
}
