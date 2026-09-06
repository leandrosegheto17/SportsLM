import { useRef, type KeyboardEvent, type ReactElement } from 'react';
import type { Palpite } from '../../../dominio/tipos/estado-local';
import estilos from './SeletorPalpite.module.css';

/** Uma das 4 opções fixas do seletor, na ordem do UX-SPEC §3.8.5 (V/E/D/—). */
interface OpcaoPalpite {
  readonly valor: Palpite | null;
  readonly letra: string;
  readonly rotulo: string;
}

const OPCOES: readonly OpcaoPalpite[] = [
  { valor: 'vitoria', letra: 'V', rotulo: 'Vitória' },
  { valor: 'empate', letra: 'E', rotulo: 'Empate' },
  { valor: 'derrota', letra: 'D', rotulo: 'Derrota' },
  { valor: null, letra: '—', rotulo: 'Sem palpite' },
];

/** Mapa de letra por valor, usado pela variante "travado" para mostrar o
 * resultado real com a mesma letra dos rádios (RN-14/CA-11.6). */
const LETRA_POR_VALOR = new Map<Palpite, string>(
  OPCOES.filter((opcao) => opcao.valor !== null).map((opcao) => [
    opcao.valor as Palpite,
    opcao.letra,
  ]),
);

interface PropriedadesSeletorPalpite {
  /** Id estável da partida (usado como `name` do grupo de rádio). */
  readonly idPartida: string;
  /** Texto do `legend`, ex.: "24ª rodada — São Paulo x Fluminense, fora". */
  readonly legenda: string;
  /** Valor atual: 'vitoria' | 'empate' | 'derrota' | null (opção "—"). */
  readonly valor: Palpite | null;
  /** Chamado quando o usuário escolhe uma opção (clique ou seta). Não é
   * chamado nas variantes "travado"/"espelhado". */
  readonly aoMudar: (novoValor: Palpite | null) => void;
  /**
   * - `editavel` (padrão): rádios habilitados.
   * - `travado`: partida já disputada — mostra o resultado real, sem rádios
   *   (UX-SPEC §3.8.5, "🔒 DISPUTADA").
   * - `espelhado`: confronto direto — reflete o valor calculado a partir do
   *   outro lado do confronto; rádios desabilitados para nunca permitir
   *   contradição (CA-11.4). Decisão de implementação registrada (TASK.md
   *   §6): o UX-SPEC não especifica explicitamente se o espelhado aceita
   *   interação; optei por somente-leitura porque UI-T09-01 exige "sem
   *   permitir contradição".
   */
  readonly variante?: 'editavel' | 'travado' | 'espelhado';
  /** Obrigatório quando `variante === 'travado'`. */
  readonly resultadoReal?: Palpite;
  /** Obrigatório quando `variante === 'espelhado'`: frase que explica o
   * efeito do confronto direto (UX-SPEC §3.8.5). */
  readonly textoConfrontoDireto?: string;
}

/**
 * `SeletorPalpite` (UI-DS-05, UX-SPEC §3.8.5) — `fieldset`/`legend` com 4
 * rádios nativos (V/E/D/—). A opção selecionada carrega 3 pistas redundantes
 * de WCAG 1.4.1 (Diretriz de Implementação #7): preenchimento (`--clube-
 * identidade`), contorno de 2px e a letra em si, sempre visível como texto —
 * nenhuma pista depende só de cor.
 *
 * Navegação por setas: implementada explicitamente (roving tabindex, padrão
 * WAI-ARIA APG "radio group") em vez de depender só do comportamento nativo
 * do navegador para grupos de `<input type="radio">`, que varia entre
 * motores de renderização — a marcação continua sendo `fieldset`/`legend` +
 * `<input type="radio">` nativos (sem `role` customizado), então o
 * comportamento nativo de leitor de tela permanece o de um radiogroup comum.
 */
export function SeletorPalpite({
  idPartida,
  legenda,
  valor,
  aoMudar,
  variante = 'editavel',
  resultadoReal,
  textoConfrontoDireto,
}: PropriedadesSeletorPalpite): ReactElement {
  const referenciasRadio = useRef<(HTMLInputElement | null)[]>([]);
  const somenteLeitura = variante === 'espelhado';
  const desabilitado = variante === 'espelhado';

  function indiceSelecionadoOuPrimeiro(): number {
    const indiceSelecionado = OPCOES.findIndex((opcao) => opcao.valor === valor);
    return indiceSelecionado === -1 ? 0 : indiceSelecionado;
  }

  function moverFoco(indiceAtual: number, direcao: 1 | -1): void {
    const total = OPCOES.length;
    const proximoIndice = (indiceAtual + direcao + total) % total;
    const proximaOpcao = OPCOES[proximoIndice];
    if (!proximaOpcao) {
      return;
    }
    aoMudar(proximaOpcao.valor);
    referenciasRadio.current[proximoIndice]?.focus();
  }

  function aoPressionarTecla(
    evento: KeyboardEvent<HTMLInputElement>,
    indice: number,
  ): void {
    if (desabilitado) {
      return;
    }
    switch (evento.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        evento.preventDefault();
        moverFoco(indice, 1);
        return;
      case 'ArrowLeft':
      case 'ArrowUp':
        evento.preventDefault();
        moverFoco(indice, -1);
        return;
      default:
        return;
    }
  }

  if (variante === 'travado') {
    const letra = resultadoReal ? LETRA_POR_VALOR.get(resultadoReal) : undefined;
    return (
      <fieldset className={estilos['seletor']} data-variante="travado">
        <legend className={estilos['legenda']}>{legenda}</legend>
        <p className={estilos['travado']}>
          <span aria-hidden="true">🔒</span> DISPUTADA
          {letra ? (
            <span className={estilos['resultadoReal']}>
              {' '}
              — resultado: <strong>{letra}</strong>
            </span>
          ) : null}
        </p>
      </fieldset>
    );
  }

  const indiceComTabIndexZero = indiceSelecionadoOuPrimeiro();

  return (
    <fieldset className={estilos['seletor']} data-variante={variante}>
      <legend className={estilos['legenda']}>{legenda}</legend>
      {variante === 'espelhado' ? (
        <p className={estilos['confrontoDireto']}>
          <span className={estilos['confrontoDiretoRotulo']}>CONFRONTO DIRETO</span>
          {textoConfrontoDireto ? <span> {textoConfrontoDireto}</span> : null}
        </p>
      ) : null}
      <div className={estilos['opcoes']} role="presentation">
        {OPCOES.map((opcao, indice) => {
          const selecionada = opcao.valor === valor;
          const idOpcao = `${idPartida}-${opcao.valor ?? 'sem-palpite'}`;
          return (
            <label
              key={idOpcao}
              htmlFor={idOpcao}
              className={
                selecionada
                  ? `${estilos['opcao']} ${estilos['opcaoSelecionada']}`
                  : estilos['opcao']
              }
            >
              <input
                ref={(elemento) => {
                  referenciasRadio.current[indice] = elemento;
                }}
                type="radio"
                id={idOpcao}
                name={`palpite-${idPartida}`}
                value={opcao.valor ?? 'sem-palpite'}
                checked={selecionada}
                disabled={desabilitado}
                readOnly={somenteLeitura}
                tabIndex={indice === indiceComTabIndexZero ? 0 : -1}
                className={estilos['entrada']}
                onChange={() => {
                  if (!desabilitado) {
                    aoMudar(opcao.valor);
                  }
                }}
                onKeyDown={(evento) => aoPressionarTecla(evento, indice)}
                aria-label={opcao.rotulo}
              />
              <span className={estilos['letra']} aria-hidden="true">
                {opcao.letra}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
