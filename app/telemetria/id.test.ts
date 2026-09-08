// app/telemetria/id.test.ts — TEL-01 (TASK.md Lote 12)

import { describe, expect, it } from 'vitest';
import { CHAVE_ARMAZENAMENTO_ANONIMO } from '../armazenamento/telemetriaId';
import { gerarIdAnonimo, obterOuCriarIdAnonimo } from './id';

const REGEX_UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

describe('gerarIdAnonimo', () => {
  it('gera um UUID v4 válido', () => {
    expect(gerarIdAnonimo()).toMatch(REGEX_UUID_V4);
  });

  it('gera valores diferentes a cada chamada', () => {
    const a = gerarIdAnonimo();
    const b = gerarIdAnonimo();
    expect(a).not.toBe(b);
  });
});

describe('obterOuCriarIdAnonimo (ADR-012 regra 2)', () => {
  it('cria e persiste um novo id na chave já convencionada quando nada existe', () => {
    const armazenamento = criarArmazenamentoFalso();

    const id = obterOuCriarIdAnonimo(armazenamento);

    expect(id).toMatch(REGEX_UUID_V4);
    expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_ANONIMO)).toBe(id);
  });

  it('reutiliza o id já salvo, sem gerar um novo', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_ANONIMO]: 'id-fake-existente',
    });

    expect(obterOuCriarIdAnonimo(armazenamento)).toBe('id-fake-existente');
    expect(obterOuCriarIdAnonimo(armazenamento)).toBe('id-fake-existente');
  });

  it('depois de apagado (botão "Trocar identificador anônimo"), a próxima chamada reinicia com um novo id', () => {
    const armazenamento = criarArmazenamentoFalso({
      [CHAVE_ARMAZENAMENTO_ANONIMO]: 'id-antigo',
    });

    armazenamento.removeItem(CHAVE_ARMAZENAMENTO_ANONIMO);
    const novoId = obterOuCriarIdAnonimo(armazenamento);

    expect(novoId).not.toBe('id-antigo');
    expect(novoId).toMatch(REGEX_UUID_V4);
  });

  it('não lança e degrada para modo memória quando o armazenamento está indisponível', () => {
    expect(() => obterOuCriarIdAnonimo(undefined)).not.toThrow();
    expect(obterOuCriarIdAnonimo(undefined)).toMatch(REGEX_UUID_V4);
  });
});
