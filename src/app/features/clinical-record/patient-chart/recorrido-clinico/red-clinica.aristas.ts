/* ============================================================================
    Step 3 of `ubicarRed`: the edges, before placing anything, because they
    decide how much room is needed; and the lanes of each thread's channel.
    ========================================================================== */

import { esInferido, type MotivoDelVinculo, type VinculoDeLaRed } from './red-clinica.model';
import type { CeldasDeLaRed } from './red-clinica.celdas';

export interface Pendiente {
  readonly clave: string;
  readonly desde: string;
  readonly hasta: string;
  readonly motivo: MotivoDelVinculo;
  readonly familia: 'tronco' | 'enlace';
}

export interface AristasPendientes {
  readonly pendientes: readonly Pendiente[];
  readonly enlaces: readonly Pendiente[];
  /** Lane of each link inside its target thread's channel. */
  readonly carrilDeCanal: ReadonlyMap<string, number>;
  /** How many lanes each thread's channel needs. */
  readonly carrilesDeCanal: ReadonlyMap<string, number>;
}

export function aristasPendientes(
  vinculos: readonly VinculoDeLaRed[],
  { representante, ubicable, hilosVisibles }: CeldasDeLaRed,
): AristasPendientes {
  const pendientes: Pendiente[] = [];
  const vistas = new Set<string>();
  for (const v of vinculos) {
    const desde = representante.get(v.desde) ?? v.desde;
    const hasta = representante.get(v.hasta) ?? v.hasta;
    const a = ubicable.get(desde);
    const b = ubicable.get(hasta);
    if (a === undefined || b === undefined || desde === hasta) continue;
    const clave = `${v.motivo}:${desde}>${hasta}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const atencionA = a.registro?.clase === 'atencion';
    const atencionB = b.registro?.clase === 'atencion';
    // An inferred link never runs along the trunk: there it would be hidden by
    // the real ones of the same encounter and its dotted stroke would not show.
    const tronco =
      a.columna === b.columna && (atencionA || atencionB) && !(atencionA && atencionB) && !esInferido(v.motivo);
    if (tronco) {
      // The trunk always starts at the encounter.
      pendientes.push(atencionA ? { clave, desde, hasta, motivo: v.motivo, familia: 'tronco' } : { clave, desde: hasta, hasta: desde, motivo: v.motivo, familia: 'tronco' });
    } else {
      pendientes.push({ clave, desde, hasta, motivo: v.motivo, familia: 'enlace' });
    }
  }
  const enlaces = pendientes.filter((p) => p.familia === 'enlace');
  const usaCanal = (p: Pendiente): boolean => {
    const ca = ubicable.get(p.desde)!.columna;
    const cb = ubicable.get(p.hasta)!.columna;
    return ca !== cb && cb !== ca + 1;
  };
  // Lanes of each thread's channel, by aisle interval (not by x: the x is
  // not known yet, and the order of the aisles is the same).
  const carrilDeCanal = new Map<string, number>();
  const carrilesDeCanal = new Map<string, number>();
  for (const e of hilosVisibles) {
    const delCanal = enlaces
      .filter((p) => usaCanal(p) && ubicable.get(p.hasta)!.episodio === e.id)
      .map((p) => {
        const ks = ubicable.get(p.desde)!.columna;
        const kt = ubicable.get(p.hasta)!.columna - 1;
        return { p, a: Math.min(ks, kt), b: Math.max(ks, kt) };
      })
      .sort((x, y) => x.a - y.a || x.b - y.b || x.p.clave.localeCompare(y.p.clave));
    const ocupados: { a: number; b: number }[][] = [];
    for (const tramo of delCanal) {
      let carril = ocupados.findIndex((enUso) => enUso.every((o) => tramo.b < o.a || tramo.a > o.b));
      if (carril === -1) {
        carril = ocupados.length;
        ocupados.push([]);
      }
      ocupados[carril].push(tramo);
      carrilDeCanal.set(tramo.p.clave, carril);
    }
    carrilesDeCanal.set(e.id, ocupados.length);
  }
  return { pendientes, enlaces, carrilDeCanal, carrilesDeCanal };
}
