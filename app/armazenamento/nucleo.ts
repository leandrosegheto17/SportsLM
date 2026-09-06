// app/armazenamento/nucleo.ts — UI-DS-09 (TASK.md Lote 7)
//
// Mecânica comum de persistência local reutilizada por `preferencias.ts` e
// `cenario.ts` (ADR-005): detecção de disponibilidade do `localStorage` por
// escrita de teste, leitura bruta e escrita nunca lançam exceção — qualquer
// falha (modo privado, cota excedida, política de armazenamento) degrada
// para "modo memória", nunca quebra a aplicação (ADR-005 regra 4, CA-11.9,
// CA-13.3). Fica em `app/` (não em `dominio/`), pois faz I/O de
// `localStorage` — proibido em `dominio/` (SDD §2.1/GUARDRAILS.md §5).

const CHAVE_TESTE_DISPONIBILIDADE = '__sportslm_teste_disponibilidade__';

/**
 * Detecta se o `localStorage` está disponível e utilizável, via escrita de
 * teste dentro de `try/catch` (ADR-005 regra 4) — cobre tanto a ausência da
 * API (SSR/ambientes restritos) quanto exceções em tempo de uso (modo
 * privado de alguns navegadores, cota já excedida).
 */
export function armazenamentoEstaDisponivel(
  armazenamento:
    | Pick<Storage, 'setItem' | 'removeItem'>
    | undefined = globalThis.localStorage,
): boolean {
  if (!armazenamento) {
    return false;
  }

  try {
    armazenamento.setItem(CHAVE_TESTE_DISPONIBILIDADE, '1');
    armazenamento.removeItem(CHAVE_TESTE_DISPONIBILIDADE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lê uma chave do armazenamento sem nunca lançar. Retorna `null` tanto para
 * "nada salvo" quanto para "armazenamento indisponível" — o chamador não
 * precisa (nem deve) distinguir os dois para decidir o valor padrão
 * (CA-13.3: "limpo/indisponível" tratados da mesma forma).
 */
export function lerBrutoSemLancar(
  chave: string,
  armazenamento: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): string | null {
  if (!armazenamento) {
    return null;
  }

  try {
    return armazenamento.getItem(chave);
  } catch {
    return null;
  }
}

/**
 * Escreve uma chave sem nunca lançar. Retorna `true` quando persistiu de
 * fato, `false` quando caiu em modo memória (falha silenciosa, com aviso via
 * `console.warn` — mesmo padrão de `app/tema/tema.ts`). O chamador usa o
 * retorno para exibir o aviso "não será guardado" de CA-11.9/CA-13.3 quando
 * fizer sentido na tela.
 */
export function escreverBrutoSemLancar(
  chave: string,
  valor: string,
  armazenamento: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): boolean {
  if (!armazenamento) {
    console.warn(
      `SportsLM: modo memória — "${chave}" não será persistido (localStorage indisponível).`,
    );
    return false;
  }

  try {
    armazenamento.setItem(chave, valor);
    return true;
  } catch (erro) {
    console.warn(
      `SportsLM: modo memória — não foi possível persistir "${chave}" (localStorage indisponível?).`,
      erro,
    );
    return false;
  }
}

/** Remove uma chave sem nunca lançar. */
export function removerBrutoSemLancar(
  chave: string,
  armazenamento: Pick<Storage, 'removeItem'> | undefined = globalThis.localStorage,
): void {
  if (!armazenamento) {
    return;
  }

  try {
    armazenamento.removeItem(chave);
  } catch (erro) {
    console.warn(`SportsLM: não foi possível remover "${chave}".`, erro);
  }
}

/**
 * Fábrica de escrita com *debounce* (ADR-005 regra 1: só a grade de
 * palpites usa debounce — 250 ms — para não gravar a cada tecla numa
 * navegação por teclado; as demais preferências escrevem imediatamente,
 * CA-13.1). Função pura de composição, sem `setTimeout`/`Date.now()` fixo
 * embutido no domínio — vive em `app/`, testável com temporizadores falsos.
 */
export function criarEscritaComDebounce(
  escrever: (valor: string) => boolean,
  atrasoMs = 250,
): (valor: string) => void {
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  return (valor: string) => {
    if (temporizador !== undefined) {
      clearTimeout(temporizador);
    }
    temporizador = setTimeout(() => {
      escrever(valor);
    }, atrasoMs);
  };
}
