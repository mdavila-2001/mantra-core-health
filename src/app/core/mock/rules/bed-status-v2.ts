import type {
  AvailabilityCode,
  HygieneCode,
  IsolationCode,
  OccupancyCode,
  V2Code,
} from '../../data-access/infrastructure-ops/infrastructure-ops.types';

/* ============================================================================
    Mapeo a HL7 v2-0116 / FHIR `Location.operationalStatus` (F2.2).

    Función pura, **primera regla que aplica**. Es la misma tabla que la API
    (`practice/domain/ops/bed-status-v2.ts`); la usa **sólo** el simulador (M6).
    La pantalla nunca recalcula la letra de una celda: la lee, y la leyenda
    sale de `data-access/infrastructure-ops/ops-labels.ts`.
    ========================================================================== */

export interface BedAxes {
  readonly lifecycleCode: string;
  readonly availabilityCode: AvailabilityCode;
  readonly hygieneCode: HygieneCode;
  readonly isolationCode: IsolationCode;
  readonly occupancyCode: OccupancyCode;
  readonly terminalCleaningRequired: boolean;
  /** `infra.inspection_required` del establecimiento. */
  readonly inspectionRequired: boolean;
  /** Vigencia (`valid_from ≤ hoy < valid_to`). */
  readonly inForce?: boolean;
}

export function bedStatusV2(axes: BedAxes): V2Code {
  if (axes.availabilityCode !== 'SPACE_OP_AVAILABLE' || axes.lifecycleCode !== 'SPACE_ACTIVE') return 'C';
  if (axes.hygieneCode === 'HYG_CONTAMINATED') return 'K';
  if (axes.isolationCode !== 'ISO_NONE') return 'I';
  if (axes.occupancyCode === 'OCC_OCCUPIED') return 'O';
  if (axes.occupancyCode === 'OCC_RESERVED') return 'R';
  if (
    axes.hygieneCode === 'HYG_DIRTY' ||
    axes.hygieneCode === 'HYG_CLEANING' ||
    (axes.hygieneCode === 'HYG_CLEAN' && axes.inspectionRequired) ||
    axes.terminalCleaningRequired
  ) {
    return 'H';
  }
  return 'U';
}

/**
 * **Asignable** (lo consume F3): ciclo activo ∧ vigente ∧ disponible ∧ libre ∧
 * higiene inspeccionada (o limpia si no se exige inspección) ∧ sin limpieza
 * terminal pendiente.
 */
export function isAssignable(axes: BedAxes): boolean {
  const hygieneOk =
    axes.hygieneCode === 'HYG_INSPECTED' || (axes.hygieneCode === 'HYG_CLEAN' && !axes.inspectionRequired);
  return (
    axes.lifecycleCode === 'SPACE_ACTIVE' &&
    axes.inForce !== false &&
    axes.availabilityCode === 'SPACE_OP_AVAILABLE' &&
    axes.occupancyCode === 'OCC_FREE' &&
    hygieneOk &&
    !axes.terminalCleaningRequired
  );
}
