import type { CSSProperties, ReactElement } from 'react';
import { Link } from 'react-router-dom';
import estilos from './CartaoIngresso.module.css';

/**
 * `CartaoIngresso` — UI-DS-03 (TASK.md Lote 7, UX-SPEC §3.8.3).
 *
 * Cartão de notícia (feed) e de campeonato: barra de 6 px na borda esquerda,
 * corpo com etiqueta + fonte + tempo, manchete e resumo. O cartão inteiro é o
 * alvo de link (UX-SPEC §3.8.3: "o alvo tem no mínimo 44 px de altura").
 *
 * Decisões de detalhe registradas (TASK.md §6):
 *
 * - `EtiquetaEsporte` (UX-SPEC, tabela de componentes de base) é UI-DS-07B,
 *   tarefa paralela e ainda `Pendente` no momento desta implementação — as 9
 *   tarefas do Lote 7 são explicitamente paralelizáveis entre si, sem
 *   depender umas das outras. Em vez de duplicar/antecipar aquele
 *   componente, `CartaoIngresso` renderiza a etiqueta como texto simples
 *   (`rotuloEtiqueta`), satisfazendo o critério de aceite desta tarefa
 *   ("etiqueta textual sempre presente") sem inventar o "fundo tonal do
 *   esporte" — paleta que também não está definida em nenhuma tabela do
 *   UX-SPEC/`tokens.css` (só é mencionada em prosa, §3.8.3/tabela de
 *   componentes de base, sem os 15 tons listados). Quando UI-DS-07B publicar
 *   o componente real, trocar aqui é mudança mecânica de composição, não de
 *   comportamento.
 * - A cor da barra não é resolvida dentro deste componente: `corBarra` é uma
 *   custom property CSS já resolvida, injetada por quem monta a tela (mesmo
 *   padrão que `app/design-system/README.md`/`tokens.css` já documentam para
 *   `--clube-*`: "o valor real é injetado inline pelo componente que
 *   conhece a configuração do clube"). Isso mantém `CartaoIngresso` livre de
 *   qualquer valor literal de cor fora de `tokens.css` (Diretriz de
 *   Implementação #4) — só usa tokens estruturais (raio, borda, espessura da
 *   barra, alvo de toque) mais a cor que o chamador resolveu. Desde
 *   2026-09-09, a paleta de 15 tons de esporte existe em `tokens.css`
 *   (`--esporte-*`); `SecaoNoticias.tsx` passa
 *   `var(--esporte-<id>, var(--cor-esmaecido))` como `corBarra`, e a
 *   etiqueta (`.etiqueta` em CartaoIngresso.module.css) deriva seu fundo
 *   tonal da mesma custom property via `color-mix()`.
 * - WCAG 1.4.1 (Diretriz de Implementação #7): a cor da barra nunca é a
 *   única pista. Toda variante tem etiqueta textual (`rotuloEtiqueta`,
 *   sempre presente) e as variantes "encerrado"/"sem dados" ainda somam um
 *   rótulo de estado textual visível (`encerrado`/`sem dados`), nunca só a
 *   mudança de cor/traço da barra. "horário estimado" usa o texto canônico
 *   exato da Diretriz de Implementação #9 (UX-SPEC §1.4), sempre visível
 *   junto do ícone `ⓘ` (nunca só o ícone, UX-SPEC §3.7).
 * - Caixa alta é decoração tipográfica (UX-SPEC §1.4): todo texto é escrito
 *   em caixa normal no HTML/props e transformado por CSS (`text-transform`),
 *   para que o leitor de tela não soletre letra a letra.
 */

export type VarianteCartaoIngresso =
  | 'normal'
  | 'agrupado'
  | 'horario-estimado'
  | 'encerrado'
  | 'sem-dados';

/** UX-SPEC §3.8.3: "esporte no feed ... clube nos cartões de campeonato e de
 * comparativo". Ignorado (a barra vira cinza/tracejada) quando `variante` é
 * `'encerrado'`/`'sem-dados'`. */
export type OrigemCorBarraCartaoIngresso = 'esporte' | 'clube';

export interface PropriedadesCartaoIngresso {
  /** URL do alvo — link externo da notícia (CA-04.2) ou rota interna do
   * campeonato/comparativo. */
  readonly href: string;
  /** `'externo'` abre em nova aba (CA-04.2, UX-SPEC §5.7); `'interno'`
   * navega por `react-router-dom`. */
  readonly destino: 'interno' | 'externo';
  /** Etiqueta textual sempre visível (esporte no feed, nome do campeonato no
   * cartão de campeonato) — a pista redundante de WCAG 1.4.1 exigida pelo
   * critério de aceite, independente da variante. */
  readonly rotuloEtiqueta: string;
  /** Nome da fonte (ex.: "ge") ou do provedor de dado do campeonato. */
  readonly fonte: string;
  /** Texto de tempo já formatado por quem monta a tela (ex.: "há 8 min",
   * "22h00") — `CarimboFrescor` real é outro componente do design system
   * (fora do escopo desta tarefa). */
  readonly tempo: string;
  /** Manchete (notícia) ou nome do confronto/resumo (campeonato). */
  readonly titulo: string;
  /** Resumo de até 3 linhas (truncamento/"…" é responsabilidade de quem
   * monta o dado, CA-04.3) — `null`/ausente omite o parágrafo. */
  readonly resumo?: string | null;
  readonly variante: VarianteCartaoIngresso;
  /** Default `'esporte'`. */
  readonly origemCorBarra?: OrigemCorBarraCartaoIngresso;
  /** Valor CSS já resolvido pelo chamador (ex.: `'var(--clube-identidade)'`
   * ou o tom de esporte correspondente) — nunca um literal desta camada. */
  readonly corBarra?: string;
  /** Exigido (e só usado) quando `variante === 'agrupado'` — "TAMBÉM EM: +N
   * fontes" (CA-19.1). */
  readonly quantidadeFontesAgrupadas?: number;
  /** Rótulo acessível completo do cartão-link. Se ausente, é derivado de
   * `titulo`/`fonte`/`destino` (UX-SPEC §5.7). */
  readonly ariaLabel?: string;
}

function construirAriaLabelPadrao(
  props: Pick<PropriedadesCartaoIngresso, 'titulo' | 'fonte' | 'destino'>,
): string {
  const base = `${props.titulo} — ${props.fonte}`;
  return props.destino === 'externo' ? `${base} — abre em nova aba` : base;
}

export function CartaoIngresso({
  href,
  destino,
  rotuloEtiqueta,
  fonte,
  tempo,
  titulo,
  resumo,
  variante,
  origemCorBarra = 'esporte',
  corBarra,
  quantidadeFontesAgrupadas,
  ariaLabel,
}: PropriedadesCartaoIngresso): ReactElement {
  const rotuloAcessivel =
    ariaLabel ?? construirAriaLabelPadrao({ titulo, fonte, destino });

  const classesBarra = [
    estilos['cartao'],
    variante === 'encerrado'
      ? estilos['barraEncerrada']
      : variante === 'sem-dados'
        ? estilos['barraSemDados']
        : origemCorBarra === 'clube'
          ? estilos['barraClube']
          : estilos['barraEsporte'],
  ].join(' ');

  const estiloBarra =
    variante === 'encerrado' || variante === 'sem-dados' || !corBarra
      ? undefined
      : ({ '--cartao-cor-barra': corBarra } as CSSProperties);

  const conteudo = (
    <>
      <span className={estilos['linhaSuperior']}>
        <span className={estilos['etiqueta']}>{rotuloEtiqueta}</span>
        <span className={estilos['fonte']}>{fonte}</span>
        <span className={estilos['tempo']}>
          {tempo}
          {variante === 'horario-estimado' && (
            <span className={estilos['horarioEstimado']}>
              <span aria-hidden="true">ⓘ</span> horário estimado
            </span>
          )}
        </span>
      </span>

      {variante === 'encerrado' && (
        <span className={estilos['rotuloEstado']}>encerrado</span>
      )}
      {variante === 'sem-dados' && (
        <span className={estilos['rotuloEstado']}>sem dados</span>
      )}

      <span className={estilos['titulo']}>{titulo}</span>

      {resumo != null && resumo !== '' && (
        <span className={estilos['resumo']}>{resumo}</span>
      )}

      {variante === 'agrupado' &&
        quantidadeFontesAgrupadas != null &&
        quantidadeFontesAgrupadas > 0 && (
          <span className={estilos['tambemEm']}>
            também em: +{quantidadeFontesAgrupadas} fontes
          </span>
        )}
    </>
  );

  if (destino === 'interno') {
    return (
      <Link
        to={href}
        className={classesBarra}
        style={estiloBarra}
        aria-label={rotuloAcessivel}
      >
        {conteudo}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={classesBarra}
      style={estiloBarra}
      aria-label={rotuloAcessivel}
    >
      {conteudo}
    </a>
  );
}
