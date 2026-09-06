// vitest-axe.d.ts — UI-DS-01 (TASK.md Lote 7)
//
// `vitest-axe` (devDependency, testes de acessibilidade automatizados —
// TASK.md, instrução explícita de UI-DS-01) publica sua própria
// `extend-expect.d.ts`, mas ela aumenta o namespace legado `Vi.Assertion`
// (alinhado à API de matcher de versões antigas do Vitest, ≤0.17), não a
// interface `Assertion<T>` exportada por `@vitest/expect`/`vitest` na versão
// 2.x já usada neste projeto (`package.json`) — por isso `toHaveNoViolations`
// existe em runtime (`expect.extend`, `vitest-axe/extend-expect.js`) mas não
// era reconhecido por `tsc --noEmit`. Esta é a mesma técnica de augmentation
// documentada pelo próprio Vitest 2.x para matchers customizados
// (https://vitest.dev/guide/extending-matchers), aplicada aqui só para
// suprir a lacuna de tipos de `vitest-axe`.
import type { AxeResults } from 'axe-core';

interface MatchersDeAcessibilidade<R = unknown> {
  /** `vitest-axe`: nenhuma violação encontrada pelo `axe-core` (critério de
   * aceite de UI-DS-01 e de qualquer outro componente do design system que
   * use `axe-core`). */
  toHaveNoViolations: (resultado?: AxeResults) => R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmentation padrão do Vitest 2.x para matcher customizado (https://vitest.dev/guide/extending-matchers), interface vazia é intencional.
  interface Assertion<T = unknown> extends MatchersDeAcessibilidade<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- idem.
  interface AsymmetricMatchersContaining extends MatchersDeAcessibilidade {}
}
