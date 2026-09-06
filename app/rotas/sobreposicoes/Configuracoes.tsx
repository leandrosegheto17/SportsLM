// app/rotas/sobreposicoes/Configuracoes.tsx — UI-T03-01/UI-T03-02
// (TASK.md Lote 9)
//
// T-03 · Configurações (UX-SPEC §3): monta a sobreposição real (UI-DS-07A,
// `Sobreposicao`) sobre o placeholder de FUND-04. UI-T03-01 (`Concluída`)
// trouxe o bloco "Fontes de notícia" (CA-01.1 a CA-01.4, CA-02.1 a CA-02.5,
// RN-03/RN-08) — `SecaoFontesDeNoticia`. Esta tarefa (UI-T03-02) completa o
// wireframe com "Esportes favoritos" (`SecaoEsportesFavoritos`), "Meu time"
// (`SecaoMeuTime` — ver nota de escopo no próprio arquivo), "Aparência"
// (`SecaoAparencia`, sobre `usarTema()`/FUND-05) e "Privacidade"
// (`SecaoPrivacidade`, RNF-07/ADR-012).
//
// Decisões de implementação registradas (TASK.md §6):
// - `favoritos`/`timeId` (UI-T03-02) são recalculados a cada abertura da
//   sobreposição (`useEffect` chaveado em `aberta`), não só na montagem —
//   mesmo mecanismo já usado por `EscolherTime.tsx` (UI-T04-01) para o
//   próprio `estadoAbertura`: como esta sobreposição fica montada o tempo
//   todo (`ProvedorSobreposicoes`), o time do coração pode ter mudado (via
//   T-04, aberta a partir do botão "Trocar" desta própria tela) entre um
//   fechamento e a reabertura seguinte. `fontesBloqueadas` (UI-T03-01) não
//   ganhou o mesmo tratamento aqui — está fora do escopo desta tarefa; seu
//   comportamento já era o mesmo antes (achado já sinalizado ao Coordenador
//   pela nota de UI-T03-01 logo abaixo, mesma raiz).
// - Catálogo de fontes (`config/fontes.json`, CFG-05) validado com um schema
//   leve local (mesmo padrão de `Home.tsx`/`catalogoOnboarding.ts`: não
//   importa `config/fontes.schema.ts` completo, que não é o contrato desta
//   tela) — aqui, diferente do subconjunto de `Home.tsx`, também inclui
//   `esportesCobertos`, que `SecaoFontesDeNoticia` precisa para o subtítulo
//   de cada fonte (CA-01.1: "esportes cobertos").
// - `ReferenciasValidas`/`temporadaAtual` para `lerPreferencias`/
//   `salvarPreferencias` (UI-DS-09) reaproveitam `construirCatalogoOnboarding`
//   (mesmo mecanismo síncrono e local já usado por `Home.tsx`/UI-T02-04) —
//   evita duplicar a validação de `esportes.json`/`clubes-2026.json`/
//   `campeonatos-2026.json` só para montar o conjunto de ids válidos.
// - Estado de bloqueio é local (`useState`), inicializado a partir de
//   `lerPreferencias` e persistido a cada alternância via `salvarPreferencias`
//   — efeito imediato na própria sobreposição (CA-02.1/CA-02.2), sem esperar
//   fechar/reabrir.
// - **Achado de integração sinalizado ao Coordenador, não resolvido aqui**:
//   `Home.tsx` (UI-T02-04, já concluída) lê `fontesBloqueadas` uma única vez
//   via `useMemo`/`lerPreferencias`, sem ouvir mudanças de `localStorage`.
//   Como esta sobreposição e a Home convivem montadas ao mesmo tempo
//   (`ProvedorSobreposicoes`), bloquear uma fonte aqui persiste
//   corretamente, mas o feed da Home só reflete a mudança depois de uma
//   navegação que remonte `Home` (ex.: sair e voltar para "/") — não
//   exatamente "sem recarregar a página" como CA-02.1 pede no sentido mais
//   estrito de refletir em tempo real em QUALQUER tela aberta. Resolver isso
//   de forma correta exige um estado de preferências compartilhado
//   (contexto/observador de `localStorage`) usado por Home e por esta
//   sobreposição — mudança de forma maior que o escopo desta tarefa (que já
//   teria que reabrir `Home.tsx`, de uma tarefa concluída à parte).
//   Recomendo ao Coordenador avaliar uma tarefa própria de "contexto de
//   preferências" nesse sentido.
// - Banner de "sem armazenamento" (CA-13.3) fica no topo da sobreposição
//   inteira (não só do bloco de fontes) — é sobre a persistência de
//   preferências em geral, mesmo posicionamento do wireframe ("Faixa no
//   topo").

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import fontesJson from '../../../config/fontes.json';
import { Sobreposicao } from '../../design-system/componentes/Sobreposicao';
import { BannerAlerta } from '../../design-system/componentes';
import { lerPreferencias, salvarPreferencias } from '../../armazenamento/preferencias';
import type { EsporteId, Preferencias } from '../../../dominio/tipos';
import type { ClienteSnapshot } from '../../dados/clienteSnapshot';
import { useSnapshot } from '../../dados/useSnapshot';
import {
  construirCatalogoOnboarding,
  type CatalogoOnboarding,
} from '../paginas/Onboarding/catalogoOnboarding';
import {
  SecaoFontesDeNoticia,
  type FonteCatalogo,
} from './Configuracoes/SecaoFontesDeNoticia';
import { SecaoEsportesFavoritos } from './Configuracoes/SecaoEsportesFavoritos';
import { SecaoMeuTime } from './Configuracoes/SecaoMeuTime';
import { SecaoAparencia } from './Configuracoes/SecaoAparencia';
import { SecaoPrivacidade } from './Configuracoes/SecaoPrivacidade';

/** `config/fontes.json` (CFG-05) — só o subconjunto usado por esta tela
 * (ver nota de topo). */
const fonteCatalogoSchema = z
  .object({
    id: z.string().min(1),
    nome: z.string().min(1),
    fixa: z.boolean(),
    esportesCobertos: z.array(z.string()),
  })
  .passthrough();
const listaFontesCatalogoSchema = z.array(fonteCatalogoSchema);

/** `/dados/ingestao/status.json` (SDD §5.4) — só o subconjunto que esta tela
 * consome (CA-01.2/RN-08), mesmo padrão de `SecaoUltimasNoticias`
 * (UI-T02-03). */
const esquemaStatusPublico = z.object({
  fontes: z.record(
    z.string(),
    z.object({
      instavel: z.boolean(),
      instavelDesde: z.string().nullable(),
    }),
  ),
});
const URL_STATUS = '/dados/ingestao/status.json';

interface PropriedadesConfiguracoes {
  readonly aberta: boolean;
  readonly aoFechar: () => void;
  /** Injeção de teste (mesmo padrão de `Home.tsx`). */
  readonly armazenamento?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  readonly carregarCatalogo?: () => CatalogoOnboarding | null;
  readonly fontesBrutas?: unknown;
  readonly cliente?: ClienteSnapshot;
  /** Relógio injetado (Diretriz de Implementação #2/GUARDRAILS.md §5) — nunca
   * `Date.now()`/`new Date()` direto neste componente. */
  readonly agora?: () => Date;
  /**
   * Abre a sobreposição T-04 (`EscolherTime`) a partir do bloco "Meu time"
   * (UI-T03-02). Sem esta prop (uso isolado desta tela), navega para
   * `/onboarding` como alternativa funcional — mesmo padrão de fallback de
   * `SecaoIdentidade#aoEscolherTime` (UI-T02-01) — em vez de deixar o botão
   * sem efeito.
   */
  readonly aoTrocarTime?: () => void;
}

/** Nunca lança: falha de validação vira catálogo vazio (a seção de fontes
 * simplesmente não lista nada — degradação segura, Diretriz #6). */
function construirFontesCatalogo(bruto: unknown): readonly FonteCatalogo[] {
  const resultado = listaFontesCatalogoSchema.safeParse(bruto);
  if (!resultado.success) {
    console.warn(
      'SportsLM: falha ao validar "config/fontes.json" para Configurações (T-03).',
      resultado.error.issues,
    );
    return [];
  }
  return resultado.data;
}

/** T-03 — Configurações (fontes, esportes, meu time, aparência, privacidade).
 * Sem rota (ADR-003). */
export function Configuracoes({
  aberta,
  aoFechar,
  armazenamento,
  carregarCatalogo = construirCatalogoOnboarding,
  fontesBrutas = fontesJson,
  cliente,
  agora = () => new Date(),
  aoTrocarTime,
}: PropriedadesConfiguracoes): ReactElement {
  const navegar = useNavigate();
  const catalogo = useMemo(() => carregarCatalogo(), [carregarCatalogo]);

  const fontes = useMemo(() => construirFontesCatalogo(fontesBrutas), [fontesBrutas]);

  const nomesEsportes = useMemo(() => {
    if (!catalogo) {
      return {};
    }
    return Object.fromEntries(
      catalogo.esportes.map((esporte) => [esporte.id, esporte.nome]),
    );
  }, [catalogo]);

  const leituraInicial = useMemo(() => {
    if (!catalogo) {
      return null;
    }
    return lerPreferencias(catalogo.referencias, catalogo.temporadaAtual, armazenamento);
  }, [catalogo, armazenamento]);

  const [fontesBloqueadas, setFontesBloqueadas] = useState<readonly string[]>(
    () => leituraInicial?.preferencias.fontesBloqueadas ?? [],
  );

  // UI-T03-02: `favoritos`/`timeId`/`rivais` (este componente só lê os dois
  // últimos, nunca escreve) são recalculados a cada abertura — ver nota de
  // topo do arquivo (mesmo mecanismo de `EscolherTime.tsx`/`estadoAbertura`).
  const [favoritos, setFavoritos] = useState<readonly EsporteId[]>(
    () => leituraInicial?.preferencias.favoritos ?? [],
  );
  const [timeId, setTimeId] = useState<string | null>(
    () => leituraInicial?.preferencias.timeId ?? null,
  );
  const [rivais, setRivais] = useState<readonly string[]>(
    () => leituraInicial?.preferencias.rivais ?? [],
  );

  useEffect(() => {
    if (!aberta || !catalogo) {
      return;
    }
    const leitura = lerPreferencias(
      catalogo.referencias,
      catalogo.temporadaAtual,
      armazenamento,
    );
    setFavoritos(leitura.preferencias.favoritos);
    setTimeId(leitura.preferencias.timeId);
    setRivais(leitura.preferencias.rivais);
  }, [aberta, catalogo, armazenamento]);

  const modoMemoria = leituraInicial?.modoMemoria ?? false;

  const opcoesSnapshot = useMemo(() => (cliente ? { cliente } : undefined), [cliente]);
  const snapshotStatus = useSnapshot(
    URL_STATUS,
    'status',
    esquemaStatusPublico,
    opcoesSnapshot,
  );
  const carregandoStatus = snapshotStatus.carregando && snapshotStatus.dados === null;
  const erroStatus = snapshotStatus.erro !== null && snapshotStatus.dados === null;

  function aoAlternarFonte(fonteId: string): void {
    if (!catalogo) {
      // Sem catálogo válido não há `ReferenciasValidas`/`temporadaAtual` para
      // persistir com segurança (Diretriz #6) — degradação segura: o clique
      // não tem efeito, em vez de gravar um objeto inconsistente.
      return;
    }

    const jaBloqueada = fontesBloqueadas.includes(fonteId);
    const novaLista = jaBloqueada
      ? fontesBloqueadas.filter((id) => id !== fonteId)
      : [...fontesBloqueadas, fonteId];

    setFontesBloqueadas(novaLista);

    // Usa o estado ao vivo (`favoritos`/`timeId`/`rivais`), não
    // `leituraInicial` (só a leitura de montagem) — evita regredir um campo
    // que mudou depois da montagem (UI-T03-02, ver nota de topo do arquivo).
    const novasPreferencias: Preferencias = {
      versaoEsquema: 1,
      temporada: catalogo.temporadaAtual,
      favoritos: [...favoritos],
      fontesBloqueadas: novaLista,
      timeId,
      rivais: [...rivais],
      atualizadoEm: agora().toISOString(),
    };
    salvarPreferencias(novasPreferencias, armazenamento);
  }

  function aoAlternarFavorito(esporteId: EsporteId): void {
    if (!catalogo) {
      // Mesma degradação segura de `aoAlternarFonte` (Diretriz #6).
      return;
    }

    const jaFavorito = favoritos.includes(esporteId);
    const novaLista = jaFavorito
      ? favoritos.filter((id) => id !== esporteId)
      : [...favoritos, esporteId];

    setFavoritos(novaLista);

    const novasPreferencias: Preferencias = {
      versaoEsquema: 1,
      temporada: catalogo.temporadaAtual,
      favoritos: novaLista,
      fontesBloqueadas: [...fontesBloqueadas],
      timeId,
      rivais: [...rivais],
      atualizadoEm: agora().toISOString(),
    };
    salvarPreferencias(novasPreferencias, armazenamento);
  }

  function aoAtivarTrocarTime(): void {
    aoFechar();
    if (aoTrocarTime) {
      aoTrocarTime();
      return;
    }
    navegar('/onboarding');
  }

  const clubeSelecionado = catalogo?.clubes.find((clube) => clube.id === timeId) ?? null;

  return (
    <Sobreposicao titulo="Configurações" aberta={aberta} aoFechar={aoFechar}>
      {modoMemoria && (
        <BannerAlerta
          variante="alerta"
          texto="Seu navegador não está guardando preferências. Tudo funciona nesta visita, mas nada será lembrado."
        />
      )}

      <SecaoFontesDeNoticia
        fontes={fontes}
        nomesEsportes={nomesEsportes}
        fontesBloqueadas={fontesBloqueadas}
        aoAlternarFonte={aoAlternarFonte}
        {...(snapshotStatus.dados ? { statusFontes: snapshotStatus.dados.fontes } : {})}
        carregandoStatus={carregandoStatus}
        erroStatus={erroStatus}
      />

      <SecaoEsportesFavoritos
        esportes={catalogo?.esportes ?? []}
        favoritos={favoritos}
        aoAlternar={aoAlternarFavorito}
      />

      <SecaoMeuTime clube={clubeSelecionado} aoTrocar={aoAtivarTrocarTime} />

      <SecaoAparencia />

      <SecaoPrivacidade {...(armazenamento ? { armazenamento } : {})} />
    </Sobreposicao>
  );
}
