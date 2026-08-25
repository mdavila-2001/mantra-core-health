/**
 * El comprobante interno de pago de un pedido de farmacia (carril FAR-I5),
 * con la misma regla que los documentos clínicos de `clinical-pdf`: **todo
 * texto ya resuelto, cero uuid**. Quien arma un `DocumentoDeComprobante`
 * resuelve nombres, fechas y medios de pago ANTES; este módulo sólo dice
 * cómo se imprime.
 *
 * Es un comprobante INTERNO a propósito: ni «factura» ni número fiscal — la
 * factura real es de billing y de la pasarela futura (FAR-E4).
 */

/** Un renglón cobrado, ya en palabras. */
export interface LineaDeComprobante {
  /** «Amoxicilina 500 mg · caja x 20» — nombre y presentación juntos. */
  readonly descripcion: string;
  readonly cantidad: number;
  /** El importe del renglón como texto exacto, o `null` sin precio publicado. */
  readonly importe: string | null;
}

/** El comprobante, tal como la pantalla y el PDF lo dicen. */
export interface DocumentoDeComprobante {
  /** Id del pedido: sólo para el sufijo del nombre de archivo, jamás se imprime. */
  readonly id: string;
  readonly farmacia: string;
  readonly sede: string;
  readonly paciente: string | null;
  readonly pagadoEl: Date;
  /** «Pagado en mostrador» o «Pago demo — sin valor real», ya resuelto. */
  readonly medioDePago: string;
  readonly lineas: readonly LineaDeComprobante[];
  /** Total como texto exacto, o `null` si falta algún precio publicado. */
  readonly total: string | null;
  readonly moneda: string | null;
}
