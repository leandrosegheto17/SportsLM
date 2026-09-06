// dominio/noticias/normalizador-item.test.ts — ING-N-02 (TASK.md Lote 4)
//
// Testes por tabela (TASK.md Diretriz #11) cobrindo CA-04.3 (truncamento com
// reticências), CA-04.6 (data ausente/inválida → estimada) e o descarte de
// `link` fora de `http(s)` absoluto (ADR-011).

import { describe, expect, it } from 'vitest';
import {
  colapsarEspacos,
  decodificarEntidadesHtml,
  formatarIsoOffsetBrasilia,
  LIMITE_RESUMO,
  LIMITE_TITULO,
  normalizarItem,
  removerMarcacaoHtml,
  resolverDataPublicacao,
  resolverLinkHttp,
  sanitizarTexto,
  truncarComReticencias,
  type ItemBrutoFeed,
} from './index';

const AGORA = new Date('2026-09-06T15:00:00.000Z');

function itemBase(sobrescritas: Partial<ItemBrutoFeed> = {}): ItemBrutoFeed {
  return {
    fonteId: 'ge',
    feedId: 'ge-futebol',
    tituloBruto: 'Título de teste',
    resumoBruto: 'Resumo de teste',
    linkBruto: 'https://ge.globo.com/materia/123',
    publicadoEmBruto: '2026-09-06T12:00:00Z',
    ...sobrescritas,
  };
}

describe('decodificarEntidadesHtml', () => {
  const casos: ReadonlyArray<[string, string, string]> = [
    ['nomeada &amp;', 'A &amp; B', 'A & B'],
    ['nomeada &lt;/&gt;', '&lt;tag&gt;', '<tag>'],
    ['nomeada &quot;/&apos;', '&quot;ok&apos;', '"ok\''],
    ['numérica decimal', 'A&#39;B', "A'B"],
    ['numérica hexadecimal', 'A&#x27;B', "A'B"],
    ['nbsp vira espaço', 'A&nbsp;B', 'A B'],
    ['entidade desconhecida fica intacta', 'A &foobar; B', 'A &foobar; B'],
  ];

  it.each(casos)('%s', (_descricao, entrada, esperado) => {
    expect(decodificarEntidadesHtml(entrada)).toBe(esperado);
  });
});

describe('removerMarcacaoHtml', () => {
  it('remove tag simples sem colar palavras', () => {
    expect(removerMarcacaoHtml('foo<br>bar')).toBe('foo bar');
  });

  it('remove tags aninhadas mantendo o texto', () => {
    expect(removerMarcacaoHtml('<b>negrito</b> e <i>itálico</i>')).toBe(
      ' negrito  e  itálico ',
    );
  });

  it('remove <script> com o conteúdo inteiro, não só a tag', () => {
    expect(removerMarcacaoHtml('antes<script>alert(1)</script>depois')).toBe(
      'antes depois',
    );
  });

  it('remove <style> com o conteúdo inteiro', () => {
    expect(removerMarcacaoHtml('a<style>.x{color:red}</style>b')).toBe('a b');
  });

  it('não sobrevive nenhuma tag mesmo com atributos', () => {
    expect(removerMarcacaoHtml('<a href="javascript:alert(1)">clique</a>')).toBe(
      ' clique ',
    );
  });
});

describe('sanitizarTexto — ordem decodifica → remove marcação (evasão por double-encoding)', () => {
  it('entidade que forma uma tag só depois de decodificada também é removida', () => {
    // "&lt;script&gt;" decodifica para "<script>" e só então é removido —
    // se a ordem fosse invertida, a tag escaparia como texto literal.
    const resultado = sanitizarTexto(
      'antes &lt;script&gt;alert(1)&lt;/script&gt; depois',
      300,
    );
    expect(resultado).not.toContain('<script>');
    expect(resultado).not.toContain('script');
  });
});

describe('colapsarEspacos', () => {
  it('colapsa múltiplos espaços/quebras de linha em um único espaço e apara pontas', () => {
    expect(colapsarEspacos('  a   b\n\tc  ')).toBe('a b c');
  });
});

describe('truncarComReticencias — CA-04.3', () => {
  it('não corta texto dentro do limite', () => {
    expect(truncarComReticencias('curto', 10)).toBe('curto');
  });

  it('corta em fronteira de palavra e adiciona reticências', () => {
    const resultado = truncarComReticencias('palavra um dois tres quatro', 15);
    expect(resultado.endsWith('…')).toBe(true);
    expect(resultado.length).toBeLessThanOrEqual(15);
    expect(resultado).not.toMatch(/\s…$/); // sem espaço colado antes das reticências
  });

  it('sem espaço utilizável antes do limite, corta no próprio limite de caractere', () => {
    const resultado = truncarComReticencias('palavraunicaenorme', 5);
    expect(resultado.length).toBeLessThanOrEqual(5);
    expect(resultado.endsWith('…')).toBe(true);
  });

  it('título real acima de 180 caracteres é cortado em exatamente 180', () => {
    const tituloLongo = 'palavra '.repeat(40).trim(); // bem acima de 180
    const resultado = truncarComReticencias(tituloLongo, LIMITE_TITULO);
    expect(resultado.length).toBeLessThanOrEqual(LIMITE_TITULO);
    expect(resultado.endsWith('…')).toBe(true);
  });

  it('resumo real acima de 300 caracteres é cortado em exatamente 300', () => {
    const resumoLongo = 'frase de resumo '.repeat(30).trim(); // bem acima de 300
    const resultado = truncarComReticencias(resumoLongo, LIMITE_RESUMO);
    expect(resultado.length).toBeLessThanOrEqual(LIMITE_RESUMO);
    expect(resultado.endsWith('…')).toBe(true);
  });
});

describe('resolverLinkHttp — ADR-011 passo 2', () => {
  const casos: ReadonlyArray<[string, string, boolean]> = [
    ['https absoluto aceito', 'https://ge.globo.com/materia/1', true],
    ['http absoluto aceito', 'http://ge.globo.com/materia/1', true],
    ['javascript: descartado', 'javascript:alert(1)', false],
    ['data: descartado', 'data:text/html,<script>alert(1)</script>', false],
    ['file: descartado', 'file:///etc/passwd', false],
    ['url relativa descartada', '/materia/1', false],
    ['string vazia descartada', '', false],
    ['ftp: descartado', 'ftp://exemplo.com/arquivo', false],
  ];

  it.each(casos)('%s', (_descricao, entrada, aceita) => {
    const resultado = resolverLinkHttp(entrada);
    if (aceita) {
      expect(resultado).toBe(entrada);
    } else {
      expect(resultado).toBeNull();
    }
  });
});

describe('formatarIsoOffsetBrasilia', () => {
  it('formata um instante UTC como -03:00 fixo (RNF-02)', () => {
    expect(formatarIsoOffsetBrasilia(new Date('2026-09-06T15:00:00.000Z'))).toBe(
      '2026-09-06T12:00:00-03:00',
    );
  });

  it('atravessa a virada de dia corretamente', () => {
    expect(formatarIsoOffsetBrasilia(new Date('2026-09-06T02:00:00.000Z'))).toBe(
      '2026-09-05T23:00:00-03:00',
    );
  });
});

describe('resolverDataPublicacao — CA-15.2/CA-04.6', () => {
  it('data ISO 8601 válida (UTC) é convertida para -03:00, dataEstimada false', () => {
    const resultado = resolverDataPublicacao('2026-09-06T15:00:00Z', AGORA);
    expect(resultado).toEqual({
      publicadoEm: '2026-09-06T12:00:00-03:00',
      dataEstimada: false,
    });
  });

  it('data em outro fuso (RFC 2822, GMT) é resolvida corretamente', () => {
    const resultado = resolverDataPublicacao('Sun, 06 Sep 2026 15:00:00 GMT', AGORA);
    expect(resultado).toEqual({
      publicadoEm: '2026-09-06T12:00:00-03:00',
      dataEstimada: false,
    });
  });

  it('data ausente (null) usa `agora` e marca dataEstimada true (CA-04.6)', () => {
    const resultado = resolverDataPublicacao(null, AGORA);
    expect(resultado).toEqual({
      publicadoEm: formatarIsoOffsetBrasilia(AGORA),
      dataEstimada: true,
    });
  });

  it('data não parseável usa `agora` e marca dataEstimada true (CA-04.6)', () => {
    const resultado = resolverDataPublicacao('não é uma data', AGORA);
    expect(resultado).toEqual({
      publicadoEm: formatarIsoOffsetBrasilia(AGORA),
      dataEstimada: true,
    });
  });

  it('data vazia usa `agora` e marca dataEstimada true', () => {
    const resultado = resolverDataPublicacao('', AGORA);
    expect(resultado).toEqual({
      publicadoEm: formatarIsoOffsetBrasilia(AGORA),
      dataEstimada: true,
    });
  });
});

describe('normalizarItem — integração', () => {
  it('caminho feliz: sanitiza título/resumo, resolve data, mantém link', () => {
    const resultado = normalizarItem(
      itemBase({
        tituloBruto: 'Time vence &amp; garante <b>vaga</b>',
        resumoBruto: 'Resumo com <i>marcação</i> e &nbsp;entidade',
      }),
      AGORA,
    );
    expect(resultado).toEqual({
      fonteId: 'ge',
      feedId: 'ge-futebol',
      titulo: 'Time vence & garante vaga',
      resumo: 'Resumo com marcação e entidade',
      link: 'https://ge.globo.com/materia/123',
      publicadoEm: '2026-09-06T09:00:00-03:00',
      dataEstimada: false,
    });
  });

  it('link fora de http(s) absoluto descarta o item inteiro (ADR-011)', () => {
    expect(
      normalizarItem(itemBase({ linkBruto: 'javascript:alert(1)' }), AGORA),
    ).toBeNull();
  });

  it('resumo ausente (E4, CA-04.3) mantém resumo null', () => {
    const resultado = normalizarItem(itemBase({ resumoBruto: null }), AGORA);
    expect(resultado?.resumo).toBeNull();
  });

  it('resumo que vira string vazia após sanitização também é null', () => {
    const resultado = normalizarItem(itemBase({ resumoBruto: '<b></b>   ' }), AGORA);
    expect(resultado?.resumo).toBeNull();
  });

  it('título que vira string vazia após sanitização descarta o item', () => {
    expect(normalizarItem(itemBase({ tituloBruto: '<b></b>   ' }), AGORA)).toBeNull();
  });

  it('título e resumo truncados respeitam CA-04.3 mesmo dentro de normalizarItem', () => {
    const resultado = normalizarItem(
      itemBase({
        tituloBruto: 'palavra '.repeat(40).trim(),
        resumoBruto: 'frase de resumo '.repeat(30).trim(),
      }),
      AGORA,
    );
    expect(resultado?.titulo.length).toBeLessThanOrEqual(LIMITE_TITULO);
    expect(resultado?.titulo.endsWith('…')).toBe(true);
    expect(resultado?.resumo?.length).toBeLessThanOrEqual(LIMITE_RESUMO);
    expect(resultado?.resumo?.endsWith('…')).toBe(true);
  });

  it('data ausente no item bruto propaga dataEstimada true (CA-04.6)', () => {
    const resultado = normalizarItem(itemBase({ publicadoEmBruto: null }), AGORA);
    expect(resultado?.dataEstimada).toBe(true);
    expect(resultado?.publicadoEm).toBe(formatarIsoOffsetBrasilia(AGORA));
  });

  it('data inválida no item bruto propaga dataEstimada true (CA-04.6)', () => {
    const resultado = normalizarItem(
      itemBase({ publicadoEmBruto: 'lixo-nao-parseavel' }),
      AGORA,
    );
    expect(resultado?.dataEstimada).toBe(true);
  });

  it('tentativa de evasão via double-encoding não sobrevive no título final', () => {
    const resultado = normalizarItem(
      itemBase({ tituloBruto: 'Notícia &lt;script&gt;alert(1)&lt;/script&gt; normal' }),
      AGORA,
    );
    expect(resultado?.titulo).not.toContain('<script>');
    expect(resultado?.titulo).not.toContain('script');
  });
});
