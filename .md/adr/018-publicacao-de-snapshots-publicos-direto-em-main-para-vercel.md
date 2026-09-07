# ADR-018 — Publicação de snapshots públicos direto em `main` (hosting Vercel)

- **Status**: Aceito
- **Data**: 2026-09-07
- **Decisor**: Stakeholder (usuário/orquestrador), fora do fluxo normal de
  `TASK.md` — registrado pelo Executor como bloqueio pontual resolvido
  diretamente (`.md/BLOCKERS.md`, Bloqueio 006)
- **Requisitos afetados**: RF-15, RF-16, RF-17, RNF-06 (mesmos de ADR-002,
  agora com o mecanismo de publicação ajustado); SDD §2.1 ("Agendamento e
  publicação"), SDD §2.2 (contrato de snapshots públicos)
- **Depende de**: ADR-001, ADR-002 (supersede parcialmente — ver nota no topo
  do ADR-002)

## Contexto

O projeto passou a usar **Vercel** como hosting principal da SPA
(`https://sports-lm.vercel.app`), conectado por integração Git ao
`origin/main` deste repositório: todo push em `main` já dispara build +
deploy automático do Vercel, sem depender de nenhum workflow do GitHub
Actions. Um `vercel.json` (rewrite de SPA) já foi adicionado e commitado. Essa
escolha de fornecedor de hosting é decisão do stakeholder, tomada fora deste
ADR — aqui só se registra o fato e sua consequência técnica.

**Gap encontrado**: ADR-002 previa a branch órfã `dados` como destino final
dos snapshots públicos (`/dados/*.json`, contrato do SDD §2.2), mecanismo
originalmente pensado para GitHub Pages com fonte "Deploy from a branch" —
que nunca chegou a funcionar de ponta a ponta (GitHub Pages nunca foi
habilitado, ver `.md/DEPLOY.md` Seção 2). Com o Vercel como hosting real, o
gap fica explícito: o Vercel só builda/serve o conteúdo de `main`, então
`/dados/*.json` nunca existe lá enquanto for publicado apenas na branch
`dados`. Confirmado empiricamente: `curl https://sports-lm.vercel.app/dados/versao.json`
retornava 404 antes desta mudança — a SPA carregava, mas sem notícia/futebol
real (nenhum dos dois flui do pipeline até a tela).

## Alternativas consideradas

| Alternativa | Contras que pesaram |
|---|---|
| Configurar o Vercel para também servir a branch `dados` (segundo projeto/domínio Vercel apontando pra essa branch) | Precisa de configuração adicional na conta Vercel (segundo projeto ou regra de proxy), fora do que pode ser feito só com código versionado; acopla o pipeline a detalhe de configuração de infraestrutura externa não versionada |
| Nova integração via API do Vercel (deploy hook, ou upload de artefato via API/CLI a partir do CI) | Exige credencial nova (token de API do Vercel) cadastrada como segredo, mais lógica de chamada de API no workflow — complexidade adicional evitável, já que o Vercel **já** auto-deploya a cada push em `main` |
| Reabilitar GitHub Pages, servindo a SPA por lá e o Vercel só como espelho/preview | Contraria a decisão do stakeholder de usar o Vercel como hosting principal; manter dois hostings reais em paralelo é dívida operacional maior que o ganho |
| **Publicar os snapshots direto em `app/public/dados/`, commitado em `main`** | Trade-off aceito: histórico de `main` cresce um commit por execução em que o hash muda (mesma cadência de ADR-002, só quando o conteúdo muda) |

## Decisão

O passo final de `.github/workflows/ingestao.yml` ("Publica snapshots
públicos em app/public/dados (main — ADR-018)") deixa de trocar de branch
(`git checkout dados`/`--orphan dados`). Em vez disso, **permanece em
`main`**, copia o conteúdo de `dist-dados/` para `app/public/dados/`
(sobrescrevendo o que houver) e comita/push direto em `main`, só quando o
conteúdo realmente mudou (mesma checagem `git diff --cached --quiet` já
existente, adaptada ao novo caminho). Mensagem de commit mantida no mesmo
padrão: `chore(dados): atualiza snapshots de ingestão [skip ci]` — o
`[skip ci]` evita disparo duplo de `build-publish.yml` (GitHub Pages, que
segue existindo, ver "Se virar produto"/consequências abaixo); o Vercel roda
de qualquer forma a cada push, independente de `[skip ci]` (esse marcador só
afeta o próprio GitHub Actions).

Como `app/public/` é o `publicDir` do Vite (`root: 'app'`, `vite.config.ts`),
tudo em `app/public/dados/` é copiado verbatim para `dist/dados/` a cada
`npm run build` — inclusive o build que o Vercel dispara automaticamente a
cada push. Isso significa que a atualização de dado só fica visível em
produção depois do build do Vercel terminar (não é instantâneo como seria
servir os arquivos por fora do build) — aceitável para a cadência de 30 min
do pipeline de ingestão.

**Escopo desta decisão**: só os **snapshots públicos** (contrato do SDD §2.2)
mudam de destino. O **estado interno** do pipeline (`estado/noticias.json`,
`estado/futebol.json`, `estado/ingestao/status.json`, lido/escrito via
`SPORTSLM_DIR_ESTADO`) não é tocado por esta decisão — ver nota de escopo
abaixo.

**Nota de escopo (achado colateral, não resolvido por este ADR)**: ao
investigar o passo de publicação para fazer esta mudança, confirmou-se que
`.github/workflows/ingestao.yml` **nunca** teve um passo que restaure
`estado/` de alguma branch antes de rodar `npm run ingestao`, nem que o
commite de volta depois. `SPORTSLM_DIR_ESTADO` não é setado no workflow e
usa o default local (`estado/` na raiz do checkout, efêmero por execução do
runner). Ou seja, o estado interno **não persiste entre execuções agendadas**
hoje — cada execução do workflow começa com estado vazio, contrariando a
premissa original de ADR-002 ("branch órfã `dados`, com os arquivos de
estado interno... commitada ao final de cada execução"). Este é um problema
pré-existente, separado do que este ADR resolve (que é só o destino dos
**snapshots públicos**, não do estado interno) — registrado aqui e em
`.md/BLOCKERS.md` (Bloqueio 006) para decisão futura do Coordenador/gestor,
sem correção aplicada nesta tarefa.

## Consequências

**Positivas**
- Resolve o gap real: `/dados/*.json` passa a existir no mesmo host que serve
  a SPA (Vercel), sem precisar de configuração nova na conta Vercel nem de
  credencial de API adicional.
- Reaproveita a mesma verificação de segredo bloqueante já existente
  (`npm run verificar-segredos:dados`, antes da cópia), sem duplicar lógica.
- Nenhuma mudança em como os snapshots são gerados
  (`pipeline/publicacao/gerador-snapshots.ts` não foi tocado) — só o destino
  de publicação, isolado no workflow.

**Negativas / dívida aceita**
- Histórico de `main` cresce um commit a cada execução em que o hash dos
  dados muda (mesma cadência de 30 min do workflow, só quando o conteúdo
  realmente muda — herda a mesma mitigação de "publica só se mudou" de
  ADR-002). Diferente da branch órfã, esse crescimento agora é no histórico
  do código de produção, não isolado — mitigação: mensagens de commit
  padronizadas e `[skip ci]`, fáceis de filtrar/pesquisar; se o volume um dia
  incomodar, cabe reavaliar (ex. squash periódico, ou mover para solução de
  storage externo ao repositório, ver "Se virar produto").
- `build-publish.yml` (GitHub Pages) continua existindo e sendo disparado a
  cada push em `main` que não tenha `[skip ci]` — decisão de desligá-lo ou
  não é separada, fora do escopo desta tarefa (ver `.md/DEPLOY.md`).
- A lacuna de persistência do estado interno entre execuções (nota de escopo
  acima) permanece sem correção — o "instável desde", a deduplicação e a
  retenção de 7 dias descritos em ADR-002 dependem de estado que hoje não
  sobrevive entre execuções agendadas do CI.

## Se virar produto

Trocar a publicação de snapshots por um destino que não exija commit no
histórico de código (ex. bucket de storage estático, KV/Blob gerenciado pelo
próprio Vercel, ou CDN dedicado), resolvendo ao mesmo tempo o crescimento do
histórico de `main` e a atualização instantânea sem depender de rebuild
completo da SPA a cada mudança de dado.
