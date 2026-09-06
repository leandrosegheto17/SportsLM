# ADR-012 — Telemetria mínima anônima, com identificador local e desligável

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RNF-07, RNF-04, M1, M2, M3, M4
- **Depende de**: ADR-001, ADR-005

## Contexto

As quatro métricas de sucesso do protótipo só existem se houver telemetria: retenção
D7 (M1), conclusão da personalização na segunda sessão (M2), tempo até a primeira
interação útil (M3) e frequência de abertura do comparativo/simulação (M4). Ao mesmo
tempo, RNF-07 é explícito: **sem conta, sem dado pessoal, telemetria mínima e
anonimizada**, com consentimento simples se a ferramenta exigir.

M1 e M2 exigem distinguir "mesmo dispositivo voltando" de "dispositivo novo". Isso
não requer identidade — requer um identificador opaco, local e sem correlação com
nada.

## Decisão

**1. Exatamente cinco eventos**, nenhum a mais (a lista é fechada e vai para
`GUARDRAILS.md`):

| Evento | Quando | Carga |
|---|---|---|
| `primeira_sessao` | Primeira execução no dispositivo | — |
| `retorno` | Abertura com preferências já existentes | dias desde a primeira sessão |
| `personalizacao_concluida` | ≥ 1 favorito e (se aplicável) time definidos | quantidade de favoritos; se há time |
| `primeira_interacao_util` | Abrir uma notícia ou abrir o painel do time | milissegundos desde o início da navegação |
| `comparativo_aberto` | Entrada na rota `/comparativo` ou `/simulacao` | qual das duas |

**2. Identificador anônimo local**: UUID v4 gerado no dispositivo, guardado em
`sportslm.anonimo.v1` (ADR-005). Não deriva de IP, de dispositivo, de rede nem de
comportamento; não é enviado com nenhum outro atributo; é apagado ao limpar o
navegador; é reiniciável por um botão nas configurações. **Não é dado pessoal**: não
identifica pessoa nem permite correlação entre sites.

**3. Nada de conteúdo é enviado**: nunca o time escolhido, nunca os favoritos, nunca
as fontes bloqueadas, nunca URL de notícia, nunca palpite. Apenas nome do evento,
identificador anônimo, carimbo de tempo e o número da tabela acima.

**4. Ferramenta**: serviço de análise sem cookies e sem rastreio entre sites, com plano
gratuito para uso não comercial — **GoatCounter** como opção padrão, **Cloudflare Web
Analytics** como alternativa. Ambas são gratuitas; nenhuma opção paga é adotada sem
consulta ao stakeholder (RN-13). A confirmação do plano e dos termos é o **spike
SP-04** do Loop C — não uma suposição deste ADR.

**5. Desligável por construção**: variável de build `VITE_TELEMETRIA=on|off`. Com
`off`, nenhum código de telemetria entra no bundle e nenhuma requisição sai do
navegador. O grupo de teste recebe a versão com telemetria; qualquer demonstração
pública pode usar a versão sem.

**6. Consentimento**: aviso simples e discreto no rodapé das configurações,
explicando os cinco eventos, o identificador anônimo e o botão de reiniciar/desativar.
Sem banner de cookie — não há cookie.

**7. `connect-src`** da política de conteúdo (ADR-011) só permite `'self'` e o host da
telemetria. Se a telemetria estiver desligada, a diretiva fica `'self'` apenas.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Sem telemetria nenhuma | M1-M4 ficariam inverificáveis; o protótipo perderia seu critério de pronto |
| Google Analytics | Rastreio entre sites, cookies, discussão de transferência internacional de dados — desproporcional e contrário ao espírito de RNF-07 |
| Analytics próprio | Exigiria backend, contrariando ADR-001 |
| Só contagem de páginas, sem identificador | Suficiente para M3, insuficiente para M1/M2/M4 |

## Consequências

**Positivas**: métricas viáveis com custo zero e exposição de privacidade mínima; a
lista fechada de eventos torna trivial a auditoria do Validador (qualquer evento fora
da tabela é achado).

**Negativas**: dependência de um terceiro em runtime — a única do produto. Mitigada
pelo interruptor de build e pela política de conteúdo.

**Risco de método**: com coorte mínima de 20 usuários (P10), percentuais são
indicativos, não estatísticos — já registrado pelo Gestor em I-24.

## Se virar produto

Instância própria de análise (auto-hospedada), base legal LGPD declarada, política de
privacidade publicada, consentimento formal e retenção definida — RNF-07 muda de
"mínima" para "completa" (ADR-015).
