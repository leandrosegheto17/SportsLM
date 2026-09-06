// dominio/esportes/esportes.test.ts — DOM-02 (TASK.md Lote 3)
//
// Testes por tabela (TASK.md Diretriz #11) cobrindo:
// - CA-03.1: apresentar exatamente os 15 esportes da Seção 2A, na ordem.
// - CA-04.8: esporte fora do recorte (RN-06) nunca é exibido.

import { describe, expect, it } from 'vitest';
import {
  ehEsporteForaDoRecorte,
  ehEsporteValido,
  ESPORTES_ORDENADOS,
  filtrarEsportesValidos,
  ordenarPorEsporte,
  posicaoNaOrdemCanonica,
} from './esportes';
import type { EsporteId } from '../tipos/esportes';

// Fonte da verdade independente do módulo sob teste: os 15 ids na ordem #1 a
// #15 da Seção 2A do PRD-TECNICO.md (mesma lista literal usada pela prova de
// `config/esportes.test.ts`, CFG-01).
const IDS_SECAO_2A = [
  'futebol',
  'volei-quadra',
  'formula1',
  'basquete',
  'tenis',
  'volei-praia',
  'natacao',
  'mma',
  'ginastica-artistica',
  'surfe',
  'skate',
  'judo',
  'atletismo',
  'futsal',
  'futebol-americano',
] as const;

// Excluídos com motivo, citados literalmente na Seção 2A ("Excluídos com
// motivo: handebol, boxe, ciclismo, e-sports... Jogos Olímpicos"), mais
// alguns slugs quaisquer não reconhecidos — todos "fora do recorte" (CA-04.8).
const FORA_DO_RECORTE = [
  'handebol',
  'boxe',
  'ciclismo',
  'e-sports',
  'jogos-olimpicos',
  'volei', // slug antigo/divergente já sinalizado em CFG-05 — não é válido aqui
  '',
  'FUTEBOL', // case-sensitive: maiúsculo não é o slug estável
];

describe('CA-03.1 — os 15 esportes da Seção 2A, na ordem', () => {
  it('ESPORTES_ORDENADOS tem exatamente 15 esportes', () => {
    expect(ESPORTES_ORDENADOS).toHaveLength(15);
  });

  it('ESPORTES_ORDENADOS bate 1:1, na mesma ordem, com a Seção 2A', () => {
    expect([...ESPORTES_ORDENADOS]).toEqual([...IDS_SECAO_2A]);
  });

  it('ESPORTES_ORDENADOS não pode ser mutado por quem consome (congelado)', () => {
    expect(Object.isFrozen(ESPORTES_ORDENADOS)).toBe(true);
  });

  it.each(IDS_SECAO_2A.map((id, indice) => [id, indice + 1] as const))(
    'posicaoNaOrdemCanonica(%s) === %i (posição 1-based da Seção 2A)',
    (id, posicaoEsperada) => {
      expect(posicaoNaOrdemCanonica(id)).toBe(posicaoEsperada);
    },
  );

  it('ordenarPorEsporte reordena uma coleção arbitrária para a ordem da Seção 2A', () => {
    const embaralhado = [
      { esporte: 'skate' },
      { esporte: 'futebol' },
      { esporte: 'judo' },
      { esporte: 'volei-quadra' },
    ];

    const ordenado = ordenarPorEsporte(embaralhado, (item) => item.esporte);

    expect(ordenado.map((item) => item.esporte)).toEqual([
      'futebol',
      'volei-quadra',
      'skate',
      'judo',
    ]);
  });

  it('ordenarPorEsporte não muta o array recebido', () => {
    const original = [{ esporte: 'skate' }, { esporte: 'futebol' }];
    const copiaOriginal = [...original];

    ordenarPorEsporte(original, (item) => item.esporte);

    expect(original).toEqual(copiaOriginal);
  });

  it('ordenarPorEsporte joga esporte fora do recorte para o fim, preservando ordem relativa', () => {
    const comInvalido = [
      { esporte: 'handebol' },
      { esporte: 'futebol' },
      { esporte: 'ciclismo' },
      { esporte: 'basquete' },
    ];

    const ordenado = ordenarPorEsporte(comInvalido, (item) => item.esporte);

    expect(ordenado.map((item) => item.esporte)).toEqual([
      'futebol',
      'basquete',
      'handebol',
      'ciclismo',
    ]);
  });
});

describe('CA-04.8 — esporte fora do recorte nunca é exibido', () => {
  it.each(IDS_SECAO_2A)('ehEsporteValido(%s) === true (um dos 15 da Seção 2A)', (id) => {
    expect(ehEsporteValido(id)).toBe(true);
    expect(ehEsporteForaDoRecorte(id)).toBe(false);
  });

  it.each(FORA_DO_RECORTE)(
    'ehEsporteValido(%j) === false (fora do recorte, RN-06)',
    (valor) => {
      expect(ehEsporteValido(valor)).toBe(false);
      expect(ehEsporteForaDoRecorte(valor)).toBe(true);
    },
  );

  it('posicaoNaOrdemCanonica lança para um esporte fora do recorte', () => {
    // Cast necessário: a assinatura pública exige EsporteId, mas o guardrail
    // existe justamente para um valor inválido que escapou da validação a
    // montante — testado deliberadamente aqui.
    expect(() => posicaoNaOrdemCanonica('handebol' as unknown as EsporteId)).toThrow(
      /fora do recorte/,
    );
  });

  it('filtrarEsportesValidos remove itens de esporte fora do recorte (CA-04.8), mantém os válidos', () => {
    const itens = [
      { titulo: 'Final do Brasileirão', esporte: 'futebol' },
      { titulo: 'Resultado de handebol', esporte: 'handebol' },
      { titulo: 'Etapa de ciclismo', esporte: 'ciclismo' },
      { titulo: 'Confronto direto no vôlei', esporte: 'volei-quadra' },
    ];

    const filtrados = filtrarEsportesValidos(itens, (item) => item.esporte);

    expect(filtrados.map((item) => item.titulo)).toEqual([
      'Final do Brasileirão',
      'Confronto direto no vôlei',
    ]);
  });

  it('filtrarEsportesValidos com coleção inteira fora do recorte retorna lista vazia', () => {
    const itens = [{ esporte: 'handebol' }, { esporte: 'boxe' }];

    expect(filtrarEsportesValidos(itens, (item) => item.esporte)).toEqual([]);
  });
});
