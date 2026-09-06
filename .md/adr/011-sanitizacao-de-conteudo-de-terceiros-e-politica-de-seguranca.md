# ADR-011 — Sanitização de conteúdo de terceiros na ingestão e política de segurança de conteúdo

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-04 (CA-04.2, CA-04.3), RF-15 (CA-15.2), RN-02, RN-17, RNF-08, I-14
- **Depende de**: ADR-001

## Contexto

O produto é, em essência, um renderizador de texto que veio de terceiros. Feeds RSS
entregam `title`, `description` e `link` frequentemente com HTML embutido, entidades
codificadas e, em casos patológicos, `javascript:` em href. Como não há backend, uma
injeção que chegue ao snapshot é servida direto ao navegador de todos os usuários.

**Este é o maior risco de segurança do sistema.** Não há autenticação para roubar nem
banco para exfiltrar, mas há execução de script na origem do produto.

## Decisão

**Sanitizar na ingestão, renderizar como texto puro no cliente. As duas coisas, não
uma.**

**Na ingestão (fronteira de confiança):**

1. **Título e resumo** passam por: decodificação de entidades → remoção completa de
   marcação (nenhuma tag sobrevive, nem `<b>`) → colapso de espaços → corte. Limites:
   título 180 caracteres, resumo **300 caracteres** (fixando o "a confirmar" de
   CA-04.3), com truncamento em fronteira de palavra e reticências `…` indicando o
   corte.
2. **Link**: precisa ser URL absoluta com esquema `http` ou `https`. Qualquer outro
   esquema (`javascript:`, `data:`, `file:`) → **item descartado** e registrado no
   `status.json`. Não há tentativa de conserto.
3. **Datas**: normalizadas para ISO 8601 com deslocamento `-03:00`
   (America/Sao_Paulo, RNF-02); data ausente ou não parseável → horário de ingestão
   com `dataEstimada: true` (CA-04.6/CA-15.2).
4. **Validação de esquema (Zod)** de todo item antes de entrar no estado interno. Item
   que não valida é descartado com registro, nunca "corrigido" (mesma disciplina de
   CA-16.6 para dados de futebol).
5. **Sem imagens** (I-14): campos de mídia do feed são ignorados na ingestão — não são
   armazenados nem publicados. Isso é regra de direito autoral, não de estilo.
6. **Sem texto integral** (RN-02): apenas título, resumo curto do próprio feed, fonte,
   esporte, data/hora e link. O pipeline nunca busca a página da matéria.

**No cliente (defesa em profundidade):**

7. Todo texto de terceiro é renderizado como nó de texto (React já escapa por padrão).
   **`dangerouslySetInnerHTML` é proibido em todo o projeto** — vai para
   `GUARDRAILS.md` como regra dura, verificável por busca no código.
8. Links externos: `target="_blank" rel="noopener noreferrer"` (CA-04.2 abre fora do
   produto), com o esquema revalidado antes da renderização.
9. **Política de Segurança de Conteúdo** declarada em `<meta http-equiv>`
   (o hosting estático escolhido não permite cabeçalhos HTTP próprios):

   ```
   default-src 'self';
   img-src 'self' data:;
   style-src 'self';
   script-src 'self';
   connect-src 'self' https://<host-de-telemetria>;
   base-uri 'none';
   object-src 'none';
   form-action 'none';
   ```

10. **Atribuição** (RN-17): toda notícia exibe a fonte de forma visível; a atribuição
    exigida pelos termos do provedor de futebol aparece junto do carimbo de frescor
    (CA-17.4).

## Limitação aceita conscientemente

`frame-ancestors` e `X-Frame-Options` **não** funcionam por `<meta>` e o hosting
estático não expõe cabeçalhos. O produto pode, portanto, ser carregado em um iframe
de terceiro. Avaliação: não há sessão, cookie, token ou ação de estado no servidor —
o vetor clássico de *clickjacking* (executar uma ação autenticada por engano) não
existe aqui. Risco residual: exibir o produto em contexto enganoso. **Débito
registrado** (RT-13, severidade baixa), com correção conhecida: migrar para um hosting
que permita cabeçalhos, ou ao promover a produto.

## Consequências

**Positivas**: o dado guardado já é seguro — nenhuma tela precisa lembrar de
sanitizar; a política de conteúdo bloqueia a exfiltração mesmo se algo escapar; a
proibição de imagens e de texto integral, implementada no pipeline, torna a violação
de RN-02 improvável por acidente.

**Negativas**: perde-se formatação legítima do resumo (negrito, itálico). Aceito:
RN-02 pede resumo curto, não fidelidade tipográfica.

## Se virar produto

Migrar para hosting com cabeçalhos completos (CSP por cabeçalho, `frame-ancestors`,
HSTS, `Referrer-Policy`), adicionar relatório de violação de CSP, e submeter o
tratamento de conteúdo de terceiros à revisão jurídica (R1/R4).
