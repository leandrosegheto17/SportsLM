import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import { Comparativo } from './paginas/Comparativo';
import { DetalheCampeonato } from './paginas/DetalheCampeonato';
import { Home } from './paginas/Home';
import { Onboarding } from './paginas/Onboarding';
import { PainelTime } from './paginas/PainelTime';
import { Simulacao } from './paginas/Simulacao';

/**
 * Mapa de rotas do ADR-003 (UX-SPEC §1.1). As 3 sobreposições (T-03, T-04,
 * T-07) não têm rota própria por decisão do ADR — vivem em `sobreposicoes/`,
 * abertas a partir do estado de uma tela, não de uma URL.
 */
export function Rotas(): ReactElement {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/time" element={<PainelTime />} />
        <Route path="/time/:campeonatoId" element={<DetalheCampeonato />} />
        <Route path="/comparativo" element={<Comparativo />} />
        <Route path="/simulacao" element={<Simulacao />} />
      </Route>
    </Routes>
  );
}
