// pipeline/config/derivador-paleta.ts — PUB-01 (TASK.md Lote 6, ADR-017)
//
// Ponto de entrada de pipeline (roda em CI, nunca no navegador — SDD §1.4
// "SPA nunca calcula a paleta") que consome `corBase`/`paletaManual` de
// `config/clubes-2026.json` (via `pipeline/config/clubes.ts`, CFG-02) e
// produz/valida o bloco `paleta` (SDD §5.2) de cada um dos 20 clubes. A
// aritmética pura (conversão de cor, contraste WCAG, o algoritmo de
// derivação em si) vive em `dominio/futebol/paleta.ts`, reaproveitável por
// `app/` se algum dia fizer sentido exibir uma pré-visualização — este
// módulo é só o encaixe com I/O (leitura de `clubes-2026.json`) e a decisão
// de "quebrar o build" (ADR-017 item 2, passo 4: "Falha em qualquer um =
// FALHA DE BUILD. Não existe queda silenciosa para uma cor 'parecida'").
//
// Nota de decisão sobre o mecanismo de "quebra de build" (TASK.md §6): o
// projeto não tem hoje um executor de script TypeScript standalone (só
// `fast-xml-parser`/`zod` são dependências de runtime autorizadas pelo SDD
// §3 — adicionar `tsx`/`ts-node` só para rodar este arquivo como CLI seria
// uma dependência nova fora da lista fechada, exigindo atualização do
// GUARDRAILS.md antes do merge, o que está fora do escopo desta tarefa).
// Em vez de um CLI `.mjs` (padrão de `pipeline/ci/verificar-segredos.mjs`,
// FUND-03), o gatilho de "quebra de build" desta tarefa é o próprio
// `vitest run` — já um portão de CI (FUND-01) — através de
// `derivador-paleta.test.ts`, que roda `derivarPaletasClubes` sobre os 20
// clubes REAIS de `config/clubes-2026.json` e falha o teste (portanto a
// suíte, portanto o CI) se qualquer um não validar. Mesmo padrão já usado em
// `tests/dominio-purity.eslint.test.ts` (FUND-01): uma regra estrutural vira
// um teste que quebra o build, não um script solto. Quando `PUB-02`
// (`gerador-snapshots`) existir, ele importa `derivarPaletasClubes` como
// módulo TS normal (compilado junto do resto do pipeline) para produzir o
// `clubes-2026.json` publicado com o bloco `paleta` — nenhuma duplicação de
// lógica.

import { derivarPaleta, validarPaleta } from '../../dominio/futebol/paleta';
import type { PaletaClube } from '../../dominio/tipos/futebol';
import { carregarClubesSerieA2026, type ClubeBase } from './clubes';

export type ClubeComPaleta = ClubeBase & { paleta: PaletaClube };

/**
 * Erro de validação de paleta — mensagem já inclui o id do clube e a lista
 * de alvos de contraste que falharam (ADR-017 §3), para que a falha de CI
 * seja imediatamente acionável.
 */
export class ErroPaletaInvalida extends Error {
  constructor(
    readonly clubeId: string,
    readonly erros: string[],
  ) {
    super(
      `paleta inválida para o clube '${clubeId}' (ADR-017 §3, ${erros.length} alvo(s) de contraste abaixo de 4,5:1):\n` +
        erros.map((erro) => `  - ${erro}`).join('\n'),
    );
    this.name = 'ErroPaletaInvalida';
  }
}

/**
 * Deriva e valida a `PaletaClube` de um único clube base. Lança
 * `ErroPaletaInvalida` se a paleta resultante (já com `paletaManual`
 * mesclado, quando presente) não passar nos 8 alvos de contraste do
 * ADR-017 §3 — "falha de validação quebra o build", nunca uma correção
 * silenciosa (GUARDRAILS.md §4).
 */
export function derivarPaletaClube(clube: ClubeBase): ClubeComPaleta {
  // `clube.paletaManual` vem de `paletaClubeSchema.partial()` (Zod): sob
  // `exactOptionalPropertyTypes` (tsconfig estrito, FUND-01) o tipo inferido
  // por Zod para cada campo é `T | undefined` (chave opcional + valor
  // possivelmente `undefined`), enquanto `Partial<PaletaClube>` (TS nativo)
  // não aceita `undefined` explícito no valor de uma chave opcional — mesmo
  // dado, duas formas de tipar a mesma ausência de campo. Cast estreito,
  // sem perda de segurança em runtime (`derivarPaleta`/`{ ...base, ...over
  // }` tratam chave ausente e chave `undefined` da mesma forma).
  const paletaManual = clube.paletaManual as Partial<PaletaClube> | undefined;
  const paleta = derivarPaleta(clube.corBase, paletaManual);
  const resultado = validarPaleta(paleta);
  if (!resultado.valido) {
    throw new ErroPaletaInvalida(clube.id, resultado.erros);
  }
  return { ...clube, paleta };
}

/**
 * Deriva e valida a paleta de uma lista de clubes (tipicamente os 20 da
 * temporada, `config/clubes-2026.json`/CFG-02). Propaga a primeira falha
 * encontrada (`ErroPaletaInvalida`) — um único clube com corBase inválida
 * (sem override) quebra a execução inteira, por design (ADR-017).
 */
export function derivarPaletasClubes(clubes: ClubeBase[]): ClubeComPaleta[] {
  return clubes.map(derivarPaletaClube);
}

/** Conveniência para quem só tem acesso ao arquivo real de configuração
 * (produção/CI) — lê `config/clubes-2026.json` via CFG-02 e aplica
 * `derivarPaletasClubes`. Parâmetro `caminho` só existe para teste com
 * fixture (mesma convenção de `carregarClubesSerieA2026`). */
export function derivarPaletasClubesSerieA2026(caminho?: string): ClubeComPaleta[] {
  const clubes =
    caminho === undefined
      ? carregarClubesSerieA2026()
      : carregarClubesSerieA2026(caminho);
  return derivarPaletasClubes(clubes);
}
