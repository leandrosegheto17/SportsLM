// pipeline/futebol/coletor-futebol.test.ts — ING-F-02 (TASK.md Lote 5)
//
// Cobre o critério de aceite da tarefa: priorização de CA-16.4/ADR-002 e
// suspensão por cota esgotada (proativa e reativa), além dos demais estados
// (fora-da-janela, sem-cobertura, provedor-não-registrado, falha comum) que a
// orquestração precisa distinguir para ING-F-05/CA-16.1/16.3.
//
// Provedor de teste é um mock genérico (não `adaptador-football-data`) —
// prova que o coletor não depende de nenhum provedor específico (nota de
// decisão no cabeçalho de `coletor-futebol.ts`).

import { describe, expect, it, vi } from 'vitest';
import {
  coletarFutebol,
  registrarProvedor,
  type ProvedorFutebolPort,
  type ProvedorRegistrado,
} from './coletor-futebol';
import type { CampeonatoConfig } from '../../config/campeonatos.schema';

interface RefTeste {
  codigo: string;
}

function campeonato(sobrescritas: Partial<CampeonatoConfig>): CampeonatoConfig {
  return {
    id: 'campeonato-teste',
    nome: 'Campeonato de Teste',
    temporada: 2026,
    categoria: 'estadual',
    formato: 'grupos',
    janela: { inicio: '2026-01-01', fim: '2026-12-31' },
    provedor: 'provedor-teste',
    clubes: ['flamengo'],
    ...sobrescritas,
  };
}

function criarProvedorMock(
  opcoes: {
    orcamento?: { porMinuto?: number; porDia?: number };
    obterClassificacao?: ProvedorFutebolPort<RefTeste>['obterClassificacao'];
    obterPartidas?: ProvedorFutebolPort<RefTeste>['obterPartidas'];
  } = {},
): {
  registro: ProvedorRegistrado;
  construirReferencia: ReturnType<typeof vi.fn>;
  obterClassificacao: ReturnType<typeof vi.fn>;
  obterPartidas: ReturnType<typeof vi.fn>;
} {
  const obterClassificacao =
    opcoes.obterClassificacao ?? vi.fn(async () => ({ linhas: [], inconsistencias: [] }));
  const obterPartidas =
    opcoes.obterPartidas ?? vi.fn(async () => ({ partidas: [], inconsistencias: [] }));

  const adaptador: ProvedorFutebolPort<RefTeste> = {
    id: 'provedor-teste-interno',
    orcamento: opcoes.orcamento ?? {},
    obterClassificacao,
    obterPartidas,
  };

  const construirReferencia = vi.fn(
    (c: CampeonatoConfig): RefTeste => ({ codigo: c.id }),
  );

  return {
    registro: registrarProvedor(adaptador, construirReferencia),
    construirReferencia,
    obterClassificacao: obterClassificacao as unknown as ReturnType<typeof vi.fn>,
    obterPartidas: obterPartidas as unknown as ReturnType<typeof vi.fn>,
  };
}

describe('coletarFutebol — prioridade (CA-16.4/ADR-002)', () => {
  it('processa na ordem brasileirao > continental > copa-do-brasil > estadual/regional > supercopa, preservando ordem original nos empates', async () => {
    const { registro } = criarProvedorMock();
    const campeonatos: CampeonatoConfig[] = [
      campeonato({ id: 'supercopa', categoria: 'supercopa' }),
      campeonato({ id: 'estadual-b', categoria: 'estadual' }),
      campeonato({ id: 'copa-do-brasil', categoria: 'copa-do-brasil' }),
      campeonato({ id: 'regional-a', categoria: 'regional' }),
      campeonato({ id: 'continental', categoria: 'continental' }),
      campeonato({ id: 'brasileirao', categoria: 'brasileirao' }),
      campeonato({ id: 'estadual-a', categoria: 'estadual' }),
    ];

    const resultado = await coletarFutebol({
      campeonatos,
      agora: new Date('2026-06-01T00:00:00Z'),
      provedores: { 'provedor-teste': registro },
    });

    expect(resultado.resultados.map((r) => r.competicaoId)).toEqual([
      'brasileirao',
      'continental',
      'copa-do-brasil',
      'estadual-b',
      'regional-a',
      'estadual-a',
      'supercopa',
    ]);
    expect(resultado.resultados.every((r) => r.tipo === 'atualizada')).toBe(true);
  });
});

describe('coletarFutebol — janela de calendário e cobertura', () => {
  it('fora da janela não chama o provedor (não consome requisição, ADR-002)', async () => {
    const { registro, obterClassificacao } = criarProvedorMock();
    const campeonatos = [
      campeonato({
        id: 'fora-da-janela',
        janela: { inicio: '2026-01-01', fim: '2026-02-01' },
      }),
    ];

    const resultado = await coletarFutebol({
      campeonatos,
      agora: new Date('2026-06-01T00:00:00Z'),
      provedores: { 'provedor-teste': registro },
    });

    expect(resultado.resultados).toEqual([
      { competicaoId: 'fora-da-janela', categoria: 'estadual', tipo: 'fora-da-janela' },
    ]);
    expect(obterClassificacao).not.toHaveBeenCalled();
    expect(resultado.requisicoesUsadas).toEqual({});
  });

  it('provedor null vira sem-cobertura (CA-16.5/CA-07.2)', async () => {
    const campeonatos = [campeonato({ id: 'sem-cobertura', provedor: null })];

    const resultado = await coletarFutebol({
      campeonatos,
      agora: new Date('2026-06-01T00:00:00Z'),
      provedores: {},
    });

    expect(resultado.resultados).toEqual([
      { competicaoId: 'sem-cobertura', categoria: 'estadual', tipo: 'sem-cobertura' },
    ]);
  });

  it('provedor referenciado mas não registrado nesta execução vira provedor-nao-registrado (extensibilidade SPK-01)', async () => {
    const campeonatos = [
      campeonato({ id: 'provedor-futuro', provedor: 'provedor-que-nao-existe-ainda' }),
    ];

    const resultado = await coletarFutebol({
      campeonatos,
      agora: new Date('2026-06-01T00:00:00Z'),
      provedores: {},
    });

    expect(resultado.resultados).toEqual([
      {
        competicaoId: 'provedor-futuro',
        categoria: 'estadual',
        tipo: 'provedor-nao-registrado',
        provedorId: 'provedor-que-nao-existe-ainda',
      },
    ]);
  });
});

describe('coletarFutebol — sucesso e falha comum (CA-16.3)', () => {
  it('sucesso: chama obterClassificacao/obterPartidas com a referência construída e conta 2 requisições', async () => {
    const { registro, construirReferencia, obterClassificacao, obterPartidas } =
      criarProvedorMock();
    const campeonatos = [
      campeonato({ id: 'brasileirao-serie-a', categoria: 'brasileirao' }),
    ];

    const resultado = await coletarFutebol({
      campeonatos,
      agora: new Date('2026-06-01T00:00:00Z'),
      provedores: { 'provedor-teste': registro },
    });

    expect(construirReferencia).toHaveBeenCalledWith(campeonatos[0]);
    expect(obterClassificacao).toHaveBeenCalledWith({
      codigo: 'brasileirao-serie-a',
    });
    expect(obterPartidas).toHaveBeenCalledWith({
      codigo: 'brasileirao-serie-a',
    });
    expect(resultado.resultados[0]?.tipo).toBe('atualizada');
    expect(resultado.requisicoesUsadas['provedor-teste']).toBe(2);
  });

  it('falha comum (não é cota esgotada) vira "falha" e não interrompe as próximas competições', async () => {
    const obterClassificacao = vi
      .fn()
      .mockRejectedValueOnce(new Error('provedor respondeu HTTP 500'))
      .mockResolvedValue({ linhas: [], inconsistencias: [] });
    const { registro } = criarProvedorMock({ obterClassificacao });
    const campeonatos = [
      campeonato({ id: 'primeira', categoria: 'brasileirao' }),
      campeonato({ id: 'segunda', categoria: 'continental' }),
    ];

    const resultado = await coletarFutebol({
      campeonatos,
      agora: new Date('2026-06-01T00:00:00Z'),
      provedores: { 'provedor-teste': registro },
    });

    expect(resultado.resultados[0]).toEqual({
      competicaoId: 'primeira',
      categoria: 'brasileirao',
      tipo: 'falha',
      mensagemErro: 'provedor respondeu HTTP 500',
    });
    expect(resultado.resultados[1]?.tipo).toBe('atualizada');
    expect(resultado.provedoresPausadosPorCota).toEqual([]);
  });
});

describe('coletarFutebol — suspensão por cota esgotada (CA-16.4)', () => {
  it('reativa: HTTP 429 do provedor suspende as competições seguintes do mesmo provedor sem nova chamada', async () => {
    const obterClassificacao = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('football-data respondeu HTTP 429 (classificação, BSA)'),
      )
      .mockResolvedValue({ linhas: [], inconsistencias: [] });
    const { registro, obterPartidas } = criarProvedorMock({ obterClassificacao });
    const campeonatos = [
      campeonato({ id: 'brasileirao-serie-a', categoria: 'brasileirao' }),
      campeonato({ id: 'copa-do-brasil', categoria: 'copa-do-brasil' }),
      campeonato({ id: 'paulista', categoria: 'estadual' }),
    ];

    const resultado = await coletarFutebol({
      campeonatos,
      agora: new Date('2026-06-01T00:00:00Z'),
      provedores: { 'provedor-teste': registro },
    });

    expect(resultado.resultados.map((r) => r.tipo)).toEqual([
      'pausado-por-cota',
      'pausado-por-cota',
      'pausado-por-cota',
    ]);
    expect(resultado.provedoresPausadosPorCota).toEqual(['provedor-teste']);
    // só a 1ª competição realmente chamou o provedor — as demais foram suspensas antes de tentar
    expect(obterClassificacao).toHaveBeenCalledTimes(1);
    expect(obterPartidas).not.toHaveBeenCalled();
  });

  it('proativa: teto de requisições da execução impede nova chamada antes mesmo de tentar (sem depender de erro do provedor)', async () => {
    const { registro, obterClassificacao } = criarProvedorMock();
    const campeonatos = [
      campeonato({ id: 'brasileirao-serie-a', categoria: 'brasileirao' }),
      campeonato({ id: 'continental', categoria: 'continental' }),
    ];

    const resultado = await coletarFutebol({
      campeonatos,
      agora: new Date('2026-06-01T00:00:00Z'),
      provedores: { 'provedor-teste': registro },
      // 1ª competição já consome as 2 requisições disponíveis; a 2ª não cabe mais.
      limitesPorExecucao: { 'provedor-teste': 2 },
    });

    expect(resultado.resultados[0]?.tipo).toBe('atualizada');
    expect(resultado.resultados[1]).toEqual({
      competicaoId: 'continental',
      categoria: 'continental',
      tipo: 'pausado-por-cota',
    });
    expect(resultado.provedoresPausadosPorCota).toEqual(['provedor-teste']);
    expect(obterClassificacao).toHaveBeenCalledTimes(1);
  });

  it('proativa: usa orcamento.porMinuto do próprio adaptador quando limitesPorExecucao não é informado', async () => {
    const { registro } = criarProvedorMock({ orcamento: { porMinuto: 2 } });
    const campeonatos = [
      campeonato({ id: 'brasileirao-serie-a', categoria: 'brasileirao' }),
      campeonato({ id: 'continental', categoria: 'continental' }),
    ];

    const resultado = await coletarFutebol({
      campeonatos,
      agora: new Date('2026-06-01T00:00:00Z'),
      provedores: { 'provedor-teste': registro },
    });

    expect(resultado.resultados[0]?.tipo).toBe('atualizada');
    expect(resultado.resultados[1]?.tipo).toBe('pausado-por-cota');
  });

  it('sem teto configurado nem orcamento.porMinuto, o coletor não impõe suspensão proativa', async () => {
    const { registro } = criarProvedorMock();
    const campeonatos = [
      campeonato({ id: 'brasileirao-serie-a', categoria: 'brasileirao' }),
      campeonato({ id: 'continental', categoria: 'continental' }),
      campeonato({ id: 'copa-do-brasil', categoria: 'copa-do-brasil' }),
    ];

    const resultado = await coletarFutebol({
      campeonatos,
      agora: new Date('2026-06-01T00:00:00Z'),
      provedores: { 'provedor-teste': registro },
    });

    expect(resultado.resultados.every((r) => r.tipo === 'atualizada')).toBe(true);
    expect(resultado.requisicoesUsadas['provedor-teste']).toBe(6);
  });
});

describe('coletarFutebol — RN-22 faixas e custo declarado (COB-12, ADR-021)', () => {
  const agora = new Date('2026-06-01T12:00:00Z');

  it('faixa 1 (jogo em <=48h) antes da faixa 2; faixa 3 (fora da janela) por ultimo e sem requisicao', async () => {
    const { registro, obterClassificacao } = criarProvedorMock();
    const campeonatos = [
      campeonato({
        id: 'fora',
        categoria: 'brasileirao',
        janela: { inicio: '2027-01-01', fim: '2027-02-01' },
      }),
      campeonato({ id: 'supercopa-com-jogo', categoria: 'supercopa' }),
      campeonato({ id: 'brasileirao-sem-jogo', categoria: 'brasileirao' }),
      campeonato({ id: 'estadual-com-jogo', categoria: 'estadual' }),
      campeonato({ id: 'estadual-jogo-longe', categoria: 'estadual' }),
    ];
    const r = await coletarFutebol({
      campeonatos,
      agora,
      provedores: { 'provedor-teste': registro },
      proximoJogoPorCompeticao: {
        'supercopa-com-jogo': '2026-06-03T12:00:00Z',
        'estadual-com-jogo': '2026-06-02T00:00:00Z',
        'estadual-jogo-longe': '2026-06-03T12:00:01Z',
        'brasileirao-sem-jogo': null,
      },
    });
    expect(r.resultados.map((x) => x.competicaoId)).toEqual([
      'estadual-com-jogo',
      'supercopa-com-jogo',
      'brasileirao-sem-jogo',
      'estadual-jogo-longe',
      'fora',
    ]);
    expect(obterClassificacao).toHaveBeenCalledTimes(4);
  });

  it('usa custoEstimado no teto proativo e pausa a liga de menor prioridade', async () => {
    const adaptador: ProvedorFutebolPort<RefTeste> = {
      id: 'x',
      orcamento: { porMinuto: 6 },
      custoEstimado: () => 3,
      obterClassificacao: vi.fn(async () => ({ linhas: [], inconsistencias: [] })),
      obterPartidas: vi.fn(async () => ({ partidas: [], inconsistencias: [] })),
    };
    const registro = registrarProvedor(adaptador, (c) => ({ codigo: c.id }));
    const r = await coletarFutebol({
      campeonatos: [
        campeonato({ id: 'supercopa', categoria: 'supercopa' }),
        campeonato({ id: 'br', categoria: 'brasileirao' }),
        campeonato({ id: 'estadual', categoria: 'estadual' }),
      ],
      agora,
      provedores: { 'provedor-teste': registro },
    });
    expect(r.resultados.map((x) => [x.competicaoId, x.tipo])).toEqual([
      ['br', 'atualizada'],
      ['estadual', 'atualizada'],
      ['supercopa', 'pausado-por-cota'],
    ]);
    expect(r.provedoresPausadosPorCota).toEqual(['provedor-teste']);
  });

  describe('teto por execucao porExecucao (COB-36, ADR-022)', () => {
    function reg(orcamento: { porMinuto?: number; porExecucao?: number }) {
      const adaptador: ProvedorFutebolPort<RefTeste> = {
        id: 'x',
        orcamento,
        custoEstimado: () => 8,
        obterClassificacao: vi.fn(async () => ({ linhas: [], inconsistencias: [] })),
        obterPartidas: vi.fn(async () => ({ partidas: [], inconsistencias: [] })),
      };
      return registrarProvedor(adaptador, (c) => ({ codigo: c.id }));
    }
    const ligas = () => [
      ...Array.from({ length: 7 }, (_, n) => campeonato({ id: `e${n}`, categoria: 'estadual' })),
      campeonato({ id: 'supercopa', categoria: 'supercopa' }),
    ];

    it('usa porExecucao (60), nao porMinuto (30): 7 ligas custo 8 cabem, a de menor prioridade pausa', async () => {
      const r = await coletarFutebol({
        campeonatos: ligas(),
        agora,
        provedores: { 'provedor-teste': reg({ porMinuto: 30, porExecucao: 60 }) },
      });
      expect(r.resultados.filter((x) => x.tipo === 'atualizada')).toHaveLength(7);
      expect(r.resultados[7]).toMatchObject({ competicaoId: 'supercopa', tipo: 'pausado-por-cota' });
    });

    it('sem porExecucao mantem porMinuto como teto', async () => {
      const r = await coletarFutebol({
        campeonatos: ligas(),
        agora,
        provedores: { 'provedor-teste': reg({ porMinuto: 30 }) },
      });
      expect(r.resultados.filter((x) => x.tipo === 'atualizada')).toHaveLength(3);
    });
  });

  it('429 suspende o provedor e as ligas seguintes', async () => {
    const { registro } = criarProvedorMock({
      obterClassificacao: vi.fn(async () => {
        throw new Error('HTTP 429');
      }),
    });
    const r = await coletarFutebol({
      campeonatos: [
        campeonato({ id: 'a', categoria: 'brasileirao' }),
        campeonato({ id: 'b', categoria: 'estadual' }),
      ],
      agora,
      provedores: { 'provedor-teste': registro },
    });
    expect(r.resultados.map((x) => x.tipo)).toEqual([
      'pausado-por-cota',
      'pausado-por-cota',
    ]);
  });
});
