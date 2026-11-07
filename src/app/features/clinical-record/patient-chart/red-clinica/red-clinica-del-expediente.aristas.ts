/* ============================================================================
    From the network's links (strip 2) to the panel's edges (strip 3): same
    link, sometimes with the arrow the other way.
    ========================================================================== */

import type { MotivoDelVinculo, VinculoDeLaRed } from '../recorrido-clinico/red-clinica.model';
import type { AristaDeRed, TipoDeVinculo } from './red-clinica-vinculos.types';

interface Traduccion {
  readonly tipo: TipoDeVinculo;
  /** The network stores the link the other way round from strip 3's table. */
  readonly invertir: boolean;
  readonly inferido?: true;
}

/**
 * Each network reason, as a panel link. The network draws «encounter →
 * record» and «diagnosis → prescription»; the panel reads «the record was
 * entered in the encounter» and «the prescription is indicated for the
 * diagnosis»: same link, the arrow reversed.
 */
export const VINCULO_DEL_MOTIVO: Readonly<Record<MotivoDelVinculo, Traduccion>> = {
  'registrado-en': { tipo: 'registrado-en', invertir: true },
  'indicado-para': { tipo: 'indicado-para', invertir: true },
  'pedido-para': { tipo: 'pedido-para', invertir: true },
  'resultado-de': { tipo: 'resultado-de', invertir: true },
  'reemplazado-por': { tipo: 'reemplazado-por', invertir: false },
  'receta-reemplazada': { tipo: 'reemplaza-receta', invertir: false },
  evidencia: { tipo: 'evidencia-de', invertir: false },
  'plan-para': { tipo: 'plan-para', invertir: true },
  'derivado-desde': { tipo: 'derivada-desde', invertir: true },
  'recibido-en': { tipo: 'recibida-en', invertir: false },
  'reconsulta-de': { tipo: 'reconsulta-de', invertir: true },
  'durante-internacion': { tipo: 'durante-internacion', invertir: true },
  'inferido-misma-atencion': { tipo: 'pedido-para', invertir: true, inferido: true },
  'inferido-mismo-dia': { tipo: 'atendida-en', invertir: false, inferido: true },
};

/** The panel's edges, from the network's links. A repeated link comes out once. */
export function aristasDeLaRed(vinculos: readonly VinculoDeLaRed[]): readonly AristaDeRed[] {
  const vistas = new Set<string>();
  const aristas: AristaDeRed[] = [];
  for (const v of vinculos) {
    const t = VINCULO_DEL_MOTIVO[v.motivo];
    const [desde, hasta] = t.invertir ? [v.hasta, v.desde] : [v.desde, v.hasta];
    const clave = `${t.tipo}:${desde}>${hasta}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    aristas.push(t.inferido ? { desde, hasta, tipo: t.tipo, inferido: true } : { desde, hasta, tipo: t.tipo });
  }
  return aristas;
}
