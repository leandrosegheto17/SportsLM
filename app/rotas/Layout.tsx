import type { ReactElement } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navegacao, deveExibirNavegacao } from './Navegacao/Navegacao';
import { ProvedorSobreposicoes } from './SobreposicoesContext';
import estilos from './Layout.module.css';

export const ID_CONTEUDO_PRINCIPAL = 'conteudo-principal';

/**
 * Casca comum a todas as rotas (ADR-003/004): o link "Pular para o
 * conteúdo" (WCAG 2.4.1), o landmark `<main>` que recebe o conteúdo de cada
 * rota via `<Outlet />`, a navegação superior/inferior real (UI-T02-04,
 * `Navegacao` — item ativo, `aria-current`, nunca duplicada por largura de
 * tela) e o provedor das sobreposições sem rota (`T-03`/`T-04`, ADR-003),
 * montadas uma única vez por cima de qualquer rota.
 */
export function Layout(): ReactElement {
  const localizacao = useLocation();
  const comNavegacao = deveExibirNavegacao(localizacao.pathname);

  return (
    <ProvedorSobreposicoes>
      <a className={estilos['linkPularConteudo']} href={`#${ID_CONTEUDO_PRINCIPAL}`}>
        Pular para o conteúdo
      </a>
      <Navegacao />
      <main
        id={ID_CONTEUDO_PRINCIPAL}
        tabIndex={-1}
        className={comNavegacao ? estilos['comNavegacao'] : undefined}
      >
        <Outlet />
      </main>
    </ProvedorSobreposicoes>
  );
}
