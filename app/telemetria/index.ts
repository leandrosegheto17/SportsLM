// app/telemetria/index.ts — TEL-01 (TASK.md Lote 12)
//
// Ponto de entrada público do módulo `telemetria` e o interruptor de build
// de ADR-012 regra 5: `VITE_TELEMETRIA=on|off`. Com `off` (ou variável
// ausente — padrão seguro, opt-in), nenhum código de telemetria entra no
// bundle e nenhuma requisição sai do navegador.
//
// Mecanismo (não é só um `if` em runtime): o Vite substitui
// `import.meta.env.VITE_TELEMETRIA` pelo valor literal da variável em
// tempo de build (assim como já faz para `VITE_ROTEAMENTO` em `App.tsx`).
// Quando o literal resultante torna a condição estaticamente falsa (ex.:
// `"off" === 'on'`), o esbuild elimina o bloco morto no próprio passo de
// transformação de cada módulo — antes do Rollup empacotar — e, com o corpo
// do `if` removido, a única referência a cada função de `./nucleoTelemetria`
// (que por sua vez é o único consumidor de `./coletor` e `./id`) desaparece
// deste arquivo. Import não mais referenciado é removido pelo tree-shaking
// do Rollup, e como nenhum desses módulos tem efeito colateral de nível de
// módulo (só declara função/const), eles somem do bundle final por inteiro —
// não apenas ficam inertes atrás de um `if(false)` em runtime.
//
// Prova automatizada: `buildEliminacao.test.ts` builda o projeto de verdade
// duas vezes (uma com `VITE_TELEMETRIA=on`, outra com `off`/ausente) e
// confirma que o artefato de produção da build "off" não contém nenhum dos
// nomes de evento nem os identificadores deste módulo, enquanto a build "on"
// contém.
//
// A checagem é repetida em CADA função pública (em vez de um único guard
// central reaproveitado) de propósito: cada uma precisa da condição literal
// e completa no próprio corpo para o esbuild eliminar aquele `if`
// especificamente — indireção por uma constante importada de outro módulo
// dependeria de dobra de constante entre módulos, que não é garantida da
// mesma forma pelo esbuild.

import {
  registrarComparativoAbertoNoNucleo,
  registrarPersonalizacaoConcluidaNoNucleo,
  registrarPrimeiraInteracaoUtilNoNucleo,
  registrarPrimeiraSessaoNoNucleo,
  registrarRetornoNoNucleo,
} from './nucleoTelemetria';

export function telemetriaHabilitada(): boolean {
  return import.meta.env.VITE_TELEMETRIA === 'on';
}

/** `primeira_sessao` — ADR-012: primeira execução no dispositivo. */
export function registrarPrimeiraSessao(): void {
  if (import.meta.env.VITE_TELEMETRIA === 'on') {
    registrarPrimeiraSessaoNoNucleo();
  }
}

/** `retorno` — ADR-012: abertura com preferências já existentes. */
export function registrarRetorno(diasDesdePrimeiraSessao: number): void {
  if (import.meta.env.VITE_TELEMETRIA === 'on') {
    registrarRetornoNoNucleo(diasDesdePrimeiraSessao);
  }
}

/** `personalizacao_concluida` — ADR-012: ≥ 1 favorito e (se aplicável) time
 * definidos. */
export function registrarPersonalizacaoConcluida(
  quantidadeFavoritos: number,
  temTimeDefinido: boolean,
): void {
  if (import.meta.env.VITE_TELEMETRIA === 'on') {
    registrarPersonalizacaoConcluidaNoNucleo(quantidadeFavoritos, temTimeDefinido);
  }
}

/** `primeira_interacao_util` — ADR-012: abrir uma notícia ou o painel do
 * time. */
export function registrarPrimeiraInteracaoUtil(milissegundosAteInteracao: number): void {
  if (import.meta.env.VITE_TELEMETRIA === 'on') {
    registrarPrimeiraInteracaoUtilNoNucleo(milissegundosAteInteracao);
  }
}

/** `comparativo_aberto` — ADR-012: entrada em `/comparativo` ou
 * `/simulacao`. */
export function registrarComparativoAberto(rota: 'comparativo' | 'simulacao'): void {
  if (import.meta.env.VITE_TELEMETRIA === 'on') {
    registrarComparativoAbertoNoNucleo(rota);
  }
}
