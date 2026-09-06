import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import estilos from './Sobreposicao.module.css';

export interface PropriedadesSobreposicao {
  readonly titulo: string;
  readonly aberta: boolean;
  readonly aoFechar: () => void;
  readonly children: ReactNode;
  /**
   * folha (celular) · modal (desktop), UX-SPEC §3.8. Puramente visual — o
   * comportamento (Esc/toque fora/foco) é idêntico nas duas variantes;
   * responsividade real (folha no mobile, modal no desktop) fica a cargo do
   * CSS quando não informado explicitamente.
   */
  readonly variante?: 'folha' | 'modal' | 'automatica';
  /** Conteúdo extra da barra de ação (rodapé), quando a tela precisar. */
  readonly barraDeAcao?: ReactNode;
}

const SELETOR_FOCAVEIS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * `Sobreposicao` — UI-DS-07A (UX-SPEC §1.3/§3.8: "cabeçalho preto com título
 * e ✕, corpo rolável, barra de ação"; variantes folha (celular) · modal
 * (desktop)).
 *
 * Fecha com Esc, com toque fora (clique no véu/backdrop) e com o botão
 * "Fechar" — as 3 formas do critério de aceite de UI-DS-07A — e devolve o
 * foco ao elemento que estava focado antes de abrir (mesmo contrato do
 * `SobreposicaoPlaceholder` de FUND-04, agora com foco-trap completo: Tab
 * dentro do diálogo nunca escapa para o restante da página).
 *
 * Renderizada via `createPortal` em `document.body` (parte de `react-dom`,
 * já uma dependência autorizada — SDD §3 — não é biblioteca nova) para
 * garantir empilhamento correto sobre o resto da SPA.
 */
export function Sobreposicao({
  titulo,
  aberta,
  aoFechar,
  children,
  variante = 'automatica',
  barraDeAcao,
}: PropriedadesSobreposicao): ReactElement | null {
  const referenciaDialogo = useRef<HTMLDivElement | null>(null);
  const elementoAnteriorAoAbrir = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (aberta) {
      elementoAnteriorAoAbrir.current = document.activeElement as HTMLElement | null;
      return;
    }

    elementoAnteriorAoAbrir.current?.focus();
    elementoAnteriorAoAbrir.current = null;
  }, [aberta]);

  useEffect(() => {
    if (!aberta) {
      return undefined;
    }

    const dialogo = referenciaDialogo.current;
    const primeiroFocavel = dialogo?.querySelector<HTMLElement>(SELETOR_FOCAVEIS);
    (primeiroFocavel ?? dialogo)?.focus();

    return undefined;
  }, [aberta]);

  useEffect(() => {
    if (!aberta) {
      return undefined;
    }

    function aoPressionarTecla(evento: KeyboardEvent): void {
      if (evento.key === 'Escape') {
        aoFechar();
        return;
      }

      if (evento.key !== 'Tab') {
        return;
      }

      const dialogo = referenciaDialogo.current;
      if (!dialogo) {
        return;
      }

      const focaveis = Array.from(
        dialogo.querySelectorAll<HTMLElement>(SELETOR_FOCAVEIS),
      );
      if (focaveis.length === 0) {
        evento.preventDefault();
        return;
      }

      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (!primeiro || !ultimo) {
        return;
      }

      const emEdicao = document.activeElement;

      if (evento.shiftKey && emEdicao === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && emEdicao === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      } else if (!dialogo.contains(emEdicao)) {
        // Foco escapou do diálogo (ex.: foi movido programaticamente) —
        // traz de volta para o primeiro elemento focável.
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener('keydown', aoPressionarTecla);
    return () => document.removeEventListener('keydown', aoPressionarTecla);
  }, [aberta, aoFechar]);

  if (!aberta) {
    return null;
  }

  function aoClicarNoVeu(evento: ReactMouseEvent<HTMLDivElement>): void {
    if (evento.target === evento.currentTarget) {
      aoFechar();
    }
  }

  function aoClicarNoDialogo(evento: ReactMouseEvent<HTMLDivElement>): void {
    // Impede que o clique dentro do diálogo borbulhe até o véu e feche por
    // engano (toque fora só deve fechar quando o clique é realmente fora).
    evento.stopPropagation();
  }

  const classeVariante =
    variante === 'folha'
      ? estilos['folha']
      : variante === 'modal'
        ? estilos['modal']
        : estilos['automatica'];

  return createPortal(
    <div className={estilos['veu']} onClick={aoClicarNoVeu}>
      <div
        ref={referenciaDialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sobreposicao-titulo"
        className={`${estilos['dialogo']} ${classeVariante}`}
        onClick={aoClicarNoDialogo}
        tabIndex={-1}
        onKeyDown={(evento: ReactKeyboardEvent<HTMLDivElement>) => {
          // Mantido apenas por completude do contrato de teclado do
          // elemento; o fechamento por Esc/foco-trap real acontece no
          // listener de `document` acima (cobre também Tab a partir de
          // qualquer elemento focável dentro do diálogo).
          if (evento.key === 'Escape') {
            aoFechar();
          }
        }}
      >
        <header className={estilos['cabecalho']}>
          <h2 id="sobreposicao-titulo" className={estilos['titulo']}>
            {titulo}
          </h2>
          <button
            type="button"
            className={estilos['botaoFechar']}
            onClick={aoFechar}
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>
        <div className={estilos['corpo']}>{children}</div>
        {barraDeAcao ? (
          <footer className={estilos['barraDeAcao']}>{barraDeAcao}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
