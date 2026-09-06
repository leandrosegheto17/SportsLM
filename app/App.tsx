import type { ReactElement } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Rotas } from './rotas/Rotas';
import { usarTema } from './tema/usarTema';

/**
 * Modo de roteamento configurável em build (ADR-003): `historico` (padrão, usa
 * a History API + `404.html` espelhando `index.html` no hosting estático) ou
 * `hash` (salvaguarda se algum navegador embutido do grupo de teste tratar mal
 * o fallback 404). Troca sem mudança de código, só rebuild com a env var.
 */
function obterModoRoteamento(): 'historico' | 'hash' {
  return import.meta.env['VITE_ROTEAMENTO'] === 'hash' ? 'hash' : 'historico';
}

export function App(): ReactElement {
  const Roteador = obterModoRoteamento() === 'hash' ? HashRouter : BrowserRouter;
  // FUND-05: aplica `data-tema` em `<html>` a partir da preferência salva/do
  // sistema e mantém sincronizado enquanto o app está montado (troca sem F5).
  usarTema();

  return (
    <Roteador>
      <Rotas />
    </Roteador>
  );
}
