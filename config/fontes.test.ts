// config/fontes.test.ts — CFG-05
//
// Valida `config/fontes.json` contra o schema Zod de `Fonte` (SDD §5.1/ADR-007)
// e confere os critérios de aceite explícitos da tarefa: exatamente 7 fontes
// (ampliado de 5 por decisão direta do stakeholder, 2026-09-08 — ver
// `.md/BLOCKERS.md` Bloqueio 011), GE com `fixa: true`, UOL com
// `verificacao.estado: 'pendente'` (SDD §3.1).

import { describe, expect, it } from 'vitest';
import fontesJson from './fontes.json';
import { catalogoFontesSchema, fonteSchema } from './fontes.schema';

describe('config/fontes.json', () => {
  it('valida contra o schema Zod do catálogo (RN-19: exatamente 7 fontes)', () => {
    const resultado = catalogoFontesSchema.safeParse(fontesJson);
    expect(resultado.success).toBe(true);
  });

  it('tem exatamente 7 fontes', () => {
    expect(fontesJson).toHaveLength(7);
  });

  it('cada fonte individualmente valida contra o schema de Fonte', () => {
    for (const fonte of fontesJson) {
      const resultado = fonteSchema.safeParse(fonte);
      expect(resultado.success).toBe(true);
    }
  });

  it('todos os ids de fonte são únicos', () => {
    const ids = fontesJson.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('o GE é a única fonte fixa (RN-03)', () => {
    const fixas = fontesJson.filter((f) => f.fixa);
    expect(fixas).toHaveLength(1);
    expect(fixas[0]?.id).toBe('ge');
    expect(fixas[0]?.nome).toContain('GE');
  });

  it('o GE tem fixa: true', () => {
    const ge = fontesJson.find((f) => f.id === 'ge');
    expect(ge?.fixa).toBe(true);
  });

  it('a UOL tem verificacao.estado igual a "pendente" (SDD §3.1)', () => {
    const uol = fontesJson.find((f) => f.id === 'uol-esporte');
    expect(uol).toBeDefined();
    expect(uol?.verificacao.estado).toBe('pendente');
  });

  it('nenhuma fonte tem mais de 8 feeds (teto do ADR-007)', () => {
    for (const fonte of fontesJson) {
      expect(fonte.feeds.length).toBeLessThanOrEqual(8);
    }
  });

  it('toda URL de feed é http(s) absoluta (ADR-011)', () => {
    for (const fonte of fontesJson) {
      for (const feed of fonte.feeds) {
        expect(feed.url).toMatch(/^https:\/\//);
      }
    }
  });

  it('fontes verificadas (ESPN, Gazeta, Terra) têm verificacao.estado "verificada"', () => {
    const idsVerificadas = ['espn-brasil', 'gazeta-esportiva', 'terra-esportes'];
    for (const id of idsVerificadas) {
      const fonte = fontesJson.find((f) => f.id === id);
      expect(fonte).toBeDefined();
      expect(fonte?.verificacao.estado).toBe('verificada');
    }
  });

  it('nenhuma fonte fica sem feeds exceto o GE (estado pendente, P-GE, ADR-013)', () => {
    for (const fonte of fontesJson) {
      if (fonte.id === 'ge') {
        expect(fonte.feeds).toHaveLength(0);
      } else {
        expect(fonte.feeds.length).toBeGreaterThan(0);
      }
    }
  });
});
