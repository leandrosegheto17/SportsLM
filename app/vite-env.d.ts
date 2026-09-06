/// <reference types="vite/client" />

// TEL-01 (TASK.md Lote 12, ADR-012 regra 5): declarada como propriedade
// nomeada (não deixada só na assinatura de índice de `vite/client`) por dois
// motivos: (1) permite acesso por notação de ponto
// (`import.meta.env.VITE_TELEMETRIA`) sem violar
// `noPropertyAccessFromIndexSignature` do `tsconfig.json`; (2) é a notação
// de ponto, não `import.meta.env['VITE_TELEMETRIA']`, que o mecanismo de
// substituição estática de variável de build do Vite reconhece — condição
// para a eliminação por tree-shoking exigida pelo critério de aceite de
// TEL-01 (confirmado empiricamente em `app/telemetria/buildEliminacao.test.ts`).
interface ImportMetaEnv {
  readonly VITE_TELEMETRIA?: string;
}
