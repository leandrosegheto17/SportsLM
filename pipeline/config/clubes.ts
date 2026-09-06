// pipeline/config/clubes.ts — CFG-02 (TASK.md Lote 2)
//
// Schema Zod + carregador de `config/clubes-2026.json`: os 20 clubes da Série A
// 2026 (RN-04), só com os dados BASE (nome, nomeCurto, sigla, corBase,
// idsProvedor). **Sem** `paleta` derivada — isso é PUB-01 (Lote 6, ADR-017), que
// consome este mesmo arquivo e acrescenta o bloco `paleta` antes de publicar em
// `/dados/config/clubes-2026.json` (SDD §2.2/§5.2).
//
// Decisão de convenção registrada (TASK.md §6): o schema/carregador vive em
// `pipeline/config/`, não em `config/` (que, por README.md de FUND-01, guarda só
// dado — nenhum código) nem em `dominio/tipos` (DOM-01, ainda não implementado
// neste momento — Lote 3 corre em paralelo ao Lote 2). Quando DOM-01 existir, o
// tipo completo `Clube` do SDD §5.2 (com `paleta`/`paletaManual`) vive lá; este
// módulo cobre só a fatia "dados base" desta tarefa, sem duplicar SDD §5.2 nem
// antecipar a derivação de paleta.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { paletaClubeSchema } from '../../dominio/tipos/futebol';

const ESQUEMA_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ESQUEMA_COR_HEX = /^#[0-9A-Fa-f]{6}$/;
const ESQUEMA_SIGLA = /^[A-Z]{3}$/;

/**
 * Id do adaptador de futebol usado como chave em `idsProvedor` — mesma
 * convenção do exemplo em ADR-006 §"Decisão" item 3 (`idsProvedor: {
 * "football-data": 1783, ... }`), que casa com `ProvedorFutebol.id` (ADR-006
 * item 1). Não é o hostname `football-data.org`.
 */
export const ID_PROVEDOR_FOOTBALL_DATA = 'football-data';

/**
 * Sentinela explícita para id de provedor ainda não confirmado (ver nota de
 * decisão no final deste arquivo e em TASK.md/CFG-02). Nunca um número
 * "plausível" inventado — GUARDRAILS.md §7 proíbe decisão silenciosa sobre
 * dado que devia vir verificado.
 */
export const SENTINELA_ID_PENDENTE = 'pendente-confirmacao';

export const EsquemaClubeBase = z
  .object({
    id: z
      .string()
      .regex(
        ESQUEMA_SLUG,
        'id deve ser um slug estável em minúsculas (ex.: "atletico-mg")',
      ),
    nome: z.string().min(1, 'nome não pode ser vazio'),
    nomeCurto: z.string().min(1, 'nomeCurto não pode ser vazio'),
    sigla: z
      .string()
      .regex(ESQUEMA_SIGLA, 'sigla deve ter exatamente 3 letras maiúsculas'),
    corBase: z
      .string()
      .regex(
        ESQUEMA_COR_HEX,
        'corBase deve ser hex #RRGGBB — entrada da derivação de paleta (ADR-017)',
      ),
    idsProvedor: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .refine(
        (mapa) => Object.keys(mapa).length > 0,
        'idsProvedor não pode ser vazio (CFG-02, critério de aceite)',
      ),
    // Campo acrescentado por PUB-01 (TASK.md Lote 6, ADR-017 item 2, passo
    // 5): "Override manual por clube é permitido em clubes-2026.json (campo
    // paletaManual), para o caso de a derivação produzir algo feio ou
    // irreconhecível — e passa exatamente pela mesma validação do passo 4."
    // Mesmo campo já previsto em `dominio/tipos/futebol.ts` (`Clube.paletaManual`,
    // DOM-01) — reaproveitado aqui em vez de redefinido, na mesma direção de
    // dependência documentada no topo deste arquivo (pipeline/ consome
    // dominio/, nunca o contrário). CFG-02 não tinha este campo porque a
    // derivação de paleta (e, portanto, o eventual override) ainda não
    // existia — não é mudança de contrato dos campos *base* de CFG-02,
    // só a extensão explicitamente prevista pelo próprio ADR-017 para o
    // consumidor (PUB-01) que a implementa.
    paletaManual: paletaClubeSchema.partial().optional(),
  })
  .strict();

export type ClubeBase = z.infer<typeof EsquemaClubeBase>;

export const EsquemaClubesBase = z.array(EsquemaClubeBase);

const CAMINHO_ARQUIVO = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../config/clubes-2026.json',
);

/**
 * Lê e valida `config/clubes-2026.json` contra `EsquemaClubesBase`. Lança em
 * caso de esquema inválido — nunca corrige heuristicamente (GUARDRAILS.md §4).
 * Parâmetro `caminho` só existe para permitir teste com fixture; produção
 * sempre usa o caminho real do arquivo de configuração.
 */
export function carregarClubesSerieA2026(caminho: string = CAMINHO_ARQUIVO): ClubeBase[] {
  const bruto = readFileSync(caminho, 'utf8');
  const json: unknown = JSON.parse(bruto);
  return EsquemaClubesBase.parse(json);
}

export function obterClubePorId(clubes: ClubeBase[], id: string): ClubeBase | undefined {
  return clubes.find((clube) => clube.id === id);
}

// Decisão de detalhe registrada (TASK.md §6, ADR-006 item 3): nesta rodada, só
// o id de `flamengo` no provedor `football-data` foi confirmado — é o exemplo
// já citado literalmente no próprio ADR-006 (`1783`). Para os demais 19
// clubes, o ambiente deste Executor não tem o token do provedor (ele só existe
// como segredo de CI, GUARDRAILS.md §4/FUND-02) e a API pública devolve 403
// sem autenticação — não há como confirmar o id real com confiança. Em vez de
// inventar um número plausível (proibido por instrução explícita desta
// tarefa), esses 19 clubes usam `SENTINELA_ID_PENDENTE`, uma string que:
// (a) satisfaz o critério de aceite "nenhum idsProvedor vazio";
// (b) nunca é confundida com um id numérico real;
// (c) já tem comportamento definido a jusante: ADR-006 item 3 determina que
//     "clube sem id mapeado ... é registrado como inconsistência e o dado é
//     descartado" (CA-16.6) — exatamente o que ING-F-01 fará até alguém com
//     acesso ao token confirmar os ids reais e substituir a sentinela.
// Sinalização ao Coordenador: recomendo uma tarefa dedicada (ou nota em
// BLOCKERS.md, a critério do Coordenador) para confirmar os 19 ids restantes
// antes de ING-F-01 (Lote 5) entrar em execução real — spike ou passo manual
// com o token de produção, fora do alcance deste Executor.
