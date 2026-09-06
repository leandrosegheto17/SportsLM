// app/rotas/sobreposicoes/Configuracoes/SecaoAparencia.tsx — UI-T03-02
// (TASK.md Lote 9)
//
// T-03 · Configurações (UX-SPEC §3/T-03, wireframe "APARÊNCIA"): seletor de
// tema — "Igual ao sistema" · "Claro" · "Escuro" — em cima de `usarTema()`
// (FUND-05, `app/tema/usarTema.ts`), já pronto e testado; este componente só
// é a UI que faltava (comentário de FUND-05: "a tela de configurações que
// chama `definirPreferencia` [...] ainda não existe; este hook só precisa
// estar pronto para ser consumido por ela").
//
// Sem props: o tema é estado global do documento inteiro (`data-tema` em
// `<html>`), não um campo de `Preferencias`/`sportslm.preferencias.v1` — usa
// a própria chave independente `sportslm.tema.v1` (FUND-05) — por isso este
// componente lê/escreve direto via `usarTema()`, sem passar por
// `Configuracoes.tsx` (mesmo espírito de `SecaoFontesDeNoticia`/
// `SecaoMeuTime`: cada seção só recebe o que realmente precisa do pai).
// Critério de aceite explícito de UI-T03-02 ("troca de tema persiste
// `sportslm.tema.v1`") é garantido por `usarTema`/`app/tema/tema.ts`, já
// cobertos por teste próprio — aqui só confirmamos a integração de UI.

import type { ReactElement } from 'react';
import { usarTema } from '../../../tema/usarTema';
import { PREFERENCIAS_DE_TEMA, type PreferenciaDeTema } from '../../../tema/tema';
import estilos from './SecaoAparencia.module.css';

const ROTULO_POR_PREFERENCIA: Readonly<Record<PreferenciaDeTema, string>> = {
  sistema: 'Igual ao sistema',
  claro: 'Claro',
  escuro: 'Escuro',
};

export function SecaoAparencia(): ReactElement {
  const { preferencia, definirPreferencia } = usarTema();

  return (
    <section className={estilos['secao']} aria-labelledby="titulo-aparencia">
      <h3 id="titulo-aparencia" className={estilos['titulo']}>
        Aparência
      </h3>

      <fieldset className={estilos['fieldset']}>
        <legend className={estilos['somenteLeitorDeTela']}>
          Aparência — tema do aplicativo
        </legend>
        <div className={estilos['opcoes']}>
          {PREFERENCIAS_DE_TEMA.map((valor) => (
            <label key={valor} className={estilos['opcao']}>
              <input
                type="radio"
                name="tema"
                value={valor}
                checked={preferencia === valor}
                onChange={() => {
                  definirPreferencia(valor);
                }}
                className={estilos['radio']}
              />
              {ROTULO_POR_PREFERENCIA[valor]}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
