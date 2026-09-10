// app/rotas/paginas/Comparativo.tsx — UI-T08-01 (TASK.md Lote 11)
//
// T-08 · Comparativo no Brasileirão (UX-SPEC §2/T-08, PRD-TECNICO CA-10.1 a
// CA-10.6): cartões lado a lado do time do coração + até 2 rivais (time
// sempre primeiro, RN-11), calendário restante de cada clube e o "confronto
// direto" (CA-10.3) marcado simultaneamente nas listas dos dois lados.
// Substitui o placeholder da rota `/comparativo` (FUND-04).
//
// Fonte de dado única (Diretriz de Implementação #10): `/dados/futebol/
// brasileirao.json` (`brasileiraoPublicoSchema`/UI-T02-01, `useSnapshot`/
// UI-DS-08) — um único arquivo já traz a classificação (posição, pontos,
// V/E/D, saldo, aproveitamento, últimos 5 — CA-10.1) e TODAS as partidas dos
// 20 clubes, todas as rodadas (CA-10.2), dos quais este componente só filtra
// as do time e dos rivais. Nunca busca `/dados/futebol/clube/<slug>.json`
// (não precisamos de outras competições aqui, CA-10.6/RN-11: "só Brasileirão")
// e, por vir de um único arquivo com todas as partidas, o mesmo confronto
// aparece nas duas listas dos clubes comparados só de filtrar por
// `mandanteId`/`visitanteId` — não há sincronização manual a fazer para
// CA-10.3.
//
// Rivais (RN-11, até 2): lidos de `Preferencias.rivais` (`app/armazenamento/
// preferencias.ts`/UI-DS-09) — mesma leitura síncrona "parcial" (sem cruzar
// contra o catálogo corrente) já usada por `SecaoIdentidade`/`PainelTime`
// para o `timeId`: aqui friso o mesmo racional para `rivais`, e reagimos a
// mudanças salvas por `EscolherRivais` (T-07) via `assinarMudancasPreferencias`
// (REFAT-09-01) — sem isso, confirmar rivais na sobreposição não atualizaria
// esta tela sem F5 (CA-02.1 já estabelece "sem recarregar a página" como
// invariante do produto).
//
// Decisão de implementação registrada (pequeno desvio, documentado — não é
// lacuna do UX-SPEC): o wireframe mobile de UX-SPEC §2/T-08 mostra os 3
// cartões empilhados seguidos de UMA seção "JOGOS QUE FALTAM" com abas para
// trocar de clube; o desktop mostra 3 colunas, cada uma com seu próprio
// cartão + seu próprio calendário. Reproduzir literalmente as duas anatomias
// exigiria duas árvores de DOM distintas (a mobile agrupa os calendários,
// a desktop os separa por coluna) — ao contrário de `PainelTime`/`Home`,
// aqui não é só `grid-template-columns` mudando sobre a MESMA ordem de
// elementos. Implementado: uma "coluna" por clube (cartão + seu calendário
// juntos), em coluna única no mobile e em grade de até 3 colunas no desktop —
// mesma ordem de elementos nas duas larguras (sem abas), preservando todos os
// critérios de aceite (CA-10.1 a CA-10.6) e a leitura "ver a briga lado a
// lado" — só diverge da affordance de abas do wireframe mobile. Sinalizo ao
// Coordenador se a UX de abas compartilhadas for considerada essencial.
//
// UX-15-02 (TASK.md, "Melhoria — Faixa do clube consistente em Meu Time e
// Comparativo", 2026-09-09): UX-SPEC §2/T-08 (rodada 3) pede a mesma
// `FaixaClube` variante `completa` já usada na Home (T-02, `FaixaClubeDoTime`)
// e no Painel do time (T-05, `PainelTime`), do time do coração, antes do
// cabeçalho "Comparativo · Brasileirão {ano}" — sem variante própria, sem
// número quando a posição/pontos ainda não chegaram (mesmo padrão de
// `PainelTime`: a faixa não tem "versão esqueleto" própria, só omite o bloco
// de número quando `posicao`/`pontos` são `null`, o que já é o comportamento
// coberto pela prop opcional de `FaixaClube`). Aparece em todo estado "com
// time" (preenchido, carregando, erro, zero rival, Brasileirão sem
// dados/não iniciado) — só o estado "sem time" (CA-14.3, `timeId === null`,
// já tratado acima) continua sem faixa, mantendo o convite atual como está.
// Sem `href`: mesmo tratamento de `PainelTime` (a faixa não navega para lugar
// nenhum quando já está na própria tela do contexto do time), diferente da
// Home, onde a faixa é o link de entrada para `/time`.

// "Confronto direto" (CA-10.3): não reaproveita `LinhaPartida` (UI-DS-07B)
// porque aquele componente não tem uma prop para o marcador "⚔ CONFRONTO
// DIRETO" — sua API cobre a anatomia de T-06 (disputada/próxima/etc., com
// placar), não esse rótulo extra. Implementado aqui como uma lista própria,
// mais simples (T-08 nunca lista partida já disputada — CA-10.2 é só
// "jogos que faltam"), reaproveitando os mesmos textos canônicos de estado
// de partida (HORÁRIO A DEFINIR/DATA A DEFINIR/AGUARDANDO RESULTADO/ADIADA)
// já usados por `LinhaPartida`, para não divergir de vocabulário. Sinalizo
// ao Coordenador a possibilidade de estender `LinhaPartida` com essa prop
// numa refatoração futura, para as duas telas convergirem no mesmo componente.

import {
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { BarraPontuacao } from '../../design-system/BarraPontuacao';
import { FaixaClube, type ClubeParaFaixa } from '../../design-system/FaixaClube';
import { Botao } from '../../design-system/componentes/Botao';
import { CarimboFrescor, Esqueleto, EstadoVazio } from '../../design-system/componentes';
import { useSnapshot } from '../../dados/useSnapshot';
import { clienteSnapshotPadrao, type ClienteSnapshot } from '../../dados/clienteSnapshot';
import {
  useClubesPublicos,
  type OpcoesUseClubesPublicos,
} from '../../dados/useClubesPublicos';
import type { ClubePublico } from '../../dados/configPublico';
import { brasileiraoPublicoSchema, URL_FUTEBOL_BRASILEIRAO } from '../../dados/futebol';
import {
  CHAVE_ARMAZENAMENTO_PREFERENCIAS,
  assinarMudancasPreferencias,
  obterVersaoPreferencias,
} from '../../armazenamento/preferencias';
import { lerBrutoSemLancar } from '../../armazenamento/nucleo';
import { preferenciasSchema } from '../../../dominio/tipos';
import { calcularFrescor } from '../../../dominio/frescor';
import type { PaletaClube, Partida } from '../../../dominio/tipos/futebol';
import { useSobreposicoes } from '../SobreposicoesContext';
import { useTituloDocumento } from '../useTituloDocumento';
import estilos from './Comparativo.module.css';

/** RNF-06/SDD §5: mesmo intervalo mais largo já usado por `PainelTime`/
 * `SecaoIdentidade` para o cálculo do limite de alerta de frescor (RN-09). */
const INTERVALO_FUTEBOL_MINUTOS = 6 * 60;

/** `/dados/ingestao/status.json` (SDD §5.4) — mesmo padrão "parcial, com
 * passthrough" das demais telas (ex. `PainelTime`/UI-T05-01). */
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

function formatarDataCurta(dataHoraIso: string): string {
  const data = new Date(dataHoraIso);
  const diaSemana = FORMATADOR_DIA_SEMANA.format(data).replace(/\.$/, '');
  return `${diaSemana}, ${FORMATADOR_DIA_MES.format(data)}`;
}

function formatarHorario(dataHoraIso: string): string {
  const partes = FORMATADOR_HORARIO.formatToParts(new Date(dataHoraIso));
  const hora = partes.find((parte) => parte.type === 'hour')?.value ?? '00';
  const minuto = partes.find((parte) => parte.type === 'minute')?.value ?? '00';
  return `${hora}h${minuto}`;
}

/** "42,1%" — mesma convenção de arredondamento de `calcularAproveitamento`
 * (DOM-04, 1 casa decimal), vírgula decimal pt-BR (RNF-02). */
function formatarPercentual(valor: number): string {
  return `${valor.toFixed(1).replace('.', ',')}%`;
}

/** "+5 PTS" / "-3 PTS" / "+1 PT" (singular só para 1, wireframe T-08). */
function formatarDiferencaPontos(diferenca: number): string {
  const sinal = diferenca > 0 ? '+' : diferenca < 0 ? '−' : '';
  const absoluto = Math.abs(diferenca);
  const unidade = absoluto === 1 ? 'PT' : 'PTS';
  return `${sinal}${absoluto} ${unidade}`;
}

const ROTULO_ULTIMO_RESULTADO: Record<'V' | 'E' | 'D', string> = {
  V: 'Vitória',
  E: 'Empate',
  D: 'Derrota',
};

interface PreferenciasComparativo {
  readonly timeId: string | null;
  readonly rivais: readonly string[];
}

/** Leitura síncrona "parcial" de `timeId`/`rivais` (mesmo racional documentado
 * em `SecaoIdentidade`/`PainelTime`: `lerPreferencias` completo exige o
 * catálogo corrente já carregado, que esta tela não precisa para decidir o
 * que buscar/exibir — a validação cruzada contra o catálogo, RN-12/CA-13.4,
 * já foi feita quando os valores foram salvos). JSON/esquema inválido ⇒
 * equivalente a "sem time"/"sem rivais". */
function lerPreferenciasComparativo(
  armazenamento: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): PreferenciasComparativo {
  const bruto = lerBrutoSemLancar(CHAVE_ARMAZENAMENTO_PREFERENCIAS, armazenamento);
  if (bruto === null) {
    return { timeId: null, rivais: [] };
  }
  try {
    const analisado: unknown = JSON.parse(bruto);
    const resultado = preferenciasSchema.safeParse(analisado);
    if (!resultado.success) {
      return { timeId: null, rivais: [] };
    }
    return { timeId: resultado.data.timeId, rivais: resultado.data.rivais };
  } catch {
    return { timeId: null, rivais: [] };
  }
}

interface ClubeComparado {
  readonly clubeId: string;
  readonly ehTime: boolean;
}

function nomeCurtoDoClube(
  clubes: readonly ClubePublico[] | null,
  clubeId: string,
): string {
  return clubes?.find((clube) => clube.id === clubeId)?.nomeCurto ?? clubeId;
}

/** Partidas restantes de um clube (CA-10.2: "jogos que faltam"): nunca
 * finalizada nem cancelada, ordenadas por rodada (RN-15 não define ordem de
 * fase para o Brasileirão — é sempre pontos corridos com rodada numérica). */
function partidasRestantesDoClube(
  partidas: readonly Partida[],
  clubeId: string,
): Partida[] {
  return partidas
    .filter(
      (partida) =>
        (partida.mandanteId === clubeId || partida.visitanteId === clubeId) &&
        partida.status !== 'finalizada' &&
        partida.status !== 'cancelada',
    )
    .sort(
      (a, b) =>
        (a.rodada ?? Number.MAX_SAFE_INTEGER) - (b.rodada ?? Number.MAX_SAFE_INTEGER),
    );
}

/** "6px na cor DAQUELE clube" (UX-SPEC §2/T-08) — mesmo mecanismo de duas
 * camadas (clara/escura) já usado por `FaixaClube`/`PainelTime` para variar
 * por tema sem o componente ler `data-tema` diretamente. */
function estiloColuna(paleta: PaletaClube | undefined): CSSProperties | undefined {
  if (!paleta) {
    return undefined;
  }
  return {
    '--cmp-identidade-clara': paleta.identidade,
    '--cmp-identidade-escura': paleta.identidadeEscuro,
  } as CSSProperties;
}

export interface PropriedadesComparativo {
  /** Injeção de teste; padrão é `globalThis.localStorage`. */
  readonly armazenamento?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  readonly opcoesClubesPublicos?: OpcoesUseClubesPublicos;
  readonly clienteSnapshot?: ClienteSnapshot;
  /** Relógio injetado (GUARDRAILS.md §5) — nunca `Date.now()` direto. */
  readonly agora?: Date;
}

/** T-08 — Comparativo no Brasileirão. Rota: `/comparativo`. */
export function Comparativo({
  armazenamento,
  opcoesClubesPublicos,
  clienteSnapshot,
  agora = new Date(),
}: PropriedadesComparativo = {}): ReactElement {
  useTituloDocumento('Comparativo');
  const navegar = useNavigate();
  const { abrirEscolherTime, abrirEscolherRivais } = useSobreposicoes();

  // REFAT-09-01: reage a `salvarPreferencias` (confirmar rivais em T-07,
  // trocar/limpar time em T-04) sem exigir recarregar a página (CA-02.1).
  const versaoPreferencias = useSyncExternalStore(
    assinarMudancasPreferencias,
    obterVersaoPreferencias,
    obterVersaoPreferencias,
  );
  const { timeId, rivais } = useMemo(
    () => lerPreferenciasComparativo(armazenamento),
    [armazenamento, versaoPreferencias],
  );

  const { clubes } = useClubesPublicos(opcoesClubesPublicos);
  const opcoesSnapshot = clienteSnapshot ? { cliente: clienteSnapshot } : undefined;

  const brasileirao = useSnapshot(
    URL_FUTEBOL_BRASILEIRAO,
    'futebol',
    brasileiraoPublicoSchema,
    opcoesSnapshot,
  );
  const statusIngestao = useSnapshot(
    URL_STATUS,
    'status',
    esquemaStatusPublico,
    opcoesSnapshot,
  );

  function reexecutarBusca(): void {
    void (clienteSnapshot ?? clienteSnapshotPadrao).garantir(
      URL_FUTEBOL_BRASILEIRAO,
      'futebol',
      brasileiraoPublicoSchema,
    );
  }

  // Fluxo de acesso a rivais/comparativo/simulação (UX-SPEC, diagrama FL-04):
  // sem time do coração, o convite é o mesmo de CA-14.3 ("escolha seu time"),
  // aqui adaptado ao contexto de Comparativo (o texto canônico de CA-14.3 é
  // literalmente sobre "o painel" — T-05 — e o UX-SPEC não define uma variante
  // própria para T-08; pequeno desvio documentado, não uma reinterpretação de
  // um texto existente).
  if (timeId === null) {
    return (
      <article className={estilos['pagina']} aria-label="Comparativo">
        <EstadoVazio
          titulo="Comparativo"
          texto="Escolha seu time para ver o comparativo com seus rivais no Brasileirão."
          acao={{ rotulo: 'ESCOLHER MEU TIME', aoClicar: abrirEscolherTime }}
        />
      </article>
    );
  }

  const dados = brasileirao.dados;
  const carregandoInicial = brasileirao.carregando && dados === null;
  const erroSemDados = brasileirao.erro !== null && dados === null;

  // UX-15-02 — `FaixaClube` completa do time do coração, mesma composição de
  // `Home.tsx`/`PainelTime.tsx` (variante `completa`, sem `href`). Usa os
  // dados que já estiverem disponíveis no momento (posição/pontos ficam
  // `null` quando `dados` ainda não chegou, o que a variante `completa` já
  // trata sem exibir o bloco de número).
  const clubeSelecionado = clubes?.find((clube) => clube.id === timeId);
  const clubeParaFaixa: ClubeParaFaixa | undefined = clubeSelecionado
    ? {
        nome: clubeSelecionado.nomeCurto,
        sigla: clubeSelecionado.sigla,
        paleta: clubeSelecionado.paleta,
      }
    : undefined;
  const linhaDoTimeParaFaixa = dados?.classificacao.find(
    (linha) => linha.clubeId === timeId,
  );
  const propsTemporadaFaixa =
    dados?.competicao.temporada !== undefined
      ? { temporada: dados.competicao.temporada }
      : {};
  const faixa = clubeParaFaixa ? (
    <FaixaClube
      variante="completa"
      clube={clubeParaFaixa}
      competicaoNome={dados?.competicao.nome ?? 'Brasileirão Série A'}
      {...propsTemporadaFaixa}
      posicao={linhaDoTimeParaFaixa?.posicao ?? null}
      pontos={linhaDoTimeParaFaixa?.pontos ?? null}
    />
  ) : (
    <FaixaClube variante="neutra" />
  );

  if (carregandoInicial) {
    return (
      <article className={estilos['pagina']} aria-label="Comparativo">
        {faixa}
        <Esqueleto variante="cartao" quantidade={3} />
        <Esqueleto variante="linha-tabela" quantidade={5} />
      </article>
    );
  }

  if (erroSemDados) {
    return (
      <article className={estilos['pagina']} aria-label="Comparativo">
        {faixa}
        <EstadoVazio
          titulo="Comparativo"
          texto="Não conseguimos carregar o comparativo."
          acao={{ rotulo: 'TENTAR DE NOVO', aoClicar: reexecutarBusca }}
        />
      </article>
    );
  }

  // CA-09.5 — Brasileirão do ano ainda sem nenhum dado publicado no produto:
  // rivais continuam escolhíveis (T-07 não depende deste arquivo), só o
  // comparativo em si fica indisponível.
  if (dados !== null && dados.classificacao.length === 0) {
    return (
      <article className={estilos['pagina']} aria-label="Comparativo">
        {faixa}
        <EstadoVazio
          titulo="Comparativo"
          texto="Sem dados disponíveis no momento. Você já pode escolher seus rivais; o comparativo aparece assim que os dados do Brasileirão chegarem."
          acao={{ rotulo: 'ESCOLHER RIVAIS', aoClicar: abrirEscolherRivais }}
        />
      </article>
    );
  }

  // CA-10.5 — nenhum rival escolhido ainda: atalho para T-07.
  if (rivais.length === 0) {
    return (
      <article className={estilos['pagina']} aria-label="Comparativo">
        {faixa}
        <EstadoVazio
          titulo="Comparativo"
          texto="Escolha até 2 rivais para ver a briga lado a lado."
          acao={{ rotulo: 'ESCOLHER RIVAIS', aoClicar: abrirEscolherRivais }}
        />
      </article>
    );
  }

  const classificacao = dados?.classificacao ?? [];
  const partidas = dados?.partidas ?? [];
  const competicaoTemporada = dados?.competicao.temporada;

  // RN-11: até 2 rivais, sempre ≠ timeId — o time do coração vem sempre
  // primeiro (UX-SPEC §2/T-08: "cartões lado a lado, time sempre primeiro").
  const clubesComparados: ClubeComparado[] = [
    { clubeId: timeId, ehTime: true },
    ...rivais
      .filter((rivalId) => rivalId !== timeId)
      .slice(0, 2)
      .map((rivalId) => ({ clubeId: rivalId, ehTime: false })),
  ];

  const linhaDoTime = classificacao.find((linha) => linha.clubeId === timeId);
  const valorMaximoPontos = clubesComparados.reduce((max, { clubeId }) => {
    const linha = classificacao.find((l) => l.clubeId === clubeId);
    return Math.max(max, linha?.pontos ?? 0);
  }, 0);

  const clubesComparadosIds = new Set(clubesComparados.map((c) => c.clubeId));

  // CA-09.6 — Brasileirão ainda não começou: nenhum clube comparado disputou
  // partida (todas as rodadas contam como restantes, sem exigir tratamento
  // especial na filtragem — `partidasRestantesDoClube` já lista tudo que não
  // é finalizada/cancelada).
  const brasileiraoNaoIniciado =
    classificacao.length > 0 &&
    clubesComparados.every((c) => {
      const linha = classificacao.find((l) => l.clubeId === c.clubeId);
      return (linha?.jogos ?? 0) === 0;
    });

  const frescor =
    brasileirao.geradoEm !== null
      ? calcularFrescor(agora, new Date(brasileirao.geradoEm), INTERVALO_FUTEBOL_MINUTOS)
      : null;
  const pausadoPorCota = statusIngestao.dados?.pausadoPorCota === true;

  return (
    <article className={estilos['pagina']} aria-label="Comparativo">
      {faixa}
      <div className={estilos['cabecalho']}>
        <h1 className={estilos['titulo']}>
          Comparativo · Brasileirão
          {competicaoTemporada !== undefined ? ` ${competicaoTemporada}` : ''}
        </h1>
        {pausadoPorCota ? (
          <CarimboFrescor
            estado="pausado"
            texto={`Atualização pausada por limite do provedor. Última atualização ${
              frescor?.atualizadoHa.replace(/^atualizado\s*/, '') ?? 'desconhecida'
            }.`}
            {...(brasileirao.geradoEm !== null
              ? { dataHoraIso: brasileirao.geradoEm }
              : {})}
          />
        ) : frescor ? (
          <CarimboFrescor
            estado={frescor.emAlerta ? 'alerta' : 'normal'}
            texto={frescor.atualizadoHa}
            {...(brasileirao.geradoEm !== null
              ? { dataHoraIso: brasileirao.geradoEm }
              : {})}
          />
        ) : null}
      </div>

      {brasileiraoNaoIniciado ? (
        <p className={estilos['avisoNaoIniciado']}>
          O Brasileirão de {competicaoTemporada ?? ''} ainda não começou. Todas as 38
          rodadas contam como restantes.
        </p>
      ) : null}

      <div className={estilos['colunas']}>
        {clubesComparados.map(({ clubeId, ehTime }) => {
          const linha = classificacao.find((l) => l.clubeId === clubeId);
          const clube = clubes?.find((c) => c.id === clubeId);
          const restantes = partidasRestantesDoClube(partidas, clubeId);
          const diferenca =
            !ehTime && linha && linhaDoTime ? linha.pontos - linhaDoTime.pontos : null;

          return (
            <section
              key={clubeId}
              className={estilos['coluna']}
              style={estiloColuna(clube?.paleta)}
              aria-label={clube?.nomeCurto ?? clubeId}
            >
              <div className={estilos['cartao']}>
                <p className={estilos['cartaoNome']}>
                  {clube?.nomeCurto ?? clubeId}
                  {ehTime ? (
                    <span className={estilos['seloSeuTime']}>SEU TIME</span>
                  ) : null}
                </p>

                {linha ? (
                  <>
                    <div className={estilos['cartaoLinhaPrincipal']}>
                      <span className={estilos['cartaoPosicao']}>{linha.posicao}º</span>
                      <span className={estilos['cartaoPontos']}>{linha.pontos} PTS</span>
                      <span className={estilos['cartaoAproveitamento']}>
                        {formatarPercentual(linha.aproveitamento)}
                      </span>
                      {diferenca !== null ? (
                        <span
                          className={estilos['cartaoDiferenca']}
                          data-sinal={diferenca >= 0 ? 'positivo' : 'negativo'}
                        >
                          {formatarDiferencaPontos(diferenca)}
                        </span>
                      ) : null}
                    </div>

                    <BarraPontuacao
                      nomeClube={clube?.nomeCurto ?? clubeId}
                      valor={linha.pontos}
                      valorMaximo={valorMaximoPontos}
                      unidade="pontos"
                    />

                    <p className={estilos['cartaoResumo']}>
                      {linha.jogos} J · {linha.v}V {linha.e}E {linha.d}D · SALDO{' '}
                      {linha.sg >= 0 ? `+${linha.sg}` : linha.sg}
                    </p>

                    <p className={estilos['cartaoUltimos']}>
                      <span className={estilos['somenteLeitorDeTela']}>
                        Últimos 5 jogos:{' '}
                        {linha.ultimosCinco
                          .map((r) => ROTULO_ULTIMO_RESULTADO[r])
                          .join(', ') || 'nenhum jogo disputado ainda'}
                        .
                      </span>
                      <span aria-hidden="true">
                        ÚLTIMOS 5:{' '}
                        {linha.ultimosCinco.length > 0
                          ? linha.ultimosCinco.join(' ')
                          : '—'}
                      </span>
                    </p>

                    <p className={estilos['cartaoRestantes']}>
                      {restantes.length} jogo{restantes.length === 1 ? '' : 's'} restante
                      {restantes.length === 1 ? '' : 's'}
                    </p>
                  </>
                ) : (
                  <p className={estilos['cartaoResumo']}>
                    Sem dados disponíveis no momento.
                  </p>
                )}
              </div>

              <div className={estilos['calendario']}>
                <p className={estilos['calendarioTitulo']}>Jogos que faltam</p>
                {restantes.length === 0 ? (
                  <p className={estilos['calendarioVazio']}>
                    Não há jogos marcados no momento.
                  </p>
                ) : (
                  <ul className={estilos['calendarioLista']}>
                    {restantes.map((partida) => {
                      const adversarioId =
                        partida.mandanteId === clubeId
                          ? partida.visitanteId
                          : partida.mandanteId;
                      const confrontoDireto = clubesComparadosIds.has(adversarioId);
                      const mando = partida.mandanteId === clubeId ? 'casa' : 'fora';
                      const rodadaOuFase =
                        partida.rodada !== null
                          ? `${partida.rodada}ª rodada`
                          : (partida.fase ?? '—');
                      const adversarioNome = nomeCurtoDoClube(clubes, adversarioId);

                      return (
                        <li
                          key={partida.id}
                          className={estilos['calendarioLinha']}
                          data-confronto-direto={confrontoDireto ? 'true' : undefined}
                        >
                          <span className={estilos['calendarioCabecalho']}>
                            {partida.status === 'adiada'
                              ? `ADIADA — NOVA DATA: ${
                                  partida.dataHora !== null
                                    ? formatarDataCurta(partida.dataHora)
                                    : 'A DEFINIR'
                                }`
                              : partida.status === 'aguardando-resultado'
                                ? 'AGUARDANDO RESULTADO'
                                : partida.dataHora === null
                                  ? `DATA A DEFINIR · ${rodadaOuFase}`
                                  : partida.horarioDefinido
                                    ? `${formatarDataCurta(partida.dataHora)} · ${formatarHorario(partida.dataHora)} · ${rodadaOuFase}`
                                    : `${formatarDataCurta(partida.dataHora)} · HORÁRIO A DEFINIR · ${rodadaOuFase}`}
                          </span>
                          <span className={estilos['calendarioCorpo']}>
                            {adversarioNome} · {mando}
                          </span>
                          {confrontoDireto ? (
                            <span className={estilos['calendarioConfronto']}>
                              <span aria-hidden="true">⚔</span> CONFRONTO DIRETO
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Botao
        variante="primario"
        className={estilos['acaoSimulacao']}
        onClick={() => navegar('/simulacao')}
      >
        ABRIR SIMULAÇÃO
      </Botao>
    </article>
  );
}
