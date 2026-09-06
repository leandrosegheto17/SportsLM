// dominio/noticias/normalizador-item.ts — ING-N-02 (TASK.md Lote 4)
//
// `normalizador-item`: decodifica entidades, remove marcação, corta
// título/resumo com reticências, resolve data/fuso e valida o resultado
// contra esquema (CA-15.2, CA-04.3, CA-04.6, ADR-011). Módulo puro, sem I/O
// (GUARDRAILS.md §5) — nenhum `fetch`, sem `Date.now()` (o relógio de
// ingestão entra por parâmetro, `agora: Date`, mesmo padrão de
// `dominio/frescor.ts`/Diretriz #2 do TASK.md §1).
//
// Decisão de localização registrada (TASK.md §6): fica em `dominio/`, não em
// `pipeline/`. A tarefa permitia as duas alternativas ("módulo puro... pode
// viver em `dominio/`... ou em `pipeline/` se depender de alguma lib de
// sanitização com efeitos colaterais"). Decodificação de entidades e remoção
// de marcação HTML são só transformação de string — não precisam de nenhuma
// lib de parsing DOM/rede; as únicas dependências de runtime autorizadas para
// isso (`fast-xml-parser`, TASK.md §1 Diretriz #3) já cobrem o *parsing* do
// XML do feed (isso é ING-N-01, `coletor-rss`), não a sanitização de texto já
// extraído. Implementando a sanitização com regex puro de string, o módulo
// não precisa de nenhuma dependência nova e pode ficar em `dominio/`,
// reaproveitável tanto pelo pipeline de ingestão (Node) quanto, se um dia
// necessário, por um teste/preview na SPA — sem I/O de rede/disco em nenhum
// dos dois casos.
//
// Decisão de escopo registrada (TASK.md §6, não é mudança de contrato): a
// saída desta tarefa NÃO é `ItemNoticia` completo (`dominio/tipos/noticias.ts`,
// DOM-01). Campos como `id` (sha256 do link canônico, CA-15.3 — depende de
// `crypto`, não disponível de forma pura/universal em `dominio/`), `esporte`/
// `origemClassificacao` (ING-N-03, ainda não rodou) e `grupoId` (ING-N-04,
// ainda não rodou) simplesmente não existem no momento em que
// `normalizador-item` roda no pipeline (ING-N-01 → 02 → 03 → 04, SDD §2.3).
// Preencher esses campos aqui com placeholder inventado misturaria o escopo
// desta tarefa com o de ING-N-03/04/07 (TASK.md §Guardrails do Coordenador:
// não misturar mais de um componente de pipeline/domínio). Em vez disso, este
// módulo define e valida `ItemNormalizado` — exatamente os campos que
// `normalizador-item` é responsável por produzir (CA-15.2: "armazenar título,
// link, fonte, data (ou ingestão marcada estimada), resumo") — reaproveitando
// `linkHttpSchema`/`dataHoraIsoSchema` de `dominio/tipos/comuns.ts` (DOM-01)
// em vez de duplicar as mesmas regras já usadas por `itemNoticiaSchema`. A
// orquestração (ING-N-07) é quem completa `ItemNormalizado` até
// `ItemNoticia`, acrescentando `id`/`fonteId`+`feedId` (já presentes aqui)/
// `esporte`/`origemClassificacao`/`grupoId`/`ingeridoEm` nas etapas seguintes.

import { z } from 'zod';
import { linkHttpSchema, dataHoraIsoSchema } from '../tipos/comuns';

/** Limite de título — 180 caracteres (CA-04.3/ADR-011). */
export const LIMITE_TITULO = 180;
/** Limite de resumo — 300 caracteres (CA-04.3/ADR-011, "a confirmar" fixado pelo ADR-011). */
export const LIMITE_RESUMO = 300;

/** Deslocamento fixo de Brasília usado em todo o produto (RNF-02):
 * `America/Sao_Paulo` sem horário de verão desde 2019, portanto `-03:00`
 * constante — não depende de calendário/`Intl` para variar por época do ano. */
const OFFSET_BRASILIA_MINUTOS = -180;

const RETICENCIAS = '…';

/**
 * Item bruto tal como extraído de um feed RSS/Atom, antes de qualquer
 * sanitização (entrada de `ING-N-01`, `coletor-rss`). Tipo provisório desta
 * tarefa: `ING-N-02` só depende de `DOM-01` (TASK.md §3), não de `ING-N-01`
 * (que roda em paralelo, Status "Pendente" no momento desta implementação) —
 * se o formato real produzido por `coletor-rss` divergir destes nomes de
 * campo, é ajuste mecânico de adaptação na orquestração (ING-N-07), não
 * mudança de comportamento deste módulo.
 */
export interface ItemBrutoFeed {
  readonly fonteId: string;
  readonly feedId: string;
  /** `title` bruto do feed — pode conter entidades e marcação HTML. */
  readonly tituloBruto: string;
  /** `description`/`summary` bruto do feed, ou `null` se o feed não trouxer (E4). */
  readonly resumoBruto: string | null;
  /** `link`/`href` bruto do feed — validado como http(s) absoluto (ADR-011). */
  readonly linkBruto: string;
  /** `pubDate`/`updated` bruto do feed, em qualquer formato reconhecido por
   * `Date.parse` (RFC 2822, ISO 8601, ...), ou `null` se o feed não trouxer. */
  readonly publicadoEmBruto: string | null;
}

/** Saída de `normalizador-item` (ING-N-02) — subconjunto de `ItemNoticia`
 * (DOM-01) já resolvido por esta tarefa; ver nota de escopo no topo do arquivo. */
export const itemNormalizadoSchema = z.object({
  fonteId: z.string().min(1),
  feedId: z.string().min(1),
  titulo: z.string().min(1).max(LIMITE_TITULO), // texto puro, já sem marcação (CA-04.3)
  resumo: z.string().min(1).max(LIMITE_RESUMO).nullable(), // texto puro, '…' se truncado (CA-04.3)
  link: linkHttpSchema, // ADR-011: só http(s) absoluto, senão o item é descartado antes de chegar aqui
  publicadoEm: dataHoraIsoSchema, // ISO 8601, sempre com offset -03:00 (RNF-02)
  dataEstimada: z.boolean(), // true → rótulo "horário estimado" (CA-04.6)
});

export type ItemNormalizado = z.infer<typeof itemNormalizadoSchema>;

/** Entidades HTML nomeadas mais comuns em feeds de notícia em pt-BR. Lista
 * fechada e pequena de propósito — cobre o que aparece na prática; qualquer
 * entidade fora desta lista fica textualmente intacta (não é erro: nomes de
 * entidade desconhecidos não são um vetor de injeção, só texto não decodificado). */
const ENTIDADES_NOMEADAS: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  eacute: 'é',
  aacute: 'á',
  atilde: 'ã',
  acirc: 'â',
  ccedil: 'ç',
  oacute: 'ó',
  otilde: 'õ',
  uacute: 'ú',
  iacute: 'í',
};

/**
 * Decodifica entidades HTML nomeadas (`&amp;`), numéricas decimais (`&#39;`)
 * e numéricas hexadecimais (`&#x27;`) — passo 1 de ADR-011 ("decodificação de
 * entidades → remoção completa de marcação..."). Roda **antes** da remoção de
 * marcação de propósito: um payload de evasão como `&lt;script&gt;` só vira
 * `<script>` (e portanto é removido no próximo passo) por causa desta ordem —
 * decodificar depois de remover marcação deixaria a tag escapar intacta.
 */
export function decodificarEntidadesHtml(texto: string): string {
  return texto
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    )
    .replace(/&([a-zA-Z]+);/g, (correspondencia, nome: string) => {
      const chave = nome.toLowerCase();
      const substituta = ENTIDADES_NOMEADAS[chave];
      return substituta !== undefined ? substituta : correspondencia;
    });
}

/**
 * Remove toda marcação HTML (ADR-011: "nenhuma tag sobrevive, nem `<b>`").
 * Conteúdo de `<script>`/`<style>` é removido por inteiro (tag + conteúdo),
 * não só a tag — evita que texto de código vaze para título/resumo. Toda
 * outra tag é substituída por um espaço (não por string vazia), para não
 * colar palavras que só estavam separadas por uma tag (ex.: `foo<br>bar`).
 */
export function removerMarcacaoHtml(texto: string): string {
  const semScriptOuEstilo = texto.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  return semScriptOuEstilo.replace(/<[^>]*>/g, ' ');
}

/** Colapsa qualquer sequência de espaço em branco em um único espaço e apara as pontas. */
export function colapsarEspacos(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/**
 * Corta `texto` em `limite` caracteres com reticências (`…`), preferindo
 * cortar em fronteira de palavra (ADR-011 passo 1: "truncamento em fronteira
 * de palavra"). Se não houver espaço utilizável antes do limite, corta no
 * próprio limite de caractere (garantia de que o resultado nunca excede `limite`).
 */
export function truncarComReticencias(texto: string, limite: number): string {
  if (texto.length <= limite) {
    return texto;
  }
  const limiteUtil = Math.max(0, limite - RETICENCIAS.length);
  const cortado = texto.slice(0, limiteUtil);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  const cortadoNaFronteira = ultimoEspaco > 0 ? cortado.slice(0, ultimoEspaco) : cortado;
  return `${cortadoNaFronteira.trimEnd()}${RETICENCIAS}`;
}

/**
 * Pipeline completo de sanitização de um campo de texto (título ou resumo),
 * na ordem exata do ADR-011: decodifica entidades → remove marcação → colapsa
 * espaços → corta com reticências.
 */
export function sanitizarTexto(bruto: string, limite: number): string {
  const decodificado = decodificarEntidadesHtml(bruto);
  const semMarcacao = removerMarcacaoHtml(decodificado);
  const colapsado = colapsarEspacos(semMarcacao);
  return truncarComReticencias(colapsado, limite);
}

/**
 * Valida `linkBruto` como URL absoluta `http(s)` (ADR-011 passo 2). Qualquer
 * outro esquema (`javascript:`, `data:`, `file:`, ...) ou URL relativa
 * resulta em `null` — o chamador descarta o item inteiro, sem tentativa de
 * conserto (Diretriz #6 do TASK.md §1).
 */
export function resolverLinkHttp(linkBruto: string): string | null {
  const resultado = linkHttpSchema.safeParse(linkBruto.trim());
  return resultado.success ? resultado.data : null;
}

function preencherComZeros(numero: number, largura: number): string {
  return numero.toString().padStart(largura, '0');
}

/**
 * Formata `instante` (um ponto no tempo absoluto, UTC internamente) como ISO
 * 8601 com o deslocamento fixo de Brasília `-03:00` (RNF-02) — não usa
 * `Intl`/fuso do sistema operacional, só aritmética de milissegundos, para o
 * resultado ser determinístico em qualquer ambiente de execução (CI, browser).
 */
export function formatarIsoOffsetBrasilia(instante: Date): string {
  const comOffset = new Date(instante.getTime() + OFFSET_BRASILIA_MINUTOS * 60_000);
  const ano = comOffset.getUTCFullYear();
  const mes = preencherComZeros(comOffset.getUTCMonth() + 1, 2);
  const dia = preencherComZeros(comOffset.getUTCDate(), 2);
  const hora = preencherComZeros(comOffset.getUTCHours(), 2);
  const minuto = preencherComZeros(comOffset.getUTCMinutes(), 2);
  const segundo = preencherComZeros(comOffset.getUTCSeconds(), 2);
  return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}-03:00`;
}

/** Resultado de `resolverDataPublicacao`. */
export interface DataPublicacaoResolvida {
  readonly publicadoEm: string;
  readonly dataEstimada: boolean;
}

/**
 * Resolve `publicadoEmBruto` para o formato canônico do produto (CA-15.2,
 * CA-04.6, ADR-011 passo 3): se o feed trouxe uma data reconhecível (em
 * qualquer fuso — `Date.parse` resolve o deslocamento original antes de
 * reformatar em `-03:00`), usa-a. Caso contrário (ausente ou não parseável),
 * usa `agora` — o instante de ingestão, que **entra por parâmetro** (nunca
 * `Date.now()` dentro deste módulo puro, Diretriz #2 do TASK.md §1; quem lê o
 * relógio de verdade é o chamador impuro, o pipeline) — e marca `dataEstimada: true`.
 */
export function resolverDataPublicacao(
  publicadoEmBruto: string | null,
  agora: Date,
): DataPublicacaoResolvida {
  if (publicadoEmBruto !== null) {
    const timestamp = Date.parse(publicadoEmBruto);
    if (!Number.isNaN(timestamp)) {
      return {
        publicadoEm: formatarIsoOffsetBrasilia(new Date(timestamp)),
        dataEstimada: false,
      };
    }
  }
  return { publicadoEm: formatarIsoOffsetBrasilia(agora), dataEstimada: true };
}

/**
 * Normaliza um `ItemBrutoFeed` em `ItemNormalizado` (ING-N-02). Retorna
 * `null` quando o item deve ser descartado (Diretriz #6 do TASK.md §1: falha
 * de validação é descarte com registro, nunca correção heurística) — hoje os
 * dois motivos possíveis são: (a) `link` não é `http(s)` absoluto (ADR-011
 * passo 2), ou (b) o título, depois de sanitizado, fica vazio (não há o que
 * exibir — `itemNormalizadoSchema` exige `titulo` não vazio). O registro do
 * descarte (`status.json`, ADR-011) é responsabilidade de quem chama este
 * módulo puro (a orquestração, ING-N-07), não deste módulo.
 *
 * `agora` é o instante de ingestão, usado só como fallback de data ausente/
 * inválida (CA-04.6) — nunca lido internamente (`Date.now()` proibido em
 * `dominio/`, Diretriz #2 do TASK.md §1).
 */
export function normalizarItem(
  bruto: ItemBrutoFeed,
  agora: Date,
): ItemNormalizado | null {
  const link = resolverLinkHttp(bruto.linkBruto);
  if (link === null) {
    return null;
  }

  const titulo = sanitizarTexto(bruto.tituloBruto, LIMITE_TITULO);

  const resumoSanitizado =
    bruto.resumoBruto === null ? null : sanitizarTexto(bruto.resumoBruto, LIMITE_RESUMO);
  const resumo =
    resumoSanitizado === null || resumoSanitizado.length === 0 ? null : resumoSanitizado;

  const { publicadoEm, dataEstimada } = resolverDataPublicacao(
    bruto.publicadoEmBruto,
    agora,
  );

  const candidato: ItemNormalizado = {
    fonteId: bruto.fonteId,
    feedId: bruto.feedId,
    titulo,
    resumo,
    link,
    publicadoEm,
    dataEstimada,
  };

  const resultado = itemNormalizadoSchema.safeParse(candidato);
  return resultado.success ? resultado.data : null;
}
