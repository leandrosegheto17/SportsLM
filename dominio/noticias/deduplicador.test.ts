// dominio/noticias/deduplicador.test.ts — ING-N-04 (TASK.md Lote 4)
//
// Testes por tabela (TASK.md Diretriz #11) cobrindo RN-16 aplicado a itens
// normalizados REAIS — produzidos por `normalizarItem` (ING-N-02), não só
// objetos sintéticos como em `dominio/dedup/dedup.test.ts` (DOM-03). O
// objetivo desta suíte é o ponto de integração: garantir que a saída real de
// `normalizador-item` (título já sanitizado/truncado, data já resolvida em
// ISO -03:00) continua satisfazendo o critério de RN-16 quando passa pelo
// motor de dedup de DOM-03.

import { describe, expect, it } from 'vitest';
import { normalizarItem, type ItemBrutoFeed } from './normalizador-item';
import { deduplicarItensNormalizados, type ItemNormalizadoComId } from './deduplicador';

const AGORA = new Date('2026-09-06T15:00:00.000Z');

/** Constrói um `ItemNormalizadoComId` real, passando por `normalizarItem`
 * (ING-N-02) — exatamente como a orquestração (ING-N-07) produziria antes de
 * chamar o deduplicador — e atribuindo `id` (na orquestração real, sha256 do
 * link canônico, CA-15.3; aqui um id de teste estável e único). */
function itemReal(
  id: string,
  bruto: Partial<ItemBrutoFeed> & { fonteId: string },
): ItemNormalizadoComId {
  const base: ItemBrutoFeed = {
    fonteId: bruto.fonteId,
    feedId: bruto.feedId ?? `${bruto.fonteId}-feed`,
    tituloBruto: bruto.tituloBruto ?? 'Título de teste',
    resumoBruto: bruto.resumoBruto ?? null,
    linkBruto: bruto.linkBruto ?? `https://exemplo.com/${id}`,
    publicadoEmBruto: bruto.publicadoEmBruto ?? null,
  };
  const normalizado = normalizarItem(base, AGORA);
  if (normalizado === null) {
    throw new Error(`item de teste "${id}" foi descartado por normalizarItem`);
  }
  return { ...normalizado, id };
}

describe('deduplicarItensNormalizados — RN-16 sobre ItemNormalizado real (ING-N-02)', () => {
  it('CA-19.1: fontes distintas, título similar, dentro de 12h → mesmo grupoId', () => {
    const a = itemReal('a', {
      fonteId: 'ge',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1 no Allianz Parque',
      publicadoEmBruto: '2026-09-06T12:00:00Z',
    });
    const b = itemReal('b', {
      fonteId: 'espn',
      tituloBruto: 'Palmeiras vence Santos por 2 a 1 no Allianz Parque',
      publicadoEmBruto: '2026-09-06T12:30:00Z',
    });

    const resultado = deduplicarItensNormalizados([a, b]);

    const resA = resultado.find((item) => item.id === 'a');
    const resB = resultado.find((item) => item.id === 'b');
    expect(resA?.grupoId).not.toBeNull();
    expect(resA?.grupoId).toBe(resB?.grupoId);
  });

  it('mesma fonte nunca agrupa, mesmo com título idêntico e mesma data', () => {
    const a = itemReal('a', {
      fonteId: 'ge',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      linkBruto: 'https://ge.globo.com/a',
      publicadoEmBruto: '2026-09-06T12:00:00Z',
    });
    const b = itemReal('b', {
      fonteId: 'ge',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      linkBruto: 'https://ge.globo.com/b',
      publicadoEmBruto: '2026-09-06T12:00:00Z',
    });

    const resultado = deduplicarItensNormalizados([a, b]);

    expect(resultado.every((item) => item.grupoId === null)).toBe(true);
  });

  it('CA-19.3: fontes distintas mas fora da janela de 12h → não agrupa', () => {
    const a = itemReal('a', {
      fonteId: 'ge',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      publicadoEmBruto: '2026-09-06T00:00:00Z',
    });
    const b = itemReal('b', {
      fonteId: 'espn',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      publicadoEmBruto: '2026-09-06T13:00:01Z', // 13h01 depois, > 12h
    });

    const resultado = deduplicarItensNormalizados([a, b]);

    expect(resultado.every((item) => item.grupoId === null)).toBe(true);
  });

  it('CA-19.3: fontes distintas, dentro da janela, mas títulos diferentes → não agrupa', () => {
    const a = itemReal('a', {
      fonteId: 'ge',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      publicadoEmBruto: '2026-09-06T12:00:00Z',
    });
    const b = itemReal('b', {
      fonteId: 'espn',
      tituloBruto: 'Corinthians perde para o Flamengo fora de casa',
      publicadoEmBruto: '2026-09-06T12:05:00Z',
    });

    const resultado = deduplicarItensNormalizados([a, b]);

    expect(resultado.every((item) => item.grupoId === null)).toBe(true);
  });

  it('CA-19.4: união transitiva de 3 fontes distintas conta como 1 grupo, com título já truncado/sanitizado', () => {
    const tituloBrutoComMarcacao =
      '<b>Palmeiras</b> vence o Santos por 2 a 1 em jogo emocionante no Allianz Parque nesta noite de sábado';
    const a = itemReal('a', {
      fonteId: 'ge',
      tituloBruto: tituloBrutoComMarcacao,
      publicadoEmBruto: '2026-09-06T12:00:00Z',
    });
    const b = itemReal('b', {
      fonteId: 'espn',
      tituloBruto:
        'Palmeiras vence Santos por 2 a 1 em jogo emocionante no Allianz Parque',
      publicadoEmBruto: '2026-09-06T12:20:00Z',
    });
    const c = itemReal('c', {
      fonteId: 'terra',
      tituloBruto:
        'Palmeiras vence o Santos por 2 a 1 em jogo emocionante no Allianz Parque neste sabado',
      publicadoEmBruto: '2026-09-06T12:40:00Z',
    });

    const resultado = deduplicarItensNormalizados([a, b, c]);
    const grupoIds = new Set(resultado.map((item) => item.grupoId));

    expect(grupoIds.size).toBe(1);
    expect([...grupoIds][0]).not.toBeNull();
    // prova de integração: o título usado na comparação é o já sanitizado (sem <b>).
    expect(resultado.find((item) => item.id === 'a')?.titulo).not.toContain('<b>');
  });

  it('data estimada (sem publicadoEmBruto) ainda participa da janela de 12h por publicadoEm resolvido', () => {
    const a = itemReal('a', {
      fonteId: 'ge',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      publicadoEmBruto: null, // dataEstimada: true, publicadoEm = AGORA
    });
    const b = itemReal('b', {
      fonteId: 'espn',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      publicadoEmBruto: AGORA.toISOString(),
    });

    expect(a.dataEstimada).toBe(true);

    const resultado = deduplicarItensNormalizados([a, b]);
    const resA = resultado.find((item) => item.id === 'a');
    const resB = resultado.find((item) => item.id === 'b');
    expect(resA?.grupoId).not.toBeNull();
    expect(resA?.grupoId).toBe(resB?.grupoId);
  });

  it('item isolado (sem par equivalente) recebe grupoId null', () => {
    const a = itemReal('a', {
      fonteId: 'ge',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      publicadoEmBruto: '2026-09-06T12:00:00Z',
    });

    const resultado = deduplicarItensNormalizados([a]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.grupoId).toBeNull();
  });

  it('lista vazia retorna lista vazia', () => {
    expect(deduplicarItensNormalizados([])).toEqual([]);
  });

  it('não muta a lista de entrada nem os itens originais', () => {
    const a = itemReal('a', {
      fonteId: 'ge',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      publicadoEmBruto: '2026-09-06T12:00:00Z',
    });
    const b = itemReal('b', {
      fonteId: 'espn',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      publicadoEmBruto: '2026-09-06T12:05:00Z',
    });
    const entrada = [a, b];
    const copiaEntrada = [...entrada];

    deduplicarItensNormalizados(entrada);

    expect(entrada).toEqual(copiaEntrada);
    expect('grupoId' in a).toBe(false);
  });

  it('preserva os demais campos de ItemNormalizado (resumo, link, dataEstimada) na saída', () => {
    const a = itemReal('a', {
      fonteId: 'ge',
      tituloBruto: 'Palmeiras vence o Santos por 2 a 1',
      resumoBruto: 'Resumo da partida no Allianz Parque.',
      linkBruto: 'https://ge.globo.com/materia-a',
      publicadoEmBruto: '2026-09-06T12:00:00Z',
    });

    const [resultado] = deduplicarItensNormalizados([a]);

    expect(resultado?.link).toBe('https://ge.globo.com/materia-a');
    expect(resultado?.resumo).toBe('Resumo da partida no Allianz Parque.');
    expect(resultado?.dataEstimada).toBe(false);
  });
});
