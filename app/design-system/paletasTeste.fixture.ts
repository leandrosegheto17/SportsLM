// paletasTeste.fixture.ts — UI-DS-01 (TASK.md Lote 7)
//
// `PaletaClube` (dominio/tipos/futebol.ts, DOM-01) só existe de fato a partir
// de PUB-01 (derivador-paleta, Lote 6, ainda não implementado) — o pipeline
// deriva e valida contraste sobre `corBase` de `clubes-2026.json` (ADR-017).
// Isso está previsto e documentado em TASK.md §6, item 6: "UI-DS-01 pode ser
// desenvolvida em paralelo usando paleta mockada/fixture; a integração real
// acontece quando PUB-02 publica o snapshot verdadeiro."
//
// Fixture, não dado real: as 4 paletas de teste exigidas por UX-SPEC §5
// ("uma clara tipo Mirassol, uma escura tipo Palmeiras, uma vermelha tipo
// São Paulo e uma acromática tipo Corinthians"). Os valores de
// `identidade`/`identidadeTexto`/`acento` vêm literalmente da tabela de
// UX-SPEC §3.4 ("Exemplos derivados"); os campos que a tabela não lista
// (`faixaB`, `suave`, `suaveEscuro`, `acentoSobreEscuro`, e os 3 campos
// "Escuro") são uma aproximação razoável meramente para exercitar o
// componente/`axe-core` nos dois temas — a derivação real e a validação de
// contraste definitivas são responsabilidade de PUB-01, não desta fixture.
import type { PaletaClube } from '../../dominio/tipos/futebol';

export interface ClubeDeTeste {
  readonly nome: string;
  readonly sigla: string;
  readonly paleta: PaletaClube;
}

/** São Paulo — vermelha, passa sem ajuste (UX-SPEC §3.4). */
export const CLUBE_TESTE_SAO_PAULO: ClubeDeTeste = {
  nome: 'São Paulo',
  sigla: 'SPA',
  paleta: {
    acromatico: false,
    identidade: '#E30613',
    faixaB: '#B10510',
    identidadeTexto: '#FFFFFF',
    acento: '#E30613',
    acentoSobreEscuro: '#FF6B6B',
    suave: '#FDE7E8',
    suaveEscuro: '#3A1013',
    identidadeEscuro: '#8C040C',
    faixaBEscuro: '#5C0308',
    identidadeTextoEscuro: '#FFFFFF',
  },
};

/** Mirassol — clara/amarela, acento escurecido até 4,5:1 (UX-SPEC §3.4). */
export const CLUBE_TESTE_MIRASSOL: ClubeDeTeste = {
  nome: 'Mirassol',
  sigla: 'MIR',
  paleta: {
    acromatico: false,
    identidade: '#FFDD00',
    faixaB: '#E0C200',
    identidadeTexto: '#16181A',
    acento: '#7A5B00',
    acentoSobreEscuro: '#F5C860',
    suave: '#FFF7D1',
    suaveEscuro: '#332B00',
    identidadeEscuro: '#BFA300',
    faixaBEscuro: '#8C7700',
    identidadeTextoEscuro: '#16181A',
  },
};

/** Palmeiras — escura/verde, passa sem ajuste (UX-SPEC §3.4). */
export const CLUBE_TESTE_PALMEIRAS: ClubeDeTeste = {
  nome: 'Palmeiras',
  sigla: 'PAL',
  paleta: {
    acromatico: false,
    identidade: '#006437',
    faixaB: '#004D2A',
    identidadeTexto: '#FFFFFF',
    acento: '#006437',
    acentoSobreEscuro: '#4FC98D',
    suave: '#E1F0E7',
    suaveEscuro: '#0D2318',
    identidadeEscuro: '#00B85A',
    faixaBEscuro: '#00803D',
    identidadeTextoEscuro: '#0A0F0C',
  },
};

/** Corinthians — acromático, TR-14: preto e branco, faixa-b `#3A3F45`. */
export const CLUBE_TESTE_CORINTHIANS: ClubeDeTeste = {
  nome: 'Corinthians',
  sigla: 'COR',
  paleta: {
    acromatico: true,
    identidade: '#16181A',
    faixaB: '#3A3F45',
    identidadeTexto: '#FFFFFF',
    acento: '#16181A',
    acentoSobreEscuro: '#A8B0BA',
    suave: '#E4E5E7',
    suaveEscuro: '#24272C',
    identidadeEscuro: '#F2EFEA',
    faixaBEscuro: '#7A828C',
    identidadeTextoEscuro: '#16181A',
  },
};

/** As 4 paletas de teste do UX-SPEC §5, na ordem citada pelo texto. */
export const PALETAS_DE_TESTE: readonly ClubeDeTeste[] = [
  CLUBE_TESTE_MIRASSOL,
  CLUBE_TESTE_PALMEIRAS,
  CLUBE_TESTE_SAO_PAULO,
  CLUBE_TESTE_CORINTHIANS,
];
