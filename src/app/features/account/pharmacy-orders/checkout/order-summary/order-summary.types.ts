/**
 * **El resumen del checkout**, ya calculado: lo que `OrderSummary` pinta.
 *
 * Presentacional a propósito para que el supermercado (T-E5) lo reutilice con
 * sus propios renglones. Todos los importes son texto exacto, o `null` cuando
 * falta algún precio y la cifra no se puede afirmar.
 */

/** Un renglón del resumen, en palabras. */
export interface RenglonDelResumen {
  readonly indice: number;
  readonly medicamento: string;
  readonly presentacion: string | null;
  readonly cantidad: number;
  /** `null` si falta el precio o la farmacia no lo tiene. */
  readonly subtotal: string | null;
  /** Se eligió una alternativa de demostración en la orden médica. */
  readonly esAlternativa: boolean;
  readonly disponible: boolean;
}

export interface ResumenDelPedido {
  readonly moneda: string | null;
  /** Variante con seguro (demostración): separa aprobados de no aprobados. */
  readonly conSeguro: boolean;
  /** Sólo con seguro. */
  readonly aprobados: readonly RenglonDelResumen[];
  /** Sin seguro, todos los renglones. */
  readonly noAprobados: readonly RenglonDelResumen[];
  readonly subtotal: string | null;
  readonly descuentoDeRed: string | null;
  /** Sólo con seguro y algún renglón aprobado. */
  readonly coaseguro: string | null;
  /** Sólo con seguro: lo aprobado menos el coaseguro. */
  readonly cubreElSeguro: string | null;
  /** Sólo con delivery. */
  readonly envio: string | null;
  readonly total: string | null;
  /** Valor de ejemplo, o `null` sin total. */
  readonly puntos: number | null;
}
