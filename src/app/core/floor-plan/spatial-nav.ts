import type { BBox } from './geometry';

/** Un candidato a recibir el foco con las flechas. */
export interface NavItem {
  readonly id: string;
  readonly bbox: BBox;
}

export type NavDirection = 'left' | 'right' | 'up' | 'down';

function centerOf(box: BBox): [number, number] {
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

/**
 * Vecino espacial más cercano en una dirección (CONTRATO-PLANO §5.6, «teclado
 * completo»): por centros de caja. Solo cuentan los candidatos cuyo centro está
 * estrictamente más allá en esa dirección; entre ellos gana el de menor
 * `avance + 2 × desvío lateral`, que prefiere al que está alineado sobre uno
 * apenas más cerca pero en diagonal. Devuelve `null` si no hay ninguno (el foco
 * se queda donde está: las flechas nunca dan la vuelta al borde).
 */
export function nextInDirection(
  currentId: string,
  direction: NavDirection,
  items: readonly NavItem[],
): string | null {
  const current = items.find((item) => item.id === currentId);
  if (current === undefined) return null;
  const [cx, cy] = centerOf(current.bbox);
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'right' || direction === 'down' ? 1 : -1;

  let best: { id: string; score: number } | null = null;
  for (const item of items) {
    if (item.id === currentId) continue;
    const [x, y] = centerOf(item.bbox);
    const advance = (horizontal ? x - cx : y - cy) * sign;
    if (advance <= 1e-6) continue;
    const lateral = Math.abs(horizontal ? y - cy : x - cx);
    const score = advance + 2 * lateral;
    if (best === null || score < best.score - 1e-9 || (Math.abs(score - best.score) <= 1e-9 && item.id < best.id)) {
      best = { id: item.id, score };
    }
  }
  return best?.id ?? null;
}

/**
 * Orden de lectura: de arriba abajo y, dentro de una misma franja, de izquierda
 * a derecha. `bandM` es la altura de franja (por defecto 1 m) que absorbe las
 * diferencias de unos centímetros entre locales de una misma fila.
 */
export function readingOrder(items: readonly NavItem[], bandM = 1): string[] {
  return [...items]
    .map((item) => {
      const [x, y] = centerOf(item.bbox);
      return { id: item.id, band: Math.round(y / bandM), x };
    })
    .sort((a, b) => a.band - b.band || a.x - b.x || (a.id < b.id ? -1 : 1))
    .map((item) => item.id);
}
