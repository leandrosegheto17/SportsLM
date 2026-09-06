# ADR-017 — Cor de identidade derivada do clube, com paleta acessível pré-computada no pipeline

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéus UX/UI + Software Architect)
- **Requisitos afetados**: RNF-03, RAN-16, CA-06.1, RN-15/RF-18
- **Relaciona**: **estende** [ADR-014](014-nivel-de-acessibilidade-alvo-wcag-2-2-aa.md)
  (verificação) e [ADR-004](004-stack-de-frontend-react-typescript-vite.md)
  (mecanismo de tokens). **Não supersede nenhum ADR** — ver §"Por que nada foi
  substituído".
- **Origem**: direção visual "Camisa", escolhida pelo stakeholder em 2026-09-05

## Contexto

A direção visual aprovada pelo stakeholder ("design moderno, divertido e que remeta a
esportes") coloca a **identidade do clube governando a tela**: faixa com listras
diagonais no topo, número da posição em tamanho de camisa, barra colorida na borda dos
cartões, sublinhado da navegação, botão primário.

Isso muda uma premissa que eu mesmo tinha escrito na primeira rodada do `UX-SPEC.md`:
"a cor do clube é usada **apenas** no avatar de iniciais, nunca em texto de conteúdo,
para não quebrar o contraste garantido". Aquela regra existia justamente para manter o
contraste sob controle. Com a nova direção ela cai, e o problema que ela evitava passa
a existir de verdade:

1. **A paleta deixa de ser fixa.** São 20 clubes na Série A e a temporada troca a
   lista. O contraste da tela passa a depender de um dado de configuração.
2. **Clubes sem cor cromática.** Corinthians, Botafogo, Santos, Vasco, Atlético-MG e
   Ceará são preto e branco. "A cor do clube" não existe como cor de destaque.
3. **Clubes de cor clara.** Amarelo (Mirassol, Criciúma) tem luminância altíssima:
   texto branco sobre ele é ilegível, e escurecer o amarelo até virar texto legível o
   transforma em marrom — destrói o reconhecimento, que é o objetivo da direção.
4. **Superfícies escuras.** A navegação é preta (`#16181A`); o sublinhado do item ativo
   na cor de um clube preto e branco seria invisível.

Resolver isso "no olho", clube a clube, não é aceitável: seria 20 decisões não
auditáveis, e a virada de temporada traria clubes novos sem ninguém revisar.

## Decisão

### 1. Dois papéis distintos para a cor do clube — é isto que resolve o problema

A confusão desaparece quando se para de tratar "a cor do clube" como um valor único:

| Papel | Token | O que precisa garantir |
|---|---|---|
| **Preenchimento de superfície grande** (faixa, tira do bloco, barra do cartão, botão) | `--clube-identidade` | Nada de contraste com o fundo. **Mantém a cor oficial sem alteração** — é o que faz o torcedor reconhecer o time. Em compensação, toda superfície que a usa é obrigada a ter contorno de 1 px em `--cor-borda-forte`, o que satisfaz WCAG 1.4.11 por delimitação em vez de por cor |
| **Cor em tamanho de texto** (número, link, ênfase pequena, sublinhado da navegação) | `--clube-acento` / `--clube-acento-sobre-escuro` | **≥ 4,5:1** contra o fundo em que é usada. Aqui, sim, a cor é ajustada — e como só aparece em elementos pequenos, o ajuste não compromete o reconhecimento, que já foi entregue pela superfície grande |

O amarelo do Mirassol continua amarelo vivo na faixa (com texto preto por cima) e vira
âmbar escuro apenas no número e nos links. As duas coisas ao mesmo tempo, sem conflito.

### 2. Algoritmo de derivação (determinístico, sem dependência nova)

Entrada: `corBase` (cor oficial do clube, em `clubes-2026.json`).
Trabalha em HSL e valida por razão de contraste WCAG — as duas coisas são aritmética
simples, implementáveis sem biblioteca de cor (a lista de dependências do SDD §3
continua fechada).

```
1. hsl = rgbParaHsl(corBase)

2. acromatico = (hsl.s < 0,15) OU (hsl.l < 0,10) OU (hsl.l > 0,93)

3. SE acromatico:                       // Corinthians, Botafogo, Santos, Vasco…
     identidade            = #16181A    // tinta: o preto é a cor do clube
     faixaB                = #3A3F45    // 2º tom da listra: a textura precisa aparecer
     identidadeTexto       = #FFFFFF
     acento                = #16181A
     acentoSobreEscuro     = #F2EFEA
     suave                 = #EDEAE4  ; suaveEscuro     = #24272C
     identidadeEscuro      = #F2EFEA  ; faixaBEscuro    = #C9C3B8
     identidadeTextoEscuro = #16181A

   SENÃO:
     identidade        = corBase                              // sem alteração
     faixaB            = ajustarL(corBase, l >= 0,30 ? l-0,08 : l+0,08)
     identidadeTexto   = o que der MAIOR contraste entre #FFFFFF e #16181A,
                         medido contra o PIOR caso entre identidade e faixaB
     acento            = escurecerAte(corBase, ≥4,5:1 vs #FAF7F2 E vs #FFFFFF),
                         passo l -= 0,02, piso l = 0,08
     acentoSobreEscuro = clarearAte(corBase, ≥4,5:1 vs #16181A E vs #121316),
                         passo l += 0,02, teto l = 0,92
     suave             = hsl(h, min(s; 0,45), 0,94)
     suaveEscuro       = hsl(h, min(s; 0,45), 0,16)

4. VALIDAR todos os alvos da tabela §3. Falha em qualquer um = FALHA DE BUILD.
   Não existe queda silenciosa para uma cor "parecida".

5. Override manual por clube é permitido em clubes-2026.json (campo `paletaManual`),
   para o caso de a derivação produzir algo feio ou irreconhecível — e passa
   exatamente pela mesma validação do passo 4.
```

### 3. Alvos de contraste (todos verificados, nenhum presumido)

| Par | Alvo | Critério WCAG |
|---|---|---|
| `identidadeTexto` sobre `identidade` | ≥ 4,5:1 | 1.4.3 |
| `identidadeTexto` sobre `faixaB` (pior stop da listra) | ≥ 4,5:1 | 1.4.3 |
| `acento` sobre `--cor-fundo` e sobre `--cor-superficie` | ≥ 4,5:1 | 1.4.3 |
| `acentoSobreEscuro` sobre `#16181A` (navegação) e sobre o fundo escuro | ≥ 4,5:1 | 1.4.3 |
| `--cor-tinta` sobre `suave` | ≥ 4,5:1 | 1.4.3 |
| `identidade` como preenchimento | **sem alvo de cor** — exige contorno de 1 px | 1.4.11 por delimitação |

Duas regras duras que decorrem disso:

- **O anel de foco nunca usa cor de clube.** `--cor-foco` é fixo (`#1F6FB2` claro /
  `#7FC0F0` escuro), porque um foco na cor do clube desapareceria sobre uma superfície
  do próprio clube. Foco é segurança de navegação, não identidade.
- **Cor de clube nunca é a única pista de significado** (WCAG 1.4.1). Ela decora e
  identifica; nunca informa sozinha. V/E/D, zonas da tabela e estado de fonte
  continuam com letra e rótulo textual, em cores fixas do sistema.

### 4. Onde o cálculo acontece — decisão de arquitetura, não de estilo

A paleta é **pré-computada no pipeline** e gravada em `clubes-2026.json` como um bloco
`paleta` explícito; o navegador apenas aplica os valores como CSS custom properties no
elemento raiz quando o time é escolhido.

Alternativa recusada: calcular no navegador, em tempo de execução.

| | Pré-computado no pipeline (escolhido) | Calculado no navegador |
|---|---|---|
| Auditabilidade | A paleta dos 20 clubes é um artefato versionado, revisável em diff | Some — só existe em runtime |
| Verificação | Teste unitário afirma as razões de contraste dos 20 clubes; violação quebra o build | O Validador não teria o que verificar estaticamente |
| Peso no cliente | Zero: nenhuma matemática de cor no bundle | ~1 KB e trabalho no primeiro pintar |
| Falha | Ruidosa, no build, antes de chegar a alguém | Silenciosa, na tela do usuário |

Consequência direta no `SDD.md`: o campo `Clube.cor` do modelo de dados (§5.2) deixa de
ser um valor cosmético e passa a ser o bloco `paleta`, produzido e validado na
ingestão. O SDD foi ajustado nesse ponto.

### 5. Estado antes de o usuário escolher um time

A identidade padrão do produto é **a mesma dos clubes acromáticos**: tinta com listras
em cinza. Três motivos: (a) é consistente com o sistema, sem uma paleta paralela para
manter; (b) comunica honestamente "ainda não há time aqui" sem precisar de texto extra;
(c) escolher o time **acende a tela**, o que transforma a personalização em recompensa
visível — exatamente o comportamento que M2 mede.

## Por que nada foi substituído

- **ADR-014 (WCAG 2.2 AA) não é superseded**: a decisão — nível AA como critério não
  negociável — não mudou. O que mudou foi o *método de verificação* de parte dos
  tokens, que sai de "conferido à mão na tabela" para "derivado e validado por teste
  para os 20 clubes". Isso é extensão, não reversão. Superseder um ADR cuja decisão
  continua valendo enfraqueceria a convenção.
- **ADR-004 (CSS Modules + tokens em custom properties) não é superseded**: custom
  properties são justamente o mecanismo que permite injetar a paleta do clube em tempo
  de execução. A decisão continua correta; ganha uma nota: as cores de clube vivem em
  `clubes-2026.json` (configuração validada), não no arquivo de tokens, e essa é a
  única exceção à regra "nenhum valor de cor fora do arquivo de tokens".
- **ADR-016 (orçamento de desempenho) não é superseded**: as listras são
  `repeating-linear-gradient` em CSS, sem imagem; a paleta é um punhado de custom
  properties. O orçamento se mantém. A única fricção está registrada como
  consequência negativa abaixo.

## Consequências

**Positivas**: a direção visual que o stakeholder escolheu fica implementável sem abrir
mão de AA; o reconhecimento do clube é preservado inclusive nos casos difíceis
(amarelo, preto e branco); a acessibilidade da cor vira teste automatizado sobre um
artefato versionado, em vez de inspeção visual clube a clube; a virada de temporada
traz clubes novos já validados ou quebra o build — nunca entrega tela com contraste
ruim em silêncio.

**Negativas**
- Seis clubes preto e branco ficam com a mesma identidade visual entre si. Mitigação:
  o avatar circular com a sigla e o nome em display continuam diferenciando, e o
  segundo tom da listra dá textura. É uma perda real de personalidade, aceita — a
  alternativa seria inventar uma cor que o clube não tem.
- A tipografia da direção pede peso 800. A pilha de fontes do sistema (sem webfont,
  ADR-016) nem sempre tem 800 e cai para 700 em parte dos aparelhos. Aceito: a
  alternativa custaria o orçamento de rede que sustenta M3.
- Um clube com cor oficial muito clara terá `acento` bem distante da cor da faixa. É
  intencional, mas visualmente é uma inconsistência que só o `paletaManual` resolve
  caso incomode.

## Se virar produto

Revisão de marca com o stakeholder para decidir entre paleta derivada e paleta
curada clube a clube, e reavaliação do uso de escudos oficiais (decisão D5 do SDD),
que hoje está fora por risco de marca.
