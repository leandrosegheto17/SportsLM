import { useEffect } from 'react';

/**
 * ADR-003: mudança de rota exige gestão explícita de `<title>` (requisito de
 * aceite, não opcional) para que o leitor de tela anuncie o novo contexto.
 * Cada tela chama este hook com o nome canônico da tela (UX-SPEC §1.1).
 */
export function useTituloDocumento(tituloDaTela: string): void {
  useEffect(() => {
    document.title = `${tituloDaTela} · SportsLM`;
  }, [tituloDaTela]);
}
