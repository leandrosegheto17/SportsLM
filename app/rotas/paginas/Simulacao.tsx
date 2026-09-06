// app/rotas/paginas/Simulacao.tsx — UI-T09-01/UI-T09-02 (TASK.md Lote 11)
//
// T-09 · Simulação de cenário (UX-SPEC §2/T-09, PRD-TECNICO CA-11.1, CA-11.4,
// CA-11.6): grade de palpites por rodada para as partidas restantes do time
// do torcedor e dos rivais no Brasileirão, confronto direto espelhado sem
// contradição (CA-11.4) e travamento quando o resultado real chega (CA-11.6).
// Substitui o placeholder de `/simulacao` (FUND-04).
//
// UI-T09-02 (esta tarefa, sequencial após UI-T09-01) acrescenta ao MESMO
// componente: bloco PROJEÇÃO fixo com recálculo imediato via `simular`/
// `dominio/simulacao/motor.ts` (DOM-05) — pontuação projetada, máximo
// possível e ordenação só entre os clubes comparados (CA-11.2, CA-11.3,
// CA-11.10) —, "limpar cenário" com confirmação (CA-11.7,
// `app/armazenamento/cenario.ts`/`limparCenario`) e o estado "sem jogos
// restantes" com o texto canônico de pontuação final (CA-11.8). O recálculo é
// puramente síncrono/local (`useMemo` sobre `simular`, sem rede) — cumpre
// trivialmente o orçamento de < 100 ms de RNF-14/ADR-016 (SDD §3, ADR-016
// linha "Recálculo da simulação").
//
// WCAG 2.4.11 (foco nunca obscurecido pelo bloco fixo): resolvido inteiramente
// por `BlocoPreto`/UI-DS-02 (variante "projecao") — o componente já mede a
// própria altura e publica `scroll-padding-bottom` em `:root` enquanto
// montado; esta tela só usa a variante, sem reimplementar o mecanismo.
// Fonte de dado única (Diretriz de Implementação #10): `/dados/futebol/
// brasileirao.json` (`useSnapshot`/UI-DS-08, chave `'futebol'`) — é o único
// arquivo publicado com as partidas de TODOS os 20 clubes/todas as rodadas
// (`app/dados/futebol.ts`/UI-T02-01), necessário para conhecer também as
// partidas dos rivais, não só as do time do torcedor.
//
// Motor de simulação (DOM-05, `dominio/simulacao`): esta tarefa
// deliberadamente NÃO reimplementa a regra de pontuação/confronto direto —
// `dominio/simulacao/motor.ts` já modela o confronto direto como **uma única
// entrada de palpite por partida, sempre da perspectiva do mandante**
// (`EntradaSimulacao.palpites`, ver comentário em `dominio/simulacao/
// tipos.ts`), de forma que a contradição (CA-11.4) é estruturalmente
// impossível: não existe um segundo campo onde o rival poderia registrar um
// resultado inconsistente. Esta tela respeita a MESMA convenção de
// armazenamento (um valor por id de partida, perspectiva do mandante) em
// `Cenario.palpites` (`dominio/tipos/estado-local.ts`/DOM-01), e só traduz
// esse valor único para a perspectiva de exibição do clube comparado
// (`converterParaPerspectiva`/`converterParaMandante` abaixo) — nunca duplica
// a regra de pontuação em si (isso é `simular`, chamado só por UI-T09-02).
// `estaTravada`/`resultadoRealDoClube` abaixo são helpers de EXIBIÇÃO
// (formatam letra/estado a partir de campos já publicados), equivalentes em
// espírito aos helpers privados de `motor.ts`, mas não recalculam pontuação.
//
// REFAT-11-01 (TASK.md Lote 11 — Refatoração): adiciona a matriz rodada×clube
// de desktop (UX-SPEC §6, "≥900: Matriz rodada × clube; PROJEÇÃO fixo; barras
// de acumulado no rodapé") que a decisão acima (UI-T09-01) tinha
// deliberadamente adiado. Abaixo de 900px a lista por rodada (`.grade`,
// inalterada) continua sendo a única grade visível; a partir de 900px, uma
// segunda estrutura (`.matriz`) — sempre presente no DOM, nunca reinserida —
// passa a ser a visível, com uma coluna por clube comparado (cabeçalho
// `AvatarClube` + nome) e barras de acumulado (`BarraPontuacao`, ver
// comentário de UI-DS-06: "usada [...] no acumulado da simulação") no
// rodapé.
//
// Técnica de visibilidade por breakpoint (mesma já usada em
// `DetalheCampeonato.tsx`/UI-T06-02, "sem lógica de `matchMedia` em JS"):
// `.matriz` carrega o atributo HTML `hidden` incondicionalmente; a regra
// `@media (min-width: 900px)` de `Simulacao.module.css` sobrepõe com
// `display: grid !important` (o mesmo `!important` já bate a folha de estilo
// do user-agent que o atributo `hidden` produz) e esconde `.grade` na mesma
// consulta. Como o Vitest/jsdom não aplica media queries de folha externa,
// `.matriz` permanece oculta (via o atributo `hidden` — verificado
// diretamente por `dom-accessibility-api`/`getByRole`, sem depender de CSS)
// durante os testes, preservando exatamente o comportamento hoje coberto por
// `Simulacao.test.tsx` (CA-11.1 a CA-11.10 inalterados) sem precisar de
// nenhuma lógica de `matchMedia`/`ResizeObserver` em JS.
//
// Decisão de implementação registrada (pequeno desvio, TASK.md §6): como a
// matriz precisa repetir, por natureza (uma coluna por clube), o MESMO texto
// de rótulo de rodada, "CONFRONTO DIRETO" e "DISPUTADA" que a lista mobile já
// usa, `Simulacao.test.tsx` precisou ganhar dois `data-testid`
// (`grade-lista`/`matriz-desktop`) só para as duas asserções que buscavam
// esse texto por `getByText` (que, ao contrário de `getByRole`, não filtra
// elementos com o atributo `hidden` — `getByRole` já continuava único sem
// nenhuma mudança) — nenhuma asserção de comportamento foi enfraquecida, só
// escopada para o container correspondente. O confronto direto na matriz usa
// de fato a SEGUNDA ocorrência em variante `espelhado` (UI-DS-05), somente
// leitura, do lado do clube que não é a `clubeReferencia` de `montarLinha` —
// nunca uma segunda fonte de verdade: as duas ocorrências (editável e
// espelhada) leem/gravam o mesmo `Cenario.palpites[partida.id]`.

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { Link } from 'react-router-dom';
import { useTituloDocumento } from '../useTituloDocumento';
import { useSnapshot } from '../../dados/useSnapshot';
import { clienteSnapshotPadrao, type ClienteSnapshot } from '../../dados/clienteSnapshot';
import {
  useClubesPublicos,
  type OpcoesUseClubesPublicos,
} from '../../dados/useClubesPublicos';
import type { ClubePublico } from '../../dados/configPublico';
import { brasileiraoPublicoSchema, URL_FUTEBOL_BRASILEIRAO } from '../../dados/futebol';
import { CHAVE_ARMAZENAMENTO_PREFERENCIAS } from '../../armazenamento/preferencias';
import { lerBrutoSemLancar } from '../../armazenamento/nucleo';
import {
  construirEscopoCenario,
  criarSalvadorDeCenarioComDebounce,
  lerCenario,
  limparCenario,
  salvarCenario,
} from '../../armazenamento/cenario';
import { preferenciasSchema } from '../../../dominio/tipos';
import type { Cenario, Palpite } from '../../../dominio/tipos/estado-local';
import type { Partida } from '../../../dominio/tipos/futebol';
import { simular } from '../../../dominio/simulacao/motor';
import type {
  EstatisticasClube,
  PartidaRestante,
} from '../../../dominio/simulacao/tipos';
import { SeletorPalpite } from '../../design-system/SeletorPalpite';
import { BarraPontuacao } from '../../design-system/BarraPontuacao';
import {
  AvatarClube,
  BannerAlerta,
  Esqueleto,
  EstadoVazio,
} from '../../design-system/componentes';
import { Botao } from '../../design-system/componentes/Botao';
import { Sobreposicao } from '../../design-system/componentes/Sobreposicao';
import { BlocoPreto } from '../../design-system/BlocoPreto';
import estilos from './Simulacao.module.css';

/** Igual a `PainelTime`/`DetalheCampeonato` (UI-T05-01/UI-T06-01): lê
 * `timeId`/`rivais` salvos, de forma síncrona, sem cruzar contra o catálogo
 * (essa validação cruzada é de `lerPreferencias`, que exige o catálogo
 * carregado). JSON/esquema inválido ⇒ sem time/sem rivais, mesmo
 * comportamento de "nada salvo". */
function lerTimeERivaisSalvos(
  armazenamento: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): { readonly timeId: string | null; readonly rivais: readonly string[] } {
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

/** Inverte um resultado (CA-11.4/RN-14): vitória ⇄ derrota, empate fixo —
 * mesma regra de `inverter`/`motor.ts`, redefinida aqui só para tradução de
 * EXIBIÇÃO entre a perspectiva do mandante (como `Cenario.palpites` sempre
 * guarda) e a do clube comparado que está do lado visitante. */
function inverterPalpite(valor: Palpite): Palpite {
  if (valor === 'vitoria') return 'derrota';
  if (valor === 'derrota') return 'vitoria';
  return 'empate';
}

/** Valor salvo (perspectiva do mandante) → valor mostrado ao torcedor, na
 * perspectiva do `clubeReferencia` da linha. */
function converterParaPerspectiva(
  valorMandante: Palpite | undefined,
  ehMandante: boolean,
): Palpite | null {
  if (valorMandante === undefined) return null;
  return ehMandante ? valorMandante : inverterPalpite(valorMandante);
}

/** Valor escolhido pelo torcedor (perspectiva do `clubeReferencia`) → valor a
 * persistir em `Cenario.palpites` (sempre perspectiva do mandante). */
function converterParaMandante(
  valorPerspectiva: Palpite | null,
  ehMandante: boolean,
): Palpite | null {
  if (valorPerspectiva === null) return null;
  return ehMandante ? valorPerspectiva : inverterPalpite(valorPerspectiva);
}

/** Partida com resultado real já ingerido (CA-11.6/ADR-010 item 4) — mesma
 * checagem de `estaTravada`/`motor.ts`, para fins de exibição (🔒 DISPUTADA). */
function estaTravada(partida: Partida): boolean {
  return partida.status === 'finalizada' && partida.placar !== null;
}

/** Resultado real (V/E/D) da partida, na perspectiva de `ehMandante`. */
function resultadoRealDoClube(
  placar: NonNullable<Partida['placar']>,
  ehMandante: boolean,
): Palpite {
  const golsProprio = ehMandante ? placar.mandante : placar.visitante;
  const golsAdversario = ehMandante ? placar.visitante : placar.mandante;
  if (golsProprio > golsAdversario) return 'vitoria';
  if (golsProprio < golsAdversario) return 'derrota';
  return 'empate';
}

/** Partidas restantes "relevantes" para a grade (CA-11.1): envolvem o time do
 * torcedor ou algum rival, e (a) ainda estão em aberto (agendada/aguardando
 * resultado/adiada — "cancelada" nunca acontece, não entra na simulação), ou
 * (b) já foram finalizadas mas faziam parte do cenário (tinham palpite
 * registrado, ou já haviam sido vistas como travadas antes) — CA-11.6: uma
 * partida travada continua na grade, mostrando "DISPUTADA", não desaparece. */
function partidasRelevantes(
  partidas: readonly Partida[],
  comparados: ReadonlySet<string>,
  palpites: Readonly<Record<string, Palpite>>,
  partidasTravadasVistas: readonly string[],
): Partida[] {
  const vistasSet = new Set(partidasTravadasVistas);
  return partidas.filter((partida) => {
    if (partida.rodada === null) return false;
    const envolveComparado =
      comparados.has(partida.mandanteId) || comparados.has(partida.visitanteId);
    if (!envolveComparado) return false;
    if (partida.status === 'cancelada') return false;
    if (!estaTravada(partida)) return true;
    return palpites[partida.id] !== undefined || vistasSet.has(partida.id);
  });
}

interface LinhaGrade {
  readonly partida: Partida;
  readonly confrontoDireto: boolean;
  /** Clube comparado cuja perspectiva a linha exibe (perspectiva do
   * mandante nos confrontos diretos, por convenção — mesma de
   * `Cenario.palpites`). */
  readonly clubeReferencia: string;
  readonly ehMandante: boolean;
}

/** Monta uma linha por partida (nunca duas linhas para a mesma partida,
 * mesmo em confronto direto — ver decisão de implementação no topo do
 * arquivo). `ordemComparados` prioriza o time do torcedor como referência
 * quando os dois lados do confronto são comparados. */
function montarLinha(partida: Partida, ordemComparados: readonly string[]): LinhaGrade {
  const comparadosSet = new Set(ordemComparados);
  const confrontoDireto =
    comparadosSet.has(partida.mandanteId) && comparadosSet.has(partida.visitanteId);

  if (confrontoDireto) {
    const preferido = ordemComparados.find(
      (id) => id === partida.mandanteId || id === partida.visitanteId,
    );
    const clubeReferencia = preferido ?? partida.mandanteId;
    return {
      partida,
      confrontoDireto: true,
      clubeReferencia,
      ehMandante: clubeReferencia === partida.mandanteId,
    };
  }

  const clubeReferencia = comparadosSet.has(partida.mandanteId)
    ? partida.mandanteId
    : partida.visitanteId;
  return {
    partida,
    confrontoDireto: false,
    clubeReferencia,
    ehMandante: clubeReferencia === partida.mandanteId,
  };
}

function nomeClube(clubes: readonly ClubePublico[] | null, clubeId: string): string {
  return clubes?.find((clube) => clube.id === clubeId)?.nomeCurto ?? clubeId;
}

/** "(C)"/"(F)" — abreviação de mando usada só na coluna estreita da matriz de
 * desktop (REFAT-11-01, wireframe "Fluminense (F)"); a lista mobile continua
 * usando a palavra por extenso ("casa"/"fora", ver legenda mais abaixo). */
function mandoAbreviado(ehMandante: boolean): string {
  return ehMandante ? '(C)' : '(F)';
}

/** A partida (se houver) de uma rodada que envolve `clubeId` — usada para
 * montar a célula da coluna desse clube na matriz de desktop (REFAT-11-01).
 * No Brasileirão (pontos corridos, sem repescagem por rodada) cada clube joga
 * no máximo uma vez por rodada, então o primeiro resultado já é o único. */
function linhaDoClubeNaRodada(
  linhasDaRodada: readonly LinhaGrade[],
  clubeId: string,
): LinhaGrade | undefined {
  return linhasDaRodada.find(
    ({ partida }) => partida.mandanteId === clubeId || partida.visitanteId === clubeId,
  );
}

interface CelulaMatriz {
  readonly idPartida: string;
  readonly legenda: string;
  /** `true` só para a `clubeReferencia` de `montarLinha` — a mesma regra de
   * "uma única entrada editável por confronto direto" (CA-11.4) que a lista
   * mobile já segue; a outra coluna do confronto mostra a variante
   * `espelhado` somente leitura (UI-DS-05). */
  readonly ehEditavel: boolean;
  readonly ehMandanteDoClube: boolean;
  readonly valorPerspectiva: Palpite | null;
  readonly resultadoReal?: Palpite;
  readonly textoConfronto?: string;
}

/** Monta os dados de exibição da célula [clube × rodada] da matriz de
 * desktop (REFAT-11-01) a partir da MESMA `LinhaGrade`/`Cenario.palpites` que
 * a lista mobile usa — nunca uma segunda fonte de verdade (mesma nota de
 * arquitetura do topo do arquivo). */
function montarCelulaMatriz(
  linha: LinhaGrade,
  clubeId: string,
  clubes: readonly ClubePublico[] | null,
  palpites: Readonly<Record<string, Palpite>>,
): CelulaMatriz {
  const { partida, confrontoDireto, clubeReferencia } = linha;
  const ehMandanteDoClube = partida.mandanteId === clubeId;
  const adversarioId = ehMandanteDoClube ? partida.visitanteId : partida.mandanteId;
  // Mesmo padrão do wireframe desktop (UX-SPEC §6): cada coluna mostra o
  // ADVERSÁRIO do clube dessa coluna (o próprio clube já está identificado
  // pelo cabeçalho da coluna) + o mando abreviado — inclusive em confronto
  // direto, só com o "⚔" a mais para destacar; o texto completo "CONFRONTO
  // DIRETO — ..." já vem embutido na variante `espelhado` do próprio
  // `SeletorPalpite` (UI-DS-05), nunca duplicado aqui.
  const legenda = `${confrontoDireto ? '⚔ ' : ''}${nomeClube(clubes, adversarioId)} ${mandoAbreviado(ehMandanteDoClube)}`;
  const valorMandante = palpites[partida.id];
  const valorPerspectiva = converterParaPerspectiva(valorMandante, ehMandanteDoClube);
  const ehEditavel = clubeId === clubeReferencia;
  const idPartida = `${partida.id}::matriz::${clubeId}`;

  if (estaTravada(partida) && partida.placar !== null) {
    return {
      idPartida,
      legenda,
      ehEditavel,
      ehMandanteDoClube,
      valorPerspectiva,
      resultadoReal: resultadoRealDoClube(partida.placar, ehMandanteDoClube),
    };
  }

  if (confrontoDireto) {
    return {
      idPartida,
      legenda,
      ehEditavel,
      ehMandanteDoClube,
      valorPerspectiva,
      textoConfronto: textoConfrontoDireto(
        valorMandante ?? null,
        nomeClube(clubes, partida.mandanteId),
        nomeClube(clubes, partida.visitanteId),
      ),
    };
  }

  return { idPartida, legenda, ehEditavel, ehMandanteDoClube, valorPerspectiva };
}

/** Mesmo mecanismo de duas variáveis (clara/escura) que `SecaoIdentidade`/"A
 * Briga" já usa para alimentar `--clube-identidade` de `BarraPontuacao`
 * (UI-DS-06) sem o componente ler `data-tema` diretamente. */
function estiloAcumuladoClube(
  paleta: ClubePublico['paleta'] | undefined,
): CSSProperties | undefined {
  if (!paleta) {
    return undefined;
  }
  return {
    '--acumulado-identidade-clara': paleta.identidade,
    '--acumulado-identidade-escura': paleta.identidadeEscuro,
  } as CSSProperties;
}

/** Microcópia do confronto direto (UX-SPEC §2/T-09, "Empate: 1 ponto para
 * cada."): descreve o efeito do valor atual nos dois lados, ou uma frase
 * genérica de "sem contradição possível" quando ainda não há palpite. Texto
 * de composição própria (não canônico da Seção 4 — só os estados da tabela de
 * Seção 4 são copiados literalmente, Diretriz de Implementação #9). */
function textoConfrontoDireto(
  valorMandante: Palpite | null,
  nomeMandante: string,
  nomeVisitante: string,
): string {
  if (valorMandante === null) {
    return `O resultado vale para os dois lados: ${nomeMandante} e ${nomeVisitante} nunca podem ter palpites contraditórios aqui.`;
  }
  if (valorMandante === 'empate') {
    return `Empate: 1 ponto para ${nomeMandante} e para ${nomeVisitante}.`;
  }
  const vencedor = valorMandante === 'vitoria' ? nomeMandante : nomeVisitante;
  const perdedor = valorMandante === 'vitoria' ? nomeVisitante : nomeMandante;
  return `Vitória de ${vencedor} vale derrota para ${perdedor}.`;
}

const FORMATADOR_DIA_MES = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
});

/** "13/09" (ou `''` quando nenhuma partida da rodada tem `dataHora`
 * conhecida) — extraído de `textoCabecalhoRodada` para ser reaproveitado
 * também pelo rótulo de linha "24ª / 13/09" da matriz de desktop
 * (REFAT-11-01), sem repetir a palavra "RODADA" (que só aparece uma vez, no
 * cabeçalho de coluna da matriz — evita colidir com o texto "Nª RODADA" que
 * `Simulacao.test.tsx` já busca por `getByText` na lista mobile). */
function dataCurtaDaRodada(partidas: readonly Partida[]): string {
  const primeiraComData = partidas.find((partida) => partida.dataHora !== null);
  return primeiraComData?.dataHora !== undefined && primeiraComData.dataHora !== null
    ? FORMATADOR_DIA_MES.format(new Date(primeiraComData.dataHora))
    : '';
}

/** "24ª RODADA · 13/09" — igual ao wireframe da Seção 2 (UX-SPEC/T-09); sem
 * sufixo de data quando nenhuma partida da rodada tem `dataHora` conhecida. */
function textoCabecalhoRodada(rodada: number, partidas: readonly Partida[]): string {
  const data = dataCurtaDaRodada(partidas);
  return `${rodada}ª RODADA${data ? ` · ${data}` : ''}`;
}

/** Texto canônico de CA-11.8/UX-SPEC §4 T-09 ("Vazio (sem jogos restantes)"):
 * "Campeonato encerrado — sem jogos restantes. Pontuação final: Palmeiras 74,
 * São Paulo 68, Corinthians 65." — copiado literalmente (Diretriz de
 * Implementação #9), com a lista de "Clube pontos" substituída pelos dados
 * reais, na mesma ordem final do motor (`saidaSimulacao.ordenacao`). */
function textoCampeonatoEncerrado(
  ranking: readonly { clubeId: string; stats: EstatisticasClube }[],
  clubes: readonly ClubePublico[] | null,
): string {
  const pontuacaoFinal = ranking
    .map(({ clubeId, stats }) => `${nomeClube(clubes, clubeId)} ${stats.projetado}`)
    .join(', ');
  return `Campeonato encerrado — sem jogos restantes. Pontuação final: ${pontuacaoFinal}.`;
}

/** Texto canônico de CA-11.8/UX-SPEC §4 T-09 ("Vazio (nenhum palpite)"), para
 * o corpo do bloco PROJEÇÃO quando ainda não há nenhum palpite registrado no
 * cenário: "São Paulo 42 pts (máx 87). Faça um palpite para ver a projeção
 * mudar." — copiado literalmente (Diretriz #9), com o clube/pontuação reais
 * do time do torcedor (referência única deste texto, mesmo com rivais). */
function textoProjecaoSemPalpite(
  nomeTime: string,
  statsTime: EstatisticasClube | undefined,
): string {
  const projetado = statsTime?.projetado ?? 0;
  const maximo = statsTime?.maximoPossivel ?? 0;
  return `${nomeTime} ${projetado} pts (máx ${maximo}). Faça um palpite para ver a projeção mudar.`;
}

/** Microcópia fixa do corpo do bloco PROJEÇÃO com o ranking já preenchido
 * (UX-SPEC §2/T-09, mesmo texto nos wireframes mobile e desktop) —
 * disclaimer permanente de CA-11.10/TR-5 ("aviso [...] dentro do bloco
 * PROJEÇÃO fixo, que nunca rola para fora"), composição própria (não é
 * estado da Seção 4), registrada aqui por ser texto fixo repetido. */
function textoDisclaimerProjecao(quantidadeComparados: number): string {
  const sujeito =
    quantidadeComparados <= 1
      ? 'Projeção do clube comparado.'
      : `Projeção entre os ${String(quantidadeComparados)} clubes comparados.`;
  return `${sujeito} Não é a posição na tabela. Partida sem palpite conta 0 ponto.`;
}

export interface PropriedadesSimulacao {
  /** Injeção de teste; padrão é `globalThis.localStorage`. */
  readonly armazenamento?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  readonly opcoesClubesPublicos?: OpcoesUseClubesPublicos;
  readonly clienteSnapshot?: ClienteSnapshot;
}

/** T-09 — Simulação de cenário: grade de palpites (UI-T09-01). Rota:
 * `/simulacao`. */
export function Simulacao({
  armazenamento,
  opcoesClubesPublicos,
  clienteSnapshot,
}: PropriedadesSimulacao = {}): ReactElement {
  useTituloDocumento('Simulação');

  const { timeId, rivais } = useMemo(
    () => lerTimeERivaisSalvos(armazenamento),
    [armazenamento],
  );
  const { clubes } = useClubesPublicos(opcoesClubesPublicos);
  const opcoesSnapshot = clienteSnapshot ? { cliente: clienteSnapshot } : undefined;

  const brasileirao = useSnapshot(
    URL_FUTEBOL_BRASILEIRAO,
    'futebol',
    brasileiraoPublicoSchema,
    opcoesSnapshot,
  );

  const ordemComparados = useMemo(
    () => (timeId !== null ? [timeId, ...rivais] : []),
    [timeId, rivais],
  );
  const comparadosSet = useMemo(() => new Set(ordemComparados), [ordemComparados]);

  const dados = brasileirao.dados;
  const temporada = dados?.competicao.temporada;

  const escopoAtual = useMemo(() => {
    if (timeId === null || temporada === undefined) return null;
    return construirEscopoCenario(temporada, timeId, rivais);
  }, [timeId, rivais, temporada]);

  const [palpites, setPalpites] = useState<Readonly<Record<string, Palpite>>>({});
  const [partidasTravadasVistas, setPartidasTravadasVistas] = useState<readonly string[]>(
    [],
  );
  const [modoMemoria, setModoMemoria] = useState(false);
  const [avisoTravamento, setAvisoTravamento] = useState(0);
  const cenarioCarregadoRef = useRef<string | null>(null);

  // Carrega o cenário salvo assim que o escopo (temporada:time:rivais) é
  // conhecido — uma única vez por escopo (CA-11.9), nunca sobrescreve
  // digitação em andamento se o escopo não mudou de fato.
  useEffect(() => {
    if (escopoAtual === null) return;
    if (cenarioCarregadoRef.current === escopoAtual) return;
    cenarioCarregadoRef.current = escopoAtual;

    const resultado = lerCenario(escopoAtual, armazenamento);
    setModoMemoria(resultado.modoMemoria);
    if (resultado.cenario) {
      setPalpites(resultado.cenario.palpites);
      setPartidasTravadasVistas(resultado.cenario.partidasTravadasVistas);
    } else {
      setPalpites({});
      setPartidasTravadasVistas([]);
    }
  }, [escopoAtual, armazenamento]);

  const partidasFiltradas = useMemo(
    () =>
      dados
        ? partidasRelevantes(
            dados.partidas,
            comparadosSet,
            palpites,
            partidasTravadasVistas,
          )
        : [],
    [dados, comparadosSet, palpites, partidasTravadasVistas],
  );

  const linhas = useMemo(
    () => partidasFiltradas.map((partida) => montarLinha(partida, ordemComparados)),
    [partidasFiltradas, ordemComparados],
  );

  // UI-T09-02 — pontuação atual (ponto de partida do motor, CA-11.2) de cada
  // clube comparado, lida da classificação já publicada (não recalculada
  // aqui — `dominio/classificacao` já é dono dessa regra, fora do escopo
  // desta tela). Ausência na classificação (temporada ainda sem jogos do
  // clube) conta 0, mesmo padrão já usado por `Comparativo.tsx`.
  const pontosAtuaisPorClube = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const linha of dados?.classificacao ?? []) {
      mapa.set(linha.clubeId, linha.pontos);
    }
    return mapa;
  }, [dados]);

  const clubesParaMotor = useMemo(
    () =>
      ordemComparados.map((id) => ({
        id,
        pontosAtuais: pontosAtuaisPorClube.get(id) ?? 0,
      })),
    [ordemComparados, pontosAtuaisPorClube],
  );

  // `partidasFiltradas` já é exatamente "as partidas restantes relevantes
  // para algum comparado" (mesma seleção que a grade usa) — o motor (DOM-05)
  // recebe a MESMA lista, nunca uma segunda derivação da regra de relevância.
  const partidasParaMotor = useMemo<PartidaRestante[]>(
    () =>
      partidasFiltradas.map((partida) => ({
        id: partida.id,
        mandanteId: partida.mandanteId,
        visitanteId: partida.visitanteId,
        status: partida.status,
        placar: partida.placar,
        // `partidasRelevantes` já descarta `rodada === null` (Brasileirão é
        // sempre pontos-corridos, sempre com rodada) — o `?? 0` é só guarda
        // de tipo, nunca alcançado (mesmo padrão de `motor.ts`).
        rodada: partida.rodada ?? 0,
      })),
    [partidasFiltradas],
  );

  // Recálculo (CA-11.2/CA-11.3/CA-11.10): `simular` é puro e síncrono — sem
  // rede, sem I/O — refletindo em bem menos que o orçamento de 100ms de
  // RNF-14/ADR-016 a cada mudança de `palpites` (dependência do `useMemo`).
  const saidaSimulacao = useMemo(
    () =>
      simular({
        clubes: clubesParaMotor,
        partidasRestantes: partidasParaMotor,
        palpites,
      }),
    [clubesParaMotor, partidasParaMotor, palpites],
  );

  const rankingProjecao = useMemo(
    () =>
      saidaSimulacao.ordenacao
        .map((clubeId) => ({ clubeId, stats: saidaSimulacao.porClube[clubeId] }))
        .filter(
          (linha): linha is { clubeId: string; stats: EstatisticasClube } =>
            linha.stats !== undefined,
        ),
    [saidaSimulacao],
  );

  const [confirmandoLimparCenario, setConfirmandoLimparCenario] = useState(false);

  function aoConfirmarLimparCenario(): void {
    limparCenario(armazenamento);
    setPalpites({});
    setPartidasTravadasVistas([]);
    setConfirmandoLimparCenario(false);
  }

  // CA-11.6 — partidas que acabaram de virar "disputada" (tinham palpite,
  // ainda não haviam sido marcadas como vistas): sinaliza e persiste
  // imediatamente em `partidasTravadasVistas`, para não reanunciar depois.
  const idsRecemTravados = useMemo(() => {
    const vistasSet = new Set(partidasTravadasVistas);
    return linhas
      .filter(
        ({ partida }) =>
          estaTravada(partida) &&
          palpites[partida.id] !== undefined &&
          !vistasSet.has(partida.id),
      )
      .map(({ partida }) => partida.id);
  }, [linhas, palpites, partidasTravadasVistas]);
  const chaveRecemTravados = idsRecemTravados.join(',');

  useEffect(() => {
    if (idsRecemTravados.length === 0 || escopoAtual === null) return;
    setPartidasTravadasVistas((atual) => {
      const mesclado = Array.from(new Set([...atual, ...idsRecemTravados]));
      const novoCenario: Cenario = {
        versaoEsquema: 1,
        escopo: escopoAtual,
        palpites,
        partidasTravadasVistas: mesclado,
      };
      salvarCenario(novoCenario, armazenamento);
      return mesclado;
    });
    setAvisoTravamento(idsRecemTravados.length);
    // Dependências intencionalmente restritas à chave estável dos ids (não ao
    // array em si, recriado a cada render) — mesmo padrão de `useSnapshot.ts`.
  }, [chaveRecemTravados, escopoAtual]);

  const salvarComDebounce = useMemo(
    () => criarSalvadorDeCenarioComDebounce(armazenamento),
    [armazenamento],
  );

  function aoMudarPalpite(
    idPartida: string,
    ehMandante: boolean,
    novoValor: Palpite | null,
  ): void {
    if (escopoAtual === null) return;
    const novoValorMandante = converterParaMandante(novoValor, ehMandante);
    setPalpites((atual) => {
      const novo = { ...atual };
      if (novoValorMandante === null) {
        delete novo[idPartida];
      } else {
        novo[idPartida] = novoValorMandante;
      }
      salvarComDebounce({
        versaoEsquema: 1,
        escopo: escopoAtual,
        palpites: novo,
        partidasTravadasVistas: [...partidasTravadasVistas],
      });
      return novo;
    });
  }

  function reexecutarBusca(): void {
    void (clienteSnapshot ?? clienteSnapshotPadrao).garantir(
      URL_FUTEBOL_BRASILEIRAO,
      'futebol',
      brasileiraoPublicoSchema,
    );
  }

  if (timeId === null) {
    return (
      <article className={estilos['pagina']}>
        <EstadoVazio
          titulo="Simulação"
          texto="Escolha seu time para simular a disputa com seus rivais."
        />
      </article>
    );
  }

  const carregandoInicial = brasileirao.carregando && dados === null;
  const emErro = brasileirao.erro !== null && dados === null;

  if (carregandoInicial) {
    return (
      <article className={estilos['pagina']}>
        <p className={estilos['voltar']}>
          <Link to="/comparativo">← Voltar</Link>
        </p>
        <Esqueleto variante="bloco" />
        <Esqueleto variante="cartao" quantidade={5} />
      </article>
    );
  }

  if (emErro) {
    return (
      <article className={estilos['pagina']}>
        <p className={estilos['voltar']}>
          <Link to="/comparativo">← Voltar</Link>
        </p>
        <EstadoVazio
          titulo="Simulação"
          texto="Não conseguimos carregar o calendário restante."
          acao={{ rotulo: 'TENTAR DE NOVO', aoClicar: reexecutarBusca }}
        />
      </article>
    );
  }

  const rodadas = Array.from(new Set(linhas.map(({ partida }) => partida.rodada))).sort(
    (a, b) => (a ?? 0) - (b ?? 0),
  );

  const temPalpite = Object.keys(palpites).length > 0;
  const nomeTime = nomeClube(clubes, timeId);
  const statsTime = saidaSimulacao.porClube[timeId];

  // REFAT-11-01 — escala comum das barras "ACUMULADO POR RODADA" da matriz de
  // desktop (UI-DS-06/BarraPontuacao: "máximo ancorado no maior valor da
  // tela", nunca um teto teórico por clube); `|| 1` só evita divisão por
  // zero quando `rankingProjecao` está vazio (nunca renderizado nesse caso,
  // ver `rodadas.length > 0` abaixo).
  const valorMaximoAcumulado =
    rankingProjecao.reduce((maximo, { stats }) => Math.max(maximo, stats.projetado), 0) ||
    1;

  return (
    <article className={estilos['pagina']} aria-label="Simulação">
      <div className={estilos['cabecalho']}>
        <p className={estilos['voltar']}>
          <Link to="/comparativo">← Voltar</Link>
        </p>
        <Botao variante="destrutivo" onClick={() => setConfirmandoLimparCenario(true)}>
          LIMPAR CENÁRIO
        </Botao>
      </div>
      <h1 className={estilos['titulo']}>SIMULAÇÃO · BRASILEIRÃO {temporada ?? ''}</h1>

      {rodadas.length > 0 ? (
        <BlocoPreto variante="projecao" rotulo="PROJEÇÃO">
          {temPalpite ? (
            <>
              <ol className={estilos['rankingProjecao']}>
                {rankingProjecao.map(({ clubeId, stats }, indice) => (
                  <li key={clubeId} className={estilos['linhaRankingProjecao']}>
                    <span aria-hidden="true">{indice + 1}º</span>
                    <AvatarClube
                      sigla={
                        clubes?.find((clube) => clube.id === clubeId)?.sigla ??
                        clubeId.slice(0, 3).toUpperCase()
                      }
                      tamanho={28}
                      nomeClube={nomeClube(clubes, clubeId)}
                    />
                    <span className={estilos['nomeRankingProjecao']}>
                      {nomeClube(clubes, clubeId).toUpperCase()}
                    </span>
                    <span>{stats.projetado} PTS</span>
                    <span>MÁX {stats.maximoPossivel}</span>
                  </li>
                ))}
              </ol>
              <p className={estilos['disclaimerProjecao']}>
                {textoDisclaimerProjecao(ordemComparados.length)}
              </p>
            </>
          ) : (
            <p className={estilos['disclaimerProjecao']}>
              {textoProjecaoSemPalpite(nomeTime, statsTime)}
            </p>
          )}
        </BlocoPreto>
      ) : null}

      {modoMemoria ? (
        <BannerAlerta
          variante="alerta"
          texto="Seu navegador não está guardando dados. Você pode simular normalmente, mas o cenário não será lembrado."
        />
      ) : null}

      {avisoTravamento > 0 ? (
        <div aria-live="polite">
          <BannerAlerta
            variante="informacao"
            texto={
              avisoTravamento === 1
                ? '1 palpite virou resultado real e foi travado.'
                : `${String(avisoTravamento)} palpites viraram resultado real e foram travados.`
            }
            acao={{ rotulo: 'OK', aoClicar: () => setAvisoTravamento(0) }}
          />
        </div>
      ) : null}

      {rodadas.length === 0 ? (
        <EstadoVazio
          titulo="Simulação"
          texto={textoCampeonatoEncerrado(rankingProjecao, clubes)}
        />
      ) : (
        <>
          <div className={estilos['grade']} data-testid="grade-lista">
            {rodadas.map((rodada) => {
              if (rodada === null) return null;
              const linhasDaRodada = linhas.filter(
                ({ partida }) => partida.rodada === rodada,
              );
              return (
                <section key={rodada} className={estilos['blocoRodada']}>
                  <h2 className={estilos['cabecalhoRodada']}>
                    {textoCabecalhoRodada(
                      rodada,
                      linhasDaRodada.map(({ partida }) => partida),
                    )}
                  </h2>
                  <ul className={estilos['listaPartidas']}>
                    {linhasDaRodada.map(
                      ({ partida, confrontoDireto, clubeReferencia, ehMandante }) => {
                        const adversarioId = ehMandante
                          ? partida.visitanteId
                          : partida.mandanteId;
                        const nomeReferencia = nomeClube(clubes, clubeReferencia);
                        const nomeAdversario = nomeClube(clubes, adversarioId);
                        const legenda = confrontoDireto
                          ? `⚔ ${nomeReferencia} × ${nomeAdversario}`
                          : `${nomeReferencia} × ${nomeAdversario} · ${
                              ehMandante ? 'casa' : 'fora'
                            }`;

                        if (estaTravada(partida) && partida.placar !== null) {
                          return (
                            <li key={partida.id} className={estilos['itemPartida']}>
                              <SeletorPalpite
                                idPartida={partida.id}
                                legenda={legenda}
                                valor={null}
                                aoMudar={() => undefined}
                                variante="travado"
                                resultadoReal={resultadoRealDoClube(
                                  partida.placar,
                                  ehMandante,
                                )}
                              />
                            </li>
                          );
                        }

                        const valorMandante = palpites[partida.id];
                        const valorPerspectiva = converterParaPerspectiva(
                          valorMandante,
                          ehMandante,
                        );

                        return (
                          <li key={partida.id} className={estilos['itemPartida']}>
                            {confrontoDireto ? (
                              <p className={estilos['confrontoDiretoRotulo']}>
                                CONFRONTO DIRETO —{' '}
                                {textoConfrontoDireto(
                                  valorMandante ?? null,
                                  nomeClube(clubes, partida.mandanteId),
                                  nomeClube(clubes, partida.visitanteId),
                                )}
                              </p>
                            ) : null}
                            <SeletorPalpite
                              idPartida={partida.id}
                              legenda={legenda}
                              valor={valorPerspectiva}
                              aoMudar={(novoValor) =>
                                aoMudarPalpite(partida.id, ehMandante, novoValor)
                              }
                            />
                          </li>
                        );
                      },
                    )}
                  </ul>
                </section>
              );
            })}
          </div>

          {/* REFAT-11-01 — matriz rodada×clube de desktop (UX-SPEC §6, ≥900px).
            `hidden` incondicional: só a regra `@media (min-width: 900px)` de
            `Simulacao.module.css` a mostra (`display: grid !important`),
            mesma técnica sem `matchMedia` já usada em `DetalheCampeonato.tsx`
            — ver nota no topo deste arquivo. */}
          <div
            className={estilos['matriz']}
            data-testid="matriz-desktop"
            hidden
            aria-label="Simulação — matriz por rodada e clube"
            style={{ '--matriz-colunas': ordemComparados.length } as CSSProperties}
          >
            <div className={estilos['matrizCabecalhoRotulo']} aria-hidden="true">
              RODADA
            </div>
            {ordemComparados.map((clubeId) => {
              const clube = clubes?.find((candidato) => candidato.id === clubeId);
              return (
                <div key={clubeId} className={estilos['matrizCabecalhoClube']}>
                  <AvatarClube
                    sigla={clube?.sigla ?? clubeId.slice(0, 3).toUpperCase()}
                    tamanho={28}
                    nomeClube={nomeClube(clubes, clubeId)}
                    {...(clube
                      ? {
                          corIdentidade: clube.paleta.identidade,
                          corIdentidadeTexto: clube.paleta.identidadeTexto,
                        }
                      : {})}
                  />
                  <span>{nomeClube(clubes, clubeId).toUpperCase()}</span>
                </div>
              );
            })}

            {rodadas.map((rodada) => {
              if (rodada === null) return null;
              const linhasDaRodada = linhas.filter(
                ({ partida }) => partida.rodada === rodada,
              );
              const temConfrontoDireto = linhasDaRodada.some(
                (linha) => linha.confrontoDireto,
              );
              const dataRodada = dataCurtaDaRodada(
                linhasDaRodada.map(({ partida }) => partida),
              );

              return (
                <Fragment key={rodada}>
                  <div className={estilos['matrizRotuloRodada']}>
                    {temConfrontoDireto ? <span aria-hidden="true">⚔ </span> : null}
                    <span>{rodada}ª</span>
                    {dataRodada ? (
                      <span className={estilos['matrizRotuloData']}>{dataRodada}</span>
                    ) : null}
                  </div>
                  {ordemComparados.map((clubeId) => {
                    const linhaDoClube = linhaDoClubeNaRodada(linhasDaRodada, clubeId);
                    if (!linhaDoClube) {
                      return (
                        <div
                          key={clubeId}
                          className={estilos['matrizCelulaVazia']}
                          aria-hidden="true"
                        >
                          —
                        </div>
                      );
                    }

                    const celula = montarCelulaMatriz(
                      linhaDoClube,
                      clubeId,
                      clubes,
                      palpites,
                    );
                    const variante: 'editavel' | 'travado' | 'espelhado' =
                      celula.resultadoReal !== undefined
                        ? 'travado'
                        : celula.ehEditavel
                          ? 'editavel'
                          : 'espelhado';

                    return (
                      <div key={clubeId} className={estilos['matrizCelula']}>
                        <SeletorPalpite
                          idPartida={celula.idPartida}
                          legenda={celula.legenda}
                          valor={celula.valorPerspectiva}
                          aoMudar={(novoValor) => {
                            if (!celula.ehEditavel) return;
                            aoMudarPalpite(
                              linhaDoClube.partida.id,
                              celula.ehMandanteDoClube,
                              novoValor,
                            );
                          }}
                          variante={variante}
                          {...(celula.resultadoReal !== undefined
                            ? { resultadoReal: celula.resultadoReal }
                            : {})}
                          {...(celula.textoConfronto !== undefined
                            ? { textoConfrontoDireto: celula.textoConfronto }
                            : {})}
                        />
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}

            <div className={estilos['matrizAcumulado']}>
              <h3 className={estilos['matrizAcumuladoTitulo']}>ACUMULADO POR RODADA</h3>
              <ul className={estilos['matrizAcumuladoLista']}>
                {rankingProjecao.map(({ clubeId, stats }) => {
                  const clube = clubes?.find((candidato) => candidato.id === clubeId);
                  return (
                    <li
                      key={clubeId}
                      className={estilos['matrizAcumuladoLinha']}
                      style={estiloAcumuladoClube(clube?.paleta)}
                    >
                      <BarraPontuacao
                        nomeClube={nomeClube(clubes, clubeId)}
                        {...(clube ? { rotuloVisivel: clube.sigla } : {})}
                        valor={stats.projetado}
                        valorMaximo={valorMaximoAcumulado}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}

      <Sobreposicao
        titulo="Limpar cenário"
        aberta={confirmandoLimparCenario}
        aoFechar={() => setConfirmandoLimparCenario(false)}
        barraDeAcao={
          <>
            <Botao variante="destrutivo" onClick={aoConfirmarLimparCenario}>
              APAGAR
            </Botao>
            <Botao
              variante="terciario"
              onClick={() => setConfirmandoLimparCenario(false)}
            >
              Cancelar
            </Botao>
          </>
        }
      >
        <p>Apagar todos os palpites deste cenário? Isso não pode ser desfeito.</p>
      </Sobreposicao>
    </article>
  );
}
