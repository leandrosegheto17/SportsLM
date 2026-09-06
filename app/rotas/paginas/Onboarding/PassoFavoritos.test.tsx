// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EsporteId } from '../../../../dominio/tipos/esportes';
import { MENSAGEM_LIMITE_FAVORITOS, PassoFavoritos } from './PassoFavoritos';

const ESPORTES: { id: EsporteId; nome: string }[] = [
  { id: 'futebol', nome: 'Futebol' },
  { id: 'volei-quadra', nome: 'Vôlei (quadra)' },
  { id: 'formula1', nome: 'Fórmula 1 / automobilismo' },
  { id: 'basquete', nome: 'Basquete' },
];

function renderizar(
  favoritos: EsporteId[] = [],
  sobrescritas: Partial<Parameters<typeof PassoFavoritos>[0]> = {},
) {
  const aoAlternar = vi.fn();
  const aoContinuar = vi.fn();
  const aoPular = vi.fn();
  render(
    <PassoFavoritos
      esportes={ESPORTES}
      favoritos={favoritos}
      aoAlternar={aoAlternar}
      aoContinuar={aoContinuar}
      aoPular={aoPular}
      {...sobrescritas}
    />,
  );
  return { aoAlternar, aoContinuar, aoPular };
}

describe('PassoFavoritos (UI-T01-01 — T-01 passo 1 de 2, favoritos)', () => {
  afterEach(() => {
    cleanup();
  });

  it('estado vazio: mostra o título canônico e "0 DE 3 ESCOLHIDOS" (CA-03.1)', () => {
    renderizar([]);
    expect(screen.getByText('QUAIS ESPORTES VOCÊ QUER EM DESTAQUE?')).toBeTruthy();
    expect(screen.getByText('Escolha até 3. Dá para mudar depois.')).toBeTruthy();
    expect(screen.getByText('0 DE 3 ESCOLHIDOS')).toBeTruthy();
    // Os 15 (aqui, 4 de teste) esportes aparecem como chips, nenhum marcado.
    for (const esporte of ESPORTES) {
      const chip = screen.getByRole('button', { name: esporte.nome });
      expect(chip.getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('estado preenchido: marca um esporte, persiste via aoAlternar e atualiza o contador (CA-03.2)', () => {
    const { aoAlternar } = renderizar(['futebol']);
    expect(screen.getByText('1 DE 3 ESCOLHIDOS')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Vôlei (quadra)' }));
    expect(aoAlternar).toHaveBeenCalledWith('volei-quadra');
  });

  it('desmarcar um favorito sempre é aceito, mesmo com todos os 3 marcados (CA-03.4)', () => {
    const { aoAlternar } = renderizar(['futebol', 'volei-quadra', 'formula1']);
    fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));
    expect(aoAlternar).toHaveBeenCalledWith('futebol');
  });

  it('CA-03.3: tentativa de 4º favorito não chama aoAlternar e anuncia a mensagem canônica via aria-live', () => {
    const { aoAlternar } = renderizar(['futebol', 'volei-quadra', 'formula1']);
    expect(screen.getByText('3 DE 3 ESCOLHIDOS')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Basquete' }));

    expect(aoAlternar).not.toHaveBeenCalled();
    expect(screen.getByText(MENSAGEM_LIMITE_FAVORITOS)).toBeTruthy();
  });

  it('a região aria-live começa vazia (só recebe texto quando a tentativa de 4º acontece)', () => {
    renderizar(['futebol', 'volei-quadra', 'formula1']);
    const regiaoViva = document.querySelector('[aria-live="polite"]');
    expect(regiaoViva).not.toBeNull();
    expect(regiaoViva?.textContent).toBe('');
  });

  it('botões "Continuar" e "Pular" chamam os manipuladores recebidos', () => {
    const { aoContinuar, aoPular } = renderizar(['futebol']);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(aoContinuar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
    expect(aoPular).toHaveBeenCalledTimes(1);
  });
});
