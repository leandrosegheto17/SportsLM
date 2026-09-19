import { describe, expect, it } from 'vitest';
import { diagnosticarParticipantes } from './participantes';

describe('diagnosticarParticipantes', () => {
  it('clube visto e configurado não gera diagnóstico', () => {
    const r = diagnosticarParticipantes(['fla', 'pal'], ['fla', 'pal']);
    expect(r.naoConfigurados).toEqual([]);
    expect(r.configuradosNuncaVistos).toEqual([]);
  });

  it('clube visto e não configurado é listado', () => {
    const r = diagnosticarParticipantes(['fla', 'cor'], ['fla']);
    expect(r.naoConfigurados).toEqual(['cor']);
  });

  it('configurado nunca visto aparece só em configuradosNuncaVistos', () => {
    const r = diagnosticarParticipantes(['fla'], ['fla', 'pal']);
    expect(r.naoConfigurados).toEqual([]);
    expect(r.configuradosNuncaVistos).toEqual(['pal']);
  });

  it('ordem determinística, sem duplicatas', () => {
    const r = diagnosticarParticipantes(['zzz', 'aaa', 'zzz', 'mmm'], []);
    expect(r.naoConfigurados).toEqual(['aaa', 'mmm', 'zzz']);
  });

  it('não muta as entradas', () => {
    const vistos = Object.freeze(['b', 'a']);
    const cfg = Object.freeze(['c']);
    const r = diagnosticarParticipantes(vistos, cfg);
    expect(vistos).toEqual(['b', 'a']);
    expect(cfg).toEqual(['c']);
    expect(r.configuradosNuncaVistos).toEqual(['c']);
  });
});
