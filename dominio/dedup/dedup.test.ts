// dominio/dedup/dedup.test.ts — DOM-03 (TASK.md Lote 3)
//
// Testes por tabela (TASK.md Diretriz #11) cobrindo RN-16 e CA-19.1 a
// CA-19.4 (PRD-TECNICO.md, ADR-009).

import { describe, expect, it } from 'vitest';
import {
  agruparItens,
  calcularGrupoId,
  coeficienteDice,
  contarTokensFortesComuns,
  escolherRepresentante,
  gerarTrigramas,
  JANELA_MAXIMA_MS,
  LIMIAR_DICE,
  normalizarTitulo,
  saoEquivalentes,
  tokensFortes,
  type ItemParaDeduplicacao,
} from './index';

function item(
  id: string,
  fonteId: string,
  titulo: string,
  publicadoEm: string,
): ItemParaDeduplicacao {
  return { id, fonteId, titulo, publicadoEm };
}

const BASE = '2026-09-05T12:00:00-03:00';
function horasDepois(horas: number): string {
  return new Date(Date.parse(BASE) + horas * 60 * 60 * 1000).toISOString();
}

describe('normalizarTitulo', () => {
  it('minúsculas, remove diacríticos, pontuação e stopwords, colapsa espaços', () => {
    expect(normalizarTitulo('Palmeiras vence o Santos por 2 a 1!')).toBe(
      'palmeiras vence santos 2 1',
    );
  });

  it('remove acentuação (ex.: "é", "à")', () => {
    expect(normalizarTitulo('Cruzeiro é campeão à noite')).toBe('cruzeiro campeao noite');
  });
});

describe('tokensFortes', () => {
  it('mantém só tokens com 4+ caracteres', () => {
    expect(tokensFortes('palmeiras vence santos 2 1')).toEqual([
      'palmeiras',
      'vence',
      'santos',
    ]);
  });

  it('string vazia não tem tokens fortes', () => {
    expect(tokensFortes('')).toEqual([]);
  });
});

describe('coeficienteDice', () => {
  it('1 para textos normalizados idênticos', () => {
    const texto = normalizarTitulo('Palmeiras vence o Santos por 2 a 1');
    expect(coeficienteDice(texto, texto)).toBe(1);
  });

  it('0 para textos completamente diferentes', () => {
    expect(coeficienteDice('abc', 'xyz')).toBe(0);
  });

  it('0 quando ambos os textos são vazios', () => {
    expect(coeficienteDice('', '')).toBe(0);
  });

  it('gerarTrigramas produz janela deslizante de 3 caracteres com preenchimento', () => {
    expect(gerarTrigramas('ab')).toEqual([' ab', 'ab ']);
  });
});

describe('contarTokensFortesComuns', () => {
  it('conta interseção de tokens fortes entre dois títulos normalizados', () => {
    const a = normalizarTitulo('Palmeiras vence o Santos por 2 a 1');
    const b = normalizarTitulo('Palmeiras vence o Corinthians por 2 a 1');
    // comum: "palmeiras", "vence" — "santos"/"corinthians" divergem.
    expect(contarTokensFortesComuns(a, b)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// RN-16 — "Fontes distintas, ≤ 12h, títulos similares acima do limiar; na
// dúvida não agrupar; mesma fonte nunca agrupa."
// ---------------------------------------------------------------------------

describe('saoEquivalentes — RN-16 (testes por tabela)', () => {
  const casos: Array<{
    nome: string;
    a: ItemParaDeduplicacao;
    b: ItemParaDeduplicacao;
    esperado: boolean;
  }> = [
    {
      nome: 'RN-16 satisfeito: fontes distintas, mesma janela, título quase idêntico',
      a: item(
        'a1',
        'ge',
        'Flamengo vence o Botafogo por 3 a 1 no Maracanã',
        horasDepois(0),
      ),
      b: item(
        'b1',
        'espn-brasil',
        'Flamengo vence Botafogo por 3 a 1 no Maracanã',
        horasDepois(1),
      ),
      esperado: true,
    },
    {
      nome: 'mesma fonte nunca agrupa, mesmo com título idêntico e mesma janela (RN-16)',
      a: item('a2', 'ge', 'Flamengo vence o Botafogo por 3 a 1', horasDepois(0)),
      b: item('b2', 'ge', 'Flamengo vence o Botafogo por 3 a 1', horasDepois(0.1)),
      esperado: false,
    },
    {
      nome: 'fora da janela de 12h não agrupa, mesmo com título idêntico e fontes distintas',
      a: item('a3', 'ge', 'Flamengo vence o Botafogo por 3 a 1', horasDepois(0)),
      b: item(
        'b3',
        'espn-brasil',
        'Flamengo vence o Botafogo por 3 a 1',
        horasDepois(12.5),
      ),
      esperado: false,
    },
    {
      nome: 'exatamente 12h ainda dentro da janela (limite inclusive)',
      a: item('a4', 'ge', 'Flamengo vence o Botafogo por 3 a 1', horasDepois(0)),
      b: item(
        'b4',
        'espn-brasil',
        'Flamengo vence o Botafogo por 3 a 1',
        horasDepois(12),
      ),
      esperado: true,
    },
    {
      nome: 'CA-19.3: mesmo assunto mas Dice abaixo do limiar não agrupa',
      a: item('a5', 'ge', 'Flamengo vence o Botafogo por 3 a 1', horasDepois(0)),
      b: item('b5', 'espn-brasil', 'Botafogo perde jogo difícil em casa', horasDepois(1)),
      esperado: false,
    },
    {
      nome: 'RN-16/ADR-009: adversário diverge — Dice abaixo do limiar (RF-19 exemplo do ADR-009)',
      a: item('a6', 'ge', 'Palmeiras vence o Santos por 2 a 1', horasDepois(0)),
      b: item(
        'b6',
        'espn-brasil',
        'Palmeiras vence o Corinthians por 2 a 1',
        horasDepois(1),
      ),
      esperado: false,
    },
    {
      // Dice ≥ 0,82 (só 1 token forte muito longo compartilhado + 1 token
      // forte que diverge por completo) mas só 1 token forte em comum: prova
      // que a 2ª condição de ADR-009 (≥ 2 tokens fortes) rejeita mesmo quando
      // o Dice sozinho já passaria do limiar — não é redundante com o Dice.
      nome: 'Dice ≥ 0,82 mas só 1 token forte em comum não agrupa (2ª condição de ADR-009)',
      a: item('a8', 'ge', 'campeonatobrasileiroseriea vencedor', horasDepois(0)),
      b: item('b8', 'espn-brasil', 'campeonatobrasileiroseriea perdedor', horasDepois(1)),
      esperado: false,
    },
    {
      nome: 'data inválida em um dos itens: na dúvida, não agrupar (RN-16)',
      a: item('a7', 'ge', 'Flamengo vence o Botafogo por 3 a 1', 'data-invalida'),
      b: item('b7', 'espn-brasil', 'Flamengo vence o Botafogo por 3 a 1', horasDepois(0)),
      esperado: false,
    },
  ];

  it.each(casos)('$nome', ({ a, b, esperado }) => {
    expect(saoEquivalentes(a, b)).toBe(esperado);
    // Equivalência é simétrica.
    expect(saoEquivalentes(b, a)).toBe(esperado);
  });

  it('constantes documentadas batem com ADR-009', () => {
    expect(LIMIAR_DICE).toBe(0.82);
    expect(JANELA_MAXIMA_MS).toBe(12 * 60 * 60 * 1000);
  });

  it('a 2ª condição (tokens fortes) não é redundante com a 1ª (Dice)', () => {
    const a = normalizarTitulo('campeonatobrasileiroseriea vencedor');
    const b = normalizarTitulo('campeonatobrasileiroseriea perdedor');
    expect(coeficienteDice(a, b)).toBeGreaterThanOrEqual(LIMIAR_DICE);
    expect(contarTokensFortesComuns(a, b)).toBeLessThan(2);
  });
});

// ---------------------------------------------------------------------------
// CA-19.1 / CA-19.3 / CA-19.4 — agrupamento (união transitiva)
// ---------------------------------------------------------------------------

describe('agruparItens', () => {
  it('CA-19.1: itens de fontes diferentes que atendem RN-16 recebem o mesmo grupoId', () => {
    const a = item(
      'a',
      'ge',
      'Flamengo vence o Botafogo por 3 a 1 no Maracanã',
      horasDepois(0),
    );
    const b = item(
      'b',
      'espn-brasil',
      'Flamengo vence Botafogo por 3 a 1 no Maracanã',
      horasDepois(1),
    );
    const grupos = agruparItens([a, b]);
    expect(grupos.get('a')).toBeDefined();
    expect(grupos.get('a')).toBe(grupos.get('b'));
  });

  it('CA-19.3: itens que não atendem RN-16 são exibidos separadamente (fora do mapa)', () => {
    const a = item('a', 'ge', 'Flamengo vence o Botafogo por 3 a 1', horasDepois(0));
    const b = item('b', 'espn-brasil', 'Vasco perde para o Fluminense', horasDepois(1));
    const grupos = agruparItens([a, b]);
    expect(grupos.has('a')).toBe(false);
    expect(grupos.has('b')).toBe(false);
  });

  it('mesma fonte nunca agrupa, mesmo dentro de um grupo maior (RN-16)', () => {
    const a = item(
      'a',
      'ge',
      'Flamengo vence o Botafogo por 3 a 1 no Maracanã',
      horasDepois(0),
    );
    const c = item(
      'c',
      'ge',
      'Flamengo vence o Botafogo por 3 a 1 no Maracanã',
      horasDepois(0.2),
    );
    const grupos = agruparItens([a, c]);
    expect(grupos.size).toBe(0);
  });

  it('CA-19.4: união transitiva forma 1 único grupo a partir de 3 fontes distintas', () => {
    const a = item(
      'a',
      'ge',
      'Flamengo vence o Botafogo por 3 a 1 no Maracanã',
      horasDepois(0),
    );
    const b = item(
      'b',
      'espn-brasil',
      'Flamengo vence Botafogo por 3 a 1 no Maracanã',
      horasDepois(1),
    );
    const c = item(
      'c',
      'terra-esportes',
      'Flamengo vence o Botafogo por 3 a 1, no Maracanã',
      horasDepois(2),
    );
    const grupos = agruparItens([a, b, c]);
    const idsDeGrupo = new Set([grupos.get('a'), grupos.get('b'), grupos.get('c')]);
    // Os 3 itens contam como 1 grupo (CA-19.4), não 3.
    expect(idsDeGrupo.size).toBe(1);
    expect(idsDeGrupo.has(undefined)).toBe(false);
  });

  it('grupoId é estável independente da ordem de entrada (hash de ids ordenados)', () => {
    const a = item(
      'a',
      'ge',
      'Flamengo vence o Botafogo por 3 a 1 no Maracanã',
      horasDepois(0),
    );
    const b = item(
      'b',
      'espn-brasil',
      'Flamengo vence Botafogo por 3 a 1 no Maracanã',
      horasDepois(1),
    );
    const grupo1 = agruparItens([a, b]);
    const grupo2 = agruparItens([b, a]);
    expect(grupo1.get('a')).toBe(grupo2.get('a'));
    expect(calcularGrupoId(['a', 'b'])).toBe(calcularGrupoId(['b', 'a']));
  });

  it('lista vazia não lança e retorna mapa vazio', () => {
    expect(agruparItens([]).size).toBe(0);
  });

  it('item isolado (sem par equivalente) não aparece no mapa', () => {
    const a = item('a', 'ge', 'Flamengo vence o Botafogo por 3 a 1', horasDepois(0));
    expect(agruparItens([a]).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CA-19.2 — escolha de representante após bloqueio de fonte
// ---------------------------------------------------------------------------

describe('escolherRepresentante — CA-19.2', () => {
  const a = item('a', 'ge', 'Flamengo vence o Botafogo por 3 a 1', horasDepois(0));
  const b = item('b', 'espn-brasil', 'Flamengo vence Botafogo por 3 a 1', horasDepois(1));
  const c = item(
    'c',
    'terra-esportes',
    'Flamengo vence o Botafogo por 3 a 1',
    horasDepois(2),
  );

  it('sem bloqueio, escolhe o item mais antigo do grupo', () => {
    expect(escolherRepresentante([a, b, c], new Set())).toBe(a);
  });

  it('CA-19.2: fonte do representante bloqueada promove a próxima mais antiga', () => {
    expect(escolherRepresentante([a, b, c], new Set(['ge']))).toBe(b);
  });

  it('todas as fontes do grupo bloqueadas: grupo não aparece (retorna null)', () => {
    expect(
      escolherRepresentante([a, b, c], new Set(['ge', 'espn-brasil', 'terra-esportes'])),
    ).toBe(null);
  });

  it('lista vazia retorna null sem lançar', () => {
    expect(escolherRepresentante([], new Set())).toBe(null);
  });
});
