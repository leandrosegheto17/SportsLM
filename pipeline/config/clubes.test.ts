import { describe, expect, it } from 'vitest';
import {
  carregarClubesSerieA2026,
  ID_PROVEDOR_THESPORTSDB,
  SENTINELA_ID_PENDENTE,
} from './clubes';

describe('COB-03: idsProvedor.thesportsdb dos 20 clubes', () => {
  const clubes = carregarClubesSerieA2026();
  const ids = clubes.map((c) => c.idsProvedor[ID_PROVEDOR_THESPORTSDB]);

  it('20/20 clubes com id numerico, sem sentinela', () => {
    expect(clubes).toHaveLength(20);
    for (const id of ids) {
      expect(id).toBeDefined();
      expect(id).not.toBe(SENTINELA_ID_PENDENTE);
      expect(String(id)).toMatch(/^\d+$/);
    }
  });

  it('ids unicos', () => {
    expect(new Set(ids).size).toBe(20);
  });

  it('ids do SPK-07 para os 11 clubes novos', () => {
    const esperado: Record<string, string> = {
      'atletico-mg': '134299',
      cruzeiro: '134294',
      bahia: '134293',
      internacional: '134281',
      gremio: '134288',
      vitoria: '134280',
      'athletico-pr': '134297',
      coritiba: '134298',
      'rb-bragantino': '134736',
      remo: '137818',
      chapecoense: '134464',
    };
    for (const [id, tsdb] of Object.entries(esperado)) {
      expect(clubes.find((c) => c.id === id)?.idsProvedor[ID_PROVEDOR_THESPORTSDB]).toBe(
        tsdb,
      );
    }
  });
});
