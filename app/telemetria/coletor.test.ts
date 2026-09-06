// app/telemetria/coletor.test.ts — TEL-01 (TASK.md Lote 12)

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assinarColetor,
  limparEventosRegistrados,
  obterEventosRegistrados,
  registrarNoColetor,
} from './coletor';
import type { EventoTelemetria } from './eventos';

function criarEventoFake(): EventoTelemetria<'primeira_sessao'> {
  return {
    nome: 'primeira_sessao',
    timestampMs: 1_700_000_000_000,
    idAnonimo: 'id-fake',
    carga: undefined,
  };
}

describe('coletor (sumidouro local, sem SDK de terceiro — SPK-04 em aberto)', () => {
  beforeEach(() => {
    limparEventosRegistrados();
  });

  it('acumula eventos registrados', () => {
    const evento = criarEventoFake();
    registrarNoColetor(evento);

    expect(obterEventosRegistrados()).toEqual([evento]);
  });

  it('limpa o buffer', () => {
    registrarNoColetor(criarEventoFake());
    limparEventosRegistrados();

    expect(obterEventosRegistrados()).toEqual([]);
  });

  it('notifica assinantes a cada novo evento', () => {
    const ouvinte = vi.fn();
    const cancelar = assinarColetor(ouvinte);
    const evento = criarEventoFake();

    registrarNoColetor(evento);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(ouvinte).toHaveBeenCalledWith(evento);

    cancelar();
    registrarNoColetor(criarEventoFake());
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });
});
