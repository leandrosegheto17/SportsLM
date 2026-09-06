// app/rotas/paginas/PainelTime.tsx — UI-T05-01 (TASK.md Lote 10)
//
// T-05 · Painel do time (UX-SPEC §2/T-05, PRD-TECNICO CA-07.1 a CA-07.5):
// faixa de identidade + PRÓXIMO JOGO em destaque (CA-07.5) + lista de
// campeonatos da temporada ordenada (CA-07.4, `ordenarCampeonatos`/DOM-04),
// cada um com status textual (CA-07.1) e o cartão "sem dados" tracejado
// nunca omitido (CA-07.2). Substitui o placeholder de `/time` (FUND-04).
//
// Fonte de dado única (Diretriz de Implementação #10, e a própria descrição
// da tarefa): `/dados/futebol/clube/<slug>.json` (`useSnapshot`/UI-DS-08,
// schema `clubeFutebolPublicoSchema`/UI-T02-01) — um array com TODOS os
// campeonatos da temporada em que o clube participa (RN-05), já incluindo os
// sem cobertura (`participacao.status === 'sem-dados'`, contrato de
// `pipeline/publicacao/gerador-snapshots.ts`/PUB-02). Como o array cobre a
// temporada inteira por construção do contrato, "cartão sem dados nunca
// omitido" (CA-07.2) é satisfeito automaticamente por renderizar TODAS as
// entradas do array — nunca um filtro que possa descartar uma delas. Também
// dá a posição/pontuação do clube no Brasileirão (usada pelo número de
// `FaixaClube`) sem precisar buscar `/dados/futebol/brasileirao.json`
// separadamente: a entrada cujo `competicao.id === ID_BRASILEIRAO` já traz
// `participacao.resumo.posicao`/`pontos`.
//
// `status`/`faseAtual` por campeonato (CA-07.1) já chegam computados no
// arquivo publicado — o valor é o mesmo enum de `StatusParticipacao`
// derivado por `derivarStatusCampeonato` (ING-F-03/`dominio/campeonatos/
// derivador-status.ts`) rio acima, na ingestão/publicação (que tem acesso a
// `agora`/`Competicao.janela`/todas as partidas, exigidos pela assinatura da
// função). Repetir aqui o mesmo cálculo, no cliente, duplicaria uma decisão
// já tomada com mais contexto do que esta tela tem (violaria "nunca um
// palpite" do ADR-006 se esta tela tivesse que reconstruir `agora`/janela) —
// por isso este componente só *lê* `participacao.status`/`faseAtual`
// (reexportado como `StatusParticipacao`, mesmo enum), sem invocar
// `derivarStatusCampeonato` de novo.
//
// Ordenação (CA-07.4) via `ordenarCampeonatos`/DOM-04: uma única lista, um
// único `.map`, sem duplicar a árvore de DOM por largura de tela — o layout
// de 1 coluna (mobile) → 2 colunas (desktop) é só CSS Grid sobre a mesma
// ordem de elementos (`PainelTime.module.css`), o que garante "ordenação
// idêntica em mobile e desktop" por construção (não há como divergir: é a
// mesma lista).
//
// Os 8 estados/textos da Seção 4 do UX-SPEC/T-05 (Diretriz de Implementação
// #8/#9, textos canônicos, nunca parafraseados):
// - Vazio (sem time, CA-14.3): faixa neutra + convite + `[ ESCOLHER MEU TIME ]`.
// - Vazio (time sem dados, CA-06.4/CA-17.3): array publicado vazio (defensivo
//   — o contrato não deveria publicar array vazio para RN-05, mas a tela
//   nunca trava se isso acontecer).
// - Carregando: faixa completa exceto o número + esqueleto de próximo jogo +
//   4 esqueletos de cartão.
// - Erro (sem dado anterior): `EstadoVazio` + `[ TENTAR DE NOVO ]`.
// - Preenchido: wireframe da Seção 2.
// - Campeonato sem cobertura (CA-07.2): cartão tracejado, ver acima.
// - Frescor em alerta (CA-17.2): `CarimboFrescor` variante `alerta`.
// - Pausa por cota (CA-16.4/CA-17.4): `CarimboFrescor` variante `pausado`.
//
// Decisão de implementação registrada (pequeno desvio, documentado — não é
// lacuna do UX-SPEC): o intervalo de futebol varia entre "~1 h em dia de
// jogo do clube" e "~6 h fora dele" (SDD §5); decidir dinamicamente qual dos
// dois vale exigiria cruzar a data corrente com o calendário completo do
// clube nesta própria tela. Usa-se sempre o intervalo mais largo (6 h,
// `INTERVALO_FUTEBOL_MINUTOS`) para o cálculo do limite de alerta (RN-09, 2×
// o intervalo) — mais conservador (alerta dispara mais tarde), nunca mostra
// alerta falso-positivo num dia de jogo. Sinalizo ao Coordenador se a
// distinção dinâmica vier a ser exigida por um achado de QA.
//
// "TROCAR TIME" (UX-SPEC, wireframe T-05): aciona a sobreposição T-04 já
// montada por `Layout`/`ProvedorSobreposicoes` (`useSobreposicoes`, mesmo
// mecanismo do botão "Trocar" de Configurações e do link da faixa da Home —
// ver comentário de `SobreposicoesContext.tsx`, que já antecipava este
// ponto: "futuramente 'TROCAR TIME' do Painel do Time").

import { useMemo, type CSSProperties, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { FaixaClube, type ClubeParaFaixa } from '../../design-system/FaixaClube';
import { BlocoPreto } from '../../design-system/BlocoPreto';
import { Botao } from '../../design-system/componentes/Botao';
import { CarimboFrescor, Esqueleto, EstadoVazio } from '../../design-system/componentes';
import { useSnapshot } from '../../dados/useSnapshot';
import { clienteSnapshotPadrao, type ClienteSnapshot } from '../../dados/clienteSnapshot';
import {
  useClubesPublicos,
  type OpcoesUseClubesPublicos,
} from '../../dados/useClubesPublicos';
import type { ClubePublico } from '../../dados/configPublico';
import {
  clubeFutebolPublicoSchema,
  urlFutebolClube,
  URL_FUTEBOL_BRASILEIRAO,
  type CampeonatoDoClubePublico,
} from '../../dados/futebol';
import { CHAVE_ARMAZENAMENTO_PREFERENCIAS } from '../../armazenamento/preferencias';
import { lerBrutoSemLancar } from '../../armazenamento/nucleo';
import { preferenciasSchema } from '../../../dominio/tipos';
import {
  ordenarCampeonatos,
  type CampeonatoOrdenavel,
} from '../../../dominio/campeonatos/ordenacao';
import { calcularFrescor } from '../../../dominio/frescor';
import type { Partida } from '../../../dominio/tipos/futebol';
import { useSobreposicoes } from '../SobreposicoesContext';
import { useTituloDocumento } from '../useTituloDocumento';
import estilos from './PainelTime.module.css';

/** `brasileirao-serie-a` (`config/campeonatos-2026.json`, CFG-03) — id
 * estável usado para achar, dentro do array publicado, a entrada cuja
 * posição/pontuação alimenta o número da `FaixaClube` (mesmo id usado por
 * `SecaoIdentidade`/UI-T02-01 e pelas fixtures de `app/dados/futebol.test.ts`). */
const ID_BRASILEIRAO = 'brasileirao-serie-a';

/** RNF-06/SDD §5: usa sempre o intervalo mais largo (fora de dia de jogo) —
 * ver nota de decisão no topo do arquivo. */
const INTERVALO_FUTEBOL_MINUTOS = 6 * 60;

/** `/dados/ingestao/status.json` (SDD §5.4) — só o campo usado por esta tela
 * (CA-16.4/CA-17.4); mesmo padrão de leitura "parcial, com passthrough" de
 * `SecaoUltimasNoticias`/UI-T02-03. */
const esquemaStatusPublico = z.object({ pausadoPorCota: z.boolean() }).passthrough();
const URL_STATUS = '/dados/ingestao/status.json';

const FORMATADOR_DIA_SEMANA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
});
const FORMATADOR_DIA_MES = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
});
const FORMATADOR_HORARIO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "dom, 13/09" (RNF-02, mesmo formato de `SecaoIdentidade`/UI-T02-01). */
function formatarDataCurta(dataHoraIso: string): string {
  const data = new Date(dataHoraIso);
  const diaSemana = FORMATADOR_DIA_SEMANA.format(data).replace(/\.$/, '');
  return `${diaSemana}, ${FORMATADOR_DIA_MES.format(data)}`;
}

/** "16h00" (RNF-02). */
function formatarHorario(dataHoraIso: string): string {
  const partes = FORMATADOR_HORARIO.formatToParts(new Date(dataHoraIso));
  const hora = partes.find((parte) => parte.type === 'hour')?.value ?? '00';
  const minuto = partes.find((parte) => parte.type === 'minute')?.value ?? '00';
  return `${hora}h${minuto}`;
}

/** Lê só o `timeId` salvo, de forma síncrona (mesmo racional/mesma
 * duplicação intencional de `SecaoIdentidade`/UI-T02-01: `lerPreferencias`
 * completo exige o catálogo corrente já carregado, que esta tela não
 * precisa para decidir "sem time" × "com time"). */
function lerTimeIdSalvo(
  armazenamento: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): string | null {
  const bruto = lerBrutoSemLancar(CHAVE_ARMAZENAMENTO_PREFERENCIAS, armazenamento);
  if (bruto === null) {
    return null;
  }
  try {
    const analisado: unknown = JSON.parse(bruto);
    const resultado = preferenciasSchema.safeParse(analisado);
    return resultado.success ? resultado.data.timeId : null;
  } catch {
    return null;
  }
}

/** Partida "agendada" com `dataHora` conhecida mais próxima, dentro de UMA
 * lista de partidas — usada tanto para o destaque global (CA-07.5, todas as
 * competições) quanto para a linha "Próximo: <data>" de um cartão individual. */
function proximaPartidaAgendada(partidas: readonly Partida[]): Partida | null {
  let melhor: Partida | null = null;
  for (const partida of partidas) {
    if (partida.status !== 'agendada' || partida.dataHora === null) {
      continue;
    }
    if (melhor === null || partida.dataHora < (melhor.dataHora ?? '')) {
      melhor = partida;
    }
  }
  return melhor;
}

interface ProximoJogoEncontrado {
  readonly partida: Partida;
  readonly competicaoNome: string;
}

/** CA-07.5 — próximo jogo do clube entre TODOS os campeonatos da temporada. */
function encontrarProximoJogoGlobal(
  campeonatos: readonly CampeonatoDoClubePublico[],
): ProximoJogoEncontrado | null {
  let melhor: ProximoJogoEncontrado | null = null;
  for (const entrada of campeonatos) {
    const candidata = proximaPartidaAgendada(entrada.partidas);
    if (candidata === null) {
      continue;
    }
    if (melhor === null || (candidata.dataHora ?? '') < (melhor.partida.dataHora ?? '')) {
      melhor = { partida: candidata, competicaoNome: entrada.competicao.nome };
    }
  }
  return melhor;
}

/** CA-07.3 — data do último jogo finalizado, usada junto de "eliminado na <fase>". */
function dataUltimoJogoFinalizado(partidas: readonly Partida[]): string | null {
  let melhor: string | null = null;
  for (const partida of partidas) {
    if (partida.status !== 'finalizada' || partida.dataHora === null) {
      continue;
    }
    if (melhor === null || partida.dataHora > melhor) {
      melhor = partida.dataHora;
    }
  }
  return melhor;
}

/** CA-07.1 — texto de status canônico ("não iniciado" / "em andamento —
 * <fase>" / "eliminado na <fase>" / "concluído — <resultado>" / "sem
 * dados"), a partir do `participacao` já publicado (ver nota no topo do
 * arquivo: não recalcula `derivarStatusCampeonato`, só lê o resultado). */
function montarTextoStatus(entrada: CampeonatoDoClubePublico): string {
  const { status, faseAtual, resultadoFinal } = entrada.participacao;
  switch (status) {
    case 'nao-iniciado':
      return 'Não iniciado';
    case 'em-andamento':
      return faseAtual ? `Em andamento — ${faseAtual}` : 'Em andamento';
    case 'eliminado': {
      const dataUltimoJogo = dataUltimoJogoFinalizado(entrada.partidas);
      const base = faseAtual ? `Eliminado na ${faseAtual}` : 'Eliminado';
      return dataUltimoJogo ? `${base} · ${formatarDataCurta(dataUltimoJogo)}` : base;
    }
    case 'concluido':
      return resultadoFinal ? `Concluído — ${resultadoFinal}` : 'Concluído';
    case 'sem-dados':
      return 'Sem dados';
  }
}

/** `--pt-identidade-clara`/`--pt-identidade-escura` (ver
 * `PainelTime.module.css`): barra colorida dos cartões de campeonato usa a
 * identidade do PRÓPRIO clube do torcedor (mesmo clube em todos os cartões,
 * ao contrário de "A Briga" — cada linha lá é de um clube diferente). */
function estiloListaCampeonatos(
  paleta: ClubeParaFaixa['paleta'] | undefined,
): CSSProperties | undefined {
  if (!paleta) {
    return undefined;
  }
  return {
    '--pt-identidade-clara': paleta.identidade,
    '--pt-identidade-escura': paleta.identidadeEscuro,
  } as CSSProperties;
}

/** Ícone redundante ao texto (nunca a única pista, WCAG 1.4.1/Diretriz #7) —
 * `sem-dados` não usa este mapa: tem cartão/anatomia próprios (tracejado). */
const ICONE_POR_STATUS: Record<string, string> = {
  'em-andamento': '●',
  eliminado: '○',
  concluido: '✓',
};

/** "6º · 42 pts · 23 j · 12v 6e 5d", quando o campeonato publica `resumo`
 * (pontos corridos/grupos com tabela) — `null` quando não há resumo
 * numérico (ex.: mata-mata, ou campeonato ainda sem partida disputada). */
function montarLinhaResumo(
  resumo: CampeonatoDoClubePublico['participacao']['resumo'],
): string | null {
  if (!resumo) {
    return null;
  }
  const partes: string[] = [];
  if (resumo.posicao !== null) {
    partes.push(`${String(resumo.posicao)}º`);
  }
  partes.push(`${String(resumo.pontos)} pts`);
  partes.push(`${String(resumo.jogos)} j`);
  partes.push(`${String(resumo.v)}v ${String(resumo.e)}e ${String(resumo.d)}d`);
  return partes.join(' · ');
}

interface CampeonatoOrdenavelComEntrada extends CampeonatoOrdenavel {
  readonly entrada: CampeonatoDoClubePublico;
}

export interface PropriedadesPainelTime {
  /** Injeção de teste; padrão é `globalThis.localStorage`. */
  readonly armazenamento?: Pick<Storage, 'getItem'>;
  readonly opcoesClubesPublicos?: OpcoesUseClubesPublicos;
  readonly clienteSnapshot?: ClienteSnapshot;
  /** Relógio injetado (GUARDRAILS.md §5) — nunca `Date.now()` direto. */
  readonly agora?: Date;
}

/** T-05 — Painel do time (campeonatos do ano). Rota: `/time`. */
export function PainelTime({
  armazenamento,
  opcoesClubesPublicos,
  clienteSnapshot,
  agora = new Date(),
}: PropriedadesPainelTime = {}): ReactElement {
  useTituloDocumento('Painel do time');
  const { abrirEscolherTime } = useSobreposicoes();

  const timeId = useMemo(() => lerTimeIdSalvo(armazenamento), [armazenamento]);
  const { clubes } = useClubesPublicos(opcoesClubesPublicos);
  const opcoesSnapshot = clienteSnapshot ? { cliente: clienteSnapshot } : undefined;

  // Sem `timeId` (CA-14.3), a URL de fallback é `URL_FUTEBOL_BRASILEIRAO`
  // (mesma convenção de `SecaoIdentidade`/UI-T02-01) só para não montar uma
  // URL inexistente — o dado nunca é lido neste ramo, a tela retorna cedo
  // antes de qualquer uso de `futebolDoClube` (ver abaixo).
  const futebolDoClube = useSnapshot(
    timeId !== null ? urlFutebolClube(timeId) : URL_FUTEBOL_BRASILEIRAO,
    'futebol',
    clubeFutebolPublicoSchema,
    opcoesSnapshot,
  );
  const statusIngestao = useSnapshot(
    URL_STATUS,
    'status',
    esquemaStatusPublico,
    opcoesSnapshot,
  );

  function reexecutarBusca(): void {
    if (timeId === null) {
      return;
    }
    void (clienteSnapshot ?? clienteSnapshotPadrao).garantir(
      urlFutebolClube(timeId),
      'futebol',
      clubeFutebolPublicoSchema,
    );
  }

  // CA-14.3 — sem time salvo: faixa neutra + convite único, nunca busca dado
  // de futebol (não há slug para montar a URL).
  if (timeId === null) {
    return (
      <article className={estilos['pagina']} aria-label="Painel do time">
        <FaixaClube variante="neutra" />
        <EstadoVazio
          titulo="Painel do time"
          texto="Escolha seu time para ver o painel com todos os campeonatos do ano."
          acao={{ rotulo: 'ESCOLHER MEU TIME', aoClicar: abrirEscolherTime }}
        />
      </article>
    );
  }

  const clubeSelecionado = clubes?.find((clube: ClubePublico) => clube.id === timeId);
  const clubeParaFaixa: ClubeParaFaixa | undefined = clubeSelecionado
    ? {
        nome: clubeSelecionado.nomeCurto,
        sigla: clubeSelecionado.sigla,
        paleta: clubeSelecionado.paleta,
      }
    : undefined;

  const campeonatos = futebolDoClube.dados;
  const entradaBrasileirao = campeonatos?.find(
    (entrada) => entrada.competicao.id === ID_BRASILEIRAO,
  );
  const posicaoBrasileirao = entradaBrasileirao?.participacao.resumo?.posicao ?? null;
  const pontosBrasileirao = entradaBrasileirao?.participacao.resumo?.pontos ?? null;
  const nomeBrasileirao = entradaBrasileirao?.competicao.nome ?? 'Brasileirão Série A';
  const temporada = campeonatos?.[0]?.competicao.temporada;

  const propsTemporada = temporada !== undefined ? { temporada } : {};

  const faixa = clubeParaFaixa ? (
    <FaixaClube
      variante="completa"
      clube={clubeParaFaixa}
      competicaoNome={nomeBrasileirao}
      {...propsTemporada}
      posicao={posicaoBrasileirao}
      pontos={pontosBrasileirao}
    />
  ) : (
    <FaixaClube variante="neutra" />
  );

  const trocarTime = (
    <Botao
      variante="fantasma"
      className={estilos['trocarTime']}
      onClick={abrirEscolherTime}
    >
      TROCAR TIME
    </Botao>
  );

  const carregandoInicial = futebolDoClube.carregando && campeonatos === null;
  const erroSemDados = futebolDoClube.erro !== null && campeonatos === null;

  if (carregandoInicial) {
    return (
      <article className={estilos['pagina']} aria-label="Painel do time">
        {faixa}
        {trocarTime}
        <Esqueleto variante="bloco" />
        <Esqueleto variante="cartao" quantidade={4} />
      </article>
    );
  }

  if (erroSemDados) {
    return (
      <article className={estilos['pagina']} aria-label="Painel do time">
        {faixa}
        {trocarTime}
        <EstadoVazio
          titulo="Painel do time"
          texto="Não conseguimos carregar o painel agora."
          acao={{ rotulo: 'TENTAR DE NOVO', aoClicar: reexecutarBusca }}
        />
      </article>
    );
  }

  // CA-06.4/CA-17.3 — time escolhido, mas nunca houve dado publicado para ele
  // (array vazio: defensivo — RN-05 não deveria produzir isto, mas a tela
  // não trava se acontecer).
  if (campeonatos !== null && campeonatos.length === 0) {
    return (
      <article className={estilos['pagina']} aria-label="Painel do time">
        {faixa}
        {trocarTime}
        <EstadoVazio
          titulo="Painel do time"
          texto={`Sem dados disponíveis no momento. Assim que a próxima atualização trouxer informações do ${clubeSelecionado?.nomeCurto ?? 'seu time'}, elas aparecem aqui.`}
        />
      </article>
    );
  }

  const listaCampeonatos = campeonatos ?? [];

  const ordenaveis: CampeonatoOrdenavelComEntrada[] = listaCampeonatos.map((entrada) => ({
    id: entrada.competicao.id,
    status: entrada.participacao.status,
    proximoJogoDataHora: proximaPartidaAgendada(entrada.partidas)?.dataHora ?? null,
    entrada,
  }));
  const ordenados = ordenarCampeonatos(ordenaveis);

  const proximoJogo = encontrarProximoJogoGlobal(listaCampeonatos);

  const frescor =
    futebolDoClube.geradoEm !== null
      ? calcularFrescor(
          agora,
          new Date(futebolDoClube.geradoEm),
          INTERVALO_FUTEBOL_MINUTOS,
        )
      : null;
  const pausadoPorCota = statusIngestao.dados?.pausadoPorCota === true;

  return (
    <article className={estilos['pagina']} aria-label="Painel do time">
      {faixa}
      {trocarTime}

      {proximoJogo ? (
        <BlocoPreto variante="proximo-jogo" rotulo="Próximo jogo">
          <p className={estilos['proximoJogoDataHora']}>
            {formatarDataCurta(proximoJogo.partida.dataHora ?? '')} ·{' '}
            {formatarHorario(proximoJogo.partida.dataHora ?? '')}
          </p>
          <p className={estilos['proximoJogoConfronto']}>
            {clubes?.find((c) => c.id === proximoJogo.partida.mandanteId)?.nomeCurto ??
              proximoJogo.partida.mandanteId}
            {' × '}
            {clubes?.find((c) => c.id === proximoJogo.partida.visitanteId)?.nomeCurto ??
              proximoJogo.partida.visitanteId}
          </p>
          <p className={estilos['proximoJogoMeta']}>
            {proximoJogo.partida.mandanteId === timeId ? 'casa' : 'fora'}
            {` · ${proximoJogo.competicaoNome}`}
            {proximoJogo.partida.rodada !== null
              ? ` · ${String(proximoJogo.partida.rodada)}ª rodada`
              : ''}
            {proximoJogo.partida.estadio ? ` · ${proximoJogo.partida.estadio}` : ''}
          </p>
        </BlocoPreto>
      ) : futebolDoClube.carregando ? (
        <Esqueleto variante="bloco" />
      ) : null}

      <div className={estilos['cabecalhoLista']}>
        <h2 className={estilos['tituloLista']}>
          {temporada !== undefined
            ? `Campeonatos de ${String(temporada)}`
            : 'Campeonatos'}
        </h2>
        {pausadoPorCota ? (
          <CarimboFrescor
            estado="pausado"
            texto={`Atualização pausada por limite do provedor. Última atualização ${
              frescor?.atualizadoHa.replace(/^atualizado\s*/, '') ?? 'desconhecida'
            }.`}
            {...(futebolDoClube.geradoEm !== null
              ? { dataHoraIso: futebolDoClube.geradoEm }
              : {})}
          />
        ) : frescor ? (
          <CarimboFrescor
            estado={frescor.emAlerta ? 'alerta' : 'normal'}
            texto={frescor.atualizadoHa}
            {...(futebolDoClube.geradoEm !== null
              ? { dataHoraIso: futebolDoClube.geradoEm }
              : {})}
          />
        ) : null}
      </div>

      <ul
        className={estilos['listaCampeonatos']}
        style={estiloListaCampeonatos(clubeParaFaixa?.paleta)}
      >
        {ordenados.map(({ entrada }) => {
          const { status } = entrada.participacao;

          if (status === 'sem-dados') {
            return (
              <li key={entrada.competicao.id} className={estilos['cartaoSemDados']}>
                <p className={estilos['cartaoSemDadosTitulo']}>
                  {entrada.competicao.nome} — SEM DADOS
                </p>
                <p className={estilos['cartaoSemDadosTexto']}>
                  Cobertura indisponível nesta versão.
                </p>
              </li>
            );
          }

          const linhaResumo = montarLinhaResumo(entrada.participacao.resumo);
          const proximaPartidaDoCartao =
            linhaResumo === null ? proximaPartidaAgendada(entrada.partidas) : null;

          return (
            <li key={entrada.competicao.id} className={estilos['cartao']}>
              <Link
                to={`/time/${entrada.competicao.id}`}
                className={estilos['cartaoLink']}
                data-status={status}
              >
                <span className={estilos['cartaoNome']}>{entrada.competicao.nome}</span>
                <span className={estilos['cartaoStatus']}>
                  <span aria-hidden="true">{ICONE_POR_STATUS[status] ?? ''}</span>{' '}
                  {montarTextoStatus(entrada)}
                </span>
                {linhaResumo ? (
                  <span className={estilos['cartaoMeta']}>{linhaResumo}</span>
                ) : proximaPartidaDoCartao ? (
                  <span className={estilos['cartaoMeta']}>
                    Próximo: {formatarDataCurta(proximaPartidaDoCartao.dataHora ?? '')} ·{' '}
                    {formatarHorario(proximaPartidaDoCartao.dataHora ?? '')}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
