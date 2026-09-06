import type { ReactElement } from 'react';
import estilos from './EtiquetaEsporte.module.css';

interface PropriedadesEtiquetaEsporte {
  /**
   * Id do esporte (um dos 15 de `dominio/tipos/esportes.ts`) ou `'geral'`
   * (UX-SPEC §3.8: "15 esportes + GERAL"). Usado só como gancho de teste/estilo
   * (`data-esporte`) — o rótulo visível vem sempre de `rotulo`.
   */
  readonly esporte: string;
  /**
   * Rótulo já resolvido pela tela chamadora (nome do esporte da Seção 2A do
   * PRD-TECNICO, ou "GERAL"). Este componente não conhece a lista de nomes —
   * evita duplicar `config/esportes.json` dentro do design system.
   */
  readonly rotulo: string;
}

/**
 * `EtiquetaEsporte` (UX-SPEC §3.8): caixa alta 12/16 sobre fundo tonal, raio
 * `sm`. Fundo tonal usa `--clube-suave` (UX-SPEC §3.4 lista "etiqueta de
 * esporte" entre os usos deste token) — decisão de detalhe registrada
 * (TASK.md §6): o texto "paleta fixa de 15 tons do sistema" (§3.8, usado pela
 * barra de `CartaoIngresso`, fora do escopo desta tarefa) não tem os 15 tons
 * publicados em `tokens.css` (FUND-05); usar `--clube-suave` mantém a etiqueta
 * dentro do único token de fundo tonal que o UX-SPEC de fato define para este
 * componente, sem inventar cor fora do arquivo de tokens (Diretriz de
 * Implementação #4). A pista de significado nunca é só a cor: o nome do
 * esporte é sempre texto.
 */
export function EtiquetaEsporte({
  esporte,
  rotulo,
}: PropriedadesEtiquetaEsporte): ReactElement {
  return (
    <span className={estilos['etiqueta']} data-esporte={esporte}>
      {rotulo}
    </span>
  );
}
