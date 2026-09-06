// @vitest-environment jsdom
// app/rotas/sobreposicoes/EscolherTime.test.tsx — UI-T04-01 (TASK.md Lote 9)
//
// Cobre T-04 (UX-SPEC §2/§4/T-04): busca + 20 clubes (CA-06.1), estado
// "Erro" e "vazio (busca sem resultado)", aviso ao trocar (CA-06.3) e banner
// de virada de temporada (CA-06.5/RN-12). O comportamento comum de
// sobreposição (Esc/toque fora/foco/foco-trap) já é coberto por
// `Sobreposicao.test.tsx` (UI-DS-07A) — não duplicado aqui.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EscolherTime, TEXTO_AVISO_TROCA } from './EscolherTime';
import { CHAVE_ARMAZENAMENTO_PREFERENCIAS } from '../../armazenamento/preferencias';
import { CHAVE_ARMAZENAMENTO_CENARIO } from '../../armazenamento/cenario';
import type { CatalogoOnboarding } from '../paginas/Onboarding/catalogoOnboarding';
import type { Preferencias } from '../../../dominio/tipos';

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
    ],
    referencias: {
      esportesValidos: new Set(['futebol']),
      fontesValidas: new Set(['fonte-x']),
      clubesValidos: new Set(['sao-paulo', 'santos', 'palmeiras']),
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
    timeId: null,
    rivais: [],
    atualizadoEm: '2026-09-01T00:00:00.000Z',
    ...sobrescritas,
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
    <MemoryRouter>
      <EscolherTime
        aberta
        aoFechar={aoFechar}
        armazenamento={armazenamento}
        carregarCatalogo={opcoes.carregarCatalogo ?? catalogoFake}
      />
    </MemoryRouter>,
  );
  return { aoFechar };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EscolherTime — CA-06.1 (busca + 20 clubes)', () => {
  it('lista os clubes do catálogo e filtra pela busca', () => {
    const armazenamento = new ArmazenamentoFalso();
    renderizar(armazenamento);

    expect(screen.getByText('São Paulo')).toBeTruthy();
    expect(screen.getByText('Santos')).toBeTruthy();
    expect(screen.getByText('Palmeiras')).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar time' }), {
      target: { value: 'san' },
    });

    expect(screen.getByText('Santos')).toBeTruthy();
    expect(screen.queryByText('Palmeiras')).toBeNull();
  });

  it('estado vazio: mostra o texto canônico quando a busca não encontra nada', () => {
    const armazenamento = new ArmazenamentoFalso();
    renderizar(armazenamento);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar time' }), {
      target: { value: 'flamengo do sul' },
    });

    expect(
      screen.getByText(
        'Nenhum clube encontrado para "flamengo do sul". A lista tem os 20 clubes da Série A de 2026.',
      ),
    ).toBeTruthy();
  });
});

describe('EscolherTime — estado Erro', () => {
  it('mostra o texto canônico e permite tentar de novo', () => {
    const armazenamento = new ArmazenamentoFalso();
    const carregarCatalogo = vi.fn(() => null);
    renderizar(armazenamento, { carregarCatalogo });

    expect(
      screen.getByText('Não conseguimos carregar a lista de clubes de 2026.'),
    ).toBeTruthy();
    expect(carregarCatalogo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(carregarCatalogo).toHaveBeenCalledTimes(2);
  });
});

describe('EscolherTime — primeira escolha (sem time confirmado)', () => {
  it('confirma sem exibir o aviso de troca e persiste o time escolhido', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo()),
    );
    const { aoFechar } = renderizar(armazenamento);

    fireEvent.click(screen.getByRole('radio', { name: 'Santos' }));
    expect(screen.queryByText(TEXTO_AVISO_TROCA)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    const salvo = JSON.parse(
      armazenamento.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS) as string,
    ) as Preferencias;
    expect(salvo.timeId).toBe('santos');
    expect(salvo.favoritos).toEqual(['futebol']);
    expect(salvo.fontesBloqueadas).toEqual(['fonte-x']);
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});

describe('EscolherTime — CA-06.3 (trocar de time)', () => {
  it('mostra o aviso canônico ao selecionar um time diferente do confirmado', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(
        preferenciasDeExemplo({ timeId: 'sao-paulo', rivais: ['palmeiras'] }),
      ),
    );
    renderizar(armazenamento);

    expect(screen.queryByText(TEXTO_AVISO_TROCA)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Santos' }));

    expect(screen.getByText(TEXTO_AVISO_TROCA)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar troca' })).toBeTruthy();
  });

  it('ao confirmar a troca, descarta rivais e apaga o cenário salvo', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(
        preferenciasDeExemplo({ timeId: 'sao-paulo', rivais: ['palmeiras'] }),
      ),
    );
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_CENARIO,
      JSON.stringify({ escopo: '2026:sao-paulo:palmeiras', palpites: {}, travadas: [] }),
    );
    renderizar(armazenamento);

    fireEvent.click(screen.getByRole('radio', { name: 'Santos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar troca' }));

    const salvo = JSON.parse(
      armazenamento.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS) as string,
    ) as Preferencias;
    expect(salvo.timeId).toBe('santos');
    expect(salvo.rivais).toEqual([]);
    expect(armazenamento.getItem(CHAVE_ARMAZENAMENTO_CENARIO)).toBeNull();
  });

  it('reconfirmar o mesmo time não exibe o aviso de troca', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo({ timeId: 'sao-paulo' })),
    );
    renderizar(armazenamento);

    expect(screen.queryByText(TEXTO_AVISO_TROCA)).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirmar troca' })).toBeTruthy();
  });
});

describe('EscolherTime — CA-06.5/RN-12 (virada de temporada)', () => {
  it('mostra o banner canônico com o time perdido e a temporada nova', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo({ timeId: 'cruzeiro', rivais: ['santos'] })),
    );
    renderizar(armazenamento);

    expect(
      screen.getByText(
        'Cruzeiro não está na Série A de 2026; escolha um novo time para continuar. Seus esportes favoritos e fontes bloqueadas foram mantidos.',
      ),
    ).toBeTruthy();
    // Nenhum rádio pré-marcado (o time salvo não é mais elegível) e o botão
    // de ação usa o rótulo de primeira escolha, não "Confirmar troca".
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeTruthy();
  });

  it('ao confirmar o novo time, mantém favoritos/fontes e limpa rivais/cenário', () => {
    const armazenamento = new ArmazenamentoFalso();
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_PREFERENCIAS,
      JSON.stringify(preferenciasDeExemplo({ timeId: 'cruzeiro', rivais: ['santos'] })),
    );
    renderizar(armazenamento);

    fireEvent.click(screen.getByRole('radio', { name: 'Palmeiras' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    const salvo = JSON.parse(
      armazenamento.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS) as string,
    ) as Preferencias;
    expect(salvo.timeId).toBe('palmeiras');
    expect(salvo.rivais).toEqual([]);
    expect(salvo.favoritos).toEqual(['futebol']);
    expect(salvo.fontesBloqueadas).toEqual(['fonte-x']);
  });
});
