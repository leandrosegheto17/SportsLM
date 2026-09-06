// dominio/noticias/montador-feed.test.ts — UI-T02-03 (TASK.md Lote 8)
//
// Testes por tabela (Diretriz de Implementação #11) cobrindo CA-04.1,
// CA-04.8, CA-19.1 a CA-19.4 (ADR-009).

import { describe, expect, it } from 'vitest';
import { montarFeedNoticias } from './montador-feed';
import type { ItemNoticia } from '../tipos/noticias';

function item(
  parciais: Partial<ItemNoticia> & Pick<ItemNoticia, 'id' | 'fonteId'>,
): ItemNoticia {
  return {
    feedId: `${parciais.fonteId}-feed`,
    titulo: `Título ${parciais.id}`,
    resumo: null,
    link: `https://exemplo.com/${parciais.id}`,
    publicadoEm: '2026-09-05T12:00:00-03:00',
    dataEstimada: false,
    esporte: 'futebol',
    origemClassificacao: 'lexico',
    grupoId: null,
    ingeridoEm: '2026-09-05T12:00:00-03:00',
    ...parciais,
  };
}

describe('montarFeedNoticias (RF-04/RF-19)', () => {
  it('CA-04.1/RN-18: ordena os itens sem grupo do mais recente ao mais antigo', () => {
    const itens = [
      item({ id: 'a', fonteId: 'ge', publicadoEm: '2026-09-05T10:00:00-03:00' }),
      item({ id: 'b', fonteId: 'ge', publicadoEm: '2026-09-05T12:00:00-03:00' }),
      item({ id: 'c', fonteId: 'ge', publicadoEm: '2026-09-05T11:00:00-03:00' }),
    ];

    const feed = montarFeedNoticias(itens, new Set());

    expect(feed.map((f) => f.representante.id)).toEqual(['b', 'c', 'a']);
  });

  it('CA-04.8: descarta item "fora-do-recorte" mesmo que publicado (defensivo)', () => {
    const itens = [
      item({ id: 'a', fonteId: 'ge', esporte: 'fora-do-recorte' }),
      item({ id: 'b', fonteId: 'ge', esporte: 'geral' }),
    ];

    const feed = montarFeedNoticias(itens, new Set());

    expect(feed.map((f) => f.representante.id)).toEqual(['b']);
  });

  it('CA-04.7 (indiretamente): item "geral" aparece normalmente no feed', () => {
    const itens = [item({ id: 'a', fonteId: 'ge', esporte: 'geral' })];
    const feed = montarFeedNoticias(itens, new Set());
    expect(feed).toHaveLength(1);
    expect(feed[0]?.representante.esporte).toBe('geral');
  });

  it('fonte bloqueada, sem grupo: item nunca aparece', () => {
    const itens = [item({ id: 'a', fonteId: 'uol-esporte' })];
    const feed = montarFeedNoticias(itens, new Set(['uol-esporte']));
    expect(feed).toHaveLength(0);
  });

  it('CA-19.1/CA-19.4: grupo de fontes diferentes vira 1 item com as demais fontes listadas', () => {
    const itens = [
      item({
        id: 'a',
        fonteId: 'espn-brasil',
        grupoId: 'grupo-1',
        publicadoEm: '2026-09-05T10:00:00-03:00',
      }),
      item({
        id: 'b',
        fonteId: 'gazeta-esportiva',
        grupoId: 'grupo-1',
        publicadoEm: '2026-09-05T11:00:00-03:00',
      }),
    ];

    const feed = montarFeedNoticias(itens, new Set());

    expect(feed).toHaveLength(1); // CA-19.4: grupo conta como 1
    expect(feed[0]?.representante.id).toBe('a'); // ADR-009: mais antigo é o representante
    expect(feed[0]?.outrasFontesIds).toEqual(['gazeta-esportiva']); // CA-19.1
  });

  it('CA-19.2: fonte do grupo bloqueada é omitida e a próxima mais antiga é promovida a representante', () => {
    const itens = [
      item({
        id: 'a',
        fonteId: 'espn-brasil', // mais antigo, mas será bloqueado
        grupoId: 'grupo-1',
        publicadoEm: '2026-09-05T09:00:00-03:00',
      }),
      item({
        id: 'b',
        fonteId: 'gazeta-esportiva',
        grupoId: 'grupo-1',
        publicadoEm: '2026-09-05T10:00:00-03:00',
      }),
      item({
        id: 'c',
        fonteId: 'terra-esportes',
        grupoId: 'grupo-1',
        publicadoEm: '2026-09-05T11:00:00-03:00',
      }),
    ];

    const feed = montarFeedNoticias(itens, new Set(['espn-brasil']));

    expect(feed).toHaveLength(1);
    expect(feed[0]?.representante.id).toBe('b'); // próxima mais antiga não bloqueada
    expect(feed[0]?.outrasFontesIds).toEqual(['terra-esportes']); // bloqueada nunca aparece na lista
  });

  it('CA-19.2: grupo com todos os membros bloqueados não aparece', () => {
    const itens = [
      item({ id: 'a', fonteId: 'espn-brasil', grupoId: 'grupo-1' }),
      item({ id: 'b', fonteId: 'gazeta-esportiva', grupoId: 'grupo-1' }),
    ];

    const feed = montarFeedNoticias(itens, new Set(['espn-brasil', 'gazeta-esportiva']));

    expect(feed).toHaveLength(0);
  });

  it('CA-19.3: itens que não atingem RN-16 (sem grupo) aparecem separadamente', () => {
    const itens = [
      item({ id: 'a', fonteId: 'espn-brasil', grupoId: null }),
      item({ id: 'b', fonteId: 'gazeta-esportiva', grupoId: null }),
    ];

    const feed = montarFeedNoticias(itens, new Set());

    expect(feed).toHaveLength(2);
    expect(feed.every((f) => f.outrasFontesIds.length === 0)).toBe(true);
  });

  it('CA-19.4: 30 grupos de 2 itens cada contam como 30, não 60, respeitando o limite', () => {
    const itens: ItemNoticia[] = [];
    for (let i = 0; i < 35; i += 1) {
      const grupoId = `grupo-${String(i)}`;
      const publicadoEm = new Date(
        Date.parse('2026-09-05T00:00:00-03:00') + i * 60_000,
      ).toISOString();
      itens.push(
        item({ id: `${grupoId}-a`, fonteId: 'espn-brasil', grupoId, publicadoEm }),
        item({ id: `${grupoId}-b`, fonteId: 'gazeta-esportiva', grupoId, publicadoEm }),
      );
    }

    const feed = montarFeedNoticias(itens, new Set());

    expect(feed).toHaveLength(30); // CA-19.4 + limite padrão de 30 (CA-04.1)
  });

  it('respeita um limite customizado', () => {
    const itens = [
      item({ id: 'a', fonteId: 'ge', publicadoEm: '2026-09-05T10:00:00-03:00' }),
      item({ id: 'b', fonteId: 'ge', publicadoEm: '2026-09-05T11:00:00-03:00' }),
      item({ id: 'c', fonteId: 'ge', publicadoEm: '2026-09-05T12:00:00-03:00' }),
    ];

    const feed = montarFeedNoticias(itens, new Set(), 2);

    expect(feed.map((f) => f.representante.id)).toEqual(['c', 'b']);
  });

  it('data de publicação inválida não lança e vai para o fim da ordenação', () => {
    const itens = [
      item({ id: 'a', fonteId: 'ge', publicadoEm: 'não-é-uma-data' }),
      item({ id: 'b', fonteId: 'ge', publicadoEm: '2026-09-05T10:00:00-03:00' }),
    ];

    const feed = montarFeedNoticias(itens, new Set());

    expect(feed.map((f) => f.representante.id)).toEqual(['b', 'a']);
  });
});
