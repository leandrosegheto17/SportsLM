import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './BlocoPreto.module.css';

/**
 * BlocoPreto — UI-DS-02 (UX-SPEC §3.8.2).
 *
 * Variantes: "próximo jogo", "a briga", "projeção" (fixo ao rolar), "resumo
 * do campeonato" e "campeonatos" (lista compacta no desktop).
 */
export type VarianteBlocoPreto =
  | 'proximo-jogo'
  | 'a-briga'
  | 'projecao'
  | 'resumo'
  | 'campeonatos';

const CLASSE_POR_VARIANTE: Record<VarianteBlocoPreto, string> = {
  'proximo-jogo': styles['proximoJogo'] ?? '',
  'a-briga': styles['aBriga'] ?? '',
  projecao: styles['projecao'] ?? '',
  resumo: styles['resumo'] ?? '',
  campeonatos: styles['campeonatos'] ?? '',
};

export interface BlocoPretoProps {
  /** Determina anatomia/posicionamento (UX-SPEC §3.8.2). */
  variante: VarianteBlocoPreto;
  /**
   * Texto da tira superior (--txt-rotulo). Sempre um nó de texto (Diretriz de
   * Implementação #5 — nunca `dangerouslySetInnerHTML`) e sempre presente:
   * é a pista redundante de significado da variante (WCAG 1.4.1, Diretriz #7)
   * — a cor da tira nunca é a única forma de identificar o bloco.
   */
  rotulo: string;
  children: ReactNode;
  className?: string;
  /** Repassado para o elemento raiz (ex.: `aria-live`, `role`). */
  ariaLive?: 'polite' | 'assertive' | 'off';
}

/**
 * Nome da custom property publicada em `:root` pela variante "projeção"
 * (UX-SPEC §5.2: "Foco nunca obscurecido [...] pelo bloco PROJEÇÃO fixo —
 * garantido por `scroll-margin` nos elementos focáveis", WCAG 2.4.11).
 *
 * Contrato para quem consome esta variante (ex.: UI-T09-02, Lote 9): todo
 * elemento focável que possa ficar por baixo do bloco fixo ao rolar deve
 * declarar `scroll-margin-bottom: var(--bloco-preto-projecao-altura)`.
 * Como reforço — para não depender só de cada tela lembrar de aplicar o
 * `scroll-margin` — este componente também escreve a mesma medida como
 * `scroll-padding-bottom` do documento inteiro enquanto estiver montado, o
 * que já garante o critério de aceite (foco nunca obscurecido) mesmo sem
 * nenhuma tela aplicar o `scroll-margin` individualmente.
 */
export const PROPRIEDADE_ALTURA_PROJECAO = '--bloco-preto-projecao-altura';

export function BlocoPreto({
  variante,
  rotulo,
  children,
  className,
  ariaLive,
}: BlocoPretoProps): JSX.Element {
  const referenciaBloco = useRef<HTMLDivElement>(null);

  // UX-SPEC §5.2 / WCAG 2.4.11: a variante "projeção" fica fixa ao rolar
  // (`position: fixed`, ver BlocoPreto.module.css) — sem contrapartida, ela
  // poderia esconder um elemento com foco por baixo dela. Medimos a altura
  // real (varia por tema/largura/conteúdo) e publicamos como reserva de
  // espaço de rolagem, restaurando o valor anterior ao desmontar para não
  // vazar efeito para outras telas.
  useLayoutEffect(() => {
    if (variante !== 'projecao') {
      return undefined;
    }

    const elemento = referenciaBloco.current;
    if (!elemento) {
      return undefined;
    }

    const raiz = document.documentElement;
    const valorAnteriorPropriedade = raiz.style.getPropertyValue(
      PROPRIEDADE_ALTURA_PROJECAO,
    );
    const valorAnteriorScrollPadding = raiz.style.getPropertyValue(
      'scroll-padding-bottom',
    );

    const publicarAltura = (): void => {
      const altura = elemento.getBoundingClientRect().height;
      raiz.style.setProperty(PROPRIEDADE_ALTURA_PROJECAO, `${altura}px`);
      raiz.style.setProperty('scroll-padding-bottom', `${altura}px`);
    };

    publicarAltura();

    let observadorRedimensionamento: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observadorRedimensionamento = new ResizeObserver(publicarAltura);
      observadorRedimensionamento.observe(elemento);
    } else {
      // Sem ResizeObserver (ambiente sem suporte): reserva de segurança para
      // recalcular ao menos na virada de orientação/redimensionamento —
      // sem adicionar dependência de runtime nova (Diretriz #3).
      window.addEventListener('resize', publicarAltura);
    }

    return () => {
      observadorRedimensionamento?.disconnect();
      window.removeEventListener('resize', publicarAltura);

      if (valorAnteriorPropriedade) {
        raiz.style.setProperty(PROPRIEDADE_ALTURA_PROJECAO, valorAnteriorPropriedade);
      } else {
        raiz.style.removeProperty(PROPRIEDADE_ALTURA_PROJECAO);
      }

      if (valorAnteriorScrollPadding) {
        raiz.style.setProperty('scroll-padding-bottom', valorAnteriorScrollPadding);
      } else {
        raiz.style.removeProperty('scroll-padding-bottom');
      }
    };
  }, [variante]);

  const classes = [styles['bloco'], CLASSE_POR_VARIANTE[variante], className]
    .filter((valor): valor is string => Boolean(valor))
    .join(' ');

  return (
    <div
      ref={referenciaBloco}
      className={classes}
      data-variante={variante}
      aria-live={ariaLive}
    >
      <div className={styles['tira']}>{rotulo}</div>
      <div className={styles['corpo']}>{children}</div>
    </div>
  );
}
