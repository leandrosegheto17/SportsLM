import { describe, expect, it, vi } from 'vitest';
import {
  armazenamentoEstaDisponivel,
  criarEscritaComDebounce,
  escreverBrutoSemLancar,
  lerBrutoSemLancar,
  removerBrutoSemLancar,
} from './nucleo';

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

describe('armazenamentoEstaDisponivel', () => {
  it('retorna true para um Storage funcional', () => {
    expect(armazenamentoEstaDisponivel(criarArmazenamentoFalso())).toBe(true);
  });

  it('retorna false quando setItem lança (quota excedida/modo privado)', () => {
    const quebrado: Pick<Storage, 'setItem' | 'removeItem'> = {
      setItem: () => {
        throw new Error('quota excedida');
      },
      removeItem: () => {},
    };
    expect(armazenamentoEstaDisponivel(quebrado)).toBe(false);
  });

  it('retorna false quando o armazenamento é undefined', () => {
    expect(armazenamentoEstaDisponivel(undefined)).toBe(false);
  });

  it('não deixa resíduo da chave de teste em um Storage funcional', () => {
    const armazenamento = criarArmazenamentoFalso();
    armazenamentoEstaDisponivel(armazenamento);
    expect(armazenamento.length).toBe(0);
  });
});

describe('lerBrutoSemLancar / escreverBrutoSemLancar / removerBrutoSemLancar', () => {
  it('escreve e lê de volta', () => {
    const armazenamento = criarArmazenamentoFalso();
    expect(escreverBrutoSemLancar('chave', 'valor', armazenamento)).toBe(true);
    expect(lerBrutoSemLancar('chave', armazenamento)).toBe('valor');
  });

  it('lerBrutoSemLancar retorna null quando indisponível, sem lançar', () => {
    const quebrado: Pick<Storage, 'getItem'> = {
      getItem: () => {
        throw new Error('indisponível');
      },
    };
    expect(lerBrutoSemLancar('chave', quebrado)).toBeNull();
  });

  it('lerBrutoSemLancar retorna null quando armazenamento é undefined', () => {
    expect(lerBrutoSemLancar('chave', undefined)).toBeNull();
  });

  it('escreverBrutoSemLancar retorna false e nunca lança quando indisponível', () => {
    const quebrado: Pick<Storage, 'setItem'> = {
      setItem: () => {
        throw new Error('quota excedida');
      },
    };
    expect(() => escreverBrutoSemLancar('chave', 'valor', quebrado)).not.toThrow();
    expect(escreverBrutoSemLancar('chave', 'valor', quebrado)).toBe(false);
  });

  it('escreverBrutoSemLancar retorna false quando armazenamento é undefined', () => {
    expect(escreverBrutoSemLancar('chave', 'valor', undefined)).toBe(false);
  });

  it('removerBrutoSemLancar nunca lança quando indisponível', () => {
    const quebrado: Pick<Storage, 'removeItem'> = {
      removeItem: () => {
        throw new Error('indisponível');
      },
    };
    expect(() => removerBrutoSemLancar('chave', quebrado)).not.toThrow();
  });

  it('removerBrutoSemLancar remove a chave de um Storage funcional', () => {
    const armazenamento = criarArmazenamentoFalso({ chave: 'valor' });
    removerBrutoSemLancar('chave', armazenamento);
    expect(armazenamento.getItem('chave')).toBeNull();
  });
});

describe('criarEscritaComDebounce', () => {
  it('só escreve uma vez após o atraso, com o último valor (ADR-005 regra 1)', () => {
    vi.useFakeTimers();
    try {
      const escrever = vi.fn(() => true);
      const escreverComDebounce = criarEscritaComDebounce(escrever, 250);

      escreverComDebounce('v1');
      escreverComDebounce('v2');
      escreverComDebounce('v3');

      expect(escrever).not.toHaveBeenCalled();

      vi.advanceTimersByTime(250);

      expect(escrever).toHaveBeenCalledTimes(1);
      expect(escrever).toHaveBeenCalledWith('v3');
    } finally {
      vi.useRealTimers();
    }
  });
});
