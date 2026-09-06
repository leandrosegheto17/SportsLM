// tests/verificar-segredos.test.ts
//
// Prova o critério de aceite de FUND-03 (SDD §7.2, GUARDRAILS.md §4): a
// varredura do diretório publicado detecta cada um dos padrões de segredo
// exigidos (`token`, `api_key`, `Bearer`, chave hex 32+) e não falsifica
// positivo em conteúdo legítimo de build. Testes por tabela (Seção 1.11 do
// TASK.md).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  encontrarSegredos,
  varrerDiretorio,
} from '../pipeline/ci/verificar-segredos.mjs';

describe('encontrarSegredos (função pura)', () => {
  const casosComSegredo: Array<[string, string]> = [
    ['token literal', 'const config = { token: "abc" };'],
    ['api_key com underscore', 'fetch(url, { headers: { api_key: "x" } });'],
    ['api-key com hífen', 'headers: { "api-key": "x" }'],
    ['apikey junto', 'const apikey = "x";'],
    ['cabeçalho Bearer', 'Authorization: Bearer abcdef123456'],
    [
      'chave hexadecimal de 32+ caracteres',
      'const id = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";',
    ],
  ];

  it.each(casosComSegredo)('detecta padrão de segredo: %s', (_descricao, conteudo) => {
    expect(encontrarSegredos(conteudo).length).toBeGreaterThan(0);
  });

  const casosLimpos: Array<[string, string]> = [
    [
      'bundle React minificado sem segredo',
      'function App(){return React.createElement("p",null,"SportsLM")}',
    ],
    [
      'hash de asset curto do Vite (8 caracteres, não é chave)',
      '<link rel="stylesheet" href="/assets/index-a1b2c3d4.css">',
    ],
    ['palavra comum sem relação com segredo', 'export const contador = 42;'],
  ];

  it.each(casosLimpos)(
    'não falsifica positivo em conteúdo legítimo: %s',
    (_descricao, conteudo) => {
      expect(encontrarSegredos(conteudo)).toEqual([]);
    },
  );
});

describe('varrerDiretorio (integração com o artefato publicado)', () => {
  let diretorioTemporario: string;

  beforeEach(() => {
    diretorioTemporario = mkdtempSync(join(tmpdir(), 'sportslm-verificar-segredos-'));
  });

  afterEach(() => {
    rmSync(diretorioTemporario, { recursive: true, force: true });
  });

  it('retorna lista vazia para um artefato publicado limpo', () => {
    writeFileSync(
      join(diretorioTemporario, 'index.html'),
      '<!doctype html><html><body>SportsLM</body></html>',
    );
    writeFileSync(join(diretorioTemporario, 'app.js'), 'console.log("SportsLM");');

    expect(varrerDiretorio(diretorioTemporario)).toEqual([]);
  });

  it('falha (retorna achado) quando um segredo de teste é injetado no artefato', () => {
    writeFileSync(
      join(diretorioTemporario, 'app.js'),
      'const token = "segredo-de-teste";',
    );

    const achados = varrerDiretorio(diretorioTemporario);
    expect(achados.length).toBeGreaterThan(0);
    expect(achados[0]?.padrao).toBe('token');
  });

  it('encontra segredo mesmo em subdiretório aninhado', () => {
    const subdir = join(diretorioTemporario, 'assets');
    writeFileSync(join(diretorioTemporario, 'index.html'), '<!doctype html>');
    mkdirSync(subdir, { recursive: true });
    writeFileSync(join(subdir, 'chunk.js'), 'Authorization: Bearer x');

    const achados = varrerDiretorio(diretorioTemporario);
    expect(achados.some((a) => a.padrao === 'Bearer')).toBe(true);
  });

  it('ignora arquivos binários (extensão fora da lista de texto)', () => {
    writeFileSync(
      join(diretorioTemporario, 'logo.png'),
      'token=nao-deveria-importar-em-binario',
    );

    expect(varrerDiretorio(diretorioTemporario)).toEqual([]);
  });
});
