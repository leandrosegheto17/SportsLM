import type { CSSProperties, ReactElement } from 'react';
import estilos from './TabelaClassificacao.module.css';

export type TokenDeZonaTabela =
  | 'libertadores'
  | 'pre-libertadores'
  | 'sul-americana'
  | 'rebaixamento';

const VAR_CSS_POR_TOKEN: Record<TokenDeZonaTabela, string> = {
  libertadores: '--zona-libertadores',
  'pre-libertadores': '--zona-pre-libertadores',
  'sul-americana': '--zona-sul-americana',
  rebaixamento: '--zona-rebaixamento',
};

export interface ZonaDaLinha {
  readonly token: TokenDeZonaTabela;
  /** Rótulo textual da zona (ex.: "LIBERTADORES") — a faixa de cor nunca é a
   * única pista (CA-18.1, WCAG 1.4.1); usado também na legenda. */
  readonly rotulo: string;
}

export interface LinhaTabelaClassificacao {
  readonly posicao: number;
  readonly clubeId: string;
  readonly siglaClube: string;
  readonly nomeClube: string;
  readonly pontos: number;
  readonly jogos: number;
  readonly v: number;
  readonly e: number;
  readonly d: number;
  readonly gp: number;
  readonly gc: number;
  readonly sg: number;
  /** Percentual de aproveitamento (I-13), já calculado (0-100). */
  readonly aproveitamento: number;
  /** Cor bruta do clube (`--clube-identidade`), para a barra da linha. Sem
   * ela, a linha ainda é identificável por texto (posição + nome +, se for o
   * caso, o marcador "SEU TIME"). */
  readonly corIdentidade?: string;
  /** `true` para a linha do time do usuário (CA-14, `aria-current`). */
  readonly ehTimeDoUsuario?: boolean;
  readonly zona?: ZonaDaLinha | null;
}

export type VarianteTabelaClassificacao = 'completa' | 'reduzida';

interface PropriedadesTabelaClassificacao {
  /** `<caption>` dinâmico (ex.: "Classificação — Brasileirão Série A, 24ª
   * rodada"). Nunca omitido — é o que dá nome à tabela para leitor de tela. */
  readonly legenda: string;
  readonly linhas: readonly LinhaTabelaClassificacao[];
  /** completa: # CLUBE P J V E D GP GC SG % · reduzida: # CLUBE P J SG %
   * (UX-SPEC §3.8, wireframe T-06 mobile/desktop). */
  readonly variante?: VarianteTabelaClassificacao;
  /** Legenda de zonas (CA-18.1). Ausente/vazia → tabela sem faixas e sem
   * legenda, sem erro (CA-18.2) — nunca uma mensagem de "zona indisponível". */
  readonly legendaZonas?: readonly ZonaDaLinha[];
}

function formatarAproveitamento(valor: number): string {
  return `${valor.toFixed(1).replace('.', ',')}%`;
}

/**
 * `TabelaClassificacao` (UX-SPEC §3.8): `<table>` real com `<caption>`, faixa
 * de zona, linha do time em `--clube-suave` com barra na cor do clube.
 * Critério de aceite (UI-DS-07B): `<table>` real com `<caption>`, `scope`,
 * `aria-current` na linha do time; nenhuma informação depende só de cor —
 * zona e "seu time" sempre têm rótulo textual paralelo à cor.
 */
export function TabelaClassificacao({
  legenda,
  linhas,
  variante = 'reduzida',
  legendaZonas,
}: PropriedadesTabelaClassificacao): ReactElement {
  const completa = variante === 'completa';

  return (
    <>
      <table className={estilos['tabela']} data-variante={variante}>
        <caption className={estilos['legenda']}>{legenda}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Clube</th>
            <th scope="col">P</th>
            <th scope="col">J</th>
            {completa ? (
              <>
                <th scope="col">V</th>
                <th scope="col">E</th>
                <th scope="col">D</th>
                <th scope="col">GP</th>
                <th scope="col">GC</th>
              </>
            ) : null}
            <th scope="col">SG</th>
            <th scope="col">%</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const estilo: CSSProperties & Record<string, string> = {};
            if (linha.corIdentidade !== undefined) {
              estilo['--clube-identidade'] = linha.corIdentidade;
            }
            const tokenZona = linha.zona
              ? VAR_CSS_POR_TOKEN[linha.zona.token]
              : undefined;
            if (tokenZona !== undefined) {
              estilo['--cor-zona-linha'] = `var(${tokenZona})`;
            }

            return (
              <tr
                key={linha.clubeId}
                className={estilos['linha']}
                style={estilo}
                data-time-do-usuario={linha.ehTimeDoUsuario === true ? 'true' : undefined}
                data-zona={linha.zona?.token}
                aria-current={linha.ehTimeDoUsuario === true ? 'true' : undefined}
              >
                <td>{linha.posicao}º</td>
                <th scope="row">
                  {linha.ehTimeDoUsuario === true ? (
                    <span aria-hidden="true" className={estilos['marcador']}>
                      ▸{' '}
                    </span>
                  ) : null}
                  {linha.siglaClube} {linha.nomeClube}
                  {linha.ehTimeDoUsuario === true ? (
                    <span className={estilos['somenteLeitorDeTela']}> (seu time)</span>
                  ) : null}
                </th>
                <td>{linha.pontos}</td>
                <td>{linha.jogos}</td>
                {completa ? (
                  <>
                    <td>{linha.v}</td>
                    <td>{linha.e}</td>
                    <td>{linha.d}</td>
                    <td>{linha.gp}</td>
                    <td>{linha.gc}</td>
                  </>
                ) : null}
                <td>{linha.sg >= 0 ? `+${linha.sg}` : linha.sg}</td>
                <td>{formatarAproveitamento(linha.aproveitamento)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {legendaZonas && legendaZonas.length > 0 ? (
        <ul
          className={estilos['listaLegendaZonas']}
          aria-label="Legenda de zonas da tabela"
        >
          {legendaZonas.map((zona) => (
            <li key={zona.token} className={estilos['itemLegendaZona']}>
              <span
                aria-hidden="true"
                className={estilos['marcadorZona']}
                style={{ background: `var(${VAR_CSS_POR_TOKEN[zona.token]})` }}
              />
              {zona.rotulo}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
