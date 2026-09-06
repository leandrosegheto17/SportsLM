// config/lexico-esportes.test.ts — ING-N-03 (TASK.md Lote 4, ADR-008)
//
// Prova o critério de aceite de configuração: `config/lexico-esportes.json`
// valida contra o schema, tem uma entrada por esporte (sem duplicata, sem
// esporte da Seção 2A faltando) e ao menos 1 entrada de "fora do recorte".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ESPORTE_IDS } from './esportes.schema';
import { lexicoEsportesSchema } from './lexico-esportes.schema';

const caminhoArquivo = fileURLToPath(new URL('./lexico-esportes.json', import.meta.url));

function lerLexicoJson(): unknown {
  return JSON.parse(readFileSync(caminhoArquivo, 'utf-8'));
}

describe('config/lexico-esportes.json', () => {
  it('valida contra o schema Zod (lexicoEsportesSchema)', () => {
    const resultado = lexicoEsportesSchema.safeParse(lerLexicoJson());
    expect(resultado.success).toBe(true);
  });

  it('tem exatamente uma entrada por esporte dos 15 da Seção 2A', () => {
    const dados = lexicoEsportesSchema.parse(lerLexicoJson());
    expect(dados.porEsporte.map((entrada) => entrada.esporte).sort()).toEqual(
      [...ESPORTE_IDS].sort(),
    );
  });

  it('tem ao menos 1 entrada de fora-do-recorte (ADR-008)', () => {
    const dados = lexicoEsportesSchema.parse(lerLexicoJson());
    expect(dados.foraDoRecorte.length).toBeGreaterThan(0);
  });

  it('todo termo tem peso 1, 2 ou 3', () => {
    const dados = lexicoEsportesSchema.parse(lerLexicoJson());
    for (const entrada of [...dados.porEsporte, ...dados.foraDoRecorte]) {
      for (const termo of entrada.termos) {
        expect([1, 2, 3]).toContain(termo.peso);
      }
    }
  });

  it('rejeita esporte duplicado', () => {
    const dados = lerLexicoJson() as { porEsporte: unknown[]; foraDoRecorte: unknown[] };
    const primeiro = dados.porEsporte[0];
    const comDuplicata = { ...dados, porEsporte: [...dados.porEsporte, primeiro] };
    const resultado = lexicoEsportesSchema.safeParse(comDuplicata);
    expect(resultado.success).toBe(false);
  });

  it('rejeita arquivo com esporte da Seção 2A faltando', () => {
    const dados = lerLexicoJson() as { porEsporte: unknown[]; foraDoRecorte: unknown[] };
    const semUltimo = { ...dados, porEsporte: dados.porEsporte.slice(0, -1) };
    const resultado = lexicoEsportesSchema.safeParse(semUltimo);
    expect(resultado.success).toBe(false);
  });
});
