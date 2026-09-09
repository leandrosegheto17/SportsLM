// app/rotas/paginas/Home/SecaoNoticias.tsx — otimização mobile da Home (2026-09-09)
//
// Substitui `SecaoSeusEsportes` (UI-T02-02, RF-05) + `SecaoUltimasNoticias`
// (UI-T02-03, RF-04/RF-19) por um único feed filtrável — a pedido do
// usuário, para reduzir o quanto se rola no mobile antes de ver a primeira
// notícia: hoje as duas seções somam dois cabeçalhos, dois carimbos de
// frescor e duas listas praticamente com a mesma origem de dado
// (`/dados/noticias.json`, buscado duas vezes). RF-04/RF-05/RF-19 e seus
// critérios de aceite foram reconciliados em `.md/PRD-TECNICO.md` (RF-05
// deixa de ser "seção que destaque", passa a ser "filtro do feed único");
// `.md/UX-SPEC.md` §2/T-02 e `.md/TASK.md` documentam a decisão.
//
// Pipeline de dado (uma só vez, nunca duplicado entre "todos" e um esporte
// específico): busca `/dados/noticias.json` + `/dados/ingestao/status.json`
// (mesma origem/contrato de antes), agrupa por `grupoId` e escolhe um
// representante por grupo (`montarFeedNoticias`, ADR-009/DOM-03) SEM cortar
// no limite — o corte de 30 (RN-07, "de qualquer visão") é aplicado depois
// do filtro por chip, não antes, para que filtrar por um esporte não perca
// itens por causa do corte do feed geral (melhora em relação ao comportamento
// antigo de `SecaoSeusEsportes`, que tinha um pool próprio de 10).
//
// Chips: "Todos" (sempre) + "Meu time" (se houver time escolhido, busca
// textual aproximada — mesma limitação já registrada em `PropriedadesSecaoNoticias.nomeTime`)
// + um por esporte favorito (até 3, RN-06) — só aparecem quando há pelo
// menos um favorito ou time escolhido (com zero de ambos, só "Todos" existiria
// e o filtro seria inútil). Sem nenhum favorito, o feed geral aparece
// normalmente (RF-04/RF-19 nunca dependeram de favoritos) — só um banner
// discreto, não bloqueante, convida a escolher favoritos (muda CA-05.4, que
// antes bloqueava a seção inteira).

import { useMemo, useState, type ReactElement } from 'react';
import { z } from 'zod';
import { montarFeedNoticias, type ItemFeedNoticias } from '../../../../dominio/noticias';
import { calcularFrescor } from '../../../../dominio/frescor';
import type { EsporteId } from '../../../../dominio/tipos/esportes';
import { itemNoticiaSchema, type ItemNoticia } from '../../../../dominio/tipos/noticias';
import { CartaoIngresso } from '../../../design-system/CartaoIngresso';
import { Chip } from '../../../design-system/componentes/Chip';
import {
  BannerAlerta,
  CarimboFrescor,
  Esqueleto,
  EstadoVazio,
} from '../../../design-system/componentes';
import {
  clienteSnapshotPadrao,
  type ClienteSnapshot,
} from '../../../dados/clienteSnapshot';
import { useSnapshot } from '../../../dados/useSnapshot';
import estilos from './SecaoNoticias.module.css';

/** `/dados/noticias.json` (SDD §2.2) — array puro, formato real publicado por
 * `pipeline/publicacao/gerador-snapshots.ts` (PUB-02, `noticiasPublicasSchema`). */
const esquemaNoticiasPublico = z.array(itemNoticiaSchema);
const URL_NOTICIAS = '/dados/noticias.json';

/** `/dados/ingestao/status.json` (SDD §5.4) — só o subconjunto que esta
 * seção consome (RF-17/CA-04.5/CA-01.3). */
const esquemaStatusPublico = z.object({
  fontes: z.record(
    z.string(),
    z.object({
      instavel: z.boolean(),
      instavelDesde: z.string().nullable(),
    }),
  ),
});
const URL_STATUS = '/dados/ingestao/status.json';

/** RN-03: única fonte fixa e não bloqueável do catálogo. */
const ID_FONTE_FIXA = 'ge';

/** RF-17/SDD §2.5: intervalo de atualização de notícias é 30 min. */
const INTERVALO_NOTICIAS_MINUTOS = 30;

/** RN-07: "30 mais recentes [...] de qualquer visão" — aplicado após o
 * filtro por chip, não antes (ver nota de topo do arquivo). */
const LIMITE_ITENS_EXIBIDOS = 30;

export interface PropriedadesSecaoNoticias {
  /** Esportes favoritos do torcedor (0 a 3, RN-06) — vira chip de filtro;
   * zero favoritos não bloqueia o feed geral (RF-04/RF-19). */
  readonly favoritos: readonly EsporteId[];
  /** Nome de exibição de cada esporte (e de `'geral'`, CA-04.7), resolvido
   * por quem monta a tela a partir do catálogo vigente. */
  readonly nomesEsportes: Readonly<Record<string, string>>;
  /** Ids de fonte bloqueados pelo torcedor. */
  readonly fontesBloqueadas?: readonly string[];
  /** Nome de exibição de cada fonte. */
  readonly nomesFontes?: Readonly<Record<string, string>>;
  /** Quantidade de fontes bloqueáveis no catálogo (CA-02.4). */
  readonly totalFontesBloqueaveis?: number;
  /** Atalho de CA-05.4 — leva para a escolha de esportes favoritos (RF-03). */
  readonly aoEscolherEsportes: () => void;
  /** Nome de exibição do time do torcedor (chip "Meu time"); busca textual
   * aproximada (título/resumo), mesma limitação já registrada quando este
   * filtro existia em `SecaoSeusEsportes` — sem classificação por clube na
   * ingestão, não há campo estruturado de clube em `ItemNoticia`. */
  readonly nomeTime?: string | null;
  /** Relógio injetado (Diretriz de Implementação #2/GUARDRAILS.md §5). */
  readonly agora?: Date;
  /** Injeção de cliente de snapshot para teste. */
  readonly cliente?: ClienteSnapshot;
}

type FiltroFeed = 'todos' | 'meu-time' | EsporteId;

const PADRAO_MARCAS_DIACRITICAS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(PADRAO_MARCAS_DIACRITICAS, '').toLowerCase();
}

/** `true` quando título ou resumo do item mencionam `nomeTime`. */
function mencionaTime(item: ItemNoticia, nomeTime: string): boolean {
  const alvo = normalizarTexto(nomeTime);
  if (alvo.length === 0) {
    return false;
  }
  return (
    normalizarTexto(item.titulo).includes(alvo) ||
    (item.resumo !== null && normalizarTexto(item.resumo).includes(alvo))
  );
}

/** Junta nomes em português: "Futebol", "Futebol e Vôlei". */
function formatarListaPt(nomes: readonly string[]): string {
  if (nomes.length === 0) {
    return '';
  }
  if (nomes.length === 1) {
    return nomes[0] as string;
  }
  const [ultimo, ...resto] = [...nomes].reverse();
  return `${resto.reverse().join(', ')} e ${ultimo as string}`;
}

/** Tempo relativo compacto do cartão individual ("há 8 min"/"há 3 h"). */
function formatarTempoDoItem(agora: Date, publicadoEmIso: string): string {
  const publicadoEm = new Date(publicadoEmIso);
  const diffMs = Math.max(0, agora.getTime() - publicadoEm.getTime());
  const minuto = 60_000;
  const hora = 3_600_000;
  const dia = 86_400_000;

  if (diffMs < minuto) {
    return 'há poucos segundos';
  }
  if (diffMs < hora) {
    const minutos = Math.round(diffMs / minuto);
    return `há ${String(minutos)} min`;
  }
  if (diffMs < dia) {
    const horas = Math.round(diffMs / hora);
    return `há ${String(horas)} h`;
  }

  const dd = String(publicadoEm.getDate()).padStart(2, '0');
  const mm = String(publicadoEm.getMonth() + 1).padStart(2, '0');
  const hh = String(publicadoEm.getHours()).padStart(2, '0');
  const min = String(publicadoEm.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} · ${hh}h${min}`;
}

/**
 * `SecaoNoticias` — Home, feed único de notícias (UX-SPEC §2/T-02).
 */
export function SecaoNoticias({
  favoritos,
  nomesEsportes,
  fontesBloqueadas = [],
  nomesFontes = {},
  totalFontesBloqueaveis,
  aoEscolherEsportes,
  nomeTime = null,
  agora = new Date(),
  cliente,
}: PropriedadesSecaoNoticias): ReactElement {
  const [filtro, setFiltro] = useState<FiltroFeed>('todos');

  const opcoesSnapshot = useMemo(() => (cliente ? { cliente } : undefined), [cliente]);

  const snapshotNoticias = useSnapshot(
    URL_NOTICIAS,
    'noticias',
    esquemaNoticiasPublico,
    opcoesSnapshot,
  );
  // CA-04.5/ADR-013: dado de observabilidade, não bloqueia o feed em si.
  const snapshotStatus = useSnapshot(
    URL_STATUS,
    'status',
    esquemaStatusPublico,
    opcoesSnapshot,
  );

  const fontesBloqueadasSet = useMemo(
    () => new Set(fontesBloqueadas),
    [fontesBloqueadas],
  );

  // Feed completo deduplicado, sem corte (o corte de RN-07 é aplicado depois
  // do filtro por chip — ver nota de topo do arquivo).
  const feedCompleto = useMemo<readonly ItemFeedNoticias[]>(
    () =>
      montarFeedNoticias(
        snapshotNoticias.dados ?? [],
        fontesBloqueadasSet,
        Number.POSITIVE_INFINITY,
      ),
    [snapshotNoticias.dados, fontesBloqueadasSet],
  );

  const itensFiltrados = useMemo(() => {
    const base =
      filtro === 'todos'
        ? feedCompleto
        : filtro === 'meu-time'
          ? feedCompleto.filter(
              (item) => nomeTime !== null && mencionaTime(item.representante, nomeTime),
            )
          : feedCompleto.filter((item) => item.representante.esporte === filtro);
    return base.slice(0, LIMITE_ITENS_EXIBIDOS);
  }, [feedCompleto, filtro, nomeTime]);

  // CA-02.4: "todas as bloqueáveis bloqueadas".
  const quantidadeBloqueadasNaoFixas = [...fontesBloqueadasSet].filter(
    (fonteId) => fonteId !== ID_FONTE_FIXA,
  ).length;
  const todasBloqueaveisBloqueadas =
    totalFontesBloqueaveis !== undefined &&
    totalFontesBloqueaveis > 0 &&
    quantidadeBloqueadasNaoFixas >= totalFontesBloqueaveis;

  const statusFontes = snapshotStatus.dados?.fontes;
  const geIndisponivel = statusFontes?.[ID_FONTE_FIXA]?.instavel === true;

  // CA-04.5: fontes não bloqueadas (diferentes da fixa) marcadas instáveis.
  const nomesFontesInstaveis = useMemo(() => {
    if (!statusFontes) return [];
    return Object.entries(statusFontes)
      .filter(
        ([fonteId, status]) =>
          fonteId !== ID_FONTE_FIXA &&
          !fontesBloqueadasSet.has(fonteId) &&
          status.instavel,
      )
      .map(([fonteId]) => nomesFontes[fonteId] ?? fonteId);
  }, [statusFontes, fontesBloqueadasSet, nomesFontes]);

  const carregandoInicial =
    snapshotNoticias.carregando && snapshotNoticias.dados === null;
  const erroSemDados = snapshotNoticias.erro !== null && snapshotNoticias.dados === null;
  const erroComDadosAnteriores =
    snapshotNoticias.erro !== null && snapshotNoticias.dados !== null;

  const frescor =
    snapshotNoticias.geradoEm !== null
      ? calcularFrescor(
          agora,
          new Date(snapshotNoticias.geradoEm),
          INTERVALO_NOTICIAS_MINUTOS,
        )
      : null;

  function reexecutarBusca(): void {
    void (cliente ?? clienteSnapshotPadrao).garantir(
      URL_NOTICIAS,
      'noticias',
      esquemaNoticiasPublico,
    );
  }

  const mostrarChips = favoritos.length > 0 || nomeTime !== null;

  const nomeDoFiltroAtual =
    filtro === 'todos'
      ? null
      : filtro === 'meu-time'
        ? (nomeTime ?? 'seu time')
        : (nomesEsportes[filtro] ?? filtro);

  return (
    <section className={estilos['secao']} aria-labelledby="titulo-noticias">
      <div className={estilos['cabecalho']}>
        <h2 id="titulo-noticias" className={estilos['titulo']}>
          Notícias
        </h2>
        {frescor && (
          <CarimboFrescor
            estado={frescor.emAlerta ? 'alerta' : 'normal'}
            texto={frescor.atualizadoHa}
            {...(snapshotNoticias.geradoEm !== null
              ? { dataHoraIso: snapshotNoticias.geradoEm }
              : {})}
          />
        )}
      </div>

      {/* ADR-013/CA-01.3: banner de alta visibilidade, texto canônico exato. */}
      {geIndisponivel && (
        <BannerAlerta
          variante="alerta"
          texto="O GE está indisponível no momento — as notícias abaixo vêm das outras fontes."
        />
      )}

      {nomesFontesInstaveis.length === 1 && (
        <BannerAlerta
          variante="alerta"
          texto={`1 fonte instável: ${nomesFontesInstaveis[0]}`}
        />
      )}
      {nomesFontesInstaveis.length > 1 && (
        <BannerAlerta
          variante="alerta"
          texto={`${String(nomesFontesInstaveis.length)} fontes instáveis: ${nomesFontesInstaveis.join(', ')}`}
        />
      )}

      {/* CA-05.4 (revista): zero favoritos não bloqueia mais o feed geral —
       * só um convite discreto, acima dos chips. */}
      {favoritos.length === 0 && (
        <BannerAlerta
          variante="informacao"
          texto="Escolha até 3 esportes favoritos para filtrar as notícias aqui."
          acao={{ rotulo: 'Escolher esportes', aoClicar: aoEscolherEsportes }}
        />
      )}

      {mostrarChips && (
        <div
          role="group"
          aria-label="Filtrar notícias por esporte favorito"
          className={estilos['chips']}
        >
          <Chip
            variante="selecionavel"
            rotulo="Todos"
            selecionado={filtro === 'todos'}
            aoAlternar={() => {
              setFiltro('todos');
            }}
          />
          {nomeTime !== null && (
            <Chip
              variante="selecionavel"
              rotulo="Meu time"
              selecionado={filtro === 'meu-time'}
              aoAlternar={() => {
                setFiltro('meu-time');
              }}
            />
          )}
          {favoritos.map((esporte) => (
            <Chip
              key={esporte}
              variante="selecionavel"
              rotulo={nomesEsportes[esporte] ?? esporte}
              selecionado={filtro === esporte}
              aoAlternar={() => {
                setFiltro(esporte);
              }}
            />
          ))}
        </div>
      )}

      {carregandoInicial ? (
        <Esqueleto variante="cartao" quantidade={6} />
      ) : erroSemDados ? (
        <EstadoVazio
          titulo="Notícias"
          texto="Não conseguimos carregar as notícias agora. Verifique sua conexão."
          acao={{ rotulo: 'Tentar de novo', aoClicar: reexecutarBusca }}
        />
      ) : (
        <>
          {erroComDadosAnteriores && frescor && (
            <BannerAlerta
              variante="informacao"
              texto={`Mostrando as notícias de ${frescor.atualizadoHa} — a última atualização falhou.`}
            />
          )}

          {feedCompleto.length === 0 ? (
            // CA-04.4 (E1 — zero itens no feed inteiro, não só no filtro).
            <EstadoVazio
              titulo="Notícias"
              texto={`Ainda não há notícias — ${frescor?.atualizadoHa ?? 'atualizado agora'}.`}
            />
          ) : itensFiltrados.length === 0 ? (
            // CA-05.3 (revista): sem itens no escopo do chip selecionado.
            <BannerAlerta
              variante="informacao"
              texto={`Sem notícias recentes de ${formatarListaPt(nomeDoFiltroAtual ? [nomeDoFiltroAtual] : [])} — ${
                frescor?.atualizadoHa ?? 'atualizado agora'
              }.`}
            />
          ) : (
            <ul className={estilos['lista']}>
              {itensFiltrados.map(({ representante, outrasFontesIds }) => {
                const agrupado = outrasFontesIds.length > 0;
                return (
                  <li key={representante.id}>
                    <CartaoIngresso
                      href={representante.link}
                      destino="externo"
                      rotuloEtiqueta={
                        nomesEsportes[representante.esporte] ?? representante.esporte
                      }
                      fonte={nomesFontes[representante.fonteId] ?? representante.fonteId}
                      tempo={formatarTempoDoItem(agora, representante.publicadoEm)}
                      titulo={representante.titulo}
                      resumo={representante.resumo}
                      variante={
                        agrupado
                          ? 'agrupado'
                          : representante.dataEstimada
                            ? 'horario-estimado'
                            : 'normal'
                      }
                      origemCorBarra="esporte"
                      {...(agrupado
                        ? { quantidadeFontesAgrupadas: outrasFontesIds.length }
                        : {})}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {/* CA-02.4: só depois do feed, nunca no lugar dele. */}
          {todasBloqueaveisBloqueadas && (
            <BannerAlerta
              variante="informacao"
              texto={`Você bloqueou ${String(quantidadeBloqueadasNaoFixas)} fontes. Estas notícias vêm do ${ID_FONTE_FIXA}.`}
            />
          )}
        </>
      )}
    </section>
  );
}
