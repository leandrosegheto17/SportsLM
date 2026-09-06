import type { ReactElement } from 'react';
import estilos from './BannerAlerta.module.css';

export type VarianteBannerAlerta = 'alerta' | 'erro' | 'informacao';

interface AcaoBannerAlerta {
  readonly rotulo: string;
  readonly aoClicar: () => void;
}

interface PropriedadesBannerAlerta {
  readonly variante: VarianteBannerAlerta;
  readonly texto: string;
  readonly acao?: AcaoBannerAlerta;
}

/** Ícone (`aria-hidden`) + prefixo textual visível por variante — nunca só a
 * cor de fundo distingue alerta de erro (Diretriz de Implementação #7,
 * UX-SPEC §3.7: "todo ícone que carrega significado vem acompanhado de
 * texto"). `alerta`/`erro` usam `⚠`; `informacao` usa `ⓘ` — o prefixo textual
 * ("ATENÇÃO"/"ERRO") é quem realmente separa os dois casos que compartilham
 * ícone. */
const ICONE_POR_VARIANTE: Record<VarianteBannerAlerta, string> = {
  alerta: '⚠',
  erro: '⚠',
  informacao: 'ⓘ',
};

const PREFIXO_POR_VARIANTE: Record<VarianteBannerAlerta, string | null> = {
  alerta: 'ATENÇÃO',
  erro: 'ERRO',
  informacao: null,
};

/**
 * `BannerAlerta` (UX-SPEC §3.8): ícone + texto + ação opcional. Variantes
 * alerta (âmbar) · erro (vermelho) · informação (neutro).
 */
export function BannerAlerta({
  variante,
  texto,
  acao,
}: PropriedadesBannerAlerta): ReactElement {
  const prefixo = PREFIXO_POR_VARIANTE[variante];
  return (
    <div
      className={estilos['banner']}
      data-variante={variante}
      role={variante === 'informacao' ? 'status' : 'alert'}
    >
      <span className={estilos['icone']} aria-hidden="true">
        {ICONE_POR_VARIANTE[variante]}
      </span>
      <p className={estilos['texto']}>
        {prefixo !== null ? (
          <strong className={estilos['prefixo']}>{prefixo}: </strong>
        ) : null}
        {texto}
      </p>
      {acao ? (
        <button type="button" className={estilos['acao']} onClick={acao.aoClicar}>
          {acao.rotulo}
        </button>
      ) : null}
    </div>
  );
}
