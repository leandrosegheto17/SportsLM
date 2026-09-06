// pipeline/ingestao-cli.ts — REFAT-06-01 (TASK.md Refatoração Lote-6)
//
// Ponto de entrada de `npm run ingestao` (rodado via `tsx`, devDependency —
// SDD §3 só fecha a lista de dependências de *runtime*; um executor de
// TypeScript usado só em CI/dev não exige atualização do GUARDRAILS.md).
// Liga, num único processo Node, os três pontos de entrada já existentes e
// testados:
//   1. `executarIngestaoNoticiasEmDisco` (ING-N-07, Fluxo 1)
//   2. `executarIngestaoFutebolEmDisco` (ING-F-05, Fluxo 2)
//   3. `gerarSnapshotsEmDisco` (PUB-02)
// Este módulo não reimplementa nenhuma regra de negócio — só orquestra a
// ordem de chamada e o resumo de log para o job de CI
// (`.github/workflows/ingestao.yml`).
//
// Decisão registrada: SEQUENCIAL, não `Promise.all` (TASK.md pede
// investigação explícita do risco de corrida na escrita concorrente do mesmo
// `estado/ingestao/status.json`, mesclado por `mesclarStatus` (ING-N-07) e
// `mesclarStatusFutebol` (ING-F-05)).
//
// Investigação: hoje, cada uma dessas duas funções faz a leitura + mescla +
// escrita de `status.json` inteiramente com chamadas SÍNCRONAS de `node:fs`
// (`readFileSync`/`writeFileSync`, sem `await` entre a leitura e a escrita) —
// dado o modelo "run-to-completion" do event loop do Node, esse bloco não
// pode ser interrompido pelo outro fluxo no meio da leitura+escrita, então
// não há corrupção de dado (nenhum dos dois lados "pisa" no outro em termos
// de perder uma chave). Ainda assim, rodar em paralelo (`Promise.all`)
// deixaria dois efeitos colaterais reais:
//   (a) `geradoEm` no nível raiz do `status.json` fica com o timestamp de
//       QUALQUER UM dos dois fluxos que escrever por último — não é
//       corrupção, mas é uma ordem não-determinística que dificulta
//       depuração (qual dos dois "geradoEm" está ali?); e
//   (b) essa ausência de corrida depende de um detalhe de implementação hoje
//       verdadeiro mas frágil (fs síncrono) — se `mesclarStatus`/
//       `gravarStatus` (ou o par de futebol) um dia trocar para
//       `node:fs/promises` sem que quem chama este CLI perceba, a mesma
//       leitura+mescla+escrita passa a ter um ponto de `await` no meio, e aí
//       sim os dois fluxos concorrentes podem intercalar e um sobrescrever o
//       outro (last-write-wins destrutivo, não apenas um `geradoEm`
//       "errado").
// Como este script não é sensível a performance (roda a cada 30 min, dentro
// de um timeout de 15 min do job, e as duas ingestões juntas historicamente
// levam bem menos que isso), a escolha mais simples e mais robusta a
// mudanças futuras é sequencial: notícias primeiro, depois futebol, depois o
// gerador de snapshots (que já depende do estado gravado pelos dois).

import { pathToFileURL } from 'node:url';

import {
  executarIngestaoNoticiasEmDisco,
  type ResultadoFluxoNoticias,
} from './noticias/orquestrador';
import {
  executarIngestaoFutebolEmDisco,
  type ResultadoFluxoFutebol,
} from './futebol/orquestrador';
import {
  gerarSnapshotsEmDisco,
  mapaDeArquivosPublicos,
  type SnapshotsPublicados,
} from './publicacao/gerador-snapshots';

/** Dependências injetáveis — só para teste (mocka os três pontos de entrada
 * sem tocar disco/rede real). Em produção, `dependenciasPadrao` chama os
 * wrappers de I/O reais, cada um resolvendo seus próprios caminhos/segredos
 * (`SPORTSLM_DIR_ESTADO`, `FOOTBALL_DATA_API_TOKEN`, `SPORTSLM_DIR_SAIDA`). */
export interface DependenciasIngestaoCli {
  executarNoticias: () => Promise<ResultadoFluxoNoticias>;
  executarFutebol: () => Promise<ResultadoFluxoFutebol>;
  gerarSnapshots: () => SnapshotsPublicados;
}

const dependenciasPadrao: DependenciasIngestaoCli = {
  executarNoticias: () => executarIngestaoNoticiasEmDisco(),
  executarFutebol: () => executarIngestaoFutebolEmDisco(),
  gerarSnapshots: () => gerarSnapshotsEmDisco(),
};

export interface ResumoIngestao {
  readonly noticias: { readonly itensPublicaveis: number };
  readonly futebol: {
    readonly competicoesAtualizadas: number;
    readonly competicoesTotal: number;
    readonly pausadoPorCota: boolean;
  };
  readonly publicacao: { readonly arquivosGerados: number };
}

/**
 * Executa os três passos do pipeline de ingestão, nesta ordem exata:
 * Fluxo 1 (notícias) → Fluxo 2 (futebol) → gerador de snapshots. Sequencial
 * de propósito (ver nota no topo do arquivo) — nunca `Promise.all`.
 *
 * Não engole erro nenhum: qualquer rejeição de qualquer um dos três passos
 * (ex. `FOOTBALL_DATA_API_TOKEN` ausente, erro de rede, `ErroPaletaInvalida`
 * do PUB-01) propaga para quem chamou, sem `catch` aqui — é `main()` (abaixo)
 * quem decide o `process.exit`.
 */
export async function executarIngestaoCompleta(
  deps: DependenciasIngestaoCli = dependenciasPadrao,
): Promise<ResumoIngestao> {
  const resultadoNoticias = await deps.executarNoticias();
  const resultadoFutebol = await deps.executarFutebol();
  const snapshots = deps.gerarSnapshots();

  const competicoes = Object.values(resultadoFutebol.status.futebol);

  return {
    noticias: { itensPublicaveis: resultadoNoticias.itensPublicaveis.length },
    futebol: {
      competicoesAtualizadas: competicoes.filter((c) => c.resultado === 'atualizada')
        .length,
      competicoesTotal: competicoes.length,
      pausadoPorCota: resultadoFutebol.status.pausadoPorCota,
    },
    publicacao: {
      arquivosGerados: Object.keys(mapaDeArquivosPublicos(snapshots)).length,
    },
  };
}

function formatarResumo(resumo: ResumoIngestao): string {
  return [
    'Ingestão concluída com sucesso:',
    `  notícias: ${String(resumo.noticias.itensPublicaveis)} item(ns) publicável(is)`,
    `  futebol: ${String(resumo.futebol.competicoesAtualizadas)}/${String(
      resumo.futebol.competicoesTotal,
    )} competição(ões) atualizada(s) nesta execução` +
      (resumo.futebol.pausadoPorCota
        ? ' — atenção: ao menos um provedor foi pausado por cota esgotada'
        : ''),
    `  publicação: ${String(resumo.publicacao.arquivosGerados)} arquivo(s) gerado(s) em dist-dados/`,
  ].join('\n');
}

/** Ponto de entrada do processo (`npm run ingestao`). Nunca engole falha:
 * qualquer erro real vira `process.exit(1)` com mensagem clara, para que
 * `.github/workflows/ingestao.yml` falhe corretamente (Diretriz de nunca
 * mascarar erro de pipeline). */
async function main(): Promise<void> {
  try {
    const resumo = await executarIngestaoCompleta();
    console.log(formatarResumo(resumo));
  } catch (erro) {
    console.error('Falha na execução do pipeline de ingestão (npm run ingestao).');
    console.error(erro instanceof Error ? (erro.stack ?? erro.message) : String(erro));
    process.exit(1);
  }
}

const chamadoDiretamente =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (chamadoDiretamente) {
  void main();
}
