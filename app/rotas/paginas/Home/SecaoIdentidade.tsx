// app/rotas/paginas/Home/SecaoIdentidade.tsx — UI-T02-01 (TASK.md Lote 8)
//
// T-02 Home (UX-SPEC §2 "T-02 · Home"): bloco de identidade (`FaixaClube`),
// "PRÓXIMO JOGO" (CA-07.5) e "A BRIGA NO BRASILEIRÃO" (`BarraPontuacao` +
// atalho para `/simulacao`); estado "sem time" com convite único (CA-14.3).
//
// Seção independente (TASK.md §3, Lote 8: UI-T02-01/02/03 são paralelizáveis
// entre si; UI-T02-04, sequencial, integra as três na rota `/`). Este
// componente não compõe a página inteira — só o bloco de identidade + os
// dois `BlocoPreto` do time; navegação, "SEUS ESPORTES" e "ÚLTIMAS NOTÍCIAS"
// são as outras tarefas do lote.
//
// Fontes de dado (Diretriz de Implementação #10 — caminhos do SDD §2.2):
// - `timeId`: lido direto de `localStorage` (`sportslm.preferencias.v1`),
//   síncrono, sem I/O de rede — é o que permite decidir "sem time" (CA-14.3)
//   sem esperar nada. Só lemos o campo `timeId`, sem cruzar contra o
//   catálogo corrente de clubes (isso é RN-12/CA-06.5, escopo de T-04/
//   UI-T04-01, Lote 9 — não desta tarefa): se o time salvo não existir mais
//   no catálogo, `clubes.find` simplesmente não encontra e a faixa cai no
//   fallback "carregando identidade" até esse caso ser tratado por T-04.
// - `/dados/config/clubes-2026.json` (nome/sigla/paleta do clube,
//   `useClubesPublicos` — novo nesta tarefa, ver o próprio arquivo) e
// - `/dados/futebol/clube/<slug>.json` + `/dados/futebol/brasileirao.json`
//   (próximo jogo e classificação, via `useSnapshot`/UI-DS-08).
//
// Decisão de implementação registrada (TASK.md §6 — pequeno desvio,
// documentado, não um bloqueio): o critério de aceite pede que "a faixa
// renderiza sem esperar rede". A identidade do clube (nome/sigla/cor) só
// existe, neste momento da arquitetura, no arquivo publicado com paleta já
// derivada e validada (ADR-017: "SPA nunca calcula a paleta") — não há hoje
// nenhum mecanismo de bundle/pré-carregamento de config anterior ao primeiro
// render (nenhuma tarefa concluída até aqui criou isso). Interpretação
// aplicada: a busca de configuração roda em paralelo, sem bloquear o
// primeiro paint (nenhum "aguardando" visível) e sem esperar por nenhum
// outro dado de rede (próximo jogo/classificação) — enquanto ela resolve
// (tipicamente instantâneo a partir do cache "longo" do navegador, SDD
// §2.2), a faixa mostra a variante `neutra` em vez de um esqueleto genérico.
// Só o número de posição (que depende de `brasileirao.json`) usa o
// tratamento "sem dados" já embutido em `FaixaClube` (CA-06.4/CA-17.3).
// Sinalizo ao Coordenador que um pré-carregamento real de config antes do
// primeiro paint (equivalente ao "decide onboarding × home ANTES do 1º
// pintar" do SDD §2.5, que hoje só cobre a leitura de `localStorage`) é uma
// peça de infraestrutura ainda em aberto — não deste componente isolado.
//
// "A Briga" (UX-SPEC §3.8.6, wireframe T-02): a anatomia mostra líder + duas
// linhas ao redor do time do torcedor (no exemplo, 1º/5º/6º com o torcedor
// em 6º). O UX-SPEC não formaliza a regra de seleção além do wireframe;
// interpretação aplicada (documentada, não um bloqueio — é detalhe de
// implementação, Diretriz de guardrails): líder do Brasileirão + o clube
// imediatamente acima do torcedor na tabela + o próprio torcedor, deduplicado
// e ordenado por posição (se o torcedor for o líder, mostra o top 3).

import { useMemo } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaixaClube, type ClubeParaFaixa } from '../../../design-system/FaixaClube';
import { BlocoPreto } from '../../../design-system/BlocoPreto';
import { BarraPontuacao } from '../../../design-system/BarraPontuacao';
import { Botao } from '../../../design-system/componentes/Botao';
import { Esqueleto } from '../../../design-system/componentes/Esqueleto/Esqueleto';
import { useSnapshot } from '../../../dados/useSnapshot';
import type { ClienteSnapshot } from '../../../dados/clienteSnapshot';
import {
  useClubesPublicos,
  type OpcoesUseClubesPublicos,
} from '../../../dados/useClubesPublicos';
import type { ClubePublico } from '../../../dados/configPublico';
import {
  brasileiraoPublicoSchema,
  clubeFutebolPublicoSchema,
  urlFutebolClube,
  URL_FUTEBOL_BRASILEIRAO,
  type CampeonatoDoClubePublico,
} from '../../../dados/futebol';
import { CHAVE_ARMAZENAMENTO_PREFERENCIAS } from '../../../armazenamento/preferencias';
import { lerBrutoSemLancar } from '../../../armazenamento/nucleo';
import { preferenciasSchema } from '../../../../dominio/tipos';
import type {
  LinhaClassificacao,
  PaletaClube,
  Partida,
} from '../../../../dominio/tipos/futebol';
import estilos from './SecaoIdentidade.module.css';

/**
 * Lê só o `timeId` salvo, sem cruzar contra o catálogo corrente de clubes
 * (essa validação cruzada — CA-13.4/RN-12 — é feita por
 * `app/armazenamento/preferencias.ts#lerPreferencias`, mas ela exige o
 * catálogo de clubes/esportes/fontes já carregado; aqui precisamos do
 * `timeId` de forma síncrona, antes de qualquer coisa vir da rede, só para
 * decidir entre "sem time" (CA-14.3) e a faixa completa). JSON/esquema
 * inválido ⇒ `null` (mesmo comportamento de "sem time salvo").
 */
export function lerTimeIdSalvo(
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

/** "dom, 13/09" — pt-BR, fuso fixo America/Sao_Paulo (RNF-02, UX-SPEC §1.4).
 * Caixa normal no HTML: a caixa alta do wireframe é `text-transform`
 * (Diretriz de Implementação — "caixa alta é decoração tipográfica"). */
function formatarDataCurta(dataHoraIso: string): string {
  const data = new Date(dataHoraIso);
  const diaSemana = FORMATADOR_DIA_SEMANA.format(data).replace(/\.$/, '');
  return `${diaSemana}, ${FORMATADOR_DIA_MES.format(data)}`;
}

/** "16h00" (RNF-02: "20h30"). */
function formatarHorario(dataHoraIso: string): string {
  const partes = FORMATADOR_HORARIO.formatToParts(new Date(dataHoraIso));
  const hora = partes.find((parte) => parte.type === 'hour')?.value ?? '00';
  const minuto = partes.find((parte) => parte.type === 'minute')?.value ?? '00';
  return `${hora}h${minuto}`;
}

interface ProximoJogoEncontrado {
  readonly partida: Partida;
  readonly competicaoNome: string;
}

/** Próximo jogo do clube entre TODOS os campeonatos da temporada (CA-07.5:
 * "destacar [...] o próximo jogo do time", sem restringir a uma competição),
 * o de data/hora conhecida mais próxima. Partidas sem `dataHora` (CA-08.8)
 * não entram no destaque — CA-07.5 pede "data, hora, adversário, campeonato,
 * mando", os quatro primeiros exigindo data conhecida. */
function encontrarProximoJogo(
  campeonatos: readonly CampeonatoDoClubePublico[],
): ProximoJogoEncontrado | null {
  let melhor: ProximoJogoEncontrado | null = null;

  for (const entrada of campeonatos) {
    for (const partida of entrada.partidas) {
      if (partida.status !== 'agendada' || partida.dataHora === null) {
        continue;
      }
      if (melhor === null || partida.dataHora < (melhor.partida.dataHora ?? '')) {
        melhor = { partida, competicaoNome: entrada.competicao.nome };
      }
    }
  }

  return melhor;
}

/** Seleciona as linhas de "A Briga" (ver nota de decisão no topo do
 * arquivo): líder + linha imediatamente acima do torcedor + a do torcedor,
 * deduplicado e ordenado por posição. */
function selecionarLinhasABriga(
  classificacao: readonly LinhaClassificacao[],
  clubeId: string,
): LinhaClassificacao[] {
  const ordenada = [...classificacao].sort((a, b) => a.posicao - b.posicao);
  const indiceTorcedor = ordenada.findIndex((linha) => linha.clubeId === clubeId);

  if (indiceTorcedor === -1 || ordenada.length === 0) {
    return [];
  }

  if (indiceTorcedor === 0) {
    return ordenada.slice(0, 3);
  }

  const candidatas = [
    ordenada[0],
    ordenada[indiceTorcedor - 1],
    ordenada[indiceTorcedor],
  ];
  const semDuplicata = candidatas.filter(
    (linha, indice): linha is LinhaClassificacao =>
      linha !== undefined &&
      candidatas.findIndex((outra) => outra?.clubeId === linha.clubeId) === indice,
  );

  return semDuplicata.sort((a, b) => a.posicao - b.posicao);
}

function nomeCurtoDoClube(clubes: readonly ClubePublico[], clubeId: string): string {
  return clubes.find((clube) => clube.id === clubeId)?.nomeCurto ?? clubeId;
}

/**
 * `BarraPontuacao`/`BarraPontuacao.module.css` leem `--clube-identidade` como
 * a cor de preenchimento (UI-DS-06: "sobrescrita inline [...] pelo
 * componente-pai que conhece a configuração do clube"). Em "A Briga" cada
 * linha é de um clube diferente, então precisamos do mesmo truque de duas
 * variáveis + seletor de tema que `FaixaClube.module.css` já usa (claro ×
 * escuro) — aqui aplicado por linha via `SecaoIdentidade.module.css`
 * (`.aBrigaLinha`), nunca lendo/computando a paleta (ADR-017).
 */
function estiloLinhaABriga(paleta: PaletaClube | undefined): CSSProperties | undefined {
  if (!paleta) {
    return undefined;
  }
  return {
    '--abriga-identidade-clara': paleta.identidade,
    '--abriga-identidade-escura': paleta.identidadeEscuro,
  } as CSSProperties;
}

export interface PropriedadesSecaoIdentidade {
  /** Injeção de teste; padrão é `globalThis.localStorage`. */
  readonly armazenamento?: Pick<Storage, 'getItem'>;
  /** Injeção de teste para `useClubesPublicos`. */
  readonly opcoesClubesPublicos?: OpcoesUseClubesPublicos;
  /** Injeção de teste para `useSnapshot` (mesmo `ClienteSnapshot` para os
   * dois arquivos de futebol, como as demais telas fariam). */
  readonly clienteSnapshot?: ClienteSnapshot;
  /**
   * Chamado ao ativar "ESCOLHER MEU TIME" no estado "sem time" (CA-14.3).
   * Ponto de integração para UI-T02-04 abrir a sobreposição T-04 real
   * (`app/rotas/sobreposicoes/EscolherTime.tsx`, ainda placeholder — Lote 9).
   * Sem esta prop (uso isolado desta seção), navega para `/onboarding` como
   * alternativa funcional — a única rota hoje capaz de levar à escolha de
   * time — em vez de deixar o botão sem efeito.
   */
  readonly aoEscolherTime?: () => void;
  /**
   * REFAT-10-01: quando `true`, esta seção não renderiza `FaixaClube` (nem a
   * variante `completa` nem a `neutra`) — usado pela Home quando a faixa já
   * é renderizada por `FaixaClubeDoTime`, full-width, fora da grade de duas
   * colunas (ver `Home.tsx`/`Home.module.css`). Sozinha (uso isolado desta
   * seção, ex.: os testes existentes) o padrão continua `false`, preservando
   * o comportamento anterior — a faixa faz parte do bloco único de
   * identidade, como antes de REFAT-10-01.
   */
  readonly ocultarFaixaClube?: boolean;
}

/** UI-T02-01 — bloco de identidade + PRÓXIMO JOGO + A BRIGA da Home (T-02). */
export function SecaoIdentidade({
  armazenamento,
  opcoesClubesPublicos,
  clienteSnapshot,
  aoEscolherTime,
  ocultarFaixaClube = false,
}: PropriedadesSecaoIdentidade): ReactElement {
  const navegar = useNavigate();
  const timeId = useMemo(() => lerTimeIdSalvo(armazenamento), [armazenamento]);

  const { clubes } = useClubesPublicos(opcoesClubesPublicos);
  const opcoesSnapshot = clienteSnapshot ? { cliente: clienteSnapshot } : undefined;

  const brasileirao = useSnapshot(
    URL_FUTEBOL_BRASILEIRAO,
    'futebol',
    brasileiraoPublicoSchema,
    opcoesSnapshot,
  );
  const futebolDoClube = useSnapshot(
    timeId !== null ? urlFutebolClube(timeId) : URL_FUTEBOL_BRASILEIRAO,
    'futebol',
    clubeFutebolPublicoSchema,
    opcoesSnapshot,
  );

  function aoAtivarEscolherTime(): void {
    if (aoEscolherTime) {
      aoEscolherTime();
      return;
    }
    navegar('/onboarding');
  }

  if (timeId === null) {
    return (
      <section className={estilos['secao']} aria-label="Meu time">
        {ocultarFaixaClube ? null : <FaixaClube variante="neutra" />}
        <div className={estilos['convite']}>
          <p className={estilos['conviteTexto']}>
            Escolha seu time para ver o painel com todos os campeonatos do ano.
          </p>
          <Botao variante="primario" onClick={aoAtivarEscolherTime}>
            ESCOLHER MEU TIME
          </Botao>
        </div>
      </section>
    );
  }

  const clubeSelecionado = clubes?.find((clube) => clube.id === timeId);
  const linhaDoTimeNoBrasileirao = brasileirao.dados?.classificacao.find(
    (linha) => linha.clubeId === timeId,
  );

  const clubeParaFaixa: ClubeParaFaixa | undefined = clubeSelecionado
    ? {
        nome: clubeSelecionado.nomeCurto,
        sigla: clubeSelecionado.sigla,
        paleta: clubeSelecionado.paleta,
      }
    : undefined;

  const proximoJogo = futebolDoClube.dados
    ? encontrarProximoJogo(futebolDoClube.dados)
    : null;
  const linhasABriga =
    brasileirao.dados && clubes
      ? selecionarLinhasABriga(brasileirao.dados.classificacao, timeId)
      : [];
  const valorMaximoABriga = linhasABriga.reduce(
    (max, linha) => Math.max(max, linha.pontos),
    0,
  );

  // `exactOptionalPropertyTypes` (Diretriz #1): props opcionais só entram no
  // objeto quando têm valor — nunca `undefined` explícito.
  const propsTemporada =
    brasileirao.dados !== null
      ? { temporada: brasileirao.dados.competicao.temporada }
      : {};

  return (
    <section className={estilos['secao']} aria-label="Meu time">
      {ocultarFaixaClube ? null : clubeParaFaixa ? (
        <FaixaClube
          variante="completa"
          clube={clubeParaFaixa}
          href="/time"
          competicaoNome={brasileirao.dados?.competicao.nome ?? 'Brasileirão Série A'}
          {...propsTemporada}
          posicao={linhaDoTimeNoBrasileirao?.posicao ?? null}
          pontos={linhaDoTimeNoBrasileirao?.pontos ?? null}
        />
      ) : (
        <FaixaClube variante="neutra" />
      )}

      {proximoJogo ? (
        <BlocoPreto variante="proximo-jogo" rotulo="Próximo jogo">
          <p className={estilos['proximoJogoDataHora']}>
            {formatarDataCurta(proximoJogo.partida.dataHora ?? '')} ·{' '}
            {formatarHorario(proximoJogo.partida.dataHora ?? '')}
          </p>
          <p className={estilos['proximoJogoConfronto']}>
            {clubes
              ? nomeCurtoDoClube(clubes, proximoJogo.partida.mandanteId)
              : proximoJogo.partida.mandanteId}
            {' × '}
            {clubes
              ? nomeCurtoDoClube(clubes, proximoJogo.partida.visitanteId)
              : proximoJogo.partida.visitanteId}
          </p>
          <p className={estilos['proximoJogoMeta']}>
            {proximoJogo.partida.mandanteId === timeId ? 'casa' : 'fora'}
            {` · ${proximoJogo.competicaoNome}`}
            {proximoJogo.partida.rodada !== null
              ? ` · ${proximoJogo.partida.rodada}ª rodada`
              : ''}
            {proximoJogo.partida.estadio ? ` · ${proximoJogo.partida.estadio}` : ''}
          </p>
        </BlocoPreto>
      ) : futebolDoClube.carregando ? (
        <Esqueleto variante="bloco" />
      ) : null}

      {linhasABriga.length > 0 ? (
        <BlocoPreto variante="a-briga" rotulo="A briga no Brasileirão">
          <ul className={estilos['aBrigaLista']}>
            {linhasABriga.map((linha) => {
              const clubeDaLinha = clubes?.find((clube) => clube.id === linha.clubeId);
              const ehOTorcedor = linha.clubeId === timeId;
              return (
                <li
                  key={linha.clubeId}
                  className={estilos['aBrigaLinha']}
                  style={estiloLinhaABriga(clubeDaLinha?.paleta)}
                  data-seu-time={ehOTorcedor ? 'true' : undefined}
                >
                  <span className={estilos['aBrigaPosicao']}>{`${linha.posicao}º`}</span>
                  <BarraPontuacao
                    nomeClube={clubeDaLinha?.nomeCurto ?? linha.clubeId}
                    {...(clubeDaLinha ? { rotuloVisivel: clubeDaLinha.sigla } : {})}
                    valor={linha.pontos}
                    valorMaximo={valorMaximoABriga}
                  />
                  {ehOTorcedor ? <span className={estilos['aBrigaSeu']}>seu</span> : null}
                </li>
              );
            })}
          </ul>
          <Botao variante="primario" onClick={() => navegar('/simulacao')}>
            SIMULAR OS JOGOS QUE FALTAM
          </Botao>
        </BlocoPreto>
      ) : brasileirao.carregando ? (
        <Esqueleto variante="bloco" />
      ) : null}
    </section>
  );
}
