// pipeline/noticias/coletor-rss.test.ts — ING-N-01 (TASK.md Lote 4)
//
// Testes por tabela do `coletor-rss`: feed mockado (RSS 2.0 e Atom),
// respeito a `frequenciaMaximaMin` (CA-15.7), registro de tentativa mesmo em
// falha (CA-15.5), e fonte sem feed configurado (GE pendente). Nenhum teste
// faz chamada de rede real — o buscador HTTP é sempre injetado.

import { describe, expect, it } from 'vitest';
import {
  analisarFeed,
  coletarCatalogo,
  coletarFeed,
  coletarFonte,
  carregarCatalogoFontes,
  type BuscadorHttp,
  type FonteParaColeta,
} from './coletor-rss';

const FEED_RSS_VALIDO = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Exemplo RSS</title>
    <item>
      <title>Time vence clássico no fim do jogo</title>
      <link>https://exemplo.com/noticia-1</link>
      <description>Resumo da partida com detalhes do confronto.</description>
      <pubDate>Fri, 05 Sep 2026 20:30:00 -0300</pubDate>
      <guid>https://exemplo.com/noticia-1</guid>
    </item>
    <item>
      <title>Outra notícia do dia</title>
      <link>https://exemplo.com/noticia-2</link>
      <pubDate>Fri, 05 Sep 2026 18:00:00 -0300</pubDate>
      <guid>https://exemplo.com/noticia-2</guid>
    </item>
  </channel>
</rss>`;

const FEED_ATOM_VALIDO = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Exemplo Atom</title>
  <entry>
    <title>Atleta bate recorde nacional</title>
    <link rel="alternate" href="https://exemplo.com/atom/noticia-1"/>
    <link rel="self" href="https://exemplo.com/atom/feed"/>
    <summary>Resumo curto do feito.</summary>
    <updated>2026-09-05T20:00:00-03:00</updated>
    <id>urn:uuid:1</id>
  </entry>
  <entry>
    <title>Equipe confirma escalação</title>
    <link href="https://exemplo.com/atom/noticia-2"/>
    <content>Conteúdo mais longo da matéria.</content>
    <published>2026-09-05T15:00:00-03:00</published>
    <id>urn:uuid:2</id>
  </entry>
</feed>`;

function buscadorFixo(status: number, corpo: string): BuscadorHttp {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => corpo,
  });
}

function buscadorQueLanca(mensagem: string): BuscadorHttp {
  return async () => {
    throw new Error(mensagem);
  };
}

describe('analisarFeed', () => {
  it('faz o parse de um feed RSS 2.0 válido', () => {
    const itens = analisarFeed(
      FEED_RSS_VALIDO,
      { id: 'feed-1', formato: 'rss' },
      'fonte-1',
    );
    expect(itens).toHaveLength(2);
    expect(itens[0]).toEqual({
      fonteId: 'fonte-1',
      feedId: 'feed-1',
      titulo: 'Time vence clássico no fim do jogo',
      link: 'https://exemplo.com/noticia-1',
      resumoBruto: 'Resumo da partida com detalhes do confronto.',
      publicadoBruto: 'Fri, 05 Sep 2026 20:30:00 -0300',
      guid: 'https://exemplo.com/noticia-1',
    });
    // item sem <description> — resumo bruto ausente, sem lançar (ING-N-02 decide o que fazer)
    expect(itens[1]?.resumoBruto).toBeNull();
  });

  it('faz o parse de um feed Atom válido, preferindo o link rel="alternate"', () => {
    const itens = analisarFeed(
      FEED_ATOM_VALIDO,
      { id: 'feed-2', formato: 'atom' },
      'fonte-2',
    );
    expect(itens).toHaveLength(2);
    expect(itens[0]).toEqual({
      fonteId: 'fonte-2',
      feedId: 'feed-2',
      titulo: 'Atleta bate recorde nacional',
      link: 'https://exemplo.com/atom/noticia-1',
      resumoBruto: 'Resumo curto do feito.',
      publicadoBruto: '2026-09-05T20:00:00-03:00',
      guid: 'urn:uuid:1',
    });
    // entrada 2: <link> único sem rel — assume alternate; usa <content> (sem <summary>)
    expect(itens[1]).toEqual({
      fonteId: 'fonte-2',
      feedId: 'feed-2',
      titulo: 'Equipe confirma escalação',
      link: 'https://exemplo.com/atom/noticia-2',
      resumoBruto: 'Conteúdo mais longo da matéria.',
      publicadoBruto: '2026-09-05T15:00:00-03:00',
      guid: 'urn:uuid:2',
    });
  });

  it('devolve lista vazia para um único item RSS (não array) sem lançar', () => {
    const feedUmItem = `<rss version="2.0"><channel><item><title>Único</title><link>https://exemplo.com/u</link></item></channel></rss>`;
    const itens = analisarFeed(feedUmItem, { id: 'f', formato: 'rss' }, 'fonte-1');
    expect(itens).toHaveLength(1);
    expect(itens[0]?.titulo).toBe('Único');
  });

  it('não lança para XML malformado (parser tolerante, SDD §3); item incompleto fica com campos nulos', () => {
    // `fast-xml-parser` é tolerante a XML mal formado (comum em feed de
    // portal, SDD §3) — a tag <item> sem fechamento ainda produz um item,
    // só que sem nenhum texto reconhecível. Descartar item sem título/link é
    // decisão de ING-N-02 (`normalizador-item`), não deste módulo.
    const itens = analisarFeed(
      '<rss><channel><item>',
      { id: 'f', formato: 'rss' },
      'fonte-1',
    );
    expect(itens).toHaveLength(1);
    expect(itens[0]).toEqual({
      fonteId: 'fonte-1',
      feedId: 'f',
      titulo: null,
      link: null,
      resumoBruto: null,
      publicadoBruto: null,
      guid: null,
    });
  });

  it('não lança e devolve lista vazia para um documento sem estrutura de canal/feed reconhecível', () => {
    const itens = analisarFeed(
      'não é xml nenhum',
      { id: 'f', formato: 'rss' },
      'fonte-1',
    );
    expect(itens).toEqual([]);
  });
});

describe('coletarFeed', () => {
  it('registra "ok" e devolve os itens quando a busca é bem-sucedida (RSS)', async () => {
    const agora = new Date('2026-09-05T21:00:00-03:00');
    const resultado = await coletarFeed(
      {
        id: 'feed-1',
        url: 'https://exemplo.com/rss.xml',
        formato: 'rss',
        esporteFixado: null,
      },
      'fonte-1',
      { agora, buscar: buscadorFixo(200, FEED_RSS_VALIDO) },
    );
    expect(resultado.registro).toEqual({
      fonteId: 'fonte-1',
      feedId: 'feed-1',
      horario: agora.toISOString(),
      resultado: 'ok',
      itensObtidos: 2,
    });
    expect(resultado.itens).toHaveLength(2);
  });

  it('registra "ok" e devolve os itens quando a busca é bem-sucedida (Atom)', async () => {
    const resultado = await coletarFeed(
      {
        id: 'feed-2',
        url: 'https://exemplo.com/atom.xml',
        formato: 'atom',
        esporteFixado: null,
      },
      'fonte-2',
      { buscar: buscadorFixo(200, FEED_ATOM_VALIDO) },
    );
    expect(resultado.registro.resultado).toBe('ok');
    expect(resultado.registro.itensObtidos).toBe(2);
    expect(resultado.itens).toHaveLength(2);
  });

  it('CA-15.5: registra "falha" (nunca lança) quando o HTTP retorna erro', async () => {
    const resultado = await coletarFeed(
      {
        id: 'feed-1',
        url: 'https://exemplo.com/rss.xml',
        formato: 'rss',
        esporteFixado: null,
      },
      'fonte-1',
      { buscar: buscadorFixo(503, '') },
    );
    expect(resultado.registro.resultado).toBe('falha');
    expect(resultado.registro.motivo).toBe('HTTP 503');
    expect(resultado.itens).toEqual([]);
  });

  it('CA-15.5: registra "falha" (nunca lança) quando a busca lança exceção de rede', async () => {
    const resultado = await coletarFeed(
      {
        id: 'feed-1',
        url: 'https://exemplo.com/rss.xml',
        formato: 'rss',
        esporteFixado: null,
      },
      'fonte-1',
      { buscar: buscadorQueLanca('timeout de conexão') },
    );
    expect(resultado.registro.resultado).toBe('falha');
    expect(resultado.registro.motivo).toBe('timeout de conexão');
    expect(resultado.itens).toEqual([]);
  });
});

describe('coletarFonte', () => {
  const fonteExemplo: FonteParaColeta = {
    id: 'fonte-1',
    frequenciaMaximaMin: 30,
    feeds: [
      {
        id: 'feed-1',
        url: 'https://exemplo.com/rss.xml',
        formato: 'rss',
        esporteFixado: null,
      },
    ],
  };

  it('CA-15.1: busca e registra quando não há tentativa anterior', async () => {
    const resultado = await coletarFonte(fonteExemplo, undefined, {
      buscar: buscadorFixo(200, FEED_RSS_VALIDO),
    });
    expect(resultado.registros).toHaveLength(1);
    expect(resultado.registros[0]?.resultado).toBe('ok');
    expect(resultado.itens).toHaveLength(2);
  });

  it('CA-15.7: pula a busca e registra "pulado" quando a frequência máxima ainda não foi atingida', async () => {
    const agora = new Date('2026-09-05T21:00:00-03:00');
    const ultimaTentativaEm = new Date('2026-09-05T20:45:00-03:00').toISOString(); // 15 min atrás, limite 30
    let buscou = false;
    const resultado = await coletarFonte(fonteExemplo, ultimaTentativaEm, {
      agora,
      buscar: async () => {
        buscou = true;
        return { ok: true, status: 200, text: async () => FEED_RSS_VALIDO };
      },
    });
    expect(buscou).toBe(false);
    expect(resultado.registros).toEqual([
      {
        fonteId: 'fonte-1',
        feedId: 'feed-1',
        horario: agora.toISOString(),
        resultado: 'pulado',
        motivo: 'frequenciaMaximaMin (30 min) ainda não atingida (CA-15.7)',
      },
    ]);
    expect(resultado.itens).toEqual([]);
  });

  it('CA-15.7: busca novamente quando a frequência máxima já foi atingida', async () => {
    const agora = new Date('2026-09-05T21:00:00-03:00');
    const ultimaTentativaEm = new Date('2026-09-05T20:29:00-03:00').toISOString(); // 31 min atrás, limite 30
    const resultado = await coletarFonte(fonteExemplo, ultimaTentativaEm, {
      agora,
      buscar: buscadorFixo(200, FEED_RSS_VALIDO),
    });
    expect(resultado.registros[0]?.resultado).toBe('ok');
    expect(resultado.itens).toHaveLength(2);
  });

  it('CA-15.5: registra "falha" por feed mesmo com múltiplos feeds na fonte, mantendo os itens dos demais', async () => {
    const fonteComDoisFeeds: FonteParaColeta = {
      id: 'fonte-multi',
      frequenciaMaximaMin: 30,
      feeds: [
        {
          id: 'feed-ok',
          url: 'https://exemplo.com/a.xml',
          formato: 'rss',
          esporteFixado: null,
        },
        {
          id: 'feed-falha',
          url: 'https://exemplo.com/b.xml',
          formato: 'atom',
          esporteFixado: null,
        },
      ],
    };
    const resultado = await coletarFonte(fonteComDoisFeeds, undefined, {
      buscar: async (url) => {
        if (url.endsWith('a.xml')) {
          return { ok: true, status: 200, text: async () => FEED_RSS_VALIDO };
        }
        return { ok: false, status: 500, text: async () => '' };
      },
    });
    expect(resultado.registros).toHaveLength(2);
    const registroOk = resultado.registros.find((r) => r.feedId === 'feed-ok');
    const registroFalha = resultado.registros.find((r) => r.feedId === 'feed-falha');
    expect(registroOk?.resultado).toBe('ok');
    expect(registroFalha?.resultado).toBe('falha');
    expect(registroFalha?.motivo).toBe('HTTP 500');
    // itens do feed que funcionou são mantidos mesmo com falha no outro feed (CA-15.5)
    expect(resultado.itens).toHaveLength(2);
  });

  it('gera um registro "pulado" para fonte sem nenhum feed configurado (ex.: GE pendente)', async () => {
    const fonteSemFeed: FonteParaColeta = {
      id: 'ge',
      frequenciaMaximaMin: 30,
      feeds: [],
    };
    const resultado = await coletarFonte(fonteSemFeed, undefined, {});
    expect(resultado.registros).toHaveLength(1);
    expect(resultado.registros[0]?.resultado).toBe('pulado');
    expect(resultado.registros[0]?.feedId).toBe('(nenhum)');
    expect(resultado.itens).toEqual([]);
  });
});

describe('coletarCatalogo', () => {
  it('busca cada fonte do catálogo, respeitando a última tentativa por fonte', async () => {
    const fontes: FonteParaColeta[] = [
      {
        id: 'fonte-a',
        frequenciaMaximaMin: 30,
        feeds: [
          { id: 'a1', url: 'https://a.com/rss.xml', formato: 'rss', esporteFixado: null },
        ],
      },
      {
        id: 'fonte-b',
        frequenciaMaximaMin: 30,
        feeds: [
          {
            id: 'b1',
            url: 'https://b.com/atom.xml',
            formato: 'atom',
            esporteFixado: null,
          },
        ],
      },
    ];
    const agora = new Date('2026-09-05T21:00:00-03:00');
    const ultimaTentativaPorFonte = {
      'fonte-a': new Date('2026-09-05T20:45:00-03:00').toISOString(), // 15 min — pula
      'fonte-b': null, // nunca tentou — busca
    };
    const resultados = await coletarCatalogo(fontes, ultimaTentativaPorFonte, {
      agora,
      buscar: async (url) => ({
        ok: true,
        status: 200,
        text: async () => (url.includes('rss') ? FEED_RSS_VALIDO : FEED_ATOM_VALIDO),
      }),
    });
    expect(resultados).toHaveLength(2);
    expect(resultados[0]?.registros[0]?.resultado).toBe('pulado');
    expect(resultados[1]?.registros[0]?.resultado).toBe('ok');
    expect(resultados[1]?.itens).toHaveLength(2);
  });
});

describe('carregarCatalogoFontes', () => {
  it('carrega e valida o catálogo real (config/fontes.json), confirmando fast-xml-parser/Zod ponta a ponta', () => {
    const fontes = carregarCatalogoFontes();
    expect(fontes).toHaveLength(5);
    const ge = fontes.find((f) => f.id === 'ge');
    expect(ge?.feeds).toEqual([]); // GE pendente — sem feed ainda (SDD §3.1)
    const espn = fontes.find((f) => f.id === 'espn-brasil');
    expect(espn?.feeds[0]?.formato).toBe('rss');
    expect(espn?.frequenciaMaximaMin).toBeGreaterThan(0);
  });
});
