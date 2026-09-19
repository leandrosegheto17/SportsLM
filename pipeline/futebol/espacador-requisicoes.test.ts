// COB-10 — espaçador de requisições (ADR-021 item 1). Relógio falso, sem espera real.
import { describe, expect, it } from 'vitest';
import { criarEspacador } from './espacador-requisicoes';

function ambiente() {
  let t = 0;
  const dormidas: number[] = [];
  return {
    agora: () => t,
    dormir: async (ms: number) => {
      dormidas.push(ms);
      t += ms;
    },
    dormidas,
    avancar: (ms: number) => {
      t += ms;
    },
  };
}

const cfg = { maxPorJanela: 28, janelaMs: 60000, intervaloMinMs: 2200 };

describe('criarEspacador', () => {
  it('40 chamadas nunca excedem 28 em qualquer janela deslizante de 60 s', async () => {
    const a = ambiente();
    const esp = criarEspacador({ ...cfg, agora: a.agora, dormir: a.dormir });
    const marcas: number[] = [];
    for (let i = 0; i < 40; i++) await esp.executar(async () => marcas.push(a.agora()));
    for (let i = 0; i < marcas.length; i++) {
      const naJanela = marcas.filter((m) => m >= marcas[i]! && m < marcas[i]! + 60000);
      expect(naJanela.length).toBeLessThanOrEqual(28);
    }
  });

  it('respeita o intervalo mínimo entre chamadas consecutivas', async () => {
    const a = ambiente();
    const esp = criarEspacador({ ...cfg, agora: a.agora, dormir: a.dormir });
    const marcas: number[] = [];
    for (let i = 0; i < 10; i++) await esp.executar(async () => marcas.push(a.agora()));
    for (let i = 1; i < marcas.length; i++) {
      expect(marcas[i]! - marcas[i - 1]!).toBeGreaterThanOrEqual(2200);
    }
  });

  it('serializa chamadas concorrentes na ordem', async () => {
    const a = ambiente();
    const esp = criarEspacador({ ...cfg, agora: a.agora, dormir: a.dormir });
    const ordem: number[] = [];
    let ativas = 0;
    let maxAtivas = 0;
    await Promise.all(
      [0, 1, 2, 3].map((i) =>
        esp.executar(async () => {
          ativas++;
          maxAtivas = Math.max(maxAtivas, ativas);
          await Promise.resolve();
          ordem.push(i);
          ativas--;
        }),
      ),
    );
    expect(ordem).toEqual([0, 1, 2, 3]);
    expect(maxAtivas).toBe(1);
  });

  it('erro de uma chamada não trava a fila e é propagado ao chamador', async () => {
    const a = ambiente();
    const esp = criarEspacador({ ...cfg, agora: a.agora, dormir: a.dormir });
    const falha = esp.executar(async () => {
      throw new Error('boom');
    });
    const ok = esp.executar(async () => 'ok');
    await expect(falha).rejects.toThrow('boom');
    await expect(ok).resolves.toBe('ok');
  });

  it('não dorme quando o tempo já decorrido basta', async () => {
    const a = ambiente();
    const esp = criarEspacador({ ...cfg, agora: a.agora, dormir: a.dormir });
    await esp.executar(async () => 1);
    a.avancar(5000);
    await esp.executar(async () => 2);
    expect(a.dormidas).toEqual([]);
  });
});
