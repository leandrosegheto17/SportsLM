// dominio/tipos/futebol.ts — DOM-01 (TASK.md Lote 3)
//
// `Clube`, `PaletaClube`, `Competicao`, `ParticipacaoClube`, `Partida`,
// `LinhaClassificacao`, `Zona` (SDD §5.2). Módulo puro, sem I/O
// (GUARDRAILS.md §5).
//
// Decisões de reaproveitamento registradas (TASK.md §6):
//
// - `Clube`: `pipeline/config/clubes.ts` (CFG-02) já valida os campos "base"
//   (id/nome/nomeCurto/sigla/corBase/idsProvedor) do arquivo de configuração
//   `config/clubes-2026.json`, explicitamente **sem** `paleta` (a derivação é
//   PUB-01, Lote 6). O `Clube` de domínio do SDD §5.2 é um superconjunto —
//   dado já processado, com `paleta` obrigatória. Não importamos o schema de
//   CFG-02 aqui (direção de dependência: `dominio/` não importa de
//   `pipeline/`, SDD §2.1 — é `pipeline`/PUB-01 quem consome `dominio` para
//   produzir o `Clube` completo, não o contrário); em vez disso, redefinimos
//   localmente os mesmos campos-base com a mesma validação (slug/hex/sigla),
//   e acrescentamos `paleta`/`paletaManual`. Duplicação de regex mínima
//   (slug/hex), não de decisão de produto — se um dia convier inverter a
//   direção (CFG-02 passar a importar os validadores-base daqui), é refino de
//   Coordenador, não desta tarefa.
// - `Zona`: `config/zonas.ts` (CFG-04) já define `TOKENS_DE_ZONA`/`TokenDeZona`
//   (os 4 tokens fixos do design system, RF-18/TR-19) e uma `Faixa` estrutural
//   idêntica a `Zona` — mas (a) não exporta o schema de uma faixa isolada, só
//   o do arquivo inteiro (`ZonasConfigSchema`, um array), e (b) pela mesma
//   direção de dependência do item acima (`dominio/` não importa de
//   `config/`), os 4 tokens são redefinidos aqui em vez de importados. Mesmo
//   refino futuro sinalizado: `config/zonas.ts` poderia vir a importar
//   `TOKENS_DE_ZONA`/`zonaSchema` daqui, e não o contrário.

import { z } from 'zod';
import { corHexSchema, slugSchema } from './comuns';

/** Tokens de zona fixos do design system (UX-SPEC §3.2/§3.8, RF-18, TR-19) —
 * idênticos aos de `config/zonas.ts` (CFG-04). Cores fixas do sistema, nunca
 * de clube. Qualquer novo token exige atualização combinada deste arquivo,
 * de `config/zonas.ts` e de `app/design-system/tokens.css`. */
export const TOKENS_DE_ZONA = [
  'libertadores',
  'pre-libertadores',
  'sul-americana',
  'rebaixamento',
] as const;

export type TokenDeZona = (typeof TOKENS_DE_ZONA)[number];

/** `PaletaClube` (SDD §5.2, ADR-017): derivada de `corBase` e validada por
 * contraste no pipeline (PUB-01); a SPA só aplica como custom properties. */
export const paletaClubeSchema = z.object({
  acromatico: z.boolean(),
  identidade: corHexSchema,
  faixaB: corHexSchema,
  identidadeTexto: corHexSchema,
  acento: corHexSchema,
  acentoSobreEscuro: corHexSchema,
  suave: corHexSchema,
  suaveEscuro: corHexSchema,
  identidadeEscuro: corHexSchema,
  faixaBEscuro: corHexSchema,
  identidadeTextoEscuro: corHexSchema,
});

export type PaletaClube = z.infer<typeof paletaClubeSchema>;

/** `Clube` (SDD §5.2): campos base (RN-04) + `paleta` derivada (ADR-017). */
export const clubeSchema = z.object({
  id: slugSchema, // slug estável: 'palmeiras', 'atletico-mg'
  nome: z.string().min(1),
  nomeCurto: z.string().min(1),
  sigla: z.string().regex(/^[A-Z]{3}$/, 'sigla deve ter exatamente 3 letras maiúsculas'),
  corBase: corHexSchema, // entrada da derivação (ADR-017)
  paleta: paletaClubeSchema, // derivada e validada no pipeline (ADR-017)
  paletaManual: paletaClubeSchema.partial().optional(), // override, mesma validação
  idsProvedor: z.record(z.string(), z.union([z.string(), z.number()])), // casamento por id, nunca por nome
});

export type Clube = z.infer<typeof clubeSchema>;

/** `Competicao` (SDD §5.2). */
export const competicaoSchema = z.object({
  id: slugSchema, // 'brasileirao-serie-a', 'paulista'
  nome: z.string().min(1),
  temporada: z.number().int(),
  formato: z.enum(['pontos-corridos', 'grupos', 'mata-mata', 'misto']),
  janela: z.object({ inicio: z.string(), fim: z.string() }),
  provedor: z.string().min(1).nullable(), // null = sem cobertura (CA-07.2)
  ultimaAtualizacao: z.string().nullable(),
});

export type Competicao = z.infer<typeof competicaoSchema>;

const resumoParticipacaoSchema = z.object({
  jogos: z.number().int().min(0),
  v: z.number().int().min(0),
  e: z.number().int().min(0),
  d: z.number().int().min(0),
  gp: z.number().int().min(0),
  gc: z.number().int().min(0),
  sg: z.number().int(),
  pontos: z.number().int().min(0),
  aproveitamento: z.number().min(0).max(100), // pontos ÷ (jogos×3), % (I-13)
  posicao: z.number().int().min(1).nullable(),
});

/** `ParticipacaoClube` (SDD §5.2). */
export const participacaoClubeSchema = z.object({
  competicaoId: slugSchema,
  clubeId: slugSchema,
  status: z.enum(['nao-iniciado', 'em-andamento', 'eliminado', 'concluido', 'sem-dados']),
  faseAtual: z.string().nullable(), // 'Fase de grupos', 'Oitavas'
  resultadoFinal: z.string().nullable(), // 'Campeão', 'Vice', 'Eliminado nas quartas'
  resumo: resumoParticipacaoSchema.nullable(),
});

export type ParticipacaoClube = z.infer<typeof participacaoClubeSchema>;

/** `Partida` (SDD §5.2). */
export const partidaSchema = z.object({
  id: z.string().min(1),
  competicaoId: slugSchema,
  rodada: z.number().int().min(1).nullable(),
  fase: z.string().nullable(),
  mandanteId: slugSchema,
  visitanteId: slugSchema,
  dataHora: z.string().nullable(), // null → "data a definir" (CA-10.4)
  horarioDefinido: z.boolean(), // false → "horário a definir" (CA-08.8)
  estadio: z.string().nullable(),
  status: z.enum([
    'agendada',
    'aguardando-resultado',
    'finalizada',
    'adiada',
    'cancelada',
  ]),
  placar: z
    .object({ mandante: z.number().int().min(0), visitante: z.number().int().min(0) })
    .nullable(),
});

export type Partida = z.infer<typeof partidaSchema>;

/** `LinhaClassificacao` (SDD §5.2). */
export const linhaClassificacaoSchema = z.object({
  competicaoId: slugSchema,
  grupo: z.string().nullable(),
  posicao: z.number().int().min(1),
  clubeId: slugSchema,
  pontos: z.number().int().min(0),
  jogos: z.number().int().min(0),
  v: z.number().int().min(0),
  e: z.number().int().min(0),
  d: z.number().int().min(0),
  gp: z.number().int().min(0),
  gc: z.number().int().min(0),
  sg: z.number().int(),
  aproveitamento: z.number().min(0).max(100), // pontos ÷ (jogos×3), % (I-13)
  ultimosCinco: z.array(z.enum(['V', 'E', 'D'])), // CA-10.1
});

export type LinhaClassificacao = z.infer<typeof linhaClassificacaoSchema>;

/** `Zona` (SDD §5.2, RN-15/RF-18): faixa de título/vagas continentais/
 * rebaixamento da tabela do Brasileirão. Estruturalmente idêntica a `Faixa`
 * de `config/zonas.ts` (CFG-04) — ver nota de reaproveitamento no topo do
 * arquivo sobre por que o schema é redefinido aqui em vez de importado. */
export const zonaSchema = z.object({
  de: z.number().int().min(1),
  ate: z.number().int().min(1),
  rotulo: z.string().min(1),
  token: z.enum(TOKENS_DE_ZONA),
});

export type Zona = z.infer<typeof zonaSchema>;
