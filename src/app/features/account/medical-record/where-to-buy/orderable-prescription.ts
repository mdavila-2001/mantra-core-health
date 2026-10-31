/**
 * Qué de la receta elegida se puede pedir hoy (FAR-03): la misma regla de
 * «vigente» que aplica la API al crear el pedido, para que «Dónde comprar» no
 * arme un pedido que la API va a rechazar. Funciones puras, sin estado.
 */

import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';

/**
 * El estado de un ítem de receta, tal como lo distingue la API
 * (`clinical.concepts.ts`, `MEDICATION_REQUEST_*`).
 */
export type PrescriptionState =
  'draft' | 'issued' | 'invalidated' | 'replaced' | 'renewed' | 'active' | 'completed';

/**
 * El prefijo de los estados de un ítem de receta **en el catálogo persistido
 * de la API**: `<módulo>:<clave>`, como el resto de los conceptos de módulo.
 * El `code` que declara `clinical.concepts.ts` (`clinical:MEDICATION_REQUEST_ISSUED`) es el literal del
 * código fuente; lo que llega por `GET /terminology/concepts` es el de acá.
 */
const STATUS_CODE_PREFIX = 'clinical:MEDICATION_REQUEST_';

/**
 * El código del estado «emitida». Es el único estado que se puede pedir:
 * borrador, invalidada, reemplazada y completada no.
 */
export const ISSUED_STATUS_CODE = `${STATUS_CODE_PREFIX}ISSUED`;

const STATE_BY_KEY = new Map<string, PrescriptionState>([
  ['DRAFT', 'draft'],
  ['ISSUED', 'issued'],
  ['INVALIDATED', 'invalidated'],
  ['REPLACED', 'replaced'],
  ['RENEWED', 'renewed'],
  ['ACTIVE', 'active'],
  ['COMPLETED', 'completed'],
]);

/** El estado que dice el código de un concepto, o `undefined` si no es uno de la receta. */
export function prescriptionStateOf(code: string): PrescriptionState | undefined {
  return code.startsWith(STATUS_CODE_PREFIX)
    ? STATE_BY_KEY.get(code.slice(STATUS_CODE_PREFIX.length))
    : undefined;
}

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
  return isIssuedRow(row, labels) && !isExpiredRow(row, now);
}

function isIssuedRow(row: MedicationRequest, labels: ConceptLabels): boolean {
  const statusCode = labels.get(row.statusConceptId)?.code;
  return statusCode === undefined
    ? row.issuedAt instanceof Date
    : prescriptionStateOf(statusCode) === 'issued';
}

function isExpiredRow(row: MedicationRequest, now: Date): boolean {
  return row.validTo !== undefined && row.validTo.getTime() <= now.getTime();
}

/**
 * Cómo se nombra el estado de una receta entera en «Mis recetas»: `orderable`
 * si alguna de sus filas se puede pedir hoy; si no, por qué no.
 */
export type PrescriptionStanding =
  'orderable' | 'expired' | 'draft' | 'invalidated' | 'replaced' | 'completed' | 'unknown';

/**
 * El estado de una receta (sus filas de una misma consulta) para el paciente.
 *
 * Basta una fila pedible para que la receta se pueda pedir: «Dónde comprar»
 * deja afuera las demás (`orderablePrescriptionOf`). Si ninguna lo es, manda
 * el estado de la fila más avanzada: una emitida que venció dice «vencida»,
 * aunque la acompañe un borrador de renovación.
 */
export function prescriptionStandingOf(
  rows: readonly MedicationRequest[],
  labels: ConceptLabels,
  now: Date,
): PrescriptionStanding {
  if (rows.some((row) => isOrderableRow(row, labels, now))) {
    return 'orderable';
  }
  if (rows.some((row) => isIssuedRow(row, labels))) {
    return 'expired';
  }
  const states = new Set(
    rows.map((row) => {
      const code = labels.get(row.statusConceptId)?.code;
      // Sin catálogo, una fila sin `issuedAt` sólo puede ser un borrador.
      return code === undefined ? 'draft' : prescriptionStateOf(code);
    }),
  );
  for (const standing of ['completed', 'replaced', 'invalidated', 'draft'] as const) {
    if (states.has(standing)) {
      return standing;
    }
  }
  return 'unknown';
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
  const requestId = orderable.find((row) => row.id === chosenId)?.id ?? orderable[0]?.id ?? null;
  return { rows: orderable, requestId };
}
