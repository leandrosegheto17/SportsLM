// app/rotas/SobreposicoesContext.tsx — UI-T02-04 (TASK.md Lote 8)
//
// Estado compartilhado de abertura/fechamento das sobreposições sem rota
// (ADR-003: T-03 Configurações, T-04 Escolher/trocar time) — vivem uma única
// vez em `Layout`, montadas por cima de qualquer rota, e são acionadas de
// pontos variados da árvore (o `⚙` de `Navegacao`, o botão "ESCOLHER MEU
// TIME" dentro de `SecaoIdentidade`/Home, o botão "Trocar" do bloco "Meu
// time" dentro da própria `Configuracoes`/UI-T03-02 — via `aoTrocarTime`,
// fecha T-03 e abre T-04 — e futuramente "TROCAR TIME" do Painel do Time,
// Lote 9) sem precisar subir/descer prop por vários níveis.
//
// T-07 (Escolher rivais) — UI-T08-01 (TASK.md Lote 11): acionada só a partir
// de T-08 Comparativo (`ESCOLHER RIVAIS`, CA-10.5), por isso entrou aqui só
// nesta tarefa (o comentário original previa isso: "acionada só a partir de
// T-08 Comparativo"). Mesmo mecanismo de `abrirEscolherTime`/`EscolherTime`:
// estado local simples, sem rota (ADR-003), montada uma única vez ao lado das
// demais sobreposições.

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Configuracoes } from './sobreposicoes/Configuracoes';
import { EscolherTime } from './sobreposicoes/EscolherTime';
import { EscolherRivais } from './sobreposicoes/EscolherRivais';
import type { CatalogoOnboarding } from './paginas/Onboarding/catalogoOnboarding';

export interface ContextoSobreposicoes {
  readonly abrirConfiguracoes: () => void;
  readonly abrirEscolherTime: () => void;
  readonly abrirEscolherRivais: () => void;
}

const Contexto = createContext<ContextoSobreposicoes | null>(null);

/** Lança se usado fora de `<ProvedorSobreposicoes>` — erro de programação,
 * não um estado de execução normal a tratar silenciosamente. */
export function useSobreposicoes(): ContextoSobreposicoes {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error(
      'useSobreposicoes: nenhum <ProvedorSobreposicoes> encontrado na árvore.',
    );
  }
  return valor;
}

interface PropriedadesProvedorSobreposicoes {
  readonly children: ReactNode;
  /** Injeção de teste (mesmo padrão de `Home`/`Configuracoes`/`EscolherTime`),
   * repassada às duas sobreposições — REFAT-09-01: sem isto, um teste que
   * injeta armazenamento fake na Home não conseguiria compartilhar o mesmo
   * armazenamento com `Configuracoes`/`EscolherTime` (produção sempre usa o
   * padrão, `globalThis.localStorage`, para as três, então nunca diverge
   * fora de teste). */
  readonly armazenamento?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Injeção de teste do catálogo local (mesmo padrão de `Home`/
   * `Configuracoes`/`EscolherTime`) — repassada para as duas sobreposições
   * conseguirem enxergar o mesmo catálogo fake usado pela Home num teste de
   * integração (REFAT-09-01), em vez de cada uma resolver o catálogo real
   * de forma independente. */
  readonly carregarCatalogo?: () => CatalogoOnboarding | null;
  /** Injeção de teste de `config/fontes.json`, só usada por `Configuracoes`
   * (mesmo padrão de `Home`). */
  readonly fontesBrutas?: unknown;
}

/** Monta as sobreposições T-03/T-04 uma única vez, por cima de `<Outlet />`
 * (`Layout`), controladas por estado local simples (`useState`) — não há
 * necessidade de rota própria (ADR-003) nem de biblioteca de estado global. */
export function ProvedorSobreposicoes({
  children,
  armazenamento,
  carregarCatalogo,
  fontesBrutas,
}: PropriedadesProvedorSobreposicoes): ReactElement {
  const [configuracoesAberta, setConfiguracoesAberta] = useState(false);
  const [escolherTimeAberta, setEscolherTimeAberta] = useState(false);
  const [escolherRivaisAberta, setEscolherRivaisAberta] = useState(false);

  const valor = useMemo<ContextoSobreposicoes>(
    () => ({
      abrirConfiguracoes: () => {
        setConfiguracoesAberta(true);
      },
      abrirEscolherTime: () => {
        setEscolherTimeAberta(true);
      },
      abrirEscolherRivais: () => {
        setEscolherRivaisAberta(true);
      },
    }),
    [],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <Configuracoes
        aberta={configuracoesAberta}
        aoFechar={() => {
          setConfiguracoesAberta(false);
        }}
        aoTrocarTime={() => {
          setEscolherTimeAberta(true);
        }}
        {...(armazenamento ? { armazenamento } : {})}
        {...(carregarCatalogo ? { carregarCatalogo } : {})}
        {...(fontesBrutas !== undefined ? { fontesBrutas } : {})}
      />
      <EscolherTime
        aberta={escolherTimeAberta}
        aoFechar={() => {
          setEscolherTimeAberta(false);
        }}
        {...(armazenamento ? { armazenamento } : {})}
        {...(carregarCatalogo ? { carregarCatalogo } : {})}
      />
      <EscolherRivais
        aberta={escolherRivaisAberta}
        aoFechar={() => {
          setEscolherRivaisAberta(false);
        }}
      />
    </Contexto.Provider>
  );
}
