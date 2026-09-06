// dominio/retencao.test.ts — ING-N-06 (TASK.md Lote 4)
//
// Testes por tabela cobrindo CA-15.8 (7 dias, condicional aos 30 mais
// recentes "de qualquer visão" — interpretada como por fonte, ver comentário
// em `retencao.ts`) e o teto de 60 itens por fonte do SDD §2.2. Relógio
// sempre por parâmetro — nenhum teste usa `Date.now()`.

import { describe, expect, it } from 'vitest';
import type { ItemNoticia } from './tipos/noticias';
import {
  aplicarRetencao,
  RETENCAO_DIAS,
  TETO_ITENS_POR_FONTE,
  TOP_N_MAIS_RECENTES_POR_FONTE,
} from './retencao';

const AGORA = new Date('2026-09-06T12:00:00-03:00');

function diasAtras(dias: number): string {
  return new Date(AGORA.getTime() - dias * 86_400_000).toISOString();
}

function horasAtras(horas: number): string {
  return new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
}

/** `id` com zero-padding — garante que a comparação lexicográfica de
 * desempate (`a.id < b.id`) coincide com a ordem numérica pretendida nos
 * testes que usam muitos itens da mesma fonte. */
function idNumerado(prefixo: string, indice: number): string {
  return `${prefixo}-${String(indice).padStart(3, '0')}`;
}

function item(overrides: Partial<ItemNoticia> & { id: string }): ItemNoticia {
  return {
    fonteId: 'espn-brasil',
    feedId: 'espn-brasil-geral',
    titulo: `Título ${overrides.id}`,
    resumo: null,
    link: `https://exemplo.com/${overrides.id}`,
    publicadoEm: diasAtras(1),
    dataEstimada: false,
    esporte: 'futebol',
    origemClassificacao: 'categoria',
    grupoId: null,
    ingeridoEm: diasAtras(1),
    ...overrides,
  };
}

describe('aplicarRetencao — CA-15.8 (7 dias, condicional aos 30 mais recentes por fonte)', () => {
  it('mantém item recente (dentro dos 7 dias), independentemente da posição', () => {
    const itens = [item({ id: 'a', publicadoEm: diasAtras(1) })];
    expect(aplicarRetencao(itens, AGORA)).toEqual(itens);
  });

  it('mantém item exatamente no limite de 7 dias (não excedeu ainda)', () => {
    const itens = [item({ id: 'a', publicadoEm: diasAtras(RETENCAO_DIAS) })];
    expect(aplicarRetencao(itens, AGORA)).toEqual(itens);
  });

  it('descarta item com mais de 7 dias que não está entre os 30 mais recentes da fonte', () => {
    // 31 itens antigos da mesma fonte: o 31º (mais antigo) fica de fora do top-30.
    const itens = Array.from({ length: 31 }, (_, i) =>
      item({ id: `antigo-${i}`, publicadoEm: diasAtras(10 + i) }),
    );
    const resultado = aplicarRetencao(itens, AGORA);
    const idsResultado = resultado.map((r) => r.id);

    expect(resultado).toHaveLength(30);
    expect(idsResultado).not.toContain('antigo-30'); // o mais antigo dos 31
    expect(idsResultado).toContain('antigo-0'); // o mais recente dos 31
  });

  it('mantém item com mais de 7 dias se está entre os 30 mais recentes da fonte (SDD §2.2, pior visão: só essa fonte restante)', () => {
    const itens = Array.from({ length: TOP_N_MAIS_RECENTES_POR_FONTE }, (_, i) =>
      item({ id: `item-${i}`, publicadoEm: diasAtras(10 + i) }),
    );
    const resultado = aplicarRetencao(itens, AGORA);
    expect(resultado).toHaveLength(TOP_N_MAIS_RECENTES_POR_FONTE);
    expect(resultado.map((r) => r.id).sort()).toEqual(itens.map((i) => i.id).sort());
  });

  it('a posição "entre os 30 mais recentes" é calculada por fonte, não globalmente', () => {
    // Fonte A tem 40 itens antigos; fonte B tem 1 item antigo. Cada fonte
    // decide seu próprio top-30 independentemente da outra.
    const fonteA = Array.from({ length: 40 }, (_, i) =>
      item({ id: `a-${i}`, fonteId: 'fonte-a', publicadoEm: diasAtras(10 + i) }),
    );
    const fonteB = [item({ id: 'b-0', fonteId: 'fonte-b', publicadoEm: diasAtras(10) })];

    const resultado = aplicarRetencao([...fonteA, ...fonteB], AGORA);
    const ids = resultado.map((r) => r.id);

    // fonte-a: só os 30 mais recentes (a-0..a-29) sobrevivem
    expect(ids.filter((id) => id.startsWith('a-'))).toHaveLength(30);
    expect(ids).toContain('a-29');
    expect(ids).not.toContain('a-39');
    // fonte-b: seu único item, mesmo com mais de 7 dias, é o mais recente dela → sobrevive
    expect(ids).toContain('b-0');
  });
});

describe('aplicarRetencao — teto de 60 itens por fonte (SDD §2.2)', () => {
  it('nunca mantém mais que o teto de uma mesma fonte, mesmo todos dentro da retenção de 7 dias', () => {
    // Todos com o mesmo `publicadoEm` (dentro da retenção) — o teto de 60
    // precisa cortar mesmo sem nenhum critério de recência os distinguindo,
    // usando o desempate determinístico por `id`.
    const itens = Array.from({ length: 80 }, (_, i) =>
      item({ id: idNumerado('f', i), publicadoEm: horasAtras(1) }),
    );
    const resultado = aplicarRetencao(itens, AGORA);

    expect(resultado).toHaveLength(TETO_ITENS_POR_FONTE);
    expect(resultado.map((r) => r.id)).toEqual(
      Array.from({ length: 60 }, (_, i) => idNumerado('f', i)),
    );
  });

  it('o teto é aplicado por fonte, não no total', () => {
    const fonteA = Array.from({ length: 80 }, (_, i) =>
      item({ id: idNumerado('a', i), fonteId: 'fonte-a', publicadoEm: horasAtras(1) }),
    );
    const fonteB = Array.from({ length: 80 }, (_, i) =>
      item({ id: idNumerado('b', i), fonteId: 'fonte-b', publicadoEm: horasAtras(1) }),
    );

    const resultado = aplicarRetencao([...fonteA, ...fonteB], AGORA);
    expect(resultado).toHaveLength(120); // 60 de cada fonte
    expect(resultado.filter((r) => r.fonteId === 'fonte-a')).toHaveLength(60);
    expect(resultado.filter((r) => r.fonteId === 'fonte-b')).toHaveLength(60);
  });

  it('o teto corta pelos mais antigos primeiro, preservando os mais recentes (mesmo todos dentro da retenção)', () => {
    // Todos dentro da janela de 7 dias (horas, não dias) — isola o efeito do
    // teto de 60, sem depender do corte "top 30 mais recentes" de CA-15.8.
    const itens = Array.from({ length: 65 }, (_, i) =>
      item({ id: idNumerado('g', i), publicadoEm: horasAtras(i) }),
    );
    const resultado = aplicarRetencao(itens, AGORA);
    const ids = resultado.map((r) => r.id);

    expect(resultado).toHaveLength(TETO_ITENS_POR_FONTE);
    expect(ids).toContain(idNumerado('g', 0)); // mais recente
    expect(ids).toContain(idNumerado('g', 59)); // 60º mais recente
    expect(ids).not.toContain(idNumerado('g', 60)); // 61º mais recente, fora do teto
    expect(ids).not.toContain(idNumerado('g', 64));
  });
});

describe('aplicarRetencao — comportamento geral', () => {
  it('lista vazia retorna lista vazia', () => {
    expect(aplicarRetencao([], AGORA)).toEqual([]);
  });

  it('é uma função pura: não muta a lista de entrada', () => {
    const itens = [item({ id: 'a', publicadoEm: diasAtras(1) })];
    const copiaOriginal = [...itens];
    aplicarRetencao(itens, AGORA);
    expect(itens).toEqual(copiaOriginal);
  });

  it('preserva a ordem relativa de entrada no retorno (filtro, não reordenação)', () => {
    const itens = [
      item({ id: 'z', publicadoEm: diasAtras(1) }),
      item({ id: 'y', publicadoEm: diasAtras(2) }),
      item({ id: 'x', publicadoEm: diasAtras(3) }),
    ];
    const resultado = aplicarRetencao(itens, AGORA);
    expect(resultado.map((r) => r.id)).toEqual(['z', 'y', 'x']);
  });

  it('data inválida em publicadoEm nunca ocupa uma vaga de "mais recente" nem conta como dentro da retenção', () => {
    // 30 itens válidos e recentes já preenchem o top-30 da fonte; o item com
    // data inválida vira o "mais antigo" (timestamp -Infinity) e não entra
    // nem por estar dentro da retenção, nem por sobrar vaga no top-30.
    const validos = Array.from({ length: TOP_N_MAIS_RECENTES_POR_FONTE }, (_, i) =>
      item({ id: idNumerado('valido', i), publicadoEm: diasAtras(10 + i) }),
    );
    const invalido = item({ id: 'invalido', publicadoEm: 'data-invalida' });
    const resultado = aplicarRetencao([invalido, ...validos], AGORA);

    expect(resultado.map((r) => r.id)).not.toContain('invalido');
    expect(resultado).toHaveLength(TOP_N_MAIS_RECENTES_POR_FONTE);
  });

  it('respeita opções customizadas de retencaoDias/topN/teto', () => {
    const itens = Array.from({ length: 10 }, (_, i) =>
      item({ id: `c-${i}`, publicadoEm: diasAtras(1 + i) }),
    );
    const resultado = aplicarRetencao(itens, AGORA, {
      retencaoDias: 0,
      topNMaisRecentesPorFonte: 3,
      tetoPorFonte: 3,
    });
    expect(resultado).toHaveLength(3);
    expect(resultado.map((r) => r.id)).toEqual(['c-0', 'c-1', 'c-2']);
  });
});
