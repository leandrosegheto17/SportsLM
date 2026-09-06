// app/dados/configPublico.ts — UI-T02-01 (TASK.md Lote 8)
//
// Schema + caminho de `/dados/config/clubes-2026.json` (SDD §2.2): "20
// clubes: nome, nome curto, sigla, cor base e paleta de identidade derivada e
// validada (ADR-017)". Este é o arquivo de configuração por temporada — cache
// "longo", **sem** entrada em `versao.json/hashes` (ver `app/dados/README.md`)
// — por isso não passa pelo hash-revalidation de `useSnapshot`/`UI-DS-08`; a
// leitura é feita por `useClubesPublicos.ts` (busca única por sessão, sem
// polling).
//
// A `paleta` chega pronta do pipeline (PUB-01/`derivador-paleta`, Lote 6,
// concluído) — este módulo só valida o formato recebido, nunca deriva nem
// recalcula nada (ADR-017: "SPA nunca calcula a paleta").
//
// Reaproveita `paletaClubeSchema` de `dominio/tipos/futebol` (módulo puro,
// sem I/O — seguro de importar em `app/`); o restante dos campos é
// redefinido aqui em vez de importar de `pipeline/publicacao/gerador-
// snapshots.ts`, que faz I/O de `node:fs`/`node:crypto` e não pode entrar no
// bundle da SPA (o mesmo motivo documentado em `dominio/tipos/futebol.ts`
// para `Clube`/`Zona`: direção de dependência — `pipeline/` não pode ser
// importado por `app/`).

import { z } from 'zod';
import { paletaClubeSchema } from '../../dominio/tipos/futebol';

/** Uma entrada de `/dados/config/clubes-2026.json` — mesma forma de
 * `clubePublicoSchema` em `pipeline/publicacao/gerador-snapshots.ts`
 * (duplicada aqui pela direção de dependência acima; qualquer mudança de
 * contrato exige atualizar os dois lados, Diretriz de Implementação #10). */
export const clubePublicoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  nomeCurto: z.string().min(1),
  sigla: z.string().regex(/^[A-Z]{3}$/, 'sigla deve ter exatamente 3 letras maiúsculas'),
  corBase: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'corBase deve ser hex #RRGGBB'),
  paleta: paletaClubeSchema,
});

export type ClubePublico = z.infer<typeof clubePublicoSchema>;

export const clubesPublicosSchema = z.array(clubePublicoSchema);

/** Caminho fixo do contrato (SDD §2.2), relativo à raiz publicada. */
export const URL_CONFIG_CLUBES = '/dados/config/clubes-2026.json';
