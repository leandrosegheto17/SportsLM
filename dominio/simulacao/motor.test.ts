// dominio/simulacao/motor.test.ts — DOM-05 (TASK.md Lote 3)
//
// Testes por tabela (TASK.md Diretriz #11) cobrindo CA-11.2 a CA-11.5,
// CA-11.8 e CA-11.10 (RN-14, ADR-010). Módulo puro: nenhum teste depende de
// hora do relógio (`Date.now()` nunca é chamado pelo motor).

import { describe, expect, it } from 'vitest';
import { simular } from './motor';
import type { EntradaSimulacao, PartidaRestante } from './tipos';

function partida(
  overrides: Partial<PartidaRestante> &
    Pick<PartidaRestante, 'id' | 'mandanteId' | 'visitanteId'>,
): PartidaRestante {
  return {
    rodada: 1,
    status: 'agendada',
    placar: null,
    ...overrides,
  };
}

describe('simular — CA-11.2 (recalcula acumulado e projeção ao definir palpite)', () => {
  it('sem nenhum palpite, projetado = pontosAtuais e acumulado por rodada reflete isso', () => {
    const entrada: EntradaSimulacao = {
      clubes: [{ id: 'palmeiras', pontosAtuais: 10 }],
      partidasRestantes: [
        partida({ id: 'p1', rodada: 20, mandanteId: 'palmeiras', visitanteId: 'gremio' }),
        partida({ id: 'p2', rodada: 21, mandanteId: 'bahia', visitanteId: 'palmeiras' }),
      ],
      palpites: {},
    };

    const saida = simular(entrada);

    expect(saida.porClube['palmeiras']?.projetado).toBe(10);
    expect(saida.porClube['palmeiras']?.acumuladoPorRodada).toEqual([
      { rodada: 20, pontos: 10 },
      { rodada: 21, pontos: 10 },
    ]);
  });

  it('definir um palpite de vitória (mandante) recalcula o acumulado e a projeção final', () => {
    const entrada: EntradaSimulacao = {
      clubes: [{ id: 'palmeiras', pontosAtuais: 10 }],
      partidasRestantes: [
        partida({ id: 'p1', rodada: 20, mandanteId: 'palmeiras', visitanteId: 'gremio' }),
      ],
      palpites: { p1: 'vitoria' },
    };

    const saida = simular(entrada);

    expect(saida.porClube['palmeiras']?.projetado).toBe(13);
    expect(saida.porClube['palmeiras']?.acumuladoPorRodada).toEqual([
      { rodada: 20, pontos: 13 },
    ]);
  });

  it('trocar o palpite recalcula de novo (nova pontuação, não soma sobre a anterior)', () => {
    const base: EntradaSimulacao = {
      clubes: [{ id: 'palmeiras', pontosAtuais: 10 }],
      partidasRestantes: [
        partida({ id: 'p1', rodada: 20, mandanteId: 'palmeiras', visitanteId: 'gremio' }),
      ],
      palpites: { p1: 'vitoria' },
    };

    const comDerrota = simular({ ...base, palpites: { p1: 'derrota' } });

    expect(comDerrota.porClube['palmeiras']?.projetado).toBe(10);
  });

  it('projeta rodada a rodada acumulando o palpite de cada partida em sequência', () => {
    const entrada: EntradaSimulacao = {
      clubes: [{ id: 'palmeiras', pontosAtuais: 10 }],
      partidasRestantes: [
        partida({ id: 'p1', rodada: 20, mandanteId: 'palmeiras', visitanteId: 'gremio' }),
        partida({ id: 'p2', rodada: 21, mandanteId: 'bahia', visitanteId: 'palmeiras' }),
      ],
      palpites: { p1: 'vitoria', p2: 'empate' }, // p2: palpite é do mandante (bahia); visitante (palmeiras) espelha
    };

    const saida = simular(entrada);

    // p1: palmeiras mandante, vitória → +3 (13). p2: bahia mandante empata →
    // espelhado para palmeiras (visitante) também é empate → +1 (14).
    expect(saida.porClube['palmeiras']?.acumuladoPorRodada).toEqual([
      { rodada: 20, pontos: 13 },
      { rodada: 21, pontos: 14 },
    ]);
    expect(saida.porClube['palmeiras']?.projetado).toBe(14);
  });
});

describe('simular — CA-11.3 (projetado e máximo possível, sem palpite)', () => {
  it('sem palpite: projetado soma 0 e máximo possível soma 3 por partida restante', () => {
    const entrada: EntradaSimulacao = {
      clubes: [{ id: 'palmeiras', pontosAtuais: 10 }],
      partidasRestantes: [
        partida({ id: 'p1', rodada: 20, mandanteId: 'palmeiras', visitanteId: 'gremio' }),
        partida({ id: 'p2', rodada: 21, mandanteId: 'bahia', visitanteId: 'palmeiras' }),
      ],
      palpites: {},
    };

    const saida = simular(entrada);

    expect(saida.porClube['palmeiras']?.projetado).toBe(10);
    expect(saida.porClube['palmeiras']?.maximoPossivel).toBe(16); // 10 + 3 + 3
  });

  it('máximo possível é o teto teórico (3), mesmo já havendo palpite diferente de vitória', () => {
    const entrada: EntradaSimulacao = {
      clubes: [{ id: 'palmeiras', pontosAtuais: 10 }],
      partidasRestantes: [
        partida({ id: 'p1', rodada: 20, mandanteId: 'palmeiras', visitanteId: 'gremio' }),
      ],
      palpites: { p1: 'derrota' },
    };

    const saida = simular(entrada);

    expect(saida.porClube['palmeiras']?.projetado).toBe(10); // derrota conta 0
    expect(saida.porClube['palmeiras']?.maximoPossivel).toBe(13); // teto continua 3
  });

  it('partida travada por resultado real conta o valor real no máximo possível, não mais 3', () => {
    const entrada: EntradaSimulacao = {
      clubes: [{ id: 'palmeiras', pontosAtuais: 10 }],
      partidasRestantes: [
        partida({
          id: 'p1',
          rodada: 20,
          mandanteId: 'palmeiras',
          visitanteId: 'gremio',
          status: 'finalizada',
          placar: { mandante: 0, visitante: 0 },
        }),
      ],
      palpites: { p1: 'vitoria' }, // ignorado — resultado real venceu (ADR-010 item 4)
    };

    const saida = simular(entrada);

    expect(saida.porClube['palmeiras']?.projetado).toBe(11); // empate real = +1
    expect(saida.porClube['palmeiras']?.maximoPossivel).toBe(11); // travada, não é mais teto de 3
  });
});

describe('simular — CA-11.4 (confronto direto é entrada única espelhada)', () => {
  it('define o palpite uma única vez e aplica automaticamente o resultado espelhado ao outro clube', () => {
    const entrada: EntradaSimulacao = {
      clubes: [
        { id: 'palmeiras', pontosAtuais: 50 },
        { id: 'corinthians', pontosAtuais: 50 },
      ],
      partidasRestantes: [
        partida({
          id: 'classico',
          rodada: 30,
          mandanteId: 'palmeiras',
          visitanteId: 'corinthians',
        }),
      ],
      palpites: { classico: 'vitoria' }, // única entrada, perspectiva do mandante (palmeiras)
    };

    const saida = simular(entrada);

    expect(saida.porClube['palmeiras']?.projetado).toBe(53); // vitória
    expect(saida.porClube['corinthians']?.projetado).toBe(50); // derrota espelhada, +0
    expect(saida.porClube['palmeiras']?.vitoriasProjetadas).toBe(1);
    expect(saida.porClube['corinthians']?.vitoriasProjetadas).toBe(0);
  });

  it('confronto direto empatado espelha empate para os dois lados (nenhuma contradição possível)', () => {
    const entrada: EntradaSimulacao = {
      clubes: [
        { id: 'palmeiras', pontosAtuais: 50 },
        { id: 'corinthians', pontosAtuais: 48 },
      ],
      partidasRestantes: [
        partida({
          id: 'classico',
          rodada: 30,
          mandanteId: 'palmeiras',
          visitanteId: 'corinthians',
        }),
      ],
      palpites: { classico: 'empate' },
    };

    const saida = simular(entrada);

    expect(saida.porClube['palmeiras']?.projetado).toBe(51);
    expect(saida.porClube['corinthians']?.projetado).toBe(49);
  });
});

describe('simular — CA-11.5 (empate em pontos projetados desempata por vitórias; senão, empate técnico)', () => {
  it('empate em pontos projetados é resolvido por vitórias projetadas (sem empate técnico)', () => {
    const entrada: EntradaSimulacao = {
      clubes: [
        { id: 'palmeiras', pontosAtuais: 50 },
        { id: 'gremio', pontosAtuais: 50 },
      ],
      partidasRestantes: [
        // palmeiras: 1 vitória (3 pontos)
        partida({ id: 'p1', rodada: 20, mandanteId: 'palmeiras', visitanteId: 'bahia' }),
        // gremio: 3 empates (3 pontos), 0 vitórias
        partida({ id: 'p2', rodada: 20, mandanteId: 'gremio', visitanteId: 'bahia' }),
        partida({ id: 'p3', rodada: 21, mandanteId: 'gremio', visitanteId: 'ceara' }),
        partida({ id: 'p4', rodada: 22, mandanteId: 'gremio', visitanteId: 'vitoria' }),
      ],
      palpites: { p1: 'vitoria', p2: 'empate', p3: 'empate', p4: 'empate' },
    };

    const saida = simular(entrada);

    expect(saida.porClube['palmeiras']?.projetado).toBe(53);
    expect(saida.porClube['gremio']?.projetado).toBe(53);
    expect(saida.porClube['palmeiras']?.vitoriasProjetadas).toBe(1);
    expect(saida.porClube['gremio']?.vitoriasProjetadas).toBe(0);
    expect(saida.ordenacao).toEqual(['palmeiras', 'gremio']);
    expect(saida.empateTecnico).toEqual([]);
  });

  it('persistindo o empate em pontos E em vitórias projetadas, marca "empate técnico"', () => {
    const entrada: EntradaSimulacao = {
      clubes: [
        { id: 'palmeiras', pontosAtuais: 50 },
        { id: 'gremio', pontosAtuais: 50 },
      ],
      partidasRestantes: [
        partida({ id: 'p1', rodada: 20, mandanteId: 'palmeiras', visitanteId: 'bahia' }),
        partida({ id: 'p2', rodada: 20, mandanteId: 'gremio', visitanteId: 'ceara' }),
      ],
      palpites: { p1: 'vitoria', p2: 'vitoria' },
    };

    const saida = simular(entrada);

    expect(saida.porClube['palmeiras']?.projetado).toBe(53);
    expect(saida.porClube['gremio']?.projetado).toBe(53);
    expect(saida.porClube['palmeiras']?.vitoriasProjetadas).toBe(1);
    expect(saida.porClube['gremio']?.vitoriasProjetadas).toBe(1);
    // desempate final estável por id (ADR-010 item 5): 'gremio' < 'palmeiras'
    expect(saida.ordenacao).toEqual(['gremio', 'palmeiras']);
    expect(saida.empateTecnico).toEqual([['gremio', 'palmeiras']]);
  });

  it('3 clubes: só 2 empatam tecnicamente — o grupo de empate tem exatamente esses 2', () => {
    const entrada: EntradaSimulacao = {
      clubes: [
        { id: 'palmeiras', pontosAtuais: 60 },
        { id: 'gremio', pontosAtuais: 50 },
        { id: 'bahia', pontosAtuais: 50 },
      ],
      partidasRestantes: [
        partida({ id: 'p2', rodada: 20, mandanteId: 'gremio', visitanteId: 'ceara' }),
        partida({ id: 'p3', rodada: 20, mandanteId: 'bahia', visitanteId: 'vitoria' }),
      ],
      palpites: { p2: 'vitoria', p3: 'vitoria' },
    };

    const saida = simular(entrada);

    expect(saida.ordenacao).toEqual(['palmeiras', 'bahia', 'gremio']);
    expect(saida.empateTecnico).toEqual([['bahia', 'gremio']]);
  });
});

describe('simular — CA-11.8 (sem jogos restantes: pontuação final, sem projeção adicional)', () => {
  it('clube sem partidas restantes tem projetado = máximo possível = pontosAtuais, sem acumulado', () => {
    const entrada: EntradaSimulacao = {
      clubes: [{ id: 'palmeiras', pontosAtuais: 78 }],
      partidasRestantes: [],
      palpites: {},
    };

    const saida = simular(entrada);

    expect(saida.porClube['palmeiras']).toEqual({
      acumuladoPorRodada: [],
      projetado: 78,
      maximoPossivel: 78,
      vitoriasProjetadas: 0,
    });
  });
});

describe('simular — CA-11.10 (projeta somente time e rivais, ordenados entre si)', () => {
  it('a saída só contém os clubes comparados, mesmo com partidas de outros clubes na entrada', () => {
    const entrada: EntradaSimulacao = {
      clubes: [
        { id: 'palmeiras', pontosAtuais: 50 },
        { id: 'gremio', pontosAtuais: 40 },
      ],
      partidasRestantes: [
        partida({ id: 'p1', rodada: 20, mandanteId: 'palmeiras', visitanteId: 'bahia' }),
        // partida entre dois clubes fora da comparação: não deve gerar entrada
        partida({ id: 'p2', rodada: 20, mandanteId: 'ceara', visitanteId: 'vitoria' }),
      ],
      palpites: { p1: 'vitoria', p2: 'vitoria' },
    };

    const saida = simular(entrada);

    expect(Object.keys(saida.porClube).sort()).toEqual(['gremio', 'palmeiras']);
    expect(saida.ordenacao).toEqual(['palmeiras', 'gremio']);
    expect(saida.ordenacao).not.toContain('ceara');
    expect(saida.ordenacao).not.toContain('vitoria');
  });

  it('a ordenação nunca inclui mais clubes do que os comparados, mesmo com 1 só clube (sem rival)', () => {
    const entrada: EntradaSimulacao = {
      clubes: [{ id: 'palmeiras', pontosAtuais: 50 }],
      partidasRestantes: [
        partida({ id: 'p1', rodada: 20, mandanteId: 'palmeiras', visitanteId: 'bahia' }),
      ],
      palpites: {},
    };

    const saida = simular(entrada);

    expect(saida.ordenacao).toEqual(['palmeiras']);
    expect(saida.empateTecnico).toEqual([]);
  });
});
