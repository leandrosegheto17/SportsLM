// app/rotas/sobreposicoes/EscolherRivais.tsx — UI-T07-01 (TASK.md Lote 11)
//
// T-07 · Escolher rivais (UX-SPEC §2/T-07, §4/T-07): até 2 rivais entre os
// outros 19 clubes da Série A (CA-09.1), adicionar até o limite (CA-09.2),
// impedir um 3º com aviso (CA-09.3), remover com confirmação de palpites
// descartados quando há simulação salva (CA-09.4). Sobreposição sem rota
// (ADR-003) — acionada a partir de T-08 Comparativo (UI-T08-01, Lote 11,
// tarefa paralela) é fora do escopo desta tarefa; aqui só o conteúdo/
// comportamento da própria sobreposição, com o mesmo contrato
// `aberta`/`aoFechar` já usado pelas demais (`SobreposicoesContext`).
//
// Time do coração nunca aparece na lista (CA-09.1): filtrado por `meuTimeId`
// lido de `Preferencias`. Catálogo local, mesmo mecanismo síncrono de
// `EscolherTime`/`PassoTime` (não `useClubesPublicos`, que tem estado de
// carregamento real — UX-SPEC §4/T-07: "Carregando: não se aplica").
//
// Confirmação de remoção (CA-09.4): o cenário salvo (`Cenario`, ADR-005
// regra 3) é escopado por `temporada:time:rivais-ordenados`, não por rival
// individual (`armazenamento/cenario.ts`) — não há como isolar "só os
// palpites daquele rival" sem dados de calendário (fora das dependências
// desta tarefa: DOM-05 não é dependência de UI-T07-01, só de UI-T09-01).
// Mesma decisão de arquitetura já aplicada por `EscolherTime`/CA-06.3:
// remover um rival que já estava confirmado, enquanto existe cenário salvo
// para o escopo atual, descarta o cenário inteiro ao confirmar. Pequeno
// desvio documentado (TASK.md §6): a confirmação em linha só aparece quando
// isso é de fato uma perda real (há cenário salvo) — desmarcar um rival
// recém-selecionado (nunca confirmado) ou um rival confirmado sem nenhuma
// simulação feita ainda não tem "palpites... apagados" reais para avisar.

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { AvatarClube, BannerAlerta } from '../../design-system/componentes';
import { Botao } from '../../design-system/componentes/Botao';
import { CampoBusca } from '../../design-system/componentes/CampoBusca';
import { Chip } from '../../design-system/componentes/Chip';
import { Sobreposicao } from '../../design-system/componentes/Sobreposicao';
import {
  construirCatalogoOnboarding,
  type CatalogoOnboarding,
} from '../paginas/Onboarding/catalogoOnboarding';
import { lerPreferencias, salvarPreferencias } from '../../armazenamento/preferencias';
import {
  construirEscopoCenario,
  lerCenario,
  limparCenario,
} from '../../armazenamento/cenario';
import estilos from './EscolherRivais.module.css';

/** Texto canônico de UX-SPEC §4/T-07, estado "Erro" (Diretriz de
 * Implementação #9 — copiado literalmente). */
export const TEXTO_ERRO_CATALOGO_ESCOLHER_RIVAIS =
  'Não conseguimos carregar a lista de clubes.';

/** Texto canônico de UX-SPEC §4/T-07 (CA-09.3), exibido só ao tentar um
 * 3º rival. */
export const TEXTO_LIMITE_ATINGIDO = 'Até 2 rivais; remova um para trocar.';

export interface PropriedadesEscolherRivais {
  readonly aberta: boolean;
  readonly aoFechar: () => void;
  /** Injeção de teste; padrão é `globalThis.localStorage`. */
  readonly armazenamento?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Injeção de teste (mesmo padrão de `EscolherTime`/`Home`). */
  readonly carregarCatalogo?: () => CatalogoOnboarding | null;
}

/** Remove acento/caixa para busca por nome tolerante (CA-09.1), mesmo
 * mecanismo de `EscolherTime`/`PassoTime` — também casa por sigla. */
function normalizarParaBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface EstadoDeAbertura {
  /** Id do time do coração — nunca aparece na lista (CA-09.1). `null` só no
   * caso defensivo de a sobreposição abrir sem time escolhido (não deveria
   * acontecer no fluxo real: T-07 só é alcançável a partir de T-08, que já
   * exige time — UX-SPEC §1.2). */
  readonly meuTimeId: string | null;
  /** Rivais já confirmados/persistidos ao abrir. */
  readonly rivaisConfirmados: readonly string[];
  /** `true` quando já existe um cenário de simulação salvo para o escopo
   * atual (temporada:time:rivais) — só nesse caso remover um rival
   * confirmado tem palpites reais a perder (CA-09.4). */
  readonly temCenarioSalvo: boolean;
}

const ESTADO_DE_ABERTURA_INICIAL: EstadoDeAbertura = {
  meuTimeId: null,
  rivaisConfirmados: [],
  temCenarioSalvo: false,
};

function calcularEstadoDeAbertura(
  catalogo: CatalogoOnboarding,
  armazenamento: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined,
): EstadoDeAbertura {
  const { preferencias } = lerPreferencias(
    catalogo.referencias,
    catalogo.temporadaAtual,
    armazenamento,
  );

  const { timeId, rivais } = preferencias;
  const temCenarioSalvo =
    timeId !== null &&
    lerCenario(
      construirEscopoCenario(catalogo.temporadaAtual, timeId, rivais),
      armazenamento,
    ).cenario !== null;

  return { meuTimeId: timeId, rivaisConfirmados: rivais, temCenarioSalvo };
}

/** T-07 — Escolher rivais. Sem rota (ADR-003). */
export function EscolherRivais({
  aberta,
  aoFechar,
  armazenamento,
  carregarCatalogo = construirCatalogoOnboarding,
}: PropriedadesEscolherRivais): ReactElement {
  // `tentativa` só existe para forçar nova leitura do catálogo a partir do
  // botão "Tentar de novo" do estado "Erro" (UX-SPEC §4/T-07).
  const [tentativa, setTentativa] = useState(0);
  const catalogo = useMemo(() => carregarCatalogo(), [carregarCatalogo, tentativa]);

  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<readonly string[]>([]);
  const [limiteAtingido, setLimiteAtingido] = useState(false);
  const [confirmandoRemocaoId, setConfirmandoRemocaoId] = useState<string | null>(null);
  const [estadoAbertura, setEstadoAbertura] = useState<EstadoDeAbertura>(
    ESTADO_DE_ABERTURA_INICIAL,
  );

  // Recalcula a cada abertura (não só na montagem) — mesma razão de
  // `EscolherTime`: a sobreposição pode ficar montada e as preferências
  // salvas podem ter mudado desde a última vez que foi aberta.
  useEffect(() => {
    if (!aberta || !catalogo) {
      return;
    }
    const proximo = calcularEstadoDeAbertura(catalogo, armazenamento);
    setEstadoAbertura(proximo);
    setSelecionados(proximo.rivaisConfirmados);
    setBusca('');
    setLimiteAtingido(false);
    setConfirmandoRemocaoId(null);
  }, [aberta, catalogo, armazenamento]);

  const clubesSemMeuTime = useMemo(() => {
    if (!catalogo) {
      return [];
    }
    return catalogo.clubes.filter((clube) => clube.id !== estadoAbertura.meuTimeId);
  }, [catalogo, estadoAbertura.meuTimeId]);

  const clubesFiltrados = useMemo(() => {
    const termo = normalizarParaBusca(busca.trim());
    if (!termo) {
      return clubesSemMeuTime;
    }
    return clubesSemMeuTime.filter(
      (clube) =>
        normalizarParaBusca(clube.nomeCurto).includes(termo) ||
        normalizarParaBusca(clube.sigla).includes(termo),
    );
  }, [busca, clubesSemMeuTime]);

  const termoBuscado = busca.trim();
  const semResultado = termoBuscado.length > 0 && clubesFiltrados.length === 0;

  function nomeDoClube(id: string): string {
    return clubesSemMeuTime.find((clube) => clube.id === id)?.nomeCurto ?? id;
  }

  function removerImediatamente(id: string): void {
    setSelecionados((atual) => atual.filter((rival) => rival !== id));
    setLimiteAtingido(false);
  }

  function aoAlternarClube(id: string): void {
    if (selecionados.includes(id)) {
      // CA-09.4: só pede confirmação quando remover de fato arrisca
      // descartar uma simulação salva (rival já confirmado antes de abrir
      // + cenário salvo existente para o escopo atual).
      const precisaConfirmar =
        estadoAbertura.rivaisConfirmados.includes(id) && estadoAbertura.temCenarioSalvo;
      if (precisaConfirmar) {
        setConfirmandoRemocaoId(id);
        return;
      }
      removerImediatamente(id);
      return;
    }

    if (selecionados.length >= 2) {
      setLimiteAtingido(true);
      return;
    }

    setSelecionados((atual) => [...atual, id]);
    setLimiteAtingido(false);
  }

  function aoConfirmarRemocao(): void {
    if (confirmandoRemocaoId !== null) {
      removerImediatamente(confirmandoRemocaoId);
    }
    setConfirmandoRemocaoId(null);
  }

  function aoCancelarRemocao(): void {
    setConfirmandoRemocaoId(null);
  }

  function aoConfirmarRivais(): void {
    if (!catalogo || estadoAbertura.meuTimeId === null) {
      return;
    }

    const atual = lerPreferencias(
      catalogo.referencias,
      catalogo.temporadaAtual,
      armazenamento,
    ).preferencias;

    salvarPreferencias(
      {
        ...atual,
        rivais: [...selecionados],
        atualizadoEm: new Date().toISOString(),
      },
      armazenamento,
    );

    // O escopo do cenário inclui os rivais (ADR-005 regra 3): só descarta o
    // cenário salvo quando o conjunto final de rivais realmente diverge do
    // conjunto confirmado ao abrir — desfazer uma remoção antes de
    // "CONFIRMAR RIVAIS" não perde nada.
    const escopoAnterior = construirEscopoCenario(
      catalogo.temporadaAtual,
      estadoAbertura.meuTimeId,
      estadoAbertura.rivaisConfirmados,
    );
    const escopoNovo = construirEscopoCenario(
      catalogo.temporadaAtual,
      estadoAbertura.meuTimeId,
      selecionados,
    );
    if (escopoAnterior !== escopoNovo && estadoAbertura.temCenarioSalvo) {
      limparCenario(armazenamento);
    }

    aoFechar();
  }

  const titulo = 'Escolher rivais';

  if (!catalogo) {
    return (
      <Sobreposicao titulo={titulo} aberta={aberta} aoFechar={aoFechar}>
        <BannerAlerta
          variante="erro"
          texto={TEXTO_ERRO_CATALOGO_ESCOLHER_RIVAIS}
          acao={{
            rotulo: 'Tentar de novo',
            aoClicar: () => {
              setTentativa((valor) => valor + 1);
            },
          }}
        />
      </Sobreposicao>
    );
  }

  const nomeMeuTime =
    catalogo.clubes.find((clube) => clube.id === estadoAbertura.meuTimeId)?.nomeCurto ??
    'seu time';

  return (
    <Sobreposicao
      titulo={titulo}
      aberta={aberta}
      aoFechar={aoFechar}
      barraDeAcao={
        <Botao
          variante="primario"
          className={estilos['botaoConfirmar'] ?? ''}
          onClick={aoConfirmarRivais}
        >
          Confirmar rivais
        </Botao>
      }
    >
      <div className={estilos['conteudo']}>
        {selecionados.length === 0 ? (
          <p className={estilos['subtitulo']}>
            {`Escolha até 2 clubes da Série A para comparar com o ${nomeMeuTime}.`}
          </p>
        ) : (
          <div className={estilos['selecionados']}>
            <span className={estilos['somenteLeitorDeTela']}>Rivais selecionados</span>
            <ul className={estilos['listaChips']}>
              {selecionados.map((id) => (
                <li key={id}>
                  <Chip
                    variante="removivel"
                    rotulo={nomeDoClube(id)}
                    rotuloRemover={`Remover ${nomeDoClube(id)}`}
                    aoRemover={() => {
                      aoAlternarClube(id);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {limiteAtingido ? (
          <BannerAlerta variante="alerta" texto={TEXTO_LIMITE_ATINGIDO} />
        ) : null}

        {confirmandoRemocaoId !== null ? (
          <BannerAlerta
            variante="alerta"
            texto={`Remover ${nomeDoClube(confirmandoRemocaoId)}? Os palpites dele na simulação serão apagados.`}
            acao={{ rotulo: 'Remover', aoClicar: aoConfirmarRemocao }}
          />
        ) : null}

        {confirmandoRemocaoId !== null ? (
          <Botao
            variante="terciario"
            className={estilos['botaoCancelarRemocao'] ?? ''}
            onClick={aoCancelarRemocao}
          >
            Cancelar
          </Botao>
        ) : null}

        <CampoBusca
          rotulo="Buscar clube"
          valor={busca}
          aoMudar={setBusca}
          placeholder="Buscar clube"
          semResultado={semResultado}
          mensagemSemResultado={`Nenhum clube encontrado para "${termoBuscado}".`}
        />

        <fieldset className={estilos['fieldset']}>
          <legend className={estilos['somenteLeitorDeTela']}>
            {`Clubes da Série A de ${String(catalogo.temporadaAtual)}, exceto ${nomeMeuTime}`}
          </legend>
          <ul className={estilos['lista']}>
            {clubesFiltrados.map((clube) => {
              const marcado = selecionados.includes(clube.id);
              return (
                <li key={clube.id}>
                  <label className={estilos['item']}>
                    <input
                      type="checkbox"
                      name="escolher-rivais"
                      value={clube.id}
                      checked={marcado}
                      onChange={() => {
                        aoAlternarClube(clube.id);
                      }}
                      className={estilos['checkbox']}
                    />
                    {/* Decorativo: o nome acessível já vem do texto visível
                     * ao lado (mesmo motivo documentado em `EscolherTime`/
                     * `PassoTime`). */}
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
    </Sobreposicao>
  );
}
