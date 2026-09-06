import { useCallback, useEffect, useState } from 'react';
import {
  aplicarTemaNoDocumento,
  calcularTemaEfetivo,
  lerPreferenciaSalva,
  salvarPreferencia,
  type PreferenciaDeTema,
  type TemaEfetivo,
} from './tema';

const CONSULTA_PREFERE_ESCURO = '(prefers-color-scheme: dark)';

function lerPreferenciaDoSistema(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(CONSULTA_PREFERE_ESCURO).matches;
}

export interface EstadoDeTema {
  /** Preferência do usuário: "sistema" | "claro" | "escuro" (UX-SPEC §3.3). */
  preferencia: PreferenciaDeTema;
  /** Tema efetivamente aplicado ao documento, já resolvido de "sistema". */
  temaEfetivo: TemaEfetivo;
  /** Troca a preferência, persiste e aplica ao documento imediatamente (sem F5). */
  definirPreferencia: (preferencia: PreferenciaDeTema) => void;
}

/**
 * Hook de aplicação de tema (FUND-05). Lê a preferência salva ao montar,
 * escuta mudança de `prefers-color-scheme` do sistema operacional enquanto a
 * preferência for "sistema", e mantém `data-tema` em `<html>` sincronizado —
 * é o mecanismo por trás do critério de aceite "alternância de tema funciona
 * sem F5". A tela de configurações que chama `definirPreferencia` (T-03,
 * UI-T03-02, Lote 9) ainda não existe; este hook só precisa estar pronto para
 * ser consumido por ela.
 */
export function usarTema(): EstadoDeTema {
  const [preferencia, definirPreferenciaEmMemoria] = useState<PreferenciaDeTema>(() =>
    lerPreferenciaSalva(),
  );
  const [prefereEscuroNoSistema, definirPrefereEscuroNoSistema] = useState<boolean>(() =>
    lerPreferenciaDoSistema(),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const consulta = window.matchMedia(CONSULTA_PREFERE_ESCURO);
    const escutar = (evento: MediaQueryListEvent): void => {
      definirPrefereEscuroNoSistema(evento.matches);
    };

    consulta.addEventListener('change', escutar);
    return () => consulta.removeEventListener('change', escutar);
  }, []);

  const temaEfetivo = calcularTemaEfetivo(preferencia, prefereEscuroNoSistema);

  useEffect(() => {
    aplicarTemaNoDocumento(temaEfetivo);
  }, [temaEfetivo]);

  const definirPreferencia = useCallback((novaPreferencia: PreferenciaDeTema): void => {
    salvarPreferencia(novaPreferencia);
    definirPreferenciaEmMemoria(novaPreferencia);
  }, []);

  return { preferencia, temaEfetivo, definirPreferencia };
}
