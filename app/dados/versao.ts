// app/dados/versao.ts — UI-DS-08 (TASK.md Lote 7)
//
// Esquema de `/dados/versao.json` (SDD §2.2): `{ geradoEm, hashes: { noticias,
// futebol, catalogo, status } }`, `no-cache`, é o único arquivo do contrato
// buscado sem condição — todo o resto do módulo (`clienteSnapshot.ts`)
// decide se rebusca cada arquivo comparando o hash da chave correspondente
// aqui contra o último hash usado para aquele arquivo.
//
// Entrada externa (GUARDRAILS.md §4): validada com Zod antes de entrar na
// aplicação — igual às três fronteiras já usadas em `dominio/`
// (feed/provedor/`localStorage`), agora para o próprio snapshot público.

import { z } from 'zod';

/** As 4 chaves de hash do contrato (SDD §2.2). `futebol` cobre tanto
 * `futebol/brasileirao.json` quanto `futebol/clube/<slug>.json` — o contrato
 * não expõe hash por clube, então qualquer arquivo do grupo "futebol" rebusca
 * quando esse hash muda (mesma granularidade que o pipeline publica). */
export const CHAVES_DE_HASH = ['noticias', 'futebol', 'catalogo', 'status'] as const;

export type ChaveDeHash = (typeof CHAVES_DE_HASH)[number];

export const esquemaVersao = z.object({
  geradoEm: z.string().min(1),
  hashes: z.object({
    noticias: z.string().min(1),
    futebol: z.string().min(1),
    catalogo: z.string().min(1),
    status: z.string().min(1),
  }),
});

export type Versao = z.infer<typeof esquemaVersao>;

/** Caminho fixo do contrato (SDD §2.2), relativo à raiz publicada. */
export const URL_VERSAO = '/dados/versao.json';
