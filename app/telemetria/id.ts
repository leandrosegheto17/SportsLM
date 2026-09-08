// app/telemetria/id.ts — TEL-01 (TASK.md Lote 12)
//
// Identificador anônimo local (ADR-012 regra 2): UUID v4 gerado no
// dispositivo, guardado em `sportslm.anonimo.v1` — a MESMA chave já
// convencionada por `armazenamento/telemetriaId.ts` (UI-T03-02), reutilizada
// aqui em vez de duplicada. Não deriva de IP, dispositivo, rede ou
// comportamento; é apagado ao limpar o navegador (chave comum de
// `localStorage`) ou pelo botão "Trocar identificador anônimo" das
// configurações (`apagarIdentificadorAnonimo`, rótulo corrigido em
// REFAT-12-02/SEC-12-02 — a telemetria em si continua ativa); é reiniciável —
// a próxima chamada deste módulo, sem o valor salvo, gera um novo.
//
// Fica em `app/telemetria/`, não em `dominio/` (SDD §2.1): usa
// `localStorage` e a API `crypto` do navegador.

import { CHAVE_ARMAZENAMENTO_ANONIMO } from '../armazenamento/telemetriaId';
import { escreverBrutoSemLancar, lerBrutoSemLancar } from '../armazenamento/nucleo';

/**
 * Gera um UUID v4. Prefere `crypto.randomUUID` (disponível em todo navegador
 * moderno com contexto seguro); usa `crypto.getRandomValues` como
 * salvaguarda; e, na ausência total de `crypto` (ambiente muito restrito),
 * cai para `Math.random` — aceitável aqui porque o identificador não tem
 * nenhum uso de segurança, só precisa ser opaco e não colidir na prática.
 */
export function gerarIdAnonimo(): string {
  const cripto = globalThis.crypto as Crypto | undefined;

  if (typeof cripto?.randomUUID === 'function') {
    return cripto.randomUUID();
  }

  if (typeof cripto?.getRandomValues === 'function') {
    const bytes = cripto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  let resultado = '';
  for (const modelo of 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx') {
    if (modelo === '-') {
      resultado += '-';
      continue;
    }
    const aleatorio = Math.floor(Math.random() * 16);
    const digito = modelo === 'x' ? aleatorio : (aleatorio & 0x3) | 0x8;
    resultado += digito.toString(16);
  }
  return resultado;
}

/**
 * Lê o identificador anônimo já salvo ou cria (e persiste) um novo. Nunca
 * lança — em modo memória (`localStorage` indisponível), gera um novo a cada
 * chamada, degradando sem quebrar (mesmo padrão de `armazenamento/nucleo.ts`).
 */
export function obterOuCriarIdAnonimo(
  armazenamento:
    | (Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>)
    | undefined = globalThis.localStorage,
): string {
  const existente = lerBrutoSemLancar(CHAVE_ARMAZENAMENTO_ANONIMO, armazenamento);
  if (existente) {
    return existente;
  }

  const novo = gerarIdAnonimo();
  escreverBrutoSemLancar(CHAVE_ARMAZENAMENTO_ANONIMO, novo, armazenamento);
  return novo;
}
