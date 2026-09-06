// app/rotas/sobreposicoes/Configuracoes/SecaoPrivacidade.tsx — UI-T03-02
// (TASK.md Lote 9)
//
// T-03 · Configurações (UX-SPEC §3/T-03, wireframe "PRIVACIDADE";
// PRD-TECNICO RNF-07; ADR-012 regra 6 — "aviso simples e discreto no rodapé
// das configurações, explicando os cinco eventos, o identificador anônimo e
// o botão de reiniciar/desativar").
//
// Texto principal copiado literalmente do wireframe de UX-SPEC §3/T-03
// (Diretriz de Implementação #9) — é o único texto canônico desta seção
// específica na Seção 4 do UX-SPEC/PRD-TECNICO:
//   "Suas preferências ficam só neste navegador. Não usamos conta nem
//   cookies. Enviamos 5 eventos anônimos de uso."
// Os 5 eventos revelados por "Ver quais" usam os MESMOS nomes, na mesma
// ordem, do texto de RNF-07 (PRD-TECNICO.md Seção 2) e da tabela do ADR-012 —
// nada inventado aqui, só exibido.
//
// "Desativar e apagar id" (ADR-012 regra 2/regra 6): apaga
// `sportslm.anonimo.v1` via `armazenamento/telemetriaId.ts` — TEL-01 (módulo
// `telemetria`, Lote 12, ainda não implementado) é quem de fato grava esse
// identificador; o botão já funciona corretamente quando TEL-01 existir,
// sem precisar tocar nesta tela de novo (ver comentário de topo do módulo
// de armazenamento). Nenhum mecanismo de telemetria é criado aqui — só a
// limpeza da chave já convencionada em ADR-012.

import { useState, type ReactElement } from 'react';
import { Botao } from '../../../design-system/componentes/Botao';
import { apagarIdentificadorAnonimo } from '../../../armazenamento/telemetriaId';
import estilos from './SecaoPrivacidade.module.css';

/** Texto canônico do wireframe de UX-SPEC §3/T-03 — copiado literalmente. */
export const TEXTO_PRIVACIDADE =
  'Suas preferências ficam só neste navegador. Não usamos conta nem cookies. Enviamos 5 eventos anônimos de uso.';

/** Os 5 eventos de RNF-07/ADR-012, na mesma ordem e com os mesmos nomes do
 * texto de RNF-07 (PRD-TECNICO.md Seção 2) — lista fechada (ADR-012 regra 1). */
export const EVENTOS_TELEMETRIA_RNF07: readonly string[] = [
  'primeira sessão',
  'retorno',
  'personalização concluída',
  'tempo até primeira interação útil',
  'abertura do comparativo',
];

export const TEXTO_CONFIRMACAO_ID_APAGADO = 'Identificador local apagado.';

export interface PropriedadesSecaoPrivacidade {
  /** Injeção de teste; padrão é `globalThis.localStorage`. */
  readonly armazenamento?: Pick<Storage, 'removeItem'>;
}

export function SecaoPrivacidade({
  armazenamento,
}: PropriedadesSecaoPrivacidade): ReactElement {
  const [mostrarEventos, setMostrarEventos] = useState(false);
  const [idApagado, setIdApagado] = useState(false);

  function aoDesativarEApagarId(): void {
    apagarIdentificadorAnonimo(armazenamento);
    setIdApagado(true);
  }

  return (
    <section className={estilos['secao']} aria-labelledby="titulo-privacidade">
      <h3 id="titulo-privacidade" className={estilos['titulo']}>
        Privacidade
      </h3>

      <p className={estilos['texto']}>{TEXTO_PRIVACIDADE}</p>

      {mostrarEventos && (
        <ul className={estilos['eventos']} aria-label="Eventos anônimos enviados">
          {EVENTOS_TELEMETRIA_RNF07.map((evento) => (
            <li key={evento}>{evento}</li>
          ))}
        </ul>
      )}

      <div className={estilos['acoes']}>
        <Botao
          variante="secundario"
          aria-expanded={mostrarEventos}
          onClick={() => {
            setMostrarEventos((valor) => !valor);
          }}
        >
          {mostrarEventos ? 'Ocultar' : 'Ver quais'}
        </Botao>
        <Botao variante="secundario" onClick={aoDesativarEApagarId}>
          Desativar e apagar id
        </Botao>
      </div>

      <p aria-live="polite" className={estilos['confirmacao']}>
        {idApagado ? TEXTO_CONFIRMACAO_ID_APAGADO : ''}
      </p>
    </section>
  );
}
