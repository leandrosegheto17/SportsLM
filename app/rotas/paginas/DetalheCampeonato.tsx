// app/rotas/paginas/DetalheCampeonato.tsx — UI-T06-01 + UI-T06-02 (TASK.md Lote 10)
//
// T-06 · Detalhe do campeonato (UX-SPEC §2/T-06): resumo (J/V/E/D/GP/GC/SG/%,
// posição quando há tabela — CA-08.1), tabela completa/de grupo com zonas e a
// linha do time destacada (CA-08.2/CA-08.3, CA-18.1/CA-18.2). Rota:
// `/time/:campeonatoId` (parâmetro dinâmico já provado por FUND-04).
//
// UI-T06-01: resumo + tabela (ver histórico de decisões abaixo, ainda válido).
//
// UI-T06-02 (esta extensão, mesmo arquivo/mesma tela — Diretriz de
// não-mistura não se aplica entre tarefas sequenciais do mesmo componente):
// abas DISPUTADAS/PRÓXIMAS com `LinhaPartida` (UI-DS-07B) cobrindo os 7
// estados (disputada · próxima · sem-horario · sem-data · adiada · cancelada ·
// aguardando, CA-08.6 a CA-08.10) e o bloco de confronto de mata-mata
// (fase/adversário/agregado/próximo jogo, CA-08.4, complementando o texto
// "sem tabela" que UI-T06-01 já mostra). Decisões de detalhe registradas
// (TASK.md §6, não são lacuna do UX-SPEC):
// - As abas Disputadas/Próximas existem para QUALQUER formato de competição
//   (inclusive mata-mata — o próprio wireframe da Seção 2 mostra `[
//   DISPUTADAS ][ PRÓXIMAS ]` também na tela de mata-mata), não só
//   pontos-corridos/grupos.
// - "Confronto atual" de mata-mata é derivado das partidas cujo campo `fase`
//   bate com `participacao.faseAtual` e que envolvem o time do torcedor —
//   isso é aritmética sobre dado já conhecido (soma de gols de partidas já
//   identificadas do mesmo confronto), não um palpite sobre o que ainda não
//   aconteceu (ADR-006 ponto 6 proíbe palpite de RESULTADO/fase, não soma de
//   placares já ingeridos). Sem nenhuma partida encontrada nessa fase, o
//   bloco de confronto simplesmente não aparece — a fase em si já aparece no
//   resumo (UI-T06-01, `participacao.faseAtual`), sem erro.
// - Responsividade "sem abas" ≥900px (UX-SPEC §6): implementada só em CSS
//   (nenhuma lógica de `matchMedia` em JS) — os dois painéis de partidas
//   ficam sempre no DOM; abaixo de 900px, o painel inativo é ocultado pelo
//   atributo HTML `hidden` (controlado pelo estado de aba ativa); a partir de
//   900px, uma regra de `!important` força os dois painéis visíveis lado a
//   lado e esconde a lista de abas (que deixa de existir na tela nesse
//   breakpoint, UX-SPEC "sem abas") — mesma técnica de sobrepor o `hidden` já
//   usada em outras partes do projeto sem introduzir dependência nova.
//
// Fontes de dado (Diretriz de Implementação #10, caminhos do SDD §2.2):
// - `timeId`: lido direto de `localStorage`, síncrono (mesmo padrão de
//   `SecaoIdentidade`/UI-T02-01) — decide entre "sem time" e o conteúdo real.
// - `/dados/futebol/clube/<slug>.json` (via `useSnapshot`/UI-DS-08): dá a
//   `Competicao` + `ParticipacaoClube` (resumo, CA-08.1) da entrada cujo
//   `competicao.id` combina com `campeonatoId`.
// - `/dados/futebol/brasileirao.json`: única fonte hoje publicada com
//   `classificacao`/`zonas` (SDD §2.2 — `config/zonas.ts`/CFG-04 documenta
//   que só o Brasileirão tem zonas e SPK-01 registra que só o Brasileirão tem
//   cobertura garantida de tabela). Decisão de detalhe registrada (TASK.md
//   §6, não é lacuna do UX-SPEC): a combinação só acontece quando
//   `brasileirao.dados.competicao.id === campeonatoId`; para qualquer outro
//   campeonato (estadual/Copa do Brasil/continental), a tabela simplesmente
//   não é renderizada — sem mensagem de erro, mesmo espírito de "zonas
//   ausentes, sem erro" (CA-18.2) aplicado à ausência de classificação
//   inteira, já que a plataforma não publica esse dado para essas competições
//   neste momento. O mecanismo de filtro por `grupo`/faixa de zona é genérico
//   (usa os mesmos campos de `LinhaClassificacao`/`Zona`, DOM-01) — funciona
//   também para CA-08.3 (tabela do grupo) no dia em que uma fonte de grupo
//   for publicada, sem mudança de código.
//
// CA-08.5 (resolução do Bloqueio 001 de `.md/BLOCKERS.md`): quando o
// campeonato muda de formato — grupos → mata-mata — a tela passa a mostrar
// CA-08.4 (bloco de confronto) no lugar da tabela, mas a tabela final do
// grupo continua acessível, não como visão padrão. A fonte desse dado é
// `entradaCampeonato.classificacaoFinalDoGrupo` (extensão aditiva do
// contrato de `/dados/futebol/clube/<slug>.json`, documentada em
// `app/dados/futebol.ts`) — diferente de `dadosClassificacao` acima, que é a
// classificação CORRENTE (só do Brasileirão, pontos-corridos); aqui é a
// classificação FINAL do grupo, "congelada" no momento da transição, e pode
// vir de qualquer campeonato. Hoje nenhuma fonte real publica esse campo (só
// o Brasileirão é publicado, e nunca muda de formato) — o mecanismo abaixo é
// genérico e correto, coberto por teste com fixture (não dado real), mesmo
// espírito do restante deste arquivo.
//
// Carimbo de frescor (CA-08.11/RN-09, SDD §2.5): o intervalo de futebol é
// ~1h em dia de jogo do clube e ~6h fora dele — "dia de jogo" é derivado
// aqui (`temPartidaHoje`) a partir das partidas de TODOS os campeonatos do
// clube (mesmo arquivo já buscado), verificando se alguma cai no dia
// corrente em `America/Sao_Paulo`. Nenhuma outra tarefa concluída até aqui
// precisou desse cálculo — é novo nesta tarefa.

import { useMemo, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTituloDocumento } from '../useTituloDocumento';
import { useSobreposicoes } from '../SobreposicoesContext';
import { useSnapshot } from '../../dados/useSnapshot';
import { clienteSnapshotPadrao, type ClienteSnapshot } from '../../dados/clienteSnapshot';
import {
  useClubesPublicos,
  type OpcoesUseClubesPublicos,
} from '../../dados/useClubesPublicos';
import type { ClubePublico } from '../../dados/configPublico';
import {
  brasileiraoPublicoSchema,
  clubeFutebolPublicoSchema,
  urlFutebolClube,
  URL_FUTEBOL_BRASILEIRAO,
} from '../../dados/futebol';
import { CHAVE_ARMAZENAMENTO_PREFERENCIAS } from '../../armazenamento/preferencias';
import { lerBrutoSemLancar } from '../../armazenamento/nucleo';
import { preferenciasSchema } from '../../../dominio/tipos';
import type { LinhaClassificacao, Partida, Zona } from '../../../dominio/tipos/futebol';
import { calcularFrescor } from '../../../dominio/frescor';
import { BlocoPreto } from '../../design-system/BlocoPreto';
import { Botao } from '../../design-system/componentes/Botao';
import {
  CarimboFrescor,
  Esqueleto,
  EstadoVazio,
  TabelaClassificacao,
  type LinhaTabelaClassificacao,
  type ZonaDaLinha,
} from '../../design-system/componentes';
import { Abas, type DefinicaoAba } from '../../design-system/componentes/Abas';
import {
  LinhaPartida,
  type MandoPartida,
  type PropriedadesLinhaPartida,
  type ResultadoPartida,
} from '../../design-system/componentes/LinhaPartida/LinhaPartida';
import estilos from './DetalheCampeonato.module.css';

/** Igual a `SecaoIdentidade`/UI-T02-01: lê só o `timeId` salvo, de forma
 * síncrona, sem cruzar contra o catálogo (essa validação cruzada é de
 * `lerPreferencias`, que exige o catálogo carregado — aqui só precisamos
 * decidir entre "sem time" e o conteúdo real o quanto antes). JSON/esquema
 * inválido ⇒ `null` (mesmo comportamento de "sem time salvo"). */
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

const FORMATADOR_CHAVE_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "2026-09-05" — chave de dia estável em `America/Sao_Paulo` (RNF-02),
 * usada só para comparar "mesmo dia", nunca exibida. */
function chaveDoDia(data: Date): string {
  return FORMATADOR_CHAVE_DIA.format(data);
}

/** SDD §2.5: intervalo de futebol é ~1h em dia de jogo do clube, ~6h fora
 * dele — "dia de jogo" é ter ao menos uma partida (qualquer status, qualquer
 * campeonato do clube) com `dataHora` conhecida caindo no dia corrente. */
function temPartidaHoje(agora: Date, partidas: readonly Partida[]): boolean {
  const hoje = chaveDoDia(agora);
  return partidas.some(
    (partida) =>
      partida.dataHora !== null && chaveDoDia(new Date(partida.dataHora)) === hoje,
  );
}

// --- UI-T06-02: formatação de data/hora (mesmo padrão de `PainelTime.tsx`/
// UI-T05-01 — duplicação intencional, mesma convenção já usada em outras
// telas deste projeto, ex. `SecaoIdentidade`, para não criar acoplamento
// entre telas por causa de 3 formatadores). ---

const FORMATADOR_DIA_SEMANA_CURTO = new Intl.DateTimeFormat('pt-BR', {
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

/** "dom, 13/09" (RNF-02). */
function formatarDataCurta(dataHoraIso: string): string {
  const data = new Date(dataHoraIso);
  const diaSemana = FORMATADOR_DIA_SEMANA_CURTO.format(data).replace(/\.$/, '');
  return `${diaSemana}, ${FORMATADOR_DIA_MES.format(data)}`;
}

/** "21/10" — sem dia da semana, formato da "nova data" da variante `adiada`
 * de `LinhaPartida` (UX-SPEC §2/T-06, wireframe "ADIADA — NOVA DATA: 21/10"). */
function formatarDiaMes(dataHoraIso: string): string {
  return FORMATADOR_DIA_MES.format(new Date(dataHoraIso));
}

/** "16h00" (RNF-02). */
function formatarHorario(dataHoraIso: string): string {
  const partes = FORMATADOR_HORARIO.formatToParts(new Date(dataHoraIso));
  const hora = partes.find((parte) => parte.type === 'hour')?.value ?? '00';
  const minuto = partes.find((parte) => parte.type === 'minute')?.value ?? '00';
  return `${hora}h${minuto}`;
}

/** "23ª rodada" quando a rodada é conhecida; senão a fase (mata-mata/grupos),
 * ou string vazia quando nenhuma das duas está disponível. O texto sempre
 * minúsculo aqui porque `LinhaPartida.module.css` já uppercasa via CSS
 * quando o campo cai no cabeçalho (variantes disputada/próxima/sem-horario/
 * sem-data) — a variante `aguardando` usa o mesmo valor no corpo, SEM
 * transformação de CSS, e o wireframe da Seção 2 mostra minúsculo ali
 * ("sex, 04/09 · 23ª rodada"), então uma única string em minúsculo serve
 * corretamente as duas situações. */
function rodadaOuFaseDeTexto(partida: Partida): string {
  if (partida.rodada !== null) {
    return `${partida.rodada}ª rodada`;
  }
  return partida.fase ?? '';
}

/** Nomes das duas equipes de uma `Partida`, já resolvidos pelo catálogo de
 * clubes públicos (mesmo helper `nomeCurtoOuSigla` usado pela tabela). */
function nomesDaPartida(
  partida: Partida,
  clubes: readonly ClubePublico[] | null,
): { readonly mandante: string; readonly visitante: string } {
  return {
    mandante: nomeCurtoOuSigla(clubes, partida.mandanteId).nomeCurto,
    visitante: nomeCurtoOuSigla(clubes, partida.visitanteId).nomeCurto,
  };
}

/** CA-08.6 — linha "disputada" (data, adversário, mando, placar, V/E/D), a
 * partir da perspectiva do torcedor (`timeId`). `null` quando o dado está
 * incoerente (finalizada sem `dataHora`/`placar` — nunca deveria acontecer,
 * ING-F-04 descarta na origem; aqui só nunca quebra a tela por causa disso,
 * mesmo espírito defensivo do restante do arquivo). */
function montarLinhaDisputada(
  partida: Partida,
  timeId: string,
  clubes: readonly ClubePublico[] | null,
): PropriedadesLinhaPartida | null {
  if (partida.dataHora === null || partida.placar === null) {
    return null;
  }
  const mando: MandoPartida = partida.mandanteId === timeId ? 'casa' : 'fora';
  const golsProprio =
    mando === 'casa' ? partida.placar.mandante : partida.placar.visitante;
  const golsAdversario =
    mando === 'casa' ? partida.placar.visitante : partida.placar.mandante;
  const resultado: ResultadoPartida =
    golsProprio > golsAdversario ? 'V' : golsProprio < golsAdversario ? 'D' : 'E';

  return {
    variante: 'disputada',
    data: formatarDataCurta(partida.dataHora),
    rodadaOuFase: rodadaOuFaseDeTexto(partida),
    resultado,
    ...nomesDaPartida(partida, clubes),
    placarMandante: partida.placar.mandante,
    placarVisitante: partida.placar.visitante,
    mando,
  };
}

/** CA-08.7 a CA-08.10 — linha de "próxima" partida, cobrindo as 4 variantes
 * não-disputadas de `LinhaPartida` (próxima · sem-horario · sem-data ·
 * adiada · cancelada · aguardando — 5, na verdade: junto com `disputada` são
 * os 7 estados do critério de aceite desta tarefa). */
function montarLinhaProxima(
  partida: Partida,
  timeId: string,
  clubes: readonly ClubePublico[] | null,
): PropriedadesLinhaPartida {
  const { mandante, visitante } = nomesDaPartida(partida, clubes);
  const mando: MandoPartida = partida.mandanteId === timeId ? 'casa' : 'fora';
  const rodadaOuFase = rodadaOuFaseDeTexto(partida);

  if (partida.status === 'cancelada') {
    return { variante: 'cancelada', mandante, visitante, mando };
  }

  if (partida.status === 'adiada') {
    return {
      variante: 'adiada',
      novaData:
        partida.dataHora !== null ? formatarDiaMes(partida.dataHora) : 'A DEFINIR',
      mandante,
      visitante,
      mando,
    };
  }

  if (partida.status === 'aguardando-resultado') {
    return {
      variante: 'aguardando',
      data:
        partida.dataHora !== null
          ? formatarDataCurta(partida.dataHora)
          : 'data a definir',
      rodadaOuFase,
      mandante,
      visitante,
    };
  }

  // status === 'agendada'.
  if (partida.dataHora === null) {
    return { variante: 'sem-data', rodadaOuFase, mandante, visitante, mando };
  }

  if (!partida.horarioDefinido) {
    return {
      variante: 'sem-horario',
      data: formatarDataCurta(partida.dataHora),
      rodadaOuFase,
      mandante,
      visitante,
      mando,
      ...(partida.estadio !== null ? { estadio: partida.estadio } : {}),
    };
  }

  return {
    variante: 'proxima',
    data: formatarDataCurta(partida.dataHora),
    horario: formatarHorario(partida.dataHora),
    rodadaOuFase,
    mandante,
    visitante,
    mando,
    ...(partida.estadio !== null ? { estadio: partida.estadio } : {}),
  };
}

interface LinhaPartidaPreparada {
  readonly id: string;
  readonly propriedades: PropriedadesLinhaPartida;
}

/** CA-08.6: todas as disputadas do clube nesta competição, mais recente
 * primeiro. */
function montarLinhasDisputadas(
  partidas: readonly Partida[],
  timeId: string,
  clubes: readonly ClubePublico[] | null,
): LinhaPartidaPreparada[] {
  return partidas
    .filter((partida) => partida.status === 'finalizada')
    .slice()
    .sort((a, b) => (b.dataHora ?? '').localeCompare(a.dataHora ?? ''))
    .map((partida) => {
      const propriedades = montarLinhaDisputada(partida, timeId, clubes);
      return propriedades ? { id: partida.id, propriedades } : null;
    })
    .filter((item): item is LinhaPartidaPreparada => item !== null);
}

/** CA-08.7 a CA-08.10: todas as não-disputadas (agendada, aguardando
 * resultado, adiada, cancelada) do clube nesta competição, mais próxima
 * primeiro — partidas sem `dataHora` conhecida vão ao final (não há como
 * ordená-las por proximidade). */
function montarLinhasProximas(
  partidas: readonly Partida[],
  timeId: string,
  clubes: readonly ClubePublico[] | null,
): LinhaPartidaPreparada[] {
  return partidas
    .filter((partida) => partida.status !== 'finalizada')
    .slice()
    .sort((a, b) =>
      (a.dataHora ?? '9999-99-99').localeCompare(b.dataHora ?? '9999-99-99'),
    )
    .map((partida) => ({
      id: partida.id,
      propriedades: montarLinhaProxima(partida, timeId, clubes),
    }));
}

interface AgregadoMataMata {
  readonly proprio: number;
  readonly adversario: number;
  readonly mandoIda: MandoPartida;
}

interface ProximoMataMata {
  readonly rotulo: 'Volta' | 'Próximo';
  readonly dataHora: string | null;
  readonly horarioDefinido: boolean;
  readonly estadio: string | null;
}

interface ConfrontoMataMata {
  readonly fase: string;
  readonly proprioNome: string;
  readonly adversarioNome: string;
  readonly agregado: AgregadoMataMata | null;
  readonly proximo: ProximoMataMata | null;
}

/** CA-08.4 (complemento ao texto "sem tabela" de UI-T06-01): fase, adversário,
 * agregado (quando há ida e volta) e data do próximo jogo do confronto atual
 * de mata-mata — ver nota de decisão no topo do arquivo sobre por que somar
 * placares já ingeridos não é o "palpite" que o ADR-006 (ponto 6) proíbe.
 * `null` quando não há `faseAtual` ou nenhuma partida dessa fase envolve o
 * torcedor (a fase em si já aparece no resumo, sem erro aqui). */
function montarConfrontoMataMata(
  partidas: readonly Partida[],
  timeId: string,
  faseAtual: string | null,
  clubes: readonly ClubePublico[] | null,
): ConfrontoMataMata | null {
  if (faseAtual === null) {
    return null;
  }

  const daFase = partidas.filter(
    (partida) =>
      partida.fase === faseAtual &&
      (partida.mandanteId === timeId || partida.visitanteId === timeId),
  );
  const primeira = daFase[0];
  if (primeira === undefined) {
    return null;
  }

  const adversarioId =
    primeira.mandanteId === timeId ? primeira.visitanteId : primeira.mandanteId;
  const ehJogoUnico = daFase.length === 1;

  const finalizada =
    daFase.find(
      (partida) => partida.status === 'finalizada' && partida.placar !== null,
    ) ?? null;

  const pendentes = daFase.filter(
    (partida) =>
      partida.status === 'agendada' ||
      partida.status === 'aguardando-resultado' ||
      partida.status === 'adiada',
  );
  const proximaPartida = pendentes.reduce<Partida | null>((atual, candidata) => {
    if (atual === null) {
      return candidata;
    }
    const chaveAtual = atual.dataHora ?? '9999-99-99';
    const chaveCandidata = candidata.dataHora ?? '9999-99-99';
    return chaveCandidata < chaveAtual ? candidata : atual;
  }, null);

  const agregado: AgregadoMataMata | null =
    finalizada && !ehJogoUnico && finalizada.placar
      ? {
          proprio:
            finalizada.mandanteId === timeId
              ? finalizada.placar.mandante
              : finalizada.placar.visitante,
          adversario:
            finalizada.mandanteId === timeId
              ? finalizada.placar.visitante
              : finalizada.placar.mandante,
          mandoIda: finalizada.mandanteId === timeId ? 'casa' : 'fora',
        }
      : null;

  const proximo: ProximoMataMata | null = proximaPartida
    ? {
        rotulo: finalizada ? 'Volta' : 'Próximo',
        dataHora: proximaPartida.dataHora,
        horarioDefinido: proximaPartida.horarioDefinido,
        estadio: proximaPartida.estadio,
      }
    : null;

  return {
    fase: faseAtual,
    proprioNome: nomeCurtoOuSigla(clubes, timeId).nomeCurto,
    adversarioNome: nomeCurtoOuSigla(clubes, adversarioId).nomeCurto,
    agregado,
    proximo,
  };
}

/** Texto da linha "Volta:"/"Próximo:" do bloco de confronto de mata-mata,
 * reaproveitando os mesmos textos canônicos de "data a definir"/"horário a
 * definir" de `LinhaPartida` (UX-SPEC §2/T-06, CA-08.8/CA-10.4). */
function textoProximoMataMata(proximo: ProximoMataMata): string {
  const dataTexto =
    proximo.dataHora !== null ? formatarDataCurta(proximo.dataHora) : 'DATA A DEFINIR';
  const horaTexto =
    proximo.dataHora === null
      ? null
      : proximo.horarioDefinido
        ? formatarHorario(proximo.dataHora)
        : 'HORÁRIO A DEFINIR';
  const partes = [dataTexto, ...(horaTexto !== null ? [horaTexto] : [])];
  if (proximo.estadio !== null) {
    partes.push(proximo.estadio);
  }
  return `${proximo.rotulo}: ${partes.join(' · ')}`;
}

const ABAS_PARTIDAS: readonly DefinicaoAba[] = [
  { id: 'disputadas', rotulo: 'DISPUTADAS' },
  { id: 'proximas', rotulo: 'PRÓXIMAS' },
];

/** Maior rodada entre as partidas já finalizadas — usada só para compor o
 * `<caption>` dinâmico da tabela ("Classificação — Brasileirão Série A, 24ª
 * rodada", UX-SPEC §5.1/critério de aceite de UI-DS-07B). Nenhuma partida
 * finalizada com rodada conhecida ⇒ `null` (caption sem sufixo de rodada) —
 * decisão de detalhe registrada (TASK.md §6): nem o SDD nem o UX-SPEC fixam o
 * algoritmo de "rodada atual" para fins de legenda; "maior rodada concluída"
 * é a leitura mais direta de um caption que descreve o estado JÁ refletido
 * pela tabela exibida. */
function obterRodadaAtual(partidas: readonly Partida[]): number | null {
  let maior: number | null = null;
  for (const partida of partidas) {
    if (partida.status === 'finalizada' && partida.rodada !== null) {
      maior = maior === null ? partida.rodada : Math.max(maior, partida.rodada);
    }
  }
  return maior;
}

/** Zona (CA-18.1) cuja faixa cobre `posicao`, ou `null` — mesmo contrato de
 * "ausente, sem erro" de `config/zonas.ts` (CFG-04): array vazio de zonas
 * (competição sem faixas configuradas) simplesmente nunca encontra nada. */
function zonaDaPosicao(posicao: number, zonas: readonly Zona[]): ZonaDaLinha | null {
  const zona = zonas.find(
    (candidata) => posicao >= candidata.de && posicao <= candidata.ate,
  );
  return zona ? { token: zona.token, rotulo: zona.rotulo } : null;
}

function nomeCurtoOuSigla(
  clubes: readonly ClubePublico[] | null,
  clubeId: string,
): Pick<ClubePublico, 'nomeCurto' | 'sigla'> & { readonly corIdentidade?: string } {
  const clube = clubes?.find((candidato) => candidato.id === clubeId);
  if (!clube) {
    return { nomeCurto: clubeId, sigla: clubeId.slice(0, 3).toUpperCase() };
  }
  return {
    nomeCurto: clube.nomeCurto,
    sigla: clube.sigla,
    corIdentidade: clube.paleta.identidade,
  };
}

/** Monta as linhas da `TabelaClassificacao` (CA-08.2/CA-08.3): filtra pelo
 * mesmo `grupo` do time do torcedor (para pontos corridos, `grupo` é sempre
 * `null` em todas as linhas — o filtro inclui todo mundo, efeito idêntico à
 * "tabela completa"; para uma competição de grupos, isola o grupo do
 * torcedor, CA-08.3), ordena por posição e aplica a zona de cada linha. */
function montarLinhasTabela(
  classificacao: readonly LinhaClassificacao[],
  zonas: readonly Zona[],
  clubes: readonly ClubePublico[] | null,
  timeId: string,
): LinhaTabelaClassificacao[] {
  const grupoDoTime =
    classificacao.find((linha) => linha.clubeId === timeId)?.grupo ?? null;

  return classificacao
    .filter((linha) => linha.grupo === grupoDoTime)
    .sort((a, b) => a.posicao - b.posicao)
    .map((linha) => {
      const { nomeCurto, sigla, corIdentidade } = nomeCurtoOuSigla(clubes, linha.clubeId);
      return {
        posicao: linha.posicao,
        clubeId: linha.clubeId,
        siglaClube: sigla,
        nomeClube: nomeCurto,
        pontos: linha.pontos,
        jogos: linha.jogos,
        v: linha.v,
        e: linha.e,
        d: linha.d,
        gp: linha.gp,
        gc: linha.gc,
        sg: linha.sg,
        aproveitamento: linha.aproveitamento,
        ...(corIdentidade !== undefined ? { corIdentidade } : {}),
        ehTimeDoUsuario: linha.clubeId === timeId,
        zona: zonaDaPosicao(linha.posicao, zonas),
      };
    });
}

/** Legenda de zonas (CA-18.1): união, na ordem em que aparecem, das zonas que
 * de fato tocam alguma linha visível — nunca lista uma zona sem linha
 * correspondente (ex.: grupo que não cobre a faixa de rebaixamento global).
 * Sem nenhuma zona nas linhas ⇒ array vazio ⇒ `TabelaClassificacao` não
 * desenha legenda nem faixa, sem mensagem de erro (CA-18.2). */
function construirLegendaZonas(
  linhas: readonly LinhaTabelaClassificacao[],
): ZonaDaLinha[] {
  const vistos = new Set<string>();
  const legenda: ZonaDaLinha[] = [];
  for (const linha of linhas) {
    if (linha.zona && !vistos.has(linha.zona.token)) {
      vistos.add(linha.zona.token);
      legenda.push(linha.zona);
    }
  }
  return legenda;
}

export interface PropriedadesDetalheCampeonato {
  /** Injeção de teste; padrão é `globalThis.localStorage`. */
  readonly armazenamento?: Pick<Storage, 'getItem'>;
  /** Injeção de teste para `useClubesPublicos`. */
  readonly opcoesClubesPublicos?: OpcoesUseClubesPublicos;
  /** Injeção de teste para `useSnapshot` (mesmo `ClienteSnapshot` para os
   * dois arquivos de futebol). */
  readonly clienteSnapshot?: ClienteSnapshot;
  /** Relógio injetado (Diretriz de Implementação #2/GUARDRAILS.md §5) —
   * nunca `Date.now()` direto neste componente. */
  readonly agora?: Date;
}

/** T-06 — Detalhe do campeonato: resumo, tabela (UI-T06-01) e abas
 * Disputadas/Próximas + bloco de mata-mata (UI-T06-02). Rota:
 * `/time/:campeonatoId`. */
export function DetalheCampeonato({
  armazenamento,
  opcoesClubesPublicos,
  clienteSnapshot,
  agora = new Date(),
}: PropriedadesDetalheCampeonato = {}): ReactElement {
  const { campeonatoId } = useParams<{ campeonatoId: string }>();
  const { abrirEscolherTime } = useSobreposicoes();
  const [abaAtiva, setAbaAtiva] = useState<string>('disputadas');
  // CA-08.5: tabela final do grupo, quando publicada, começa OCULTA — CA-08.4
  // (bloco de confronto) é a visão padrão em mata-mata; "acessível" não é
  // "visão principal" (ver nota de decisão no topo do arquivo).
  const [tabelaGrupoVisivel, setTabelaGrupoVisivel] = useState<boolean>(false);

  const timeId = useMemo(() => lerTimeIdSalvo(armazenamento), [armazenamento]);
  const { clubes } = useClubesPublicos(opcoesClubesPublicos);
  const opcoesSnapshot = clienteSnapshot ? { cliente: clienteSnapshot } : undefined;

  // Sem `timeId`, não há arquivo de clube para buscar — a mesma URL de
  // fallback inofensivo já usada por `SecaoIdentidade` (nunca lido, porque o
  // ramo "sem time" abaixo retorna antes de usar `clubeFutebol`).
  const clubeFutebol = useSnapshot(
    timeId !== null ? urlFutebolClube(timeId) : URL_FUTEBOL_BRASILEIRAO,
    'futebol',
    clubeFutebolPublicoSchema,
    opcoesSnapshot,
  );
  const brasileirao = useSnapshot(
    URL_FUTEBOL_BRASILEIRAO,
    'futebol',
    brasileiraoPublicoSchema,
    opcoesSnapshot,
  );

  const entradaCampeonato =
    timeId !== null
      ? (clubeFutebol.dados?.find((entrada) => entrada.competicao.id === campeonatoId) ??
        null)
      : null;

  useTituloDocumento(entradaCampeonato?.competicao.nome ?? 'Detalhe do campeonato');

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

  if (timeId === null) {
    return (
      <article className={estilos['pagina']}>
        <EstadoVazio
          titulo="Detalhe do campeonato"
          texto="Escolha seu time para ver o detalhe deste campeonato."
          acao={{ rotulo: 'ESCOLHER MEU TIME', aoClicar: abrirEscolherTime }}
        />
      </article>
    );
  }

  const carregandoInicial = clubeFutebol.carregando && clubeFutebol.dados === null;
  const naoEncontrado = clubeFutebol.dados !== null && entradaCampeonato === null;
  const emErro =
    (clubeFutebol.erro !== null && clubeFutebol.dados === null) || naoEncontrado;

  if (carregandoInicial) {
    return (
      <article className={estilos['pagina']}>
        <Esqueleto variante="bloco" />
        <Esqueleto variante="linha-tabela" quantidade={8} />
        {/* UI-T06-02: "+ 3 linhas de partida" da Seção 4 do UX-SPEC — a
         * variante `VarianteEsqueleto` (UI-DS-07B, Lote 7, já fechado) não
         * tem uma forma própria de "linha de partida"; `cartao` é a forma
         * existente mais próxima (bloco compacto), reaproveitada aqui em vez
         * de propor uma variante nova de design system nesta tarefa. */}
        <Esqueleto variante="cartao" quantidade={3} />
      </article>
    );
  }

  if (emErro) {
    return (
      <article className={estilos['pagina']}>
        <EstadoVazio
          titulo="Detalhe do campeonato"
          texto="Não conseguimos carregar este campeonato."
          acao={{ rotulo: 'TENTAR DE NOVO', aoClicar: reexecutarBusca }}
        />
      </article>
    );
  }

  // A partir daqui, `entradaCampeonato` nunca é `null` (garantido pelos
  // ramos "carregando"/"erro"/"não encontrado" acima).
  const { competicao, participacao } = entradaCampeonato!;
  const resumo = participacao.resumo;
  const ehMataMata = competicao.formato === 'mata-mata';

  const dadosClassificacao =
    !ehMataMata && brasileirao.dados && brasileirao.dados.competicao.id === competicao.id
      ? brasileirao.dados
      : null;

  const linhasTabela = dadosClassificacao
    ? montarLinhasTabela(
        dadosClassificacao.classificacao,
        dadosClassificacao.zonas,
        clubes,
        timeId,
      )
    : [];
  const legendaZonas = construirLegendaZonas(linhasTabela);
  const rodadaAtual = dadosClassificacao
    ? obterRodadaAtual(dadosClassificacao.partidas)
    : null;
  const legendaTabela = `Classificação — ${competicao.nome}${
    rodadaAtual !== null ? `, ${rodadaAtual}ª rodada` : ''
  }`;

  // CA-08.5: tabela final do grupo, preservada quando o campeonato já virou
  // mata-mata — ver nota de decisão no topo do arquivo. Sem zonas próprias
  // (o congelamento não carrega faixas — mesmo espírito de "ausente, sem
  // erro" de CA-18.2: a tabela some as zonas, não quebra).
  const classificacaoFinalDoGrupo = entradaCampeonato!.classificacaoFinalDoGrupo ?? null;
  const linhasTabelaGrupo =
    ehMataMata && classificacaoFinalDoGrupo && classificacaoFinalDoGrupo.length > 0
      ? montarLinhasTabela(classificacaoFinalDoGrupo, [], clubes, timeId)
      : [];
  const legendaTabelaGrupo = `Tabela final do grupo — ${competicao.nome}`;

  const partidasDoCampeonato = entradaCampeonato!.partidas;
  const confrontoMataMata = ehMataMata
    ? montarConfrontoMataMata(
        partidasDoCampeonato,
        timeId,
        participacao.faseAtual,
        clubes,
      )
    : null;
  const linhasDisputadas = montarLinhasDisputadas(partidasDoCampeonato, timeId, clubes);
  const linhasProximas = montarLinhasProximas(partidasDoCampeonato, timeId, clubes);
  const nomeTorcedor = nomeCurtoOuSigla(clubes, timeId).nomeCurto;

  const geradoEmIso = clubeFutebol.geradoEm;
  const frescor =
    geradoEmIso !== null
      ? calcularFrescor(
          agora,
          new Date(geradoEmIso),
          temPartidaHoje(
            agora,
            clubeFutebol.dados?.flatMap((entrada) => entrada.partidas) ?? [],
          )
            ? 60
            : 360,
        )
      : null;

  return (
    <article className={estilos['pagina']}>
      <p className={estilos['voltar']}>
        <Link to="/time">← Voltar</Link>
      </p>
      <h1 className={estilos['titulo']}>{competicao.nome}</h1>

      {frescor ? (
        <CarimboFrescor
          estado={frescor.emAlerta ? 'alerta' : 'normal'}
          texto={frescor.atualizadoHa}
          {...(geradoEmIso !== null ? { dataHoraIso: geradoEmIso } : {})}
        />
      ) : (
        <CarimboFrescor estado="sem-dados" texto="Sem dados disponíveis no momento" />
      )}

      <BlocoPreto variante="resumo" rotulo="Resumo">
        {resumo ? (
          <div className={estilos['resumo']}>
            <p className={estilos['resumoDestaque']}>
              {resumo.posicao !== null ? (
                <span>{resumo.posicao}º</span>
              ) : (
                <span>{participacao.faseAtual ?? '—'}</span>
              )}
              <span>{resumo.pontos} PTS</span>
              <span>{resumo.aproveitamento.toFixed(1).replace('.', ',')}%</span>
            </p>
            <p className={estilos['resumoLinha']}>
              {resumo.jogos} J · {resumo.v} V · {resumo.e} E · {resumo.d} D · {resumo.gp}{' '}
              GP · {resumo.gc} GC
            </p>
            <p className={estilos['resumoLinha']}>
              SALDO {resumo.sg >= 0 ? `+${resumo.sg}` : resumo.sg}
            </p>
          </div>
        ) : (
          <p className={estilos['resumoLinha']}>Sem dados disponíveis no momento.</p>
        )}
      </BlocoPreto>

      {ehMataMata ? (
        <>
          <p className={estilos['semTabela']}>
            Este campeonato é de mata-mata — não há tabela de classificação.
          </p>
          {linhasTabelaGrupo.length > 0 ? (
            <>
              <Botao
                variante="secundario"
                aria-expanded={tabelaGrupoVisivel}
                onClick={() => {
                  setTabelaGrupoVisivel((valor) => !valor);
                }}
              >
                {tabelaGrupoVisivel ? 'OCULTAR TABELA DO GRUPO' : 'VER TABELA DO GRUPO'}
              </Botao>
              {tabelaGrupoVisivel ? (
                <div
                  role="region"
                  tabIndex={0}
                  aria-label="Tabela final do grupo, role para ver mais colunas"
                  className={estilos['tabelaScroll']}
                >
                  <TabelaClassificacao
                    legenda={legendaTabelaGrupo}
                    linhas={linhasTabelaGrupo}
                    variante="completa"
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : dadosClassificacao ? (
        <div
          role="region"
          tabIndex={0}
          aria-label="Tabela de classificação, role para ver mais colunas"
          className={estilos['tabelaScroll']}
        >
          <TabelaClassificacao
            legenda={legendaTabela}
            linhas={linhasTabela}
            variante="completa"
            {...(legendaZonas.length > 0 ? { legendaZonas } : {})}
          />
        </div>
      ) : null}

      {confrontoMataMata ? (
        <BlocoPreto variante="resumo" rotulo={confrontoMataMata.fase.toUpperCase()}>
          <p className={estilos['confrontoLinha']}>
            {confrontoMataMata.proprioNome} × {confrontoMataMata.adversarioNome}
          </p>
          {confrontoMataMata.agregado ? (
            <p className={estilos['resumoLinha']}>
              AGREGADO {confrontoMataMata.agregado.proprio} ×{' '}
              {confrontoMataMata.agregado.adversario} (
              {confrontoMataMata.agregado.mandoIda === 'casa' ? 'IDA CASA' : 'IDA FORA'})
            </p>
          ) : null}
          {confrontoMataMata.proximo ? (
            <p className={estilos['resumoLinha']}>
              {textoProximoMataMata(confrontoMataMata.proximo)}
            </p>
          ) : null}
        </BlocoPreto>
      ) : null}

      <div className={estilos['abasContainer']}>
        <Abas
          abas={ABAS_PARTIDAS}
          abaAtivaId={abaAtiva}
          aoMudarAba={setAbaAtiva}
          rotuloGrupo="Partidas do campeonato"
        />

        <section
          id="painel-disputadas"
          role="tabpanel"
          aria-labelledby="aba-disputadas"
          hidden={abaAtiva !== 'disputadas'}
          className={estilos['painel']}
        >
          {linhasDisputadas.length > 0 ? (
            <ul className={estilos['listaPartidas']}>
              {linhasDisputadas.map(({ id, propriedades }) => (
                <LinhaPartida key={id} {...propriedades} />
              ))}
            </ul>
          ) : (
            <p className={estilos['semTabela']}>
              O {nomeTorcedor} ainda não jogou neste campeonato.
            </p>
          )}
        </section>

        <section
          id="painel-proximas"
          role="tabpanel"
          aria-labelledby="aba-proximas"
          hidden={abaAtiva !== 'proximas'}
          className={estilos['painel']}
        >
          {linhasProximas.length > 0 ? (
            <ul className={estilos['listaPartidas']}>
              {linhasProximas.map(({ id, propriedades }) => (
                <LinhaPartida key={id} {...propriedades} />
              ))}
            </ul>
          ) : (
            <p className={estilos['semTabela']}>Não há jogos marcados no momento.</p>
          )}
        </section>
      </div>
    </article>
  );
}
