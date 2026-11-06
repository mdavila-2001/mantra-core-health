/* ============================================================================
    Step 8 of `ubicarRed`: the strokes of the trunks and the links, once every
    node, entry height and lane is known.
    ========================================================================== */

import { esInferido } from './red-clinica.model';
import type { Pendiente } from './red-clinica.aristas';
import { DISTANCIA_DEL_TRONCO, type AristaDeLaRed, type NodoDeLaRed, type Punto } from './red-clinica.geometria.types';

export interface CarrilesDeLosEnlaces {
  /** The entry height of each link into its target. */
  readonly yEntrada: ReadonlyMap<string, number>;
  /** The lane of each vertical stretch, keyed `${link}|sale` or `${link}|entra`. */
  readonly carrilDelTramo: ReadonlyMap<string, number>;
  readonly xDelCarril: (pasillo: number, carril: number) => number;
  readonly yDelCanal: (p: Pendiente) => number;
}

export function trazarAristas(
  pendientes: readonly Pendiente[],
  nodoPorId: ReadonlyMap<string, NodoDeLaRed>,
  { yEntrada, carrilDelTramo, xDelCarril, yDelCanal }: CarrilesDeLosEnlaces,
): AristaDeLaRed[] {
  const aristas: AristaDeLaRed[] = [];
  for (const p of pendientes) {
    const a = nodoPorId.get(p.desde)!;
    const b = nodoPorId.get(p.hasta)!;
    const inferido = esInferido(p.motivo);
    if (p.familia === 'tronco') {
      const puntos = puntosDelTronco(a, b);
      aristas.push({
        ...p,
        inferido,
        trazo: trazoDelTronco(a, b),
        puntos,
        ...(inferido ? { etiqueta: { x: a.x - DISTANCIA_DEL_TRONCO, y: (puntos[1][1] + puntos[2][1]) / 2, vertical: true } } : {}),
      });
      continue;
    }
    const y0 = a.y + a.alto / 2;
    const y1 = yEntrada.get(p.clave)!;
    const lx = xDelCarril(a.columna, carrilDelTramo.get(`${p.clave}|sale`) ?? 0);
    let puntos: Punto[];
    let etiqueta: AristaDeLaRed['etiqueta'];
    if (a.columna === b.columna) {
      puntos = [[a.x + a.ancho, y0], [lx, y0], [lx, y1], [b.x + b.ancho, y1]];
      etiqueta = { x: lx, y: (y0 + y1) / 2, vertical: true };
    } else if (b.columna === a.columna + 1) {
      puntos = [[a.x + a.ancho, y0], [lx, y0], [lx, y1], [b.x, y1]];
      etiqueta = { x: lx, y: (y0 + y1) / 2, vertical: true };
    } else {
      const yc = yDelCanal(p);
      const lt = xDelCarril(b.columna - 1, carrilDelTramo.get(`${p.clave}|entra`) ?? 0);
      puntos = [[a.x + a.ancho, y0], [lx, y0], [lx, yc], [lt, yc], [lt, y1], [b.x, y1]];
      etiqueta = { x: (lx + lt) / 2, y: yc, vertical: false };
    }
    aristas.push({ ...p, inferido, trazo: poligonal(puntos), puntos, ...(inferido ? { etiqueta } : {}) });
  }
  return aristas;
}

/** The trunk's vertices: from the encounter down the left aisle to the record. */
function puntosDelTronco(desde: NodoDeLaRed, hasta: NodoDeLaRed): Punto[] {
  const tronco = desde.x - DISTANCIA_DEL_TRONCO;
  const y0 = desde.y + desde.alto / 2;
  const y1 = hasta.y + hasta.alto / 2;
  return [[desde.x, y0], [tronco, y0], [tronco, y1], [hasta.x, y1]];
}

function trazoDelTronco(desde: NodoDeLaRed, hasta: NodoDeLaRed): string {
  const [[x0, y0], [tronco], , [x1, y1]] = puntosDelTronco(desde, hasta);
  const r = Math.min(10, Math.abs(y1 - y0) / 2);
  const sentido = y1 >= y0 ? 1 : -1;
  return [
    `M ${x0} ${y0}`,
    `H ${tronco + r}`,
    `Q ${tronco} ${y0} ${tronco} ${y0 + r * sentido}`,
    `V ${y1 - r * sentido}`,
    `Q ${tronco} ${y1} ${tronco + r} ${y1}`,
    `H ${x1}`,
  ].join(' ');
}

/** A polyline with rounded corners, so the eye can follow one line. */
export function poligonal(puntos: readonly Punto[], radio = 6): string {
  const partes = [`M ${puntos[0][0]} ${puntos[0][1]}`];
  for (let i = 1; i < puntos.length - 1; i++) {
    const [ax, ay] = puntos[i - 1];
    const [bx, by] = puntos[i];
    const [cx, cy] = puntos[i + 1];
    const r = Math.min(radio, Math.hypot(bx - ax, by - ay) / 2, Math.hypot(cx - bx, cy - by) / 2);
    const haciaA = Math.hypot(bx - ax, by - ay) || 1;
    const haciaC = Math.hypot(cx - bx, cy - by) || 1;
    const antes = [bx - ((bx - ax) / haciaA) * r, by - ((by - ay) / haciaA) * r];
    const despues = [bx + ((cx - bx) / haciaC) * r, by + ((cy - by) / haciaC) * r];
    partes.push(`L ${antes[0]} ${antes[1]}`, `Q ${bx} ${by} ${despues[0]} ${despues[1]}`);
  }
  const [ux, uy] = puntos[puntos.length - 1];
  partes.push(`L ${ux} ${uy}`);
  return partes.join(' ');
}
