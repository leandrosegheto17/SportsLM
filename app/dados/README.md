# app/dados/

Hook `useSnapshot` (UI-DS-08, TASK.md Lote 7): busca + cache + revalidação por
`versao.json` do contrato público de dados (SDD §2.2).

- `versao.ts` — esquema Zod de `/dados/versao.json` e a lista das 4 chaves de
  hash (`noticias`, `futebol`, `catalogo`, `status`).
- `clienteSnapshot.ts` — núcleo sem React: cache por URL, dedup de buscas
  concorrentes e a regra "rebusca só se o hash mudou". Faz I/O (`fetch`), por
  isso fica aqui e não em `dominio/` (GUARDRAILS.md §5).
- `useSnapshot.ts` — hook React: busca na montagem, revalida `versao.json` a
  cada 5 min só enquanto `document.visibilityState === 'visible'` (Page
  Visibility API) e reage a `visibilitychange` (volta a ficar visível não
  espera o próximo tick do timer). Sem sondagem cega: nunca faz polling de um
  arquivo de dado em si, só do pequeno `versao.json`. Sem WebSocket.

Uso típico numa tela:

```tsx
const { dados, carregando, erro, geradoEm } = useSnapshot(
  '/dados/noticias.json',
  'noticias',
  esquemaNoticiasPublico,
);
```

`chave` deve ser a chave de hash de `versao.json` que governa aquele arquivo —
`futebol` cobre tanto `futebol/brasileirao.json` quanto
`futebol/clube/<slug>.json` (o contrato não expõe hash por clube).

Os arquivos de configuração de temporada (`config/*.json`, cache "longo", sem
entrada em `hashes`) não passam por este hook — não fazem parte do contrato de
revalidação por hash do §2.2.

Até PUB-02 (Lote 6) publicar o snapshot real, as telas que consomem este hook
usam fixtures no formato do contrato (ver `app/dados/*.test.tsx` para
exemplos validados contra os schemas reais de `dominio/tipos`); a tarefa de
tela correspondente só fecha como `Concluída` depois de trocar para o
endpoint real (regra geral do Executor, TASK.md §1).
