# ADR-003 — Aplicação de página única com rotas no cliente (refinamento de I-03)

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéus Software Architect + UX/UI)
- **Requisitos afetados**: RNF-01, RAN-16, I-03, RF-07, RF-08, RF-10, RF-11
- **Depende de**: ADR-001

## Contexto

O stakeholder pediu "uma página Web" (Q7). O chapéu BA interpretou como "aplicação de
página única com seções e configurações em sobreposição" (I-03), deixando a técnica
para o Coordenador.

A leitura literal extrema — uma única rota, tudo em rolagem, sem histórico de
navegação — quebra em quatro pontos concretos deste produto:

1. **Botão voltar do celular.** O painel do time tem profundidade real: painel →
   campeonato → tabela. Sem rota, o "voltar" do Android sai do produto em vez de
   voltar ao painel. Em um protótipo testado majoritariamente em celular, isso é o
   caminho mais rápido para perder o testador.
2. **Recarregar a página perde o lugar.** Comparativo e simulação são o diferencial
   (M4); recarregar e cair na home todas as vezes desestimula o uso.
3. **Compartilhar/retomar.** O testador precisa conseguir voltar exatamente à
   simulação para reportar comportamento.
4. **Acessibilidade.** Mudança de seção sem mudança de rota não move o foco nem
   anuncia o novo contexto ao leitor de tela (WCAG 2.4.3, 4.1.3 — ver ADR-014).

## Decisão

**Confirmar a interpretação I-03 como aplicação de página única** — um único
documento HTML, um único deploy, nenhuma navegação de página para o servidor — **e
refiná-la**: as seções principais são **rotas no cliente**, com histórico de navegação
real. As configurações continuam em **sobreposição** (folha/modal), sem rota própria,
exatamente como I-03 previu.

Mapa de rotas:

| Rota | Tela | Observação |
|---|---|---|
| `/` | Home: seção "Seus esportes" + feed (T-02) | Rota inicial |
| `/onboarding` | Onboarding em 2 passos (T-01) | Só quando não há preferências |
| `/time` | Painel do time (T-05) | Convite se não houver time |
| `/time/:campeonatoId` | Detalhe do campeonato (T-06) | |
| `/comparativo` | Comparativo no Brasileirão (T-08) | Convite se não houver rival |
| `/simulacao` | Simulação de cenário (T-09) | |

Sobreposições **sem rota** (fecham com `Esc`, devolvem o foco ao gatilho):
configurações/fontes (T-03), escolha ou troca de time (T-04), escolha de rivais
(T-07).

**Implementação do fallback no hosting estático**: `404.html` é uma cópia de
`index.html` (padrão do GitHub Pages), de modo que qualquer rota profunda carregue a
aplicação. Como salvaguarda, o modo de roteamento é uma variável de build,
`VITE_ROTEAMENTO=historico|hash`; se algum navegador embutido do grupo de teste tratar
mal o status 404, basta trocar para `hash` e reconstruir, sem mudança de código.

## Alternativas consideradas

- **Rolagem única com âncoras** (`#feed`, `#time`): mais literal, mas não resolve
  profundidade (campeonato, simulação) e degrada o "voltar" no celular. Recusada.
- **Multi-página com HTML gerado por campeonato**: melhor tempo de primeira pintura,
  mas contraria "uma página Web" e multiplica o número de artefatos publicados.
  Recusada.

## Consequências

**Positivas**: botão voltar correto; estado retomável ao recarregar; foco gerenciável
por rota (anúncio do novo título ao leitor de tela); divisão de código por rota, o que
ajuda o orçamento de desempenho (ADR-016).

**Negativas**: exige gestão explícita de foco e de título do documento a cada troca de
rota (é requisito de aceite no UX-SPEC, Seção 5, não opcional); o truque do `404.html`
retorna status HTTP 404 na primeira resposta de uma rota profunda — irrelevante para
um protótipo sem SEO, mas registrado.

**Registro para o Gestor**: este ADR **refina** a interpretação I-03; não altera
requisito nem escopo. Continua sendo uma página Web, um deploy, configurações em
sobreposição.

## Se virar produto

Avaliar pré-renderização das rotas públicas (home e painel por clube) para melhorar
tempo de primeira pintura e permitir compartilhamento com pré-visualização.
