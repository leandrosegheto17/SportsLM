import { z } from 'zod';

/**
 * Troca de tema (UX-SPEC §3.3, FUND-05): preferência do usuário entre "igual
 * ao sistema", "claro" e "escuro", persistida em `sportslm.tema.v1`. Este
 * módulo fica fora de `dominio/` de propósito — usa `localStorage` e
 * `window.matchMedia`, que são proibidos lá (SDD §2.1) — e fora de
 * `app/armazenamento/` (reservado a UI-DS-09, Lote 7, para
 * `preferencias`/`cenario`) porque o UX-SPEC define uma chave de
 * armazenamento própria e independente para o tema; UI-DS-09 pode compor
 * sobre estas funções mais tarde sem precisar redesenhá-las.
 *
 * Decisão de detalhe registrada (TASK.md §6): o valor persistido/aplicado ao
 * DOM é sempre a preferência ("sistema" | "claro" | "escuro"); a resolução
 * para o tema *efetivo* ("claro" | "escuro", o que de fato vira
 * `data-tema` em `<html>`) é feita em `calcularTemaEfetivo`, mantendo a
 * lógica de "sistema" só em JS — `tokens.css` não duplica
 * `@media (prefers-color-scheme)` para isso.
 */

export const PREFERENCIAS_DE_TEMA = ['sistema', 'claro', 'escuro'] as const;

export type PreferenciaDeTema = (typeof PREFERENCIAS_DE_TEMA)[number];

export type TemaEfetivo = 'claro' | 'escuro';

export const CHAVE_ARMAZENAMENTO_TEMA = 'sportslm.tema.v1';

const esquemaPreferenciaSalva = z.object({
  versaoEsquema: z.literal(1),
  preferencia: z.enum(PREFERENCIAS_DE_TEMA),
});

const PREFERENCIA_PADRAO: PreferenciaDeTema = 'sistema';

/**
 * Resolve a preferência ("sistema" | "claro" | "escuro") para o tema efetivo
 * que a folha de estilos entende (UX-SPEC §3.3). Função pura — recebe o sinal
 * do sistema por parâmetro, nunca lê `matchMedia` diretamente, para ser
 * testável por tabela sem jsdom.
 */
export function calcularTemaEfetivo(
  preferencia: PreferenciaDeTema,
  prefereEscuroNoSistema: boolean,
): TemaEfetivo {
  if (preferencia === 'claro') {
    return 'claro';
  }

  if (preferencia === 'escuro') {
    return 'escuro';
  }

  return prefereEscuroNoSistema ? 'escuro' : 'claro';
}

/**
 * Lê a preferência salva em `localStorage`. Entrada externa (GUARDRAILS.md
 * §4/TASK.md Diretriz #6): valida com Zod antes de usar; qualquer falha
 * (ausência, JSON inválido, esquema incompatível, `localStorage`
 * indisponível) é descarte silencioso para o padrão "sistema" — nunca
 * correção heurística.
 */
export function lerPreferenciaSalva(
  armazenamento: Pick<Storage, 'getItem'> = globalThis.localStorage,
): PreferenciaDeTema {
  try {
    const bruto = armazenamento.getItem(CHAVE_ARMAZENAMENTO_TEMA);

    if (bruto === null) {
      return PREFERENCIA_PADRAO;
    }

    const analisado: unknown = JSON.parse(bruto);
    const resultado = esquemaPreferenciaSalva.safeParse(analisado);

    if (!resultado.success) {
      console.warn(
        `SportsLM: preferência de tema salva em "${CHAVE_ARMAZENAMENTO_TEMA}" é inválida; usando "sistema".`,
        resultado.error.issues,
      );
      return PREFERENCIA_PADRAO;
    }

    return resultado.data.preferencia;
  } catch (erro) {
    console.warn(
      `SportsLM: não foi possível ler a preferência de tema (localStorage indisponível?); usando "sistema".`,
      erro,
    );
    return PREFERENCIA_PADRAO;
  }
}

/**
 * Persiste a preferência de tema. Falha de escrita (quota excedida,
 * `localStorage` indisponível em navegação privada etc.) não deve quebrar a
 * troca de tema em memória — só fica sem persistir entre sessões (modo
 * degradado, mesmo espírito de ADR-005; o aviso explícito de "modo memória"
 * na interface é UI-DS-09/T-03).
 */
export function salvarPreferencia(
  preferencia: PreferenciaDeTema,
  armazenamento: Pick<Storage, 'setItem'> = globalThis.localStorage,
): void {
  try {
    armazenamento.setItem(
      CHAVE_ARMAZENAMENTO_TEMA,
      JSON.stringify({ versaoEsquema: 1, preferencia }),
    );
  } catch (erro) {
    console.warn('SportsLM: não foi possível salvar a preferência de tema.', erro);
  }
}

/**
 * Aplica o tema efetivo ao documento (`data-tema` em `<html>`), acionando a
 * cascata de `:root[data-tema='escuro']` em `tokens.css` — troca instantânea,
 * sem F5 (critério de aceite de FUND-05).
 */
export function aplicarTemaNoDocumento(
  temaEfetivo: TemaEfetivo,
  documento: Pick<Document, 'documentElement'> = globalThis.document,
): void {
  documento.documentElement.dataset['tema'] = temaEfetivo;
}
