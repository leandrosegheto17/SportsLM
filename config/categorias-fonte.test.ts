// config/categorias-fonte.test.ts — ING-N-03 (TASK.md Lote 4, ADR-008)
//
// Prova o critério de aceite de configuração: `config/categorias-fonte.json`
// valida contra o schema. Estado inicial publicado é `{}` (nenhuma fonte com
// categoria mapeada ainda — decisão registrada em
// `config/categorias-fonte.schema.ts`), então o teste também prova que `{}`
// é aceito e que um mapa populado de exemplo também seria aceito.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapaCategoriasPorFonteSchema } from './categorias-fonte.schema';

const caminhoArquivo = fileURLToPath(new URL('./categorias-fonte.json', import.meta.url));

function lerCategoriasJson(): unknown {
  return JSON.parse(readFileSync(caminhoArquivo, 'utf-8'));
}

describe('config/categorias-fonte.json', () => {
  it('valida contra o schema Zod (mapaCategoriasPorFonteSchema)', () => {
    const resultado = mapaCategoriasPorFonteSchema.safeParse(lerCategoriasJson());
    expect(resultado.success).toBe(true);
  });

  it('estado inicial é o objeto vazio (nenhuma fonte com categoria mapeada ainda)', () => {
    expect(lerCategoriasJson()).toEqual({});
  });

  it('aceita um mapa populado de exemplo (fonte → categoria normalizada → esporte)', () => {
    const exemplo = { 'espn-brasil': { basquete: 'basquete', formula1: 'formula1' } };
    const resultado = mapaCategoriasPorFonteSchema.safeParse(exemplo);
    expect(resultado.success).toBe(true);
  });

  it('rejeita esporte fora dos 15 da Seção 2A no mapa', () => {
    const invalido = { 'espn-brasil': { handebol: 'handebol' } };
    const resultado = mapaCategoriasPorFonteSchema.safeParse(invalido);
    expect(resultado.success).toBe(false);
  });
});
