// tests/verificar-segredos.test.ts
//
// Prova o critério de aceite de FUND-03 (SDD §7.2, GUARDRAILS.md §4): a
// varredura do diretório publicado detecta cada um dos padrões de segredo
// exigidos (`token`, `api_key`, `Bearer`, chave hex 32+) e não falsifica
// positivo em conteúdo legítimo de build. Testes por tabela (Seção 1.11 do
// TASK.md).
//
// Bloqueio 005 (`.md/BLOCKERS.md`): o padrão `token` exige agora contexto de
// atribuição de valor (`token[:=]"...16+ chars com dígito..."`) em vez de
// casar a palavra isolada — a fixture `'const config = { token: "abc" };'`
// do primeiro caso abaixo foi ajustada de `"abc"` para um valor mais
// representativo de segredo real (`"abc123longstring"`), já que um valor de
// 3 caracteres nunca seria um segredo de fato; o caso em si (token com valor
// atribuído deve ser detectado) permanece o mesmo.
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
    ['token literal', 'const config = { token: "abc123longstring" };'],
    ['api_key com underscore', 'fetch(url, { headers: { api_key: "x" } });'],
    ['api-key com hífen', 'headers: { "api-key": "x" }'],
    ['apikey junto', 'const apikey = "x";'],
    ['cabeçalho Bearer', 'Authorization: Bearer abcdef123456'],
    [
      'chave hexadecimal de 32+ caracteres',
      'const id = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";',
    ],
    [
      'token com valor de segredo plausível (Bloqueio 005)',
      'const config = { token: "sk_live_abcdefghijklmnop1234567890" };',
    ],
    [
      'token com atribuição por igual e valor longo com dígito',
      'token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0";',
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
    [
      'campo de domínio zona.token, acesso de propriedade (Bloqueio 005)',
      'const cor = o.zona ? Xd[o.zona.token] : void 0;',
    ],
    [
      'campo de domínio token em JSX/acesso opcional (Bloqueio 005)',
      'React.createElement("td", { "data-zona": (u = o.zona) == null ? void 0 : u.token })',
    ],
    [
      'campo de domínio token em construtor de schema, sem valor atribuído (Bloqueio 005)',
      'token:S.enum(d0)',
    ],
    [
      'token com valor curto de enum de domínio, não é segredo (Bloqueio 005)',
      "token: 'libertadores'",
    ],
    [
      'token com valor curto de enum de domínio, hífen, sem dígito (Bloqueio 005)',
      "token: 'pre-libertadores'",
    ],
    [
      'id de notícia sha256 (64 hex chars) — conteúdo público, não segredo (Bloqueio 007)',
      '{"id":"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2","titulo":"x"}',
    ],
    [
      'hash de versão sha256 (64 hex chars) em versao.json — conteúdo público, não segredo (Bloqueio 007)',
      '{"hashes":{"noticias":"a23f05a8cf4f083c108e530f21426e6b02e99a4cb89b55a861d5a0507d55284d"}}',
    ],
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
      'const token = "segredo-de-teste-2026";',
    );

    const achados = varrerDiretorio(diretorioTemporario);
    expect(achados.length).toBeGreaterThan(0);
    expect(achados[0]?.padrao).toBe('token');
  });

  it('não falsifica positivo com o bundle real do campo de domínio zona.token (Bloqueio 005)', () => {
    writeFileSync(join(diretorioTemporario, 'index.html'), '<!doctype html>');
    writeFileSync(
      join(diretorioTemporario, 'chunk.js'),
      [
        'const FaixaSchema=S.object({de:S.number(),ate:S.number(),rotulo:S.string(),token:S.enum(d0)});',
        'const cor=o.zona?Xd[o.zona.token]:void 0;',
        'React.createElement("td",{"data-zona":(u=o.zona)==null?void 0:u.token},o.rotulo);',
      ].join('\n'),
    );

    expect(varrerDiretorio(diretorioTemporario)).toEqual([]);
  });

  it('não falsifica positivo com noticias.json/versao.json reais (ids sha256, Bloqueio 007)', () => {
    writeFileSync(
      join(diretorioTemporario, 'noticias.json'),
      JSON.stringify([
        {
          id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          titulo: 'Notícia de exemplo',
        },
      ]),
    );
    writeFileSync(
      join(diretorioTemporario, 'versao.json'),
      JSON.stringify({
        geradoEm: '2026-09-07T00:00:00.000Z',
        hashes: {
          noticias: 'a23f05a8cf4f083c108e530f21426e6b02e99a4cb89b55a861d5a0507d55284d',
          futebol: '64a3b25eef7252bcd2a224efceeca5a3d4234c194058b2277b14dbcf1d0add85',
          catalogo: '4c5ba4e084702dd24ac1fe86666b3ae1a5b81aefcf5753fe1fb3c9178d000001',
          status: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b850',
        },
      }),
    );

    expect(varrerDiretorio(diretorioTemporario)).toEqual([]);
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
