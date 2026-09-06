// config/zonas.ts — CFG-04 (RN-15/RF-18/CA-18.1/CA-18.2, SDD §2.6/§4.4)
//
// Faixas de classificação do Brasileirão (título/vagas continentais/
// rebaixamento) são configuração por temporada, nunca código (RN-15). Este
// módulo define o contrato (schema Zod) e o carregador de
// `config/zonas-<temporada>.json`.
//
// Decisão de detalhe registrada (TASK.md §6): **nenhum `config/zonas-2026.json`
// é publicado por esta tarefa.** RN-15 registra explicitamente que as faixas de
// 2026 "a confirmar no regulamento", e a própria regra prevê a exceção "sem
// configuração → sem faixas" com CA-18.2 tratando a ausência como estado
// válido (não um placeholder de erro). Publicar agora um arquivo com números
// de faixa inventados arriscaria apresentar como oficial uma configuração que
// ninguém confirmou no regulamento da CBF — o que essa própria RN-15 pede
// para evitar. Quando o regulamento 2026 for confirmado (fora do escopo desta
// tarefa), basta adicionar `config/zonas-2026.json` no formato validado por
// `ZonasConfigSchema` abaixo; nenhum código muda.
//
// Interpretação registrada do critério de aceite "presente, soma de faixas
// bate com 20 posições" (RN-04 — Série A tem 20 clubes): a validação garante
// que as faixas nunca se sobrepõem, nunca saem do intervalo 1–20, e que a
// soma das posições cobertas nunca excede 20 — sem exigir que as 20 posições
// estejam necessariamente cobertas por alguma faixa. O próprio formato real
// do Brasileirão (título+Libertadores 1–4, pré-Libertadores 5–6,
// Sul-Americana 7–12, rebaixamento 17–20) deixa o meio de tabela (13–16) sem
// faixa — e a legenda do UX-SPEC (§3.2, linha 823) só lista 4 tokens fixos,
// sem um 5º token neutro para "meio de tabela". Exigir soma exatamente igual
// a 20 forçaria a inventar uma faixa que não existe no regulamento real nem
// no design system; por isso "bate com" foi lido como "é consistente com"
// (não excede, não sobrepõe), não como "soma exatamente 20".

import { z } from 'zod';

/** Tokens de zona fixos do design system (UX-SPEC §3.2/§3.8, RF-18, TR-19) —
 * cores fixas do sistema, nunca de clube. Qualquer novo token exige
 * atualização combinada deste schema e de `app/design-system/tokens.css`. */
export const TOKENS_DE_ZONA = [
  'libertadores',
  'pre-libertadores',
  'sul-americana',
  'rebaixamento',
] as const;

export type TokenDeZona = (typeof TOKENS_DE_ZONA)[number];

/** RN-04 — Série A do Brasileirão tem sempre 20 clubes. */
export const TOTAL_POSICOES_BRASILEIRAO = 20;

const FaixaSchema = z
  .object({
    de: z.number().int().min(1).max(TOTAL_POSICOES_BRASILEIRAO),
    ate: z.number().int().min(1).max(TOTAL_POSICOES_BRASILEIRAO),
    rotulo: z.string().min(1),
    token: z.enum(TOKENS_DE_ZONA),
  })
  .refine((faixa) => faixa.de <= faixa.ate, {
    message: '"de" não pode ser maior que "ate".',
  });

export type Faixa = z.infer<typeof FaixaSchema>;

/**
 * Schema do arquivo `config/zonas-<temporada>.json` inteiro: lista de faixas
 * sem sobreposição, dentro de 1–20, cuja soma de posições cobertas nunca
 * excede as 20 posições da tabela (RN-04) — ver "Interpretação registrada"
 * acima sobre o que "bate com 20 posições" significa aqui.
 */
export const ZonasConfigSchema = z.array(FaixaSchema).superRefine((faixas, ctx) => {
  const ordenadas = [...faixas].sort((a, b) => a.de - b.de);
  let fimDaFaixaAnterior = 0;
  let somaDePosicoesCobertas = 0;

  for (const faixa of ordenadas) {
    if (faixa.de <= fimDaFaixaAnterior) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Faixas sobrepostas: a posição ${faixa.de} já pertence a outra faixa.`,
      });
      return;
    }
    somaDePosicoesCobertas += faixa.ate - faixa.de + 1;
    fimDaFaixaAnterior = faixa.ate;
  }

  if (somaDePosicoesCobertas > TOTAL_POSICOES_BRASILEIRAO) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Soma das faixas (${somaDePosicoesCobertas}) excede as ${TOTAL_POSICOES_BRASILEIRAO} posições do Brasileirão (RN-04).`,
    });
  }
});

export type ZonasConfig = z.infer<typeof ZonasConfigSchema>;

/**
 * Valida o conteúdo já lido (string JSON) de um arquivo de zonas. Função pura
 * — não toca em disco — para ser testável por tabela sem I/O (TASK.md
 * Diretriz #6: entrada externa sempre passa por Zod antes de entrar no
 * domínio; falha é descarte com registro, nunca correção heurística).
 */
export function analisarZonas(conteudoJson: string): ZonasConfig {
  const json: unknown = JSON.parse(conteudoJson);
  return ZonasConfigSchema.parse(json);
}

/** Dependências de sistema de arquivos injetáveis, para o carregador ser
 * testável sem tocar no disco real. */
export interface DependenciasDeArquivo {
  existeArquivo: (caminho: string) => boolean;
  lerArquivo: (caminho: string) => string;
}

/**
 * Carrega e valida `config/zonas-<temporada>.json`. A ausência do arquivo é
 * o estado válido previsto por CA-18.2/RN-15 ("sem configuração → sem
 * faixas") — retorna `null`, nunca lança nem registra erro nesse caso.
 * Conteúdo presente mas inválido (esquema ou consistência) lança, pois é
 * erro de configuração publicada, não ausência.
 */
export function carregarZonas(
  caminhoArquivo: string,
  dependencias: DependenciasDeArquivo,
): ZonasConfig | null {
  if (!dependencias.existeArquivo(caminhoArquivo)) {
    return null;
  }

  return analisarZonas(dependencias.lerArquivo(caminhoArquivo));
}
