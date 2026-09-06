// dominio/noticias/avaliador-fontes.test.ts — ING-N-05 (TASK.md Lote 4)
//
// Testes por tabela cobrindo RN-08 (falhas consecutivas > 6h / sem item novo
// > 72h), CA-15.6 (evento de severidade alta só para a fonte fixa) e CA-01.2
// ("instável desde <data/hora>").
//
// Nota sobre os fixtures de falha consecutiva: `gerarSequencia` cria N
// registros a cada 30 min (RNF-06/CA-15.1) terminando em `fimIso` (o mais
// recente); o mais antigo fica `(N-1)*30min` antes de `fimIso`. Com N=12,
// isso é 5h30 antes de `fimIso`. O "span" avaliado (RN-08, > 6h) é sempre
// `agora - instante do registro mais antigo`, então o valor de `fimIso` em
// relação a `agora` desloca o span: `fimIso = agora - 30min` → span
// exatamente 6h (não excede); `fimIso` mais cedo → span > 6h (excede).

import { describe, expect, it } from 'vitest';
import {
  avaliarCatalogo,
  avaliarFonte,
  contarFalhasConsecutivas,
  type RegistroTentativaAvaliavel,
} from './avaliador-fontes';

const TRINTA_MIN_MS = 30 * 60 * 1000;

function gerarSequencia(
  fonteId: string,
  fimIso: string,
  quantidade: number,
  resultado: RegistroTentativaAvaliavel['resultado'],
  itensObtidos?: number,
): RegistroTentativaAvaliavel[] {
  const fimMs = new Date(fimIso).getTime();
  const registros: RegistroTentativaAvaliavel[] = [];
  for (let i = 0; i < quantidade; i += 1) {
    const instante = fimMs - i * TRINTA_MIN_MS;
    registros.push({
      fonteId,
      feedId: 'feed-1',
      horario: new Date(instante).toISOString(),
      resultado,
      ...(resultado === 'ok' ? { itensObtidos: itensObtidos ?? 1 } : {}),
    });
  }
  return registros;
}

const AGORA = new Date('2026-09-06T12:00:00.000Z');

describe('avaliarFonte — RN-08 falhas consecutivas', () => {
  it('12 falhas consecutivas com span claramente > 6h → instável', () => {
    // fim=11:00 → mais antiga em 05:30 → span até `agora` (12:00) = 6h30.
    const registros = gerarSequencia(
      'uol-esporte',
      '2026-09-06T11:00:00.000Z',
      12,
      'falha',
    );
    const avaliacao = avaliarFonte('uol-esporte', registros, false, AGORA);
    expect(avaliacao.estado).toBe('instavel');
    expect(avaliacao.motivo).toBe('falhas-consecutivas');
    expect(avaliacao.desde).toBe('2026-09-06T05:30:00.000Z');
  });

  it('11 falhas consecutivas (abaixo do limiar de 12) → estável, mesmo com span grande', () => {
    const registros = gerarSequencia(
      'uol-esporte',
      '2026-09-06T11:00:00.000Z',
      11,
      'falha',
    );
    expect(avaliarFonte('uol-esporte', registros, false, AGORA).estado).toBe('estavel');
  });

  it('12 falhas com span exatamente 6h (não excede) → estável', () => {
    // fim=11:30 → mais antiga em 06:00 → span até `agora` (12:00) = 6h exatas.
    const registros = gerarSequencia(
      'uol-esporte',
      '2026-09-06T11:30:00.000Z',
      12,
      'falha',
    );
    expect(avaliarFonte('uol-esporte', registros, false, AGORA).estado).toBe('estavel');
  });

  it('12 falhas com span > 6h por poucos minutos → instável', () => {
    // fim=11:29 → mais antiga em 05:59 → span = 6h01.
    const registros = gerarSequencia(
      'uol-esporte',
      '2026-09-06T11:29:00.000Z',
      12,
      'falha',
    );
    expect(avaliarFonte('uol-esporte', registros, false, AGORA).estado).toBe('instavel');
  });

  it('sucesso (mesmo sem item novo) interrompe a sequência de falhas', () => {
    const registros = gerarSequencia(
      'uol-esporte',
      '2026-09-06T11:00:00.000Z',
      12,
      'falha',
    );
    // Insere um 'ok' sem item novo no meio da sequência, quebrando a contagem.
    const alvo = registros[6];
    if (alvo === undefined) throw new Error('fixture inválido');
    registros[6] = { ...alvo, resultado: 'ok', itensObtidos: 0 };
    expect(avaliarFonte('uol-esporte', registros, false, AGORA).estado).toBe('estavel');
  });

  it('ciclo "pulado" no meio da sequência é transparente — não interrompe nem conta', () => {
    const registros = gerarSequencia(
      'uol-esporte',
      '2026-09-06T11:00:00.000Z',
      12,
      'falha',
    );
    const comPulado: RegistroTentativaAvaliavel[] = [
      ...registros,
      {
        fonteId: 'uol-esporte',
        feedId: 'feed-2',
        horario: '2026-09-06T08:15:00.000Z',
        resultado: 'pulado',
        motivo: 'frequenciaMaximaMin ainda não atingida',
      },
    ];
    const avaliacao = avaliarFonte('uol-esporte', comPulado, false, AGORA);
    expect(avaliacao.estado).toBe('instavel');
    expect(avaliacao.motivo).toBe('falhas-consecutivas');
  });

  it('multi-feed: um feed falha e outro entrega item novo no mesmo ciclo → ciclo conta como entrega', () => {
    const registros = gerarSequencia(
      'gazeta-esportiva',
      '2026-09-06T11:00:00.000Z',
      12,
      'falha',
    );
    // No ciclo mais recente (mesmo `horario` do primeiro registro gerado),
    // um segundo feed da mesma fonte entrega item novo.
    registros.push({
      fonteId: 'gazeta-esportiva',
      feedId: 'feed-2',
      horario: '2026-09-06T11:00:00.000Z',
      resultado: 'ok',
      itensObtidos: 3,
    });
    expect(avaliarFonte('gazeta-esportiva', registros, false, AGORA).estado).toBe(
      'estavel',
    );
  });
});

describe('avaliarFonte — RN-08 sem item novo > 72h', () => {
  it('última entrega há mais de 72h, sem falhas recentes → instável', () => {
    const ultimaEntrega = '2026-09-03T11:00:00.000Z'; // 73h antes de `AGORA`
    const registros: RegistroTentativaAvaliavel[] = [
      {
        fonteId: 'terra-esportes',
        feedId: 'feed-1',
        horario: ultimaEntrega,
        resultado: 'ok',
        itensObtidos: 2,
      },
      {
        fonteId: 'terra-esportes',
        feedId: 'feed-1',
        horario: '2026-09-06T11:30:00.000Z',
        resultado: 'ok',
        itensObtidos: 0,
      },
    ];
    const avaliacao = avaliarFonte('terra-esportes', registros, false, AGORA);
    expect(avaliacao.estado).toBe('instavel');
    expect(avaliacao.motivo).toBe('sem-item-novo');
    expect(avaliacao.desde).toBe(ultimaEntrega);
  });

  it('última entrega há exatamente 72h (não excede) → estável', () => {
    const ultimaEntrega = '2026-09-03T12:00:00.000Z'; // exatamente 72h antes
    const registros: RegistroTentativaAvaliavel[] = [
      {
        fonteId: 'terra-esportes',
        feedId: 'feed-1',
        horario: ultimaEntrega,
        resultado: 'ok',
        itensObtidos: 2,
      },
    ];
    expect(avaliarFonte('terra-esportes', registros, false, AGORA).estado).toBe(
      'estavel',
    );
  });

  it('nunca entregou item — conta desde a tentativa mais antiga do histórico', () => {
    const primeiraTentativa = '2026-09-03T10:00:00.000Z'; // 74h antes
    const registros: RegistroTentativaAvaliavel[] = [
      {
        fonteId: 'ge',
        feedId: '(nenhum)',
        horario: primeiraTentativa,
        resultado: 'pulado',
        motivo: 'sem feed',
      },
      {
        fonteId: 'ge',
        feedId: '(nenhum)',
        horario: '2026-09-06T11:30:00.000Z',
        resultado: 'pulado',
        motivo: 'sem feed',
      },
    ];
    const avaliacao = avaliarFonte('ge', registros, true, AGORA);
    expect(avaliacao.estado).toBe('instavel');
    expect(avaliacao.motivo).toBe('sem-item-novo');
    expect(avaliacao.desde).toBe(primeiraTentativa);
  });

  it('entrega recente reseta o relógio de "sem item novo" mesmo com falhas antigas', () => {
    const registros: RegistroTentativaAvaliavel[] = [
      {
        fonteId: 'terra-esportes',
        feedId: 'feed-1',
        horario: '2026-08-01T00:00:00.000Z',
        resultado: 'falha',
        motivo: 'timeout',
      },
      {
        fonteId: 'terra-esportes',
        feedId: 'feed-1',
        horario: '2026-09-06T11:00:00.000Z',
        resultado: 'ok',
        itensObtidos: 5,
      },
    ];
    expect(avaliarFonte('terra-esportes', registros, false, AGORA).estado).toBe(
      'estavel',
    );
  });

  it('histórico vazio → estável (sem tentativas para avaliar)', () => {
    expect(avaliarFonte('espn-brasil', [], false, AGORA).estado).toBe('estavel');
  });
});

describe('avaliarFonte — CA-15.6 severidade alta só para a fonte fixa (GE)', () => {
  it('fonte fixa (GE) instável → evento de severidade alta presente', () => {
    const registros = gerarSequencia('ge', '2026-09-06T11:00:00.000Z', 12, 'falha');
    const avaliacao = avaliarFonte('ge', registros, true, AGORA);
    expect(avaliacao.estado).toBe('instavel');
    expect(avaliacao.evento).toEqual({
      fonteId: 'ge',
      severidade: 'alta',
      motivo: 'falhas-consecutivas',
      em: AGORA.toISOString(),
    });
  });

  it('fonte não-fixa instável → nenhum evento de severidade alta', () => {
    const registros = gerarSequencia(
      'uol-esporte',
      '2026-09-06T11:00:00.000Z',
      12,
      'falha',
    );
    const avaliacao = avaliarFonte('uol-esporte', registros, false, AGORA);
    expect(avaliacao.estado).toBe('instavel');
    expect(avaliacao.evento).toBeUndefined();
  });

  it('fonte fixa estável → nenhum evento', () => {
    const registros: RegistroTentativaAvaliavel[] = [
      {
        fonteId: 'ge',
        feedId: '(nenhum)',
        horario: '2026-09-06T11:30:00.000Z',
        resultado: 'ok',
        itensObtidos: 1,
      },
    ];
    const avaliacao = avaliarFonte('ge', registros, true, AGORA);
    expect(avaliacao.estado).toBe('estavel');
    expect(avaliacao.evento).toBeUndefined();
  });

  it('fonte não-fixa com falhas consecutivas e também sem item novo → prioriza motivo falhas-consecutivas', () => {
    // 12 falhas consecutivas recentes (span > 6h) e nenhuma entrega jamais.
    const registros = gerarSequencia(
      'uol-esporte',
      '2026-09-06T11:00:00.000Z',
      12,
      'falha',
    );
    const avaliacao = avaliarFonte('uol-esporte', registros, false, AGORA);
    expect(avaliacao.motivo).toBe('falhas-consecutivas');
  });
});

describe('avaliarCatalogo', () => {
  it('avalia múltiplas fontes independentemente', () => {
    const resultado = avaliarCatalogo(
      [
        {
          fonteId: 'ge',
          fixa: true,
          registros: gerarSequencia('ge', '2026-09-06T11:00:00.000Z', 12, 'falha'),
        },
        {
          fonteId: 'espn-brasil',
          fixa: false,
          registros: [
            {
              fonteId: 'espn-brasil',
              feedId: 'espn-top',
              horario: '2026-09-06T11:30:00.000Z',
              resultado: 'ok',
              itensObtidos: 3,
            },
          ],
        },
      ],
      AGORA,
    );
    expect(resultado).toHaveLength(2);
    const [avaliacaoGe, avaliacaoEspn] = resultado;
    expect(avaliacaoGe).toMatchObject({ fonteId: 'ge', estado: 'instavel' });
    expect(avaliacaoGe?.evento?.severidade).toBe('alta');
    expect(avaliacaoEspn).toMatchObject({ fonteId: 'espn-brasil', estado: 'estavel' });
    expect(avaliacaoEspn?.evento).toBeUndefined();
  });
});

describe('contarFalhasConsecutivas (usado por ING-N-07 no status.json, SDD §5.4)', () => {
  it('conta a sequência de falha em curso, mais recente primeiro', () => {
    const registros = gerarSequencia(
      'uol-esporte',
      '2026-09-06T11:00:00.000Z',
      5,
      'falha',
    );
    expect(contarFalhasConsecutivas(registros)).toBe(5);
  });

  it('sucesso interrompe a contagem (mesma semântica de avaliarFonte)', () => {
    const falhas = gerarSequencia('uol-esporte', '2026-09-06T10:00:00.000Z', 3, 'falha');
    const sucesso = gerarSequencia('uol-esporte', '2026-09-06T11:00:00.000Z', 1, 'ok', 2);
    expect(contarFalhasConsecutivas([...falhas, ...sucesso])).toBe(0);
  });

  it('histórico vazio conta zero', () => {
    expect(contarFalhasConsecutivas([])).toBe(0);
  });

  it('ciclo `pulado` é transparente — não conta e não interrompe', () => {
    const falhas = gerarSequencia('uol-esporte', '2026-09-06T10:00:00.000Z', 3, 'falha');
    const pulado = gerarSequencia('uol-esporte', '2026-09-06T10:30:00.000Z', 1, 'pulado');
    expect(contarFalhasConsecutivas([...falhas, ...pulado])).toBe(3);
  });
});
