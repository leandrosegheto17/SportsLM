// app/design-system/componentes/index.ts — UI-DS-07B (TASK.md Lote 7)
//
// Barrel dos componentes de base de exibição de dados (UX-SPEC §3.8):
// `EtiquetaEsporte`, `SeloFonte`, `BannerAlerta`, `EstadoVazio`, `Esqueleto`,
// `AvatarClube`, `CarimboFrescor`, `TabelaClassificacao`, `LinhaPartida`.
// Os componentes interativos (UI-DS-07A) e os seis específicos da direção
// visual (`FaixaClube`, `BlocoPreto` etc., UI-DS-01 a UI-DS-06) ficam em
// barris próprios, quando implementados.

export { EtiquetaEsporte } from './EtiquetaEsporte/EtiquetaEsporte';
export { SeloFonte, type EstadoSeloFonte } from './SeloFonte/SeloFonte';
export { BannerAlerta, type VarianteBannerAlerta } from './BannerAlerta/BannerAlerta';
export { EstadoVazio } from './EstadoVazio/EstadoVazio';
export { Esqueleto, type VarianteEsqueleto } from './Esqueleto/Esqueleto';
export { AvatarClube, type TamanhoAvatarClube } from './AvatarClube/AvatarClube';
export {
  CarimboFrescor,
  type EstadoCarimboFrescor,
} from './CarimboFrescor/CarimboFrescor';
export {
  TabelaClassificacao,
  type LinhaTabelaClassificacao,
  type VarianteTabelaClassificacao,
  type TokenDeZonaTabela,
  type ZonaDaLinha,
} from './TabelaClassificacao/TabelaClassificacao';
export { LinhaPartida, type PropriedadesLinhaPartida } from './LinhaPartida/LinhaPartida';
