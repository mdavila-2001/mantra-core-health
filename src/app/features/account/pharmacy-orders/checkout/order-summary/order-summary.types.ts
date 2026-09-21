/**
 * **El resumen del checkout**, ya calculado: lo que `OrderSummary` pinta.
 *
 * Presentacional a propósito para que otra pantalla lo reutilice con sus
 * propios renglones. Los importes son texto exacto —los que la farmacia
 * publica—, o `null` cuando falta un precio y la cifra no se puede afirmar.
 *
 * **Sólo lleva lo que el contrato real produce hoy** (R-T-E3): renglones y
 * total. Descuento de red, coaseguro, envío y puntos **no** están: no existen
 * antes de que el pedido se cree —el coaseguro sólo aparece tras la
 * adjudicación del seguro, sobre el pedido ya creado— y un porcentaje
 * inventado se lee como si fuera dinero real.
 */

/** Un renglón del resumen, en palabras. */
export interface RenglonDelResumen {
  readonly indice: number;
  readonly medicamento: string;
  readonly presentacion: string | null;
  readonly cantidad: number;
  /** Precio unitario publicado por la farmacia, o `null`. */
  readonly precioUnitario: string | null;
  /** `null` si falta el precio o la farmacia no lo tiene. */
  readonly subtotal: string | null;
  readonly disponible: boolean;
}

export interface ResumenDelPedido {
  readonly moneda: string | null;
  readonly renglones: readonly RenglonDelResumen[];
  /** Suma de los renglones con precio publicado, o `null` si falta alguno. */
  readonly total: string | null;
}
