/**
 * Qué de la receta elegida se puede pedir hoy (FAR-03): la misma regla de
 * «vigente» que aplica la API al crear el pedido, para que «Dónde comprar» no
 * arme un pedido que la API va a rechazar. Funciones puras, sin estado.
 */

import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';

/**
 * El código del estado «emitida» de un ítem de receta en el catálogo de la API
 * (`clinical.concepts.ts`, `MEDICATION_REQUEST_ISSUED`). Es el único estado que
 * se puede pedir: borrador, invalidada, reemplazada y completada no.
 */
export const ISSUED_STATUS_CODE = 'MR_ISSUED';

/**
 * Si la fila se puede pedir hoy, con la misma regla que aplica la API al crear
 * el pedido (FAR-03): emitida y con `validTo` todavía por delante.
 *
 * El estado se lee del código de su concepto. Si el catálogo no lo resolvió
 * (las etiquetas fallaron), queda lo único que el resumen dice por sí solo:
 * que tenga `issuedAt`. Eso separa los borradores, pero no una emitida que
 * después se anuló — la API sigue siendo la que decide y lo dice con su 422.
 */
export function isOrderableRow(row: MedicationRequest, labels: ConceptLabels, now: Date): boolean {
  const statusCode = labels.get(row.statusConceptId)?.code;
  const issued =
    statusCode === undefined ? row.issuedAt instanceof Date : statusCode === ISSUED_STATUS_CODE;
  return issued && (row.validTo === undefined || row.validTo.getTime() > now.getTime());
}

/** Las filas que se pueden pedir de una receta, y el id con que viaja el pedido. */
export interface OrderablePrescription {
  readonly rows: readonly MedicationRequest[];
  /** La elegida si se puede pedir; si no, otra de la receta que sí; `null` si ninguna. */
  readonly requestId: string | null;
}

/**
 * Lo que de la receta elegida se puede pedir hoy (FAR-03 · D-3).
 *
 * El resumen trae las filas en cualquier estado: un borrador de renovación, un
 * ítem anulado o uno vencido del mismo encuentro harían que la API rechace el
 * pedido entero (`PRESCRIPTION_NOT_ACTIVE` si es la fila referida,
 * `PRODUCT_NOT_PRESCRIBED` si es un hermano). Por eso salen de la lista, y el
 * pedido viaja con el id de una fila que la API va a aceptar.
 *
 * @param rows - Las filas de la receta elegida (ver `rowsOfPrescription` en `pharmacy-branches.ts`).
 * @param chosenId - El id con que se abrió la pantalla.
 * @param labels - Las etiquetas del catálogo, que traen el código del estado.
 * @param now - El instante contra el que se mide el vencimiento.
 */
export function orderablePrescriptionOf(
  rows: readonly MedicationRequest[],
  chosenId: string,
  labels: ConceptLabels,
  now: Date,
): OrderablePrescription {
  const orderable = rows.filter((row) => isOrderableRow(row, labels, now));
  const requestId =
    orderable.find((row) => row.id === chosenId)?.id ?? orderable[0]?.id ?? null;
  return { rows: orderable, requestId };
}
