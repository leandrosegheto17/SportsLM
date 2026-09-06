// app/telemetria/nucleoTelemetria.ts — TEL-01 (TASK.md Lote 12)
//
// Monta cada um dos 5 eventos de RNF-07/ADR-012 e entrega ao coletor local.
// Módulo separado do interruptor de build (`index.ts`) de propósito: o
// interruptor só importa (e, portanto, só referencia em tempo de build) as
// funções deste arquivo dentro do `if` estático de `import.meta.env`, o que
// permite ao Vite eliminar este módulo inteiro do bundle quando
// `VITE_TELEMETRIA` não é `'on'` (ver comentário de `index.ts`).
//
// `Date.now()` é usado diretamente (não por parâmetro) porque este módulo
// vive em `app/`, não em `dominio/` — a proibição de `Date.now()` é só
// dentro de `dominio/` (SDD §2.1, Diretriz de Implementação #2).

import { registrarNoColetor } from './coletor';
import type { CargaEvento, EventoTelemetria, NomeEventoTelemetria } from './eventos';
import { obterOuCriarIdAnonimo } from './id';

function criarEvento<N extends NomeEventoTelemetria>(
  nome: N,
  carga: CargaEvento<N>,
): EventoTelemetria<N> {
  return {
    nome,
    timestampMs: Date.now(),
    idAnonimo: obterOuCriarIdAnonimo(),
    carga,
  };
}

/** `primeira_sessao` — ADR-012: primeira execução no dispositivo. */
export function registrarPrimeiraSessaoNoNucleo(): void {
  registrarNoColetor(criarEvento('primeira_sessao', undefined));
}

/** `retorno` — ADR-012: abertura com preferências já existentes; carga é só
 * a quantidade de dias desde a primeira sessão. */
export function registrarRetornoNoNucleo(diasDesdePrimeiraSessao: number): void {
  registrarNoColetor(criarEvento('retorno', { diasDesdePrimeiraSessao }));
}

/** `personalizacao_concluida` — ADR-012: ≥ 1 favorito e (se aplicável) time
 * definidos; carga é só a contagem de favoritos e se há time, nunca a lista
 * de favoritos nem o id do time (isso seria conteúdo/preferência). */
export function registrarPersonalizacaoConcluidaNoNucleo(
  quantidadeFavoritos: number,
  temTimeDefinido: boolean,
): void {
  registrarNoColetor(
    criarEvento('personalizacao_concluida', { quantidadeFavoritos, temTimeDefinido }),
  );
}

/** `primeira_interacao_util` — ADR-012: abrir uma notícia ou o painel do
 * time; carga é só o tempo decorrido, nunca qual notícia/painel. */
export function registrarPrimeiraInteracaoUtilNoNucleo(
  milissegundosAteInteracao: number,
): void {
  registrarNoColetor(
    criarEvento('primeira_interacao_util', { milissegundosAteInteracao }),
  );
}

/** `comparativo_aberto` — ADR-012: entrada em `/comparativo` ou
 * `/simulacao`; carga é só qual das duas, nunca o conteúdo do comparativo ou
 * da simulação (palpites). */
export function registrarComparativoAbertoNoNucleo(
  rota: 'comparativo' | 'simulacao',
): void {
  registrarNoColetor(criarEvento('comparativo_aberto', { rota }));
}
