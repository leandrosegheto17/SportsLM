// app/rotas/paginas/Onboarding/PassoTime.tsx — UI-T01-02 (TASK.md Lote 8)
//
// T-01 · Onboarding — passo 2 de 2 (time do coração), UX-SPEC §2 (wireframe
// "T-01 · Onboarding — passo 2 de 2") e §4/T-01 (estados). Busca + lista dos
// 20 clubes da Série A corrente com busca por nome/sigla (CA-06.1); confirmar
// persiste e conclui (CA-06.2), pular conclui sem time (CA-14.3). "Carregando"
// não se aplica — mesma nota de `PassoFavoritos.tsx`: os 20 clubes vêm de
// `config/clubes-2026.json`, já presente no carregamento inicial
// (`catalogoOnboarding.ts`), sem `fetch`.
//
// A cor de cada avatar de clube nesta lista usa `corBase` (Diretriz de
// Implementação #4 permite literal de cor de clube vindo de
// `clubes-2026.json`) via `AvatarClube`/`corIdentidade` — mesmo mecanismo já
// usado por `TabelaClassificacao` para várias cores de clube simultâneas.
// Isto é só o avatar decorativo da lista de escolha; a identidade "oficial"
// pós-confirmação (paleta derivada e validada por contraste, ADR-017) é
// responsabilidade de quem chama este componente (`Onboarding.tsx`), na
// transição para a home — este componente nunca deriva nem valida paleta.

import { useMemo, useState, type ReactElement } from 'react';
import { AvatarClube } from '../../../design-system/componentes';
import { Botao } from '../../../design-system/componentes/Botao';
import { CampoBusca } from '../../../design-system/componentes/CampoBusca';
import { FaixaClube } from '../../../design-system/FaixaClube';
import type { ClubeCatalogo } from './catalogoOnboarding';
import estilos from './PassoTime.module.css';

export interface PropriedadesPassoTime {
  /** Os 20 clubes da temporada corrente (RN-04/CA-06.1), na ordem de
   * `config/clubes-2026.json`. */
  readonly clubes: readonly ClubeCatalogo[];
  /** `null` enquanto nenhum time foi marcado — `[ Confirmar ]` fica
   * desabilitado (UX-SPEC §4/T-01: "Preenchido: rádio marcado e [ CONFIRMAR ]
   * habilitado"). */
  readonly timeSelecionado: string | null;
  readonly aoSelecionar: (clubeId: string) => void;
  readonly aoConfirmar: () => void;
  readonly aoPular: () => void;
  readonly aoVoltar: () => void;
}

/** Remove acento/caixa para busca por nome tolerante (CA-06.1: "busca por
 * nome") — também casa por sigla (ex.: "spa"). */
function normalizarParaBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function PassoTime({
  clubes,
  timeSelecionado,
  aoSelecionar,
  aoConfirmar,
  aoPular,
  aoVoltar,
}: PropriedadesPassoTime): ReactElement {
  const [busca, setBusca] = useState('');

  const clubesFiltrados = useMemo(() => {
    const termo = normalizarParaBusca(busca.trim());
    if (!termo) {
      return clubes;
    }
    return clubes.filter(
      (clube) =>
        normalizarParaBusca(clube.nomeCurto).includes(termo) ||
        normalizarParaBusca(clube.sigla).includes(termo),
    );
  }, [busca, clubes]);

  const termoBuscado = busca.trim();
  const semResultado = termoBuscado.length > 0 && clubesFiltrados.length === 0;

  return (
    <div className={estilos['tela']}>
      <FaixaClube variante="neutra" />

      <div className={estilos['conteudo']}>
        <div className={estilos['cabecalho']}>
          <button
            type="button"
            className={estilos['voltar']}
            onClick={aoVoltar}
            aria-label="Voltar ao passo 1"
          >
            ←
          </button>
          <p className={estilos['passoRotulo']}>PASSO 2 DE 2</p>
        </div>
        <div
          className={estilos['barra']}
          role="progressbar"
          aria-valuenow={2}
          aria-valuemin={1}
          aria-valuemax={2}
          aria-label="Passo 2 de 2"
        >
          <div className={estilos['barraPreenchida']} />
        </div>

        <h1 className={estilos['titulo']}>QUAL É O SEU TIME?</h1>
        <p className={estilos['subtitulo']}>Clubes da Série A de 2026.</p>

        <CampoBusca
          rotulo="Buscar time"
          valor={busca}
          aoMudar={setBusca}
          placeholder="Buscar time"
          semResultado={semResultado}
          mensagemSemResultado={`Nenhum clube encontrado para "${termoBuscado}". A lista tem os 20 clubes da Série A de 2026.`}
        />

        <fieldset className={estilos['fieldset']}>
          <legend className={estilos['somenteLeitorDeTela']}>
            Times da Série A de 2026
          </legend>
          <ul className={estilos['lista']}>
            {clubesFiltrados.map((clube) => {
              const selecionado = clube.id === timeSelecionado;
              return (
                <li key={clube.id}>
                  <label className={estilos['item']}>
                    <input
                      type="radio"
                      name="onboarding-time"
                      value={clube.id}
                      checked={selecionado}
                      onChange={() => {
                        aoSelecionar(clube.id);
                      }}
                      className={estilos['radio']}
                    />
                    {/* Decorativo dentro do `<label>`: o nome acessível do
                     * rádio já vem do texto visível logo abaixo — sem isto, a
                     * computação de nome concatenaria o `aria-label` do
                     * avatar ("São Paulo") com o texto visível, duplicando o
                     * nome anunciado. */}
                    <span aria-hidden="true">
                      <AvatarClube
                        sigla={clube.sigla}
                        tamanho={32}
                        corIdentidade={clube.corBase}
                      />
                    </span>
                    <span className={estilos['nomeClube']}>{clube.nomeCurto}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      </div>

      <div className={estilos['rodape']}>
        <Botao
          variante="primario"
          className={estilos['botaoConfirmar']}
          onClick={aoConfirmar}
          disabled={timeSelecionado === null}
        >
          Confirmar
        </Botao>
        <button type="button" className={estilos['pular']} onClick={aoPular}>
          Pular
        </button>
      </div>
    </div>
  );
}
