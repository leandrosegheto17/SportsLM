// Declaração de tipos para verificar-segredos.mjs (FUND-03).
//
// O script roda como CLI puro em Node no job de CI (`node
// pipeline/ci/verificar-segredos.mjs dist`), por isso vive em `.mjs` — mas
// precisa de tipo para ser importado pelos testes (`tsc --noEmit` é portão
// de CI, TASK.md §1.1).
declare module '*/verificar-segredos.mjs' {
  export interface AchadoSegredo {
    arquivo: string;
    padrao: string;
  }

  export interface PadraoSegredo {
    nome: string;
    regex: RegExp;
  }

  export const PADROES_SEGREDO: PadraoSegredo[];
  export function encontrarSegredos(conteudo: string): PadraoSegredo[];
  export function varrerDiretorio(diretorio: string): AchadoSegredo[];
}
