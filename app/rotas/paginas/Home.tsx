// app/rotas/paginas/Home.tsx — UI-T02-04 (TASK.md Lote 8)
//
// T-02 · Home (UX-SPEC §2): compõe as seções da Home (`SecaoIdentidade`/
// UI-T02-01 e `SecaoNoticias`) na ordem do wireframe mobile ("faixa do
// clube → PRÓXIMO JOGO/A BRIGA → NOTÍCIAS", UX-SPEC §2/T-02) e substitui o
// placeholder da rota `/` (FUND-04).
//
// Otimização mobile (2026-09-09, a pedido do usuário): `SecaoSeusEsportes`
// (UI-T02-02) e `SecaoUltimasNoticias` (UI-T02-03) — antes duas seções
// paralelas do Lote 8, cada uma com seu próprio cabeçalho/carimbo/lista —
// foram fundidas em `SecaoNoticias`, um único feed filtrável por chip, para
// reduzir a altura que a Home ocupa antes da primeira notícia no mobile. Ver
// nota de topo de `Home/SecaoNoticias.tsx` para o racional completo e
// `.md/PRD-TECNICO.md` (RF-04/RF-05/RF-19) / `.md/UX-SPEC.md` §2/T-02 para
// os requisitos reconciliados.
//
// Os estados da Seção 4/T-02 já são cobertos, de forma decomposta, por cada
// seção individualmente (cada uma busca seu próprio dado e resolve seu
// próprio carregando/erro/vazio/preenchido — arquitetura sem um estado
// global único de tela): esta tarefa integra, não duplica, esse tratamento.
// Esta página só precisa fornecer os dados que dependem do catálogo de
// configuração (`favoritos`/`fontesBloqueadas` de `Preferencias`, nomes de
// exibição de esporte/fonte) e os pontos de integração de navegação
// (sobreposições T-03/T-04, `Navegacao`/`Layout`).
//
// Decisão de implementação registrada (achado de UI-T02-01, TASK.md §6 —
// resolvendo a divergência sinalizada entre instâncias paralelas do Lote 8):
// para o catálogo de esportes/fontes (nomes de exibição, sem paleta) esta
// tarefa reaproveita `construirCatalogoOnboarding`/`config/*.json` — o mesmo
// mecanismo síncrono e local já usado por `UI-T01-01`/Onboarding (a
// exigência de UX-SPEC §4/T-01 "vêm de configuração já presente no
// carregamento inicial" vale igualmente para a Home, UX-SPEC §4/T-02:
// "vem de configuração local, não espera rede"). Já a identidade/paleta do
// clube (`FaixaClube`, dentro de `SecaoIdentidade`) segue exclusivamente o
// padrão de UI-T02-01 (`/dados/config/clubes-2026.json` publicado, com
// paleta derivada — ADR-017: "SPA nunca calcula a paleta"), nunca a
// importação estática de `config/clubes-2026.json` (que não tem paleta).
// Repare que os DOIS lados dessa divergência continuam em uso — cada um
// resolve um dado diferente do mesmo arquivo de configuração de temporada
// (ids/nomes vs. identidade visual derivada) — não é uma contradição, é a
// fronteira certa: qualquer dado que dependa da paleta (ADR-017) busca o
// artefato publicado; qualquer dado que seja só id/nome/ordem usa o bundle
// estático já presente no carregamento inicial, sem round-trip de rede.
//
// REFAT-08-01/REFAT-10-01: a partir de 1024px, `Home.module.css` vira grade
// de 2 colunas — mas, diferente da primeira versão de REFAT-08-01, a faixa
// do clube (`FaixaClubeDoTime`, extraída de dentro de `SecaoIdentidade`) fica
// FORA da grade de colunas, numa linha própria (`estilos['faixaTopo']`) que
// ocupa a largura cheia das duas colunas somadas — apertar a faixa nos 336px
// da coluna fixa cortava praticamente todo o conteúdo dela (nome/posição/
// pontos), degradando a experiência (achado do usuário, 2026-09-07). Abaixo
// da faixa: coluna fixa de 336px com o restante de `SecaoIdentidade`
// (próximo-jogo+a-briga, `ocultarFaixaClube`) + feed largo de 748px com
// `SecaoSeusEsportes`/`SecaoUltimasNoticias` empilhadas (`estilos['feed']`).
// Abaixo de 1024px, mantém a coluna única centrada num contêiner de
// `--largura-container` (mesma largura de UX-SPEC §3.6) — a faixa continua
// sendo o primeiro elemento visual, agora renderizada por um componente
// próprio em vez de nascer dentro de `SecaoIdentidade`. A ordem de conteúdo
// e os 4 estados de cada seção não mudam — só o container/grade ao redor.

import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactElement,
} from 'react';
import { z } from 'zod';
import fontesJson from '../../../config/fontes.json';
import { useTituloDocumento } from '../useTituloDocumento';
import { useSobreposicoes } from '../SobreposicoesContext';
import {
  assinarMudancasPreferencias,
  lerPreferencias,
  obterVersaoPreferencias,
} from '../../armazenamento/preferencias';
import type { ClienteSnapshot } from '../../dados/clienteSnapshot';
import {
  useClubesPublicos,
  type OpcoesUseClubesPublicos,
} from '../../dados/useClubesPublicos';
import {
  construirCatalogoOnboarding,
  type CatalogoOnboarding,
} from './Onboarding/catalogoOnboarding';
import { FaixaClubeDoTime } from './Home/FaixaClubeDoTime';
import { SecaoIdentidade } from './Home/SecaoIdentidade';
import { SecaoNoticias } from './Home/SecaoNoticias';
import estilos from './Home.module.css';

/** `config/fontes.json` (CFG-02) — só o subconjunto usado nesta tela (nome
 * de exibição + se é a fonte fixa, para CA-02.4: "quantas fontes
 * bloqueáveis existem no catálogo"). Mesmo padrão de validação leve de
 * `catalogoOnboarding.ts` (não importa o schema completo de `pipeline/config/fontes.ts`,
 * que faz I/O de Node). */
const fonteComNomeSchema = z
  .object({ id: z.string().min(1), nome: z.string().min(1), fixa: z.boolean() })
  .passthrough();
const fontesComNomeSchema = z.array(fonteComNomeSchema);

interface CatalogoDeFontesParaExibicao {
  readonly nomesFontes: Readonly<Record<string, string>>;
  /** Quantidade de fontes bloqueáveis no catálogo (todas exceto a fixa,
   * RN-03) — usado por CA-02.4 ("Você bloqueou N fontes"). */
  readonly totalFontesBloqueaveis: number;
}

/** Nunca lança: falha de validação vira catálogo vazio (nomes caem para o
 * próprio id, `totalFontesBloqueaveis` vira 0 — CA-02.4 simplesmente não
 * aciona, degradação segura, Diretriz de Implementação #6). */
function construirCatalogoDeFontes(bruto: unknown): CatalogoDeFontesParaExibicao {
  const resultado = fontesComNomeSchema.safeParse(bruto);
  if (!resultado.success) {
    console.warn(
      'SportsLM: falha ao validar "config/fontes.json" para a Home (T-02).',
      resultado.error.issues,
    );
    return { nomesFontes: {}, totalFontesBloqueaveis: 0 };
  }

  const nomesFontes: Record<string, string> = {};
  let totalFontesBloqueaveis = 0;
  for (const fonte of resultado.data) {
    nomesFontes[fonte.id] = fonte.nome;
    if (!fonte.fixa) {
      totalFontesBloqueaveis += 1;
    }
  }
  return { nomesFontes, totalFontesBloqueaveis };
}

export interface PropriedadesHome {
  /** Injeção de teste (mesmo padrão de `SecaoIdentidade`/UI-T02-01): permite
   * validar a composição inteira sem depender de `localStorage`/`fetch`
   * globais. */
  readonly armazenamento?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  readonly opcoesClubesPublicos?: OpcoesUseClubesPublicos;
  readonly clienteSnapshot?: ClienteSnapshot;
  /** Injeção de teste para o catálogo de esportes/temporada (mesmo padrão de
   * `Onboarding`); padrão é a configuração real da temporada (bundle). */
  readonly carregarCatalogo?: () => CatalogoOnboarding | null;
  /** Injeção de teste para `config/fontes.json`. */
  readonly fontesBrutas?: unknown;
}

/** T-02 — Home (faixa do clube, blocos do time, feed). Rota: `/`. */
export function Home({
  armazenamento,
  opcoesClubesPublicos,
  clienteSnapshot,
  carregarCatalogo = construirCatalogoOnboarding,
  fontesBrutas = fontesJson,
}: PropriedadesHome = {}): ReactElement {
  useTituloDocumento('Início');
  const { abrirConfiguracoes, abrirEscolherTime } = useSobreposicoes();

  const catalogo = useMemo(() => carregarCatalogo(), [carregarCatalogo]);
  const { nomesFontes, totalFontesBloqueaveis } = useMemo(
    () => construirCatalogoDeFontes(fontesBrutas),
    [fontesBrutas],
  );

  const nomesEsportes = useMemo(() => {
    if (!catalogo) {
      return {};
    }
    return Object.fromEntries(
      catalogo.esportes.map((esporte) => [esporte.id, esporte.nome]),
    );
  }, [catalogo]);

  // REFAT-09-01: `Configuracoes`/`EscolherTime` convivem montadas com a Home
  // por baixo (`ProvedorSobreposicoes`, sobreposição sem rota) — uma
  // alteração salva por elas (`salvarPreferencias`) precisa refletir aqui
  // sem remontagem real (CA-02.1: "sem recarregar a página"). `versao` não
  // tem significado próprio: só força o `useMemo` abaixo a recalcular
  // sempre que qualquer chamador de `salvarPreferencias` notificar
  // (`useSyncExternalStore`, API nativa do React — nenhuma biblioteca de
  // estado global nova, Diretriz de Implementação #3).
  const versaoPreferencias = useSyncExternalStore(
    assinarMudancasPreferencias,
    obterVersaoPreferencias,
    obterVersaoPreferencias,
  );

  // Degradação segura quando a configuração local não valida (mesmo caso já
  // tratado por Onboarding/UI-T01-01: hoje só defensivo, coberto por
  // `config/*.test.ts`) — a Home segue de pé com zero favoritos/zero
  // bloqueios em vez de travar a tela inteira por causa de um dado que nem
  // é o dela (RF-04/RF-19, "Últimas notícias", não dependem de favoritos).
  //
  // REFAT-09-02: reaproveita esta mesma leitura (já feita para
  // favoritos/fontesBloqueadas) para capturar `timeForaDaTemporada`
  // (RN-12/CA-06.5) — em vez de uma segunda chamada a `lerPreferencias`, só
  // para não duplicar a validação contra o catálogo corrente.
  const resultadoLeituraPreferencias = useMemo(() => {
    if (!catalogo) {
      return {
        preferencias: { favoritos: [], fontesBloqueadas: [] },
        timeForaDaTemporada: false,
      };
    }
    return lerPreferencias(catalogo.referencias, catalogo.temporadaAtual, armazenamento);
    // `versaoPreferencias` entra só como gatilho de recálculo (REFAT-09-01),
    // não é lido no corpo — mas precisa estar nas deps para o `useMemo`
    // invalidar o cache a cada notificação de `salvarPreferencias`.
  }, [catalogo, armazenamento, versaoPreferencias]);
  const preferencias = resultadoLeituraPreferencias.preferencias;

  // REFAT-10-02 (a pedido do usuário): nome de exibição do time do
  // torcedor, para a aba "MEU TIME" de `SecaoSeusEsportes` — reaproveita
  // `useClubesPublicos` (mesmo cache module-level de `FaixaClubeDoTime`/
  // `SecaoIdentidade`, sem 2ª requisição real) só para resolver
  // `timeId` → `nomeCurto`.
  const { clubes } = useClubesPublicos(opcoesClubesPublicos);
  const timeId = 'timeId' in preferencias ? preferencias.timeId : null;
  const nomeTime = useMemo(() => {
    if (timeId === null || !clubes) {
      return null;
    }
    return clubes.find((clube) => clube.id === timeId)?.nomeCurto ?? null;
  }, [clubes, timeId]);

  // REFAT-09-02 (FL-01: "ramo de virada de temporada em T-04"): quando o
  // torcedor retorna com o time salvo fora da lista de clubes da temporada
  // corrente (RN-12), `EscolherTime` (T-04) já trata corretamente o banner
  // de CA-06.5 sempre que é aberta (UI-T04-01) — mas nada abria a
  // sobreposição sozinha até agora, só o clique manual em "ESCOLHER MEU
  // TIME"/"Trocar". A referência (`useRef`) garante que a abertura
  // automática dispara uma única vez por sessão de montagem da `Home`: se o
  // torcedor fechar a sobreposição sem escolher um novo time, não insistimos
  // reabrindo a cada notificação de `salvarPreferencias` (ex.: bloquear uma
  // fonte em Configurações, que não tem relação com o time).
  const jaAbriuEscolherTimeAutomaticamenteRef = useRef(false);
  useEffect(() => {
    if (jaAbriuEscolherTimeAutomaticamenteRef.current) {
      return;
    }
    if (resultadoLeituraPreferencias.timeForaDaTemporada) {
      jaAbriuEscolherTimeAutomaticamenteRef.current = true;
      abrirEscolherTime();
    }
  }, [resultadoLeituraPreferencias.timeForaDaTemporada, abrirEscolherTime]);

  return (
    <div className={estilos['pagina']}>
      <div className={estilos['faixaTopo']}>
        <FaixaClubeDoTime
          {...(armazenamento ? { armazenamento } : {})}
          {...(opcoesClubesPublicos ? { opcoesClubesPublicos } : {})}
          {...(clienteSnapshot ? { clienteSnapshot } : {})}
        />
      </div>

      <div className={estilos['blocoIdentidade']}>
        <SecaoIdentidade
          {...(armazenamento ? { armazenamento } : {})}
          {...(opcoesClubesPublicos ? { opcoesClubesPublicos } : {})}
          {...(clienteSnapshot ? { clienteSnapshot } : {})}
          aoEscolherTime={abrirEscolherTime}
          ocultarFaixaClube
        />
      </div>

      <div className={estilos['feed']}>
        <SecaoNoticias
          favoritos={preferencias.favoritos}
          nomesEsportes={nomesEsportes}
          fontesBloqueadas={preferencias.fontesBloqueadas}
          nomesFontes={nomesFontes}
          totalFontesBloqueaveis={totalFontesBloqueaveis}
          aoEscolherEsportes={abrirConfiguracoes}
          nomeTime={nomeTime}
          {...(clienteSnapshot ? { cliente: clienteSnapshot } : {})}
        />
      </div>
    </div>
  );
}
