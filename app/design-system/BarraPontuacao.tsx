import type { ReactElement } from 'react';
import estilos from './BarraPontuacao.module.css';

export interface BarraPontuacaoProps {
  /** Nome do clube, sempre incluído no `aria-label` (UX-SPEC §3.8.6). */
  nomeClube: string;
  /** Valor numérico representado pela barra (ex.: pontos), sempre incluído no `aria-label`. */
  valor: number;
  /**
   * Âncora da escala (UX-SPEC §3.8.6: "escala comum a todos os clubes da
   * comparação, com o máximo ancorado no maior valor da tela") — normalmente
   * o maior `valor` entre todas as `BarraPontuacao` exibidas juntas, nunca um
   * máximo teórico do próprio clube.
   */
  valorMaximo: number;
  /** Unidade falada no `aria-label` (ex.: "pontos", "vitórias"). Padrão: "pontos". */
  unidade?: string;
  /** Rótulo textual do clube exibido ao lado da barra. Quando ausente, usa `nomeClube`. */
  rotuloVisivel?: string;
}

/**
 * `BarraPontuacao` (UI-DS-06, UX-SPEC §3.8.6) — barra horizontal preenchida na
 * cor do clube (`--clube-identidade`, ADR-017), usada em "A BRIGA" e no
 * acumulado da simulação.
 *
 * Acessibilidade (Diretriz de Implementação #7 — pistas redundantes de WCAG
 * 1.4.1, nunca só cor): o comprimento/cor da barra nunca é a única forma de
 * saber o valor — o número aparece sempre como texto visível ao lado, e o
 * conjunto inteiro tem `role="img"` com `aria-label` textual equivalente
 * ("{clube}, {valor} {unidade}"), lido de uma vez por leitor de tela em vez
 * de expor o preenchimento interno como conteúdo solto.
 */
export function BarraPontuacao({
  nomeClube,
  valor,
  valorMaximo,
  unidade = 'pontos',
  rotuloVisivel,
}: BarraPontuacaoProps): ReactElement {
  const percentual =
    valorMaximo > 0 ? Math.min(100, Math.max(0, (valor / valorMaximo) * 100)) : 0;
  const ariaLabel = `${nomeClube}, ${valor} ${unidade}`;

  return (
    <div className={estilos['contêiner']}>
      <span className={estilos['rotulo']} aria-hidden="true">
        {rotuloVisivel ?? nomeClube}
      </span>
      <div
        className={estilos['trilho']}
        role="img"
        aria-label={ariaLabel}
        data-testid="barra-pontuacao-trilho"
      >
        <div className={estilos['preenchimento']} style={{ width: `${percentual}%` }} />
      </div>
      <span className={estilos['valor']} aria-hidden="true">
        {valor}
      </span>
    </div>
  );
}
