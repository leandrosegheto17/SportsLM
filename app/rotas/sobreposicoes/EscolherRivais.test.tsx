// @vitest-environment jsdom
// app/rotas/sobreposicoes/EscolherRivais.test.tsx — UI-T07-01 (TASK.md Lote 11)
//
// Cobre T-07 (UX-SPEC §2/§4/T-07): time do coração nunca aparece (CA-09.1),
// adicionar até 2 (CA-09.2), impedir um 3º com aviso (CA-09.3), remover com
// confirmação de palpites descartados quando há cenário salvo (CA-09.4). O
// comportamento comum de sobreposição (Esc/toque fora/foco/foco-trap) já é
// coberto por `Sobreposicao.test.tsx` (UI-DS-07A) — não duplicado aqui.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EscolherRivais,
  TEXTO_ERRO_CATALOGO_ESCOLHER_RIVAIS,
  TEXTO_LIMITE_ATINGIDO,
} from './EscolherRivais';
import { CHAVE_ARMAZENAMENTO_PREFERENCIAS } from '../../armazenamento/preferencias';
import { CHAVE_ARMAZENAMENTO_CENARIO } from '../../armazenamento/cenario';
import type { CatalogoOnboarding } from '../paginas/Onboarding/catalogoOnboarding';
import type { Cenario, Preferencias } from '../../../dominio/tipos';

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

function catalogoFake(): CatalogoOnboarding {
  return {
    esportes: [],
    clubes: [
      { id: 'sao-paulo', nomeCurto: 'São Paulo', sigla: 'SPA', corBase: '#E30613' },
      { id: 'santos', nomeCurto: 'Santos', sigla: 'SAN', corBase: '#000000' },
      { id: 'palmeiras', nomeCurto: 'Palmeiras', sigla: 'PAL', corBase: '#006437' },
      { id: 'corinthians', nomeCurto: 'Corinthians', sigla: 'COR', corBase: '#000000' },
    ],
    referencias: {
      esportesValidos: new Set(['futebol']),
      fontesValidas: new Set(['fonte-x']),
      clubesValidos: new Set(['sao-paulo', 'santos', 'palmeiras', 'corinthians']),
    },
    temporadaAtual: 2026,
  };
}

function preferenciasDeExemplo(sobrescritas: Partial<Preferencias> = {}): Preferencias {
  return {
    versaoEsquema: 1,
    temporada: 2026,
    favoritos: ['futebol'],
    fontesBloqueadas: ['fonte-x'],
    timeId: 'sao-paulo',
    rivais: [],
    atualizadoEm: '2026-09-01T00:00:00.000Z',
    ...sobrescritas,
  };
}

function cenarioDeExemplo(escopo: string): Cenario {
  return {
    versaoEsquema: 1,
    escopo,
    palpites: { 'partida-1': 'vitoria' },
    partidasTravadasVistas: [],
  };
}

function renderizar(
  armazenamento: ArmazenamentoFalso,
  opcoes: {
    carregarCatalogo?: () => CatalogoOnboarding | null;
    aoFechar?: () => void;
  } = {},
) {
  const aoFechar = opcoes.aoFechar ?? vi.fn();
  render(
    <EscolherRivais
      aberta
      aoFechar={aoFechar}
      armazenamento={armazenamento}
      carregarCatalogo={opcoes.carregarCatalogo ?? catalogoFake}
    />,
  );
  return { aoFechar };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EscolherRivais — CA-09.1 (lista + busca, sem o time do coração)', () => {
  it('lista os outros clubes, filtra pela busca e nunca mostra o time do coração', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo()),
    );
    renderizar(armazenamento);

    expect(screen.getByText('Santos')).toBeTruthy();
    expect(screen.getByText('Palmeiras')).toBeTruthy();
    expect(screen.getByText('Corinthians')).toBeTruthy();
    expect(screen.queryByText('São Paulo')).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar clube' }), {
      target: { value: 'san' },
    });

    expect(screen.getByText('Santos')).toBeTruthy();
    expect(screen.queryByText('Palmeiras')).toBeNull();
  });
});

describe('EscolherRivais — estado Erro', () => {
  it('mostra o texto canônico e permite tentar de novo', () => {
    const armazenamento = new ArmazenamentoFalso();
    const carregarCatalogo = vi.fn(() => null);
    renderizar(armazenamento, { carregarCatalogo });

    expect(screen.getByText(TEXTO_ERRO_CATALOGO_ESCOLHER_RIVAIS)).toBeTruthy();
    expect(carregarCatalogo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(carregarCatalogo).toHaveBeenCalledTimes(2);
  });
});

describe('EscolherRivais — estado Vazio', () => {
  it('mostra o texto canônico interpolando o nome do time do coração', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo()),
    );
    renderizar(armazenamento);

    expect(
      screen.getByText('Escolha até 2 clubes da Série A para comparar com o São Paulo.'),
    ).toBeTruthy();
  });
});

describe('EscolherRivais — CA-09.2 (adicionar até 2 e persistir)', () => {
  it('adiciona rivais e persiste ao confirmar', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo()),
    );
    const { aoFechar } = renderizar(armazenamento);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Santos' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Palmeiras' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar rivais' }));

    const salvo = JSON.parse(
      armazenamento.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS) as string,
    ) as Preferencias;
    expect(salvo.rivais).toEqual(['santos', 'palmeiras']);
    expect(salvo.timeId).toBe('sao-paulo');
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});

describe('EscolherRivais — CA-09.3 (limite de 2)', () => {
  it('impede um 3º rival e mostra o aviso canônico', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo({ rivais: ['santos', 'palmeiras'] })),
    );
    renderizar(armazenamento);

    expect(screen.queryByText(TEXTO_LIMITE_ATINGIDO)).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Corinthians' }));

    expect(screen.getByText(TEXTO_LIMITE_ATINGIDO)).toBeTruthy();
    expect(
      (screen.getByRole('checkbox', { name: 'Corinthians' }) as HTMLInputElement).checked,
    ).toBe(false);
  });
});

describe('EscolherRivais — CA-09.4 (remoção com palpites)', () => {
  it('remove direto quando não há cenário salvo (nada a perder)', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo({ rivais: ['santos'] })),
    );
    renderizar(armazenamento);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Santos' }));

    expect(
      screen.queryByText('Remover Santos? Os palpites dele na simulação serão apagados.'),
    ).toBeNull();
    expect(
      (screen.getByRole('checkbox', { name: 'Santos' }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('pede confirmação em linha ao remover um rival com cenário salvo, e cancela sem alterar nada', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo({ rivais: ['santos', 'palmeiras'] })),
    );
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_CENARIO,
      JSON.stringify(cenarioDeExemplo('2026:sao-paulo:palmeiras,santos')),
    );
    renderizar(armazenamento);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Santos' }));

    expect(
      screen.getByText('Remover Santos? Os palpites dele na simulação serão apagados.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      (screen.getByRole('checkbox', { name: 'Santos' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_CENARIO)).not.toBeNull();
  });

  it('ao confirmar a remoção e "Confirmar rivais", remove o rival e apaga o cenário salvo', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo({ rivais: ['santos', 'palmeiras'] })),
    );
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_CENARIO,
      JSON.stringify(cenarioDeExemplo('2026:sao-paulo:palmeiras,santos')),
    );
    const { aoFechar } = renderizar(armazenamento);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Santos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

    expect(
      (screen.getByRole('checkbox', { name: 'Santos' }) as HTMLInputElement).checked,
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar rivais' }));

    const salvo = JSON.parse(
      armazenamento.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS) as string,
    ) as Preferencias;
    expect(salvo.rivais).toEqual(['palmeiras']);
    expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_CENARIO)).toBeNull();
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
