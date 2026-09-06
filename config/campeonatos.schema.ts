// config/campeonatos.schema.ts — CFG-03
//
// Schema Zod de `config/campeonatos-2026.json` (CFG-03, RN-05, SDD §5.2 —
// `Competicao`). Toda configuração de campeonato por temporada passa por este
// schema antes de qualquer consumo (diretriz 6 do TASK.md §1) — este arquivo é
// consumido tanto pelo teste da própria configuração quanto, mais adiante,
// pela ingestão de futebol (ING-F-01/Lote 4, fora do escopo desta tarefa).
//
// Decisão de modelagem (nota de implementação, TASK.md §6): `Competicao` em
// SDD §5.2 descreve o *runtime* de um campeonato (inclui `ultimaAtualizacao`,
// preenchido pelo pipeline). Esta configuração é a *entrada* estática por
// temporada — mesmos campos estruturais (`id`, `nome`, `formato`, `janela`,
// `provedor`), mais `categoria` (para agrupar estadual/Supercopa/Brasileirão/
// Copa do Brasil/continental/regional, como pede a descrição de CFG-03) e
// `clubes` (quais clubes da temporada disputam aquele campeonato — RN-05: "lista
// configurada por temporada, cruzada com participação efetiva segundo o
// provedor"). `ultimaAtualizacao` não pertence à configuração: é escrito pelo
// pipeline em runtime, não em `config/`.

import { z } from 'zod';

/** Slug estável kebab-case, usado tanto para `Campeonato.id` quanto `clubeId`. */
const SlugSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'deve ser um slug kebab-case (ex.: "brasileirao-serie-a")',
  );

const DataISOSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'deve ser uma data no formato AAAA-MM-DD');

/** Formato de disputa — mesmos 4 valores de `Competicao.formato` (SDD §5.2). */
export const FormatoCampeonatoSchema = z.enum([
  'pontos-corridos',
  'grupos',
  'mata-mata',
  'misto',
]);
export type FormatoCampeonato = z.infer<typeof FormatoCampeonatoSchema>;

/**
 * Agrupamento pedido pela descrição de CFG-03: "estadual, Supercopa,
 * Brasileirão, Copa do Brasil, continentais, regionais".
 */
export const CategoriaCampeonatoSchema = z.enum([
  'estadual',
  'supercopa',
  'brasileirao',
  'copa-do-brasil',
  'continental',
  'regional',
]);
export type CategoriaCampeonato = z.infer<typeof CategoriaCampeonatoSchema>;

const JanelaSchema = z
  .object({
    inicio: DataISOSchema,
    fim: DataISOSchema,
  })
  .strict()
  .refine((janela) => janela.inicio <= janela.fim, {
    message: 'janela.inicio deve ser anterior ou igual a janela.fim',
    path: ['fim'],
  });

export const CampeonatoConfigSchema = z
  .object({
    id: SlugSchema,
    nome: z.string().min(1),
    temporada: z.literal(2026),
    categoria: CategoriaCampeonatoSchema,
    formato: FormatoCampeonatoSchema,
    janela: JanelaSchema,
    /** `null` = sem cobertura confirmada por provedor gratuito (RN-05, CA-07.2). */
    provedor: z.string().min(1).nullable(),
    /** Ids de clube (RN-04) que disputam este campeonato na temporada. */
    clubes: z.array(SlugSchema),
    /**
     * Obrigatória quando `clubes` ainda está vazio — ex.: Supercopa/continentais
     * cujos participantes só são conhecidos após o desfecho da temporada
     * anterior. RN-05: a lista é "cruzada com participação efetiva segundo o
     * provedor" — aqui documentamos a pendência em vez de adivinhar clubes.
     */
    observacao: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (campeonato) => campeonato.clubes.length > 0 || campeonato.observacao !== undefined,
    {
      message:
        'campeonato sem clubes precisa de "observacao" explicando a pendência de definição',
      path: ['clubes'],
    },
  );
export type CampeonatoConfig = z.infer<typeof CampeonatoConfigSchema>;

export const ConfigCampeonatosSchema = z
  .object({
    temporada: z.literal(2026),
    campeonatos: z.array(CampeonatoConfigSchema).min(1),
  })
  .strict()
  .superRefine((config, ctx) => {
    const ids = new Set<string>();
    for (const [indice, campeonato] of config.campeonatos.entries()) {
      if (ids.has(campeonato.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `id de campeonato duplicado: "${campeonato.id}"`,
          path: ['campeonatos', indice, 'id'],
        });
      }
      ids.add(campeonato.id);
    }

    const brasileirao = config.campeonatos.find((c) => c.categoria === 'brasileirao');
    if (!brasileirao) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'nenhum campeonato com categoria "brasileirao" encontrado (RN-05/CFG-03)',
        path: ['campeonatos'],
      });
      return;
    }

    // Critério de aceite de CFG-03: todo clube que aparece em algum campeonato
    // da temporada aparece em ao menos o Brasileirão.
    const clubesNoBrasileirao = new Set(brasileirao.clubes);
    const universoDeClubes = new Set<string>();
    for (const campeonato of config.campeonatos) {
      for (const clubeId of campeonato.clubes) universoDeClubes.add(clubeId);
    }
    for (const clubeId of universoDeClubes) {
      if (!clubesNoBrasileirao.has(clubeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `clube "${clubeId}" participa de outro campeonato mas não aparece no Brasileirão`,
          path: ['campeonatos'],
        });
      }
    }
  });
export type ConfigCampeonatos = z.infer<typeof ConfigCampeonatosSchema>;
