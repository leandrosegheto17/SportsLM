// dominio/esportes/classificador.test.ts — ING-N-03 (TASK.md Lote 4)
//
// Testes por tabela (TASK.md Diretriz #11) cobrindo o critério de aceite:
// - CA-15.4: cascata de 4 níveis (feed fixado → categoria → léxico → geral,
//   com esporte da fonte quando mono-esporte, e fora-do-recorte quando o
//   léxico reconhece um esporte fora dos 15).
// - CA-04.7: item não classificável (nível 4) recebe `'geral'`.
// - CA-04.8: esporte fora do recorte marca `'fora-do-recorte'`.

import { describe, expect, it } from 'vitest';
import {
  classificarEsporte,
  normalizarTexto,
  type ItemParaClassificar,
  type LexicoEsportes,
  type MapaCategoriasPorFonte,
} from './classificador';
import type { EsporteId } from '../tipos/esportes';

const LEXICO: LexicoEsportes = {
  porEsporte: [
    {
      esporte: 'futebol',
      termos: [
        { termo: 'futebol', peso: 3 },
        { termo: 'flamengo', peso: 2 },
        { termo: 'palmeiras', peso: 2 },
        { termo: 'tecnico', peso: 1 },
      ],
    },
    {
      esporte: 'basquete',
      termos: [
        { termo: 'basquete', peso: 3 },
        { termo: 'cestinha', peso: 3 },
        { termo: 'nba', peso: 2 },
      ],
    },
    {
      esporte: 'formula1',
      termos: [
        { termo: 'formula 1', peso: 3 },
        { termo: 'pole position', peso: 3 },
      ],
    },
    { esporte: 'surfe', termos: [{ termo: 'surfe', peso: 3 }] },
    { esporte: 'tenis', termos: [{ termo: 'tenis', peso: 3 }] },
  ],
  foraDoRecorte: [
    {
      nome: 'handebol',
      termos: [{ termo: 'handebol', peso: 3 }],
    },
    {
      nome: 'boxe',
      termos: [
        { termo: 'boxe', peso: 3 },
        { termo: 'nocaute', peso: 2 },
      ],
    },
  ],
};

const CATEGORIAS: MapaCategoriasPorFonte = {
  'gazeta-esportiva': { basquete: 'basquete', tenis: 'tenis' },
};

function item(sobrepor: Partial<ItemParaClassificar>): ItemParaClassificar {
  return {
    fonteId: 'espn-brasil',
    esporteFixadoDoFeed: null,
    categoria: null,
    titulo: '',
    resumo: null,
    esportesCobertosPelaFonte: ['futebol', 'basquete', 'formula1'],
    ...sobrepor,
  };
}

describe('classificarEsporte — CA-15.4 (cascata de 4 níveis, ADR-008)', () => {
  it('nível 1 — esporteFixadoDoFeed decide sozinho, mesmo com texto ambíguo', () => {
    const resultado = classificarEsporte(
      item({
        esporteFixadoDoFeed: 'basquete',
        titulo: 'Notícia qualquer sem relação nenhuma com basquete',
      }),
      LEXICO,
      CATEGORIAS,
    );
    expect(resultado).toEqual({
      esporte: 'basquete',
      origemClassificacao: 'feed-fixado',
    });
  });

  it('nível 2 — categoria do item casa com o mapa da fonte quando não há feed fixado', () => {
    const resultado = classificarEsporte(
      item({
        fonteId: 'gazeta-esportiva',
        categoria: 'Tênis', // com acento/maiúscula — deve normalizar para "tenis"
        titulo: 'Notícia sem termo de léxico nenhum',
      }),
      LEXICO,
      CATEGORIAS,
    );
    expect(resultado).toEqual({ esporte: 'tenis', origemClassificacao: 'categoria' });
  });

  it('nível 2 — categoria sem correspondência no mapa da fonte cai para o léxico (nível 3)', () => {
    const resultado = classificarEsporte(
      item({
        fonteId: 'gazeta-esportiva',
        categoria: 'ciclismo', // não está no mapa de gazeta-esportiva
        titulo: 'Cestinha decide jogo apertado da NBA',
      }),
      LEXICO,
      CATEGORIAS,
    );
    expect(resultado).toEqual({ esporte: 'basquete', origemClassificacao: 'lexico' });
  });

  it('nível 3 — léxico vence com pontuação >= 2 e vantagem >= 2 sobre o segundo colocado', () => {
    const resultado = classificarEsporte(
      item({ titulo: 'Cestinha marca 40 pontos e time vence pela NBA' }),
      LEXICO,
      CATEGORIAS,
    );
    // cestinha(3) + nba(2) = 5 para basquete; nenhum outro esporte pontua.
    expect(resultado).toEqual({ esporte: 'basquete', origemClassificacao: 'lexico' });
  });

  it('nível 3 — termo inequívoco de peso 3 sozinho já vence (pole position)', () => {
    const resultado = classificarEsporte(
      item({ titulo: 'Piloto larga da pole position no GP deste fim de semana' }),
      LEXICO,
      CATEGORIAS,
    );
    expect(resultado).toEqual({ esporte: 'formula1', origemClassificacao: 'lexico' });
  });

  it('nível 3 — sem vencedor quando pontuação máxima é < 2 (termo ambíguo sozinho não decide)', () => {
    const resultado = classificarEsporte(
      item({ titulo: 'Técnico comenta decisão da diretoria' }),
      LEXICO,
      CATEGORIAS,
    );
    // "tecnico" pontua 1 para futebol — abaixo do mínimo de 2 — cai no nível 4.
    // esportesCobertosPelaFonte tem 3 itens (multi-esporte) => geral.
    expect(resultado).toEqual({
      esporte: 'geral',
      origemClassificacao: 'nao-classificado',
    });
  });

  it('nível 3 — sem vencedor quando dois esportes empatam (vantagem 0 < 2)', () => {
    const resultado = classificarEsporte(
      item({ titulo: 'Surfe e tênis dividem manchete do dia' }),
      LEXICO,
      CATEGORIAS,
    );
    // surfe(3) e tenis(3) empatam — vantagem 0, sem vencedor.
    expect(resultado).toEqual({
      esporte: 'geral',
      origemClassificacao: 'nao-classificado',
    });
  });

  it('nível 4 — fonte multi-esporte sem vencedor cai em "geral"', () => {
    const resultado = classificarEsporte(
      item({ titulo: 'Manchete completamente genérica sem termo nenhum' }),
      LEXICO,
      CATEGORIAS,
    );
    expect(resultado).toEqual({
      esporte: 'geral',
      origemClassificacao: 'nao-classificado',
    });
  });

  it('nível 4 — fonte mono-esporte sem vencedor herda o esporte da fonte (CA-15.4)', () => {
    const resultado = classificarEsporte(
      item({
        titulo: 'Manchete completamente genérica sem termo nenhum',
        esportesCobertosPelaFonte: ['judo'],
      }),
      LEXICO,
      CATEGORIAS,
    );
    expect(resultado).toEqual({
      esporte: 'judo',
      origemClassificacao: 'nao-classificado',
    });
  });

  it('é determinístico: mesma entrada produz sempre a mesma saída (RN-18)', () => {
    const entrada = item({ titulo: 'Cestinha decide jogo da NBA de novo' });
    const primeiraChamada = classificarEsporte(entrada, LEXICO, CATEGORIAS);
    const segundaChamada = classificarEsporte(entrada, LEXICO, CATEGORIAS);
    expect(primeiraChamada).toEqual(segundaChamada);
  });

  it('casamento por palavra inteira: "surfe" não casa dentro de "surfista" (ADR-008)', () => {
    const resultado = classificarEsporte(
      item({ titulo: 'O surfista comenta a temporada em entrevista' }),
      LEXICO,
      CATEGORIAS,
    );
    expect(resultado.esporte).not.toBe('surfe');
  });
});

describe('classificarEsporte — CA-04.7 (item não classificável vira "geral")', () => {
  it('nunca lança e sempre devolve um EsporteOuTriagem válido, mesmo com texto vazio', () => {
    const resultado = classificarEsporte(
      item({ titulo: '', resumo: null }),
      LEXICO,
      CATEGORIAS,
    );
    expect(resultado.esporte).toBe('geral');
    expect(resultado.origemClassificacao).toBe('nao-classificado');
  });
});

describe('classificarEsporte — CA-04.8 (esporte fora do recorte)', () => {
  it.each([
    ['handebol', 'Seleção brasileira de handebol vence torneio internacional'],
    ['boxe', 'Lutador vence por nocaute no card de boxe deste sábado'],
  ] as const)(
    'léxico de %s reconhece o texto e marca "fora-do-recorte", nunca o nome do esporte',
    (_nomeEsporte, titulo) => {
      const resultado = classificarEsporte(item({ titulo }), LEXICO, CATEGORIAS);
      expect(resultado).toEqual({
        esporte: 'fora-do-recorte',
        origemClassificacao: 'lexico',
      });
    },
  );

  it('fora-do-recorte também respeita a regra de vantagem >= 2 (não decide com pontuação insuficiente)', () => {
    const resultado = classificarEsporte(
      item({ titulo: 'Nocaute é tema de debate no estúdio hoje' }),
      LEXICO,
      CATEGORIAS,
    );
    // "nocaute" sozinho pontua 2 para boxe (peso 2) — pontuação >= 2 mas
    // precisa também vantagem >= 2 sobre o segundo colocado (0) — aqui vence,
    // já que não há outro candidato pontuando.
    expect(resultado).toEqual({
      esporte: 'fora-do-recorte',
      origemClassificacao: 'lexico',
    });
  });

  it('feed fixado nunca aponta para esporte fora do recorte (tipo EsporteId não permite)', () => {
    // Prova estrutural: `esporteFixadoDoFeed` é tipado como `EsporteId | null`,
    // então não há como o nível 1 produzir `'fora-do-recorte'` — a única via é
    // o léxico (nível 3), já coberta acima.
    const fixado: EsporteId = 'futebol';
    const resultado = classificarEsporte(
      item({ esporteFixadoDoFeed: fixado, titulo: 'handebol handebol handebol' }),
      LEXICO,
      CATEGORIAS,
    );
    expect(resultado.esporte).toBe('futebol');
  });
});

describe('normalizarTexto', () => {
  it.each([
    ['Tênis', 'tenis'],
    ['AUTOMOBILISMO', 'automobilismo'],
    ['vôlei-de-praia!!', 'volei de praia'],
    ['  espaços   múltiplos  ', 'espacos multiplos'],
  ])('normaliza "%s" para "%s"', (entrada, esperado) => {
    expect(normalizarTexto(entrada)).toBe(esperado);
  });
});
