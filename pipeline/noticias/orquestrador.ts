// pipeline/noticias/orquestrador.ts — ING-N-07 (TASK.md Lote 4)
//
// Orquestração do Fluxo 1 — Ingestão de notícias (SDD §2.3, FL-06/RF-15): liga
// ING-N-01 (`coletor-rss`) → ING-N-02 (`normalizador-item`) → ING-N-03
// (`classificador-esportes`) → ING-N-04 (`deduplicador`) → ING-N-05
// (`avaliador-fontes`) → ING-N-06 (`retencao`), na ordem exata do diagrama do
// SDD, e grava o `estado interno` (SDD/ADR-002: `estado/noticias.json`) e o
// `ingestao/status.json` (SDD §5.4, GUARDRAILS.md §5 — este módulo faz I/O de
// disco e de rede, por isso mora em `pipeline/`, não em `dominio/`).
//
// Escopo explícito registrado (TASK.md §6, não é redução de escopo — é a
// integração final do Lote 4, que só cobre o fluxo de NOTÍCIAS): o fluxo de
// futebol (ING-F-*, Lote 5) e a fusão dos dois em um único `status.json`
// público (`gerador-snapshots`/PUB-02, Lote 6) são responsabilidade de tarefas
// futuras. Este módulo:
//   (a) nunca sobrescreve uma chave `futebol`/`provedores`/`pausadoPorCota` já
//       presente no `status.json` em disco — leitura + mescla, nunca
//       substituição cega, para que ING-F-05 possa escrever ao lado sem
//       apagar o que este módulo grava (e vice-versa);
//   (b) não registra o script `npm run ingestao` nem decide o layout final do
//       diretório publicado (`dist-dados/`, convenção provisória do FUND-02) —
//       isso é decisão de PUB-02/PUB-03, quando os dois fluxos existirem.
//
// Duas camadas, para que o critério de aceite ("execução de ponta a ponta com
// 3 fontes mockadas") seja testável sem tocar disco:
//   1. `executarFluxoNoticias` — pura o suficiente para teste: recebe todo o
//      catálogo/config/estado anterior já carregados, faz coleta de rede via
//      `BuscadorHttp` injetável (nunca `fetch` direto), e devolve o novo
//      estado + status, sem escrever nada em disco.
//   2. `executarIngestaoNoticiasEmDisco` — wrapper de I/O: lê `config/*.json`
//      e o estado anterior do disco, chama (1), grava o novo estado e o
//      `status.json` de volta. Caminhos configuráveis por variável de
//      ambiente/parâmetro (nunca hardcode de caminho de produção — mesma
//      lógica da Diretriz #12 do TASK.md §1 para segredo, aplicada aqui a
//      configuração de caminho).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import {
  coletarCatalogo,
  type BuscadorHttp,
  type FonteParaColeta,
  type RegistroTentativa,
} from './coletor-rss';
import {
  normalizarItem,
  deduplicarItensNormalizados,
  avaliarCatalogo,
  contarFalhasConsecutivas,
  type ItemBrutoFeed,
  type ItemNormalizadoComId,
  type FonteParaAvaliacao,
  type RegistroTentativaAvaliavel,
} from '../../dominio/noticias';
import {
  classificarEsporte,
  type LexicoEsportes,
  type MapaCategoriasPorFonte,
  type ItemParaClassificar,
} from '../../dominio/esportes';
import { aplicarRetencao } from '../../dominio/retencao';
import {
  fonteSchema,
  itemNoticiaSchema,
  type Fonte,
  type ItemNoticia,
} from '../../dominio/tipos/noticias';
import { lexicoEsportesSchema } from '../../config/lexico-esportes.schema';
import { mapaCategoriasPorFonteSchema } from '../../config/categorias-fonte.schema';

/** Janela de retenção do "ledger" de já-ingeridos (CA-15.3), em dias. É
 * deliberadamente mais generosa que a retenção de conteúdo (RN-07, 7 dias):
 * o ledger existe só para nunca reprocessar um link já visto, mesmo depois de
 * o item ter caído da retenção de conteúdo — decisão de detalhe registrada
 * (TASK.md §6): sem isso, uma fonte que republica um link antigo faria o item
 * "reaparecer" como novo. 30 dias é uma folga generosa e limitada (o ledger
 * não cresce indefinidamente), sem exigir nova configuração formal. */
const JANELA_LEDGER_DIAS = 30;

/** Quantidade máxima de registros de tentativa mantidos por fonte no estado
 * interno (decisão de detalhe, TASK.md §6): 300 registros cobrem, mesmo para
 * a fonte com mais feeds do catálogo hoje (Gazeta Esportiva, 7 feeds), bem
 * mais que as 72h/12 tentativas que `avaliador-fontes` (ING-N-05) precisa
 * enxergar — evita que o estado interno cresça sem limite. */
const MAXIMO_REGISTROS_POR_FONTE = 300;

/** Schema de um `RegistroTentativa` dentro do estado interno persistido em
 * disco (ver nota em `EstadoNoticias.registrosPorFonte`). */
const registroTentativaEstadoSchema = z.object({
  fonteId: z.string(),
  feedId: z.string(),
  horario: z.string(),
  resultado: z.enum(['ok', 'falha', 'pulado']),
  motivo: z.string().optional(),
  itensObtidos: z.number().optional(),
});
type RegistroTentativaEstado = z.infer<typeof registroTentativaEstadoSchema>;

/** Estado interno do Fluxo 1 (SDD/ADR-002: `estado/noticias.json`), versionado
 * na branch `dados` entre execuções. */
export interface EstadoNoticias {
  /** Itens retidos pela última execução (após dedup + retenção), incluindo
   * `fora-do-recorte` (CA-04.8: fica no estado interno, nunca no snapshot
   * público — quem filtra para o público é `gerador-snapshots`/PUB-02). */
  itens: ItemNoticia[];
  /** Histórico de `RegistroTentativa` por fonte (ING-N-01), para RN-08
   * (ING-N-05) e para `frequenciaMaximaMin` (CA-15.7) na próxima execução.
   * Tipado a partir de `estadoNoticiasSchema` (não do `RegistroTentativa`
   * importado de `coletor-rss.ts`): sob `exactOptionalPropertyTypes`, o tipo
   * inferido pelo Zod para campos `.optional()` é levemente mais amplo
   * (`string | undefined` explícito) — um `RegistroTentativa[]` real
   * continua atribuível aqui (é o subtipo mais estrito), então nada muda em
   * runtime; só evita conflito de tipo puramente estrutural na validação do
   * estado lido do disco. */
  registrosPorFonte: Record<string, RegistroTentativaEstado[]>;
  /** Ledger de já-ingeridos (CA-15.3): id (sha256 do link canônico) →
   * `ingeridoEm` (ISO), independente da retenção de conteúdo — ver
   * `JANELA_LEDGER_DIAS`. */
  idsIngeridos: Record<string, string>;
}

/** Estado inicial válido (primeira execução, sem `estado/noticias.json` prévio). */
export function estadoNoticiasVazio(): EstadoNoticias {
  return { itens: [], registrosPorFonte: {}, idsIngeridos: {} };
}

/** Status de uma fonte de notícia no `ingestao/status.json` (SDD §5.4). */
export interface StatusFonteNoticias {
  ultimaTentativa: string | null;
  resultado: 'ok' | 'falha' | 'pulado' | null;
  itensNovos: number;
  falhasConsecutivas: number;
  instavel: boolean;
  instavelDesde: string | null;
  severidade?: 'alta';
}

/**
 * Porção de notícias do `ingestao/status.json` global (SDD §5.4). A porção de
 * futebol (`provedores`, `pausadoPorCota` — ING-F-05) e a fusão final num
 * único arquivo público são responsabilidade de `gerador-snapshots`/PUB-02;
 * este módulo só lê/preserva essas chaves se já existirem em disco (ver
 * `mesclarStatus`), nunca as inventa nem as apaga.
 */
export interface StatusIngestaoNoticias {
  geradoEm: string;
  fontes: Record<string, StatusFonteNoticias>;
  distribuicaoClassificacao: Record<string, number>;
  gruposFormados: number;
}

export interface ResultadoFluxoNoticias {
  /** Itens prontos para o snapshot público — exclui `fora-do-recorte`
   * (CA-04.8). Já normalizados, classificados, deduplicados (`grupoId`) e com
   * a retenção aplicada. */
  itensPublicaveis: ItemNoticia[];
  /** Status de notícias coerente com SDD §5.4. */
  status: StatusIngestaoNoticias;
  /** Novo estado interno, para persistir e reusar na próxima execução. */
  novoEstado: EstadoNoticias;
}

export interface OpcoesFluxoNoticias {
  /** Buscador HTTP injetável — nunca `fetch` direto neste módulo de
   * orquestração (testabilidade com feeds mockados, mesma convenção de
   * `pipeline/noticias/coletor-rss.ts`/ING-N-01). Padrão: `fetch` nativo. */
  buscar?: BuscadorHttp;
}

function paraFonteParaColeta(fonte: Fonte): FonteParaColeta {
  return {
    id: fonte.id,
    frequenciaMaximaMin: fonte.frequenciaMaximaMin,
    feeds: fonte.feeds.map((feed) => ({
      id: feed.id,
      url: feed.url,
      formato: feed.formato,
      esporteFixado: feed.esporteFixado,
    })),
  };
}

/** Instante (ms) do registro mais recente de uma lista, ou `undefined` se vazia. */
function horarioMaisRecente(
  registros: readonly { horario: string }[],
): string | undefined {
  let maisRecente: { horario: string; instante: number } | undefined;
  for (const registro of registros) {
    const instante = new Date(registro.horario).getTime();
    if (Number.isNaN(instante)) continue;
    if (maisRecente === undefined || instante > maisRecente.instante) {
      maisRecente = { horario: registro.horario, instante };
    }
  }
  return maisRecente?.horario;
}

/** Resultado agregado de uma fonte nesta execução (SDD §5.4 pede um único
 * `resultado` por fonte, mas uma fonte pode ter vários feeds/registros no
 * mesmo ciclo — ex.: Gazeta Esportiva, 7 feeds). Decisão de agregação
 * registrada (TASK.md §6): `'ok'` se qualquer feed respondeu com sucesso
 * nesta execução (é o sinal mais forte — a fonte está no ar); senão `'falha'`
 * se qualquer feed falhou; senão (todos `'pulado'`) `'pulado'`. */
function resultadoAgregado(
  registrosDesteRun: readonly RegistroTentativa[],
): 'ok' | 'falha' | 'pulado' | null {
  if (registrosDesteRun.length === 0) return null;
  if (registrosDesteRun.some((r) => r.resultado === 'ok')) return 'ok';
  if (registrosDesteRun.some((r) => r.resultado === 'falha')) return 'falha';
  return 'pulado';
}

/**
 * Executa o Fluxo 1 (SDD §2.3) de ponta a ponta: coleta → (descarta sem
 * título/link) → já-ingerido? (CA-15.3) → normaliza (ING-N-02) → classifica
 * (ING-N-03) → deduplica (ING-N-04) → retenção (ING-N-06); e produz a
 * avaliação de estabilidade por fonte (ING-N-05) para o `status.json`.
 *
 * Não faz I/O de disco — só rede, via `opcoes.buscar` injetável. `agora` é o
 * instante de ingestão (nunca lido internamente por `Date.now()` — mesma
 * disciplina de `dominio/`, aplicada aqui por consistência, embora este
 * módulo seja `pipeline/` e portanto já impuro por natureza).
 */
export async function executarFluxoNoticias(
  fontes: readonly Fonte[],
  lexico: LexicoEsportes,
  categoriasPorFonte: MapaCategoriasPorFonte,
  estadoAnterior: EstadoNoticias,
  agora: Date,
  opcoes: OpcoesFluxoNoticias = {},
): Promise<ResultadoFluxoNoticias> {
  // 1) ING-N-01 — coleta, respeitando `frequenciaMaximaMin` (CA-15.7) a
  // partir da última tentativa conhecida de cada fonte.
  const ultimaTentativaPorFonte: Record<string, string | null> = {};
  for (const fonte of fontes) {
    ultimaTentativaPorFonte[fonte.id] =
      horarioMaisRecente(estadoAnterior.registrosPorFonte[fonte.id] ?? []) ?? null;
  }

  const opcoesColeta: { agora: Date; buscar?: BuscadorHttp } = { agora };
  if (opcoes.buscar !== undefined) opcoesColeta.buscar = opcoes.buscar;
  const resultadosColeta = await coletarCatalogo(
    fontes.map(paraFonteParaColeta),
    ultimaTentativaPorFonte,
    opcoesColeta,
  );
  const coletaPorFonte = new Map(resultadosColeta.map((r) => [r.fonteId, r]));

  // Histórico de registros por fonte, para RN-08/ING-N-05 e para a próxima
  // execução (CA-15.7) — mais antigo primeiro, com teto de tamanho.
  const registrosPorFonte: Record<string, RegistroTentativaEstado[]> = {};
  for (const fonte of fontes) {
    const anteriores = estadoAnterior.registrosPorFonte[fonte.id] ?? [];
    const novos = coletaPorFonte.get(fonte.id)?.registros ?? [];
    registrosPorFonte[fonte.id] = [...anteriores, ...novos].slice(
      -MAXIMO_REGISTROS_POR_FONTE,
    );
  }

  // 2) já-ingerido (CA-15.3) → normaliza (ING-N-02) → classifica (ING-N-03).
  const idsIngeridos: Record<string, string> = { ...estadoAnterior.idsIngeridos };
  const itensNovosDesteRun: ItemNoticia[] = [];
  const ingeridoEm = agora.toISOString();

  for (const fonte of fontes) {
    const resultadoColeta = coletaPorFonte.get(fonte.id);
    if (resultadoColeta === undefined) continue;

    for (const bruto of resultadoColeta.itens) {
      // Item sem título ou sem link é descartado (FL-06/`ItemNoticia`
      // invariante) antes mesmo de tentar normalizar.
      if (bruto.titulo === null || bruto.link === null) continue;

      const itemBruto: ItemBrutoFeed = {
        fonteId: bruto.fonteId,
        feedId: bruto.feedId,
        tituloBruto: bruto.titulo,
        resumoBruto: bruto.resumoBruto,
        linkBruto: bruto.link,
        publicadoEmBruto: bruto.publicadoBruto,
      };

      const normalizado = normalizarItem(itemBruto, agora);
      if (normalizado === null) continue; // link inválido / título vazio (ADR-011)

      const id = createHash('sha256').update(normalizado.link).digest('hex'); // CA-15.3

      if (idsIngeridos[id] !== undefined) continue; // já ingerido (CA-15.3): ignora

      const feed = fonte.feeds.find((f) => f.id === bruto.feedId);
      const itemParaClassificar: ItemParaClassificar = {
        fonteId: fonte.id,
        // Nível 2 (categoria) nunca dispara hoje: `coletor-rss` (ING-N-01)
        // não extrai `<category>` do feed bruto — lacuna já registrada por
        // ING-N-03 (config/categorias-fonte.json publicado como `{}`).
        esporteFixadoDoFeed: feed?.esporteFixado ?? null,
        categoria: null,
        titulo: normalizado.titulo,
        resumo: normalizado.resumo,
        esportesCobertosPelaFonte: fonte.esportesCobertos,
      };
      const { esporte, origemClassificacao } = classificarEsporte(
        itemParaClassificar,
        lexico,
        categoriasPorFonte,
      );

      const candidato: ItemNoticia = {
        id,
        fonteId: normalizado.fonteId,
        feedId: normalizado.feedId,
        titulo: normalizado.titulo,
        resumo: normalizado.resumo,
        link: normalizado.link,
        publicadoEm: normalizado.publicadoEm,
        dataEstimada: normalizado.dataEstimada,
        esporte,
        origemClassificacao,
        grupoId: null, // ING-N-04 resolve a seguir, sobre o conjunto completo
        ingeridoEm,
      };

      const validado = itemNoticiaSchema.safeParse(candidato);
      if (!validado.success) continue; // defensivo: nunca deveria falhar aqui

      itensNovosDesteRun.push(validado.data);
      idsIngeridos[id] = ingeridoEm; // grava no estado (CA-15.3/CA-15.4)
    }
  }

  // 3) ING-N-04 — deduplica sobre TODO o conjunto (itens já existentes +
  // novos desta execução), para que um item novo possa se juntar a um grupo
  // formado em execução anterior (RN-16/ADR-009).
  const todosOsItens: ItemNormalizadoComId[] = [
    ...estadoAnterior.itens,
    ...itensNovosDesteRun,
  ];
  const itensComGrupo = deduplicarItensNormalizados(todosOsItens) as ItemNoticia[];

  // 4) ING-N-06 — retenção (7 dias / top-30 / teto 60 por fonte, CA-15.8).
  const itensRetidos = aplicarRetencao(itensComGrupo, agora);

  // Ledger (CA-15.3): descarta entradas com mais de JANELA_LEDGER_DIAS,
  // limitando o crescimento indefinido do estado interno.
  const corteLedgerMs = agora.getTime() - JANELA_LEDGER_DIAS * 86_400_000;
  const idsIngeridosPodados: Record<string, string> = {};
  for (const [id, quando] of Object.entries(idsIngeridos)) {
    const instante = new Date(quando).getTime();
    if (Number.isNaN(instante) || instante >= corteLedgerMs) {
      idsIngeridosPodados[id] = quando;
    }
  }

  // 5) ING-N-05 — avalia estabilidade por fonte (RN-08), a partir do
  // histórico completo (incluindo o desta execução).
  const fontesParaAvaliacao: FonteParaAvaliacao[] = fontes.map((fonte) => ({
    fonteId: fonte.id,
    fixa: fonte.fixa,
    registros: registrosPorFonte[fonte.id] as RegistroTentativaAvaliavel[],
  }));
  const avaliacoes = avaliarCatalogo(fontesParaAvaliacao, agora);
  const avaliacaoPorFonte = new Map(avaliacoes.map((a) => [a.fonteId, a]));

  // Monta `status.json` (SDD §5.4) por fonte.
  const statusFontes: Record<string, StatusFonteNoticias> = {};
  for (const fonte of fontes) {
    const registrosDesteRun = coletaPorFonte.get(fonte.id)?.registros ?? [];
    const avaliacao = avaliacaoPorFonte.get(fonte.id);
    const itensNovosDaFonte = itensNovosDesteRun.filter(
      (i) => i.fonteId === fonte.id,
    ).length;

    statusFontes[fonte.id] = {
      ultimaTentativa: horarioMaisRecente(registrosDesteRun) ?? null,
      resultado: resultadoAgregado(registrosDesteRun),
      itensNovos: itensNovosDaFonte,
      falhasConsecutivas: contarFalhasConsecutivas(
        registrosPorFonte[fonte.id] as RegistroTentativaAvaliavel[],
      ),
      instavel: avaliacao?.estado === 'instavel',
      instavelDesde: avaliacao?.desde ?? null,
      ...(avaliacao?.evento !== undefined ? { severidade: 'alta' as const } : {}),
    };
  }

  const distribuicaoClassificacao: Record<string, number> = {};
  for (const item of itensRetidos) {
    distribuicaoClassificacao[item.esporte] =
      (distribuicaoClassificacao[item.esporte] ?? 0) + 1;
  }
  const gruposFormados = new Set(
    itensRetidos.map((i) => i.grupoId).filter((g): g is string => g !== null),
  ).size;

  const status: StatusIngestaoNoticias = {
    geradoEm: ingeridoEm,
    fontes: statusFontes,
    distribuicaoClassificacao,
    gruposFormados,
  };

  const novoEstado: EstadoNoticias = {
    itens: itensRetidos,
    registrosPorFonte,
    idsIngeridos: idsIngeridosPodados,
  };

  // CA-04.8: `fora-do-recorte` fica no estado interno, nunca no snapshot público.
  const itensPublicaveis = itensRetidos.filter(
    (item) => item.esporte !== 'fora-do-recorte',
  );

  return { itensPublicaveis, status, novoEstado };
}

// ---------------------------------------------------------------------------
// Camada de I/O (leitura/gravação em disco) — wrapper fino sobre a função pura
// acima. Caminhos configuráveis por variável de ambiente/parâmetro (nunca
// hardcode de caminho de produção, mesma disciplina da Diretriz #12).
// ---------------------------------------------------------------------------

const RAIZ_PROJETO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function caminhoConfig(nomeArquivo: string): string {
  return join(RAIZ_PROJETO, 'config', nomeArquivo);
}

/** Diretório do estado interno (ADR-002: branch órfã `dados`, arquivos
 * `estado/*.json`). Configurável via `SPORTSLM_DIR_ESTADO` — nunca hardcode
 * de caminho de produção (Diretriz #12, aplicada aqui a configuração de
 * caminho, não só a segredo). */
function dirEstado(): string {
  return process.env['SPORTSLM_DIR_ESTADO'] ?? join(RAIZ_PROJETO, 'estado');
}

const estadoNoticiasSchema = z.object({
  itens: z.array(itemNoticiaSchema),
  registrosPorFonte: z.record(z.string(), z.array(registroTentativaEstadoSchema)),
  idsIngeridos: z.record(z.string(), z.string()),
});

function lerJsonSeExistir(caminho: string): unknown {
  if (!existsSync(caminho)) return undefined;
  return JSON.parse(readFileSync(caminho, 'utf8')) as unknown;
}

/** Carrega o estado anterior de `{dirEstado}/noticias.json`; estado vazio
 * (primeira execução) se o arquivo não existir ou for inválido — falha de
 * leitura de estado interno nunca deve travar a ingestão (Diretriz #6 é sobre
 * *entrada externa*; estado interno corrompido é tratado com a mesma cautela,
 * mas com um `console.warn`, não descarte silencioso). */
export function carregarEstadoNoticias(
  caminho: string = join(dirEstado(), 'noticias.json'),
): EstadoNoticias {
  const bruto = lerJsonSeExistir(caminho);
  if (bruto === undefined) return estadoNoticiasVazio();
  const resultado = estadoNoticiasSchema.safeParse(bruto);
  if (!resultado.success) {
    console.warn(
      `estado/noticias.json inválido em ${caminho}; iniciando do zero.`,
      resultado.error,
    );
    return estadoNoticiasVazio();
  }
  return resultado.data;
}

function gravarJson(caminho: string, dado: unknown): void {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, `${JSON.stringify(dado, null, 2)}\n`, 'utf8');
}

/** Grava o novo estado interno em `{dirEstado}/noticias.json`. */
export function gravarEstadoNoticias(
  estado: EstadoNoticias,
  caminho: string = join(dirEstado(), 'noticias.json'),
): void {
  gravarJson(caminho, estado);
}

/**
 * Mescla a porção de notícias no `ingestao/status.json` existente (se houver)
 * sem apagar chaves de outra origem (`futebol`/`provedores`/`pausadoPorCota`,
 * escritas por ING-F-05/PUB-02) — leitura + mescla, nunca substituição cega
 * (ver nota de escopo no topo do arquivo).
 */
export function mesclarStatus(
  statusNoticias: StatusIngestaoNoticias,
  caminho: string,
): Record<string, unknown> {
  const existente = lerJsonSeExistir(caminho);
  const base: Record<string, unknown> =
    existente !== undefined && typeof existente === 'object' && existente !== null
      ? (existente as Record<string, unknown>)
      : {};
  return {
    ...base,
    geradoEm: statusNoticias.geradoEm,
    fontes: statusNoticias.fontes,
    distribuicaoClassificacao: statusNoticias.distribuicaoClassificacao,
    gruposFormados: statusNoticias.gruposFormados,
  };
}

/** Grava `ingestao/status.json` mesclado (ver `mesclarStatus`). */
export function gravarStatus(
  statusNoticias: StatusIngestaoNoticias,
  caminho: string = join(dirEstado(), 'ingestao', 'status.json'),
): void {
  gravarJson(caminho, mesclarStatus(statusNoticias, caminho));
}

/** Carrega e valida `config/fontes.json` como `Fonte[]` do domínio (SDD §5.1) —
 * campos extras do arquivo de configuração (`substitutos`, `verificacao.por`)
 * são descartados pelo Zod (`z.object` sem `.passthrough()`), sem exigir
 * mudança no arquivo publicado por CFG-05. */
export function carregarFontesDominio(
  caminho: string = caminhoConfig('fontes.json'),
): Fonte[] {
  const bruto = JSON.parse(readFileSync(caminho, 'utf8')) as unknown;
  return z.array(fonteSchema).parse(bruto);
}

export function carregarLexicoEsportes(
  caminho: string = caminhoConfig('lexico-esportes.json'),
): LexicoEsportes {
  const bruto = JSON.parse(readFileSync(caminho, 'utf8')) as unknown;
  return lexicoEsportesSchema.parse(bruto);
}

export function carregarCategoriasPorFonte(
  caminho: string = caminhoConfig('categorias-fonte.json'),
): MapaCategoriasPorFonte {
  const bruto = JSON.parse(readFileSync(caminho, 'utf8')) as unknown;
  return mapaCategoriasPorFonteSchema.parse(bruto);
}

export interface OpcoesIngestaoEmDisco extends OpcoesFluxoNoticias {
  agora?: Date;
  caminhoFontes?: string;
  caminhoLexico?: string;
  caminhoCategorias?: string;
  caminhoEstado?: string;
  caminhoStatus?: string;
}

/**
 * Wrapper de I/O do Fluxo 1: lê configuração + estado anterior do disco,
 * executa `executarFluxoNoticias`, grava o novo estado interno e o
 * `ingestao/status.json`. É o ponto de entrada esperado por um futuro
 * `npm run ingestao` (wiring do script em si é decisão de PUB-02/PUB-03,
 * quando o Fluxo 2 de futebol também existir — TASK.md §6).
 */
export async function executarIngestaoNoticiasEmDisco(
  opcoes: OpcoesIngestaoEmDisco = {},
): Promise<ResultadoFluxoNoticias> {
  const agora = opcoes.agora ?? new Date();
  const fontes = carregarFontesDominio(opcoes.caminhoFontes);
  const lexico = carregarLexicoEsportes(opcoes.caminhoLexico);
  const categoriasPorFonte = carregarCategoriasPorFonte(opcoes.caminhoCategorias);
  const caminhoEstado = opcoes.caminhoEstado ?? join(dirEstado(), 'noticias.json');
  const caminhoStatus =
    opcoes.caminhoStatus ?? join(dirEstado(), 'ingestao', 'status.json');
  const estadoAnterior = carregarEstadoNoticias(caminhoEstado);

  const opcoesFluxo: OpcoesFluxoNoticias = {};
  if (opcoes.buscar !== undefined) opcoesFluxo.buscar = opcoes.buscar;
  const resultado = await executarFluxoNoticias(
    fontes,
    lexico,
    categoriasPorFonte,
    estadoAnterior,
    agora,
    opcoesFluxo,
  );

  gravarEstadoNoticias(resultado.novoEstado, caminhoEstado);
  gravarStatus(resultado.status, caminhoStatus);

  return resultado;
}
