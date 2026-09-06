// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ID_CONTEUDO_PRINCIPAL, Layout } from './Layout';
import { Home } from './paginas/Home';
import { Comparativo } from './paginas/Comparativo';
import { Rotas } from './Rotas';

function renderizarEm(caminho: string) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <Rotas />
    </MemoryRouter>,
  );
}

describe('Rotas (FUND-04 — shell da SPA)', () => {
  afterEach(() => {
    cleanup();
    document.title = '';
  });

  it('resolve /comparativo renderizando T-08 real (UI-T08-01 — conteúdo real, ver Comparativo.test.tsx)', () => {
    renderizarEm('/comparativo');
    // Sem time salvo (CA-14.3, adaptado ao contexto de T-08): convite único,
    // sempre presente independente de estado de rede/preferências (mesmo
    // racional do teste de `/time` acima).
    expect(screen.getByRole('button', { name: 'ESCOLHER MEU TIME' })).toBeTruthy();
    expect(document.title).toBe('Comparativo · SportsLM');
  });

  it('resolve /simulacao renderizando T-09 real (conteúdo real de uma tarefa paralela do Lote 11 — ver Simulacao.test.tsx)', () => {
    renderizarEm('/simulacao');
    // Sem time salvo, mesmo racional de convite único das demais telas —
    // ver nota acima; texto próprio de T-09 (Simulação), não parafraseado
    // aqui (Diretriz de Implementação #9), só usado como prova de que a rota
    // resolveu no componente real.
    expect(
      screen.getByText('Escolha seu time para simular a disputa com seus rivais.'),
    ).toBeTruthy();
    expect(document.title).toBe('Simulação · SportsLM');
  });

  it('resolve / renderizando a Home real (UI-T02-04 — conteúdo real, ver Home.test.tsx)', () => {
    renderizarEm('/');
    // A Home real (não mais placeholder desde UI-T02-04) sempre mostra a
    // seção "Últimas notícias", independente de estado de rede/preferências.
    expect(screen.getByRole('heading', { name: 'Últimas notícias' })).toBeTruthy();
  });

  it('resolve /time renderizando o Painel do time real (UI-T05-01 — conteúdo real, ver PainelTime.test.tsx)', () => {
    renderizarEm('/time');
    // Sem time salvo (CA-14.3): convite único, sempre presente independente
    // de estado de rede/preferências (mesmo racional do teste acima para /).
    expect(screen.getByRole('button', { name: 'ESCOLHER MEU TIME' })).toBeTruthy();
  });

  it('resolve /onboarding renderizando T-01 (conteúdo real, UI-T01-01 — ver Onboarding.test.tsx)', () => {
    renderizarEm('/onboarding');
    expect(screen.getByText('QUAIS ESPORTES VOCÊ QUER EM DESTAQUE?')).toBeTruthy();
  });

  it('resolve rota dinâmica /time/:campeonatoId (conteúdo real, UI-T06-01 — ver DetalheCampeonato.test.tsx)', () => {
    // Achado de integração entre lotes paralelos (UI-T05-01/UI-T06-01,
    // ambos Lote 10): `DetalheCampeonato` deixou de ser o placeholder de
    // FUND-04 que expunha `campeonatoId` como texto — agora tem conteúdo
    // real (UI-T06-01) com o mesmo texto de convite "sem time" (CA-14.3) de
    // `PainelTime` (UI-T05-01). Distinguimos as duas rotas pelo `<title>`
    // (`useTituloDocumento`), que continua exclusivo de cada tela — prova
    // que a rota dinâmica resolveu no componente certo, não em `/time`.
    renderizarEm('/time/brasileirao-2026');
    expect(document.title).toBe('Detalhe do campeonato · SportsLM');
  });

  it('muda o <title> do documento por rota', () => {
    renderizarEm('/');
    expect(document.title).toBe('Início · SportsLM');
  });

  it('inclui o link "Pular para o conteúdo" apontando para o landmark principal', () => {
    renderizarEm('/');
    const link = screen.getByRole('link', { name: 'Pular para o conteúdo' });
    expect(link.getAttribute('href')).toBe(`#${ID_CONTEUDO_PRINCIPAL}`);
    expect(document.getElementById(ID_CONTEUDO_PRINCIPAL)).not.toBeNull();
  });

  it('navega de fato entre rotas ao clicar num link (não só troca de props)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="/"
              element={
                <>
                  <Home />
                  <Link to="/comparativo">Ir para comparativo</Link>
                </>
              }
            />
            <Route path="/comparativo" element={<Comparativo />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Últimas notícias' })).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: 'Ir para comparativo' }));

    expect(screen.getByRole('button', { name: 'ESCOLHER MEU TIME' })).toBeTruthy();
    expect(document.title).toBe('Comparativo · SportsLM');
  });
});
