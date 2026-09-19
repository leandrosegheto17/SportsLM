// Diagnóstico `participante-nao-configurado` (ADR-020 item 2, COB-17).
// Função pura: cruza ids de clubes da Série A vistos nos dados do provedor
// com `config.clubes`. Nunca altera a configuração — o humano decide incluir.

export interface DiagnosticoParticipantes {
  /** Vistos no provedor e ausentes da config (vai para log e status.json). */
  readonly naoConfigurados: readonly string[];
  /** Configurados nunca vistos (apenas para log). */
  readonly configuradosNuncaVistos: readonly string[];
}

function unicosOrdenados(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort();
}

export function diagnosticarParticipantes(
  idsVistos: readonly string[],
  clubesConfigurados: readonly string[],
): DiagnosticoParticipantes {
  const vistos = new Set(idsVistos);
  const configurados = new Set(clubesConfigurados);
  return {
    naoConfigurados: unicosOrdenados([...vistos].filter((id) => !configurados.has(id))),
    configuradosNuncaVistos: unicosOrdenados(
      [...configurados].filter((id) => !vistos.has(id)),
    ),
  };
}
