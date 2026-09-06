import { describe, expect, it } from 'vitest';
import {
  CHAVE_ARMAZENAMENTO_TEMA,
  aplicarTemaNoDocumento,
  calcularTemaEfetivo,
  lerPreferenciaSalva,
  salvarPreferencia,
  type PreferenciaDeTema,
} from './tema';

/** `Storage` falso mínimo, sem depender de jsdom (módulo é puro/testável em Node). */
function criarArmazenamentoFalso(inicial: Record<string, string> = {}): Storage {
  const dados = new Map<string, string>(Object.entries(inicial));

  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => {
      dados.set(chave, valor);
    },
    removeItem: (chave: string) => {
      dados.delete(chave);
    },
    clear: () => dados.clear(),
    key: (indice: number) => Array.from(dados.keys())[indice] ?? null,
    get length() {
      return dados.size;
    },
  };
}

describe('calcularTemaEfetivo (UX-SPEC §3.3)', () => {
  it.each<[PreferenciaDeTema, boolean, 'claro' | 'escuro']>([
    ['claro', true, 'claro'],
    ['claro', false, 'claro'],
    ['escuro', true, 'escuro'],
    ['escuro', false, 'escuro'],
    ['sistema', true, 'escuro'],
    ['sistema', false, 'claro'],
  ])(
    'preferência=%s, sistema prefere escuro=%s → %s',
    (preferencia, sistema, esperado) => {
      expect(calcularTemaEfetivo(preferencia, sistema)).toBe(esperado);
    },
  );
});

describe('lerPreferenciaSalva', () => {
  it('retorna "sistema" quando não há nada salvo', () => {
    expect(lerPreferenciaSalva(criarArmazenamentoFalso())).toBe('sistema');
  });

  it('retorna a preferência salva quando o esquema é válido', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_TEMA]: JSON.stringify({
        versaoEsquema: 1,
        preferencia: 'escuro',
      }),
    });

    expect(lerPreferenciaSalva(armazenamento)).toBe('escuro');
  });

  it('descarta e retorna "sistema" quando o JSON é inválido', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_TEMA]: '{não é json',
    });
    expect(lerPreferenciaSalva(armazenamento)).toBe('sistema');
  });

  it('descarta e retorna "sistema" quando o esquema não bate (versão diferente)', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_TEMA]: JSON.stringify({
        versaoEsquema: 2,
        preferencia: 'escuro',
      }),
    });
    expect(lerPreferenciaSalva(armazenamento)).toBe('sistema');
  });

  it('descarta e retorna "sistema" quando a preferência não é um valor válido', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_TEMA]: JSON.stringify({
        versaoEsquema: 1,
        preferencia: 'roxo',
      }),
    });
    expect(lerPreferenciaSalva(armazenamento)).toBe('sistema');
  });

  it('retorna "sistema" (nunca lança) quando o armazenamento está indisponível', () => {
    const armazenamentoQuebrado: Pick<Storage, 'getItem'> = {
      getItem: () => {
        throw new Error('localStorage indisponível');
      },
    };

    expect(lerPreferenciaSalva(armazenamentoQuebrado)).toBe('sistema');
  });
});

describe('salvarPreferencia', () => {
  it('grava a preferência com o esquema versionado', () => {
    const armazenamento = criarArmazenamentoFalso();
    salvarPreferencia('escuro', armazenamento);

    expect(JSON.parse(armazenamento.getItem(CHAVE_ARMAZENAMENTO_TEMA) as string)).toEqual(
      {
        versaoEsquema: 1,
        preferencia: 'escuro',
      },
    );
  });

  it('nunca lança quando o armazenamento está indisponível', () => {
    const armazenamentoQuebrado: Pick<Storage, 'setItem'> = {
      setItem: () => {
        throw new Error('quota excedida');
      },
    };

    expect(() => salvarPreferencia('claro', armazenamentoQuebrado)).not.toThrow();
  });
});

describe('aplicarTemaNoDocumento', () => {
  it('escreve o tema efetivo no atributo data-tema de <html>', () => {
    const dataset: DOMStringMap = {};
    const documentoFalso: Pick<Document, 'documentElement'> = {
      documentElement: { dataset } as unknown as HTMLElement,
    };

    aplicarTemaNoDocumento('escuro', documentoFalso);

    expect(dataset['tema']).toBe('escuro');
  });
});
