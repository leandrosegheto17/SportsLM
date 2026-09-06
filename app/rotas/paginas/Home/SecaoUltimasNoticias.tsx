// app/rotas/paginas/Home/SecaoUltimasNoticias.tsx — UI-T02-03 (TASK.md Lote 8)
//
// Home — feed "Últimas notícias" (UX-SPEC §2/T-02, PRD-TECNICO RF-04/RF-19):
// as 30 notícias mais recentes de fontes não bloqueadas (CA-04.1), com grupo
// deduplicado contando como 1 e "TAMBÉM EM: <fontes>" (CA-19.1 a CA-19.4),
// indicação de fonte instável (CA-04.5), indicação de GE indisponível
// (ADR-013/CA-01.3), horário estimado (CA-04.6) e os 4 estados da Seção 4 do
// UX-SPEC (Diretriz de Implementação #8).
//
// Componente isolado da tela Home (Lote 8 é paralelizável: UI-T01-01,
// UI-T02-01, UI-T02-02 e UI-T02-03 não dependem umas das outras) — a
// integração com a faixa do clube/"A Briga" (UI-T02-01), a seção "Seus
// esportes" (UI-T02-02) e a navegação/estados globais da tela inteira
// (UI-T02-04) é responsabilidade de outra tarefa, que monta esta seção junto
// das demais.
//
// Decisões de detalhe registradas (TASK.md §6):
//
// - **Divergência de formato de `/dados/noticias.json` com UI-T02-02**
//   (`SecaoSeusEsportes`, sinalizada aqui para o Coordenador/UI-T02-04
//   reconciliar): aquela tarefa consome `{ itens: ItemNoticia[] }` (a única
//   referência concreta disponível no momento em que rodou, a fixture de
//   `useSnapshot.test.tsx`). Nesta tarefa, `pipeline/publicacao/gerador-snapshots.ts`
//   (PUB-02, concluída) já existia e é a fonte real do contrato: lá,
//   `noticiasPublicasSchema = z.array(itemNoticiaSchema)` — um array puro,
//   sem envelope, exatamente como o SDD §2.2 descreve ("Itens normalizados
//   dentro da retenção, com `grupoId`"). Este componente usa o formato REAL
//   (array), não o envelope. Como as duas seções leem a mesma URL/hash
//   (`noticias`), a divergência precisa ser corrigida em uma das duas antes
//   da integração de UI-T02-04 — recomendo alinhar `SecaoSeusEsportes` ao
//   formato real (array), já que é o que o gerador publica de fato.
// - Não busco `/dados/catalogo-fontes.json`: o nome de exibição de cada fonte
//   é resolvido por quem monta a tela (`nomesFontes`, mesmo padrão de
//   `CartaoIngresso`/`SecaoSeusEsportes` — este componente não importa
//   `config/`). A detecção de instabilidade (CA-04.5) e do GE indisponível
//   (ADR-013) usa `/dados/ingestao/status.json` (SDD §5.4/PUB-02:
//   `statusIngestaoPublicoSchema`), que é dado de observabilidade dinâmico,
//   não configuração — por isso é buscado aqui, e não recebido como prop; se
//   a busca falhar, a seção simplesmente não mostra os banners de
//   instabilidade (a lista de notícias em si nunca depende de `status.json`).
// - `ID_FONTE_FIXA = 'ge'`: RN-03 garante que só existe uma fonte fixa no
//   catálogo (o GE) — assumir o id literal aqui evita uma quarta busca de
//   rede só para descobrir `fixa: true` de uma configuração que não muda
//   por temporada.
// - **CA-02.4 acrescentado por UI-T02-04** (achado de integração: nenhuma
//   das 3 seções paralelas do Lote 8 implementava este estado da Seção 4/
//   T-02 — "Vazio (todas as bloqueáveis bloqueadas)": "Feed segue com o GE;
//   abaixo: 'Você bloqueou N fontes. Estas notícias vêm do ge.'"). Corrigido
//   diretamente aqui, dentro do escopo desta seção (é o feed quem sabe
//   quantas fontes estão bloqueadas e qual o total bloqueável do catálogo) —
//   pequeno desvio de escopo documentado (Guardrails: "desvio pequeno
//   resolve e documenta"), não uma tarefa nova nem uma reabertura do
//   Coordenador. Prop opcional nova: `totalFontesBloqueaveis` (quantidade de
//   fontes não-fixas no catálogo, RN-03) — sem ela, este estado nunca aciona
//   (degradação segura, mesmo padrão de "sem dado ⇒ sem banner" já usado
//   para `status.json`).
// - **Limitação conhecida de `CartaoIngresso` (UI-DS-03, já concluída e
//   validada) sinalizada, não corrigida aqui**: a variante do cartão é um
//   único enum (`normal | agrupado | horario-estimado | encerrado |
//   sem-dados`) e não representa "agrupado E horário estimado" ao mesmo
//   tempo, embora CA-19.1 e CA-04.6 sejam critérios independentes que podem
//   coincidir no mesmo item. Decisão de detalhe: quando os dois se aplicam,
//   prioriza-se `'agrupado'` (a informação de "também em" é mais rica) — o
//   selo "horário estimado" desse item específico fica temporariamente
//   omitido. Recomendo ao Coordenador considerar estender `CartaoIngresso`
//   para dois flags independentes em vez de um único enum.
// - Tempo relativo de cada cartão ("há 8 min") usa a mesma formatação local
//   e compacta já adotada por `SecaoSeusEsportes` (UI-T02-02) — distinta de
//   `dominio/frescor.ts`, que formata o carimbo do conjunto inteiro, não o
//   timestamp de um item individual. Duplicar essa função pequena entre as
//   duas seções paralelas é intencional (mesmo racional já registrado por
//   aquela tarefa).

import { useMemo, type ReactElement } from 'react';
import { z } from 'zod';
import { montarFeedNoticias, type ItemFeedNoticias } from '../../../../dominio/noticias';
import { calcularFrescor } from '../../../../dominio/frescor';
import { itemNoticiaSchema } from '../../../../dominio/tipos/noticias';
import { CartaoIngresso } from '../../../design-system/CartaoIngresso';
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
import estilos from './SecaoUltimasNoticias.module.css';

/** `/dados/noticias.json` (SDD §2.2) — array puro, formato real publicado por
 * `pipeline/publicacao/gerador-snapshots.ts` (PUB-02, `noticiasPublicasSchema`). */
const esquemaNoticiasPublico = z.array(itemNoticiaSchema);
const URL_NOTICIAS = '/dados/noticias.json';

/** `/dados/ingestao/status.json` (SDD §5.4) — só o subconjunto que esta
 * seção consome (RF-17/CA-04.5/CA-01.3); campos adicionais do arquivo real
 * (`statusIngestaoPublicoSchema`, PUB-02) passam despercebidos pelo Zod, sem
 * precisar ser redeclarados aqui. */
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

/** RF-17/SDD §2.5: intervalo de atualização de notícias é 30 min (limite de
 * alerta, RN-09, é 2× isso). */
const INTERVALO_NOTICIAS_MINUTOS = 30;

export interface PropriedadesSecaoUltimasNoticias {
  /** Nome de exibição de cada esporte (Seção 2A do PRD-TECNICO) e de `'geral'`
   * (CA-04.7) — resolvido por quem monta a tela a partir do catálogo vigente. */
  readonly nomesEsportes: Readonly<Record<string, string>>;
  /** Ids de fonte bloqueados pelo torcedor (CA-04.1: "de fontes não
   * bloqueadas") — nunca deveria conter `ID_FONTE_FIXA` (RN-03), mas esta
   * seção não confia cegamente nisso: o filtro de bloqueio é aplicado da
   * mesma forma a qualquer id. */
  readonly fontesBloqueadas?: readonly string[];
  /** Nome de exibição de cada fonte (ex.: `"ge"` → `"ge"`, `"uol-esporte"` →
   * `"UOL Esporte"`); sem entrada, usa o próprio id como rótulo. */
  readonly nomesFontes?: Readonly<Record<string, string>>;
  /** Quantidade de fontes bloqueáveis no catálogo (todas exceto a fixa,
   * RN-03) — usado só por CA-02.4 ("Vazio: todas as bloqueáveis
   * bloqueadas"). Sem este valor, o estado nunca aciona (degradação
   * segura). */
  readonly totalFontesBloqueaveis?: number;
  /** Relógio injetado (Diretriz de Implementação #2/GUARDRAILS.md §5) —
   * nunca `Date.now()` direto neste componente. */
  readonly agora?: Date;
  /** Injeção de cliente de snapshot para teste (mesmo padrão de
   * `useSnapshot`/UI-DS-08); padrão é a instância única da SPA. */
  readonly cliente?: ClienteSnapshot;
}

/** Tempo relativo compacto do cartão individual ("há 8 min"/"há 3 h") — até
 * 24 h (UX-SPEC §1.4); acima disso, data e hora absolutas (`dd/mm · HHhMM`),
 * nunca "agora"/"ao vivo" (UX-SPEC §1.4). */
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
 * `SecaoUltimasNoticias` — Home, seção "Últimas notícias" (UX-SPEC §2/T-02).
 */
export function SecaoUltimasNoticias({
  nomesEsportes,
  fontesBloqueadas = [],
  nomesFontes = {},
  totalFontesBloqueaveis,
  agora = new Date(),
  cliente,
}: PropriedadesSecaoUltimasNoticias): ReactElement {
  const opcoesSnapshot = useMemo(() => (cliente ? { cliente } : undefined), [cliente]);

  const snapshotNoticias = useSnapshot(
    URL_NOTICIAS,
    'noticias',
    esquemaNoticiasPublico,
    opcoesSnapshot,
  );
  // CA-04.5/ADR-013: dado de observabilidade, não bloqueia a renderização do
  // feed em si — falha aqui só significa "sem banner de instabilidade".
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

  const feed = useMemo<readonly ItemFeedNoticias[]>(
    () => montarFeedNoticias(snapshotNoticias.dados ?? [], fontesBloqueadasSet),
    [snapshotNoticias.dados, fontesBloqueadasSet],
  );

  // CA-02.4: "todas as bloqueáveis bloqueadas" — quantidade de bloqueadas
  // (nunca contando a fixa, RN-03: ela não pode ser bloqueada, mas este
  // componente não confia cegamente nisso) bate com o total bloqueável do
  // catálogo. Sem `totalFontesBloqueaveis` (prop opcional), nunca aciona.
  const quantidadeBloqueadasNaoFixas = [...fontesBloqueadasSet].filter(
    (fonteId) => fonteId !== ID_FONTE_FIXA,
  ).length;
  const todasBloqueaveisBloqueadas =
    totalFontesBloqueaveis !== undefined &&
    totalFontesBloqueaveis > 0 &&
    quantidadeBloqueadasNaoFixas >= totalFontesBloqueaveis;

  const statusFontes = snapshotStatus.dados?.fontes;

  const geIndisponivel = statusFontes?.[ID_FONTE_FIXA]?.instavel === true;

  // CA-04.5: fontes não bloqueadas (e diferentes da fixa, que tem seu próprio
  // banner acima) marcadas como instáveis em status.json.
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

  return (
    <section className={estilos['secao']} aria-labelledby="titulo-ultimas-noticias">
      <div className={estilos['cabecalho']}>
        <h2 id="titulo-ultimas-noticias" className={estilos['titulo']}>
          Últimas notícias
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

      {/* CA-04.5: "1 fonte instável: <nome>" — generalizado, de forma
       * conservadora, para o caso (não coberto por texto canônico literal)
       * de mais de uma fonte não fixa instável ao mesmo tempo. */}
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

      {carregandoInicial ? (
        <Esqueleto variante="cartao" quantidade={6} />
      ) : erroSemDados ? (
        <EstadoVazio
          titulo="Últimas notícias"
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

          {feed.length === 0 ? (
            // CA-04.4 (E1 — zero itens).
            <EstadoVazio
              titulo="Últimas notícias"
              texto={`Ainda não há notícias — ${frescor?.atualizadoHa ?? 'atualizado agora'}.`}
            />
          ) : (
            <ul className={estilos['lista']}>
              {feed.map(({ representante, outrasFontesIds }) => {
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
                      // Ver nota de limitação de `CartaoIngresso` no
                      // cabeçalho deste arquivo: "agrupado" tem prioridade
                      // sobre "horario-estimado" quando os dois se aplicam.
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

          {/* CA-02.4: "Feed segue com o GE; abaixo: 'Você bloqueou N fontes.
           * Estas notícias vêm do ge.'" — só depois do feed, nunca no lugar
           * dele (o GE continua aparecendo normalmente na lista acima). */}
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
