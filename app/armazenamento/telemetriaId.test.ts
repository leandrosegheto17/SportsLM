// app/armazenamento/telemetriaId.test.ts — apoio a UI-T03-02 (TASK.md Lote 9)

import { describe, expect, it } from 'vitest';
import { apagarIdentificadorAnonimo, CHAVE_ARMAZENAMENTO_ANONIMO } from './telemetriaId';

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

describe('telemetriaId (ADR-012 regra 2, apoio a UI-T03-02)', () => {
  it('usa a chave já convencionada por ADR-012', () => {
    expect(CHAVE_ARMAZENAMENTO_ANONIMO).toBe('sportslm.anonimo.v1');
  });

  it('remove o identificador quando ele já existe (ex.: quando TEL-01 existir)', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_ANONIMO]: 'uuid-fake',
    });

    apagarIdentificadorAnonimo(armazenamento);

    expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_ANONIMO)).toBeNull();
  });

  it('não lança quando a chave nunca existiu (estado atual, antes de TEL-01)', () => {
    const armazenamento = criarArmazenamentoFalso();
    expect(() => {
      apagarIdentificadorAnonimo(armazenamento);
    }).not.toThrow();
  });

  it('não lança quando o armazenamento está indisponível (modo memória)', () => {
    expect(() => {
      apagarIdentificadorAnonimo(undefined);
    }).not.toThrow();
  });
});
