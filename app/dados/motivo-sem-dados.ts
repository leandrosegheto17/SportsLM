// app/dados/motivo-sem-dados.ts — COB-26 (UX-SPEC T-05/T-06, rodada 4)
// Lógica pura: motivo de "sem dados" e frescor por competição.

import { estaEmAlerta } from '../../dominio/frescor';

export interface JanelaCompeticao {
  readonly inicio: string;
  readonly fim: string;
}

export type FrescorCompeticao = 'normal' | 'alerta' | 'encerrada' | 'pausado' | 'falha' | 'nunca';

const SEM_COBERTURA = new Set(['sem-cobertura', 'sem-dados-provedor', 'provedor-nao-registrado']);

/** Intervalos (min): 1 h com jogo próximo (alerta em 2 h), 6 h nos demais (12 h). */
const INTERVALO_COM_JOGO_MIN = 60;
const INTERVALO_SEM_JOGO_MIN = 360;

function ddmm(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

/** Texto canônico do motivo, ou `null` se há dado (o cartão mantém o dado). */
export function motivoSemDados(args: {
  resultado: string | null | undefined;
  janela: JanelaCompeticao;
  agora: Date;
  temDado: boolean;
}): string | null {
  const { resultado, janela, agora, temDado } = args;
  if (temDado) return null;
  if (resultado === null || resultado === undefined) return 'Sem dados disponíveis no momento';
  if (SEM_COBERTURA.has(resultado) || resultado === 'atualizada')
    return 'Cobertura indisponível nesta versão.';
  if (resultado === 'fora-da-janela') {
    const base = 'Fora da janela da competição.';
    return agora.getTime() < Date.parse(janela.inicio)
      ? `${base} Começa em ${ddmm(janela.inicio)}.`
      : base;
  }
  if (resultado === 'pausado-por-cota') return 'Atualização pausada por limite do provedor.';
  return 'Falha na última atualização.';
}

export function frescorDaCompeticao(args: {
  ultimaAtualizacao: string | null;
  janela: JanelaCompeticao;
  agora: Date;
  temJogoProximo: boolean;
  resultado?: string | null;
}): FrescorCompeticao {
  const { ultimaAtualizacao, janela, agora, temJogoProximo, resultado } = args;
  if (ultimaAtualizacao === null) return 'nunca';
  if (agora.getTime() > Date.parse(janela.fim)) return 'encerrada';
  if (resultado === 'pausado-por-cota') return 'pausado';
  if (
    resultado !== undefined &&
    resultado !== null &&
    resultado !== 'atualizada' &&
    resultado !== 'fora-da-janela' &&
    !SEM_COBERTURA.has(resultado)
  )
    return 'falha';
  const intervalo = temJogoProximo ? INTERVALO_COM_JOGO_MIN : INTERVALO_SEM_JOGO_MIN;
  return estaEmAlerta(agora, new Date(ultimaAtualizacao), intervalo) ? 'alerta' : 'normal';
}
