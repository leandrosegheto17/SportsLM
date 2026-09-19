// pipeline/futebol/espacador-requisicoes.ts — COB-10 (ADR-021 item 1)
//
// Serializa chamadas a um mesmo provedor, impõe intervalo mínimo entre elas e
// um teto por janela deslizante. Relógio e `dormir` injetáveis (teste sem
// tempo real).

export interface EspacadorOpcoes {
  maxPorJanela: number;
  janelaMs: number;
  intervaloMinMs: number;
  agora: () => number;
  dormir: (ms: number) => Promise<void>;
}

export interface Espacador {
  executar<T>(fn: () => Promise<T>): Promise<T>;
}

export function criarEspacador(opcoes: EspacadorOpcoes): Espacador {
  const { maxPorJanela, janelaMs, intervaloMinMs, agora, dormir } = opcoes;
  const inicios: number[] = [];
  let fila: Promise<unknown> = Promise.resolve();

  async function aguardarVez(): Promise<void> {
    for (;;) {
      const t = agora();
      while (inicios.length > 0 && inicios[0]! <= t - janelaMs) inicios.shift();
      const ultimo = inicios[inicios.length - 1];
      const esperaIntervalo = ultimo === undefined ? 0 : ultimo + intervaloMinMs - t;
      const esperaJanela =
        inicios.length >= maxPorJanela
          ? inicios[inicios.length - maxPorJanela]! + janelaMs - t
          : 0;
      const espera = Math.max(esperaIntervalo, esperaJanela);
      if (espera <= 0) {
        inicios.push(t);
        return;
      }
      await dormir(espera);
    }
  }

  return {
    executar<T>(fn: () => Promise<T>): Promise<T> {
      const resultado = fila.then(async () => {
        await aguardarVez();
        return fn();
      });
      fila = resultado.catch(() => undefined);
      return resultado;
    },
  };
}
