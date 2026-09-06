// vitest-axe-setup.ts — UI-DS-01 (TASK.md Lote 7)
//
// `vitest-axe@0.1.0` publica `vitest-axe/extend-expect` para registrar o
// matcher automaticamente, mas o arquivo compilado
// (`node_modules/vitest-axe/dist/extend-expect.js`) está vazio nesta versão
// publicada no npm (bug do pacote, verificado nesta instalação) — o matcher
// nunca era `expect.extend`-ido em runtime, apesar do augmentation de tipos
// (`vitest-axe.d.ts`) funcionar normalmente. Contorno: importar a função pura
// do matcher e registrá-la manualmente, uma única vez, via `expect.extend` —
// mesmo efeito que `extend-expect` deveria ter tido. O subpath público
// `vitest-axe/matchers` também está com o `.d.ts` de tipos quebrado nesta
// versão (`export type *`, torna o export só-tipo e barra
// `verbatimModuleSyntax`); `vitest-axe/dist/matchers` é o mesmo módulo
// compilado, com o `.d.ts` correto (export de valor real) — usado aqui só
// para contornar o `.d.ts` público quebrado, não para depender de detalhe de
// build do pacote (a função em si é reexportada tal qual pelo subpath
// público).
import { expect } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe/dist/matchers';

expect.extend({ toHaveNoViolations });
