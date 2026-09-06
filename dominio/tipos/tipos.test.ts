// dominio/tipos/tipos.test.ts — DOM-01 (TASK.md Lote 3)
//
// Testes por tabela (TASK.md Diretriz #11): todo tipo do SDD §5 tem um caso
// válido aceito e ao menos um caso inválido rejeitado pelo validador Zod
// correspondente.

import { describe, expect, it } from 'vitest';
import {
  esporteIdSchema,
  esporteOuTriagemSchema,
  ESPORTE_IDS,
  fonteSchema,
  itemNoticiaSchema,
  clubeSchema,
  paletaClubeSchema,
  competicaoSchema,
  participacaoClubeSchema,
  partidaSchema,
  linhaClassificacaoSchema,
  zonaSchema,
  preferenciasSchema,
  cenarioSchema,
} from './index';

const paletaValida = {
  acromatico: false,
  identidade: '#006437',
  faixaB: '#ffffff',
  identidadeTexto: '#ffffff',
  acento: '#00a651',
  acentoSobreEscuro: '#4ade80',
  suave: '#e6f4ec',
  suaveEscuro: '#0a2e1a',
  identidadeEscuro: '#004d29',
  faixaBEscuro: '#1a1a1a',
  identidadeTextoEscuro: '#ffffff',
};

const clubeValido = {
  id: 'palmeiras',
  nome: 'Sociedade Esportiva Palmeiras',
  nomeCurto: 'Palmeiras',
  sigla: 'PAL',
  corBase: '#006437',
  paleta: paletaValida,
  idsProvedor: { 'football-data': 1769 },
};

const fonteValida = {
  id: 'ge',
  nome: 'GE',
  fixa: true,
  esportesCobertos: ['futebol'] as const,
  termos: { url: null, verificadoEm: null, uso: 'nao-comercial' as const },
  frequenciaMaximaMin: 30,
  feeds: [],
  verificacao: { estado: 'pendente' as const, em: null },
};

const itemNoticiaValido = {
  id: 'a'.repeat(64),
  fonteId: 'ge',
  feedId: 'ge-futebol',
  titulo: 'Título de exemplo',
  resumo: 'Resumo curto de exemplo.',
  link: 'https://ge.globo.com/noticia',
  publicadoEm: '2026-09-05T10:00:00-03:00',
  dataEstimada: false,
  esporte: 'futebol' as const,
  origemClassificacao: 'feed-fixado' as const,
  grupoId: null,
  ingeridoEm: '2026-09-05T10:01:00-03:00',
};

const competicaoValida = {
  id: 'brasileirao-serie-a',
  nome: 'Brasileirão Série A',
  temporada: 2026,
  formato: 'pontos-corridos' as const,
  janela: { inicio: '2026-03-29', fim: '2026-12-06' },
  provedor: 'football-data',
  ultimaAtualizacao: null,
};

const participacaoValida = {
  competicaoId: 'brasileirao-serie-a',
  clubeId: 'palmeiras',
  status: 'em-andamento' as const,
  faseAtual: null,
  resultadoFinal: null,
  resumo: {
    jogos: 10,
    v: 6,
    e: 2,
    d: 2,
    gp: 18,
    gc: 10,
    sg: 8,
    pontos: 20,
    aproveitamento: 66.7,
    posicao: 3,
  },
};

const partidaValida = {
  id: 'partida-1',
  competicaoId: 'brasileirao-serie-a',
  rodada: 10,
  fase: null,
  mandanteId: 'palmeiras',
  visitanteId: 'flamengo',
  dataHora: '2026-09-10T20:00:00-03:00',
  horarioDefinido: true,
  estadio: 'Allianz Parque',
  status: 'agendada' as const,
  placar: null,
};

const linhaClassificacaoValida = {
  competicaoId: 'brasileirao-serie-a',
  grupo: null,
  posicao: 3,
  clubeId: 'palmeiras',
  pontos: 20,
  jogos: 10,
  v: 6,
  e: 2,
  d: 2,
  gp: 18,
  gc: 10,
  sg: 8,
  aproveitamento: 66.7,
  ultimosCinco: ['V', 'V', 'E', 'D', 'V'] as const,
};

const zonaValida = {
  de: 1,
  ate: 4,
  rotulo: 'Libertadores',
  token: 'libertadores' as const,
};

const preferenciasValidas = {
  versaoEsquema: 1 as const,
  temporada: 2026,
  favoritos: ['futebol', 'basquete'] as const,
  fontesBloqueadas: [],
  timeId: 'palmeiras',
  rivais: ['corinthians'],
  atualizadoEm: '2026-09-05T10:00:00-03:00',
};

const cenarioValido = {
  versaoEsquema: 1 as const,
  escopo: 'temporada:time:rivais-ordenados',
  palpites: { 'partida-1': 'vitoria' as const },
  partidasTravadasVistas: [],
};

describe('dominio/tipos — validadores Zod de SDD §5 (DOM-01)', () => {
  describe('EsporteId', () => {
    it('aceita os 15 ids da Seção 2A', () => {
      for (const id of ESPORTE_IDS) {
        expect(esporteIdSchema.safeParse(id).success).toBe(true);
      }
    });

    it('rejeita id inventado', () => {
      expect(esporteIdSchema.safeParse('handebol').success).toBe(false);
    });

    it('esporteOuTriagemSchema aceita "geral"/"fora-do-recorte" além dos 15 ids', () => {
      expect(esporteOuTriagemSchema.safeParse('geral').success).toBe(true);
      expect(esporteOuTriagemSchema.safeParse('fora-do-recorte').success).toBe(true);
      expect(esporteOuTriagemSchema.safeParse('futebol').success).toBe(true);
      expect(esporteOuTriagemSchema.safeParse('handebol').success).toBe(false);
    });
  });

  describe('Fonte', () => {
    it('aceita uma fonte válida', () => {
      expect(fonteSchema.safeParse(fonteValida).success).toBe(true);
    });

    it('rejeita fonte com esportesCobertos inválido', () => {
      const invalida = { ...fonteValida, esportesCobertos: ['handebol'] };
      expect(fonteSchema.safeParse(invalida).success).toBe(false);
    });

    it('rejeita fonte sem frequenciaMaximaMin', () => {
      const { frequenciaMaximaMin: _omitido, ...invalida } = fonteValida;
      expect(fonteSchema.safeParse(invalida).success).toBe(false);
    });
  });

  describe('ItemNoticia', () => {
    it('aceita um item válido', () => {
      expect(itemNoticiaSchema.safeParse(itemNoticiaValido).success).toBe(true);
    });

    it('rejeita título acima de 180 caracteres', () => {
      const invalido = { ...itemNoticiaValido, titulo: 'x'.repeat(181) };
      expect(itemNoticiaSchema.safeParse(invalido).success).toBe(false);
    });

    it('rejeita resumo acima de 300 caracteres', () => {
      const invalido = { ...itemNoticiaValido, resumo: 'x'.repeat(301) };
      expect(itemNoticiaSchema.safeParse(invalido).success).toBe(false);
    });

    it('rejeita link não http(s) absoluto (ADR-011)', () => {
      const invalido = { ...itemNoticiaValido, link: 'ftp://exemplo.com/a' };
      expect(itemNoticiaSchema.safeParse(invalido).success).toBe(false);
    });

    it('aceita esporte = "fora-do-recorte" (CA-04.8)', () => {
      const item = { ...itemNoticiaValido, esporte: 'fora-do-recorte' as const };
      expect(itemNoticiaSchema.safeParse(item).success).toBe(true);
    });
  });

  describe('Clube / PaletaClube', () => {
    it('aceita um clube válido com paleta', () => {
      expect(clubeSchema.safeParse(clubeValido).success).toBe(true);
    });

    it('rejeita clube sem paleta (obrigatória no domínio, SDD §5.2)', () => {
      const { paleta: _omitida, ...invalido } = clubeValido;
      expect(clubeSchema.safeParse(invalido).success).toBe(false);
    });

    it('rejeita corBase fora do formato hex', () => {
      const invalido = { ...clubeValido, corBase: 'verde' };
      expect(clubeSchema.safeParse(invalido).success).toBe(false);
    });

    it('rejeita idsProvedor vazio... na verdade aceita objeto vazio (RN-04 não exige mínimo aqui, ver CFG-02 para a regra de "nenhum vazio" no arquivo de config)', () => {
      // O tipo de domínio não repete a regra de "não vazio" de CFG-02
      // (regra de arquivo de configuração, não do tipo em si); mantido
      // como registro consciente, não omissão.
      const clube = { ...clubeValido, idsProvedor: {} };
      expect(clubeSchema.safeParse(clube).success).toBe(true);
    });

    it('paletaClubeSchema rejeita cor inválida em qualquer campo', () => {
      const invalida = { ...paletaValida, acento: 'não-é-cor' };
      expect(paletaClubeSchema.safeParse(invalida).success).toBe(false);
    });

    it('aceita clube acromático (Corinthians/Botafogo) com paletaManual parcial', () => {
      const clube = {
        ...clubeValido,
        id: 'corinthians',
        paleta: { ...paletaValida, acromatico: true },
        paletaManual: { acento: '#000000' },
      };
      expect(clubeSchema.safeParse(clube).success).toBe(true);
    });
  });

  describe('Competicao', () => {
    it('aceita uma competição válida', () => {
      expect(competicaoSchema.safeParse(competicaoValida).success).toBe(true);
    });

    it('aceita provedor: null (CA-07.2 — sem cobertura)', () => {
      const competicao = { ...competicaoValida, provedor: null };
      expect(competicaoSchema.safeParse(competicao).success).toBe(true);
    });

    it('rejeita formato fora da união de 4 valores', () => {
      const invalida = { ...competicaoValida, formato: 'liga' };
      expect(competicaoSchema.safeParse(invalida).success).toBe(false);
    });
  });

  describe('ParticipacaoClube', () => {
    it('aceita uma participação válida', () => {
      expect(participacaoClubeSchema.safeParse(participacaoValida).success).toBe(true);
    });

    it('aceita status "sem-dados" com resumo null (CA-07.2)', () => {
      const participacao = {
        ...participacaoValida,
        status: 'sem-dados' as const,
        resumo: null,
      };
      expect(participacaoClubeSchema.safeParse(participacao).success).toBe(true);
    });

    it('rejeita status fora dos 5 valores de CA-07.4', () => {
      const invalida = { ...participacaoValida, status: 'classificado' };
      expect(participacaoClubeSchema.safeParse(invalida).success).toBe(false);
    });
  });

  describe('Partida', () => {
    it('aceita uma partida válida', () => {
      expect(partidaSchema.safeParse(partidaValida).success).toBe(true);
    });

    it('aceita dataHora: null (CA-10.4 — "data a definir")', () => {
      const partida = { ...partidaValida, dataHora: null, horarioDefinido: false };
      expect(partidaSchema.safeParse(partida).success).toBe(true);
    });

    it('rejeita status fora da união de 5 valores', () => {
      const invalida = { ...partidaValida, status: 'suspensa' };
      expect(partidaSchema.safeParse(invalida).success).toBe(false);
    });

    it('rejeita placar com valor negativo', () => {
      const invalida = { ...partidaValida, placar: { mandante: -1, visitante: 0 } };
      expect(partidaSchema.safeParse(invalida).success).toBe(false);
    });
  });

  describe('LinhaClassificacao', () => {
    it('aceita uma linha válida', () => {
      expect(linhaClassificacaoSchema.safeParse(linhaClassificacaoValida).success).toBe(
        true,
      );
    });

    it('rejeita ultimosCinco com valor fora de V/E/D', () => {
      const invalida = { ...linhaClassificacaoValida, ultimosCinco: ['V', 'X'] };
      expect(linhaClassificacaoSchema.safeParse(invalida).success).toBe(false);
    });

    it('rejeita posicao menor que 1', () => {
      const invalida = { ...linhaClassificacaoValida, posicao: 0 };
      expect(linhaClassificacaoSchema.safeParse(invalida).success).toBe(false);
    });
  });

  describe('Zona', () => {
    it('aceita uma zona válida', () => {
      expect(zonaSchema.safeParse(zonaValida).success).toBe(true);
    });

    it('rejeita token fora dos 4 fixos do design system', () => {
      const invalida = { ...zonaValida, token: 'meio-de-tabela' };
      expect(zonaSchema.safeParse(invalida).success).toBe(false);
    });
  });

  describe('Preferencias', () => {
    it('aceita preferências válidas', () => {
      expect(preferenciasSchema.safeParse(preferenciasValidas).success).toBe(true);
    });

    it('rejeita mais de 3 favoritos (RN-06)', () => {
      const invalida = {
        ...preferenciasValidas,
        favoritos: ['futebol', 'basquete', 'tenis', 'surfe'],
      };
      expect(preferenciasSchema.safeParse(invalida).success).toBe(false);
    });

    it('rejeita mais de 2 rivais (RN-11)', () => {
      const invalida = { ...preferenciasValidas, rivais: ['a', 'b', 'c'] };
      expect(preferenciasSchema.safeParse(invalida).success).toBe(false);
    });

    it('rejeita versaoEsquema diferente de 1', () => {
      const invalida = { ...preferenciasValidas, versaoEsquema: 2 };
      expect(preferenciasSchema.safeParse(invalida).success).toBe(false);
    });
  });

  describe('Cenario', () => {
    it('aceita um cenário válido', () => {
      expect(cenarioSchema.safeParse(cenarioValido).success).toBe(true);
    });

    it('rejeita palpite fora de vitoria/empate/derrota', () => {
      const invalido = { ...cenarioValido, palpites: { 'partida-1': 'goleada' } };
      expect(cenarioSchema.safeParse(invalido).success).toBe(false);
    });

    it('rejeita versaoEsquema diferente de 1', () => {
      const invalido = { ...cenarioValido, versaoEsquema: 0 };
      expect(cenarioSchema.safeParse(invalido).success).toBe(false);
    });
  });
});
