// @vitest-environment jsdom
// app/rotas/sobreposicoes/Configuracoes/SecaoPrivacidade.test.tsx —
// UI-T03-02 (TASK.md Lote 9)
//
// Texto canônico (RNF-07/UX-SPEC §3/T-03), "Ver quais" revela os 5 eventos
// (RNF-07/ADR-012 regra 1) e "Desativar e apagar id" limpa
// `sportslm.anonimo.v1` (ADR-012 regra 2).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CHAVE_ARMAZENAMENTO_ANONIMO } from '../../../armazenamento/telemetriaId';
import {
  EVENTOS_TELEMETRIA_RNF07,
  SecaoPrivacidade,
  TEXTO_CONFIRMACAO_ID_APAGADO,
  TEXTO_PRIVACIDADE,
} from './SecaoPrivacidade';

class ArmazenamentoFalso implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private mapa = new Map<string, string>();
  getItem(chave: string): string | null {
    return this.mapa.has(chave) ? (this.mapa.get(chave) as string) : null;
  }
  setItem(chave: string, valor: string): void {
    this.mapa.set(chave, valor);
  }
  removeItem(chave: string): void {
    this.mapa.delete(chave);
  }
}

afterEach(() => {
  cleanup();
});

describe('SecaoPrivacidade (UI-T03-02)', () => {
  it('mostra o texto canônico de privacidade (RNF-07)', () => {
    render(<SecaoPrivacidade />);
    expect(screen.getByText(TEXTO_PRIVACIDADE)).toBeTruthy();
  });

  it('"Ver quais" revela os 5 eventos de RNF-07/ADR-012, sem inventar nenhum', () => {
    render(<SecaoPrivacidade />);

    expect(screen.queryByText('primeira sessão')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ver quais' }));

    for (const evento of EVENTOS_TELEMETRIA_RNF07) {
      expect(screen.getByText(evento)).toBeTruthy();
    }
    expect(EVENTOS_TELEMETRIA_RNF07).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(screen.queryByText('primeira sessão')).toBeNull();
  });

  it('"Desativar e apagar id" apaga sportslm.anonimo.v1 (ADR-012) e confirma', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(CHAVE_ARMAZENAMENTO_ANONIMO, 'algum-uuid-fake');

    render(<SecaoPrivacidade armazenamento={armazenamento} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desativar e apagar id' }));

    expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_ANONIMO)).toBeNull();
    expect(screen.getByText(TEXTO_CONFIRMACAO_ID_APAGADO)).toBeTruthy();
  });

  it('não lança quando a chave de telemetria nunca existiu (antes de TEL-01)', () => {
    const armazenamento = new ArmazenamentoFalso();
    render(<SecaoPrivacidade armazenamento={armazenamento} />);

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Desativar e apagar id' }));
    }).not.toThrow();
    expect(screen.getByText(TEXTO_CONFIRMACAO_ID_APAGADO)).toBeTruthy();
  });
});
