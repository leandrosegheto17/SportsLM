// app/rotas/sobreposicoes/EscolherTime.tsx — UI-T04-01 (TASK.md Lote 9)
//
// T-04 · Escolher/trocar time (UX-SPEC §2/T-04, §4/T-04): busca + 20 clubes
// (CA-06.1), aviso ao trocar (CA-06.3), banner de virada de temporada
// (CA-06.5/RN-12). Sobreposição sem rota (ADR-003), montada uma única vez por
// `SobreposicoesContext`/`ProvedorSobreposicoes` (UI-T02-04) e acionada hoje
// pelo convite "ESCOLHER MEU TIME" da Home sem time (`SecaoIdentidade`,
// FL-03: "T-04 quando não há time"); o botão "TROCAR TIME" do Painel do Time
// (T-05, Lote 9) é outro ponto de integração futuro, fora desta tarefa.
//
// Catálogo de clubes: reaproveita `construirCatalogoOnboarding`/
// `config/*.json` (mesmo mecanismo síncrono e local de UI-T01-02/`PassoTime`),
// não `useClubesPublicos` (que faz `fetch`). Decisão de implementação
// registrada (TASK.md §6, pequeno desvio documentado): o comentário de
// `app/dados/useClubesPublicos.ts` sugeria reaproveitar aquele hook aqui, mas
// UX-SPEC §4/T-04 é explícito — "Carregando: não se aplica — lista de
// configuração local" (mesmo texto de T-01) — e `useClubesPublicos` tem um
// estado de carregamento real (rede), o que contradiria a tabela de estados
// desta tela. Segui o UX-SPEC, que é a fonte de verdade sobre estados de tela.
//
// Trocar de time (CA-06.3): quando já existe um time confirmado e o torcedor
// seleciona um diferente, mostra o aviso inline e, ao confirmar, descarta
// rivais e cenário (`limparCenario`, `app/armazenamento/cenario.ts`, UI-DS-09).
//
// Virada de temporada (CA-06.5/RN-12): detectada via
// `lerPreferencias(...).timeForaDaTemporada` toda vez que a sobreposição abre
// — o time salvo já não pertence à Série A da temporada corrente. O banner
// usa o texto canônico da Seção 4 do UX-SPEC, interpolando o nome do time
// perdido e a temporada nova; favoritos e fontes bloqueadas continuam
// intactos (RN-12) porque `lerPreferencias` só zera `timeId`/`rivais` nesse
// caso, nunca os outros campos. Nome do time perdido: como ele não está mais
// no catálogo da temporada corrente, não existe hoje nenhuma outra fonte de
// nome para esse id (decisão registrada, pequeno desvio documentado — não há
// diretório de clubes fora de temporada nesta arquitetura) — o fallback é um
// título derivado do próprio id salvo (slug), ex. "cruzeiro" -> "Cruzeiro".
// A limpeza efetiva de `timeId`/`rivais`/cenário só é persistida quando o
// torcedor confirma o novo time (não há "Pular" nesta tela, ao contrário do
// onboarding) — até lá, a leitura em memória já esconde o time/rivais
// inválidos em qualquer outra tela que releia as preferências.

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarClube, BannerAlerta } from '../../design-system/componentes';
import { Botao } from '../../design-system/componentes/Botao';
import { CampoBusca } from '../../design-system/componentes/CampoBusca';
import { Sobreposicao } from '../../design-system/componentes/Sobreposicao';
import {
  construirCatalogoOnboarding,
  type CatalogoOnboarding,
} from '../paginas/Onboarding/catalogoOnboarding';
import {
  CHAVE_ARMAZENAMENTO_PREFERENCIAS,
  lerPreferencias,
  salvarPreferencias,
} from '../../armazenamento/preferencias';
import { lerBrutoSemLancar } from '../../armazenamento/nucleo';
import { limparCenario } from '../../armazenamento/cenario';
import { preferenciasSchema } from '../../../dominio/tipos';
import estilos from './EscolherTime.module.css';

/** Texto canônico de UX-SPEC §4/T-04, estado "Erro" (Diretriz de
 * Implementação #9 — copiado literalmente). */
export const TEXTO_ERRO_CATALOGO_ESCOLHER_TIME =
  'Não conseguimos carregar a lista de clubes de 2026.';

/** Texto canônico de UX-SPEC §4/T-04 (CA-06.3), exibido só ao trocar. */
export const TEXTO_AVISO_TROCA =
  'Trocar de time redefine seus rivais e apaga a simulação salva.';

export interface PropriedadesEscolherTime {
  readonly aberta: boolean;
  readonly aoFechar: () => void;
  /** Injeção de teste; padrão é `globalThis.localStorage`. */
  readonly armazenamento?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Injeção de teste (mesmo padrão de `Onboarding`/`Home`). */
  readonly carregarCatalogo?: () => CatalogoOnboarding | null;
}

/** Remove acento/caixa para busca por nome tolerante (CA-06.1), igual a
 * `PassoTime` (UI-T01-02) — também casa por sigla. */
function normalizarParaBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Nome de exibição de melhor esforço para um clube fora do catálogo da
 * temporada corrente (CA-06.5) — ver nota de decisão no topo do arquivo. */
function formatarNomeDeIdClube(id: string): string {
  return id
    .split('-')
    .filter((parte) => parte.length > 0)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

/** Lê o `timeId` bruto salvo, sem cruzar contra o catálogo corrente (mesmo
 * mecanismo de `SecaoIdentidade#lerTimeIdSalvo`) — usado só para nomear o
 * time perdido no banner de virada de temporada (CA-06.5), já que
 * `lerPreferencias` já devolve esse campo nulo quando fora da temporada. */
function lerTimeIdBruto(
  armazenamento: Pick<Storage, 'getItem'> | undefined,
): string | null {
  const bruto = lerBrutoSemLancar(CHAVE_ARMAZENAMENTO_PREFERENCIAS, armazenamento);
  if (bruto === null) {
    return null;
  }

  try {
    const analisado: unknown = JSON.parse(bruto);
    const resultado = preferenciasSchema.safeParse(analisado);
    return resultado.success ? resultado.data.timeId : null;
  } catch {
    return null;
  }
}

interface EstadoDeAbertura {
  /** Time já confirmado ao abrir a sobreposição (`null` em primeira escolha
   * ou virada de temporada) — usado para decidir o aviso de CA-06.3. */
  readonly timeConfirmadoId: string | null;
  /** Nome de melhor esforço do time perdido (CA-06.5), `null` fora da virada
   * de temporada. */
  readonly nomeTimePerdido: string | null;
}

function calcularEstadoDeAbertura(
  catalogo: CatalogoOnboarding,
  armazenamento: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined,
): EstadoDeAbertura {
  const resultado = lerPreferencias(
    catalogo.referencias,
    catalogo.temporadaAtual,
    armazenamento,
  );

  if (!resultado.timeForaDaTemporada) {
    return { timeConfirmadoId: resultado.preferencias.timeId, nomeTimePerdido: null };
  }

  const idAnterior = lerTimeIdBruto(armazenamento);
  return {
    timeConfirmadoId: null,
    nomeTimePerdido: idAnterior !== null ? formatarNomeDeIdClube(idAnterior) : null,
  };
}

const ESTADO_DE_ABERTURA_INICIAL: EstadoDeAbertura = {
  timeConfirmadoId: null,
  nomeTimePerdido: null,
};

/** T-04 — Escolher/trocar time (+ virada de temporada). Sem rota (ADR-003). */
export function EscolherTime({
  aberta,
  aoFechar,
  armazenamento,
  carregarCatalogo = construirCatalogoOnboarding,
}: PropriedadesEscolherTime): ReactElement {
  const navegar = useNavigate();
  // `tentativa` só existe para forçar nova leitura do catálogo a partir do
  // botão "Tentar de novo" do estado "Erro" (UX-SPEC §4/T-04).
  const [tentativa, setTentativa] = useState(0);
  const catalogo = useMemo(() => carregarCatalogo(), [carregarCatalogo, tentativa]);

  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [estadoAbertura, setEstadoAbertura] = useState<EstadoDeAbertura>(
    ESTADO_DE_ABERTURA_INICIAL,
  );

  // Recalcula a cada abertura (não só na montagem): a sobreposição fica
  // montada o tempo todo em `ProvedorSobreposicoes`, então as preferências
  // salvas podem ter mudado (onboarding, outra aba) desde a última vez que
  // foi aberta.
  useEffect(() => {
    if (!aberta || !catalogo) {
      return;
    }
    const proximo = calcularEstadoDeAbertura(catalogo, armazenamento);
    setEstadoAbertura(proximo);
    setSelecionado(proximo.timeConfirmadoId);
    setBusca('');
  }, [aberta, catalogo, armazenamento]);

  const clubesFiltrados = useMemo(() => {
    if (!catalogo) {
      return [];
    }
    const termo = normalizarParaBusca(busca.trim());
    if (!termo) {
      return catalogo.clubes;
    }
    return catalogo.clubes.filter(
      (clube) =>
        normalizarParaBusca(clube.nomeCurto).includes(termo) ||
        normalizarParaBusca(clube.sigla).includes(termo),
    );
  }, [busca, catalogo]);

  const termoBuscado = busca.trim();
  const semResultado = termoBuscado.length > 0 && clubesFiltrados.length === 0;

  const trocando =
    estadoAbertura.timeConfirmadoId !== null &&
    selecionado !== null &&
    selecionado !== estadoAbertura.timeConfirmadoId;

  function aoConfirmar(): void {
    if (!catalogo || !selecionado) {
      return;
    }

    const atual = lerPreferencias(
      catalogo.referencias,
      catalogo.temporadaAtual,
      armazenamento,
    ).preferencias;

    // CA-06.3 (trocar) e CA-06.5 (virada) descartam rivais/cenário da mesma
    // forma — a única diferença entre os dois é o aviso mostrado antes de
    // confirmar; RN-12 mantém favoritos/fontes bloqueadas nos dois casos
    // (nem tocados aqui, `...atual` preserva).
    const descartaRivaisECenario = trocando || estadoAbertura.nomeTimePerdido !== null;

    salvarPreferencias(
      {
        ...atual,
        timeId: selecionado,
        rivais: descartaRivaisECenario ? [] : atual.rivais,
        atualizadoEm: new Date().toISOString(),
      },
      armazenamento,
    );

    if (descartaRivaisECenario) {
      limparCenario(armazenamento);
    }

    aoFechar();
    navegar('/time');
  }

  const titulo = 'Escolher time';

  if (!catalogo) {
    return (
      <Sobreposicao titulo={titulo} aberta={aberta} aoFechar={aoFechar}>
        <BannerAlerta
          variante="erro"
          texto={TEXTO_ERRO_CATALOGO_ESCOLHER_TIME}
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

  return (
    <Sobreposicao
      titulo={titulo}
      aberta={aberta}
      aoFechar={aoFechar}
      barraDeAcao={
        <Botao
          variante="primario"
          className={estilos['botaoConfirmar'] ?? ''}
          onClick={aoConfirmar}
          disabled={selecionado === null}
        >
          {estadoAbertura.timeConfirmadoId !== null ? 'Confirmar troca' : 'Confirmar'}
        </Botao>
      }
    >
      <div className={estilos['conteudo']}>
        <p className={estilos['subtitulo']}>
          {`Clubes da Série A de ${String(catalogo.temporadaAtual)}.`}
        </p>

        {estadoAbertura.nomeTimePerdido !== null ? (
          <BannerAlerta
            variante="alerta"
            texto={`${estadoAbertura.nomeTimePerdido} não está na Série A de ${String(catalogo.temporadaAtual)}; escolha um novo time para continuar. Seus esportes favoritos e fontes bloqueadas foram mantidos.`}
          />
        ) : null}

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
            {`Times da Série A de ${String(catalogo.temporadaAtual)}`}
          </legend>
          <ul className={estilos['lista']}>
            {clubesFiltrados.map((clube) => {
              const marcado = clube.id === selecionado;
              return (
                <li key={clube.id}>
                  <label className={estilos['item']}>
                    <input
                      type="radio"
                      name="escolher-time"
                      value={clube.id}
                      checked={marcado}
                      onChange={() => {
                        setSelecionado(clube.id);
                      }}
                      className={estilos['radio']}
                    />
                    {/* Decorativo: o nome acessível já vem do texto visível
                     * ao lado (mesmo motivo documentado em `PassoTime`). */}
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

        {trocando ? <BannerAlerta variante="alerta" texto={TEXTO_AVISO_TROCA} /> : null}
      </div>
    </Sobreposicao>
  );
}
