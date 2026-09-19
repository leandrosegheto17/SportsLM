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
import { CampeonatoConfigSchema, ConfigCampeonatosSchema } from './campeonatos.schema';
import { campeonatoPublicoSchema } from '../pipeline/publicacao/gerador-snapshots';

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
    // As 7 ligas do recorte + Brasileirão têm provedor (COB-04); o resto é null.
    const comId = new Set([
      'brasileirao-serie-a',
      'paulista',
      'carioca',
      'gaucho',
      'mineiro',
      'copa-do-brasil',
      'libertadores',
      'sul-americana',
    ]);
    const semCobertura = config.campeonatos.filter((c) => !comId.has(c.id));
    expect(semCobertura.length).toBeGreaterThan(0);
    for (const campeonato of semCobertura) {
      expect(campeonato.provedor).toBeNull();
    }
  });

  it('Brasileirão usa football-data-org; as 7 ligas do recorte, thesportsdb', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const prov = (id: string) => config.campeonatos.find((c) => c.id === id)?.provedor;
    expect(prov('brasileirao-serie-a')).toBe('football-data-org');
    for (const id of [
      'paulista',
      'carioca',
      'gaucho',
      'mineiro',
      'copa-do-brasil',
      'libertadores',
      'sul-americana',
    ]) {
      expect(prov(id)).toBe('thesportsdb');
    }
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

  describe('as 7 ligas do recorte (COB-04, ADR-023/024)', () => {
    const config = ConfigCampeonatosSchema.parse(configCampeonatos);
    const get = (id: string) => config.campeonatos.find((c) => c.id === id)!;

    it('exatamente as 7 ligas do recorte têm provedor thesportsdb', () => {
      const comProvedor = config.campeonatos
        .filter((c) => c.provedor === 'thesportsdb')
        .map((c) => c.id)
        .sort();
      expect(comProvedor).toEqual(
        [
          'carioca',
          'copa-do-brasil',
          'gaucho',
          'libertadores',
          'mineiro',
          'paulista',
          'sul-americana',
        ].sort(),
      );
      for (const id of [
        'baiano',
        'cearense',
        'pernambucano',
        'copa-do-nordeste',
        'supercopa-do-brasil',
      ]) {
        expect(get(id).provedor).toBeNull();
      }
    });

    it('refProvedor das ligas novas segue o SPK-07', () => {
      expect(get('copa-do-brasil').refProvedor).toEqual({
        id: '4725',
        temporada: '2026',
      });
      expect(get('libertadores').refProvedor).toEqual({ id: '4501', temporada: '2026' });
      expect(get('sul-americana').refProvedor).toEqual({ id: '4724', temporada: '2026' });
      expect(get('gaucho').refProvedor).toEqual({ id: '5691', temporada: '2026' });
      expect(get('mineiro').refProvedor).toEqual({ id: '5763', temporada: '2026' });
    });

    it('toda liga com provedor tem refProvedor; nenhuma fica sem clubes', () => {
      for (const c of config.campeonatos) {
        if (c.provedor !== null) expect(c.refProvedor).toBeDefined();
        if (
          c.id !== 'supercopa-do-brasil' &&
          c.id !== 'cearense' &&
          c.id !== 'pernambucano'
        ) {
          expect(c.clubes.length).toBeGreaterThan(0);
        }
      }
    });

    it('candidatos continentais (SPK-07) com observação de verificação', () => {
      expect([...get('libertadores').clubes].sort()).toEqual(
        [
          'flamengo',
          'palmeiras',
          'mirassol',
          'corinthians',
          'botafogo',
          'fluminense',
          'cruzeiro',
          'bahia',
        ].sort(),
      );
      expect([...get('sul-americana').clubes].sort()).toEqual(
        [
          'sao-paulo',
          'botafogo',
          'santos',
          'vasco',
          'atletico-mg',
          'gremio',
          'rb-bragantino',
        ].sort(),
      );
      expect(get('libertadores').observacao).toMatch(/2026-09-18/);
      expect(get('sul-americana').observacao).toMatch(/2026-09-18/);
    });

    it('não há exclusividade entre continentais: Botafogo nas duas é válido', () => {
      expect(get('libertadores').clubes).toContain('botafogo');
      expect(get('sul-americana').clubes).toContain('botafogo');
      expect(ConfigCampeonatosSchema.safeParse(configCampeonatos).success).toBe(true);
    });

    it('Copa do Brasil mantém os 20 clubes', () => {
      expect(get('copa-do-brasil').clubes).toHaveLength(20);
    });
  });

  describe('refProvedor (COB-02, ADR-020)', () => {
    const base = {
      id: 'x',
      nome: 'X',
      temporada: 2026,
      categoria: 'estadual',
      formato: 'grupos',
      janela: { inicio: '2026-01-01', fim: '2026-02-01' },
      clubes: ['flamengo'],
    };

    it('rejeita provedor sem refProvedor', () => {
      expect(
        CampeonatoConfigSchema.safeParse({ ...base, provedor: 'thesportsdb' }).success,
      ).toBe(false);
    });

    it('rejeita refProvedor com provedor null', () => {
      expect(
        CampeonatoConfigSchema.safeParse({
          ...base,
          provedor: null,
          refProvedor: { id: '1' },
        }).success,
      ).toBe(false);
    });

    it('aceita provedor com refProvedor', () => {
      expect(
        CampeonatoConfigSchema.safeParse({
          ...base,
          provedor: 'thesportsdb',
          refProvedor: { id: '1', temporada: '2026' },
        }).success,
      ).toBe(true);
    });

    it('as 3 competições com provedor estão migradas', () => {
      const config = ConfigCampeonatosSchema.parse(configCampeonatos);
      const ref = (id: string) =>
        config.campeonatos.find((c) => c.id === id)?.refProvedor;
      expect(ref('brasileirao-serie-a')).toEqual({ id: 'BSA' });
      expect(ref('paulista')).toEqual({ id: '5767', temporada: '2026' });
      expect(ref('carioca')).toEqual({ id: '5688', temporada: '2026' });
    });

    it('o JSON publicado é aceito pelo schema da SPA e cabe em 4 KB (SDD §2.2)', () => {
      const config = ConfigCampeonatosSchema.parse(configCampeonatos);
      const publicado = config.campeonatos.map((c) =>
        campeonatoPublicoSchema.parse({
          id: c.id,
          nome: c.nome,
          temporada: c.temporada,
          categoria: c.categoria,
          formato: c.formato,
          janela: c.janela,
          provedor: c.provedor,
        }),
      );
      const corpo = JSON.stringify({
        temporada: config.temporada,
        campeonatos: publicado,
      });
      expect(Buffer.byteLength(corpo)).toBeLessThanOrEqual(4096);
      // A SPA (catalogoOnboarding) valida com passthrough: o bruto também passa.
      expect(typeof (configCampeonatos as { temporada: number }).temporada).toBe(
        'number',
      );
    });
  });
});
