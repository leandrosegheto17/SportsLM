# ADR-006 — Camada de adaptação por provedor de futebol, com mapa de cobertura por competição

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-07, RF-08, RF-16, RN-01, RN-05, RN-13, CA-07.2, CA-16.4, CA-16.5
- **Premissas atacadas**: P2a (validada), P2b (não validada), P8 (não validável agora), R2, R5

## Contexto

O produto precisa mostrar **todos** os campeonatos do ano do clube — estaduais e
regionais inclusive (RN-05) — e campeonato sem cobertura precisa aparecer com "sem
dados", nunca sumir (CA-07.2).

Estado da evidência em 2026-09-05:

| Provedor | Cobertura verificada | Termos | Veredito |
|---|---|---|---|
| **football-data.org** | Plano gratuito confirmado nesta rodada: inclui "Serie A" do Brasil (tabela + calendário completo). **Não inclui** Copa do Brasil, Libertadores, Sul-Americana nem estaduais (`https://www.football-data.org/coverage`) | Públicos (`https://docs.football-data.org/general/v4/policies.html`), 10 req/min | **Adotado** para o Brasileirão |
| TheSportsDB | Tem a liga "Brazilian Campeonato Paulista" (id 5767) com resultados da temporada 2026; **classificação não confirmada** e calendário futuro vazio na consulta feita | Página de termos existe, conteúdo não verificado; uso comercial declara US$ 9/mês | **Candidato — spike SP-01** |
| API-Football (api-sports.io) | Página de cobertura respondeu HTTP 403 à ferramenta; cobertura brasileira por campeonato segue não confirmada | Públicos | **Candidato — spike SP-01** (exige conta real) |
| API Futebol (api-futebol.com.br) | Não verificável neste ambiente | — | Candidato secundário |
| API não oficial da ESPN | Cobre `bra.1`, `bra.2`, Copa do Brasil e continentais | **Sem termos públicos** | **Inelegível por RN-01** — não usar, mesmo que funcione |

Ou seja: o insumo do diferencial (Brasileirão) está garantido e gratuito; o resto do
painel não tem fonte gratuita validada.

## Decisão

1. **Portas e adaptadores.** O pipeline conversa com uma interface única
   `ProvedorFutebol`; cada provedor é um adaptador que traduz o formato dele para o
   modelo de domínio interno (Seção 5 do SDD). Nenhum tipo de provedor vaza para o
   domínio nem para o snapshot público.

   ```ts
   interface ProvedorFutebol {
     readonly id: string;                       // 'football-data'
     readonly orcamento: { porMinuto?: number; porDia?: number };
     obterClassificacao(comp: RefCompeticao): Promise<LinhaClassificacao[]>;
     obterPartidas(comp: RefCompeticao): Promise<Partida[]>;
   }
   ```

2. **Mapa de cobertura como configuração**, em `config/campeonatos-2026.json`: cada
   competição declara `provedor` (id do adaptador) ou `null`. `null` significa **sem
   cobertura** e produz exatamente o estado "sem dados" + "cobertura indisponível
   nesta versão" (CA-07.2/CA-16.5). Adicionar um provedor para estaduais é, portanto,
   *um adaptador novo + uma edição de configuração* — não um redesenho.

3. **Mapa de clubes por provedor**, em `config/clubes-2026.json`: cada clube tem o id
   interno (slug) e `idsProvedor: { "football-data": 1783, ... }`. Casamento por nome
   é proibido (fonte clássica de erro silencioso: "Athletico" vs "Atlético"). Clube
   sem id mapeado para o provedor em uso é registrado como inconsistência e o dado é
   descartado (CA-16.6).

4. **Provedor inicial**: `football-data.org` apenas para o Brasileirão Série A. Custo
   de requisições por execução: **2** (`/competitions/BSA/standings` e
   `/competitions/BSA/matches`) — folga enorme sobre 10 req/min.

5. **Nenhum provedor pago é adotado sem consulta ao stakeholder** (RN-13). Registrado
   como decisão pendente na Seção 6 do SDD.

6. **Derivação de fase/eliminação (P8)**: quando o provedor não expõe fase ou
   eliminação de forma explícita, o adaptador **deriva** a partir das partidas do
   clube naquela competição (última fase em que o clube tem partida finalizada, sem
   partida futura naquela competição enquanto a competição segue ativa → "eliminado
   na <fase>"). Se a derivação for ambígua, o status vira "sem dados" — nunca um
   palpite apresentado como fato.

## Consequências

**Positivas**: painel funciona hoje com o Brasileirão completo; a lacuna de cobertura
é visível e honesta em vez de silenciosa; ampliar cobertura é incremental.

**Negativas**: o requisito "todos os campeonatos do ano" fica **parcialmente atendido**
na v1 — a maior parte dos cards do painel de um clube pode exibir "sem dados" entre
janeiro e junho (janela dos estaduais e regionais). É risco **RT-02 (alta)** na Seção
6 do SDD e decisão de negócio pendente para o stakeholder (R5).

**Orçamento de cota se um segundo provedor entrar** (informação para o spike): no
plano gratuito de 100 requisições/dia da API-Football, 8 competições × 2 chamadas =
16 requisições por execução; com 6 execuções/dia chega-se a 96/dia — no limite. Esse
número, e não a cobertura, tende a ser o fator decisivo. O spike SP-01 precisa medir
os dois.

## Se virar produto

Contratar plano pago com cobertura declarada por competição, com contrato de SLA e
verificação automatizada de cobertura por temporada; manter os adaptadores para poder
trocar de fornecedor sem tocar no domínio.
