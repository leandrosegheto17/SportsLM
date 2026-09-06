// dominio/campeonatos/derivador-status.test.ts — ING-F-03 (TASK.md Lote 5)
//
// Testes por tabela cobrindo CA-07.1 (5 status), CA-07.3 (eliminação com
// fase) e P8/ADR-006 ponto 6 (queda para `sem-dados` em ambiguidade).

import { describe, expect, it } from 'vitest';
import {
  derivarStatusCampeonato,
  type EntradaDerivadorStatus,
  type PartidaParaDerivacaoStatus,
} from './derivador-status';

const JANELA_2026 = {
  inicio: '2026-04-01T00:00:00-03:00',
  fim: '2026-11-30T23:59:59-03:00',
};
const AGORA_MEIO_DA_JANELA = new Date('2026-09-06T12:00:00-03:00');
const AGORA_ANTES_DA_JANELA = new Date('2026-01-15T12:00:00-03:00');
const AGORA_DEPOIS_DA_JANELA = new Date('2026-12-15T12:00:00-03:00');

function partida(p: Partial<PartidaParaDerivacaoStatus>): PartidaParaDerivacaoStatus {
  return {
    fase: null,
    dataHora: null,
    status: 'finalizada',
    placar: { mandante: 1, visitante: 0 },
    ...p,
  };
}

function entrada(p: Partial<EntradaDerivadorStatus>): EntradaDerivadorStatus {
  return {
    formato: 'pontos-corridos',
    janela: JANELA_2026,
    partidas: [],
    agora: AGORA_MEIO_DA_JANELA,
    ...p,
  };
}

describe('derivarStatusCampeonato (CA-07.1)', () => {
  it('nenhuma partida e competição ainda não começou → não-iniciado', () => {
    const resultado = derivarStatusCampeonato(
      entrada({ partidas: [], agora: AGORA_ANTES_DA_JANELA }),
    );
    expect(resultado).toEqual({ status: 'nao-iniciado', faseAtual: null });
  });

  it('há partida pendente → em-andamento, com a fase da próxima partida conhecida', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'grupos',
        partidas: [
          partida({
            status: 'finalizada',
            fase: 'Fase de grupos',
            dataHora: '2026-05-01T20:00:00-03:00',
          }),
          partida({
            status: 'agendada',
            fase: 'Fase de grupos',
            dataHora: '2026-09-20T20:00:00-03:00',
            placar: null,
          }),
          partida({
            status: 'aguardando-resultado',
            fase: 'Fase de grupos',
            dataHora: '2026-09-13T20:00:00-03:00',
            placar: null,
          }),
        ],
      }),
    );
    expect(resultado).toEqual({ status: 'em-andamento', faseAtual: 'Fase de grupos' });
  });

  it('partida "adiada" conta como pendente (pode ainda acontecer) → em-andamento', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'mata-mata',
        partidas: [
          partida({ status: 'adiada', fase: 'Oitavas', dataHora: null, placar: null }),
        ],
      }),
    );
    expect(resultado).toEqual({ status: 'em-andamento', faseAtual: 'Oitavas' });
  });

  it('mata-mata sem partida futura, competição ainda ativa → eliminado na fase (CA-07.3)', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'mata-mata',
        agora: AGORA_MEIO_DA_JANELA,
        partidas: [
          partida({ fase: 'Oitavas', dataHora: '2026-06-01T20:00:00-03:00' }),
          partida({ fase: 'Quartas', dataHora: '2026-08-01T20:00:00-03:00' }),
        ],
      }),
    );
    expect(resultado).toEqual({ status: 'eliminado', faseAtual: 'Quartas' });
  });

  it('misto/grupos sem partida futura, competição ativa, também elimina', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'misto',
        partidas: [
          partida({ fase: 'Fase de grupos', dataHora: '2026-05-01T20:00:00-03:00' }),
        ],
      }),
    );
    expect(resultado.status).toBe('eliminado');
  });

  it('pontos-corridos nunca elimina: mesma situação vira sem-dados (ambíguo)', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'pontos-corridos',
        agora: AGORA_MEIO_DA_JANELA,
        partidas: [partida({ fase: null, dataHora: '2026-05-01T20:00:00-03:00' })],
      }),
    );
    expect(resultado).toEqual({ status: 'sem-dados', faseAtual: null });
  });

  it('sem partida pendente e competição já encerrada (janela.fim passou) → concluído', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'mata-mata',
        agora: AGORA_DEPOIS_DA_JANELA,
        partidas: [partida({ fase: 'Final', dataHora: '2026-11-20T20:00:00-03:00' })],
      }),
    );
    expect(resultado).toEqual({ status: 'concluido', faseAtual: null });
  });

  it('pontos-corridos com todas finalizadas e janela encerrada → concluído', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'pontos-corridos',
        agora: AGORA_DEPOIS_DA_JANELA,
        partidas: [partida({ dataHora: '2026-11-10T20:00:00-03:00' })],
      }),
    );
    expect(resultado).toEqual({ status: 'concluido', faseAtual: null });
  });

  it('nenhuma partida e competição já deveria ter começado → sem-dados (ambíguo, P8)', () => {
    const resultado = derivarStatusCampeonato(
      entrada({ partidas: [], agora: AGORA_MEIO_DA_JANELA }),
    );
    expect(resultado).toEqual({ status: 'sem-dados', faseAtual: null });
  });
});

describe('derivarStatusCampeonato — quedas para sem-dados em ambiguidade (P8/ADR-006 ponto 6)', () => {
  it('partida "finalizada" sem placar (dado inconsistente) → sem-dados', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'mata-mata',
        partidas: [partida({ status: 'finalizada', placar: null })],
      }),
    );
    expect(resultado).toEqual({ status: 'sem-dados', faseAtual: null });
  });

  it('duas finalizadas sem nenhuma data conhecida e fases diferentes → fase de eliminação ambígua, sem-dados', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'mata-mata',
        partidas: [
          partida({ fase: 'Oitavas', dataHora: null }),
          partida({ fase: 'Quartas', dataHora: null }),
        ],
      }),
    );
    expect(resultado).toEqual({ status: 'sem-dados', faseAtual: null });
  });

  it('duas finalizadas sem data conhecida mas com a MESMA fase não é ambíguo → eliminado', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'mata-mata',
        partidas: [
          partida({ fase: 'Quartas', dataHora: null }),
          partida({ fase: 'Quartas', dataHora: null }),
        ],
      }),
    );
    expect(resultado).toEqual({ status: 'eliminado', faseAtual: 'Quartas' });
  });

  it('empate exato de horário entre finalizadas de fases diferentes → ambíguo, sem-dados', () => {
    const mesmoHorario = '2026-08-01T20:00:00-03:00';
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'mata-mata',
        partidas: [
          partida({ fase: 'Oitavas', dataHora: mesmoHorario }),
          partida({ fase: 'Quartas', dataHora: mesmoHorario }),
        ],
      }),
    );
    expect(resultado).toEqual({ status: 'sem-dados', faseAtual: null });
  });

  it('janela com data inválida → sem-dados', () => {
    const resultado = derivarStatusCampeonato(
      entrada({ janela: { inicio: 'data-invalida', fim: JANELA_2026.fim } }),
    );
    expect(resultado).toEqual({ status: 'sem-dados', faseAtual: null });
  });

  it('cancelada nunca conta como pendente nem como finalizada — só ela → tratada como nenhuma partida', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        partidas: [partida({ status: 'cancelada', placar: null })],
        agora: AGORA_ANTES_DA_JANELA,
      }),
    );
    expect(resultado).toEqual({ status: 'nao-iniciado', faseAtual: null });
  });

  it('pendente com fase divergente e sem data conhecida → em-andamento, mas fase null (sem palpite)', () => {
    const resultado = derivarStatusCampeonato(
      entrada({
        formato: 'grupos',
        partidas: [
          partida({ status: 'agendada', fase: 'Grupo A', dataHora: null, placar: null }),
          partida({ status: 'agendada', fase: 'Grupo B', dataHora: null, placar: null }),
        ],
      }),
    );
    expect(resultado).toEqual({ status: 'em-andamento', faseAtual: null });
  });

  it('é uma função pura: não muta a lista de partidas recebida', () => {
    const partidas = [
      partida({ fase: 'Quartas', dataHora: '2026-08-01T20:00:00-03:00' }),
    ];
    const copia = [...partidas];
    derivarStatusCampeonato(entrada({ formato: 'mata-mata', partidas }));
    expect(partidas).toEqual(copia);
  });
});
