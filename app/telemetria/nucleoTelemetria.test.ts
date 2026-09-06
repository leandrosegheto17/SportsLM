// app/telemetria/nucleoTelemetria.test.ts — TEL-01 (TASK.md Lote 12)
//
// Confirma o critério de aceite "nenhum evento contém conteúdo ou
// preferência": cada evento produzido só tem exatamente as 4 chaves de
// `EventoTelemetria` (nome/timestampMs/idAnonimo/carga), e a carga só tem as
// chaves autorizadas pela tabela do ADR-012 — nunca favoritos, fontes, time,
// URL ou palpite.

import { beforeEach, describe, expect, it } from 'vitest';
import { limparEventosRegistrados, obterEventosRegistrados } from './coletor';
import {
  registrarComparativoAbertoNoNucleo,
  registrarPersonalizacaoConcluidaNoNucleo,
  registrarPrimeiraInteracaoUtilNoNucleo,
  registrarPrimeiraSessaoNoNucleo,
  registrarRetornoNoNucleo,
} from './nucleoTelemetria';

const CHAVES_EVENTO = ['nome', 'timestampMs', 'idAnonimo', 'carga'].sort();

beforeEach(() => {
  limparEventosRegistrados();
});

describe('nucleoTelemetria (ADR-012 — os 5 eventos de RNF-07)', () => {
  it('primeira_sessao: sem carga além do comum', () => {
    registrarPrimeiraSessaoNoNucleo();
    const [evento] = obterEventosRegistrados();

    expect(Object.keys(evento!).sort()).toEqual(CHAVES_EVENTO);
    expect(evento!.nome).toBe('primeira_sessao');
    expect(evento!.carga).toBeUndefined();
    expect(typeof evento!.timestampMs).toBe('number');
    expect(typeof evento!.idAnonimo).toBe('string');
  });

  it('retorno: carga é só a quantidade de dias', () => {
    registrarRetornoNoNucleo(7);
    const [evento] = obterEventosRegistrados();

    expect(Object.keys(evento!).sort()).toEqual(CHAVES_EVENTO);
    expect(Object.keys(evento!.carga as object)).toEqual(['diasDesdePrimeiraSessao']);
    expect(evento!.carga).toEqual({ diasDesdePrimeiraSessao: 7 });
  });

  it('personalizacao_concluida: carga é só contagem de favoritos e se há time, nunca a lista de favoritos nem o id do time', () => {
    registrarPersonalizacaoConcluidaNoNucleo(3, true);
    const [evento] = obterEventosRegistrados();

    expect(Object.keys(evento!.carga as object).sort()).toEqual(
      ['quantidadeFavoritos', 'temTimeDefinido'].sort(),
    );
    expect(evento!.carga).toEqual({ quantidadeFavoritos: 3, temTimeDefinido: true });
  });

  it('primeira_interacao_util: carga é só o tempo decorrido, nunca qual notícia/painel', () => {
    registrarPrimeiraInteracaoUtilNoNucleo(4200);
    const [evento] = obterEventosRegistrados();

    expect(Object.keys(evento!.carga as object)).toEqual(['milissegundosAteInteracao']);
    expect(evento!.carga).toEqual({ milissegundosAteInteracao: 4200 });
  });

  it('comparativo_aberto: carga é só qual das duas rotas, nunca o conteúdo do palpite', () => {
    registrarComparativoAbertoNoNucleo('simulacao');
    const [evento] = obterEventosRegistrados();

    expect(Object.keys(evento!.carga as object)).toEqual(['rota']);
    expect(evento!.carga).toEqual({ rota: 'simulacao' });
  });

  it('nenhum dos 5 eventos carrega o identificador anônimo em outro formato que não string opaca', () => {
    registrarPrimeiraSessaoNoNucleo();
    registrarRetornoNoNucleo(1);
    registrarPersonalizacaoConcluidaNoNucleo(1, false);
    registrarPrimeiraInteracaoUtilNoNucleo(1);
    registrarComparativoAbertoNoNucleo('comparativo');

    const eventos = obterEventosRegistrados();
    expect(eventos).toHaveLength(5);
    for (const evento of eventos) {
      expect(Object.keys(evento).sort()).toEqual(CHAVES_EVENTO);
      expect(typeof evento.idAnonimo).toBe('string');
    }
  });
});
