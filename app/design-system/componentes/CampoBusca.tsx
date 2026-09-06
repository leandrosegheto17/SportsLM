import type { ChangeEvent, ReactElement } from 'react';
import estilos from './CampoBusca.module.css';

export interface PropriedadesCampoBusca {
  /** Nome acessível do campo (não há rótulo visível na anatomia UX-SPEC §3.8). */
  readonly rotulo: string;
  readonly valor: string;
  readonly aoMudar: (valor: string) => void;
  readonly placeholder?: string;
  /**
   * `true` quando a busca já foi feita e não há resultado — dispara o
   * anúncio de "sem resultado" (variante da tabela UX-SPEC §3.8) via
   * `role="status"`, sem depender de nova prop de tela por tela.
   */
  readonly semResultado?: boolean;
  readonly mensagemSemResultado?: string;
}

/**
 * `CampoBusca` — UI-DS-07A (UX-SPEC §3.8: "lupa, entrada, ✕"; variantes
 * vazio · preenchido · sem resultado).
 *
 * `<input type="search">` nativo — operável por teclado (digitação, Tab).
 * O botão "✕" (limpar) só aparece preenchido (variante "preenchido") e é um
 * `<button>` nativo próprio, também operável por teclado. O ícone de lupa é
 * `aria-hidden` (decorativo, o nome acessível vem de `rotulo`).
 */
export function CampoBusca({
  rotulo,
  valor,
  aoMudar,
  placeholder,
  semResultado = false,
  mensagemSemResultado = 'Nenhum resultado encontrado.',
}: PropriedadesCampoBusca): ReactElement {
  function aoDigitar(evento: ChangeEvent<HTMLInputElement>): void {
    aoMudar(evento.target.value);
  }

  return (
    <div className={estilos['campo']}>
      <span className={estilos['lupa']} aria-hidden="true">
        🔍
      </span>
      <input
        type="search"
        className={estilos['entrada']}
        aria-label={rotulo}
        value={valor}
        placeholder={placeholder}
        onChange={aoDigitar}
      />
      {valor.length > 0 ? (
        <button
          type="button"
          className={estilos['botaoLimpar']}
          aria-label="Limpar busca"
          onClick={() => aoMudar('')}
        >
          ✕
        </button>
      ) : null}
      {semResultado ? (
        <p role="status" className={estilos['semResultado']}>
          {mensagemSemResultado}
        </p>
      ) : null}
    </div>
  );
}
