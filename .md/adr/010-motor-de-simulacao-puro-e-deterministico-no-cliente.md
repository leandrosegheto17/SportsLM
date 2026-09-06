# ADR-010 — Motor de simulação puro e determinístico, executado no cliente

- **Status**: Aceito
- **Data**: 2026-09-05
- **Decisor**: Coordenador (chapéu Software Architect)
- **Requisitos afetados**: RF-10, RF-11 (CA-11.1 a CA-11.10), RN-11, RN-14, RNF-14, M4
- **Depende de**: ADR-001, ADR-005

## Contexto

A simulação jogo a jogo entre o time do coração e até 2 rivais é **o diferencial
declarado do produto** (PRD.md §1) e a única funcionalidade que a métrica M4 mede
diretamente. Ela precisa reagir em menos de 1 s a cada palpite (RNF-14), sobreviver a
um recarregamento (CA-11.9, Should), e nunca contradizer o resultado real
(CA-11.6).

Volume: no máximo 3 clubes × até 38 rodadas = 114 partidas restantes no pior caso.

## Decisão

**1. Módulo puro, sem I/O.** `src/dominio/simulacao/` não importa nada de rede, de
`localStorage`, de `Date` ou de React. Recebe entrada, devolve saída:

```ts
type Palpite = 'vitoria' | 'empate' | 'derrota' | null;

interface EntradaSimulacao {
  clubes: ClubeNaSimulacao[];        // 1 time + até 2 rivais, com pontuação atual
  partidasRestantes: PartidaRestante[];  // do Brasileirão, dos clubes acima
  palpites: Record<PartidaId, Palpite>;
}

interface SaidaSimulacao {
  porClube: Record<ClubeId, {
    acumuladoPorRodada: { rodada: number; pontos: number }[];
    projetado: number;        // sem palpite conta 0  (CA-11.3)
    maximoPossivel: number;   // sem palpite conta 3  (CA-11.3)
    vitoriasProjetadas: number;
  }>;
  ordenacao: ClubeId[];       // apenas entre os comparados (CA-11.10)
  empateTecnico: ClubeId[][]; // grupos que empatam em pontos e vitórias (CA-11.5)
}
```

**2. Regras codificadas** (RN-14): vitória 3, empate 1, derrota 0; sem palpite = 0 em
"projetado" e 3 em "máximo possível"; desempate por vitórias projetadas e, persistindo
o empate, marcação `empate técnico`. **Nunca** produz posição na tabela completa nem
simula os demais 17 clubes (CA-11.10) — a saída é uma ordenação **entre os comparados**
e a interface é obrigada a rotulá-la como tal (UX-SPEC, T-09).

**3. Confronto direto é entrada única espelhada** (CA-11.4): partidas em que dois
clubes comparados se enfrentam são identificadas no carregamento e recebem um
`espelho` — definir "vitória" para um grava automaticamente "derrota" para o outro.
Contradição é impossível por construção, não por validação posterior.

**4. Resultado real vence sempre** (CA-11.6): antes de aplicar palpites, o motor
marca como `travada` toda partida com status `finalizada` no snapshot e usa o
resultado real. O palpite guardado para essa partida é descartado do cálculo e a
camada de aplicação compara o conjunto de partidas travadas com o que estava travado
na última visita, para exibir o aviso "N palpites viraram resultado real".

**5. Determinismo**: sem aleatoriedade, sem relógio interno (data e hora entram como
parâmetro), ordenação estável com critério de desempate final por id do clube. A mesma
entrada produz sempre a mesma saída — condição para o Validador testar por tabela.

**6. Desempenho**: recálculo é O(partidas) ≈ 114 operações. Em prática, poucos
milissegundos, muito abaixo do 1 s de RNF-14. Nenhuma memoização é necessária;
introduzir memoização aqui seria complexidade sem ganho.

**7. Persistência do cenário** (CA-11.9, Should): só os palpites são gravados, sob a
chave de escopo `temporada:time:rivais-ordenados` (ADR-005). Nada do resultado
calculado é gravado — ele é sempre derivado, o que impede cenário "salvo" divergindo
do dado atual.

**8. Sem jogos restantes** (CA-11.8) e **campeonato encerrado** (CA-09.7): o motor
devolve `partidasRestantes: []` e a interface exibe "campeonato encerrado — sem jogos
restantes" com a pontuação final. Não é caso de erro.

## Consequências

**Positivas**: o diferencial do produto fica na parte mais testável e mais barata do
sistema; funciona offline depois do primeiro carregamento; cobertura de teste
unitário próxima de 100% é realista e vira critério de aceite no Loop C.

**Negativas**: como todo o cálculo é local, corrigir um erro de regra exige novo
deploy do frontend (não há como corrigir por dado). Mitigação: tabela de casos
canônicos versionada junto do módulo, incluindo os casos de CA-11.3, CA-11.4, CA-11.5
e CA-11.6.

**Fronteira explícita**: o motor **não** conhece campeonato que não seja o Brasileirão
(RN-11). A entrada é montada por um seletor que já filtra por competição — a restrição
é estrutural, não uma verificação espalhada pela interface.

## Se virar produto

Considerar projeção probabilística (que exigiria decisão de produto nova, hoje fora de
escopo por Q14) e comparação de cenários lado a lado.
