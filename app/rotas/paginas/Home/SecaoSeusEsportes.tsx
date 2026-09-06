// app/rotas/paginas/Home/SecaoSeusEsportes.tsx — UI-T02-02 (TASK.md Lote 8)
//
// Home — seção "Seus esportes" (UX-SPEC §2/T-02, PRD-TECNICO RF-05):
// 10 itens mais recentes das notícias dos esportes favoritos do torcedor, de
// fontes não bloqueadas, nunca o item classificado como "geral"/"fora do
// recorte" (CA-04.7); filtro por chip de favorito, sem reload de página
// (CA-05.2); estado de zero favoritos (CA-05.4); estado de favoritos sem
// notícia recente (CA-05.3).
//
// Componente isolado da tela Home (Lote 8 é paralelizável: UI-T01-01,
// UI-T02-01, UI-T02-02 e UI-T02-03 não dependem umas das outras) — a
// integração com a faixa do clube/"A Briga" (UI-T02-01), o feed "Últimas
// notícias" (UI-T02-03) e a navegação/estados globais da tela inteira
// (UI-T02-04) é responsabilidade de outra tarefa, que monta esta seção junto
// das demais.
//
// Decisões de detalhe registradas (TASK.md §6):
// - `favoritos` é `EsporteId[]` (nunca inclui `'geral'` — o próprio
//   `preferenciasSchema`/DOM-01 só aceita um dos 15 esportes válidos), então
//   CA-04.7 já é garantido estruturalmente pelo tipo; ainda assim, o filtro
//   abaixo confere `ehEsporteValido`/pertencimento a `favoritos` de forma
//   defensiva antes de exibir qualquer item, nunca confiando cegamente no
//   campo `esporte` do dado externo (Diretriz de Implementação #6).
// - `nomesEsportes`/`nomesFontes` são resolvidos por quem monta a tela (mesmo
//   padrão de `EtiquetaEsporte`/`CartaoIngresso`, UI-DS-03/07B): este
//   componente não importa `config/` (`dominio`/`app` não decidem o catálogo
//   vigente, só exibem o que foi injetado) — evita duplicar
//   `config/esportes.json`/`config/fontes.json` aqui.
// - `/dados/noticias.json` é um array puro de `ItemNoticia` (`z.array(itemNoticiaSchema)`),
//   o formato REAL publicado por `pipeline/publicacao/gerador-snapshots.ts`
//   (PUB-02, `noticiasPublicasSchema`) — sem envelope. **Reconciliação
//   pós-conclusão** (achado de revisão inline do Coordenador): a primeira
//   versão desta tarefa usava `{ itens: ItemNoticia[] }`, copiado da fixture
//   de teste de `UI-DS-08` (`useSnapshot.test.tsx`), única referência
//   concreta disponível no momento em que esta tarefa rodou em paralelo —
//   PUB-02 já estava `Concluída`, mas o Executor desta tarefa não a
//   consultou antes de escrever o schema local. Corrigido para bater com a
//   tarefa irmã `SecaoUltimasNoticias.tsx` (UI-T02-03), que já usava o
//   formato real desde o início.
// - Escolha de representante por grupo de deduplicação (`grupoId`,
//   ADR-009/RN-16) roda aqui via `escolherRepresentante` (DOM-03) antes de
//   aplicar o filtro de favoritos — o mesmo dado bruto também alimenta
//   UI-T02-03 (tarefa paralela, que faz a mesma escolha independentemente
//   para o feed "Últimas notícias"); replicar a chamada pura de domínio nas
//   duas seções é intencional, não é o mesmo componente.
// - Tempo relativo de cada cartão ("há 8 min") usa uma formatação própria e
//   mais compacta que `dominio/frescor.ts` (que produz "atualizado há X",
//   pensado para o carimbo de frescor do conjunto inteiro, não para o
//   timestamp individual de cada notícia) — ver `formatarTempoDoItem` abaixo.
//   O carimbo de frescor da seção (cabeçalho "ATUALIZADO HÁ...") continua
//   usando `dominio/frescor.ts` via `CarimboFrescor`.

import { useMemo, useState, type ReactElement } from 'react';
import { escolherRepresentante } from '../../../../dominio/dedup';
import { calcularFrescor } from '../../../../dominio/frescor';
import { ehEsporteValido } from '../../../../dominio/esportes';
import type { EsporteId } from '../../../../dominio/tipos/esportes';
import { itemNoticiaSchema, type ItemNoticia } from '../../../../dominio/tipos/noticias';
import { z } from 'zod';
import { CartaoIngresso } from '../../../design-system/CartaoIngresso';
import { Chip } from '../../../design-system/componentes/Chip';
import {
  BannerAlerta,
  CarimboFrescor,
  Esqueleto,
  EstadoVazio,
} from '../../../design-system/componentes';
import {
  clienteSnapshotPadrao,
  type ClienteSnapshot,
} from '../../../dados/clienteSnapshot';
import { useSnapshot } from '../../../dados/useSnapshot';
import estilos from './SecaoSeusEsportes.module.css';

/** `/dados/noticias.json` (SDD §2.2) — array puro, formato real publicado por
 * `pipeline/publicacao/gerador-snapshots.ts` (PUB-02, `noticiasPublicasSchema`). */
const esquemaNoticiasPublico = z.array(itemNoticiaSchema);

const URL_NOTICIAS = '/dados/noticias.json';

/** RF-17/SDD §2.5: intervalo de atualização de notícias é 30 min (limite de
 * alerta, RN-09, é 2× isso). */
const INTERVALO_NOTICIAS_MINUTOS = 30;

/** CA-05.1: "10 itens mais recentes". */
const QUANTIDADE_MAXIMA = 10;

export interface PropriedadesSecaoSeusEsportes {
  /** Esportes favoritos do torcedor (0 a 3, RN-06) — nunca contém `'geral'`. */
  readonly favoritos: readonly EsporteId[];
  /** Nome de exibição de cada esporte (Seção 2A do PRD-TECNICO), resolvido
   * por quem monta a tela a partir do catálogo vigente. */
  readonly nomesEsportes: Readonly<Partial<Record<EsporteId, string>>>;
  /** Ids de fonte bloqueados pelo torcedor (RF-01/CA-05.1: "de fontes não
   * bloqueadas"). */
  readonly fontesBloqueadas?: readonly string[];
  /** Nome de exibição de cada fonte (ex.: `"ge"` → `"ge"`, `"espn-brasil"` →
   * `"ESPN Brasil"`); sem entrada, usa o próprio id como rótulo. */
  readonly nomesFontes?: Readonly<Record<string, string>>;
  /** Atalho de CA-05.4 — leva para a escolha de esportes favoritos (RF-03). */
  readonly aoEscolherEsportes: () => void;
  /** Relógio injetado (Diretriz de Implementação #2/GUARDRAILS.md §5) —
   * nunca `Date.now()` direto neste componente. */
  readonly agora?: Date;
  /** Injeção de cliente de snapshot para teste (mesmo padrão de
   * `useSnapshot`/UI-DS-08); padrão é a instância única da SPA. */
  readonly cliente?: ClienteSnapshot;
}

type FiltroSecao = 'todos' | EsporteId;

/** Junta nomes em português: "Futebol", "Futebol e Vôlei", "Futebol, Vôlei e
 * Fórmula 1" — usado por CA-05.3 ("Sem notícias recentes de <favoritos>"). */
function formatarListaPt(nomes: readonly string[]): string {
  if (nomes.length === 0) {
    return '';
  }
  if (nomes.length === 1) {
    return nomes[0] as string;
  }
  const [ultimo, ...resto] = [...nomes].reverse();
  return `${resto.reverse().join(', ')} e ${ultimo as string}`;
}

/** Tempo relativo compacto do cartão individual ("há 8 min"/"há 3 h") — até
 * 24 h (Diretriz de Implementação #1.4); acima disso, data e hora absolutas
 * (`dd/mm · HHhMM`), nunca "agora"/"ao vivo" (Diretriz #1.4). */
function formatarTempoDoItem(agora: Date, publicadoEmIso: string): string {
  const publicadoEm = new Date(publicadoEmIso);
  const diffMs = Math.max(0, agora.getTime() - publicadoEm.getTime());
  const minuto = 60_000;
  const hora = 3_600_000;
  const dia = 86_400_000;

  if (diffMs < minuto) {
    return 'há poucos segundos';
  }
  if (diffMs < hora) {
    const minutos = Math.round(diffMs / minuto);
    return `há ${String(minutos)} min`;
  }
  if (diffMs < dia) {
    const horas = Math.round(diffMs / hora);
    return `há ${String(horas)} h`;
  }

  const dd = String(publicadoEm.getDate()).padStart(2, '0');
  const mm = String(publicadoEm.getMonth() + 1).padStart(2, '0');
  const hh = String(publicadoEm.getHours()).padStart(2, '0');
  const min = String(publicadoEm.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} · ${hh}h${min}`;
}

/** Type guard: item pertence a um dos favoritos (nunca `'geral'`/
 * `'fora-do-recorte'`, CA-04.7) — checagem defensiva mesmo o tipo já
 * impedindo `'geral'` em `favoritos` (Diretriz de Implementação #6: nunca
 * confiar cegamente em entrada externa validada só pelo Zod estrutural). */
function pertenceAosFavoritos(
  item: ItemNoticia,
  favoritosSet: ReadonlySet<EsporteId>,
): item is ItemNoticia & { esporte: EsporteId } {
  return ehEsporteValido(item.esporte) && favoritosSet.has(item.esporte);
}

/** Agrupa por `grupoId` (itens sem grupo formam grupo unitário do próprio
 * id) e escolhe o representante de cada grupo entre fontes não bloqueadas
 * (ADR-009/DOM-03) — grupos totalmente bloqueados desaparecem. */
function selecionarRepresentantes(
  itens: readonly ItemNoticia[],
  fontesBloqueadasSet: ReadonlySet<string>,
): ItemNoticia[] {
  const porGrupo = new Map<string, ItemNoticia[]>();
  for (const item of itens) {
    const chave = item.grupoId ?? `__unico__:${item.id}`;
    const grupo = porGrupo.get(chave);
    if (grupo) {
      grupo.push(item);
    } else {
      porGrupo.set(chave, [item]);
    }
  }

  const representantes: ItemNoticia[] = [];
  for (const grupo of porGrupo.values()) {
    const representante = escolherRepresentante(grupo, fontesBloqueadasSet);
    if (representante !== null) {
      representantes.push(representante);
    }
  }
  return representantes;
}

/**
 * `SecaoSeusEsportes` — Home, bloco "Seus esportes" (UX-SPEC §2/T-02).
 */
export function SecaoSeusEsportes({
  favoritos,
  nomesEsportes,
  fontesBloqueadas = [],
  nomesFontes = {},
  aoEscolherEsportes,
  agora = new Date(),
  cliente,
}: PropriedadesSecaoSeusEsportes): ReactElement {
  const [filtro, setFiltro] = useState<FiltroSecao>('todos');

  const opcoesSnapshot = useMemo(() => (cliente ? { cliente } : undefined), [cliente]);
  const snapshot = useSnapshot(
    URL_NOTICIAS,
    'noticias',
    esquemaNoticiasPublico,
    opcoesSnapshot,
  );

  const favoritosSet = useMemo<ReadonlySet<EsporteId>>(
    () => new Set(favoritos),
    [favoritos],
  );
  const fontesBloqueadasSet = useMemo(
    () => new Set(fontesBloqueadas),
    [fontesBloqueadas],
  );

  // CA-05.1/CA-04.7: pool das 10 mais recentes dos favoritos, de fontes não
  // bloqueadas, nunca "geral"/"fora-do-recorte" — calculado sobre TODOS os
  // favoritos, independente do chip selecionado (o chip só filtra esta pool,
  // sem refazer a consulta — CA-05.2, "sem reload").
  const pool = useMemo(() => {
    const itens = snapshot.dados ?? [];
    const representantes = selecionarRepresentantes(itens, fontesBloqueadasSet);
    return representantes
      .filter((item): item is ItemNoticia & { esporte: EsporteId } =>
        pertenceAosFavoritos(item, favoritosSet),
      )
      .sort(
        (a, b) => new Date(b.publicadoEm).getTime() - new Date(a.publicadoEm).getTime(),
      )
      .slice(0, QUANTIDADE_MAXIMA);
  }, [snapshot.dados, favoritosSet, fontesBloqueadasSet]);

  const itensExibidos =
    filtro === 'todos' ? pool : pool.filter((item) => item.esporte === filtro);

  const carregandoInicial = snapshot.carregando && snapshot.dados === null;
  const erroSemDados = snapshot.erro !== null && snapshot.dados === null;

  const geradoEm = snapshot.geradoEm;
  const textoCarimbo =
    geradoEm !== null
      ? calcularFrescor(agora, new Date(geradoEm), INTERVALO_NOTICIAS_MINUTOS)
      : null;

  // CA-05.4 — zero favoritos: a seção inteira vira o convite, sem chips nem
  // consulta de filtro (a busca de notícias já ocorreu — `useSnapshot` é
  // incondicional acima — mas nada dela é exibido aqui).
  if (favoritos.length === 0) {
    return (
      <section className={estilos['secao']} aria-label="Seus esportes">
        <EstadoVazio
          titulo="Seus esportes"
          texto="Escolha até 3 esportes favoritos para ver o que mais te interessa aqui."
          acao={{ rotulo: 'Escolher esportes', aoClicar: aoEscolherEsportes }}
        />
      </section>
    );
  }

  const nomesDoEscopoAtual =
    filtro === 'todos'
      ? favoritos.map((esporte) => nomesEsportes[esporte] ?? esporte)
      : [nomesEsportes[filtro] ?? filtro];

  function reexecutarBusca(): void {
    void (cliente ?? clienteSnapshotPadrao).garantir(
      URL_NOTICIAS,
      'noticias',
      esquemaNoticiasPublico,
    );
  }

  return (
    <section className={estilos['secao']} aria-labelledby="titulo-seus-esportes">
      <div className={estilos['cabecalho']}>
        <h2 id="titulo-seus-esportes" className={estilos['titulo']}>
          Seus esportes
        </h2>
        {textoCarimbo &&
          (geradoEm !== null ? (
            <CarimboFrescor
              estado={textoCarimbo.emAlerta ? 'alerta' : 'normal'}
              texto={textoCarimbo.atualizadoHa}
              dataHoraIso={geradoEm}
            />
          ) : (
            <CarimboFrescor
              estado={textoCarimbo.emAlerta ? 'alerta' : 'normal'}
              texto={textoCarimbo.atualizadoHa}
            />
          ))}
      </div>

      {favoritos.length > 1 && (
        <div
          role="group"
          aria-label="Filtrar por esporte favorito"
          className={estilos['chips']}
        >
          <Chip
            variante="selecionavel"
            rotulo="Todos"
            selecionado={filtro === 'todos'}
            aoAlternar={() => {
              setFiltro('todos');
            }}
          />
          {favoritos.map((esporte) => (
            <Chip
              key={esporte}
              variante="selecionavel"
              rotulo={nomesEsportes[esporte] ?? esporte}
              selecionado={filtro === esporte}
              aoAlternar={() => {
                setFiltro(esporte);
              }}
            />
          ))}
        </div>
      )}

      {carregandoInicial ? (
        <Esqueleto variante="cartao" quantidade={2} />
      ) : erroSemDados ? (
        <BannerAlerta
          variante="erro"
          texto="Não conseguimos carregar as notícias agora. Verifique sua conexão."
          acao={{ rotulo: 'Tentar de novo', aoClicar: reexecutarBusca }}
        />
      ) : itensExibidos.length === 0 ? (
        // CA-05.3: sem itens dos favoritos (no escopo do chip selecionado).
        <BannerAlerta
          variante="informacao"
          texto={`Sem notícias recentes de ${formatarListaPt(nomesDoEscopoAtual)} — ${
            textoCarimbo?.atualizadoHa ?? 'atualizado agora'
          }.`}
        />
      ) : (
        <ul className={estilos['lista']}>
          {itensExibidos.map((item) => (
            <li key={item.id}>
              <CartaoIngresso
                href={item.link}
                destino="externo"
                rotuloEtiqueta={nomesEsportes[item.esporte] ?? item.esporte}
                fonte={nomesFontes[item.fonteId] ?? item.fonteId}
                tempo={formatarTempoDoItem(agora, item.publicadoEm)}
                titulo={item.titulo}
                resumo={item.resumo}
                variante={item.dataEstimada ? 'horario-estimado' : 'normal'}
                origemCorBarra="esporte"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
