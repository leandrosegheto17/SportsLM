// app/rotas/paginas/Onboarding.tsx — UI-T01-01/UI-T01-02 (TASK.md Lote 8)
//
// T-01 · Onboarding, os 2 passos (UX-SPEC §2/§4): passo 1 (favoritos,
// UI-T01-01) e passo 2 (time do coração + transição, UI-T01-02). Nunca muda
// de URL entre os passos (ADR-003: onboarding é uma única rota de 2 passos)
// — o passo corrente é estado interno deste componente.
//
// CA-14.5/RNF-04 ("chegar à home em no máximo 2 confirmações"): o fluxo
// inteiro tem só 2 ações possíveis de avanço — "Continuar"/"Pular" do passo 1
// e "Confirmar"/"Pular" do passo 2 — nunca mais que isso para chegar à home.
//
// CA-14.4 ("abandona após o passo 1 [...] retomar do passo 2 no retorno"):
// como `favoritos` pode legitimamente ficar vazio (0 esportes é uma escolha
// válida, CA-14.2), a marca de "já passou pelo passo 1" não pode depender do
// conteúdo de `favoritos` — depende de *existir* um registro em
// `sportslm.preferencias.v1` (ADR-005). Por isso `aoConcluirPasso1` grava
// explicitamente as preferências (mesmo sem alteração) antes de avançar: só
// assim um retorno a `/onboarding` sem ter escolhido time consegue distinguir
// "nunca abriu o onboarding" de "já passou do passo 1".
//
// Estado "Erro" (UX-SPEC §4/T-01): falha ao validar a configuração necessária
// (esportes/clubes/fontes/temporada, `catalogoOnboarding.ts`) — sem catálogo
// não há passo 2 possível, então "Continuar sem escolher" vai direto à home.

import { useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EsporteId } from '../../../dominio/tipos/esportes';
import type { Preferencias } from '../../../dominio/tipos/estado-local';
import { BannerAlerta } from '../../design-system/componentes';
import { FaixaClube, type ClubeParaFaixa } from '../../design-system/FaixaClube';
import {
  CHAVE_ARMAZENAMENTO_PREFERENCIAS,
  lerPreferencias,
  salvarPreferencias,
} from '../../armazenamento/preferencias';
import { lerBrutoSemLancar } from '../../armazenamento/nucleo';
import {
  useClubesPublicos,
  type OpcoesUseClubesPublicos,
} from '../../dados/useClubesPublicos';
import { useTituloDocumento } from '../useTituloDocumento';
import {
  construirCatalogoOnboarding,
  type CatalogoOnboarding,
} from './Onboarding/catalogoOnboarding';
import { PassoFavoritos } from './Onboarding/PassoFavoritos';
import { PassoTime } from './Onboarding/PassoTime';
import estilos from './Onboarding/Onboarding.module.css';

/** Texto canônico de UX-SPEC §4/T-01, estado "Erro" — copiado literalmente
 * (Diretriz de Implementação #9). */
export const TEXTO_ERRO_CATALOGO_ONBOARDING =
  'Não conseguimos carregar a lista de clubes agora. Você pode continuar e escolher seu time depois.';

/** Duração da transição para a faixa do clube (UX-SPEC §2/T-01 passo 2:
 * "150 ms, desligada sob prefers-reduced-motion") — mesmo valor de
 * `--duracao-transicao` em `tokens.css`, mantido em JS só para o atraso da
 * navegação (o crossfade em si é 100% CSS, já zerado sob
 * `prefers-reduced-motion: reduce` pelo próprio token). */
const DURACAO_TRANSICAO_MS = 150;

export interface PropriedadesOnboarding {
  /** Injeção para teste (mesmo padrão de `ClienteSnapshot`/`app/tema/tema.ts`):
   * permite forçar o estado "Erro" sem precisar quebrar a configuração real. */
  readonly carregarCatalogo?: () => CatalogoOnboarding | null;
  /** Injeção de teste para a checagem de `prefers-reduced-motion` (mesmo
   * padrão de `app/tema/usarTema.ts`). */
  readonly prefereMovimentoReduzido?: () => boolean;
  /** Injeção de teste para `useClubesPublicos` (mesmo padrão de
   * `SecaoIdentidade`, UI-T02-01). */
  readonly opcoesClubesPublicos?: OpcoesUseClubesPublicos;
}

function prefereMovimentoReduzidoPadrao(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface EstadoInicialOnboarding {
  readonly favoritos: readonly EsporteId[];
  readonly timeId: string | null;
  /** CA-14.4: `2` quando já existe registro persistido sem time escolhido
   * (abandonou depois do passo 1); `1` caso contrário. */
  readonly passo: 1 | 2;
}

function calcularEstadoInicial(
  catalogo: CatalogoOnboarding | null,
): EstadoInicialOnboarding {
  if (!catalogo) {
    return { favoritos: [], timeId: null, passo: 1 };
  }

  const resultado = lerPreferencias(catalogo.referencias, catalogo.temporadaAtual);
  const registroExiste = lerBrutoSemLancar(CHAVE_ARMAZENAMENTO_PREFERENCIAS) !== null;
  const passo: 1 | 2 = registroExiste && resultado.preferencias.timeId === null ? 2 : 1;

  return {
    favoritos: resultado.preferencias.favoritos,
    timeId: resultado.preferencias.timeId,
    passo,
  };
}

export function Onboarding({
  carregarCatalogo = construirCatalogoOnboarding,
  prefereMovimentoReduzido = prefereMovimentoReduzidoPadrao,
  opcoesClubesPublicos,
}: PropriedadesOnboarding = {}): ReactElement {
  useTituloDocumento('Onboarding');
  const navegar = useNavigate();

  const catalogo = useMemo(() => carregarCatalogo(), [carregarCatalogo]);
  const estadoInicial = useMemo(() => calcularEstadoInicial(catalogo), [catalogo]);

  const [favoritos, setFavoritos] = useState<readonly EsporteId[]>(
    estadoInicial.favoritos,
  );
  const [timeId, setTimeId] = useState<string | null>(estadoInicial.timeId);
  const [passo, setPasso] = useState<1 | 2>(estadoInicial.passo);
  const [clubeEmTransicao, setClubeEmTransicao] = useState<ClubeParaFaixa | null>(null);

  // Paleta derivada e validada por contraste (ADR-017) só existe em
  // `/dados/config/clubes-2026.json` publicado — prefetch iniciado já no
  // mount (independente do passo) para maximizar a chance de já estar pronta
  // quando o torcedor confirmar o time (UI-T02-01 já criou este hook; ver
  // nota de decisão sobre paleta indisponível em `iniciarTransicaoEConcluir`).
  const clubesPublicos = useClubesPublicos(opcoesClubesPublicos);

  function persistir(atualizacoes: Partial<Preferencias>): void {
    if (!catalogo) {
      return;
    }
    const atual = lerPreferencias(
      catalogo.referencias,
      catalogo.temporadaAtual,
    ).preferencias;
    salvarPreferencias({
      ...atual,
      ...atualizacoes,
      atualizadoEm: new Date().toISOString(),
    });
  }

  function persistirFavoritos(proximo: readonly EsporteId[]): void {
    setFavoritos(proximo);
    // CA-03.2: persiste imediatamente a cada marcação/desmarcação (UI-DS-09).
    persistir({ favoritos: [...proximo] });
  }

  function aoAlternarEsporte(esporte: EsporteId): void {
    const proximo = favoritos.includes(esporte)
      ? favoritos.filter((favorito) => favorito !== esporte)
      : [...favoritos, esporte];
    persistirFavoritos(proximo);
  }

  function aoConcluirComErro(): void {
    navegar('/');
  }

  function aoConcluirPasso1(): void {
    // Grava explicitamente (mesmo sem alteração de favoritos) para que
    // CA-14.4 consiga distinguir "abandonou depois do passo 1" de "nunca
    // abriu o onboarding" num retorno futuro a esta rota.
    persistir({ favoritos: [...favoritos] });
    setPasso(2);
  }

  function aoVoltarPasso1(): void {
    setPasso(1);
  }

  function aoSelecionarTime(clubeId: string): void {
    setTimeId(clubeId);
  }

  /**
   * CA-06.2/CA-14.3: confirma ou pula o passo 2 — os dois concluem o
   * onboarding. Nunca bloqueia a navegação esperando a rede: se a paleta
   * derivada (ADR-017) ainda não chegou, ou o torcedor prefere movimento
   * reduzido, ou ele pulou (sem time), vai direto para a home sem a
   * transição visual de 150 ms — decisão de detalhe registrada (pequeno
   * desvio, não bloqueio): RNF-04/RNF-05 pedem que a conclusão do onboarding
   * nunca dependa de uma chamada de rede síncrona.
   */
  function iniciarTransicaoEConcluir(clubeIdConfirmado: string | null): void {
    if (clubeIdConfirmado) {
      persistir({ timeId: clubeIdConfirmado });
    }

    const clubePublico = clubeIdConfirmado
      ? clubesPublicos.clubes?.find((clube) => clube.id === clubeIdConfirmado)
      : undefined;

    if (!clubePublico || prefereMovimentoReduzido()) {
      navegar('/');
      return;
    }

    setClubeEmTransicao({
      nome: clubePublico.nomeCurto,
      sigla: clubePublico.sigla,
      paleta: clubePublico.paleta,
    });

    window.setTimeout(() => {
      navegar('/');
    }, DURACAO_TRANSICAO_MS);
  }

  function aoConfirmarTime(): void {
    if (!timeId) {
      return;
    }
    iniciarTransicaoEConcluir(timeId);
  }

  function aoPularPasso2(): void {
    iniciarTransicaoEConcluir(null);
  }

  if (!catalogo) {
    return (
      <div className={estilos['tela']}>
        <FaixaClube variante="neutra" />
        <div className={estilos['conteudoErro']}>
          <BannerAlerta
            variante="erro"
            texto={TEXTO_ERRO_CATALOGO_ONBOARDING}
            acao={{ rotulo: 'Continuar sem escolher', aoClicar: aoConcluirComErro }}
          />
        </div>
      </div>
    );
  }

  if (clubeEmTransicao) {
    return (
      <div className={estilos['tela']}>
        <FaixaClube
          variante="completa"
          clube={clubeEmTransicao}
          className={estilos['transicao'] ?? ''}
        />
      </div>
    );
  }

  if (passo === 2) {
    return (
      <PassoTime
        clubes={catalogo.clubes}
        timeSelecionado={timeId}
        aoSelecionar={aoSelecionarTime}
        aoConfirmar={aoConfirmarTime}
        aoPular={aoPularPasso2}
        aoVoltar={aoVoltarPasso1}
      />
    );
  }

  return (
    <PassoFavoritos
      esportes={catalogo.esportes}
      favoritos={favoritos}
      aoAlternar={aoAlternarEsporte}
      aoContinuar={aoConcluirPasso1}
      aoPular={aoConcluirPasso1}
    />
  );
}
