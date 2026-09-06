import { describe, expect, it, vi } from 'vitest';
import type { Cenario } from '../../dominio/tipos';
import {
  CHAVE_ARMAZENAMENTO_CENARIO,
  construirEscopoCenario,
  criarSalvadorDeCenarioComDebounce,
  lerCenario,
  limparCenario,
  salvarCenario,
} from './cenario';

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

const ESCOPO = construirEscopoCenario(2026, 'flamengo', ['palmeiras', 'corinthians']);

function cenarioDeExemplo(escopo: string): Cenario {
  return {
    versaoEsquema: 1,
    escopo,
    palpites: { 'partida-1': 'vitoria', 'partida-2': 'empate' },
    partidasTravadasVistas: ['partida-0'],
  };
}

describe('construirEscopoCenario', () => {
  it('ordena os rivais para o escopo ser estável independente da ordem de escolha', () => {
    const a = construirEscopoCenario(2026, 'flamengo', ['corinthians', 'palmeiras']);
    const b = construirEscopoCenario(2026, 'flamengo', ['palmeiras', 'corinthians']);
    expect(a).toBe(b);
  });

  it('produz escopos diferentes para times diferentes', () => {
    const a = construirEscopoCenario(2026, 'flamengo', []);
    const b = construirEscopoCenario(2026, 'palmeiras', []);
    expect(a).not.toBe(b);
  });
});

describe('lerCenario', () => {
  it('retorna null quando nada foi salvo', () => {
    const resultado = lerCenario(ESCOPO, criarArmazenamentoFalso());
    expect(resultado.cenario).toBeNull();
    expect(resultado.modoMemoria).toBe(false);
  });

  it('restaura o cenário salvo quando o escopo bate (CA-11.9)', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_CENARIO]: JSON.stringify(cenarioDeExemplo(ESCOPO)),
    });

    const resultado = lerCenario(ESCOPO, armazenamento);
    expect(resultado.cenario).toEqual(cenarioDeExemplo(ESCOPO));
  });

  it('descarta o cenário inteiro quando o escopo salvo não bate (time/rivais trocaram)', () => {
    const escopoAntigo = construirEscopoCenario(2025, 'flamengo', ['palmeiras']);
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_CENARIO]: JSON.stringify(cenarioDeExemplo(escopoAntigo)),
    });

    const resultado = lerCenario(ESCOPO, armazenamento);
    expect(resultado.cenario).toBeNull();
  });

  it('sinaliza modo memória e não lança quando o localStorage está indisponível (CA-11.9)', () => {
    const quebrado: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem: () => {
        throw new Error('indisponível');
      },
      setItem: () => {
        throw new Error('indisponível');
      },
      removeItem: () => {},
    };

    const resultado = lerCenario(ESCOPO, quebrado);
    expect(resultado.modoMemoria).toBe(true);
    expect(resultado.cenario).toBeNull();
  });

  it('descarta e não lança quando o JSON salvo é inválido', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_CENARIO]: '{não é json',
    });
    expect(() => lerCenario(ESCOPO, armazenamento)).not.toThrow();
    expect(lerCenario(ESCOPO, armazenamento).cenario).toBeNull();
  });

  it('descarta quando o esquema não bate (versão incompatível)', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_CENARIO]: JSON.stringify({
        ...cenarioDeExemplo(ESCOPO),
        versaoEsquema: 2,
      }),
    });
    expect(lerCenario(ESCOPO, armazenamento).cenario).toBeNull();
  });
});

describe('salvarCenario / limparCenario', () => {
  it('persiste imediatamente', () => {
    const armazenamento = criarArmazenamentoFalso();
    const ok = salvarCenario(cenarioDeExemplo(ESCOPO), armazenamento);
    expect(ok).toBe(true);
    expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_CENARIO)).not.toBeNull();
  });

  it('nunca lança e retorna false quando indisponível', () => {
    const quebrado: Pick<Storage, 'setItem'> = {
      setItem: () => {
        throw new Error('quota excedida');
      },
    };
    expect(() => salvarCenario(cenarioDeExemplo(ESCOPO), quebrado)).not.toThrow();
    expect(salvarCenario(cenarioDeExemplo(ESCOPO), quebrado)).toBe(false);
  });

  it('limparCenario remove a chave (troca de time/rival, CA-06.3/CA-09.4)', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_CENARIO]: JSON.stringify(cenarioDeExemplo(ESCOPO)),
    });
    limparCenario(armazenamento);
    expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_CENARIO)).toBeNull();
  });

  it('limparCenario nunca lança quando indisponível', () => {
    const quebrado: Pick<Storage, 'removeItem'> = {
      removeItem: () => {
        throw new Error('indisponível');
      },
    };
    expect(() => limparCenario(quebrado)).not.toThrow();
  });
});

describe('criarSalvadorDeCenarioComDebounce (ADR-005 regra 1)', () => {
  it('adia a escrita em 250ms e só grava o último cenário', () => {
    vi.useFakeTimers();
    try {
      const armazenamento = criarArmazenamentoFalso();
      const salvar = criarSalvadorDeCenarioComDebounce(armazenamento, 250);

      salvar(cenarioDeExemplo(ESCOPO));
      salvar({ ...cenarioDeExemplo(ESCOPO), palpites: { 'partida-1': 'derrota' } });

      expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_CENARIO)).toBeNull();

      vi.advanceTimersByTime(250);

      const persistido = JSON.parse(
        armazenamento.getItem(CHAVE_ARMAZENAMENTO_CENARIO) as string,
      ) as Cenario;
      expect(persistido.palpites['partida-1']).toBe('derrota');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Cenario — CA-13.5 (nenhum dado pessoal)', () => {
  it('o schema só guarda escopo/palpites/partidas travadas, nenhum dado do torcedor', () => {
    const cenario = cenarioDeExemplo(ESCOPO);
    expect(Object.keys(cenario).sort()).toEqual(
      ['versaoEsquema', 'escopo', 'palpites', 'partidasTravadasVistas'].sort(),
    );
    expect(JSON.stringify(cenario)).not.toMatch(
      /email|e-mail|cpf|telefone|endereco|ip\b/i,
    );
  });
});
