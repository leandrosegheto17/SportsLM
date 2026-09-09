// pipeline/publicacao/gerador-snapshots.ts — PUB-02 (TASK.md Lote 6)
//
// Ponto de integração final do pipeline (SDD §1.3/§2.1-A "gerador de
// snapshots"): produz TODOS os arquivos públicos do contrato do SDD §2.2 a
// partir (a) do estado interno gravado por ING-N-07 (`estado/noticias.json`)
// e ING-F-05 (`estado/futebol.json` + `estado/ingestao/status.json`
// mesclado), e (b) da configuração por temporada (`config/*.json`), incluindo
// a paleta de clube derivada por PUB-01 (`derivador-paleta`). Faz I/O de
// disco — mora em `pipeline/`, não em `dominio/` (GUARDRAILS.md §5).
//
// Mesmo padrão de duas camadas de `pipeline/noticias/orquestrador.ts`
// (ING-N-07) e `pipeline/futebol/orquestrador.ts` (ING-F-05):
//   1. `construirSnapshots` — pura: recebe todo o estado/config já carregados
//      e devolve o conteúdo de cada arquivo público, sem tocar disco. É o que
//      o teste "gera o snapshot completo a partir de estado mockado e valida
//      cada arquivo contra seu schema" exercita diretamente.
//   2. `gerarSnapshots`/`gerarSnapshotsEmDisco` — wrapper de I/O: lê
//      `estado/*` e `config/*` do disco (caminhos configuráveis, nunca
//      hardcode de caminho de produção — Diretriz #12 do TASK.md §1, mesma
//      disciplina de ING-N-07/ING-F-05), chama (1), e grava cada arquivo em
//      `dist-dados/<caminho-do-contrato>` — a mesma convenção de diretório de
//      saída já usada pelo workflow de ingestão (`.github/workflows/
//      ingestao.yml`/FUND-02: `cp -r dist-dados/. .` na branch `dados`).
//
// "Publica só se o hash mudou" (critério de aceite desta tarefa) É
// consequência de determinismo, não um mecanismo à parte: `construirSnapshots`
// é uma função pura que, para a mesma entrada, sempre produz os mesmos bytes
// (mesma ordem de chaves nos objetos literais que construímos, nenhum
// `Math.random`/`Date.now()` implícito — só o `agora` recebido por parâmetro).
// Gravar o mesmo conteúdo duas vezes produz o mesmo arquivo, e é o próprio
// workflow FUND-02 (`git diff --cached --quiet`) quem decide não commitar
// quando nada mudou — este módulo não precisa (nem deve) reimplementar essa
// checagem.
//
// Decisão de escopo registrada (TASK.md §6, mesma lógica já usada por PUB-01):
// não adiciono aqui um script `npm run ingestao`/CLI standalone que rode este
// módulo em produção. O projeto não tem um executor de TypeScript autônomo
// (`tsx`/`ts-node` são dependências de runtime fora da lista fechada do SDD
// §3) — rodar este arquivo fora do `vitest` exigiria essa dependência nova,
// o que pede atualização do `GUARDRAILS.md` antes do merge (fora do escopo
// desta tarefa). `gerarSnapshotsEmDisco` já é o ponto de entrada esperado por
// esse futuro CLI (mesma nota deixada por ING-N-07/ING-F-05); sinalizo ao
// Coordenador que a wiring de `npm run ingestao` (rodar os dois fluxos de
// ingestão + este gerador num único comando Node executável) é um passo de
// infraestrutura ainda em aberto, não um desvio desta tarefa.
//
// Nota de compatibilidade com o cliente (pedida explicitamente pela
// descrição da tarefa): a forma de `versao.json` produzida aqui
// (`versaoPublicaSchema`) é estruturalmente idêntica ao `esquemaVersao` de
// `app/dados/versao.ts` (UI-DS-08) — as 4 chaves de hash
// (`noticias`/`futebol`/`catalogo`/`status`) são as mesmas 4 que
// `ClienteSnapshot`/`useSnapshot` já sabem ler. Não importamos o schema do
// cliente diretamente no código de produção (evita uma dependência de
// `pipeline/` sobre `app/`, direções de dependência que o SDD §2.1 nunca
// exercita hoje); o teste deste módulo importa `esquemaVersao` só para provar
// a equivalência estrutural, sem acoplar o runtime do pipeline ao da SPA.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import {
  competicaoSchema,
  linhaClassificacaoSchema,
  partidaSchema,
  participacaoClubeSchema,
  paletaClubeSchema,
  zonaSchema,
  type Competicao,
  type Partida,
  type ParticipacaoClube,
  type Zona,
} from '../../dominio/tipos/futebol';
import {
  itemNoticiaSchema,
  verificacaoFonteSchema,
  type ItemNoticia,
  type Fonte,
} from '../../dominio/tipos/noticias';
import { esporteIdSchema } from '../../dominio/tipos/esportes';
import { ordenarCampeonatos, type CampeonatoOrdenavel } from '../../dominio/campeonatos';

import { esportesSchema, type Esporte } from '../../config/esportes.schema';
import {
  CategoriaCampeonatoSchema,
  FormatoCampeonatoSchema,
  type CampeonatoConfig,
} from '../../config/campeonatos.schema';
import { carregarZonas, type DependenciasDeArquivo } from '../../config/zonas';

import { derivarPaletasClubes } from '../config/derivador-paleta';
import { carregarClubesSerieA2026, type ClubeBase } from '../config/clubes';
import { carregarFontesDominio, carregarEstadoNoticias } from '../noticias/orquestrador';
import {
  carregarEstadoFutebol,
  carregarCampeonatosDominio,
  type CompeticaoEstado,
} from '../futebol/orquestrador';

// ---------------------------------------------------------------------------
// Esquemas do contrato público (SDD §2.2) — usados tanto para produzir quanto
// (em teste) para validar cada arquivo publicado.
// ---------------------------------------------------------------------------

/** `/dados/versao.json` (SDD §2.2) — mesma forma de `esquemaVersao` de
 * `app/dados/versao.ts` (UI-DS-08), ver nota de compatibilidade no topo. */
export const versaoPublicaSchema = z.object({
  geradoEm: z.string().min(1),
  hashes: z.object({
    noticias: z.string().min(1),
    futebol: z.string().min(1),
    catalogo: z.string().min(1),
    status: z.string().min(1),
  }),
});
export type VersaoPublica = z.infer<typeof versaoPublicaSchema>;

/** `/dados/catalogo-fontes.json`: subconjunto público de `Fonte` (SDD §2.2 —
 * "nome, esportes cobertos, fixa, estado de verificação"). Campos internos de
 * operação da ingestão (`termos`/`feeds`/`frequenciaMaximaMin`/`substitutos`)
 * ficam de fora — não fazem parte do que a tela precisa exibir (RF-01). */
export const fontePublicaSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  fixa: z.boolean(),
  esportesCobertos: z.array(esporteIdSchema),
  verificacao: verificacaoFonteSchema,
});
export type FontePublica = z.infer<typeof fontePublicaSchema>;
/** RN-19: o catálogo tem sempre exatamente 12 fontes (ampliado de 5 por
 * decisão direta do stakeholder, 2026-09-08/09 — `.md/BLOCKERS.md` Bloqueios
 * 011/012). */
export const catalogoFontesPublicoSchema = z.array(fontePublicaSchema).length(12);

/** `/dados/noticias.json`: itens normalizados dentro da retenção, com
 * `grupoId`; nunca `fora-do-recorte` (CA-04.8). */
export const noticiasPublicasSchema = z.array(itemNoticiaSchema);

/** `/dados/futebol/brasileirao.json`: classificação + todas as partidas dos
 * 20 clubes, todas as rodadas, + zonas (RN-15/RF-18). */
export const brasileiraoPublicoSchema = z.object({
  competicao: competicaoSchema,
  classificacao: z.array(linhaClassificacaoSchema),
  partidas: z.array(partidaSchema),
  zonas: z.array(zonaSchema),
});
export type BrasileiraoPublico = z.infer<typeof brasileiraoPublicoSchema>;

/** Uma entrada de `/dados/futebol/clube/<slug>.json`: um campeonato do clube,
 * seu status/fase/resumo (via `participacao`) e as partidas do clube nesse
 * campeonato.
 *
 * `classificacaoFinalDoGrupo` (extensão aditiva, resolução do Bloqueio 001 de
 * `.md/BLOCKERS.md`, CA-08.5) — mesma forma espelhada em
 * `app/dados/futebol.ts` (ver comentário lá para o detalhe da decisão).
 * `optional()`: este gerador ainda não produz o campo para nenhuma fonte real
 * (só o Brasileirão é publicado hoje, sempre `pontos-corridos` — nunca muda
 * de formato), então nenhum snapshot atual precisa ser regravado; quando uma
 * fonte de grupos→mata-mata existir, é o ingestor dessa fonte quem passa a
 * popular este campo aqui, sem mudança de schema. */
export const campeonatoDoClubePublicoSchema = z.object({
  competicao: competicaoSchema,
  participacao: participacaoClubeSchema,
  partidas: z.array(partidaSchema),
  classificacaoFinalDoGrupo: z.array(linhaClassificacaoSchema).nullable().optional(),
});
export type CampeonatoDoClubePublico = z.infer<typeof campeonatoDoClubePublicoSchema>;

/** `/dados/futebol/clube/<slug>.json`: lista de campeonatos do clube, já
 * ordenada por CA-07.4 (`ordenarCampeonatos`, DOM-04). */
export const clubeFutebolPublicoSchema = z.array(campeonatoDoClubePublicoSchema);
export type ClubeFutebolPublico = z.infer<typeof clubeFutebolPublicoSchema>;

/** Uma entrada de `/dados/config/clubes-2026.json`: campos base + `paleta`
 * derivada e validada (ADR-017/PUB-01). `idsProvedor`/`paletaManual` ficam de
 * fora — são plumbing interno de casamento com o provedor, não fazem parte do
 * que a tela consome (SDD §2.2: "nome, nome curto, sigla, cor base e paleta"). */
export const clubePublicoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  nomeCurto: z.string().min(1),
  sigla: z.string().regex(/^[A-Z]{3}$/, 'sigla deve ter exatamente 3 letras maiúsculas'),
  corBase: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'corBase deve ser hex #RRGGBB'),
  paleta: paletaClubeSchema,
});
export type ClubePublico = z.infer<typeof clubePublicoSchema>;

/** Uma entrada de `/dados/config/campeonatos-2026.json`: "lista da temporada,
 * janelas, formato, cobertura" (SDD §2.2) — sem `clubes`/`observacao`
 * (cruzamento interno de configuração, servido ao cliente já resolvido por
 * clube em `/dados/futebol/clube/<slug>.json`). */
export const campeonatoPublicoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  temporada: z.number().int(),
  categoria: CategoriaCampeonatoSchema,
  formato: FormatoCampeonatoSchema,
  janela: z.object({ inicio: z.string(), fim: z.string() }),
  provedor: z.string().min(1).nullable(),
});
export type CampeonatoPublico = z.infer<typeof campeonatoPublicoSchema>;

const statusFontePublicaSchema = z.object({
  ultimaTentativa: z.string().nullable(),
  resultado: z.enum(['ok', 'falha', 'pulado']).nullable(),
  itensNovos: z.number().int().min(0),
  falhasConsecutivas: z.number().int().min(0),
  instavel: z.boolean(),
  instavelDesde: z.string().nullable(),
  severidade: z.literal('alta').optional(),
});

const statusCompeticaoPublicaSchema = z.object({
  resultado: z.enum([
    'atualizada',
    'inconsistente',
    'fora-da-janela',
    'sem-cobertura',
    'provedor-nao-registrado',
    'pausado-por-cota',
    'falha',
  ]),
  ultimaAtualizacao: z.string().nullable(),
  motivosInconsistencia: z.array(z.string()).optional(),
  mensagemErro: z.string().optional(),
});

/** `/dados/ingestao/status.json` (SDD §5.4): porção de notícias
 * (ING-N-07/`mesclarStatus`) + porção de futebol (ING-F-05/
 * `mesclarStatusFutebol`) já mescladas em disco — este schema só formaliza o
 * arquivo combinado para validação/publicação, sem transformar o conteúdo. */
export const statusIngestaoPublicoSchema = z.object({
  geradoEm: z.string().min(1),
  fontes: z.record(z.string(), statusFontePublicaSchema),
  distribuicaoClassificacao: z.record(z.string(), z.number()),
  gruposFormados: z.number().int().min(0),
  futebol: z.record(z.string(), statusCompeticaoPublicaSchema),
  provedores: z.record(z.string(), z.number()),
  pausadoPorCota: z.boolean(),
});
export type StatusIngestaoPublico = z.infer<typeof statusIngestaoPublicoSchema>;

// ---------------------------------------------------------------------------
// Camada pura: `construirSnapshots`
// ---------------------------------------------------------------------------

export interface EntradaSnapshots {
  /** Instante da publicação — nunca lido internamente por `Date.now()`
   * (mesma disciplina de `dominio/`, aplicada aqui por consistência, embora
   * este módulo seja `pipeline/` e portanto já impuro por natureza). */
  readonly agora: Date;
  /** `estado/noticias.json` (ING-N-07) — TODOS os itens retidos, incluindo
   * `fora-do-recorte` (que este módulo filtra, CA-04.8). */
  readonly itensNoticiasEstado: readonly ItemNoticia[];
  /** `config/fontes.json` validado como domínio (SDD §5.1). */
  readonly fontes: readonly Fonte[];
  /** Conteúdo já lido (e ainda não validado) de `estado/ingestao/status.json`
   * — mesclado por ING-N-07/ING-F-05; `undefined` se o arquivo nunca existiu
   * (primeira publicação, antes de qualquer ingestão ter rodado). */
  readonly statusIngestaoBruto: unknown;
  /** `estado/futebol.json` (ING-F-05) — competições por id. */
  readonly competicoesFutebol: Readonly<Record<string, CompeticaoEstado>>;
  /** `config/campeonatos-2026.json` (CFG-03). */
  readonly campeonatosConfig: readonly CampeonatoConfig[];
  /** `config/clubes-2026.json` (CFG-02), sem paleta — este módulo deriva
   * (PUB-01) antes de publicar. */
  readonly clubesBase: readonly ClubeBase[];
  /** `config/esportes.json` (CFG-01). */
  readonly esportes: readonly Esporte[];
  /** `config/zonas-<temporada>.json` (CFG-04); `null` = ausente (CA-18.2,
   * estado válido — RN-15 ainda não tem faixas confirmadas para 2026). */
  readonly zonas: readonly Zona[] | null;
}

export interface SnapshotsPublicados {
  readonly versao: VersaoPublica;
  readonly noticias: readonly ItemNoticia[];
  readonly catalogoFontes: readonly FontePublica[];
  readonly futebolBrasileirao: BrasileiraoPublico;
  /** Chave = `Clube.id` (slug) — mesmo nome de arquivo `<slug>.json`. */
  readonly futebolPorClube: Readonly<Record<string, ClubeFutebolPublico>>;
  readonly configEsportes: readonly Esporte[];
  readonly configClubes: readonly ClubePublico[];
  readonly configCampeonatos: readonly CampeonatoPublico[];
  readonly configZonas: readonly Zona[] | null;
  readonly statusIngestao: StatusIngestaoPublico;
}

function sha256DeConteudo(valor: unknown): string {
  return createHash('sha256').update(JSON.stringify(valor)).digest('hex');
}

/** Constrói o `Competicao` "sem dados" para quando ainda não existe estado
 * gravado por ING-F-05 para esta competição (primeira publicação, ou
 * competição sem nenhuma execução de ingestão ainda) — nunca omite o
 * campeonato (CA-07.2), mesma disciplina de `pipeline/futebol/orquestrador.ts`. */
function competicaoSemDados(config: CampeonatoConfig): Competicao {
  return {
    id: config.id,
    nome: config.nome,
    temporada: config.temporada,
    formato: config.formato,
    janela: config.janela,
    provedor: config.provedor,
    ultimaAtualizacao: null,
  };
}

function participacaoSemDados(competicaoId: string, clubeId: string): ParticipacaoClube {
  return {
    competicaoId,
    clubeId,
    status: 'sem-dados',
    faseAtual: null,
    resultadoFinal: null,
    resumo: null,
  };
}

/** Data/hora (ISO) da próxima partida pendente do clube nesta lista de
 * partidas — só usado como critério de desempate de `ordenarCampeonatos`
 * (CA-07.4, DOM-04); `null` se não houver nenhuma partida pendente com data
 * conhecida. */
function proximaDataHoraPendente(
  clubeId: string,
  partidas: readonly Partida[],
): string | null {
  let maisProxima: string | null = null;
  for (const partida of partidas) {
    if (partida.mandanteId !== clubeId && partida.visitanteId !== clubeId) continue;
    if (
      partida.status !== 'agendada' &&
      partida.status !== 'aguardando-resultado' &&
      partida.status !== 'adiada'
    ) {
      continue;
    }
    if (partida.dataHora === null) continue;
    if (maisProxima === null || partida.dataHora < maisProxima) {
      maisProxima = partida.dataHora;
    }
  }
  return maisProxima;
}

function construirCampeonatosDoClube(
  clubeId: string,
  entrada: EntradaSnapshots,
): ClubeFutebolPublico {
  const campeonatosDoClube = entrada.campeonatosConfig.filter((config) =>
    config.clubes.includes(clubeId),
  );

  const entradas: CampeonatoDoClubePublico[] = campeonatosDoClube.map((config) => {
    const estado = entrada.competicoesFutebol[config.id];
    const competicao = estado?.competicao ?? competicaoSemDados(config);
    const partidasDoClube = (estado?.partidas ?? []).filter(
      (p) => p.mandanteId === clubeId || p.visitanteId === clubeId,
    );
    const participacao =
      estado?.participacoes.find((p) => p.clubeId === clubeId) ??
      participacaoSemDados(config.id, clubeId);

    return campeonatoDoClubePublicoSchema.parse({
      competicao,
      participacao,
      partidas: partidasDoClube,
    } satisfies CampeonatoDoClubePublico);
  });

  const ordenaveis: CampeonatoOrdenavel[] = entradas.map((e) => ({
    id: e.competicao.id,
    status: e.participacao.status,
    proximoJogoDataHora: proximaDataHoraPendente(clubeId, e.partidas),
  }));
  const porId = new Map(entradas.map((e) => [e.competicao.id, e]));

  return ordenarCampeonatos(ordenaveis).map((o) => {
    const encontrada = porId.get(o.id);
    if (encontrada === undefined) {
      // Defensivo: `ordenarCampeonatos` só reordena a mesma lista, nunca
      // deveria produzir um id ausente do mapa construído a partir dela.
      throw new Error(`campeonato "${o.id}" ausente após ordenação (defensivo)`);
    }
    return encontrada;
  });
}

/** Normaliza o conteúdo bruto de `estado/ingestao/status.json` (possivelmente
 * ausente, ou só com a porção de um dos dois fluxos de ingestão já gravada)
 * para a forma completa de `statusIngestaoPublicoSchema` — mesma disciplina
 * de "nunca inventa nem apaga" de `mesclarStatus`/`mesclarStatusFutebol`, só
 * que aqui é para PREENCHER valor ausente com um padrão inócuo, não para
 * preservar uma chave de outra origem. */
function normalizarStatusBruto(bruto: unknown, geradoEmPadrao: string): unknown {
  const base: Record<string, unknown> =
    bruto !== null && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : {};
  return {
    geradoEm: typeof base['geradoEm'] === 'string' ? base['geradoEm'] : geradoEmPadrao,
    fontes: base['fontes'] ?? {},
    distribuicaoClassificacao: base['distribuicaoClassificacao'] ?? {},
    gruposFormados: base['gruposFormados'] ?? 0,
    futebol: base['futebol'] ?? {},
    provedores: base['provedores'] ?? {},
    pausadoPorCota: base['pausadoPorCota'] ?? false,
  };
}

/**
 * Constrói o conteúdo de todos os arquivos públicos do SDD §2.2 a partir de
 * estado/config já carregados — não toca disco. Determinística: a mesma
 * `EntradaSnapshots` sempre produz o mesmo resultado (mesmos hashes em
 * `versao.hashes`), critério de aceite desta tarefa.
 *
 * Pode lançar `ErroPaletaInvalida` (PUB-01, `derivarPaletasClubes`) se algum
 * clube tiver `corBase`/`paletaManual` que não passe nos 8 alvos de contraste
 * do ADR-017 — "falha de validação quebra o build", propagada aqui sem
 * captura (mesma decisão de PUB-01).
 */
export function construirSnapshots(entrada: EntradaSnapshots): SnapshotsPublicados {
  const geradoEm = entrada.agora.toISOString();

  // --- Notícias (CA-04.8: nunca publica `fora-do-recorte`) -----------------
  const noticias = entrada.itensNoticiasEstado
    .filter((item) => item.esporte !== 'fora-do-recorte')
    .map((item) => itemNoticiaSchema.parse(item));

  // --- Catálogo de fontes ----------------------------------------------------
  const catalogoFontes = catalogoFontesPublicoSchema.parse(
    entrada.fontes.map((fonte) =>
      fontePublicaSchema.parse({
        id: fonte.id,
        nome: fonte.nome,
        fixa: fonte.fixa,
        esportesCobertos: fonte.esportesCobertos,
        verificacao: fonte.verificacao,
      }),
    ),
  );

  // --- Futebol: Brasileirão (SDD §2.2 — "todas as partidas dos 20 clubes,
  // todas as rodadas + zonas") -----------------------------------------------
  const brasileiraoConfig = entrada.campeonatosConfig.find(
    (c) => c.categoria === 'brasileirao',
  );
  if (brasileiraoConfig === undefined) {
    // Defensivo: `ConfigCampeonatosSchema` (CFG-03) já garante a presença de
    // uma categoria "brasileirao" na configuração validada.
    throw new Error(
      'nenhum campeonato de categoria "brasileirao" em `campeonatosConfig` (defensivo — CFG-03 deveria ter garantido isso)',
    );
  }
  const estadoBrasileirao = entrada.competicoesFutebol[brasileiraoConfig.id];
  const zonasPublicadas = entrada.zonas !== null ? [...entrada.zonas] : [];
  const futebolBrasileirao = brasileiraoPublicoSchema.parse({
    competicao: estadoBrasileirao?.competicao ?? competicaoSemDados(brasileiraoConfig),
    classificacao: [...(estadoBrasileirao?.linhas ?? [])],
    partidas: [...(estadoBrasileirao?.partidas ?? [])],
    zonas: zonasPublicadas,
  } satisfies BrasileiraoPublico);

  // --- Futebol: um arquivo por clube -----------------------------------------
  const futebolPorClube: Record<string, ClubeFutebolPublico> = {};
  for (const clube of entrada.clubesBase) {
    futebolPorClube[clube.id] = construirCampeonatosDoClube(clube.id, entrada);
  }

  // --- Configuração por temporada ---------------------------------------------
  const configEsportes = esportesSchema.parse(entrada.esportes);

  const clubesComPaleta = derivarPaletasClubes([...entrada.clubesBase]);
  const configClubes = clubesComPaleta.map((clube) =>
    clubePublicoSchema.parse({
      id: clube.id,
      nome: clube.nome,
      nomeCurto: clube.nomeCurto,
      sigla: clube.sigla,
      corBase: clube.corBase,
      paleta: clube.paleta,
    } satisfies ClubePublico),
  );

  const configCampeonatos = entrada.campeonatosConfig.map((config) =>
    campeonatoPublicoSchema.parse({
      id: config.id,
      nome: config.nome,
      temporada: config.temporada,
      categoria: config.categoria,
      formato: config.formato,
      janela: config.janela,
      provedor: config.provedor,
    } satisfies CampeonatoPublico),
  );

  const configZonas =
    entrada.zonas !== null ? entrada.zonas.map((zona) => zonaSchema.parse(zona)) : null;

  // --- Status de ingestão ------------------------------------------------------
  const statusIngestao = statusIngestaoPublicoSchema.parse(
    normalizarStatusBruto(entrada.statusIngestaoBruto, geradoEm),
  );

  // --- `versao.json` — hash por grupo (SDD §2.2/`app/dados/versao.ts`) --------
  const porClubeOrdenadoPorId = Object.fromEntries(
    Object.entries(futebolPorClube).sort(([a], [b]) => a.localeCompare(b)),
  );
  const versao = versaoPublicaSchema.parse({
    geradoEm,
    hashes: {
      noticias: sha256DeConteudo(noticias),
      futebol: sha256DeConteudo({
        brasileirao: futebolBrasileirao,
        porClube: porClubeOrdenadoPorId,
      }),
      catalogo: sha256DeConteudo(catalogoFontes),
      status: sha256DeConteudo(statusIngestao),
    },
  } satisfies VersaoPublica);

  return {
    versao,
    noticias,
    catalogoFontes,
    futebolBrasileirao,
    futebolPorClube,
    configEsportes,
    configClubes,
    configCampeonatos,
    configZonas,
    statusIngestao,
  };
}

/** Mapeia o resultado de `construirSnapshots` para `{ caminho relativo à raiz
 * publicada → conteúdo }`, usando exatamente os caminhos da tabela do SDD
 * §2.2 (Diretriz #10 do TASK.md §1 — convenção de nome nunca muda por conta
 * própria do Executor). */
export function mapaDeArquivosPublicos(
  snapshots: SnapshotsPublicados,
): Record<string, unknown> {
  const arquivos: Record<string, unknown> = {
    'versao.json': snapshots.versao,
    'catalogo-fontes.json': snapshots.catalogoFontes,
    'noticias.json': snapshots.noticias,
    'futebol/brasileirao.json': snapshots.futebolBrasileirao,
    'config/esportes.json': snapshots.configEsportes,
    'config/clubes-2026.json': snapshots.configClubes,
    'config/campeonatos-2026.json': snapshots.configCampeonatos,
    'ingestao/status.json': snapshots.statusIngestao,
  };

  for (const [clubeId, campeonatos] of Object.entries(snapshots.futebolPorClube)) {
    arquivos[`futebol/clube/${clubeId}.json`] = campeonatos;
  }

  // CA-18.2/RN-15: ausência de zonas é estado válido — nunca publica o
  // arquivo (não um placeholder vazio, a própria ausência é o sinal).
  if (snapshots.configZonas !== null) {
    arquivos['config/zonas-2026.json'] = snapshots.configZonas;
  }

  return arquivos;
}

// ---------------------------------------------------------------------------
// Camada de I/O — wrapper fino sobre `construirSnapshots`. Caminhos
// configuráveis por variável de ambiente/parâmetro (nunca hardcode de
// caminho de produção — mesma disciplina de ING-N-07/ING-F-05).
// ---------------------------------------------------------------------------

const RAIZ_PROJETO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Mesma variável de ambiente de ING-N-07/ING-F-05 — os três módulos apontam
 * para o mesmo checkout da branch `dados` (ADR-002). */
function dirEstado(): string {
  return process.env['SPORTSLM_DIR_ESTADO'] ?? join(RAIZ_PROJETO, 'estado');
}

/** Diretório de saída dos snapshots públicos — mesma convenção provisória já
 * usada por `.github/workflows/ingestao.yml` (FUND-02: `dist-dados/`, copiado
 * para a raiz da branch `dados`). Configurável via `SPORTSLM_DIR_SAIDA`. */
function dirSaidaPadrao(): string {
  return process.env['SPORTSLM_DIR_SAIDA'] ?? join(RAIZ_PROJETO, 'dist-dados');
}

function lerJsonSeExistir(caminho: string): unknown {
  if (!existsSync(caminho)) return undefined;
  return JSON.parse(readFileSync(caminho, 'utf8')) as unknown;
}

function caminhoConfig(nomeArquivo: string): string {
  return join(RAIZ_PROJETO, 'config', nomeArquivo);
}

/** Carrega e valida `config/esportes.json` (CFG-01). */
export function carregarEsportesConfig(
  caminho: string = caminhoConfig('esportes.json'),
): Esporte[] {
  const bruto = JSON.parse(readFileSync(caminho, 'utf8')) as unknown;
  return esportesSchema.parse(bruto);
}

const dependenciasArquivoReal: DependenciasDeArquivo = {
  existeArquivo: existsSync,
  lerArquivo: (caminho: string) => readFileSync(caminho, 'utf8'),
};

/** Carrega `config/zonas-<temporada>.json` (CFG-04); `null` se ausente
 * (CA-18.2, estado válido — ver `config/zonas.ts`). */
export function carregarZonasConfig(
  temporada: number,
  caminho: string = caminhoConfig(`zonas-${String(temporada)}.json`),
): Zona[] | null {
  return carregarZonas(caminho, dependenciasArquivoReal);
}

export interface OpcoesGeracaoSnapshots {
  agora?: Date;
  caminhoFontes?: string;
  caminhoEstadoNoticias?: string;
  caminhoEstadoFutebol?: string;
  caminhoStatus?: string;
  caminhoCampeonatos?: string;
  caminhoClubes?: string;
  caminhoEsportes?: string;
  /** Sobrescreve o caminho de `config/zonas-<temporada>.json` (por padrão,
   * resolvido a partir da temporada do primeiro campeonato carregado). */
  caminhoZonas?: string;
}

/** Lê `estado/*`/`config/*` do disco e produz os snapshots públicos (SDD
 * §2.2), sem gravar nada — usado por `gerarSnapshotsEmDisco` e por quem
 * quiser inspecionar o resultado antes de escrever em disco. */
export function gerarSnapshots(opcoes: OpcoesGeracaoSnapshots = {}): SnapshotsPublicados {
  const agora = opcoes.agora ?? new Date();

  const fontes = carregarFontesDominio(opcoes.caminhoFontes);
  const estadoNoticias = carregarEstadoNoticias(
    opcoes.caminhoEstadoNoticias ?? join(dirEstado(), 'noticias.json'),
  );
  const estadoFutebol = carregarEstadoFutebol(
    opcoes.caminhoEstadoFutebol ?? join(dirEstado(), 'futebol.json'),
  );
  const statusIngestaoBruto = lerJsonSeExistir(
    opcoes.caminhoStatus ?? join(dirEstado(), 'ingestao', 'status.json'),
  );
  const campeonatosConfig = carregarCampeonatosDominio(opcoes.caminhoCampeonatos);
  const clubesBase = carregarClubesSerieA2026(opcoes.caminhoClubes);
  const esportes = carregarEsportesConfig(opcoes.caminhoEsportes);

  const temporada = campeonatosConfig[0]?.temporada ?? new Date().getUTCFullYear();
  const zonas =
    opcoes.caminhoZonas !== undefined
      ? carregarZonas(opcoes.caminhoZonas, dependenciasArquivoReal)
      : carregarZonasConfig(temporada);

  const entrada: EntradaSnapshots = {
    agora,
    itensNoticiasEstado: estadoNoticias.itens,
    fontes,
    statusIngestaoBruto,
    competicoesFutebol: estadoFutebol.competicoes,
    campeonatosConfig,
    clubesBase,
    esportes,
    zonas,
  };

  return construirSnapshots(entrada);
}

function gravarJson(caminho: string, dado: unknown): void {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, `${JSON.stringify(dado, null, 2)}\n`, 'utf8');
}

export interface OpcoesGeracaoSnapshotsEmDisco extends OpcoesGeracaoSnapshots {
  /** Diretório de saída; por padrão `dist-dados/` (ou `SPORTSLM_DIR_SAIDA`). */
  dirSaida?: string;
}

/**
 * Wrapper de I/O completo: lê estado interno + configuração do disco,
 * constrói os snapshots (`gerarSnapshots`) e grava cada arquivo do contrato
 * do SDD §2.2 em `{dirSaida}/<caminho-do-contrato>`. Determinístico: mesma
 * entrada em disco ⇒ mesmos bytes gravados ⇒ o workflow de publicação
 * (FUND-02) não gera commit quando nada mudou.
 */
export function gerarSnapshotsEmDisco(
  opcoes: OpcoesGeracaoSnapshotsEmDisco = {},
): SnapshotsPublicados {
  const snapshots = gerarSnapshots(opcoes);
  const raizSaida = opcoes.dirSaida ?? dirSaidaPadrao();
  const arquivos = mapaDeArquivosPublicos(snapshots);

  for (const [caminhoRelativo, conteudo] of Object.entries(arquivos)) {
    gravarJson(join(raizSaida, ...caminhoRelativo.split('/')), conteudo);
  }

  return snapshots;
}
