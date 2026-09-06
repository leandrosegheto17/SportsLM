import { useEffect, useRef, type ReactElement } from 'react';

interface PropriedadesSobreposicaoPlaceholder {
  /** Id da tela no UX-SPEC §1.1 (ex.: "T-03"). */
  readonly idTela: string;
  readonly nomeDaTela: string;
  readonly aberta: boolean;
  readonly aoFechar: () => void;
}

/**
 * Placeholder estrutural comum às 3 sobreposições sem rota (ADR-003: T-03
 * configurações, T-04 escolher/trocar time, T-07 escolher rivais). Ainda sem
 * conteúdo de tela (Lotes 9/11) e sem o componente `Sobreposicao` definitivo
 * do design system (UI-DS-07A, Lote 7) — aqui só o suficiente para provar a
 * estrutura de `app/rotas` e o comportamento mínimo exigido pelo UX-SPEC §1.3
 * ("fecham com Esc, com toque fora e com 'Fechar'; o foco volta ao gatilho"):
 * Esc fecha e o foco retorna ao elemento que estava focado antes de abrir.
 * Estilo/foco-trap/toque-fora completos ficam para UI-DS-07A.
 */
export function SobreposicaoPlaceholder({
  idTela,
  nomeDaTela,
  aberta,
  aoFechar,
}: PropriedadesSobreposicaoPlaceholder): ReactElement | null {
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

    function aoPressionarTecla(evento: KeyboardEvent): void {
      if (evento.key === 'Escape') {
        aoFechar();
      }
    }

    document.addEventListener('keydown', aoPressionarTecla);
    return () => document.removeEventListener('keydown', aoPressionarTecla);
  }, [aberta, aoFechar]);

  if (!aberta) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={nomeDaTela}>
      <p>
        Placeholder de {idTela} ({nomeDaTela}). Conteúdo real ainda não implementado.
      </p>
      <button type="button" onClick={aoFechar}>
        Fechar
      </button>
    </div>
  );
}
