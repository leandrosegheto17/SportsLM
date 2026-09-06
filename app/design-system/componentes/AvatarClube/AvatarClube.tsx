import type { CSSProperties, ReactElement } from 'react';
import estilos from './AvatarClube.module.css';

export type TamanhoAvatarClube = 28 | 32 | 44;

interface PropriedadesAvatarClube {
  /** Sigla de 3 letras do clube (RN-04). */
  readonly sigla: string;
  readonly tamanho: TamanhoAvatarClube;
  /**
   * Nome completo do clube, usado só para o nome acessível
   * (`aria-label`, ex.: "São Paulo"). Quando ausente, a sigla já é o próprio
   * nome acessível (texto visível).
   */
  readonly nomeClube?: string;
  /** Override inline de `--clube-identidade`/`--clube-identidade-texto`
   * (ex.: comparativo, onde vários avatares de clubes diferentes aparecem ao
   * mesmo tempo — cada um recebe a própria cor, sem depender de um ancestral
   * comum que já tenha as custom properties do clube). Sem override, usa o
   * fallback neutro "sem time" de `tokens.css` (UX-SPEC §3.4). */
  readonly corIdentidade?: string;
  readonly corIdentidadeTexto?: string;
}

/**
 * `AvatarClube` (UX-SPEC §3.8): círculo, sigla de 3 letras, fundo
 * `--clube-identidade`, texto `--clube-identidade-texto`. Tamanhos 28/32/44 px.
 *
 * Decisão já registrada (TASK.md §6, item 7): sem escudo oficial — sigla +
 * cor é a identidade visual completa deste componente (D5 do SDD §6.4 deixa
 * "escudo licenciado" para decisão futura do stakeholder, fora deste
 * Executor). A sigla é sempre texto real, nunca só a cor de fundo.
 */
export function AvatarClube({
  sigla,
  tamanho,
  nomeClube,
  corIdentidade,
  corIdentidadeTexto,
}: PropriedadesAvatarClube): ReactElement {
  const estilo: CSSProperties & Record<string, string> = {};
  if (corIdentidade !== undefined) {
    estilo['--clube-identidade'] = corIdentidade;
  }
  if (corIdentidadeTexto !== undefined) {
    estilo['--clube-identidade-texto'] = corIdentidadeTexto;
  }

  return (
    <span
      className={estilos['avatar']}
      style={{ ...estilo, width: `${tamanho}px`, height: `${tamanho}px` }}
      role="img"
      aria-label={nomeClube ?? sigla}
      data-tamanho={tamanho}
    >
      <span aria-hidden="true">{sigla}</span>
    </span>
  );
}
