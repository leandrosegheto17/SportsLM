// app/dados/futebol.ts — UI-T02-01 (TASK.md Lote 8)
//
// Schemas + caminhos de `/dados/futebol/brasileirao.json` e
// `/dados/futebol/clube/<slug>.json` (SDD §2.2), para uso com `useSnapshot`
// (UI-DS-08, chave de hash `'futebol'` — cobre os dois arquivos, o contrato
// não expõe hash por clube, ver `app/dados/README.md`).
//
// Mesma forma de `brasileiraoPublicoSchema`/`clubeFutebolPublicoSchema` em
// `pipeline/publicacao/gerador-snapshots.ts` (PUB-02, Lote 6, concluído);
// redefinidos aqui, não importados de lá, pela mesma razão de direção de
// dependência documentada em `app/dados/configPublico.ts` (`pipeline/` faz
// I/O de `node:fs`/`node:crypto`, não pode entrar no bundle da SPA). Compostos
// a partir dos schemas *puros* de `dominio/tipos/futebol` (seguro de
// importar em `app/`), então não há duplicação de regra de validação — só da
// forma do envelope do arquivo.

import { z } from 'zod';
import {
  competicaoSchema,
  linhaClassificacaoSchema,
  partidaSchema,
  participacaoClubeSchema,
  zonaSchema,
} from '../../dominio/tipos/futebol';

/** `/dados/futebol/brasileirao.json`: classificação + todas as partidas dos
 * 20 clubes, todas as rodadas, + zonas (RN-15/RF-18). */
export const brasileiraoPublicoSchema = z.object({
  competicao: competicaoSchema,
  classificacao: z.array(linhaClassificacaoSchema),
  partidas: z.array(partidaSchema),
  zonas: z.array(zonaSchema),
});

export type BrasileiraoPublico = z.infer<typeof brasileiraoPublicoSchema>;

/** Uma entrada de `/dados/futebol/clube/<slug>.json`: um campeonato do
 * clube, seu status/fase/resumo e as partidas do clube nesse campeonato.
 *
 * `classificacaoFinalDoGrupo` (extensão aditiva do contrato, registrada na
 * resolução do Bloqueio 001 de `.md/BLOCKERS.md`, CA-08.5): quando um
 * campeonato muda de formato — fase de grupos → mata-mata —, CA-08.5 exige
 * que a tabela final do grupo continue acessível mesmo depois que a tela
 * passa a mostrar CA-08.4 (confronto de mata-mata) no lugar da tabela.
 * `classificacaoFinalDoGrupo` é o "congelamento" dessa tabela no momento da
 * transição — mesmo schema de `LinhaClassificacao` da classificação corrente,
 * só que já não muda mais. `undefined`/`null`/array vazio ⇒ nenhuma tabela de
 * grupo para preservar (mesmo campeonato desde sempre em mata-mata, ou fonte
 * ainda não publica esse dado) — a tela trata os três casos da mesma forma
 * (nenhum link/aba extra aparece), mesmo espírito de "ausente, sem erro" já
 * usado em `zonas`/CA-18.2. Campo `optional()` (não obrigatório) para não
 * quebrar nenhum arquivo já publicado sem ele — nenhuma fonte real aciona
 * este campo hoje (só o Brasileirão é publicado, sempre `pontos-corridos`,
 * ver nota de decisão em `DetalheCampeonato.tsx`); o mecanismo é genérico e
 * correto, coberto por teste com fixture, para quando uma fonte de
 * grupos→mata-mata for publicada, sem precisar mudar código de novo. */
export const campeonatoDoClubePublicoSchema = z.object({
  competicao: competicaoSchema,
  participacao: participacaoClubeSchema,
  partidas: z.array(partidaSchema),
  classificacaoFinalDoGrupo: z.array(linhaClassificacaoSchema).nullable().optional(),
});

export type CampeonatoDoClubePublico = z.infer<typeof campeonatoDoClubePublicoSchema>;

/** `/dados/futebol/clube/<slug>.json`: lista de campeonatos do clube, já
 * ordenada por CA-07.4 pelo pipeline (`ordenarCampeonatos`, DOM-04). */
export const clubeFutebolPublicoSchema = z.array(campeonatoDoClubePublicoSchema);

export type ClubeFutebolPublico = z.infer<typeof clubeFutebolPublicoSchema>;

export const URL_FUTEBOL_BRASILEIRAO = '/dados/futebol/brasileirao.json';

export function urlFutebolClube(clubeId: string): string {
  return `/dados/futebol/clube/${clubeId}.json`;
}
