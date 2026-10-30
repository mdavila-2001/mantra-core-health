/* ============================================================================
    Contrato de `GET /patient-spending/me`: lo que el paciente autenticado gastó
    en su salud, movimiento por movimiento, dentro de un rango de fechas.

    Lo sirve la API (P44, `PatientSpendingController` del módulo `billing`):
    un movimiento por factura emitida al paciente. El simulador sirve la misma
    forma. El titular sale del token, así que la ruta no lleva datos de la
    persona; el rango viaja como `from`/`to` (`YYYY-MM-DD`, ambos inclusive,
    a lo sumo tres años; fuera de eso, 400).

    Se piden los **movimientos** y no los totales ya sumados: la pantalla
    compara el mes contra el anterior, el año contra el pasado y cada categoría
    contra sí misma, y cada comparación es otra suma sobre la misma lista. Un
    endpoint de totales obligaría a pedir una variante por cada tarjeta.
    ========================================================================== */

/** Un concepto ya resuelto a su forma legible (mismo molde que el resto de la API). */
export interface SpendingConceptDto {
  readonly code: string;
  readonly display: string;
}

/**
 * Un gasto de salud del paciente. Los importes son texto decimal exacto, en la
 * moneda de la respuesta; `paidAmount` es siempre
 * `grossAmount − coveredAmount − discountAmount`, lo que salió del bolsillo.
 * Una nota de crédito llega con importes negativos: devuelve parte de un gasto.
 */
export interface SpendingMovementDto {
  readonly id: string;
  /** Instante ISO 8601 del cobro. */
  readonly occurredAt: string;
  readonly description: string;
  /**
   * `SPEND_CONSULTATION`, `SPEND_PHARMACY`, `SPEND_LABORATORY`,
   * `SPEND_IMAGING`, `SPEND_PROCEDURE`, `SPEND_INSURANCE_PREMIUM` o
   * `SPEND_OTHER` (lo que la API no puede atribuir a ninguna de las otras).
   */
  readonly category: SpendingConceptDto;
  /** Quién cobró: la clínica, la farmacia, el laboratorio o la aseguradora. */
  readonly providerName: string | null;
  /** Lo que costó la atención o el producto, antes de cobertura y descuentos. */
  readonly grossAmount: string;
  /** La parte que pagó el seguro. */
  readonly coveredAmount: string;
  /** La parte que descontó una promoción o un cupón. */
  readonly discountAmount: string;
  /** Lo que pagó el paciente. */
  readonly paidAmount: string;
}

export interface PatientSpendingResponseDto {
  /** Código de la moneda de todos los importes (`BOB`). */
  readonly currency: string;
  readonly from: string;
  readonly to: string;
  /** Del más reciente al más antiguo. */
  readonly items: readonly SpendingMovementDto[];
  /**
   * `true` si la API recortó la lista por su tope (1 000 movimientos): las
   * sumas sobre `items` no son el total del rango. Opcional para tolerar una
   * respuesta que no lo traiga.
   */
  readonly truncated?: boolean;
}
