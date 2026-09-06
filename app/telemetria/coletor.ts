// app/telemetria/coletor.ts — TEL-01 (TASK.md Lote 12)
//
// Sumidouro neutro dos eventos, sem acoplar a nenhum SDK de terceiro
// específico ainda: SPK-04 (qual ferramenta de telemetria gratuita) segue em
// aberto (TASK.md §2), então este módulo só acumula os eventos localmente,
// em memória, prontos para serem drenados por quem quer que implemente o
// envio de fato mais tarde (ex.: um `enviarParaProvedor` plugado aqui via
// `assinarColetor`, quando SPK-04 concluir) — sem I/O de rede nenhum por
// enquanto. Nenhum SDK (GoatCounter/Cloudflare, ADR-012 regra 4) é importado
// aqui; a decisão de qual usar não é deste módulo.

import type { EventoTelemetria } from './eventos';

const eventosRegistrados: EventoTelemetria[] = [];
const ouvintes = new Set<(evento: EventoTelemetria) => void>();

/** Acrescenta um evento ao buffer local e notifica quem estiver assinado
 * (futuro adaptador de envio, plugado por `assinarColetor`). Nunca lança. */
export function registrarNoColetor(evento: EventoTelemetria): void {
  eventosRegistrados.push(evento);
  for (const ouvinte of ouvintes) {
    ouvinte(evento);
  }
}

/** Snapshot só-leitura dos eventos acumulados nesta sessão — usado por
 * testes e por um futuro adaptador de envio que prefira drenar em lote. */
export function obterEventosRegistrados(): readonly EventoTelemetria[] {
  return eventosRegistrados;
}

/** Esvazia o buffer local. Uso principal: testes; e um futuro adaptador de
 * envio que confirme entrega antes de descartar. */
export function limparEventosRegistrados(): void {
  eventosRegistrados.length = 0;
}

/** Assina cada novo evento assim que registrado. Retorna a função de
 * cancelamento — mesmo formato de `assinarMudancasPreferencias`
 * (`armazenamento/preferencias.ts`), para um futuro adaptador de envio
 * plugar sem este módulo precisar conhecê-lo. */
export function assinarColetor(ouvinte: (evento: EventoTelemetria) => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}
