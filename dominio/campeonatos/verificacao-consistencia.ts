// dominio/campeonatos/verificacao-consistencia.ts — ING-F-04 (TASK.md Lote 5)
//
// Verificações mínimas de consistência de um lote coletado de uma competição
// (CA-16.6, SDD §2.4): classificação + partidas trazidas por
// `coletarFutebol`/`adaptador-football-data` (ING-F-01/02) antes de o lote
// substituir o snapshot anterior. Módulo puro, sem I/O (GUARDRAILS.md §5) —
// nenhum `Date.now()`; nada aqui decide o que fazer com o lote inconsistente
// (isso é ING-F-05, "descarta e mantém o anterior" é responsabilidade de quem
// persiste — este módulo só diz `consistente: false` e por quê).
//
// Decisão de detalhe registrada (TASK.md §6, desvio pequeno de contagem, não
// de escopo): o SDD §2.4 lista, em prosa, 6 cláusulas separadas por `;`
// ("pontos = 3V+E", "jogos = V+E+D", "saldo = GP−GC", "número de clubes",
// "sem data anterior ao início", "sem `finalizada` sem placar"), mas o
// TASK.md/CA-16.6 pede exatamente **5** verificações com testes por tabela.
// As duas primeiras cláusulas ("pontos = 3V+E" e "jogos = V+E+D") derivam do
// mesmo tripé V/E/D de uma linha de classificação e falham juntas sempre que
// o provedor manda uma linha aritmeticamente incoerente — tratamos as duas
// como uma única verificação ("consistência aritmética da linha": pontos E
// jogos batem com V/E/D), o que fecha a conta em 5 grupos de verificação
// distintos, cobrindo literalmente as mesmas 6 cláusulas do SDD, sem inventar
// nem omitir regra. Se o Coordenador quiser as duas separadas, é ajuste
// mecânico deste único arquivo (duas constantes de motivo em vez de uma).

import type { LinhaClassificacao, Partida } from '../tipos/futebol';

/** Motivo de inconsistência — um por verificação (exatamente 5, ver nota
 * acima), na ordem em que o SDD §2.4 as enuncia. */
export type MotivoInconsistencia =
  | 'linha-aritmetica-invalida' // pontos = 3V+E e jogos = V+E+D (verificações 1+2 do SDD)
  | 'saldo-invalido' // saldo = GP − GC (verificação 3 do SDD)
  | 'numero-de-clubes-incorreto' // nº de linhas == nº de clubes configurado (verificação 4 do SDD)
  | 'partida-anterior-ao-inicio' // nenhuma partida com data < início da competição (verificação 5 do SDD)
  | 'partida-finalizada-sem-placar'; // nenhuma partida `finalizada` sem placar (verificação 6 do SDD)

export interface EntradaVerificacaoConsistencia {
  /** Classificação coletada nesta execução (pode ser de mais de um grupo —
   * `LinhaClassificacao.grupo`, SDD §5.2). */
  readonly linhas: readonly LinhaClassificacao[];
  /** Partidas coletadas nesta execução para a competição. */
  readonly partidas: readonly Partida[];
  /** Número de clubes configurado para a competição (CFG-03) — total de
   * participantes, somando todos os grupos quando houver mais de um. */
  readonly numeroClubesEsperado: number;
  /** Início da janela da competição (`Competicao.janela.inicio`, SDD §5.2),
   * ISO 8601. */
  readonly inicioCompeticao: string;
}

export interface ResultadoVerificacaoConsistencia {
  readonly consistente: boolean;
  /** Vazio quando `consistente`; caso contrário, todos os motivos que
   * falharam (não só o primeiro) — útil para registro (CA-16.6, "registrar"). */
  readonly motivos: readonly MotivoInconsistencia[];
}

function linhaAritmeticaValida(linha: LinhaClassificacao): boolean {
  return (
    linha.pontos === 3 * linha.v + linha.e && linha.jogos === linha.v + linha.e + linha.d
  );
}

function saldoValido(linha: LinhaClassificacao): boolean {
  return linha.sg === linha.gp - linha.gc;
}

function paraTimestamp(dataHora: string | null): number | null {
  if (dataHora === null) return null;
  const timestamp = Date.parse(dataHora);
  return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * Verifica as 5 regras mínimas de consistência de CA-16.6 sobre um lote
 * coletado (classificação + partidas) de uma competição. Função pura, nunca
 * lança; reporta todos os motivos que falharam. Data de partida ausente
 * (`dataHora: null`, "a definir" — CA-10.4) nunca é tratada como anterior ao
 * início; só data conhecida e efetivamente anterior conta.
 */
export function verificarConsistenciaCompeticao(
  entrada: EntradaVerificacaoConsistencia,
): ResultadoVerificacaoConsistencia {
  const motivos: MotivoInconsistencia[] = [];

  if (entrada.linhas.some((linha) => !linhaAritmeticaValida(linha))) {
    motivos.push('linha-aritmetica-invalida');
  }

  if (entrada.linhas.some((linha) => !saldoValido(linha))) {
    motivos.push('saldo-invalido');
  }

  if (entrada.linhas.length !== entrada.numeroClubesEsperado) {
    motivos.push('numero-de-clubes-incorreto');
  }

  const inicioMs = paraTimestamp(entrada.inicioCompeticao);
  if (inicioMs !== null) {
    const temPartidaAnterior = entrada.partidas.some((partida) => {
      const dataMs = paraTimestamp(partida.dataHora);
      return dataMs !== null && dataMs < inicioMs;
    });
    if (temPartidaAnterior) motivos.push('partida-anterior-ao-inicio');
  }

  if (
    entrada.partidas.some(
      (partida) => partida.status === 'finalizada' && partida.placar === null,
    )
  ) {
    motivos.push('partida-finalizada-sem-placar');
  }

  return { consistente: motivos.length === 0, motivos };
}
