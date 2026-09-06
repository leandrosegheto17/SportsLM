#!/usr/bin/env node
// pipeline/ci/verificar-segredos.mjs — FUND-03 (SDD §7.2, GUARDRAILS.md §4/§2)
//
// Varredura obrigatória e bloqueante do diretório publicado (`dist/`) em
// busca de padrões de segredo antes da publicação. Segredo encontrado =
// falha da construção, sem exceção (SDD §7.2).
//
// Padrões verificados: `token`, `api_key`, `Bearer`, chave hexadecimal de
// 32+ caracteres. Só varre extensões de texto (o artefato do Vite é
// HTML/JS/CSS/JSON/mapa de origem); binário é ignorado.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PADROES_SEGREDO = [
  { nome: 'token', regex: /\btoken\b/i },
  { nome: 'api_key', regex: /\bapi[_-]?key\b/i },
  { nome: 'Bearer', regex: /\bBearer\b/ },
  { nome: 'chave-hex-32+', regex: /\b[0-9a-fA-F]{32,}\b/ },
];

const EXTENSOES_TEXTO = new Set([
  '.html',
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.json',
  '.map',
  '.txt',
  '.svg',
]);

/**
 * Procura, num único conteúdo de arquivo, todos os padrões de segredo que
 * casam. Função pura — recebe o conteúdo, não lê disco.
 * @param {string} conteudo
 * @returns {{ nome: string }[]}
 */
export function encontrarSegredos(conteudo) {
  return PADROES_SEGREDO.filter((padrao) => padrao.regex.test(conteudo));
}

/**
 * Lista recursivamente todos os arquivos de texto sob `raiz`.
 * @param {string} raiz
 * @returns {string[]}
 */
function listarArquivosDeTexto(raiz) {
  const resultado = [];
  const pilha = [raiz];
  while (pilha.length > 0) {
    const atual = pilha.pop();
    if (atual === undefined) continue;
    const info = statSync(atual);
    if (info.isDirectory()) {
      for (const item of readdirSync(atual)) {
        pilha.push(join(atual, item));
      }
    } else if (EXTENSOES_TEXTO.has(extname(atual).toLowerCase())) {
      resultado.push(atual);
    }
  }
  return resultado;
}

/**
 * Varre um diretório publicado inteiro. Retorna um achado por
 * arquivo×padrão encontrado (lista vazia = diretório limpo).
 * @param {string} diretorio
 * @returns {{ arquivo: string; padrao: string }[]}
 */
export function varrerDiretorio(diretorio) {
  const achados = [];
  for (const arquivo of listarArquivosDeTexto(diretorio)) {
    const conteudo = readFileSync(arquivo, 'utf8');
    for (const padrao of encontrarSegredos(conteudo)) {
      achados.push({ arquivo, padrao: padrao.nome });
    }
  }
  return achados;
}

function executarCli() {
  const diretorio = process.argv[2];
  if (diretorio === undefined) {
    console.error('Uso: verificar-segredos.mjs <diretorio-publicado>');
    process.exit(2);
  }

  let achados;
  try {
    achados = varrerDiretorio(diretorio);
  } catch (erro) {
    console.error(`Falha ao varrer '${diretorio}': ${String(erro)}`);
    process.exit(2);
    return;
  }

  if (achados.length > 0) {
    console.error(
      'Segredo encontrado no artefato publicado (SDD §7.2) — build bloqueada:',
    );
    for (const achado of achados) {
      console.error(`  - ${achado.arquivo}: padrão '${achado.padrao}'`);
    }
    process.exit(1);
  }

  console.log(`Varredura de segredo: nenhum padrão encontrado em '${diretorio}'.`);
}

const chamadoDiretamente =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (chamadoDiretamente) {
  executarCli();
}
