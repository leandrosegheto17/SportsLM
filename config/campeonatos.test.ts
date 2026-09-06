// config/campeonatos.test.ts — CFG-03
//
// Prova o critério de aceite de CFG-03 (`.md/TASK.md`, Lote 2): o arquivo
// `config/campeonatos-2026.json` valida contra o schema Zod de
// `config/campeonatos.schema.ts`, todo clube que aparece em algum campeonato da
// temporada aparece em ao menos o Brasileirão (RN-05), e todo campeonato sem
// cobertura confirmada tem `provedor: null` (CA-07.2). Leitura de arquivo (I/O)
// fica aqui, fora de `dominio/` — o schema em `config/campeonatos.schema.ts` é
// puro (mesmo padrão de CFG-01/CFG-05).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConfigCampeonatosSchema } from './campeonatos.schema';

const caminhoArquivo = fileURLToPath(new URL('./campeonatos-2026.json', import.meta.url));
const caminhoClubes = fileURLToPath(new URL('./clubes-2026.json', import.meta.url));

function lerCampeonatosJson(): unknown {
  return JSON.parse(readFileSync(caminhoArquivo, 'utf-8'));
}

function lerClubeIdsDeCfg02(): string[] {
  const clubes = JSON.parse(readFileSync(caminhoClubes, 'utf-8')) as Array<{
    id: string;
  }>;
  return clubes.map((clube) => clube.id);
}

const configCampeonatos = lerCampeonatosJson();

describe('config/campeonatos-2026.json (CFG-03, RN-05)', () => {
  it('valida contra o schema Zod de ConfigCampeonatos', () => {
    const resultado = ConfigCampeonatosSchema.safeParse(configCampeonatos);
    if (!resultado.success) {
      throw new Error(JSON.stringify(resultado.error.format(), null, 2));
    }
    expect(resultado.success).toBe(true);
  });

  it('tem exatamente um campeonato de categoria "brasileirao"', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const brasileiroes = config.campeonatos.filter((c) => c.categoria === 'brasileirao');
    expect(brasileiroes).toHaveLength(1);
  });

  it('todo clube que participa de algum campeonato da temporada aparece no Brasileirão', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const brasileirao = config.campeonatos.find((c) => c.categoria === 'brasileirao');
    expect(brasileirao).toBeDefined();
    const clubesNoBrasileirao = new Set(brasileirao!.clubes);

    const universoDeClubes = new Set<string>();
    for (const campeonato of config.campeonatos) {
      for (const clubeId of campeonato.clubes) universoDeClubes.add(clubeId);
    }

    // Sanidade: o universo de clubes referenciado no arquivo é não vazio e
    // corresponde aos 20 clubes da Série A 2026 (RN-04) — mesmo cardinal do
    // Brasileirão.
    expect(universoDeClubes.size).toBe(20);
    expect(clubesNoBrasileirao.size).toBe(20);

    for (const clubeId of universoDeClubes) {
      expect(clubesNoBrasileirao.has(clubeId)).toBe(true);
    }
  });

  it('todo clube de CFG-02 (config/clubes-2026.json) aparece no Brasileirão', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const brasileirao = config.campeonatos.find((c) => c.categoria === 'brasileirao')!;
    const clubesNoBrasileirao = new Set(brasileirao.clubes);
    const clubeIdsDeCfg02 = lerClubeIdsDeCfg02();

    expect(clubeIdsDeCfg02).toHaveLength(20);
    for (const clubeId of clubeIdsDeCfg02) {
      expect(clubesNoBrasileirao.has(clubeId)).toBe(true);
    }
    // E vice-versa: nenhum clube "fantasma" no Brasileirão que não exista em CFG-02.
    expect([...clubesNoBrasileirao].sort()).toEqual([...clubeIdsDeCfg02].sort());
  });

  it('o Brasileirão tem exatamente 20 clubes, sem duplicatas', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const brasileirao = config.campeonatos.find((c) => c.categoria === 'brasileirao')!;
    expect(brasileirao.clubes).toHaveLength(20);
    expect(new Set(brasileirao.clubes).size).toBe(20);
  });

  it('todo campeonato sem cobertura confirmada tem provedor: null (CA-07.2)', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const semCobertura = config.campeonatos.filter((c) => c.categoria !== 'brasileirao');
    expect(semCobertura.length).toBeGreaterThan(0);
    for (const campeonato of semCobertura) {
      expect(campeonato.provedor).toBeNull();
    }
  });

  it('o Brasileirão é o único campeonato com provedor confirmado (football-data-org)', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const comProvedor = config.campeonatos.filter((c) => c.provedor !== null);
    expect(comProvedor).toHaveLength(1);
    expect(comProvedor[0]?.categoria).toBe('brasileirao');
  });

  it('todo campeonato com clubes vazio documenta a pendência em "observacao"', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    for (const campeonato of config.campeonatos) {
      if (campeonato.clubes.length === 0) {
        expect(campeonato.observacao).toBeTruthy();
      }
    }
  });

  it('rejeita um campeonato sem categoria "brasileirao" no arquivo', () => {
    const semBrasileirao = {
      temporada: 2026,
      campeonatos: (configCampeonatos as { campeonatos: unknown[] }).campeonatos.filter(
        (c) => (c as { categoria: string }).categoria !== 'brasileirao',
      ),
    };
    const resultado = ConfigCampeonatosSchema.safeParse(semBrasileirao);
    expect(resultado.success).toBe(false);
  });

  it('rejeita clube fora do Brasileirão que aparece em outro campeonato', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const clonado = JSON.parse(JSON.stringify(config)) as typeof config;
    const brasileirao = clonado.campeonatos.find((c) => c.categoria === 'brasileirao')!;
    brasileirao.clubes = brasileirao.clubes.filter((id) => id !== 'palmeiras');
    const resultado = ConfigCampeonatosSchema.safeParse(clonado);
    expect(resultado.success).toBe(false);
  });

  it('rejeita id de campeonato duplicado', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const clonado = JSON.parse(JSON.stringify(config)) as typeof config;
    clonado.campeonatos.push({ ...clonado.campeonatos[0]! });
    const resultado = ConfigCampeonatosSchema.safeParse(clonado);
    expect(resultado.success).toBe(false);
  });

  it('rejeita janela com fim anterior ao início', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const clonado = JSON.parse(JSON.stringify(config)) as typeof config;
    clonado.campeonatos[0]!.janela = { inicio: '2026-12-31', fim: '2026-01-01' };
    const resultado = ConfigCampeonatosSchema.safeParse(clonado);
    expect(resultado.success).toBe(false);
  });
});
