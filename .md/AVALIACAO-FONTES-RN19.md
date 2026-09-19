# Avaliação formal dos critérios 1, 2 e 5 da RN-19 — 7 candidatos (REFAT-17-01)

- **Autor**: Coordenador. **Data da consulta**: 2026-09-19. **Origem**: Bloqueio 012 (`.md/BLOCKERS.md`), tarefa REFAT-17-01.
- **Critérios avaliados** (RN-19, `.md/PRD-TECNICO.md`): (1) redação profissional com responsabilidade editorial identificável; (2) cobertura multi-esporte capaz de alimentar a maioria dos 15 esportes; (5) conteúdo editorial não vinculado a casas de apostas ou conteúdo patrocinado como linha principal. Critérios 3 e 4 não fazem parte desta tarefa.
- **Método**: WebFetch de `robots.txt`, home, "quem somos"/termos quando acessíveis, mais WebSearch. Onde o domínio é bloqueado pela ferramenta do ambiente ou a página não existe, o veredito é `não verificável` (sem veredito por suposição). ADR-007 é imutável e não foi editado.
- **Limitação geral**: a ferramenta WebFetch não acessa `motorsport.uol.com.br`, `www.estadao.com.br`, `esportes.r7.com` e `www.r7.com` ("unable to fetch"). Para essas fontes, `robots.txt` e Termos não puderam ser lidos.

## Tabela-resumo

| Fonte | Critério 1 (veículo jornalístico) | Critério 2 (multi-esporte) | Critério 5 (sem vínculo com apostas) |
|---|---|---|---|
| `ogol` | conforme com ressalva | **não conforme** | conforme com ressalva |
| `superesportes` | conforme | conforme com ressalva | conforme com ressalva |
| `f1mania` | conforme | exceção aceita (só F1) | conforme com ressalva (só home lida) |
| `motorsport-brasil` | conforme com ressalva (evidência indireta) | exceção aceita (só F1) | não verificável |
| `estadao-esportes` | conforme com ressalva (evidência indireta) | conforme com ressalva (não lido direto) | não verificável |
| `r7-esporte` | conforme com ressalva (evidência indireta) | conforme com ressalva (não lido direto) | não verificável |
| `torcedores` | conforme com ressalva | **não conforme** | **não conforme** |

Fontes `não conforme` (fora a exceção aceita do critério 2): **`torcedores`** (critérios 2 e 5) e **`ogol`** (critério 2). Ver "Observação sobre o critério 2" abaixo.

## Evidência por fonte

### ogol (`ogol.com.br`, feed `https://www.ogol.com.br/rss/noticias.php`)
- **Critério 1 — conforme com ressalva.** Busca (consulta 2026-09-19): o site é a versão brasileira do zerozero, propriedade de "ZOS Lda" (Vila Nova de Gaia, Portugal), "combina informação estatística com jornalismo", no ar desde 2003; rodapé lista "Quem Somos", "Ficha Técnica", "Princípios Editoriais" e "© 2003-2025 ZOS, Lda" (fonte: resultados de busca para `https://www.zerozero.pt/quemsomos.php` e `https://www.ogol.com.br/privacidade.php`; as páginas em si não foram lidas). Ressalva: banco de dados estatístico com notícias, não jornal estritamente; empresa estrangeira; `https://www.ogol.com.br/termos.php` retornou 404 (Termos não lidos).
- **Critério 2 — não conforme.** `config/fontes.json`: `esportesCobertos: ["futebol"]`; home: "ogol.com.br :: Tudo sobre futebol". Cobre 1 dos 15 esportes; não se enquadra na exceção (que só vale para `f1mania` e `motorsport-brasil`).
- **Critério 5 — conforme com ressalva.** Home (`https://www.ogol.com.br/`, 2026-09-19): banners de "1xBet Brasil" e "bet365 BR" em vários pontos e odds ("1.49", "3.60") integradas às listas de jogos. Publicidade de apostas é monetização visível, mas a linha principal do produto é estatística/notícia. Recomenda-se decisão do stakeholder.
- `robots.txt` (`https://www.ogol.com.br/robots.txt`): sem regra para `/rss`; único `Disallow: /zzmap_v3.php`.

### superesportes (`mg.superesportes.com.br`)
- **Critério 1 — conforme.** Home (2026-09-19): rodapé "© Copyright 2000 - 2021. S/A Estado de Minas", grupo Diários Associados (Estado de Minas, Correio Braziliense, TV Alterosa). Termos de Uso/"Quem somos" não localizados na página (não lidos).
- **Critério 2 — conforme com ressalva.** `fontes.json`: 6 esportes (futebol, basquete, tênis, vôlei, F1, MMA) de 15; cobre mais de um terço, não a "maioria". Portal regional (MG) com foco em futebol.
- **Critério 5 — conforme com ressalva.** A navegação principal tem link "Apostas" (`https://www.mg.superesportes.com.br/apostas/`); a página é inteiramente promoção de afiliados (1xbet, Bet365, Betano, Betnacional, F12 Bet, KTO, Pixbet, Galera Bet, Novibet, 20bet, Blaze; "Codigo promocional Galera Bet: Até R$200 em 2026"; aviso "18+ Jogue com responsabilidade"). `robots.txt` (`https://www.mg.superesportes.com.br/robots.txt`) tem `Disallow: /apostas/go-*` (redirecionadores de afiliado). Ressalva: seção isolada; os feeds usados são de editorias de esporte (`/rss/noticias/...`), não da seção de apostas.
- `robots.txt`: `Allow: /`; nenhuma regra bloqueia `/rss`.

### f1mania (`f1mania.net`, feed `https://www.f1mania.net/f1/feed/`)
- **Critério 1 — conforme.** `https://www.f1mania.net/sobre-nos/`: "Fundado em 2002, o F1MANIA.NET é o maior portal brasileiro dedicado ao automobilismo"; diretor executivo/editor-chefe Victor Berto (MTb 95299/SP), editores e repórteres nomeados.
- **Critério 2 — exceção aceita.** Portal dedicado a automobilismo (`esportesCobertos: ["formula1"]`). Justificativa: entra como fonte profunda de F1 para o esporte "Fórmula 1" (decisão do stakeholder, Bloqueio 012), não para os demais 14 esportes.
- **Critério 5 — conforme com ressalva.** Home (2026-09-19): sem patrocinadores, banners ou seções de apostas. Ressalva: só a home foi lida, não o site inteiro.
- `robots.txt` (`https://www.f1mania.net/robots.txt`): `Disallow: */feed/` mas `Allow: /feed/` e `Allow: /f1/feed/` (feed usado explicitamente permitido).
- Termos (`https://www.f1mania.net/termos-e-condicoes/`): licença "apenas para visualização transitória pessoal e não comercial"; proíbe copiar para fins comerciais e "mirror" em outro servidor; sem cláusula específica sobre RSS. Fora dos critérios 1/2/5, mas relevante ao R1 (risco jurídico): uso não comercial do protótipo é compatível; sem permissão expressa para redistribuição.

### motorsport-brasil (`motorsport.uol.com.br`, feed `https://motorsport.uol.com.br/rss/f1/news/`)
- **Critério 1 — conforme com ressalva (evidência indireta).** Busca: Motorsport.com pertence a Motorsport Network Media LLC, empresa de mídia e tecnologia dos EUA focada em automobilismo (Wikipedia, "Motorsport Network"/"Motorsport.com"); a edição brasileira redireciona (301) `br.motorsport.com` -> `motorsport.uol.com.br`. Termos (`.../info/terms-of-use/`) e política editorial não puderam ser lidos: domínio bloqueado pela ferramenta.
- **Critério 2 — exceção aceita.** `esportesCobertos: ["formula1"]`; mesma justificativa de `f1mania`.
- **Critério 5 — não verificável.** Home e Termos inacessíveis (`WebFetch: unable to fetch from motorsport.uol.com.br`); nenhuma evidência a favor ou contra. `robots.txt` também não lido.

### estadao-esportes (`estadao.com.br`, feed `.../arc/outboundfeeds/rss/section/esportes/`)
- **Critério 1 — conforme com ressalva (evidência indireta).** Jornal O Estado de S. Paulo (Grupo Estado), fundado em 1875 (Wikipedia, "O Estado de S. Paulo"; também já registrado em RN-19). Site inacessível à ferramenta (`unable to fetch from www.estadao.com.br`); política editorial não lida.
- **Critério 2 — conforme com ressalva.** `fontes.json`: seção geral "esportes", 15 esportes declarados; cobertura efetiva por esporte não conferida no conteúdo real nesta tarefa.
- **Critério 5 — não verificável.** Home e `robots.txt` inacessíveis; nenhuma seção de apostas confirmada nem descartada.
- Termos de RSS (fonte secundária): resultado de busca resume os termos do portal Estadão Conteúdo (`https://www.estadaoconteudo.com.br/servicos/termosdeuso.pdf`, 2016) como "RSS é um serviço gratuito oferecido pelo portal para uso não comercial", com proibição de publicidade associada ao conteúdo RSS e exigência de atribuição. O PDF não foi lido diretamente (conteúdo binário/comprimido) e é de outro domínio (agência), então não vale como Termos do `estadao.com.br`: registrado só como indício para R1.

### r7-esporte (`esportes.r7.com`, feed `.../arc/outboundfeeds/rss/`)
- **Critério 1 — conforme com ressalva (evidência indireta).** Busca: R7 é "portal criado em 2009, pertencente ao Grupo Record" (Wikipédia, "R7"); `@r7esportes` é o perfil oficial de notícias. Termos e política editorial não lidos: `esportes.r7.com` e `www.r7.com` bloqueados pela ferramenta.
- **Critério 2 — conforme com ressalva.** Seção geral de esportes, 15 esportes declarados, cobertura real não conferida.
- **Critério 5 — não verificável.** Sem acesso ao site, `robots.txt` ou Termos.

### torcedores (`torcedores.com`, feed `https://www.torcedores.com/feed/`)
- **Critério 1 — conforme com ressalva.** Home (2026-09-19): equipe de autores nomeados (Luiz Gustavo Moreira, Douglas Nunes, Gabriel Elias, Fabrício Provenzano, Fabio Storino). Site operado por **Better Collective** (rodapé); adquirido em 2023 (`https://www.torcedores.com/noticias/2023/09/anuncio-oficial`; iGaming Business, Gambling Insider). Responsabilidade editorial identificável, mas a controladora é empresa de afiliação de apostas e a origem é rede de blogs; `/quem-somos` retornou 404.
- **Critério 2 — não conforme.** `esportesCobertos: ["futebol", "basquete"]`; busca: "mainly covers football but also basketball, volleyball, tennis and esports". Cobre 2 dos 15 esportes; fora da exceção.
- **Critério 5 — não conforme.** Home (2026-09-19): seção dedicada "Dicas de apostas" com códigos promocionais de Betano, bet365, Betboom (`use TORCEVIP`), KTO, Sportingbet, Estrela Bet e Superbet; rodapé "Ministério da Fazenda adverte: Aposta não é investimento", links "Jogue com Responsabilidade". Operado por afiliado de apostas: vínculo estrutural, e a aquisição visava "explorar outras fontes de receita" além da publicidade tradicional (igamingbusiness.com). Contradiz diretamente o critério 5.
- `robots.txt` (`https://www.torcedores.com/robots.txt`): `Allow: /feed/` para `User-agent: *`.

## Observação sobre o critério 2 (para decisão do stakeholder)
O PRD define o critério 2 como "cobertura multi-esporte capaz de alimentar a maioria dos 15 esportes", e o aceite da tarefa abre exceção só para `f1mania` e `motorsport-brasil`. Aplicado literalmente, `ogol` (só futebol) e `torcedores` (2 esportes) reprovam. `ogol` foi adicionada como fonte de futebol; se o stakeholder considerar que a mesma lógica da exceção de F1 vale para ela, basta registrar a exceção e REFAT-17-02 para `ogol` deixa de ser necessária. `superesportes` (6 esportes) ficou com ressalva.

## Pendências de verificação (não bloqueiam este registro)
Ler Termos/`robots.txt`/home de `motorsport-brasil`, `estadao-esportes` e `r7-esporte` em ambiente com acesso a esses domínios (critério 5 pendente nas três; critério 1 baseado em evidência indireta). Isso vale como verificação manual do stakeholder, à semelhança de P-GE.
