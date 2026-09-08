// pipeline/noticias/orquestrador.test.ts — ING-N-07 (TASK.md Lote 4)
//
// Teste de integração de ponta a ponta do Fluxo 1 (SDD §2.3): 3 fontes
// mockadas (nenhuma chamada de rede real — `BuscadorHttp` sempre injetado),
// cobrindo coleta → descarte por link inválido/já ingerido → normalização →
// classificação → deduplicação → retenção → avaliação de estabilidade
// (RN-08) → `status.json` (SDD §5.4). Também cobre a camada de I/O
// (`executarIngestaoNoticiasEmDisco`) contra um diretório de estado
// temporário, sem tocar `config/`/`estado/` reais do repositório.

import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BuscadorHttp } from './coletor-rss';
import {
  executarFluxoNoticias,
  executarIngestaoNoticiasEmDisco,
  estadoNoticiasVazio,
  carregarFontesDominio,
  carregarLexicoEsportes,
  carregarCategoriasPorFonte,
  type EstadoNoticias,
} from './orquestrador';
import type { Fonte } from '../../dominio/tipos/noticias';
import type { LexicoEsportes } from '../../dominio/esportes';

const AGORA = new Date('2026-09-06T12:00:00-03:00');

function fonte(parcial: Partial<Fonte> & Pick<Fonte, 'id'>): Fonte {
  return {
    nome: parcial.id,
    fixa: false,
    esportesCobertos: ['futebol'],
    termos: { url: null, verificadoEm: '2026-09-05', uso: 'nao-comercial' },
    frequenciaMaximaMin: 30,
    feeds: [],
    verificacao: { estado: 'verificada', em: '2026-09-05' },
    ...parcial,
  };
}

const FEED_RSS = (
  itens: { titulo: string; link: string; pubDate: string; resumo?: string }[],
) => `
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Feed de teste</title>
    ${itens
      .map(
        (item) => `
    <item>
      <title>${item.titulo}</title>
      <link>${item.link}</link>
      ${item.resumo ? `<description>${item.resumo}</description>` : ''}
      <pubDate>${item.pubDate}</pubDate>
      <guid>${item.link}</guid>
    </item>`,
      )
      .join('')}
  </channel>
</rss>`;

const LEXICO_TESTE: LexicoEsportes = {
  porEsporte: [
    {
      esporte: 'futebol',
      termos: [
        { termo: 'gol', peso: 3 },
        { termo: 'campeonato', peso: 2 },
      ],
    },
    {
      esporte: 'tenis',
      termos: [
        { termo: 'saque', peso: 3 },
        { termo: 'quadra', peso: 2 },
      ],
    },
  ],
  foraDoRecorte: [{ nome: 'handebol', termos: [{ termo: 'handebol', peso: 3 }] }],
};

/** Fonte 1: multi-esporte (`geral` quando o léxico não decide). */
const FONTE_1 = fonte({
  id: 'fonte-1',
  esportesCobertos: ['futebol', 'tenis'],
  frequenciaMaximaMin: 30,
  feeds: [
    {
      id: 'fonte-1-feed',
      url: 'https://fonte1.exemplo/feed',
      formato: 'rss',
      esporteFixado: null,
    },
  ],
});

/** Fonte 2: mono-esporte tênis — nível 4 herda o esporte da fonte sem vencedor no léxico. */
const FONTE_2 = fonte({
  id: 'fonte-2',
  esportesCobertos: ['tenis'],
  frequenciaMaximaMin: 30,
  feeds: [
    {
      id: 'fonte-2-feed',
      url: 'https://fonte2.exemplo/feed',
      formato: 'rss',
      esporteFixado: null,
    },
  ],
});

/** Fonte 3: fixa (GE) — instabilidade dela gera evento de severidade alta (CA-15.6). */
const FONTE_3_FIXA = fonte({
  id: 'fonte-3-fixa',
  fixa: true,
  esportesCobertos: ['futebol', 'tenis'],
  frequenciaMaximaMin: 30,
  feeds: [
    {
      id: 'fonte-3-feed',
      url: 'https://fonte3.exemplo/feed',
      formato: 'rss',
      esporteFixado: null,
    },
  ],
});

function buscadorPorUrl(
  mapa: Record<string, { status: number; corpo: string } | Error>,
): BuscadorHttp {
  return async (url: string) => {
    const resultado = mapa[url];
    if (resultado === undefined) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
        arrayBuffer: async () => new TextEncoder().encode('').buffer,
      };
    }
    if (resultado instanceof Error) {
      throw resultado;
    }
    return {
      ok: resultado.status >= 200 && resultado.status < 300,
      status: resultado.status,
      headers: { get: () => null },
      arrayBuffer: async () => new TextEncoder().encode(resultado.corpo).buffer,
    };
  };
}

describe('executarFluxoNoticias — Fluxo 1 de ponta a ponta (ING-N-07)', () => {
  it('produz itens normalizados, classificados, deduplicados e com retenção aplicada, a partir de 3 fontes mockadas', async () => {
    const buscar = buscadorPorUrl({
      'https://fonte1.exemplo/feed': {
        status: 200,
        corpo: FEED_RSS([
          {
            // Marcação vem como entidade (`&lt;b&gt;`), como um feed real
            // codifica HTML embutido em `<title>` — tag literal não-escapada
            // seria interpretada pelo próprio parser XML como elemento filho,
            // não como texto (isso é uma característica do XML, não um bug
            // de `normalizador-item`/ING-N-02, que só vê texto já extraído).
            titulo: 'Time faz &lt;b&gt;golaço&lt;/b&gt; e vence o campeonato',
            link: 'https://fonte1.exemplo/noticia-gol',
            pubDate: 'Sun, 06 Sep 2026 10:00:00 -0300',
            resumo: 'Resumo do gol decisivo.',
          },
          {
            titulo: 'Notícia sem relação com esporte do recorte',
            link: 'https://fonte1.exemplo/noticia-geral',
            pubDate: 'Sun, 06 Sep 2026 09:00:00 -0300',
          },
          {
            titulo: 'Confronto de handebol movimenta torcida',
            link: 'https://fonte1.exemplo/noticia-handebol',
            pubDate: 'Sun, 06 Sep 2026 08:00:00 -0300',
          },
        ]),
      },
      'https://fonte2.exemplo/feed': {
        status: 200,
        corpo: FEED_RSS([
          {
            // Título similar ao de fonte-1 (mesmo evento, fonte distinta, dentro de 12h) → deduplica.
            titulo: 'Time faz golaço e vence o campeonato dramático',
            link: 'https://fonte2.exemplo/noticia-gol-2',
            pubDate: 'Sun, 06 Sep 2026 10:30:00 -0300',
          },
          {
            titulo: 'Sem link válido nesta notícia',
            link: 'javascript:alert(1)',
            pubDate: 'Sun, 06 Sep 2026 10:00:00 -0300',
          },
        ]),
      },
      'https://fonte3.exemplo/feed': {
        status: 200,
        corpo: FEED_RSS([
          {
            titulo: 'Atleta vence no saque e avança na quadra',
            link: 'https://fonte3.exemplo/noticia-tenis',
            pubDate: 'Sun, 06 Sep 2026 07:00:00 -0300',
          },
        ]),
      },
    });

    const resultado = await executarFluxoNoticias(
      [FONTE_1, FONTE_2, FONTE_3_FIXA],
      LEXICO_TESTE,
      {},
      estadoNoticiasVazio(),
      AGORA,
      { buscar },
    );

    // fora-do-recorte (handebol) nunca sai para o público (CA-04.8).
    expect(resultado.itensPublicaveis.some((i) => i.esporte === 'fora-do-recorte')).toBe(
      false,
    );
    // link inválido (javascript:) foi descartado — nunca vira item.
    expect(resultado.itensPublicaveis.some((i) => i.link.startsWith('javascript:'))).toBe(
      false,
    );

    // Item "geral" (sem termo de léxico, fonte-1 multi-esporte) existe e nunca é 'geral' fora do domínio esperado.
    const itemGeral = resultado.itensPublicaveis.find(
      (i) => i.link === 'https://fonte1.exemplo/noticia-geral',
    );
    expect(itemGeral?.esporte).toBe('geral');

    // Item de tênis da fonte-2 (mono-esporte) — nível 4 herda 'tenis' mesmo sem termo de léxico.
    // (fonte-2 não tem nenhum item neste teste que não seja deduplicado — ver grupo abaixo.)

    // Deduplicação: os itens de fonte-1 e fonte-2 sobre o "golaço"/"campeonato" formam grupo (RN-16).
    const itemGolFonte1 = resultado.itensPublicaveis.find(
      (i) => i.link === 'https://fonte1.exemplo/noticia-gol',
    );
    const itemGolFonte2 = resultado.itensPublicaveis.find(
      (i) => i.link === 'https://fonte2.exemplo/noticia-gol-2',
    );
    expect(itemGolFonte1).toBeDefined();
    expect(itemGolFonte2).toBeDefined();
    expect(itemGolFonte1?.grupoId).not.toBeNull();
    expect(itemGolFonte1?.grupoId).toBe(itemGolFonte2?.grupoId);
    expect(itemGolFonte1?.esporte).toBe('futebol');

    // Item de tênis da fonte-3 (fixa) classificado corretamente pelo léxico.
    const itemTenis = resultado.itensPublicaveis.find(
      (i) => i.link === 'https://fonte3.exemplo/noticia-tenis',
    );
    expect(itemTenis?.esporte).toBe('tenis');

    // Marcação HTML (decodificada de entidade) removida do título (ADR-011).
    expect(itemGolFonte1?.titulo).not.toContain('<b>');
    expect(itemGolFonte1?.titulo).not.toContain('&lt;');
    expect(itemGolFonte1?.titulo).toContain('golaço');

    // status.json coerente (SDD §5.4).
    expect(resultado.status.geradoEm).toBe(AGORA.toISOString());
    expect(resultado.status.fontes['fonte-1']?.resultado).toBe('ok');
    expect(resultado.status.fontes['fonte-1']?.itensNovos).toBe(3); // gol + geral + handebol (todos entram no estado interno)
    expect(resultado.status.fontes['fonte-2']?.itensNovos).toBe(1); // só o item com link válido
    expect(resultado.status.fontes['fonte-3-fixa']?.itensNovos).toBe(1);
    expect(resultado.status.fontes['fonte-1']?.instavel).toBe(false);
    expect(resultado.status.gruposFormados).toBeGreaterThanOrEqual(1);
    expect(resultado.status.distribuicaoClassificacao['futebol']).toBeGreaterThanOrEqual(
      1,
    );
    // fora-do-recorte aparece na distribuição (estado interno), mesmo não sendo publicável.
    expect(resultado.status.distribuicaoClassificacao['fora-do-recorte']).toBe(1);

    // Estado interno completo inclui o item fora-do-recorte (CA-04.8).
    expect(resultado.novoEstado.itens.some((i) => i.esporte === 'fora-do-recorte')).toBe(
      true,
    );
    expect(Object.keys(resultado.novoEstado.idsIngeridos).length).toBe(
      resultado.novoEstado.itens.length,
    );
  });

  it('CA-15.3: não reprocessa item já ingerido em execução anterior', async () => {
    const buscar = buscadorPorUrl({
      'https://fonte1.exemplo/feed': {
        status: 200,
        corpo: FEED_RSS([
          {
            titulo: 'Gol no campeonato de ontem',
            link: 'https://fonte1.exemplo/ja-ingerido',
            pubDate: 'Sun, 06 Sep 2026 10:00:00 -0300',
          },
        ]),
      },
    });

    const primeiraExecucao = await executarFluxoNoticias(
      [FONTE_1],
      LEXICO_TESTE,
      {},
      estadoNoticiasVazio(),
      AGORA,
      { buscar },
    );
    expect(primeiraExecucao.status.fontes['fonte-1']?.itensNovos).toBe(1);

    const segundaExecucao = await executarFluxoNoticias(
      [FONTE_1],
      LEXICO_TESTE,
      {},
      primeiraExecucao.novoEstado,
      new Date(AGORA.getTime() + 30 * 60_000),
      { buscar },
    );
    // Mesmo item, mesmo link → já ingerido (CA-15.3): 0 itens novos desta vez.
    expect(segundaExecucao.status.fontes['fonte-1']?.itensNovos).toBe(0);
    expect(segundaExecucao.novoEstado.itens).toHaveLength(1);
  });

  it('RN-08/CA-15.6: fonte fixa instável (falhas consecutivas) gera evento de severidade alta', async () => {
    const buscar: BuscadorHttp = async () => {
      throw new Error('rede indisponível');
    };

    let estado: EstadoNoticias = estadoNoticiasVazio();
    let instanteAtual = AGORA;
    let ultimoResultado;
    // 14 execuções a cada 30 min: >= 12 tentativas e span estritamente > 6h
    // entre a 1ª falha e o instante da última avaliação (RN-08 exige "> 6h",
    // não "≥"; com exatamente 13 execuções o span bateria em 6h exatas —
    // mesmo limite testado em `avaliador-fontes.test.ts`).
    for (let i = 0; i < 14; i += 1) {
      ultimoResultado = await executarFluxoNoticias(
        [FONTE_3_FIXA],
        LEXICO_TESTE,
        {},
        estado,
        instanteAtual,
        { buscar },
      );
      estado = ultimoResultado.novoEstado;
      instanteAtual = new Date(instanteAtual.getTime() + 30 * 60_000);
    }

    expect(ultimoResultado?.status.fontes['fonte-3-fixa']?.instavel).toBe(true);
    expect(
      ultimoResultado?.status.fontes['fonte-3-fixa']?.falhasConsecutivas,
    ).toBeGreaterThanOrEqual(12);
    expect(ultimoResultado?.status.fontes['fonte-3-fixa']?.severidade).toBe('alta');
  });

  it('respeita frequenciaMaximaMin entre execuções (CA-15.7): pula quando o intervalo não passou', async () => {
    let chamadas = 0;
    const buscar: BuscadorHttp = async () => {
      chamadas += 1;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        arrayBuffer: async () => new TextEncoder().encode(FEED_RSS([])).buffer,
      };
    };

    const primeira = await executarFluxoNoticias(
      [FONTE_1],
      LEXICO_TESTE,
      {},
      estadoNoticiasVazio(),
      AGORA,
      { buscar },
    );
    expect(chamadas).toBe(1);

    // 5 minutos depois — dentro do intervalo de 30 min: pula a busca real.
    await executarFluxoNoticias(
      [FONTE_1],
      LEXICO_TESTE,
      {},
      primeira.novoEstado,
      new Date(AGORA.getTime() + 5 * 60_000),
      { buscar },
    );
    expect(chamadas).toBe(1);
    expect(
      primeira.status.fontes['fonte-1']?.resultado === 'ok' ||
        primeira.status.fontes['fonte-1']?.resultado === 'pulado',
    ).toBe(true);
  });
});

describe('executarIngestaoNoticiasEmDisco — camada de I/O (ING-N-07)', () => {
  let dirTemp: string;

  afterEach(() => {
    if (dirTemp !== undefined && existsSync(dirTemp)) {
      rmSync(dirTemp, { recursive: true, force: true });
    }
  });

  it('lê config/ real do repositório, grava estado interno e ingestao/status.json coerentes', async () => {
    dirTemp = mkdtempSync(join(tmpdir(), 'sportslm-ingestao-'));

    // Confirma que os loaders batem com os arquivos reais publicados pelo Lote 2/4.
    const fontesReais = carregarFontesDominio();
    expect(fontesReais.length).toBe(7);
    const lexicoReal = carregarLexicoEsportes();
    expect(lexicoReal.porEsporte.length).toBeGreaterThan(0);
    const categoriasReais = carregarCategoriasPorFonte();
    expect(categoriasReais).toEqual({});

    const buscar: BuscadorHttp = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () =>
        new TextEncoder().encode(
          FEED_RSS([
            {
              titulo: 'Notícia de teste da camada de disco',
              link: 'https://exemplo.disco/noticia-1',
              pubDate: 'Sun, 06 Sep 2026 10:00:00 -0300',
            },
          ]),
        ).buffer,
    });

    const caminhoEstado = join(dirTemp, 'noticias.json');
    const caminhoStatus = join(dirTemp, 'ingestao', 'status.json');

    const resultado = await executarIngestaoNoticiasEmDisco({
      agora: AGORA,
      buscar,
      caminhoEstado,
      caminhoStatus,
    });

    expect(existsSync(caminhoEstado)).toBe(true);
    expect(existsSync(caminhoStatus)).toBe(true);

    const estadoGravado = JSON.parse(
      readFileSync(caminhoEstado, 'utf8'),
    ) as EstadoNoticias;
    expect(estadoGravado.itens.length).toBe(resultado.novoEstado.itens.length);

    const statusGravado = JSON.parse(readFileSync(caminhoStatus, 'utf8')) as {
      geradoEm: string;
    };
    expect(statusGravado.geradoEm).toBe(AGORA.toISOString());
  });

  it('mesclarStatus preserva chaves de futebol/provedores já existentes em disco (não sobrescreve ING-F-05/PUB-02)', async () => {
    dirTemp = mkdtempSync(join(tmpdir(), 'sportslm-ingestao-merge-'));
    const caminhoEstado = join(dirTemp, 'noticias.json');
    const caminhoStatus = join(dirTemp, 'ingestao', 'status.json');

    // Simula um status.json com uma porção de futebol já gravada por outra
    // execução (ING-F-05/PUB-02, fora do escopo desta tarefa).
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(join(dirTemp, 'ingestao'), { recursive: true });
    writeFileSync(
      caminhoStatus,
      JSON.stringify({
        geradoEm: '2026-09-01T00:00:00-03:00',
        pausadoPorCota: true,
        provedores: {
          'football-data': { ultimaAtualizacao: '2026-09-01T00:00:00-03:00' },
        },
      }),
      'utf8',
    );

    const buscar: BuscadorHttp = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => new TextEncoder().encode(FEED_RSS([])).buffer,
    });

    await executarIngestaoNoticiasEmDisco({
      agora: AGORA,
      buscar,
      caminhoEstado,
      caminhoStatus,
    });

    const statusGravado = JSON.parse(readFileSync(caminhoStatus, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(statusGravado['pausadoPorCota']).toBe(true);
    expect(statusGravado['provedores']).toEqual({
      'football-data': { ultimaAtualizacao: '2026-09-01T00:00:00-03:00' },
    });
    expect(statusGravado['geradoEm']).toBe(AGORA.toISOString());
  });
});
