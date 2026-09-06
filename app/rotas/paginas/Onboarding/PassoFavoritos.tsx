// app/rotas/paginas/Onboarding/PassoFavoritos.tsx — UI-T01-01 (TASK.md Lote 8)
//
// T-01 · Onboarding — passo 1 de 2 (favoritos), UX-SPEC §3.8 (wireframe) e
// §4 (estados "vazio"/"preenchido" — mesmo layout, só o contador muda).
// "Carregando" não se aplica (UX-SPEC §4/T-01: esportes vêm de configuração já
// presente); o estado "Erro" (falha ao carregar a configuração) é tratado por
// quem chama (`Onboarding.tsx`), antes deste componente montar.
//
// Decisão de detalhe registrada (TASK.md §6): UX-SPEC §4/CA-03.3 pede
// `aria-disabled="true"` nos chips não selecionados ao atingir o limite. O
// `Chip` de UI-DS-07A (já `Concluída`) só expõe `disabled` (atributo nativo),
// que removeria o botão do fluxo de tabulação e, mais grave, bloquearia o
// próprio evento de clique — tornando o `aria-live` desta CA inalcançável por
// teclado/clique. Por isso este componente NÃO desabilita nativamente o chip:
// mantém todos operáveis, intercepta a tentativa de 4º favorito no próprio
// manipulador de clique (nunca repassa ao `aoAlternar` do chamador) e aplica
// só a pista visual "esmaecida" via classe do `<li>` — preservando a
// operabilidade exigida pelo próprio critério de aceite explícito desta
// tarefa (o `aria-live` tem que ser alcançável).

import { useState, type ReactElement } from 'react';
import type { EsporteId } from '../../../../dominio/tipos/esportes';
import { Botao } from '../../../design-system/componentes/Botao';
import { Chip } from '../../../design-system/componentes/Chip';
import { FaixaClube } from '../../../design-system/FaixaClube';
import estilos from './PassoFavoritos.module.css';

export interface EsporteParaEscolha {
  readonly id: EsporteId;
  readonly nome: string;
}

export interface PropriedadesPassoFavoritos {
  /** Os 15 esportes da Seção 2A (RN-06), na ordem — CA-03.1. */
  readonly esportes: readonly EsporteParaEscolha[];
  /** 0 a 3 favoritos já marcados (RN-06) — controlado por quem chama, que
   * também é responsável por persistir (CA-03.2, UI-DS-09). */
  readonly favoritos: readonly EsporteId[];
  /** Chamado só quando marcar/desmarcar é uma transição válida — este
   * componente nunca deixa passar uma tentativa de 4º favorito (CA-03.3). */
  readonly aoAlternar: (esporte: EsporteId) => void;
  readonly aoContinuar: () => void;
  readonly aoPular: () => void;
}

const LIMITE_FAVORITOS = 3;

/** Texto canônico de CA-03.3/UX-SPEC §4 T-01 — copiado literalmente
 * (Diretriz de Implementação #9), nunca parafraseado. */
export const MENSAGEM_LIMITE_FAVORITOS =
  'Até 3 esportes favoritos; desmarque um para trocar.';

export function PassoFavoritos({
  esportes,
  favoritos,
  aoAlternar,
  aoContinuar,
  aoPular,
}: PropriedadesPassoFavoritos): ReactElement {
  const [mensagemBloqueio, setMensagemBloqueio] = useState('');
  const limiteAtingido = favoritos.length >= LIMITE_FAVORITOS;

  function aoClicarChip(esporte: EsporteId): void {
    const jaSelecionado = favoritos.includes(esporte);
    if (!jaSelecionado && limiteAtingido) {
      // CA-03.3: impede o 4º favorito e informa via aria-live.
      setMensagemBloqueio(MENSAGEM_LIMITE_FAVORITOS);
      return;
    }
    setMensagemBloqueio('');
    aoAlternar(esporte);
  }

  return (
    <div className={estilos['tela']}>
      <FaixaClube variante="neutra" />

      <div className={estilos['conteudo']}>
        <p className={estilos['passoRotulo']}>PASSO 1 DE 2</p>
        <div
          className={estilos['barra']}
          role="progressbar"
          aria-valuenow={1}
          aria-valuemin={1}
          aria-valuemax={2}
          aria-label="Passo 1 de 2"
        >
          <div className={estilos['barraPreenchida']} />
        </div>

        <h1 className={estilos['titulo']}>QUAIS ESPORTES VOCÊ QUER EM DESTAQUE?</h1>
        <p className={estilos['subtitulo']}>Escolha até 3. Dá para mudar depois.</p>

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

        <p className={estilos['contador']}>
          {favoritos.length} DE {LIMITE_FAVORITOS} ESCOLHIDOS
        </p>

        {/* CA-03.3: região viva dedicada — só o texto muda quando a tentativa
         * de 4º favorito acontece, o que garante o anúncio (uma região viva
         * que já nasce com o texto não é anunciada por leitores de tela). */}
        <p aria-live="polite" className={estilos['somenteLeitorDeTela']}>
          {mensagemBloqueio}
        </p>
      </div>

      <div className={estilos['rodape']}>
        <Botao
          variante="primario"
          className={estilos['botaoContinuar']}
          onClick={aoContinuar}
        >
          Continuar
        </Botao>
        <button type="button" className={estilos['pular']} onClick={aoPular}>
          Pular
        </button>
      </div>
    </div>
  );
}
