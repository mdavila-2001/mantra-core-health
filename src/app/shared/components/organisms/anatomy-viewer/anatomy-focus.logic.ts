/**
 * Geometría pura del encuadre del visor: cajas alineadas a los ejes, sin
 * three.js, para probarla sin WebGL. Unidades: metros.
 */

/** `[minx, miny, minz, maxx, maxy, maxz]`. */
export type FocusBox = readonly [number, number, number, number, number, number];

/** Lado mínimo de una unión: una pieza diminuta no debe llenar la pantalla. */
export const MIN_UNION_M = 0.08;
/** Lado mínimo de una intersección: rodilla, tobillo y esternoclavicular son láminas finas. */
export const MIN_INTERSECTION_M = 0.12;

/**
 * Qué encuadrar. `groups` son ids de malla: con `union` se encuadra todo junto;
 * con `intersection` se encuadra donde se cruzan las cajas de los grupos (una
 * articulación: donde se tocan el fémur y la tibia).
 */
export interface AnatomyFocus {
  readonly mode: 'union' | 'intersection';
  readonly groups: readonly (readonly string[])[];
  /** Lado mínimo de la caja, en metros. Por omisión según el modo. */
  readonly minSize?: number;
}

/** Un toque: la malla y el punto 3D del modelo donde cayó el rayo. */
export interface AnatomyPick {
  readonly meshId: string;
  readonly point: readonly [number, number, number];
}

export function unionOf(boxes: readonly FocusBox[]): FocusBox | null {
  if (boxes.length === 0) return null;
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.min(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
    Math.max(...boxes.map((b) => b[4])),
    Math.max(...boxes.map((b) => b[5])),
  ];
}

/** Donde se cruzan dos cajas, o `null` si no se tocan. */
export function intersectionOf(a: FocusBox, b: FocusBox): FocusBox | null {
  const caja: FocusBox = [
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.min(a[3], b[3]),
    Math.min(a[4], b[4]),
    Math.min(a[5], b[5]),
  ];
  return caja[0] < caja[3] && caja[1] < caja[4] && caja[2] < caja[5] ? caja : null;
}

/** Agranda la caja alrededor de su centro hasta que ningún lado mida menos de `min`. */
export function withMinSize(box: FocusBox, min: number): FocusBox {
  const out = [...box] as [number, number, number, number, number, number];
  for (let k = 0; k < 3; k++) {
    const lado = box[k + 3] - box[k];
    if (lado < min) {
      const centro = (box[k] + box[k + 3]) / 2;
      out[k] = centro - min / 2;
      out[k + 3] = centro + min / 2;
    }
  }
  return out;
}

/**
 * La caja a encuadrar. `boxesByGroup` trae, por grupo, las cajas de las mallas
 * que están cargadas. Si la intersección queda vacía —o falta un grupo— se
 * encuadra la unión de todo, que es lo menos sorprendente. `null` si no hay nada.
 */
export function focusBox(focus: AnatomyFocus, boxesByGroup: readonly (readonly FocusBox[])[]): FocusBox | null {
  const delGrupo = boxesByGroup.map(unionOf).filter((b): b is FocusBox => b !== null);
  if (delGrupo.length === 0) return null;
  const min = focus.minSize ?? (focus.mode === 'intersection' ? MIN_INTERSECTION_M : MIN_UNION_M);
  let caja: FocusBox | null = null;
  if (focus.mode === 'intersection' && delGrupo.length === boxesByGroup.length) {
    caja = delGrupo.slice(1).reduce<FocusBox | null>((acc, b) => (acc === null ? null : intersectionOf(acc, b)), delGrupo[0]);
  }
  return withMinSize(caja ?? (unionOf(delGrupo) as FocusBox), min);
}

/** Si el punto cae dentro de la caja. */
export function boxContains(box: FocusBox, p: readonly [number, number, number]): boolean {
  return p[0] >= box[0] && p[0] <= box[3] && p[1] >= box[1] && p[1] <= box[4] && p[2] >= box[2] && p[2] <= box[5];
}
