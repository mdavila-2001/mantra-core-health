import { bboxIntersects, type BBox } from './geometry';

/**
 * Índice espacial de rejilla uniforme (CONTRATO-PLANO §5.9, técnica 2): para
 * montar solo los nodos visibles de un lienzo con cientos de espacios.
 *
 * Cada caja se anota en todas las celdas que toca; una consulta por ventana
 * devuelve los ids sin repetir. Es suficiente para 1 600 locales: construir es
 * O(n) y consultar es O(celdas de la ventana + resultados).
 */
export class GridIndex {
  private readonly cells = new Map<number, string[]>();
  private readonly boxes = new Map<string, BBox>();
  private readonly columns: number;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly cellSize: number,
  ) {
    if (!(cellSize > 0)) {
      throw new Error('GridIndex: el tamaño de celda debe ser positivo');
    }
    this.columns = Math.max(1, Math.ceil(width / cellSize));
  }

  get size(): number {
    return this.boxes.size;
  }

  insert(id: string, box: BBox): void {
    this.boxes.set(id, box);
    const [c0, r0, c1, r1] = this.cellRange(box);
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const key = r * this.columns + c;
        const bucket = this.cells.get(key);
        if (bucket === undefined) {
          this.cells.set(key, [id]);
        } else {
          bucket.push(id);
        }
      }
    }
  }

  boxOf(id: string): BBox | undefined {
    return this.boxes.get(id);
  }

  /** Ids cuya caja toca la ventana, sin repetir. */
  query(window: BBox): string[] {
    const [c0, r0, c1, r1] = this.cellRange(window);
    const seen = new Set<string>();
    const result: string[] = [];
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const bucket = this.cells.get(r * this.columns + c);
        if (bucket === undefined) continue;
        for (const id of bucket) {
          if (seen.has(id)) continue;
          seen.add(id);
          if (bboxIntersects(this.boxes.get(id)!, window)) result.push(id);
        }
      }
    }
    return result;
  }

  private cellRange(box: BBox): [number, number, number, number] {
    const maxColumn = Math.max(0, Math.ceil(this.width / this.cellSize) - 1);
    const maxRow = Math.max(0, Math.ceil(this.height / this.cellSize) - 1);
    const clamp = (value: number, max: number): number => Math.max(0, Math.min(max, value));
    return [
      clamp(Math.floor(box[0] / this.cellSize), maxColumn),
      clamp(Math.floor(box[1] / this.cellSize), maxRow),
      clamp(Math.floor(box[2] / this.cellSize), maxColumn),
      clamp(Math.floor(box[3] / this.cellSize), maxRow),
    ];
  }
}

/** Tamaño de celda razonable para un lienzo: unas 32 celdas por el lado mayor, mínimo 2 m. */
export function defaultCellSize(width: number, height: number): number {
  return Math.max(2, Math.max(width, height) / 32);
}
