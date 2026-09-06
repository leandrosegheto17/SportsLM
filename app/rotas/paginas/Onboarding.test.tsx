// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAVE_ARMAZENAMENTO_PREFERENCIAS } from '../../armazenamento/preferencias';
import { resetarCacheClubesPublicosParaTeste } from '../../dados/useClubesPublicos';
import { Onboarding, TEXTO_ERRO_CATALOGO_ONBOARDING } from './Onboarding';

const PALETA_FIXTURE = {
  acromatico: false,
  identidade: '#E30613',
  faixaB: '#B10510',
  identidadeTexto: '#FFFFFF',
  acento: '#E30613',
  acentoSobreEscuro: '#FF6B6B',
  suave: '#FDE7E8',
  suaveEscuro: '#3A1013',
  identidadeEscuro: '#8C040C',
  faixaBEscuro: '#5C0308',
  identidadeTextoEscuro: '#FFFFFF',
};

/** `useClubesPublicos` — nunca chamado neste arquivo sem injeção de `buscar`
 * (mesma convenção de `SecaoIdentidade.test.tsx`), para não depender de
 * `fetch` real em jsdom. */
function buscarClubesFixture() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => [
      {
        id: 'sao-paulo',
        nome: 'São Paulo Futebol Clube',
        nomeCurto: 'São Paulo',
        sigla: 'SPA',
        corBase: '#E30613',
        paleta: PALETA_FIXTURE,
      },
    ],
  })) as unknown as typeof fetch;
}

function renderizarOnboarding(propriedades: Parameters<typeof Onboarding>[0] = {}) {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route
          path="/onboarding"
          element={
            <Onboarding
              opcoesClubesPublicos={{ buscar: buscarClubesFixture() }}
              {...propriedades}
            />
          }
        />
        <Route path="/" element={<p>Início</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Onboarding (UI-T01-01/UI-T01-02 — os 2 passos de T-01)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetarCacheClubesPublicosParaTeste();
  });

  afterEach(() => {
    cleanup();
    resetarCacheClubesPublicosParaTeste();
    vi.useRealTimers();
  });

  describe('Passo 1 (favoritos)', () => {
    it('estado preenchido: mostra os 15 esportes de config/esportes.json (CA-03.1)', () => {
      renderizarOnboarding();
      expect(screen.getByText('QUAIS ESPORTES VOCÊ QUER EM DESTAQUE?')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Futebol' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Futebol americano (NFL)' }),
      ).toBeTruthy();
      expect(screen.getByText('0 DE 3 ESCOLHIDOS')).toBeTruthy();
    });

    it('retoma favoritos já salvos no localStorage', () => {
      window.localStorage.setItem(
        CHAVE_ARMAZENAMENTO_PREFERENCIAS,
        JSON.stringify({
          versaoEsquema: 1,
          temporada: 2026,
          favoritos: ['futebol', 'basquete'],
          fontesBloqueadas: [],
          timeId: 'flamengo',
          rivais: [],
          atualizadoEm: '2026-09-01T00:00:00.000Z',
        }),
      );

      renderizarOnboarding();
      expect(screen.getByText('2 DE 3 ESCOLHIDOS')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Futebol' }).getAttribute('aria-pressed'),
      ).toBe('true');
    });

    it('CA-03.2: marcar um esporte persiste imediatamente no localStorage', () => {
      renderizarOnboarding();
      fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));

      const salvo = JSON.parse(
        window.localStorage.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS) ?? 'null',
      );
      expect(salvo.favoritos).toEqual(['futebol']);
    });

    it('"Continuar" avança para o passo 2 (não navega direto para a home)', () => {
      renderizarOnboarding();
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      expect(screen.getByText('QUAL É O SEU TIME?')).toBeTruthy();
    });

    it('"Pular" também avança para o passo 2 (CA-14.2: segue com zero favoritos, mas o onboarding continua no passo 2)', () => {
      renderizarOnboarding();
      fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
      expect(screen.getByText('QUAL É O SEU TIME?')).toBeTruthy();
    });

    it('CA-14.4: grava um registro ao concluir o passo 1, mesmo com zero favoritos', () => {
      renderizarOnboarding();
      fireEvent.click(screen.getByRole('button', { name: 'Pular' }));

      const salvo = JSON.parse(
        window.localStorage.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS) ?? 'null',
      );
      expect(salvo).not.toBeNull();
      expect(salvo.favoritos).toEqual([]);
      expect(salvo.timeId).toBeNull();
    });

    it('estado Erro: mostra o texto canônico e "Continuar sem escolher" leva direto à home (sem passo 2)', () => {
      renderizarOnboarding({ carregarCatalogo: () => null });

      expect(screen.getByText(TEXTO_ERRO_CATALOGO_ONBOARDING)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Continuar sem escolher' }));
      expect(screen.getByText('Início')).toBeTruthy();
    });
  });

  describe('Passo 2 (time) e transição — UI-T01-02', () => {
    it('CA-14.4: reabrir /onboarding após abandonar no passo 2 retoma direto nele', () => {
      window.localStorage.setItem(
        CHAVE_ARMAZENAMENTO_PREFERENCIAS,
        JSON.stringify({
          versaoEsquema: 1,
          temporada: 2026,
          favoritos: [],
          fontesBloqueadas: [],
          timeId: null,
          rivais: [],
          atualizadoEm: '2026-09-01T00:00:00.000Z',
        }),
      );

      renderizarOnboarding();
      expect(screen.getByText('QUAL É O SEU TIME?')).toBeTruthy();
      expect(screen.queryByText('QUAIS ESPORTES VOCÊ QUER EM DESTAQUE?')).toBeNull();
    });

    it('"Voltar" retorna ao passo 1 sem perder os favoritos já marcados', () => {
      renderizarOnboarding();
      fireEvent.click(screen.getByRole('button', { name: 'Futebol' }));
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      expect(screen.getByText('QUAL É O SEU TIME?')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Voltar ao passo 1' }));
      expect(screen.getByText('QUAIS ESPORTES VOCÊ QUER EM DESTAQUE?')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Futebol' }).getAttribute('aria-pressed'),
      ).toBe('true');
    });

    it('CA-14.3: "Pular" no passo 2 conclui sem time e vai para a home — onboarding completo em no máximo 2 confirmações (CA-14.5/RNF-04)', () => {
      renderizarOnboarding();
      fireEvent.click(screen.getByRole('button', { name: 'Pular' })); // 1ª confirmação (passo 1)
      fireEvent.click(screen.getByRole('button', { name: 'Pular' })); // 2ª confirmação (passo 2)

      expect(screen.getByText('Início')).toBeTruthy();
      const salvo = JSON.parse(
        window.localStorage.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS) ?? 'null',
      );
      expect(salvo.timeId).toBeNull();
    });

    it('CA-06.2: confirmar um time persiste e conclui — no máximo 2 confirmações (CA-14.5/RNF-04)', async () => {
      renderizarOnboarding({
        opcoesClubesPublicos: { buscar: buscarClubesFixture() },
        prefereMovimentoReduzido: () => true, // sem animação: navega assim que confirma
      });

      fireEvent.click(screen.getByRole('button', { name: 'Continuar' })); // 1ª confirmação
      fireEvent.click(screen.getByRole('radio', { name: 'São Paulo' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })); // 2ª confirmação

      expect(screen.getByText('Início')).toBeTruthy();
      const salvo = JSON.parse(
        window.localStorage.getItem(CHAVE_ARMAZENAMENTO_PREFERENCIAS) ?? 'null',
      );
      expect(salvo.timeId).toBe('sao-paulo');
    });

    it('transição: com a paleta já carregada e sem preferência de movimento reduzido, mostra a FaixaClube completa antes de navegar (150ms)', async () => {
      const buscar = buscarClubesFixture();

      renderizarOnboarding({
        opcoesClubesPublicos: { buscar },
        prefereMovimentoReduzido: () => false,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Pular' })); // passo 1 -> passo 2

      // Espera a busca de clubes públicos (paleta) resolver antes de confirmar.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      fireEvent.click(screen.getByRole('radio', { name: 'São Paulo' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      // Ainda na transição — não navegou de imediato.
      expect(screen.queryByText('Início')).toBeNull();
      expect(screen.getByText('São Paulo')).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByText('Início')).toBeTruthy();
      });
    });

    it('movimento reduzido: nunca mostra a transição, navega direto ao confirmar', () => {
      renderizarOnboarding({
        opcoesClubesPublicos: { buscar: buscarClubesFixture() },
        prefereMovimentoReduzido: () => true,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
      fireEvent.click(screen.getByRole('radio', { name: 'São Paulo' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      expect(screen.getByText('Início')).toBeTruthy();
    });

    it('paleta ainda não carregada: confirma e navega direto, sem bloquear em rede (RNF-04/RNF-05)', () => {
      const buscar = vi.fn(
        () => new Promise<Response>(() => undefined),
      ) as unknown as typeof fetch;

      renderizarOnboarding({
        opcoesClubesPublicos: { buscar },
        prefereMovimentoReduzido: () => false,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
      fireEvent.click(screen.getByRole('radio', { name: 'São Paulo' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      expect(screen.getByText('Início')).toBeTruthy();
    });
  });
});
