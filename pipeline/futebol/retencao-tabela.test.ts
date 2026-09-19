import { describe, expect, it } from 'vitest';

import type { LinhaClassificacao } from '../../dominio/tipos/futebol';

import { resolverTabelaPublicada } from './retencao-tabela';

const l = (n: number) => ({ clubeId: `c${n}` }) as unknown as LinhaClassificacao;

describe('resolverTabelaPublicada (ADR-020 item 4)', () => {
  const ant = [l(1), l(2)];
  const nov = [l(3)];

  it('misto: novas vazias e anteriores cheias retém as anteriores', () => {
    expect(resolverTabelaPublicada('misto', [], ant)).toEqual(ant);
  });
  it('misto: novas cheias usa as novas', () => {
    expect(resolverTabelaPublicada('misto', nov, ant)).toEqual(nov);
  });
  it('misto: ambas vazias devolve vazio', () => {
    expect(resolverTabelaPublicada('misto', [], [])).toEqual([]);
  });
  it('grupos com novas vazias não retém', () => {
    expect(resolverTabelaPublicada('grupos', [], ant)).toEqual([]);
  });
  it('pontos-corridos usa as novas', () => {
    expect(resolverTabelaPublicada('pontos-corridos', nov, ant)).toEqual(nov);
  });
  it('mata-mata devolve vazio', () => {
    expect(resolverTabelaPublicada('mata-mata', [], ant)).toEqual([]);
  });
  it('nunca muta a entrada', () => {
    const a = Object.freeze([...ant]);
    const n = Object.freeze([] as LinhaClassificacao[]);
    const r = resolverTabelaPublicada('misto', n, a);
    expect(r).not.toBe(a);
    expect(a).toEqual(ant);
  });
});
