/* ============================================================================
    Quién ejecuta una orden de procedimiento (centros médicos, CONTRATO §3).

    El médico elige uno de tres modos al pedir el estudio, y esa elección es
    **una recomendación, no un candado**: el paciente siempre puede hacérselo en
    otro lugar. Estos tipos los comparten quien pide la orden (CM-08), quien la
    ve en «Mis órdenes» (CM-10) y quien muestra los centros (CM-09).

    Los nombres de los campos son los del contrato, tal cual: la API los escribe
    y el front los lee sin renombrar.
    ========================================================================== */

/**
 * Los tres modos del conjunto `service-request-performer-selection`, por su
 * **código** (no por el texto, que cambia de idioma, ni por el uuid del concepto).
 *
 * - `SELF`: el médico se ofrece a hacer el procedimiento él mismo.
 * - `ORGANIZATION`: el médico sugiere un centro.
 * - `PATIENT_CHOICE`: el médico no sugiere nada y elige el paciente.
 */
export type PerformerSelectionCode = 'SELF' | 'ORGANIZATION' | 'PATIENT_CHOICE';

/** Los tres códigos, en el orden en que los presenta la pantalla de la orden. */
export const PERFORMER_SELECTION_CODES: readonly PerformerSelectionCode[] = [
  'SELF',
  'ORGANIZATION',
  'PATIENT_CHOICE',
];

/**
 * Lo que viaja en `POST /clinical/service-requests` (CONTRATO §3). Los tres
 * campos son opcionales: sin `performerSelectionConceptId` la API asume
 * `PATIENT_CHOICE`.
 *
 * `performerTenantId` **no** se llena con la recomendación: sugerir un centro
 * no le da acceso a la orden.
 */
export interface ServiceRequestPerformerInput {
  /** uuid del concepto del modo (`SELF`, `ORGANIZATION` o `PATIENT_CHOICE`). */
  readonly performerSelectionConceptId?: string;
  /** Obligatorio con `SELF` e igual al médico que pide; con otro modo, prohibido. */
  readonly performerPractitionerProfileId?: string;
  /** Obligatorio con `SELF` y `ORGANIZATION`; prohibido con `PATIENT_CHOICE`. */
  readonly suggestedPracticeSiteId?: string;
}

/**
 * Lo que vuelve en `GET /diagnostic-results/me/orders` (CONTRATO §3): los tres
 * campos de {@link ServiceRequestPerformerInput} y el nombre de la sede, para que
 * el paciente vea un nombre y nunca un uuid.
 */
export interface ServiceRequestPerformerFields extends ServiceRequestPerformerInput {
  /** Nombre de la sede sugerida; `null` si no hay sede o no se pudo resolver. */
  readonly suggestedPracticeSiteName?: string | null;
}

/**
 * El modo, a partir del **código** del concepto tal como lo devuelve terminología.
 *
 * Acepta las tres formas en que puede llegar (CONTRATO «Códigos de concepto»):
 * el simple (`SELF`), el del módulo (`SR_PERF_SELF`) y el prefijado
 * (`clinical:SR_PERF_SELF`). Un código que no es de los tres → `null`: nunca se
 * inventa un modo.
 */
export function performerSelectionCodeOf(code: string | undefined | null): PerformerSelectionCode | null {
  if (code === undefined || code === null) return null;
  const simple = code.replace(/^[A-Za-z0-9_-]+:/, '').replace(/^SR_PERF_/, '');
  return (PERFORMER_SELECTION_CODES as readonly string[]).includes(simple)
    ? (simple as PerformerSelectionCode)
    : null;
}
