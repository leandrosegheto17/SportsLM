# app/tema/

Resolução e persistência da preferência de tema (FUND-05, UX-SPEC §3.3):
`sistema` (padrão) | `claro` | `escuro`, salva em `sportslm.tema.v1`.

- `tema.ts` — funções puras/testáveis sem DOM real: `calcularTemaEfetivo`,
  `lerPreferenciaSalva`, `salvarPreferencia`, `aplicarTemaNoDocumento`.
- `usarTema.ts` — hook React que liga tudo: lê a preferência ao montar, ouve
  `prefers-color-scheme` do sistema enquanto a preferência for "sistema", e
  escreve `data-tema` em `<html>` a cada mudança (sem F5). Chamado uma vez em
  `App.tsx`.

Fora de `app/armazenamento/` de propósito: UI-DS-09 (Lote 7) cria o módulo de
`preferencias`/`cenario` com esquema próprio; o tema já tem chave e formato
definidos pelo UX-SPEC (`sportslm.tema.v1`) independentes disso. A tela de
configurações que expõe a troca ao usuário (UI-T03-02, Lote 9) consome
`usarTema()`/`definirPreferencia` — ainda não existe nesta tarefa.
