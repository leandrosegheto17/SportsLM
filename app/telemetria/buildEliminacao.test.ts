// app/telemetria/buildEliminacao.test.ts — TEL-01 (TASK.md Lote 12)
//
// Prova que o interruptor de build (ADR-012 regra 5) não é "só um `if` em
// runtime": builda um entry-point sintético que referencia a API pública
// real deste módulo (`./index.ts`) duas vezes com o Vite — uma com
// `VITE_TELEMETRIA=on`, outra com a variável ausente (padrão "off") — e
// inspeciona o artefato de produção final.
//
// O entry-point é sintético (não o `app/main.tsx` real) de propósito: TEL-01
// é só o módulo `telemetria` (Lote 12); *chamar* as funções a partir de uma
// tela específica (abrir notícia, concluir onboarding, entrar em
// `/comparativo`) é integração fora deste escopo (nenhuma tarefa do
// TASK.md ainda faz essa ligação). Sem NENHUM ponto de chamada real, porém,
// o próprio tree-shaking já removeria o módulo de qualquer bundle por estar
// inalcançável — o que provaria só isso, não o interruptor de build
// específico. O entry sintético simula o dia em que uma tela chamar essa
// API, mantendo o teste honesto sobre o mecanismo do ADR-012 regra 5 sem
// inventar wiring de produto que não foi pedido.
//
// Mais lento que os demais testes deste módulo (dois builds reais) — por
// isso tem timeout estendido; roda mesmo assim dentro de `vitest run`/
// `npm test` porque a eliminação por build É o critério de aceite de TEL-01,
// não algo verificável só manualmente.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ_PROJETO = join(__dirname, '..', '..');
const CAMINHO_INDICE_TELEMETRIA = join(__dirname, 'index.ts').split('\\').join('/');
const TIMEOUT_MS = 120_000;

/** Strings que só podem existir no bundle quando a telemetria está de fato
 * alcançável e habilitada — nomes de evento (ADR-012 regra 1) e
 * identificadores internos do módulo, que não são usados por mais nada. */
const MARCADORES_MODULO_TELEMETRIA = [
  'primeira_interacao_util',
  'personalizacao_concluida',
  'comparativo_aberto',
  'registrarPrimeiraSessaoNoNucleo',
];

function criarProjetoSintetico(): { entrada: string; config: string; saida: string } {
  // O diretório sintético fica DENTRO da raiz do projeto (não em
  // `os.tmpdir()`) de propósito: `vite.config.ts` faz `import { defineConfig }
  // from 'vite'`, e a resolução de módulos do Node sobe a árvore de
  // diretórios a partir de onde o arquivo está — só encontra
  // `node_modules/vite` se o diretório sintético for descendente da raiz do
  // projeto. Removido ao final de cada build (`.gitignore` cobre o padrão
  // como salvaguarda, caso um teste aborte no meio).
  const diretorio = mkdtempSync(join(RAIZ_PROJETO, '.tmp-tel-build-'));
  const entrada = join(diretorio, 'entrada.ts');
  const config = join(diretorio, 'vite.config.ts');
  const saida = join(diretorio, 'dist');

  writeFileSync(
    entrada,
    [
      'import {',
      '  registrarComparativoAberto,',
      '  registrarPersonalizacaoConcluida,',
      '  registrarPrimeiraInteracaoUtil,',
      '  registrarPrimeiraSessao,',
      '  registrarRetorno,',
      '  telemetriaHabilitada,',
      `} from '${CAMINHO_INDICE_TELEMETRIA}';`,
      '',
      '// Simula uma futura tela chamando a API pública real do módulo — só',
      '// para tornar o módulo alcançável neste bundle sintético (ver',
      '// comentário de topo de buildEliminacao.test.ts).',
      'telemetriaHabilitada();',
      'registrarPrimeiraSessao();',
      'registrarRetorno(1);',
      'registrarPersonalizacaoConcluida(1, true);',
      'registrarPrimeiraInteracaoUtil(1);',
      "registrarComparativoAberto('comparativo');",
      '',
      'export {};',
      '',
    ].join('\n'),
    'utf-8',
  );

  writeFileSync(
    config,
    [
      "import { defineConfig } from 'vite';",
      '',
      'export default defineConfig({',
      '  build: {',
      '    lib: {',
      `      entry: '${entrada.split('\\').join('/')}',`,
      "      formats: ['es'],",
      "      fileName: () => 'saida.js',",
      '    },',
      `    outDir: '${saida.split('\\').join('/')}',`,
      '    emptyOutDir: true,',
      '    minify: false,',
      '  },',
      '});',
      '',
    ].join('\n'),
    'utf-8',
  );

  return { entrada, config, saida };
}

function buildar(variavelTelemetria: string | undefined): string {
  const { config, saida } = criarProjetoSintetico();

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (variavelTelemetria === undefined) {
    delete env['VITE_TELEMETRIA'];
  } else {
    env['VITE_TELEMETRIA'] = variavelTelemetria;
  }

  // Invoca o binário do Vite diretamente via `node` (em vez de `npx`/`npx.cmd`)
  // porque `execFileSync` com um `.cmd` no Windows exige `shell: true`, que
  // por sua vez reintroduz problemas de quoting de caminho — invocar o
  // arquivo `.js` do próprio pacote evita os dois problemas.
  const binarioVite = join(RAIZ_PROJETO, 'node_modules', 'vite', 'bin', 'vite.js');
  execFileSync(process.execPath, [binarioVite, 'build', '--config', config], {
    cwd: RAIZ_PROJETO,
    env,
    stdio: 'pipe',
  });

  const conteudo = readFileSync(join(saida, 'saida.js'), 'utf-8');
  rmSync(join(saida, '..'), { recursive: true, force: true });

  return conteudo;
}

describe('interruptor de build de TEL-01 (ADR-012 regra 5)', () => {
  it(
    'com VITE_TELEMETRIA=off (ou ausente), o bundle de produção não contém o módulo telemetria',
    () => {
      const bundle = buildar(undefined);

      for (const marcador of MARCADORES_MODULO_TELEMETRIA) {
        expect(bundle).not.toContain(marcador);
      }
    },
    TIMEOUT_MS,
  );

  it(
    'com VITE_TELEMETRIA=on, o bundle de produção contém o módulo telemetria',
    () => {
      const bundle = buildar('on');

      for (const marcador of MARCADORES_MODULO_TELEMETRIA) {
        expect(bundle).toContain(marcador);
      }
    },
    TIMEOUT_MS,
  );
});
