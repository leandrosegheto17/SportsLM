# ADR-015 — Perfil de protótipo: o que foi deliberadamente não construído e o que muda se virar produto

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RNF-07 a RNF-15, RAN-20, R1, R4
- **Relaciona**: todos os demais ADRs (cada um tem sua seção "Se virar produto")

## Contexto

O stakeholder declarou (Q10) que a aplicação é um **protótipo**, sem prazo e sem
compromisso de lançamento comercial nesta fase, e o Gestor relaxou os requisitos não
funcionais de acordo (PRD-TECNICO §2, com a coluna "se virar produto").

O risco típico dessa situação é dos dois lados: superdimensionar (construir para
escala que não existe, gastando o tempo do protótipo em infraestrutura) ou
subdimensionar sem registro (tomar atalhos que ninguém documentou e que explodem
depois). Este ADR existe para tornar cada atalho **uma decisão nomeada**.

## Decisão

**Perfil de protótipo adotado — o que NÃO se constrói agora, com o motivo:**

| # | Não construído | Motivo | O que existe no lugar |
|---|---|---|---|
| 1 | Backend em runtime, banco de dados, API própria | Nenhuma computação por usuário existe (ADR-001) | Snapshots JSON estáticos |
| 2 | Autenticação, contas, sessão | Fora de escopo por decisão (Q6) | Preferências locais (ADR-005) |
| 3 | Monitoramento, alertas, painéis de observabilidade | RNF-11 nível protótipo | Log do agendador + `status.json` + estados visíveis na tela |
| 4 | Ambientes separados (dev/homologação/produção) | Um só destino, grupo de teste | Pré-visualização por *pull request* e um único ambiente publicado |
| 5 | Testes de carga, plano de capacidade | RNF-13: dezenas de usuários; conteúdo estático em CDN | — |
| 6 | Estratégia de rollback automatizada | Publicação estática: reverter é republicar o commit anterior | Histórico do repositório |
| 7 | Consentimento LGPD formal, política de privacidade | Sem dado pessoal (RNF-07) | Aviso simples + telemetria desligável (ADR-012) |
| 8 | Cache offline / *service worker* / PWA instalável | Não pedido; adiciona classe inteira de bugs de cache obsoleto | Cache HTTP padrão + `versao.json` |
| 9 | Internacionalização | Só pt-BR (RNF-02) | Textos em um único módulo de strings, o que já facilita i18n depois |
| 10 | Escudos e marcas oficiais dos clubes | Direito de imagem/marca não revisado (R1/R4) | Avatar com iniciais e cor do clube (UX-SPEC §7) |

**O que NÃO é relaxado, mesmo em protótipo** — porque relaxar cria dívida cara ou é
inegociável por outro motivo:

- Acessibilidade WCAG 2.2 AA (ADR-014) — retrofit de acessibilidade custa mais que
  fazer certo.
- Sanitização de conteúdo de terceiros e política de conteúdo (ADR-011) — é segurança,
  não polimento.
- Nenhum segredo no bundle publicado (ADR-002).
- Regras de elegibilidade de fonte/provedor: sem scraping, sem API sem termos
  (RN-01/ADR-013) — é risco jurídico, não técnico.
- Tipagem estrita e validação de esquema nas fronteiras — é o que permite ao protótipo
  falhar alto em vez de exibir dado errado como se fosse certo.
- Determinismo e cobertura de teste do motor de simulação (ADR-010) — é o diferencial.

**Gatilhos que promovem o protótipo a produto** (qualquer um deles reabre
RNF-07/08/11/12/13 e as ressalvas R1/R4 do Gate 1, e exige nova rodada do Gestor):

1. Decisão de lançamento público ou de monetização (R1).
2. Adoção de qualquer fonte ou provedor pago (RN-13).
3. Necessidade de conta, sincronização entre dispositivos ou notificação.
4. Uso além do grupo de teste — ordem de centenas de usuários.
5. Qualquer uso comercial de conteúdo de terceiros (RNF-08) — exige revisão jurídica
   antes, sem exceção.

## Consequências

**Positivas**: o custo de operar é zero e o tempo do protótipo vai para o produto, não
para infraestrutura; cada atalho está nomeado, com dono e gatilho, em vez de virar
surpresa.

**Negativas**: promover a produto **não** é uma questão de "ligar uma chave" — os itens
1, 3, 4 e 7 da tabela acima são projetos próprios. A estimativa honesta é que a
promoção a produto é um novo ciclo de planejamento completo, não um incremento.

## Se virar produto

Este ADR é superseded por um ADR de arquitetura de produção, que precisa endereçar,
na ordem: revisão jurídica (R1/R4), backend e banco gerenciados, contas, observabilidade
com alerta, ambientes e pipeline com rollback, LGPD completa e plano de capacidade.
