// dominio/campeonatos/verificacao-consistencia.test.ts — ING-F-04 (TASK.md Lote 5)
//
// Testes por tabela cobrindo as 5 verificações mínimas de consistência de
// CA-16.6 (ver nota de decisão em verificacao-consistencia.ts sobre o
// agrupamento das 6 cláusulas do SDD §2.4 em 5 verificações).

import { describe, expect, it } from 'vitest';
import type { LinhaClassificacao, Partida } from '../tipos/futebol';
import {
  verificarConsistenciaCompeticao,
  type EntradaVerificacaoConsistencia,
} from './verificacao-consistencia';

const INICIO_COMPETICAO = '2026-04-01T00:00:00-03:00';

function linha(p: Partial<LinhaClassificacao> = {}): LinhaClassificacao {
  return {
    competicaoId: 'brasileirao-serie-a',
    grupo: null,
    posicao: 1,
    clubeId: 'palmeiras',
    pontos: 10,
    jogos: 5,
    v: 3,
    e: 1,
    d: 1,
    gp: 8,
    gc: 4,
    sg: 4,
    aproveitamento: 66.7,
    ultimosCinco: [],
    ...p,
  };
}

function partida(p: Partial<Partida> = {}): Partida {
  return {
    id: 'p1',
    competicaoId: 'brasileirao-serie-a',
    rodada: 1,
    fase: null,
    mandanteId: 'palmeiras',
    visitanteId: 'flamengo',
    dataHora: '2026-05-01T20:00:00-03:00',
    horarioDefinido: true,
    estadio: null,
    status: 'finalizada',
    placar: { mandante: 1, visitante: 0 },
    ...p,
  };
}

function entrada(
  p: Partial<EntradaVerificacaoConsistencia> = {},
): EntradaVerificacaoConsistencia {
  return {
    formato: 'pontos-corridos',
    linhas: [linha()],
    partidas: [partida()],
    numeroClubesEsperado: 1,
    inicioCompeticao: INICIO_COMPETICAO,
    ...p,
  };
}

describe('verificarConsistenciaCompeticao (CA-16.6)', () => {
  it('lote consistente → consistente: true, sem motivos', () => {
    const resultado = verificarConsistenciaCompeticao(entrada());
    expect(resultado).toEqual({ consistente: true, motivos: [] });
  });

  describe('verificação 1 — pontos = 3V+E e jogos = V+E+D', () => {
    it('pontos não bate com 3V+E → inconsistente', () => {
      const resultado = verificarConsistenciaCompeticao(
        entrada({ linhas: [linha({ pontos: 99 })] }),
      );
      expect(resultado.consistente).toBe(false);
      expect(resultado.motivos).toContain('linha-aritmetica-invalida');
    });

    it('jogos não bate com V+E+D → inconsistente', () => {
      const resultado = verificarConsistenciaCompeticao(
        entrada({ linhas: [linha({ jogos: 99 })] }),
      );
      expect(resultado.consistente).toBe(false);
      expect(resultado.motivos).toContain('linha-aritmetica-invalida');
    });

    it('pontos e jogos batem → não reporta o motivo', () => {
      const resultado = verificarConsistenciaCompeticao(entrada());
      expect(resultado.motivos).not.toContain('linha-aritmetica-invalida');
    });
  });

  describe('verificação 2 — saldo = GP − GC', () => {
    it('saldo não bate com GP−GC → inconsistente', () => {
      const resultado = verificarConsistenciaCompeticao(
        entrada({ linhas: [linha({ sg: 99 })] }),
      );
      expect(resultado.consistente).toBe(false);
      expect(resultado.motivos).toContain('saldo-invalido');
    });

    it('saldo bate → não reporta o motivo', () => {
      const resultado = verificarConsistenciaCompeticao(entrada());
      expect(resultado.motivos).not.toContain('saldo-invalido');
    });
  });

  describe('verificação 3 — número de clubes igual ao configurado', () => {
    it('menos linhas que o configurado → inconsistente', () => {
      const resultado = verificarConsistenciaCompeticao(
        entrada({ linhas: [linha()], numeroClubesEsperado: 20 }),
      );
      expect(resultado.consistente).toBe(false);
      expect(resultado.motivos).toContain('numero-de-clubes-incorreto');
    });

    it('mais linhas que o configurado → inconsistente', () => {
      const resultado = verificarConsistenciaCompeticao(
        entrada({
          linhas: [
            linha({ clubeId: 'palmeiras' }),
            linha({ clubeId: 'flamengo', posicao: 2 }),
          ],
          numeroClubesEsperado: 1,
        }),
      );
      expect(resultado.consistente).toBe(false);
      expect(resultado.motivos).toContain('numero-de-clubes-incorreto');
    });

    it('número de linhas igual ao configurado → não reporta o motivo', () => {
      const resultado = verificarConsistenciaCompeticao(
        entrada({ numeroClubesEsperado: 1 }),
      );
      expect(resultado.motivos).not.toContain('numero-de-clubes-incorreto');
    });
  });

  describe('verificação 4 — nenhuma partida com data anterior ao início da competição', () => {
    it('partida com data anterior ao início → inconsistente', () => {
      const resultado = verificarConsistenciaCompeticao(
        entrada({ partidas: [partida({ dataHora: '2026-01-01T00:00:00-03:00' })] }),
      );
      expect(resultado.consistente).toBe(false);
      expect(resultado.motivos).toContain('partida-anterior-ao-inicio');
    });

    it('partida com data posterior ao início → não reporta o motivo', () => {
      const resultado = verificarConsistenciaCompeticao(entrada());
      expect(resultado.motivos).not.toContain('partida-anterior-ao-inicio');
    });

    it('partida com data ausente ("a definir") → não conta como anterior', () => {
      const resultado = verificarConsistenciaCompeticao(
        entrada({
          partidas: [partida({ dataHora: null, status: 'agendada', placar: null })],
        }),
      );
      expect(resultado.motivos).not.toContain('partida-anterior-ao-inicio');
    });
  });

  describe('verificação 5 — nenhuma partida `finalizada` sem placar', () => {
    it('partida finalizada sem placar → inconsistente', () => {
      const resultado = verificarConsistenciaCompeticao(
        entrada({ partidas: [partida({ status: 'finalizada', placar: null })] }),
      );
      expect(resultado.consistente).toBe(false);
      expect(resultado.motivos).toContain('partida-finalizada-sem-placar');
    });

    it('partida finalizada com placar → não reporta o motivo', () => {
      const resultado = verificarConsistenciaCompeticao(entrada());
      expect(resultado.motivos).not.toContain('partida-finalizada-sem-placar');
    });

    it('partida não finalizada sem placar (ex.: agendada) → não reporta o motivo', () => {
      const resultado = verificarConsistenciaCompeticao(
        entrada({ partidas: [partida({ status: 'agendada', placar: null })] }),
      );
      expect(resultado.motivos).not.toContain('partida-finalizada-sem-placar');
    });
  });

  it('múltiplas inconsistências → reporta todos os motivos, não só o primeiro', () => {
    const resultado = verificarConsistenciaCompeticao(
      entrada({
        linhas: [linha({ pontos: 99, sg: 99 })],
        numeroClubesEsperado: 20,
        partidas: [
          partida({ dataHora: '2026-01-01T00:00:00-03:00' }),
          partida({ id: 'p2', status: 'finalizada', placar: null }),
        ],
      }),
    );
    expect(resultado.consistente).toBe(false);
    expect(resultado.motivos).toEqual(
      expect.arrayContaining([
        'linha-aritmetica-invalida',
        'saldo-invalido',
        'numero-de-clubes-incorreto',
        'partida-anterior-ao-inicio',
        'partida-finalizada-sem-placar',
      ]),
    );
    expect(resultado.motivos).toHaveLength(5);
  });
});

describe('verificarConsistenciaCompeticao por formato (ADR-020 item 5)', () => {
  const clubes = ['palmeiras', 'flamengo', 'santos'];
  const cheia = clubes.map((clubeId) => linha({ clubeId }));
  const base = (p: Partial<EntradaVerificacaoConsistencia>) =>
    entrada({ numeroClubesEsperado: 3, clubesConfigurados: clubes, ...p });
  const motivosDe = (p: Partial<EntradaVerificacaoConsistencia>) =>
    verificarConsistenciaCompeticao(base(p)).motivos;

  describe.each(['pontos-corridos', 'grupos'] as const)('%s', (formato) => {
    it('tabela cheia → consistente', () => {
      expect(motivosDe({ formato, linhas: cheia })).toEqual([]);
    });
    it('parcial → numero-de-clubes-incorreto', () => {
      expect(motivosDe({ formato, linhas: cheia.slice(0, 2) })).toContain('numero-de-clubes-incorreto');
    });
    it('vazia → numero-de-clubes-incorreto', () => {
      expect(motivosDe({ formato, linhas: [] })).toContain('numero-de-clubes-incorreto');
    });
    it('duplicada → clube-duplicado', () => {
      expect(motivosDe({ formato, linhas: [cheia[0]!, cheia[0]!, cheia[1]!] })).toContain('clube-duplicado');
    });
  });

  describe('misto', () => {
    const formato = 'misto' as const;
    it('cheia, parcial e vazia → consistente', () => {
      expect(motivosDe({ formato, linhas: cheia })).toEqual([]);
      expect(motivosDe({ formato, linhas: cheia.slice(0, 2) })).toEqual([]);
      expect(motivosDe({ formato, linhas: [] })).toEqual([]);
    });
    it('duplicada → clube-duplicado', () => {
      expect(motivosDe({ formato, linhas: [cheia[0]!, cheia[0]!] })).toContain('clube-duplicado');
    });
    it('clube fora da config → clube-fora-da-configuracao', () => {
      expect(motivosDe({ formato, linhas: [linha({ clubeId: 'vasco' })] })).toContain('clube-fora-da-configuracao');
    });
    it('mais linhas que clubes → numero-de-clubes-incorreto', () => {
      expect(motivosDe({ formato, numeroClubesEsperado: 1, linhas: cheia.slice(0, 2) })).toContain('numero-de-clubes-incorreto');
    });
    it('não afrouxa saldo nem finalizada sem placar', () => {
      expect(
        motivosDe({ formato, linhas: [linha({ sg: 99 })], partidas: [partida({ placar: null })] }),
      ).toEqual(expect.arrayContaining(['saldo-invalido', 'partida-finalizada-sem-placar']));
    });
  });

  describe('mata-mata', () => {
    it.each([
      ['vazia', [] as LinhaClassificacao[]],
      ['parcial', cheia.slice(0, 1)],
      ['duplicada', [cheia[0]!, cheia[0]!]],
      ['clube fora da config', [linha({ clubeId: 'vasco' })]],
    ])('tabela %s não é exigida', (_n, linhas) => {
      expect(motivosDe({ formato: 'mata-mata', linhas })).toEqual([]);
    });
    it('finalizada sem placar continua inconsistente', () => {
      expect(
        motivosDe({ formato: 'mata-mata', linhas: [], partidas: [partida({ placar: null })] }),
      ).toContain('partida-finalizada-sem-placar');
    });
  });
});

describe('verificarConsistenciaCompeticao com tabelaParcial (COB-40, ADR-024)', () => {
  const clubes = ['a', 'b', 'c', 'd'];
  const parcial = ['a', 'b'].map((clubeId) => linha({ clubeId }));
  const motivosDe = (p: Partial<EntradaVerificacaoConsistencia>) =>
    verificarConsistenciaCompeticao(
      entrada({ numeroClubesEsperado: 4, clubesConfigurados: clubes, ...p }),
    ).motivos;

  describe.each(['pontos-corridos', 'grupos'] as const)('%s', (formato) => {
    it('parcial marcada passa', () => {
      expect(motivosDe({ formato, linhas: parcial, tabelaParcial: true })).toEqual([]);
    });
    it('parcial sem marca continua reprovada', () => {
      expect(motivosDe({ formato, linhas: parcial })).toContain('numero-de-clubes-incorreto');
      expect(motivosDe({ formato, linhas: parcial, tabelaParcial: false })).toContain(
        'numero-de-clubes-incorreto',
      );
    });
    it('marcada: duplicata reprova', () => {
      expect(
        motivosDe({ formato, linhas: [parcial[0]!, parcial[0]!], tabelaParcial: true }),
      ).toContain('clube-duplicado');
    });
    it('marcada: clube fora da config reprova', () => {
      expect(
        motivosDe({ formato, linhas: [linha({ clubeId: 'x' })], tabelaParcial: true }),
      ).toContain('clube-fora-da-configuracao');
    });
    it('marcada: mais linhas que clubes reprova', () => {
      const muitas = ['a', 'b', 'c', 'd', 'e'].map((clubeId) => linha({ clubeId }));
      expect(motivosDe({ formato, linhas: muitas, tabelaParcial: true })).toContain(
        'numero-de-clubes-incorreto',
      );
    });
    it('marcada: pontos incoerentes reprovam', () => {
      expect(
        motivosDe({ formato, linhas: [linha({ clubeId: 'a', pontos: 99 })], tabelaParcial: true }),
      ).toContain('linha-aritmetica-invalida');
    });
  });
});
