import type { ReactElement, ReactNode } from 'react';
import estilos from './EstadoVazio.module.css';

interface AcaoEstadoVazio {
  readonly rotulo: string;
  readonly aoClicar: () => void;
}

interface PropriedadesEstadoVazio {
  /** Ícone decorativo (`aria-hidden`) — o significado sempre vem do texto. */
  readonly icone?: ReactNode;
  readonly titulo: string;
  readonly texto: string;
  readonly acao?: AcaoEstadoVazio;
}

/**
 * `EstadoVazio` (UX-SPEC §3.8): ícone, título em `--txt-titulo`, explicação,
 * ação. Variantes "por tela" (Seção 4 do UX-SPEC) — os textos de `titulo`/
 * `texto` são sempre copiados literalmente da Seção 4 pela tela chamadora
 * (Diretriz de Implementação #9), nunca compostos por este componente.
 */
export function EstadoVazio({
  icone,
  titulo,
  texto,
  acao,
}: PropriedadesEstadoVazio): ReactElement {
  return (
    <div className={estilos['container']}>
      {icone ? (
        <span className={estilos['icone']} aria-hidden="true">
          {icone}
        </span>
      ) : null}
      <p className={estilos['titulo']}>{titulo}</p>
      <p className={estilos['texto']}>{texto}</p>
      {acao ? (
        <button type="button" className={estilos['acao']} onClick={acao.aoClicar}>
          {acao.rotulo}
        </button>
      ) : null}
    </div>
  );
}
