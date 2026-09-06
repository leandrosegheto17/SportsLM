import { describe, expect, it } from 'vitest';
import type { Preferencias } from '../../dominio/tipos';
import {
  CHAVE_ARMAZENAMENTO_PREFERENCIAS,
  type ReferenciasValidas,
  lerPreferencias,
  salvarPreferencias,
} from './preferencias';

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

const REFERENCIAS_PADRAO: ReferenciasValidas = {
  esportesValidos: new Set(['futebol', 'basquete', 'tenis']),
  fontesValidas: new Set(['ge', 'espn-brasil', 'terra-esportes']),
  clubesValidos: new Set(['flamengo', 'palmeiras', 'corinthians']),
};

const AGORA = new Date('2026-09-05T12:00:00.000Z');

function preferenciasValidasDeExemplo(): Preferencias {
  return {
    versaoEsquema: 1,
    temporada: 2026,
    favoritos: ['futebol', 'basquete'],
    fontesBloqueadas: ['espn-brasil'],
    timeId: 'flamengo',
    rivais: ['palmeiras'],
    atualizadoEm: '2026-09-01T00:00:00.000Z',
  };
}

describe('lerPreferencias — CA-13.2 (restaura preferências salvas válidas)', () => {
  it('restaura tudo quando as preferências salvas são inteiramente válidas', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_PREFERENCIAS]: JSON.stringify(preferenciasValidasDeExemplo()),
    });

    const resultado = lerPreferencias(REFERENCIAS_PADRAO, 2026, armazenamento, AGORA);

    expect(resultado.preferencias).toEqual(preferenciasValidasDeExemplo());
    expect(resultado.descartes).toEqual([]);
    expect(resultado.timeForaDaTemporada).toBe(false);
    expect(resultado.modoMemoria).toBe(false);
  });
});

describe('lerPreferencias — CA-13.3 (armazenamento limpo/indisponível)', () => {
  it('retorna preferências padrão vazias quando nada foi salvo', () => {
    const armazenamento = criarArmazenamentoFalso();
    const resultado = lerPreferencias(REFERENCIAS_PADRAO, 2026, armazenamento, AGORA);

    expect(resultado.preferencias).toEqual({
      versaoEsquema: 1,
      temporada: 2026,
      favoritos: [],
      fontesBloqueadas: [],
      timeId: null,
      rivais: [],
      atualizadoEm: AGORA.toISOString(),
    });
    expect(resultado.modoMemoria).toBe(false);
  });

  it('retorna padrão vazio e sinaliza modo memória quando o localStorage está indisponível', () => {
    const quebrado: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem: () => {
        throw new Error('indisponível');
      },
      setItem: () => {
        throw new Error('indisponível');
      },
      removeItem: () => {},
    };

    const resultado = lerPreferencias(REFERENCIAS_PADRAO, 2026, quebrado, AGORA);

    expect(resultado.modoMemoria).toBe(true);
    expect(resultado.preferencias.favoritos).toEqual([]);
    expect(resultado.descartes).toEqual([]);
  });

  it('descarta o objeto inteiro e não lança quando o JSON salvo é inválido', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_PREFERENCIAS]: '{não é json',
    });

    const resultado = lerPreferencias(REFERENCIAS_PADRAO, 2026, armazenamento, AGORA);
    expect(resultado.preferencias.favoritos).toEqual([]);
    expect(resultado.preferencias.timeId).toBeNull();
  });

  it('descarta o objeto inteiro quando a versão do esquema é incompatível', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_PREFERENCIAS]: JSON.stringify({
        ...preferenciasValidasDeExemplo(),
        versaoEsquema: 2,
      }),
    });

    const resultado = lerPreferencias(REFERENCIAS_PADRAO, 2026, armazenamento, AGORA);
    expect(resultado.preferencias.timeId).toBeNull();
    expect(resultado.descartes).toEqual([]);
  });
});

describe('lerPreferencias — CA-13.4 (referência inválida descartada individualmente)', () => {
  it('esporte com formato inválido (fora do enum de EsporteId) derruba o objeto por esquema, não por CA-13.4', () => {
    const salvas = {
      ...preferenciasValidasDeExemplo(),
      favoritos: ['futebol', 'handebol', 'basquete'],
    };
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_PREFERENCIAS]: JSON.stringify(salvas),
    });

    // "handebol" não é um `EsporteId` válido (fora dos 15 do recorte) — isso
    // é incompatibilidade de esquema (tratada como CA-13.3), não uma
    // referência que "deixou de existir na configuração corrente" (CA-13.4).
    const resultado = lerPreferencias(REFERENCIAS_PADRAO, 2026, armazenamento, AGORA);

    expect(resultado.preferencias).toEqual({
      versaoEsquema: 1,
      temporada: 2026,
      favoritos: [],
      fontesBloqueadas: [],
      timeId: null,
      rivais: [],
      atualizadoEm: AGORA.toISOString(),
    });
  });

  it('mantém favoritos válidos e descarta individualmente o que saiu do catálogo corrente', () => {
    const salvas: Preferencias = {
      ...preferenciasValidasDeExemplo(),
      favoritos: ['futebol', 'basquete'],
      fontesBloqueadas: ['espn-brasil', 'terra-esportes'],
      rivais: ['palmeiras', 'corinthians'],
    };
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_PREFERENCIAS]: JSON.stringify(salvas),
    });

    // "basquete" e "terra-esportes" e "corinthians" saíram da configuração
    // corrente; "futebol"/"espn-brasil"/"flamengo"/"palmeiras" continuam.
    const referencias: ReferenciasValidas = {
      esportesValidos: new Set(['futebol']),
      fontesValidas: new Set(['espn-brasil']),
      clubesValidos: new Set(['flamengo', 'palmeiras']),
    };

    const resultado = lerPreferencias(referencias, 2026, armazenamento, AGORA);

    expect(resultado.preferencias.favoritos).toEqual(['futebol']);
    expect(resultado.preferencias.fontesBloqueadas).toEqual(['espn-brasil']);
    expect(resultado.preferencias.timeId).toBe('flamengo');
    expect(resultado.preferencias.rivais).toEqual(['palmeiras']);
    expect(resultado.timeForaDaTemporada).toBe(false);
    expect(resultado.descartes).toHaveLength(3);
    expect(resultado.descartes.join(' ')).toContain('basquete');
    expect(resultado.descartes.join(' ')).toContain('terra-esportes');
    expect(resultado.descartes.join(' ')).toContain('corinthians');
  });

  it('descarta timeId e rivais juntos (RN-12/CA-06.5) quando o time saiu da temporada, sinalizando timeForaDaTemporada', () => {
    const salvas: Preferencias = {
      ...preferenciasValidasDeExemplo(),
      timeId: 'flamengo',
      rivais: ['palmeiras'],
    };
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_PREFERENCIAS]: JSON.stringify(salvas),
    });

    const referencias: ReferenciasValidas = {
      ...REFERENCIAS_PADRAO,
      clubesValidos: new Set(['palmeiras', 'corinthians']), // "flamengo" saiu
    };

    const resultado = lerPreferencias(referencias, 2026, armazenamento, AGORA);

    expect(resultado.timeForaDaTemporada).toBe(true);
    expect(resultado.preferencias.timeId).toBeNull();
    expect(resultado.preferencias.rivais).toEqual([]);
    expect(resultado.descartes.some((m) => m.includes('flamengo'))).toBe(true);
  });

  it('não descarta nada quando todas as referências continuam válidas', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_PREFERENCIAS]: JSON.stringify(preferenciasValidasDeExemplo()),
    });

    const resultado = lerPreferencias(REFERENCIAS_PADRAO, 2026, armazenamento, AGORA);
    expect(resultado.descartes).toEqual([]);
  });
});

describe('lerPreferencias — CA-13.5 (nenhum dado pessoal)', () => {
  it('o schema de Preferencias não tem nenhum campo de dado pessoal (nome/e-mail/IP)', () => {
    const camposPermitidos = [
      'versaoEsquema',
      'temporada',
      'favoritos',
      'fontesBloqueadas',
      'timeId',
      'rivais',
      'atualizadoEm',
    ];
    const salvas = preferenciasValidasDeExemplo();

    expect(Object.keys(salvas).sort()).toEqual([...camposPermitidos].sort());
  });

  it('salvarPreferencias grava exatamente os campos de Preferencias, nada além', () => {
    const armazenamento = criarArmazenamentoFalso();
    const preferencias = preferenciasValidasDeExemplo();

    salvarPreferencias(preferencias, armazenamento);

    const persistido = JSON.parse(
      armazenamento.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS) as string,
    );
    expect(Object.keys(persistido).sort()).toEqual(Object.keys(preferencias).sort());
    expect(JSON.stringify(persistido)).not.toMatch(
      /email|e-mail|cpf|telefone|endereco|ip\b/i,
    );
  });
});

describe('salvarPreferencias', () => {
  it('persiste imediatamente (CA-13.1)', () => {
    const armazenamento = criarArmazenamentoFalso();
    const ok = salvarPreferencias(preferenciasValidasDeExemplo(), armazenamento);

    expect(ok).toBe(true);
    expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS)).not.toBeNull();
  });

  it('nunca lança e retorna false quando o armazenamento está indisponível', () => {
    const quebrado: Pick<Storage, 'setItem'> = {
      setItem: () => {
        throw new Error('quota excedida');
      },
    };

    expect(() =>
      salvarPreferencias(preferenciasValidasDeExemplo(), quebrado),
    ).not.toThrow();
    expect(salvarPreferencias(preferenciasValidasDeExemplo(), quebrado)).toBe(false);
  });
});
