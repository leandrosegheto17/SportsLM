import type { CSSProperties, ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { PaletaClube } from '../../dominio/tipos/futebol';
import estilos from './FaixaClube.module.css';

/**
 * `FaixaClube` — UI-DS-01 (TASK.md Lote 7, UX-SPEC §3.8.1). Componente que
 * "define a direção" visual do produto: identidade do clube em listras
 * diagonais (`--clube-identidade` + `--clube-faixa-b`), avatar com a sigla,
 * nome e (na variante completa) a posição/pontos do clube no Brasileirão.
 *
 * Três variantes (UX-SPEC §3.8.1):
 * - `completa`: home/painel — altura definida por
 *   `--faixaclube-altura-completa` (tokens.css), com avatar, nome e número
 *   da posição.
 * - `compacta`: cabeçalhos internos — 72 px (`--faixaclube-altura-compacta`),
 *   sem número (a anatomia da variante nunca mostra `posicao`/`pontos`, ainda
 *   que informados via prop — eles continuam entrando no `aria-label`).
 * - `neutra`: sem time escolhido — tinta e cinza, sem número, com o texto
 *   "SPORTSLM" (idêntico ao tratamento acromático, UX-SPEC §3.4).
 *
 * Discriminated union por `variante` (Diretriz de Implementação #1 —
 * TypeScript estrito): a variante `neutra` não aceita `clube`, tornando
 * impossível em tempo de compilação passar um clube junto de "sem time
 * escolhido". As variantes `completa`/`compacta` exigem `clube`.
 *
 * Cor de clube (UX-SPEC §3.4/§3.8.1, ADR-017): a `PaletaClube` chega pronta
 * (derivada e validada no pipeline por PUB-01, Lote 6 — "SPA nunca calcula a
 * paleta", TASK.md §6 item 6); este componente só injeta os valores como
 * `custom properties` inline, nunca literal em CSS (Diretriz de Implementação
 * #4). Como `--clube-identidade`/`--clube-faixa-b`/`--clube-identidade-texto`
 * variam por tema (UX-SPEC §3.3) e a `PaletaClube` carrega os dois conjuntos
 * (`identidade`/`identidadeEscuro` etc.), a escolha de qual conjunto vale é
 * feita em CSS puro — `FaixaClube.module.css` redefine as mesmas três custom
 * properties dentro de `:global(html[data-tema='escuro'])`, a partir de
 * variáveis intermediárias (`--fc-*-clara`/`--fc-*-escura`) setadas aqui —
 * mesmo mecanismo "sem F5" que já troca o tema do resto da aplicação (o
 * atributo `data-tema` já existe em `<html>`, escrito por `app/tema/tema.ts`,
 * FUND-05). Quando não há `clube` (variante `neutra`), nenhuma variável
 * intermediária é setada e o componente cai no fallback ambiente de
 * `tokens.css` — que já é o tratamento acromático "sem time" em ambos os
 * temas.
 */

export interface ClubeParaFaixa {
  readonly nome: string;
  /** Sigla de 3 letras exibida no avatar (RN-04). */
  readonly sigla: string;
  readonly paleta: PaletaClube;
}

interface PropsComuns {
  /** Rota interna (`react-router-dom`) para onde a faixa leva ao ser
   * clicada/ativada por teclado (UX-SPEC §3.8.1: "a faixa inteira é clicável
   * na home"). Ausente ⇒ elemento não interativo (ex.: cabeçalho interno). */
  readonly href?: string;
  readonly className?: string;
}

export type FaixaClubeProps =
  | ({ readonly variante: 'neutra' } & PropsComuns)
  | ({
      readonly variante: 'completa' | 'compacta';
      readonly clube: ClubeParaFaixa;
      /** Nome do campeonato, ex. "Brasileirão Série A" — usado no `aria-label`
       * completo (UX-SPEC: "6º lugar no Brasileirão Série A de 2026"). */
      readonly competicaoNome?: string;
      readonly temporada?: number;
      /** `null`/ausente ⇒ "sem dados" (CA-06.4/CA-17.3): a variante `completa`
       * mostra a identidade cheia, mas sem o bloco de número. */
      readonly posicao?: number | null;
      readonly pontos?: number | null;
    } & PropsComuns);

function montarAriaLabel(props: FaixaClubeProps): string {
  if (props.variante === 'neutra') {
    return props.href
      ? 'SportsLM. Nenhum time escolhido. Escolher time.'
      : 'SportsLM. Nenhum time escolhido.';
  }

  const partes: string[] = [props.clube.nome];

  if (props.posicao != null && props.competicaoNome) {
    const temporadaTexto = props.temporada != null ? ` de ${props.temporada}` : '';
    partes.push(`${props.posicao}º lugar no ${props.competicaoNome}${temporadaTexto}`);
  }

  if (props.pontos != null) {
    partes.push(`${props.pontos} pontos`);
  }

  const descricao = `${partes.join(', ')}.`;
  return props.href ? `${descricao} Abrir painel do time.` : descricao;
}

function estiloClube(paleta: PaletaClube): CSSProperties {
  return {
    '--fc-identidade-clara': paleta.identidade,
    '--fc-identidade-escura': paleta.identidadeEscuro,
    '--fc-faixab-clara': paleta.faixaB,
    '--fc-faixab-escura': paleta.faixaBEscuro,
    '--fc-identidade-texto-clara': paleta.identidadeTexto,
    '--fc-identidade-texto-escura': paleta.identidadeTextoEscuro,
    '--fc-acento': paleta.acento,
  } as CSSProperties;
}

export function FaixaClube(props: FaixaClubeProps): ReactElement {
  const rotuloAcessivel = montarAriaLabel(props);
  const mostrarNumero =
    props.variante === 'completa' && props.posicao != null && props.pontos != null;

  const classeVariante =
    props.variante === 'completa'
      ? estilos['completa']
      : props.variante === 'compacta'
        ? estilos['compacta']
        : estilos['neutra'];

  const classes = [estilos['raiz'], classeVariante, props.className]
    .filter((valor): valor is string => Boolean(valor))
    .join(' ');

  const estiloInline =
    props.variante === 'neutra' ? undefined : estiloClube(props.clube.paleta);

  const conteudo = (
    <>
      <span aria-hidden="true" className={estilos['listras']} />
      {props.variante === 'neutra' ? (
        <span className={estilos['marca']}>SportsLM</span>
      ) : (
        <>
          <span className={estilos['avatar']}>{props.clube.sigla}</span>
          <span className={estilos['identidade']}>
            <span className={estilos['nome']}>{props.clube.nome}</span>
            {props.competicaoNome ? (
              <span className={estilos['linhaSecundaria']}>
                {props.competicaoNome}
                {props.temporada != null ? ` ${props.temporada}` : ''}
              </span>
            ) : null}
          </span>
          {mostrarNumero ? (
            <span className={estilos['numeroBloco']}>
              <span className={estilos['numero']}>{props.posicao}º</span>
              <span className={estilos['pontos']}>{props.pontos} pts</span>
            </span>
          ) : null}
        </>
      )}
    </>
  );

  if (props.href) {
    return (
      <Link
        to={props.href}
        className={classes}
        style={estiloInline}
        aria-label={rotuloAcessivel}
      >
        {conteudo}
      </Link>
    );
  }

  return (
    <div
      className={classes}
      style={estiloInline}
      role="group"
      aria-label={rotuloAcessivel}
    >
      {conteudo}
    </div>
  );
}
