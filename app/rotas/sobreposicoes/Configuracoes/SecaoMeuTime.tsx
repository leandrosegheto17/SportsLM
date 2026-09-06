// app/rotas/sobreposicoes/Configuracoes/SecaoMeuTime.tsx — UI-T03-02
// (TASK.md Lote 9)
//
// T-03 · Configurações (UX-SPEC §3/T-03, wireframe "MEU TIME"): mostra o
// clube já escolhido (avatar + nome + "Trocar") ou o convite a escolher um,
// abrindo T-04 (`EscolherTime`, UI-T04-01, já `Concluída`) — nenhuma lógica
// de troca vive aqui, só o disparo (`aoTrocar`, injetado por quem monta a
// tela, `Configuracoes.tsx`).
//
// Decisão de escopo registrada (TASK.md §6): o texto da tarefa UI-T03-02 lista
// só "chips de favoritos, seletor de tema, bloco de privacidade", mas o
// wireframe de UX-SPEC §3/T-03 e o comentário de topo de `Configuracoes.tsx`
// (deixado pela própria UI-T03-01) são explícitos — as 4 seções restantes do
// wireframe (esportes/meu time/aparência/privacidade) cabem nesta tarefa
// sequencial. "Meu time" é um acréscimo pequeno e de baixo risco: reaproveita
// por inteiro o catálogo/avatar já carregados por `Configuracoes.tsx` e a
// sobreposição T-04 já concluída (só abre/fecha, nenhuma regra nova) — não é
// o tipo de desvio de escopo que justificaria pausar e voltar ao Coordenador.
// Sinalizo mesmo assim, para registro.
//
// Estado "sem time" (não coberto por CA/UX-SPEC §4/T-03 — pequeno detalhe de
// implementação documentado): a tela de Configurações é alcançável mesmo sem
// time (CA-14.3), então o bloco precisa de um estado além do wireframe (que
// já assume time escolhido) — aqui, um convite equivalente ao de
// `SecaoIdentidade`/Home.

import type { ReactElement } from 'react';
import { AvatarClube } from '../../../design-system/componentes';
import { Botao } from '../../../design-system/componentes/Botao';
import estilos from './SecaoMeuTime.module.css';

export interface ClubeParaSecaoMeuTime {
  readonly id: string;
  readonly nomeCurto: string;
  readonly sigla: string;
  /** Única cor de clube usada aqui, vinda de `clubes-2026.json` — nunca
   * literal (Diretriz de Implementação #4/ADR-017). */
  readonly corBase: string;
}

export interface PropriedadesSecaoMeuTime {
  /** `null` quando não há time escolhido (CA-14.3). */
  readonly clube: ClubeParaSecaoMeuTime | null;
  /** Abre a sobreposição T-04 (`EscolherTime`) — troca ou primeira escolha. */
  readonly aoTrocar: () => void;
}

export function SecaoMeuTime({
  clube,
  aoTrocar,
}: PropriedadesSecaoMeuTime): ReactElement {
  return (
    <section className={estilos['secao']} aria-labelledby="titulo-meu-time">
      <h3 id="titulo-meu-time" className={estilos['titulo']}>
        Meu time
      </h3>

      <div className={estilos['linha']}>
        {clube ? (
          <>
            <span aria-hidden="true">
              <AvatarClube
                sigla={clube.sigla}
                tamanho={32}
                corIdentidade={clube.corBase}
              />
            </span>
            <span className={estilos['nome']}>{clube.nomeCurto}</span>
            <Botao
              variante="secundario"
              className={estilos['botao'] ?? ''}
              onClick={aoTrocar}
            >
              Trocar
            </Botao>
          </>
        ) : (
          <>
            <span className={estilos['semTime']}>Nenhum time escolhido.</span>
            <Botao
              variante="secundario"
              className={estilos['botao'] ?? ''}
              onClick={aoTrocar}
            >
              Escolher time
            </Botao>
          </>
        )}
      </div>
    </section>
  );
}
