// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Palpite } from '../../../dominio/tipos/estado-local';
import { SeletorPalpite } from './SeletorPalpite';
import estilos from './SeletorPalpite.module.css';

const CAMINHO_CSS = join(
  dirname(fileURLToPath(import.meta.url)),
  'SeletorPalpite.module.css',
);
const FONTE_CSS = readFileSync(CAMINHO_CSS, 'utf-8');

function extrairRegraCss(nomeClasse: string): string {
  const escapado = nomeClasse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const casamento = new RegExp(`\\.${escapado}\\s*\\{([^}]*)\\}`, 's').exec(FONTE_CSS);
  if (!casamento?.[1]) {
    throw new Error(`Regra .${nomeClasse} não encontrada em SeletorPalpite.module.css`);
  }
  return casamento[1];
}

function possuiClasse(
  elemento: Element | null,
  nomeDaClasse: string | undefined,
): boolean {
  if (!elemento || !nomeDaClasse) {
    return false;
  }
  return elemento.className.split(/\s+/).includes(nomeDaClasse);
}

afterEach(() => {
  cleanup();
});

describe('SeletorPalpite (UI-DS-05)', () => {
  it('renderiza fieldset/legend com os 4 rádios V/E/D/— (UX-SPEC §3.8.5)', () => {
    render(
      <SeletorPalpite
        idPartida="p1"
        legenda="24ª rodada — São Paulo x Fluminense, fora"
        valor={null}
        aoMudar={vi.fn()}
      />,
    );

    const grupo = screen.getByRole('group', {
      name: '24ª rodada — São Paulo x Fluminense, fora',
    });
    expect(grupo.tagName).toBe('FIELDSET');
    expect(grupo.querySelector('legend')).not.toBeNull();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Vitória' })).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Empate' })).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Derrota' })).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Sem palpite' })).not.toBeNull();
  });

  it('chama aoMudar com o valor correto ao clicar em cada opção', () => {
    const aoMudar = vi.fn();
    render(
      <SeletorPalpite idPartida="p1" legenda="Legenda" valor={null} aoMudar={aoMudar} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Vitória' }));
    expect(aoMudar).toHaveBeenCalledWith('vitoria');

    fireEvent.click(screen.getByRole('radio', { name: 'Empate' }));
    expect(aoMudar).toHaveBeenCalledWith('empate');

    fireEvent.click(screen.getByRole('radio', { name: 'Derrota' }));
    expect(aoMudar).toHaveBeenCalledWith('derrota');
  });

  it('chama aoMudar com null ao clicar na opção "—" (sem palpite)', () => {
    const aoMudar = vi.fn();
    render(
      <SeletorPalpite
        idPartida="p1"
        legenda="Legenda"
        valor="vitoria"
        aoMudar={aoMudar}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Sem palpite' }));
    expect(aoMudar).toHaveBeenCalledWith(null);
  });

  describe('3 pistas simultâneas no selecionado (WCAG 1.4.1, Diretriz #7)', () => {
    it.each<[Palpite, string]>([
      ['vitoria', 'Vitória'],
      ['empate', 'Empate'],
      ['derrota', 'Derrota'],
    ])('opção %s marca preenchimento + contorno + letra', (valor, nomeAcessivel) => {
      render(
        <SeletorPalpite
          idPartida="p1"
          legenda="Legenda"
          valor={valor}
          aoMudar={vi.fn()}
        />,
      );

      const radio = screen.getByRole('radio', {
        name: nomeAcessivel,
      }) as HTMLInputElement;
      expect(radio.checked).toBe(true);

      const label = radio.closest('label');
      // Pista 1 + 2 (preenchimento e contorno): mesma classe aplica as duas
      // declarações — confirmado tanto pela presença da classe no elemento
      // quanto pelo conteúdo real da regra CSS (evita falso-positivo de
      // classe vazia).
      expect(possuiClasse(label, estilos['opcaoSelecionada'])).toBe(true);
      const regraSelecionada = extrairRegraCss('opcaoSelecionada');
      expect(regraSelecionada).toMatch(/background:/);
      expect(regraSelecionada).toMatch(/border-color:/);

      // Pista 3 (a letra): sempre um nó de texto visível, nunca só cor.
      const letraEsperada = { vitoria: 'V', empate: 'E', derrota: 'D' }[valor];
      expect(label?.textContent).toBe(letraEsperada);
    });

    it('opção "—" (sem palpite) fica marcada como selecionada quando valor é null', () => {
      render(
        <SeletorPalpite
          idPartida="p1"
          legenda="Legenda"
          valor={null}
          aoMudar={vi.fn()}
        />,
      );
      const radioSemPalpite = screen.getByRole('radio', {
        name: 'Sem palpite',
      }) as HTMLInputElement;
      expect(radioSemPalpite.checked).toBe(true);
      const label = radioSemPalpite.closest('label');
      expect(possuiClasse(label, estilos['opcaoSelecionada'])).toBe(true);
      expect(label?.textContent).toBe('—');
    });
  });

  describe('navegação por setas (radiogroup)', () => {
    it('ArrowRight/ArrowDown avança para a próxima opção e ArrowLeft/ArrowUp volta', () => {
      const aoMudar = vi.fn();
      const { rerender } = render(
        <SeletorPalpite
          idPartida="p1"
          legenda="Legenda"
          valor="vitoria"
          aoMudar={aoMudar}
        />,
      );

      const radioVitoria = screen.getByRole('radio', { name: 'Vitória' });
      radioVitoria.focus();
      fireEvent.keyDown(radioVitoria, { key: 'ArrowRight' });
      expect(aoMudar).toHaveBeenLastCalledWith('empate');

      // Simula o componente controlado recebendo o novo valor.
      rerender(
        <SeletorPalpite
          idPartida="p1"
          legenda="Legenda"
          valor="empate"
          aoMudar={aoMudar}
        />,
      );
      expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Empate' }));

      fireEvent.keyDown(screen.getByRole('radio', { name: 'Empate' }), {
        key: 'ArrowDown',
      });
      expect(aoMudar).toHaveBeenLastCalledWith('derrota');

      rerender(
        <SeletorPalpite
          idPartida="p1"
          legenda="Legenda"
          valor="derrota"
          aoMudar={aoMudar}
        />,
      );
      fireEvent.keyDown(screen.getByRole('radio', { name: 'Derrota' }), {
        key: 'ArrowLeft',
      });
      expect(aoMudar).toHaveBeenLastCalledWith('empate');
    });

    it('setas dão a volta (wrap) nas extremidades do grupo', () => {
      const aoMudar = vi.fn();
      render(
        <SeletorPalpite
          idPartida="p1"
          legenda="Legenda"
          valor={null}
          aoMudar={aoMudar}
        />,
      );

      // "Sem palpite" (—) é a última opção; ArrowRight/ArrowDown volta à 1ª.
      fireEvent.keyDown(screen.getByRole('radio', { name: 'Sem palpite' }), {
        key: 'ArrowRight',
      });
      expect(aoMudar).toHaveBeenLastCalledWith('vitoria');

      // "Vitória" é a 1ª opção; ArrowLeft/ArrowUp vai para a última (—).
      fireEvent.keyDown(screen.getByRole('radio', { name: 'Vitória' }), {
        key: 'ArrowUp',
      });
      expect(aoMudar).toHaveBeenLastCalledWith(null);
    });

    it('só a opção selecionada (ou a 1ª, sem seleção) tem tabIndex 0 — roving tabindex', () => {
      render(
        <SeletorPalpite
          idPartida="p1"
          legenda="Legenda"
          valor="derrota"
          aoMudar={vi.fn()}
        />,
      );
      expect(
        screen.getByRole('radio', { name: 'Vitória' }).getAttribute('tabindex'),
      ).toBe('-1');
      expect(screen.getByRole('radio', { name: 'Empate' }).getAttribute('tabindex')).toBe(
        '-1',
      );
      expect(
        screen.getByRole('radio', { name: 'Derrota' }).getAttribute('tabindex'),
      ).toBe('0');
      expect(
        screen.getByRole('radio', { name: 'Sem palpite' }).getAttribute('tabindex'),
      ).toBe('-1');
    });
  });

  describe('variante travado', () => {
    it('mostra "DISPUTADA" e o resultado real, sem nenhum rádio', () => {
      render(
        <SeletorPalpite
          idPartida="p1"
          legenda="Legenda"
          valor="vitoria"
          aoMudar={vi.fn()}
          variante="travado"
          resultadoReal="vitoria"
        />,
      );

      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(screen.getByText(/DISPUTADA/)).not.toBeNull();
      expect(screen.getByText('V')).not.toBeNull();
    });
  });

  describe('variante espelhado', () => {
    it('mostra "CONFRONTO DIRETO" e a frase explicativa, com rádios desabilitados e sem contradição', () => {
      const aoMudar = vi.fn();
      render(
        <SeletorPalpite
          idPartida="p2"
          legenda="Legenda espelhada"
          valor="derrota"
          aoMudar={aoMudar}
          variante="espelhado"
          textoConfrontoDireto="O resultado de São Paulo x Fluminense já define este confronto."
        />,
      );

      expect(screen.getByText('CONFRONTO DIRETO')).not.toBeNull();
      expect(screen.getByText(/já define este confronto/)).not.toBeNull();

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios).toHaveLength(4);
      radios.forEach((radio) => expect(radio.disabled).toBe(true));

      fireEvent.click(screen.getByRole('radio', { name: 'Vitória' }));
      expect(aoMudar).not.toHaveBeenCalled();

      expect(
        (screen.getByRole('radio', { name: 'Derrota' }) as HTMLInputElement).checked,
      ).toBe(true);
    });
  });
});
