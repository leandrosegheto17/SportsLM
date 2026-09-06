// dominio/campeonatos/aproveitamento.ts — DOM-04 (TASK.md Lote 3)
//
// Cálculo do aproveitamento do resumo de participação (CA-08.1, I-13):
// pontos ÷ (jogos × 3), em %. Módulo puro, sem I/O (GUARDRAILS.md §5).
//
// Decisão de detalhe registrada (TASK.md §6): nem o SDD §5.2 nem o UX-SPEC.md
// fixam casas decimais para o percentual exibido — `resumoParticipacaoSchema`/
// `linhaClassificacaoSchema` (DOM-01, `dominio/tipos/futebol.ts`) só exigem
// `z.number().min(0).max(100)`. Arredondo para 1 casa decimal (ex.: 66,7%)
// para evitar dízima de ponto flutuante (`100/3 = 33.333333...`) chegando à
// tela sem que nenhuma camada de exibição precise arredondar de novo; se o
// Coordenador/UX-SPEC.md vier a fixar outra precisão, é ajuste mecânico desta
// única função.

/**
 * Aproveitamento em percentual (I-13): `pontos ÷ (jogos × 3) × 100`,
 * arredondado a 1 casa decimal. `jogos <= 0` (time ainda não estreou) retorna
 * `0` em vez de dividir por zero — nunca `NaN`/`Infinity` chega ao domínio.
 */
export function calcularAproveitamento(pontos: number, jogos: number): number {
  if (jogos <= 0) return 0;
  const percentual = (pontos / (jogos * 3)) * 100;
  return Math.round(percentual * 10) / 10;
}
