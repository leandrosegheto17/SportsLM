// app/rotas/Navegacao/Navegacao.tsx — UI-T02-04 (TASK.md Lote 8)
//
// Nav superior/inferior de UX-SPEC §2/T-02 ("os três itens [...] estão
// sempre visíveis [...]. O item ativo é sublinhado com a cor de acento do
// clube [...] e marcado com aria-current='page' — o sublinhado nunca é a
// única pista", UX-SPEC §1.3) — compartilhada pelas 3 rotas que a exibem no
// wireframe (T-02 Home `/`, T-05 Painel `/time`, T-08 Comparativo
// `/comparativo`; T-06/T-09/onboarding têm cabeçalho próprio com seta de
// voltar, sem esta barra — CA/UX-SPEC §2, wireframes de T-06/T-09).
//
// Um único componente, montado uma vez em `Layout`, evita duplicação: a
// mesma lista de itens é renderizada dentro da barra superior (visível só em
// desktop, `--altura-nav-topo`) e dentro da barra inferior fixa (visível só
// em mobile, `--altura-nav-inferior`) — nunca as duas ao mesmo tempo, porque
// a visibilidade é resolvida por `display: none` em `Navegacao.module.css`
// (breakpoint 1024px, mesmo usado por `BlocoPreto`/tokens.css): um elemento
// com `display: none` sai também da árvore de acessibilidade e da ordem de
// tabulação, não é "escondido só visualmente" — por isso não há duplicação
// real nem para leitor de tela nem para navegação por teclado, em nenhuma
// largura.
//
// Cor do sublinhado ativo (`--clube-acento-sobre-escuro`, UX-SPEC §2): lida
// do clube salvo (mesma leitura síncrona e não bloqueante de `timeId` já
// usada por `SecaoIdentidade`/UI-T02-01, duplicada aqui de propósito — é uma
// função pura pequena, mesmo racional de duplicação já registrado por
// UI-T02-02/03) mais `useClubesPublicos` (UI-T02-01) para a paleta
// (ADR-017: nunca computada aqui). Sem time ainda (`timeId === null`) ou
// enquanto a config publicada não resolveu, cai no token ambiente
// `--clube-acento-sobre-escuro` (branco, `tokens.css`), que já é o
// tratamento acromático "sem time" correto.

import type { ReactElement } from 'react';
import type { CSSProperties } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useClubesPublicos } from '../../dados/useClubesPublicos';
import { CHAVE_ARMAZENAMENTO_PREFERENCIAS } from '../../armazenamento/preferencias';
import { lerBrutoSemLancar } from '../../armazenamento/nucleo';
import { preferenciasSchema } from '../../../dominio/tipos';
import { usarTema } from '../../tema/usarTema';
import { useSobreposicoes } from '../SobreposicoesContext';
import estilos from './Navegacao.module.css';

/** UX-SPEC §1.3: "os três itens (NOTÍCIAS, MEU TIME, COMPARATIVO)". Rótulos
 * em caixa normal no HTML — a caixa alta do wireframe é decoração tipográfica
 * (`text-transform`, Diretriz de Implementação — "caixa alta é decoração
 * tipográfica, nunca conteúdo"). */
const ITENS_NAV = [
  { rotulo: 'Notícias', para: '/' },
  { rotulo: 'Meu time', para: '/time' },
  { rotulo: 'Comparativo', para: '/comparativo' },
] as const;

/** As 3 rotas cujo wireframe mostra esta barra (UX-SPEC §2: T-02, T-05, T-08)
 * — `/time/:campeonatoId` (T-06) e `/simulacao` (T-09) têm cabeçalho próprio
 * com seta de voltar, sem esta navegação; `/onboarding` (T-01) também tem
 * cabeçalho próprio. Comparação exata de `pathname` (não `startsWith`): T-06
 * não deve herdar a barra só por compartilhar o prefixo `/time`. */
const ROTAS_COM_NAVEGACAO: ReadonlySet<string> = new Set(['/', '/time', '/comparativo']);

/** Exportado para `Layout` decidir se reserva espaço (`padding`) para a
 * barra fixa, sem duplicar a lista de rotas em dois arquivos. */
export function deveExibirNavegacao(pathname: string): boolean {
  return ROTAS_COM_NAVEGACAO.has(pathname);
}

function lerTimeIdSalvo(): string | null {
  const bruto = lerBrutoSemLancar(
    CHAVE_ARMAZENAMENTO_PREFERENCIAS,
    globalThis.localStorage,
  );
  if (bruto === null) {
    return null;
  }
  try {
    const analisado: unknown = JSON.parse(bruto);
    const resultado = preferenciasSchema.safeParse(analisado);
    return resultado.success ? resultado.data.timeId : null;
  } catch {
    return null;
  }
}

interface PropriedadesListaDeItens {
  readonly className: string;
  readonly classeItem: string;
  readonly classeItemAtivo: string;
}

function ListaDeItens({
  className,
  classeItem,
  classeItemAtivo,
}: PropriedadesListaDeItens): ReactElement {
  return (
    <ul className={className}>
      {ITENS_NAV.map((item) => (
        <li key={item.para}>
          <NavLink
            to={item.para}
            end={item.para === '/'}
            className={({ isActive }: { isActive: boolean }) =>
              isActive ? `${classeItem} ${classeItemAtivo}` : classeItem
            }
          >
            {item.rotulo}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * `Navegacao` — barra superior (logo + itens em desktop + tema + `⚙`) e
 * barra inferior fixa (itens, só mobile) de UX-SPEC §2/T-02. Retorna `null`
 * fora das 3 rotas de `ROTAS_COM_NAVEGACAO`.
 */
export function Navegacao(): ReactElement | null {
  const localizacao = useLocation();
  const { abrirConfiguracoes } = useSobreposicoes();
  const { temaEfetivo, definirPreferencia } = usarTema();
  const { clubes } = useClubesPublicos();

  if (!deveExibirNavegacao(localizacao.pathname)) {
    return null;
  }

  const timeId = lerTimeIdSalvo();
  const acentoSobreEscuro = clubes?.find((clube) => clube.id === timeId)?.paleta
    .acentoSobreEscuro;
  const estiloComCorDoClube = acentoSobreEscuro
    ? ({ '--nav-acento-sobre-escuro': acentoSobreEscuro } as CSSProperties)
    : undefined;

  const proximoTema = temaEfetivo === 'escuro' ? 'claro' : 'escuro';

  return (
    <>
      <header className={estilos['topo']} style={estiloComCorDoClube}>
        <NavLink to="/" end className={estilos['logo'] ?? ''}>
          SportsLM
        </NavLink>

        <nav className={estilos['navDesktop']} aria-label="Navegação principal">
          <ListaDeItens
            className={estilos['lista'] ?? ''}
            classeItem={estilos['itemNav'] ?? ''}
            classeItemAtivo={estilos['itemNavAtivo'] ?? ''}
          />
        </nav>

        <div className={estilos['acoes']}>
          <button
            type="button"
            className={estilos['botaoIcone']}
            onClick={() => {
              definirPreferencia(proximoTema);
            }}
            aria-label={`Tema atual: ${temaEfetivo}. Alternar para ${proximoTema}.`}
          >
            <span aria-hidden="true">◐</span>
            <span className={estilos['rotuloTema']}>Tema</span>
          </button>
          <button
            type="button"
            className={estilos['botaoIcone']}
            onClick={abrirConfiguracoes}
            aria-label="Abrir configurações"
          >
            <span aria-hidden="true">⚙</span>
            <span className={estilos['somenteLeitorDeTela']}>Configurações</span>
          </button>
        </div>
      </header>

      <nav
        className={estilos['inferior']}
        aria-label="Navegação principal"
        style={estiloComCorDoClube}
      >
        <ListaDeItens
          className={estilos['listaInferior'] ?? ''}
          classeItem={estilos['itemNav'] ?? ''}
          classeItemAtivo={estilos['itemNavAtivo'] ?? ''}
        />
      </nav>
    </>
  );
}
