// config/esportes.test.ts — CFG-01
//
// Prova o critério de aceite: `config/esportes.json` valida contra o schema
// Zod de `EsporteId`, e a ordem confere com a Seção 2A do PRD-TECNICO.md.
// Leitura de arquivo (I/O) fica aqui, fora de `dominio/` — o schema em
// `config/esportes.schema.ts` é puro.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ESPORTE_IDS, esporteIdSchema, esportesSchema } from './esportes.schema';

const caminhoArquivo = fileURLToPath(new URL('./esportes.json', import.meta.url));

function lerEsportesJson(): unknown {
  return JSON.parse(readFileSync(caminhoArquivo, 'utf-8'));
}

// Fonte da verdade independente do arquivo sob teste: literal da tabela da
// Seção 2A do PRD-TECNICO.md, na ordem #1 a #15.
const NOMES_SECAO_2A = [
  'Futebol',
  'Vôlei (quadra)',
  'Fórmula 1 / automobilismo',
  'Basquete',
  'Tênis',
  'Vôlei de praia',
  'Natação',
  'MMA / UFC',
  'Ginástica artística',
  'Surfe',
  'Skate',
  'Judô',
  'Atletismo',
  'Futsal',
  'Futebol americano (NFL)',
];

describe('config/esportes.json', () => {
  it('valida contra o schema Zod de EsporteId (esportesSchema)', () => {
    const dados = lerEsportesJson();
    const resultado = esportesSchema.safeParse(dados);
    expect(resultado.success).toBe(true);
  });

  it('tem exatamente 15 esportes', () => {
    const dados = esportesSchema.parse(lerEsportesJson());
    expect(dados).toHaveLength(15);
  });

  it('a ordem dos nomes confere com a Seção 2A do PRD-TECNICO', () => {
    const dados = esportesSchema.parse(lerEsportesJson());
    expect(dados.map((esporte) => esporte.nome)).toEqual(NOMES_SECAO_2A);
  });

  it('os ids batem 1:1 com ESPORTE_IDS, na mesma ordem (RN-06, id estável)', () => {
    const dados = esportesSchema.parse(lerEsportesJson());
    expect(dados.map((esporte) => esporte.id)).toEqual([...ESPORTE_IDS]);
  });

  it('cada esporte tem `ordem` igual à posição 1-based no arquivo', () => {
    const dados = esportesSchema.parse(lerEsportesJson());
    dados.forEach((esporte, indice) => {
      expect(esporte.ordem).toBe(indice + 1);
    });
  });

  it('rejeita um id fora dos 15 da Seção 2A', () => {
    const dados = lerEsportesJson() as Array<Record<string, unknown>>;
    const invalido = dados.slice(0, 14);
    const resultado = esportesSchema.safeParse(invalido);
    expect(resultado.success).toBe(false);
  });

  it('rejeita id duplicado', () => {
    const dados = lerEsportesJson() as Array<Record<string, unknown>>;
    const primeiro = dados[0];
    if (!primeiro) throw new Error('fixture vazio');
    const comDuplicata = [...dados.slice(0, 14), { ...primeiro, ordem: 15 }];
    const resultado = esportesSchema.safeParse(comDuplicata);
    expect(resultado.success).toBe(false);
  });

  it('rejeita ordem fora de sincronia com a posição no arquivo', () => {
    const dados = lerEsportesJson() as Array<Record<string, unknown>>;
    const primeiro = dados[0];
    const segundo = dados[1];
    if (!primeiro || !segundo) throw new Error('fixture vazio');
    const foraDeOrdem = [
      { ...primeiro, ordem: 2 },
      { ...segundo, ordem: 1 },
      ...dados.slice(2),
    ];
    const resultado = esportesSchema.safeParse(foraDeOrdem);
    expect(resultado.success).toBe(false);
  });

  it('esporteIdSchema aceita cada um dos 15 ids e rejeita um id inventado', () => {
    for (const id of ESPORTE_IDS) {
      expect(esporteIdSchema.safeParse(id).success).toBe(true);
    }
    expect(esporteIdSchema.safeParse('handebol').success).toBe(false);
  });
});
