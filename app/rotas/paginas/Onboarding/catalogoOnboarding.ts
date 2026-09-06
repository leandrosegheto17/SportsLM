// app/rotas/paginas/Onboarding/catalogoOnboarding.ts — apoio a UI-T01-01
// (TASK.md Lote 8)
//
// Carrega a configuração de esportes/clubes/fontes/temporada necessária para
// o onboarding (T-01) e monta as `ReferenciasValidas` que
// `armazenamento/preferencias` (UI-DS-09) exige para validar o que estiver
// salvo no `localStorage` antes de confiar nele (Diretriz de Implementação #6).
//
// UX-SPEC §4 (T-01): "os 15 esportes e os 20 clubes vêm de configuração já
// presente no carregamento inicial" — hoje isso significa importar
// `config/*.json` como módulo do bundle da SPA, sem `fetch`: `app/dados/README.md`
// documenta que esses arquivos de configuração por temporada ficam fora do
// contrato de revalidação por hash de UI-DS-08 (`useSnapshot`), por isso esta
// tarefa não depende dele. Quando a publicação em `/dados/config/*.json`
// (Lote 6) for ligada à SPA por fetch, o único ponto a trocar é a origem dos
// `unknown` validados abaixo — a validação Zod já cobre os dois casos.
//
// `construirCatalogoOnboarding` nunca lança: qualquer falha de validação vira
// `null`, que a tela usa para acionar o estado "Erro" da Seção 4 do UX-SPEC
// ("Não conseguimos carregar a lista de clubes agora...").

import { z } from 'zod';
import esportesJson from '../../../../config/esportes.json';
import fontesJson from '../../../../config/fontes.json';
import clubesJson from '../../../../config/clubes-2026.json';
import campeonatosJson from '../../../../config/campeonatos-2026.json';
import { esportesSchema, type Esporte } from '../../../../config/esportes.schema';
import type { ReferenciasValidas } from '../../../armazenamento/preferencias';

/** Validação leve (só o `id`) de listas de configuração cujo schema completo
 * vive em módulos que fazem I/O de Node (`pipeline/config/clubes.ts`, CFG-02)
 * e por isso não podem ser importados pelo bundle do navegador — este módulo
 * só precisa do conjunto de ids válidos para `ReferenciasValidas`, não da
 * forma inteira de `Clube`/`Fonte`. */
const itemComIdSchema = z.object({ id: z.string().min(1) }).passthrough();
const listaComIdSchema = z.array(itemComIdSchema);

/**
 * Validação dos campos de `config/clubes-2026.json` (`pipeline/config/clubes.ts`,
 * CFG-02) necessários para a lista de escolha de time do passo 2 (UI-T01-02,
 * CA-06.1: "nome, identidade visual e busca por nome"). Duplicada aqui pela
 * mesma direção de dependência já documentada em `app/dados/configPublico.ts`
 * (`pipeline/` não pode ser importado por `app/`) — qualquer mudança de
 * contrato nos campos abaixo exige atualizar os dois lados (Diretriz de
 * Implementação #10). `corBase` é a única cor de clube que este módulo usa
 * (Diretriz #4: literal só permitido vindo de `clubes-2026.json`) — a paleta
 * derivada e validada por contraste (ADR-017), usada na transição final ao
 * confirmar, vem de `/dados/config/clubes-2026.json` publicado
 * (`app/dados/useClubesPublicos.ts`, UI-T02-01), nunca calculada aqui. */
const clubeCatalogoSchema = z
  .object({
    id: z.string().min(1),
    nomeCurto: z.string().min(1),
    sigla: z.string().min(1),
    corBase: z.string().min(1),
  })
  .passthrough();
const clubesCatalogoSchema = z.array(clubeCatalogoSchema);

export type ClubeCatalogo = z.infer<typeof clubeCatalogoSchema>;

const catalogoTemporadaSchema = z.object({ temporada: z.number().int() }).passthrough();

export interface CatalogoOnboarding {
  /** Os 15 esportes da Seção 2A (RN-06), na ordem exata de `config/esportes.json`
   * (CA-03.1). */
  readonly esportes: readonly Esporte[];
  /** Os 20 clubes da Série A da temporada corrente (RN-04/CA-06.1), na ordem
   * de `config/clubes-2026.json` — passo 2 do onboarding (UI-T01-02). */
  readonly clubes: readonly ClubeCatalogo[];
  readonly referencias: ReferenciasValidas;
  readonly temporadaAtual: number;
}

export interface BrutosCatalogoOnboarding {
  readonly esportes: unknown;
  readonly fontes: unknown;
  readonly clubes: unknown;
  readonly campeonatos: unknown;
}

/**
 * Valida os 4 arquivos de configuração e monta o `CatalogoOnboarding`.
 * Função pura (sem I/O) — separada de `construirCatalogoOnboarding` só para
 * ser testável sem precisar substituir os imports de `config/*.json`
 * (que o bundler resolve estaticamente). Retorna `null` (nunca lança) quando
 * algum arquivo não corresponde ao esquema esperado — a tela chamadora trata
 * isso como o estado "Erro" de UX-SPEC §4/T-01.
 */
export function avaliarCatalogoOnboarding(
  brutos: BrutosCatalogoOnboarding,
): CatalogoOnboarding | null {
  const esportesResultado = esportesSchema.safeParse(brutos.esportes);
  const fontesResultado = listaComIdSchema.safeParse(brutos.fontes);
  const clubesResultado = clubesCatalogoSchema.safeParse(brutos.clubes);
  const campeonatosResultado = catalogoTemporadaSchema.safeParse(brutos.campeonatos);

  if (
    !esportesResultado.success ||
    !fontesResultado.success ||
    !clubesResultado.success ||
    !campeonatosResultado.success
  ) {
    console.warn(
      'SportsLM: falha ao validar a configuração necessária para o onboarding (T-01).',
      {
        esportes: esportesResultado.success ? null : esportesResultado.error.issues,
        fontes: fontesResultado.success ? null : fontesResultado.error.issues,
        clubes: clubesResultado.success ? null : clubesResultado.error.issues,
        campeonatos: campeonatosResultado.success
          ? null
          : campeonatosResultado.error.issues,
      },
    );
    return null;
  }

  return {
    esportes: esportesResultado.data,
    clubes: clubesResultado.data,
    referencias: {
      esportesValidos: new Set(esportesResultado.data.map((esporte) => esporte.id)),
      fontesValidas: new Set(fontesResultado.data.map((fonte) => fonte.id)),
      clubesValidos: new Set(clubesResultado.data.map((clube) => clube.id)),
    },
    temporadaAtual: campeonatosResultado.data.temporada,
  };
}

/**
 * Monta o catálogo de onboarding a partir da configuração real da temporada
 * (bundle da SPA). Casca fina sobre `avaliarCatalogoOnboarding` — ver
 * comentário de topo deste arquivo sobre a troca futura para `/dados/config/*.json`
 * publicado.
 */
export function construirCatalogoOnboarding(): CatalogoOnboarding | null {
  return avaliarCatalogoOnboarding({
    esportes: esportesJson,
    fontes: fontesJson,
    clubes: clubesJson,
    campeonatos: campeonatosJson,
  });
}
