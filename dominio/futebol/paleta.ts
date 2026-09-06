// dominio/futebol/paleta.ts — PUB-01 (TASK.md Lote 6, ADR-017)
//
// Aritmética pura de cor (conversão hex↔HSL, luminância relativa WCAG, razão
// de contraste) e o algoritmo de derivação de `PaletaClube` a partir de
// `corBase` (ADR-017 §"Decisão", item 2 — algoritmo determinístico, sem
// dependência nova: HSL e contraste WCAG são aritmética simples). Módulo
// puro, sem I/O (GUARDRAILS.md §5) — o ponto de entrada que lê
// `clubes-2026.json` e quebra o build de CI em caso de falha de validação é
// `pipeline/config/derivador-paleta.ts`, que importa este módulo.
//
// Reaproveitamento: `PaletaClube`/`paletaClubeSchema` já existem em
// `dominio/tipos/futebol.ts` (DOM-01) — este módulo importa o tipo de lá em
// vez de redefini-lo, e devolve valores já validados pelo mesmo schema.

import type { PaletaClube } from '../tipos/futebol';

// --- Conversão de cor -------------------------------------------------------

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  /** Matiz, 0–360. */
  h: number;
  /** Saturação, 0–1. */
  s: number;
  /** Luminosidade (lightness), 0–1. */
  l: number;
}

/** `#RRGGBB` → `{r,g,b}` (0–255). Não valida o formato — a entrada já passou
 * por `corHexSchema` (Zod) antes de chegar aqui (TASK.md §1, diretriz 6). */
export function hexParaRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function canal(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');
}

/** `{r,g,b}` (0–255, pode vir fracionário de `hslParaRgb`) → `#RRGGBB`
 * maiúsculo. */
export function rgbParaHex({ r, g, b }: Rgb): string {
  return `#${canal(r)}${canal(g)}${canal(b)}`.toUpperCase();
}

/** RGB → HSL (ADR-017 item 2, passo 1: `hsl = rgbParaHsl(corBase)`). */
export function rgbParaHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = 60 * (((gn - bn) / d) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / d + 2);
  else h = 60 * ((rn - gn) / d + 4);
  if (h < 0) h += 360;

  return { h, s, l };
}

/** HSL → RGB (inverso de `rgbParaHsl`, usado por `ajustarL` e pelos tons
 * planos `suave`/`suaveEscuro`, ADR-017 item 2, passo "SENÃO"). */
export function hslParaRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/** Devolve `corBase` com a mesma matiz/saturação e `l` (0–1, sujeito a
 * clamp) trocado — é `ajustarL` do ADR-017 item 2. */
export function ajustarL(hex: string, novoL: number): string {
  const hsl = rgbParaHsl(hexParaRgb(hex));
  const l = Math.min(1, Math.max(0, novoL));
  return rgbParaHex(hslParaRgb({ h: hsl.h, s: hsl.s, l }));
}

// --- Contraste WCAG (1.4.3, ADR-014/ADR-017) --------------------------------

/** Razão mínima de contraste exigida por todos os alvos da tabela §3 do
 * ADR-017 (texto normal, WCAG 1.4.3 nível AA). */
export const RAZAO_CONTRASTE_MINIMA = 4.5;

function canalLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/** Luminância relativa WCAG (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance). */
export function luminanciaRelativa(rgb: Rgb): number {
  return (
    0.2126 * canalLinear(rgb.r) +
    0.7152 * canalLinear(rgb.g) +
    0.0722 * canalLinear(rgb.b)
  );
}

/** Razão de contraste WCAG entre duas cores hex — comutativa, sempre ≥ 1. */
export function razaoContraste(hexA: string, hexB: string): number {
  const la = luminanciaRelativa(hexParaRgb(hexA));
  const lb = luminanciaRelativa(hexParaRgb(hexB));
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

// --- Cores fixas do sistema usadas como alvo de validação (ADR-017 §3) -----
// Literais do próprio ADR-017 (não de `app/design-system/tokens.css`
// diretamente — o ADR fixa estes valores explicitamente como alvo de
// validação, independente de qual tema está ativo no momento; ver ADR-017
// item "acentoSobreEscuro = clarearAte(... vs #16181A E vs #121316)").
export const CORES_FIXAS_VALIDACAO = {
  /** `--cor-fundo` tema claro (`app/design-system/tokens.css`). */
  fundoClaro: '#FAF7F2',
  /** `--cor-superficie` tema claro. */
  superficieClara: '#FFFFFF',
  /** `--cor-nav` (fixo, não varia por escolha de time). */
  nav: '#16181A',
  /** `--cor-fundo` tema escuro. */
  fundoEscuro: '#121316',
  /** `--cor-tinta` tema claro. */
  tintaClara: '#16181A',
  /** `--cor-tinta` tema escuro. */
  tintaEscura: '#F2EFEA',
} as const;

const BRANCO = '#FFFFFF';

// --- Derivação (ADR-017 item 2) ---------------------------------------------

/** `acromatico = (s < 0,15) OU (l < 0,10) OU (l > 0,93)` — ADR-017 item 2,
 * passo 2. Recebe `corBase` em hex, não HSL, para ser a mesma checagem usada
 * tanto por `derivarPaleta` quanto por qualquer chamador externo. */
export function ehAcromatico(corBase: string): boolean {
  const hsl = rgbParaHsl(hexParaRgb(corBase));
  return hsl.s < 0.15 || hsl.l < 0.1 || hsl.l > 0.93;
}

/** Paleta fixa para clubes acromáticos (Corinthians, Botafogo, Santos,
 * Vasco, Atlético-MG, Ceará) — ADR-017 item 2, ramo "SE acromatico". Valores
 * literais do próprio ADR, não recalculados a partir de `corBase` (que, para
 * estes clubes, é só `#000000`/preto — a "cor do clube" é a tinta do
 * sistema, não uma derivação HSL). */
const PALETA_ACROMATICA: PaletaClube = {
  acromatico: true,
  identidade: '#16181A',
  faixaB: '#3A3F45',
  identidadeTexto: '#FFFFFF',
  acento: '#16181A',
  acentoSobreEscuro: '#F2EFEA',
  suave: '#EDEAE4',
  suaveEscuro: '#24272C',
  identidadeEscuro: '#F2EFEA',
  faixaBEscuro: '#C9C3B8',
  identidadeTextoEscuro: '#16181A',
};

/** Escolhe, entre `#FFFFFF` e a tinta (`#16181A`), o candidato de
 * `identidadeTexto` cujo PIOR contraste (mínimo entre `identidade` e
 * `faixaB`) é maior — ADR-017 item 2: "o que der MAIOR contraste entre
 * #FFFFFF e #16181A, medido contra o PIOR caso entre identidade e faixaB". */
function escolherIdentidadeTexto(identidade: string, faixaB: string): string {
  const candidatos = [BRANCO, CORES_FIXAS_VALIDACAO.tintaClara];
  let melhor = candidatos[0]!;
  let melhorPior = -Infinity;
  for (const candidato of candidatos) {
    const pior = Math.min(
      razaoContraste(candidato, identidade),
      razaoContraste(candidato, faixaB),
    );
    if (pior > melhorPior) {
      melhorPior = pior;
      melhor = candidato;
    }
  }
  return melhor;
}

/** Passo iterativo `escurecerAte`/`clarearAte` (ADR-017 item 2): parte de
 * `corBase` e move `l` na direção indicada (−1 escurece, +1 clareia) em
 * incrementos de `passo`, até `condicaoOk` ser satisfeita ou `l` atingir o
 * piso/teto — o que vier primeiro. Se o piso/teto é atingido sem satisfazer a
 * condição, devolve o valor no limite mesmo assim: quem decide se isso é
 * aceitável é `validarPaleta` (passo 4 do ADR — "falha em qualquer um = falha
 * de build", nunca uma correção silenciosa aqui). */
function ajustarAte(
  corBase: string,
  condicaoOk: (hex: string) => boolean,
  direcao: -1 | 1,
  piso: number,
  teto: number,
  passo = 0.02,
): string {
  const hslInicial = rgbParaHsl(hexParaRgb(corBase));
  let l = hslInicial.l;
  let hex = ajustarL(corBase, l);

  while (!condicaoOk(hex)) {
    const limite = direcao < 0 ? piso : teto;
    if ((direcao < 0 && l <= limite) || (direcao > 0 && l >= limite)) break;
    l = direcao < 0 ? Math.max(limite, l - passo) : Math.min(limite, l + passo);
    hex = ajustarL(corBase, l);
  }

  return hex;
}

/**
 * Deriva `PaletaClube` a partir de `corBase` (ADR-017 item 2, algoritmo
 * determinístico). `paletaManual`, quando informado, sobrescreve campo a
 * campo o resultado da derivação (ADR-017 item 2, passo 5: "Override manual
 * por clube é permitido... e passa exatamente pela mesma validação do passo
 * 4") — quem valida o resultado final é sempre `validarPaleta`, nunca este
 * override por si.
 */
export function derivarPaleta(
  corBase: string,
  paletaManual?: Partial<PaletaClube>,
): PaletaClube {
  const base = ehAcromatico(corBase)
    ? PALETA_ACROMATICA
    : derivarPaletaCromatica(corBase);
  return paletaManual === undefined ? base : { ...base, ...paletaManual };
}

function derivarPaletaCromatica(corBase: string): PaletaClube {
  const hsl = rgbParaHsl(hexParaRgb(corBase));

  const identidade = corBase;
  const faixaB = ajustarL(corBase, hsl.l >= 0.3 ? hsl.l - 0.08 : hsl.l + 0.08);
  const identidadeTexto = escolherIdentidadeTexto(identidade, faixaB);

  const acento = ajustarAte(
    corBase,
    (hex) =>
      razaoContraste(hex, CORES_FIXAS_VALIDACAO.fundoClaro) >= RAZAO_CONTRASTE_MINIMA &&
      razaoContraste(hex, CORES_FIXAS_VALIDACAO.superficieClara) >=
        RAZAO_CONTRASTE_MINIMA,
    -1,
    0.08,
    1,
  );

  const acentoSobreEscuro = ajustarAte(
    corBase,
    (hex) =>
      razaoContraste(hex, CORES_FIXAS_VALIDACAO.nav) >= RAZAO_CONTRASTE_MINIMA &&
      razaoContraste(hex, CORES_FIXAS_VALIDACAO.fundoEscuro) >= RAZAO_CONTRASTE_MINIMA,
    1,
    0,
    0.92,
  );

  const suave = rgbParaHex(hslParaRgb({ h: hsl.h, s: Math.min(hsl.s, 0.45), l: 0.94 }));
  const suaveEscuro = rgbParaHex(
    hslParaRgb({ h: hsl.h, s: Math.min(hsl.s, 0.45), l: 0.16 }),
  );

  // Decisão de detalhe registrada (TASK.md §6): o ADR-017 pseudocódigo, no
  // ramo "SENÃO" (clube cromático), não define `identidadeEscuro`/
  // `faixaBEscuro`/`identidadeTextoEscuro` — só o ramo acromático os define
  // explicitamente. Interpretação adotada: para clubes cromáticos a cor
  // "crua" de identidade não muda por tema (ADR-017 item 1: "Mantém a cor
  // oficial sem alteração" é o próprio ponto da superfície grande, em
  // qualquer tema — só o contorno de 1px, já resolvido por
  // `--cor-borda-forte` por tema, muda), então os 3 campos "Escuro" reusam o
  // valor claro sem alteração. Isso não introduz nenhum alvo de contraste
  // novo além dos 8 do ADR-017 §3 (o schema de `PaletaClube` exige os campos
  // presentes, mas a tabela de validação não lista um alvo próprio para
  // eles).
  return {
    acromatico: false,
    identidade,
    faixaB,
    identidadeTexto,
    acento,
    acentoSobreEscuro,
    suave,
    suaveEscuro,
    identidadeEscuro: identidade,
    faixaBEscuro: faixaB,
    identidadeTextoEscuro: identidadeTexto,
  };
}

// --- Validação (ADR-017 item 2, passo 4 + tabela §3) ------------------------

export interface ResultadoValidacaoPaleta {
  valido: boolean;
  /** Uma entrada por alvo de contraste que falhou (lista vazia = válido). */
  erros: string[];
}

interface AlvoContraste {
  nome: string;
  corA: string;
  corB: string;
}

/** Os 8 alvos de contraste do ADR-017 §3 (todos ≥ 4,5:1, WCAG 1.4.3):
 * 1–2: `identidadeTexto` vs `identidade`/`faixaB`; 3–4: `acento` vs
 * `--cor-fundo`/`--cor-superficie`; 5–6: `acentoSobreEscuro` vs
 * `--cor-nav`/`--cor-fundo` (tema escuro); 7: `--cor-tinta` (claro) vs
 * `suave`; 8: `--cor-tinta` (escuro) vs `suaveEscuro`. `identidade`/`faixaB`
 * como preenchimento não têm alvo de cor (1.4.11 por delimitação, resolvido
 * fora deste módulo, no contorno de 1px do componente) — por isso não
 * entram nesta lista. */
function alvosContraste(paleta: PaletaClube): AlvoContraste[] {
  return [
    {
      nome: 'identidadeTexto vs identidade',
      corA: paleta.identidadeTexto,
      corB: paleta.identidade,
    },
    {
      nome: 'identidadeTexto vs faixaB',
      corA: paleta.identidadeTexto,
      corB: paleta.faixaB,
    },
    {
      nome: 'acento vs cor-fundo',
      corA: paleta.acento,
      corB: CORES_FIXAS_VALIDACAO.fundoClaro,
    },
    {
      nome: 'acento vs cor-superficie',
      corA: paleta.acento,
      corB: CORES_FIXAS_VALIDACAO.superficieClara,
    },
    {
      nome: 'acentoSobreEscuro vs cor-nav',
      corA: paleta.acentoSobreEscuro,
      corB: CORES_FIXAS_VALIDACAO.nav,
    },
    {
      nome: 'acentoSobreEscuro vs cor-fundo (escuro)',
      corA: paleta.acentoSobreEscuro,
      corB: CORES_FIXAS_VALIDACAO.fundoEscuro,
    },
    {
      nome: 'cor-tinta vs suave',
      corA: CORES_FIXAS_VALIDACAO.tintaClara,
      corB: paleta.suave,
    },
    {
      nome: 'cor-tinta (escuro) vs suaveEscuro',
      corA: CORES_FIXAS_VALIDACAO.tintaEscura,
      corB: paleta.suaveEscuro,
    },
  ];
}

/**
 * Valida os 8 alvos de contraste do ADR-017 §3. Nunca corrige nada — só
 * relata (GUARDRAILS.md §4). Quem decide o que fazer com `erros` (quebrar o
 * build) é quem chama, em `pipeline/config/derivador-paleta.ts`.
 */
export function validarPaleta(paleta: PaletaClube): ResultadoValidacaoPaleta {
  const erros: string[] = [];
  for (const alvo of alvosContraste(paleta)) {
    const razao = razaoContraste(alvo.corA, alvo.corB);
    if (razao < RAZAO_CONTRASTE_MINIMA) {
      erros.push(
        `${alvo.nome}: ${razao.toFixed(2)}:1 (${alvo.corA} vs ${alvo.corB}) < ${RAZAO_CONTRASTE_MINIMA}:1`,
      );
    }
  }
  return { valido: erros.length === 0, erros };
}
