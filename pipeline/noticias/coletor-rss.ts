// pipeline/noticias/coletor-rss.ts — ING-N-01 (TASK.md Lote 4)
//
// Componente `coletor-rss` do SDD §2.1-A / Fluxo 1 (§2.3): busca cada feed do
// catálogo de fontes (`config/fontes.json`, CFG-05), respeita
// `frequenciaMaximaMin` declarada por fonte (CA-15.7) e registra tentativa,
// horário e resultado de cada busca (CA-15.1, RNF-11) — inclusive em falha
// (CA-15.5, "mantém itens; registra; tenta no próximo intervalo").
//
// Escopo explícito desta tarefa (registrado para auditoria, TASK.md §6): este
// módulo só busca e faz o parse estrutural (RSS 2.0 / Atom) de cada feed,
// devolvendo itens **brutos**, e produz o registro de tentativa. Ele
// deliberadamente NÃO faz (é outra tarefa do Lote 4, na ordem do SDD §2.3):
//   - decodificar/sanitizar texto, truncar título/resumo, resolver data e
//     fuso, ou validar `link` como http(s) absoluto → `normalizador-item`
//     (ING-N-02, ADR-011);
//   - descartar item já ingerido pelo hash do link canônico (CA-15.3) — exige
//     o hash canônico que só existe depois da normalização, e o estado do que
//     já foi ingerido, que é responsabilidade do orquestrador (ING-N-07);
//   - classificar esporte (ING-N-03), deduplicar (ING-N-04), aplicar retenção
//     (ING-N-06) ou avaliar RN-08/instabilidade (ING-N-05 — que É sequencial
//     depois desta tarefa e consome os `RegistroTentativa` produzidos aqui).
// Isso é decisão de decomposição de detalhe, não mudança de escopo: cada
// preocupação continua coberta, só que pelo componente já designado a ela na
// Seção 2.1 do SDD.
//
// `pipeline/` faz I/O de rede — mora fora de `dominio/` (que é puro,
// GUARDRAILS.md §5). Parse de XML usa `fast-xml-parser`, única lib de parsing
// XML autorizada pelo SDD §3/GUARDRAILS.md §2.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { catalogoFontesSchema } from '../../config/fontes.schema';

/**
 * Formato de item mínimo que este módulo precisa de uma "fonte" para operar
 * — não acopla o coletor a um schema Zod específico (nem o de
 * `config/fontes.schema.ts`, nem o `Fonte` de `dominio/tipos/noticias.ts`):
 * qualquer um dos dois satisfaz esta forma estrutural.
 */
export interface FeedParaColeta {
  id: string;
  url: string;
  formato: 'rss' | 'atom';
  esporteFixado: string | null;
}

export interface FonteParaColeta {
  id: string;
  frequenciaMaximaMin: number; // CA-15.7
  feeds: FeedParaColeta[];
}

/** Item de feed cru, ainda sem decodificação/sanitização/truncamento — isso é
 * ING-N-02 (`normalizador-item`). */
export interface ItemFeedBruto {
  fonteId: string;
  feedId: string;
  titulo: string | null;
  link: string | null;
  resumoBruto: string | null;
  publicadoBruto: string | null; // string de data crua do feed (RFC-822/ISO) — ING-N-02 resolve
  guid: string | null;
}

export type ResultadoTentativa = 'ok' | 'falha' | 'pulado';

/** Registro de uma tentativa de busca (CA-15.1, CA-15.7, RNF-11). Gravado
 * mesmo em falha (CA-15.5) — nunca lançado para fora do fluxo de coleta. */
export interface RegistroTentativa {
  fonteId: string;
  feedId: string;
  horario: string; // ISO 8601
  resultado: ResultadoTentativa;
  motivo?: string; // presente em 'falha'/'pulado'
  itensObtidos?: number; // presente em 'ok'
}

export interface ResultadoColetaFeed {
  registro: RegistroTentativa;
  itens: ItemFeedBruto[];
}

export interface ResultadoColetaFonte {
  fonteId: string;
  registros: RegistroTentativa[];
  itens: ItemFeedBruto[];
}

/** Buscador HTTP injetável (testabilidade — feed mockado). Compatível com o
 * `fetch` nativo do Node 22 (SDD §3), sem exigir a assinatura completa.
 *
 * Expõe `headers`/`arrayBuffer()` (em vez de só `text()`) porque `Body.text()`
 * do WHATWG Fetch sempre decodifica como UTF-8, ignorando o `charset`
 * declarado no header `Content-Type` da resposta (RFC 7231 §3.1.1.5) — o UOL,
 * por exemplo, serve `text/xml;charset=ISO-8859-1`. Decodificar bytes crus
 * respeitando o charset declarado é o que evita título/resumo virarem
 * "V�DEO"/"n�o" (mojibake) na ingestão. */
export type BuscadorHttp = (url: string) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(nome: string): string | null };
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

/** Extrai o `charset` do valor de um header `Content-Type` (ex.:
 * `"text/xml;charset=ISO-8859-1"` → `"ISO-8859-1"`). `null` quando ausente. */
function extrairCharset(contentType: string | null): string | null {
  if (contentType === null) return null;
  const match = /charset\s*=\s*"?([^;"\s]+)"?/i.exec(contentType);
  return match?.[1] ?? null;
}

/** Decodifica os bytes crus da resposta respeitando o charset declarado no
 * `Content-Type` (default UTF-8, o mais comum entre as fontes do catálogo).
 * Charset desconhecido pelo `TextDecoder` (ex.: grafia não padronizada) cai
 * para UTF-8 em vez de lançar — a busca não deve falhar por isso. */
function decodificarCorpo(bytes: ArrayBuffer, contentType: string | null): string {
  const charset = extrairCharset(contentType) ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export interface OpcoesColeta {
  agora?: Date;
  buscar?: BuscadorHttp;
}

const parserXml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
});

function paraArray<T>(valor: T | T[] | undefined | null): T[] {
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function paraTexto(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === 'string') return valor.length > 0 ? valor : null;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (typeof valor === 'object') {
    const texto = (valor as Record<string, unknown>)['#text'];
    if (typeof texto === 'string') return texto.length > 0 ? texto : null;
    if (typeof texto === 'number') return String(texto);
  }
  return null;
}

/** Extrai o `href` de `<link>` do Atom: pode ser um único elemento com
 * atributos, ou uma lista (várias relações — self/alternate/...). Prefere
 * `rel="alternate"` (o link "canônico" da matéria); na ausência de `rel`,
 * assume alternate (RFC 4287 — é o padrão quando `rel` está ausente). */
function extrairLinkAtom(valor: unknown): string | null {
  const candidatos = paraArray(
    valor as Record<string, unknown> | Record<string, unknown>[],
  );
  let primeiroHref: string | null = null;
  for (const candidato of candidatos) {
    if (typeof candidato === 'string') {
      if (primeiroHref === null) primeiroHref = candidato;
      continue;
    }
    if (typeof candidato === 'object' && candidato !== null) {
      const obj = candidato as Record<string, unknown>;
      const href = obj['@_href'];
      if (typeof href !== 'string') continue;
      const rel = obj['@_rel'];
      if (primeiroHref === null) primeiroHref = href;
      if (rel === undefined || rel === 'alternate') return href;
    }
  }
  return primeiroHref;
}

/**
 * Faz o parse estrutural de um feed RSS 2.0 ou Atom em itens brutos. Não
 * lança em XML malformado dentro do razoável — `fast-xml-parser` é tolerante
 * (SDD §3); um documento irreconhecível produz lista vazia (tratado como
 * "0 itens obtidos", nunca "falha" — a falha é de rede/HTTP, não de parse
 * relaxado, na linha do SDD "parser tolerante a XML mal formado").
 */
export function analisarFeed(
  conteudoXml: string,
  feed: Pick<FeedParaColeta, 'id' | 'formato'>,
  fonteId: string,
): ItemFeedBruto[] {
  let doc: unknown;
  try {
    doc = parserXml.parse(conteudoXml) as unknown;
  } catch {
    return [];
  }

  if (feed.formato === 'rss') {
    const raiz = doc as { rss?: { channel?: { item?: unknown } } };
    const itensBrutos = paraArray(
      raiz.rss?.channel?.item as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | undefined,
    );
    return itensBrutos.map((item) => ({
      fonteId,
      feedId: feed.id,
      titulo: paraTexto(item['title']),
      link: paraTexto(item['link']),
      resumoBruto: paraTexto(item['description']),
      publicadoBruto: paraTexto(item['pubDate']),
      guid: paraTexto(item['guid']),
    }));
  }

  const raiz = doc as { feed?: { entry?: unknown } };
  const entradas = paraArray(
    raiz.feed?.entry as Record<string, unknown> | Record<string, unknown>[] | undefined,
  );
  return entradas.map((entrada) => ({
    fonteId,
    feedId: feed.id,
    titulo: paraTexto(entrada['title']),
    link: extrairLinkAtom(entrada['link']),
    resumoBruto: paraTexto(entrada['summary']) ?? paraTexto(entrada['content']),
    publicadoBruto: paraTexto(entrada['updated']) ?? paraTexto(entrada['published']),
    guid: paraTexto(entrada['id']),
  }));
}

/**
 * Busca e faz o parse de um único feed, sempre produzindo um
 * `RegistroTentativa` — falha de rede/HTTP nunca lança, é registrada
 * (CA-15.5). Não decide "pulado" por frequência: isso é responsabilidade de
 * `coletarFonte`, no nível da fonte (a frequência é declarada por fonte, não
 * por feed individual — `Fonte.frequenciaMaximaMin`).
 */
export async function coletarFeed(
  feed: FeedParaColeta,
  fonteId: string,
  opcoes: OpcoesColeta = {},
): Promise<ResultadoColetaFeed> {
  const agora = opcoes.agora ?? new Date();
  const buscar = opcoes.buscar ?? fetch;
  const horario = agora.toISOString();

  try {
    const resposta = await buscar(feed.url);
    if (!resposta.ok) {
      return {
        registro: {
          fonteId,
          feedId: feed.id,
          horario,
          resultado: 'falha',
          motivo: `HTTP ${resposta.status}`,
        },
        itens: [],
      };
    }
    const bytes = await resposta.arrayBuffer();
    const corpo = decodificarCorpo(bytes, resposta.headers.get('content-type'));
    const itens = analisarFeed(corpo, feed, fonteId);
    return {
      registro: {
        fonteId,
        feedId: feed.id,
        horario,
        resultado: 'ok',
        itensObtidos: itens.length,
      },
      itens,
    };
  } catch (erro) {
    return {
      registro: {
        fonteId,
        feedId: feed.id,
        horario,
        resultado: 'falha',
        motivo:
          erro instanceof Error ? erro.message : 'erro desconhecido na busca do feed',
      },
      itens: [],
    };
  }
}

function frequenciaAtingida(
  agora: Date,
  ultimaTentativaEm: string | null | undefined,
  frequenciaMaximaMin: number,
): boolean {
  if (ultimaTentativaEm === null || ultimaTentativaEm === undefined) return false;
  const instanteAnterior = new Date(ultimaTentativaEm).getTime();
  if (Number.isNaN(instanteAnterior)) return false; // data inválida: na dúvida, busca
  const decorridoMin = (agora.getTime() - instanteAnterior) / 60_000;
  return decorridoMin < frequenciaMaximaMin;
}

/**
 * Busca todos os feeds de uma fonte, respeitando `frequenciaMaximaMin`
 * (CA-15.7): se o intervalo mínimo desde `ultimaTentativaEm` ainda não
 * passou, pula a busca real e registra `'pulado'` para cada feed da fonte
 * (CA-15.1). Fonte sem nenhum feed configurado (ex.: GE com
 * `verificacao.estado: 'pendente'`, SDD §3.1) ainda assim gera um registro —
 * nunca fica "muda" no diagnóstico de RNF-11.
 */
export async function coletarFonte(
  fonte: FonteParaColeta,
  ultimaTentativaEm: string | null | undefined,
  opcoes: OpcoesColeta = {},
): Promise<ResultadoColetaFonte> {
  const agora = opcoes.agora ?? new Date();
  const horario = agora.toISOString();

  if (fonte.feeds.length === 0) {
    return {
      fonteId: fonte.id,
      registros: [
        {
          fonteId: fonte.id,
          feedId: '(nenhum)',
          horario,
          resultado: 'pulado',
          motivo: 'fonte sem feed configurado no catálogo (verificacao.estado pendente)',
        },
      ],
      itens: [],
    };
  }

  if (frequenciaAtingida(agora, ultimaTentativaEm, fonte.frequenciaMaximaMin)) {
    return {
      fonteId: fonte.id,
      registros: fonte.feeds.map((feed) => ({
        fonteId: fonte.id,
        feedId: feed.id,
        horario,
        resultado: 'pulado' as const,
        motivo: `frequenciaMaximaMin (${fonte.frequenciaMaximaMin} min) ainda não atingida (CA-15.7)`,
      })),
      itens: [],
    };
  }

  const resultados = await Promise.all(
    fonte.feeds.map((feed) => coletarFeed(feed, fonte.id, opcoes)),
  );

  return {
    fonteId: fonte.id,
    registros: resultados.map((resultado) => resultado.registro),
    itens: resultados.flatMap((resultado) => resultado.itens),
  };
}

/**
 * Busca todas as fontes do catálogo. `ultimaTentativaPorFonte` é o estado
 * anterior de tentativa por fonte (de `ingestao/status.json`, SDD §5.4) —
 * injetado, nunca lido diretamente por este módulo: quem orquestra o estado
 * entre execuções é ING-N-07, não `coletor-rss`.
 */
export async function coletarCatalogo(
  fontes: FonteParaColeta[],
  ultimaTentativaPorFonte: Record<string, string | null | undefined>,
  opcoes: OpcoesColeta = {},
): Promise<ResultadoColetaFonte[]> {
  const resultados: ResultadoColetaFonte[] = [];
  for (const fonte of fontes) {
    resultados.push(await coletarFonte(fonte, ultimaTentativaPorFonte[fonte.id], opcoes));
  }
  return resultados;
}

const CAMINHO_CATALOGO = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../config/fontes.json',
);

/**
 * Lê e valida `config/fontes.json` contra `catalogoFontesSchema` (CFG-05) e
 * projeta para o formato mínimo que este módulo precisa (`FonteParaColeta`).
 * Lança em caso de catálogo inválido — nunca corrige heuristicamente
 * (GUARDRAILS.md §4). Parâmetro `caminho` existe só para teste com fixture.
 */
export function carregarCatalogoFontes(
  caminho: string = CAMINHO_CATALOGO,
): FonteParaColeta[] {
  const bruto = readFileSync(caminho, 'utf8');
  const json: unknown = JSON.parse(bruto);
  const fontes = catalogoFontesSchema.parse(json);
  return fontes.map((fonte) => ({
    id: fonte.id,
    frequenciaMaximaMin: fonte.frequenciaMaximaMin,
    feeds: fonte.feeds.map((feed) => ({
      id: feed.id,
      url: feed.url,
      formato: feed.formato,
      esporteFixado: feed.esporteFixado,
    })),
  }));
}
