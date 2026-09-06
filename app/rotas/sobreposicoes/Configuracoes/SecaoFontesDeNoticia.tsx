// app/rotas/sobreposicoes/Configuracoes/SecaoFontesDeNoticia.tsx — UI-T03-01
// (TASK.md Lote 9)
//
// T-03 · Configurações (UX-SPEC §3): bloco "FONTES DE NOTÍCIA" — as 5 fontes
// do catálogo (CA-01.1), o GE sem nenhum controle de bloqueio (RN-03/CA-02.3)
// e as 4 bloqueáveis com `Alternador` (UI-DS-07A), estado instável
// (CA-01.2/RN-08) e o estado "verificando" enquanto `status.json` ainda não
// chegou (UX-SPEC §4/T-03: "no máximo 1 s").
//
// Decisões de detalhe registradas (TASK.md §6):
// - CA-02.3 ("o controle não é apresentado como acionável") é resolvido
//   estruturalmente: a linha do GE nunca renderiza `Alternador` nem qualquer
//   `<button>` — só texto e o `Chip` informativo "FONTE FIXA". Não existe
//   sequer um elemento focável ali, então não há o que testar além de "não
//   existe controle" (diferente de "existe mas está desabilitado", que a
//   tarefa explicitamente veta).
// - "Multi-esporte" (em vez da lista de esportes) para fontes que cobrem a
//   maior parte do catálogo (`LIMIAR_MULTIESPORTE`), mesma leitura do
//   wireframe de UX-SPEC §3/T-03 (ge e Terra Esportes aparecem como
//   "Multi-esporte"; ESPN Brasil e Gazeta Esportiva, que cobrem só parte dos
//   15 esportes, mostram a lista).
// - "Instável desde <data/hora>" (CA-01.2) usa a mesma formatação compacta
//   `dd/mm, HHhMM` já usada por `SecaoUltimasNoticias`/`SecaoSeusEsportes`
//   para data/hora absolutas — não há texto canônico literal fixando o
//   formato de data, só a frase em si.
// - Este componente não faz nenhum I/O (nem `config/fontes.json`, nem
//   `/dados/ingestao/status.json`) — quem monta a tela (`Configuracoes.tsx`)
//   resolve o catálogo e o status e injeta como props, mesmo padrão das
//   seções da Home (UI-T02-02/03).

import type { ReactElement } from 'react';
import { Alternador } from '../../../design-system/componentes/Alternador';
import { Chip } from '../../../design-system/componentes/Chip';
import { BannerAlerta } from '../../../design-system/componentes';
import estilos from './SecaoFontesDeNoticia.module.css';

export interface FonteCatalogo {
  readonly id: string;
  readonly nome: string;
  /** `true` só para o GE (RN-03) — a única fonte sem controle de bloqueio. */
  readonly fixa: boolean;
  readonly esportesCobertos: readonly string[];
}

export interface StatusFonte {
  readonly instavel: boolean;
  /** ISO 8601; `null` quando a fonte nunca foi marcada instável. */
  readonly instavelDesde: string | null;
}

export interface PropriedadesSecaoFontesDeNoticia {
  readonly fontes: readonly FonteCatalogo[];
  /** Nome de exibição de cada esporte (Seção 2A do PRD-TECNICO), resolvido
   * por quem monta a tela a partir do catálogo vigente. */
  readonly nomesEsportes: Readonly<Record<string, string>>;
  readonly fontesBloqueadas: readonly string[];
  /** Nunca chamado para a fonte fixa (não existe controle para isso — ver
   * nota de CA-02.3 acima); o chamador ainda assim deve ignorar um `fonteId`
   * de fonte fixa, por defesa em profundidade (Diretriz de Implementação #6). */
  readonly aoAlternarFonte: (fonteId: string) => void;
  readonly statusFontes?: Readonly<Record<string, StatusFonte>>;
  /** `true` enquanto `/dados/ingestao/status.json` ainda não respondeu pela
   * primeira vez (UX-SPEC §4/T-03: "VERIFICANDO…"). */
  readonly carregandoStatus?: boolean;
  /** `true` quando a busca de status falhou sem nenhum dado anterior
   * (UX-SPEC §4/T-03: "Não conseguimos verificar o estado das fontes
   * agora..."). O bloqueio/desbloqueio continua funcionando normalmente. */
  readonly erroStatus?: boolean;
}

/** Limiar (de 15 esportes, RN-06) a partir do qual a fonte é tratada como
 * "multi-esporte" em vez de listar cada esporte coberto. */
const LIMIAR_MULTIESPORTE = 10;

function formatarEsportes(
  esportesCobertos: readonly string[],
  nomesEsportes: Readonly<Record<string, string>>,
): string {
  if (esportesCobertos.length >= LIMIAR_MULTIESPORTE) {
    return 'Multi-esporte';
  }
  return esportesCobertos.map((id) => nomesEsportes[id] ?? id).join(', ');
}

/** `dd/mm, HHhMM` — mesma convenção compacta de data/hora absoluta já usada
 * por `formatarTempoDoItem` em `SecaoUltimasNoticias`/`SecaoSeusEsportes`. */
function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}, ${hh}h${min}`;
}

/**
 * `SecaoFontesDeNoticia` — T-03 · Configurações, bloco "Fontes de notícia"
 * (UX-SPEC §3/T-03).
 */
export function SecaoFontesDeNoticia({
  fontes,
  nomesEsportes,
  fontesBloqueadas,
  aoAlternarFonte,
  statusFontes = {},
  carregandoStatus = false,
  erroStatus = false,
}: PropriedadesSecaoFontesDeNoticia): ReactElement {
  const fontesBloqueadasSet = new Set(fontesBloqueadas);

  return (
    <section className={estilos['secao']} aria-labelledby="titulo-fontes-de-noticia">
      <h3 id="titulo-fontes-de-noticia" className={estilos['titulo']}>
        Fontes de notícia
      </h3>
      <p className={estilos['ajuda']}>Desmarque para não ver as notícias da fonte.</p>

      {erroStatus && (
        <BannerAlerta
          variante="informacao"
          texto="Não conseguimos verificar o estado das fontes agora. Você ainda pode bloquear e desbloquear normalmente."
        />
      )}

      <ul className={estilos['lista']}>
        {fontes.map((fonte) => {
          const status = statusFontes[fonte.id];
          const instavel = !carregandoStatus && status?.instavel === true;
          const bloqueada = !fonte.fixa && fontesBloqueadasSet.has(fonte.id);

          return (
            <li
              key={fonte.id}
              className={estilos['linha']}
              data-estado={fonte.fixa ? 'fixa' : bloqueada ? 'bloqueada' : 'ativa'}
            >
              {fonte.fixa ? (
                // CA-02.3/RN-03: nenhum controle acionável nesta linha — nem
                // `<button>`, nem `Alternador` desabilitado. Só texto + chip
                // informativo.
                <div className={estilos['cabecalhoFixa']}>
                  <span className={estilos['nomeFixa']}>{fonte.nome}</span>
                  <Chip variante="informativo" rotulo="FONTE FIXA" />
                </div>
              ) : (
                <Alternador
                  rotulo={fonte.nome}
                  ligado={!bloqueada}
                  aoAlternar={() => {
                    aoAlternarFonte(fonte.id);
                  }}
                />
              )}

              <p className={estilos['subtitulo']}>
                {formatarEsportes(fonte.esportesCobertos, nomesEsportes)}
                {bloqueada ? ' · Bloqueada' : ''}
              </p>

              {carregandoStatus && <p className={estilos['verificando']}>Verificando…</p>}

              {instavel && status?.instavelDesde && (
                <p className={estilos['instavel']}>
                  ⚠ Instável desde {formatarDataHora(status.instavelDesde)}
                </p>
              )}

              {fonte.fixa && (
                <p className={estilos['explicacao']}>
                  O GE é fonte fixa do SportsLM e não pode ser bloqueado.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
