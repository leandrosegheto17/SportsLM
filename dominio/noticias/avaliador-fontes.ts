// dominio/noticias/avaliador-fontes.ts — ING-N-05 (TASK.md Lote 4)
//
// Componente `avaliador-fontes` do SDD §2.1-A / Fluxo 1 (§2.3): avalia o
// histórico de tentativas de uma fonte (já produzido por `coletor-rss`,
// ING-N-01) e decide se ela está "instável" (RN-08), gerando um evento de
// severidade alta quando a fonte afetada é a fixa (GE, RN-03/CA-15.6).
//
// Módulo puro (SDD §2.1, GUARDRAILS.md §5): nenhum I/O, nenhuma chamada a
// `Date.now()` — o relógio sempre entra por parâmetro (`agora: Date`,
// Diretriz #2 do TASK.md). Por isso vive em `dominio/`, não em `pipeline/`,
// mesmo consumindo o formato de saída de um componente de `pipeline/`
// (ING-N-01): a direção de dependência de `dominio/` (SDD §2.1) proíbe
// importar de `pipeline/`, então o formato de registro é redeclarado aqui
// (`RegistroTentativaAvaliavel`), estruturalmente compatível com
// `RegistroTentativa` de `pipeline/noticias/coletor-rss.ts` (mesmo padrão já
// usado por `FonteParaColeta`/`FeedParaColeta` naquele módulo, na direção
// oposta).
//
// Texto de RN-08 (PRD-TECNICO.md §3): "Falhas consecutivas > 6h (a
// confirmar) ou sem item novo > 72h (a confirmar) → 'instável'; permanece no
// catálogo; sai ao entregar item; remoção manual." A tarefa (TASK.md,
// ING-N-05) confirma os limiares "a confirmar": 6h de falhas consecutivas
// equivalem a 12 tentativas a cada 30 min (RNF-06/CA-15.1); 72h sem item
// novo. CA-15.6: "GIVEN é o GE, registrar evento de severidade alta."; CA-01.2:
// "instável desde <data/hora>".

/** Formato mínimo de registro de tentativa que este módulo precisa para
 * avaliar uma fonte — compatível estruturalmente com `RegistroTentativa` de
 * `pipeline/noticias/coletor-rss.ts` (ING-N-01), sem importar de lá. */
export interface RegistroTentativaAvaliavel {
  fonteId: string;
  feedId: string;
  horario: string; // ISO 8601
  resultado: 'ok' | 'falha' | 'pulado';
  itensObtidos?: number;
  motivo?: string;
}

export type MotivoInstabilidade = 'falhas-consecutivas' | 'sem-item-novo';

export interface EventoSeveridadeAlta {
  fonteId: string;
  severidade: 'alta';
  motivo: MotivoInstabilidade;
  em: string; // ISO 8601 — instante da avaliação (`agora`)
}

export interface AvaliacaoFonte {
  fonteId: string;
  estado: 'estavel' | 'instavel';
  /** Presente somente quando `estado === 'instavel'`. */
  motivo?: MotivoInstabilidade;
  /** "instável desde <data/hora>" (CA-01.2) — ISO 8601. Presente somente
   * quando `estado === 'instavel'`. */
  desde?: string;
  /** Presente somente quando `estado === 'instavel'` **e** a fonte é a fixa
   * (RN-03/CA-15.6) — nenhuma outra fonte gera evento de severidade alta. */
  evento?: EventoSeveridadeAlta;
}

const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;
const SETENTA_E_DUAS_HORAS_MS = 72 * 60 * 60 * 1000;
const LIMIAR_FALHAS_CONSECUTIVAS = 12; // 12 tentativas a cada 30 min = 6h (RNF-06)

interface Ciclo {
  instante: number;
  horarioIso: string;
  /** Ao menos um registro do ciclo é uma tentativa real (`'ok'`/`'falha'`) —
   * ciclos só com `'pulado'` (CA-15.7) são transparentes: não contam como
   * falha nem quebram uma sequência de falhas, e são ignorados na busca da
   * última entrega. */
  teveTentativaReal: boolean;
  /** Todas as tentativas reais do ciclo falharam (nenhum `'ok'`). */
  falhaCompleta: boolean;
  /** Ao menos uma tentativa real do ciclo obteve item novo (`itensObtidos > 0`). */
  entregouItemNovo: boolean;
}

/** Agrupa os registros de uma fonte por `horario` (todos os feeds de uma
 * mesma chamada de `coletarFonte`/ING-N-01 compartilham o mesmo `horario`,
 * gerado a partir do mesmo `agora`) e ordena do mais antigo ao mais recente.
 * Registro com `horario` não parseável é descartado (na dúvida, não avalia —
 * mesma postura defensiva de `dominio/frescor.ts`/`dominio/retencao.ts`). */
function agruparEmCiclos(registros: RegistroTentativaAvaliavel[]): Ciclo[] {
  const porHorario = new Map<string, RegistroTentativaAvaliavel[]>();
  for (const registro of registros) {
    const instante = new Date(registro.horario).getTime();
    if (Number.isNaN(instante)) continue;
    const grupo = porHorario.get(registro.horario);
    if (grupo) grupo.push(registro);
    else porHorario.set(registro.horario, [registro]);
  }

  const ciclos: Ciclo[] = [];
  for (const [horarioIso, grupo] of porHorario) {
    const reais = grupo.filter((r) => r.resultado !== 'pulado');
    const teveTentativaReal = reais.length > 0;
    const falhaCompleta =
      teveTentativaReal && reais.every((r) => r.resultado === 'falha');
    const entregouItemNovo = reais.some(
      (r) => r.resultado === 'ok' && (r.itensObtidos ?? 0) > 0,
    );
    ciclos.push({
      instante: new Date(horarioIso).getTime(),
      horarioIso,
      teveTentativaReal,
      falhaCompleta,
      entregouItemNovo,
    });
  }

  ciclos.sort((a, b) => a.instante - b.instante);
  return ciclos;
}

/** Percorre os ciclos do mais recente ao mais antigo contando a sequência
 * ininterrupta de falha completa (ciclos `'pulado'`-only são transparentes:
 * não contam, não interrompem). Para na primeira entrega de item novo ou no
 * primeiro ciclo com alguma tentativa `'ok'` (mesmo sem item novo — fetch
 * bem-sucedido não é falha). Retorna a contagem e o instante do início da
 * sequência (ciclo de falha mais antigo dela). */
function calcularSequenciaDeFalhas(ciclos: Ciclo[]): {
  quantidade: number;
  inicioMs: number | null;
} {
  let quantidade = 0;
  let inicioMs: number | null = null;
  for (let i = ciclos.length - 1; i >= 0; i -= 1) {
    const ciclo = ciclos[i];
    if (ciclo === undefined) continue;
    if (!ciclo.teveTentativaReal) continue; // transparente
    if (!ciclo.falhaCompleta) break; // sucesso (com ou sem item novo) interrompe
    quantidade += 1;
    inicioMs = ciclo.instante;
  }
  return { quantidade, inicioMs };
}

/** Instante da última entrega de item novo; `null` se a fonte nunca entregou
 * nenhum item em todo o histórico avaliado. */
function ultimaEntregaMs(ciclos: Ciclo[]): number | null {
  for (let i = ciclos.length - 1; i >= 0; i -= 1) {
    const ciclo = ciclos[i];
    if (ciclo !== undefined && ciclo.entregouItemNovo) return ciclo.instante;
  }
  return null;
}

/**
 * Avalia uma única fonte contra RN-08 a partir do seu histórico de
 * tentativas. `fixa` identifica o GE (RN-03) — só ele gera
 * `EventoSeveridadeAlta` quando instável (CA-15.6).
 *
 * Decisões de interpretação registradas (TASK.md §6, não é mudança de
 * regra): (a) quando as duas condições de RN-08 se verificam ao mesmo tempo,
 * `motivo` prioriza `'falhas-consecutivas'` (é a condição mais imediatamente
 * acionável — a fonte está de fato fora do ar agora); (b) "instável desde
 * <data/hora>" (CA-01.2) é o instante em que a condição começou a valer: para
 * falhas consecutivas, o horário do primeiro registro da sequência de falha
 * ainda em curso; para "sem item novo", o horário da última entrega (ou da
 * tentativa mais antiga do histórico, se a fonte nunca entregou nada); (c)
 * ciclo `'pulado'` (CA-15.7, intervalo ainda não atingido) é transparente —
 * não conta como falha nem interrompe uma sequência de falha, e é ignorado
 * ao procurar a última entrega, porque não é uma tentativa real de buscar o
 * feed; (d) um ciclo com fetch bem-sucedido mas zero itens novos (`'ok'`,
 * `itensObtidos: 0`) não é falha — interrompe a sequência de falhas
 * consecutivas (a fonte respondeu), mas não conta como entrega para a
 * condição "sem item novo".
 */
export function avaliarFonte(
  fonteId: string,
  registros: RegistroTentativaAvaliavel[],
  fixa: boolean,
  agora: Date,
): AvaliacaoFonte {
  const ciclos = agruparEmCiclos(registros);
  const agoraMs = agora.getTime();

  const { quantidade: qtdFalhas, inicioMs: inicioFalhasMs } =
    calcularSequenciaDeFalhas(ciclos);
  const excedeuFalhasConsecutivas =
    qtdFalhas >= LIMIAR_FALHAS_CONSECUTIVAS &&
    inicioFalhasMs !== null &&
    agoraMs - inicioFalhasMs > SEIS_HORAS_MS;

  if (excedeuFalhasConsecutivas && inicioFalhasMs !== null) {
    return construirInstavel(
      fonteId,
      'falhas-consecutivas',
      new Date(inicioFalhasMs).toISOString(),
      fixa,
      agora,
    );
  }

  const ultimaEntrega = ultimaEntregaMs(ciclos);
  const primeiraTentativaMs = ciclos.length > 0 ? (ciclos[0]?.instante ?? null) : null;
  const referenciaSemItemMs = ultimaEntrega ?? primeiraTentativaMs;

  if (
    referenciaSemItemMs !== null &&
    agoraMs - referenciaSemItemMs > SETENTA_E_DUAS_HORAS_MS
  ) {
    return construirInstavel(
      fonteId,
      'sem-item-novo',
      new Date(referenciaSemItemMs).toISOString(),
      fixa,
      agora,
    );
  }

  return { fonteId, estado: 'estavel' };
}

function construirInstavel(
  fonteId: string,
  motivo: MotivoInstabilidade,
  desde: string,
  fixa: boolean,
  agora: Date,
): AvaliacaoFonte {
  const evento: EventoSeveridadeAlta | undefined = fixa
    ? { fonteId, severidade: 'alta', motivo, em: agora.toISOString() }
    : undefined;
  return {
    fonteId,
    estado: 'instavel',
    motivo,
    desde,
    ...(evento ? { evento } : {}),
  };
}

/** Entrada de conveniência para avaliar várias fontes de uma vez (uso
 * esperado por ING-N-07, a orquestração do Fluxo 1) — não agrega
 * comportamento novo além de chamar `avaliarFonte` por fonte. */
export interface FonteParaAvaliacao {
  fonteId: string;
  fixa: boolean;
  registros: RegistroTentativaAvaliavel[];
}

/**
 * Conta a sequência de falha completa em curso (mais recente primeiro),
 * exposta separadamente de `avaliarFonte` para diagnóstico (`status.json`,
 * SDD §5.4, campo `falhasConsecutivas`) — reaproveita exatamente a mesma
 * semântica de ciclo/transparência de `'pulado'` usada para decidir RN-08
 * (ING-N-07, orquestração do Fluxo 1), sem duplicar a lógica de agrupamento.
 */
export function contarFalhasConsecutivas(
  registros: RegistroTentativaAvaliavel[],
): number {
  const ciclos = agruparEmCiclos(registros);
  return calcularSequenciaDeFalhas(ciclos).quantidade;
}

export function avaliarCatalogo(
  fontes: FonteParaAvaliacao[],
  agora: Date,
): AvaliacaoFonte[] {
  return fontes.map((fonte) =>
    avaliarFonte(fonte.fonteId, fonte.registros, fonte.fixa, agora),
  );
}
