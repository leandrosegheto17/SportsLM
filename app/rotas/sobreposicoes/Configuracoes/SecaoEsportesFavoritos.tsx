// app/rotas/sobreposicoes/Configuracoes/SecaoEsportesFavoritos.tsx —
// UI-T03-02 (TASK.md Lote 9)
//
// T-03 · Configurações (UX-SPEC §3/T-03): bloco "ESPORTES FAVORITOS" — até 3
// favoritos (RN-06), "mesma regra do onboarding" (TASK.md, UI-T03-02): reusa
// o próprio `Chip` selecionável (UI-DS-07A) e o texto canônico de limite
// (CA-03.3) já definido/testado em `PassoFavoritos` (UI-T01-01) — importado
// dali, não duplicado, para nunca divergir (Diretriz de Implementação #9).
//
// Mesma decisão de acessibilidade de `PassoFavoritos` (comentário lá,
// reaplicado aqui): o `Chip` não é desabilitado nativamente ao atingir o
// limite (isso bloquearia o próprio clique que precisa disparar o
// `aria-live`) — a tentativa de 4º favorito é interceptada aqui, nunca
// repassada a `aoAlternar`.

import { useState, type ReactElement } from 'react';
import type { EsporteId } from '../../../../dominio/tipos';
import { Chip } from '../../../design-system/componentes/Chip';
import {
  MENSAGEM_LIMITE_FAVORITOS,
  type EsporteParaEscolha,
} from '../../paginas/Onboarding/PassoFavoritos';
import estilos from './SecaoEsportesFavoritos.module.css';

export interface PropriedadesSecaoEsportesFavoritos {
  /** Os 15 esportes da Seção 2A (RN-06), na ordem — mesma fonte do onboarding. */
  readonly esportes: readonly EsporteParaEscolha[];
  /** 0 a 3 favoritos já marcados (RN-06). */
  readonly favoritos: readonly EsporteId[];
  /** Nunca chamado para uma tentativa de 4º favorito (CA-03.3) — este
   * componente já filtra isso. */
  readonly aoAlternar: (esporte: EsporteId) => void;
}

const LIMITE_FAVORITOS = 3;

export function SecaoEsportesFavoritos({
  esportes,
  favoritos,
  aoAlternar,
}: PropriedadesSecaoEsportesFavoritos): ReactElement {
  const [mensagemBloqueio, setMensagemBloqueio] = useState('');
  const limiteAtingido = favoritos.length >= LIMITE_FAVORITOS;

  function aoClicarChip(esporte: EsporteId): void {
    const jaSelecionado = favoritos.includes(esporte);
    if (!jaSelecionado && limiteAtingido) {
      setMensagemBloqueio(MENSAGEM_LIMITE_FAVORITOS);
      return;
    }
    setMensagemBloqueio('');
    aoAlternar(esporte);
  }

  return (
    <section className={estilos['secao']} aria-labelledby="titulo-esportes-favoritos">
      <div className={estilos['cabecalho']}>
        <h3 id="titulo-esportes-favoritos" className={estilos['titulo']}>
          Esportes favoritos
        </h3>
        <p className={estilos['contador']}>
          {favoritos.length} DE {LIMITE_FAVORITOS}
        </p>
      </div>

      <ul className={estilos['grade']} aria-label="Esportes">
        {esportes.map((esporte) => {
          const selecionado = favoritos.includes(esporte.id);
          return (
            <li
              key={esporte.id}
              className={
                !selecionado && limiteAtingido ? estilos['itemNoLimite'] : undefined
              }
            >
              <Chip
                variante="selecionavel"
                rotulo={esporte.nome}
                selecionado={selecionado}
                aoAlternar={() => {
                  aoClicarChip(esporte.id);
                }}
              />
            </li>
          );
        })}
      </ul>

      {/* CA-03.3: região viva dedicada, mesmo mecanismo de `PassoFavoritos` —
       * uma região que já nasce com o texto não é anunciada. */}
      <p aria-live="polite" className={estilos['somenteLeitorDeTela']}>
        {mensagemBloqueio}
      </p>
    </section>
  );
}
