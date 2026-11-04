import type {
  AvailabilityCode,
  HygieneCode,
  IsolationCode,
  OccupancyCode,
  V2Code,
} from './infrastructure-ops.types';

/* ============================================================================
    Mapeo a HL7 v2-0116 / FHIR `Location.operationalStatus` (F2.2).

    Función pura, **primera regla que aplica**. Es la misma tabla que la API
    (`practice/domain/bed-status-v2.ts`); acá la usa el simulador para que la
    maqueta se comporte como el contrato y la pantalla para decir qué significa
    cada letra. La pantalla **nunca** recalcula la letra de una celda: la lee.
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

/** La tabla de F2.2, en el orden en que se evalúa. */
export const V2_RULES: readonly { readonly code: V2Code; readonly rule: string }[] = [
  { code: 'C', rule: 'Bloqueada, en mantenimiento, cerrada o con ciclo de vida distinto de activo' },
  { code: 'K', rule: 'Exige limpieza terminal antes de volver a usarse' },
  { code: 'I', rule: 'Con precaución de aislamiento' },
  { code: 'O', rule: 'Con paciente' },
  { code: 'R', rule: 'Guardada para un ingreso (extensión local urn:mantra:bed-status)' },
  { code: 'H', rule: 'Sucia, limpiando o limpia sin inspeccionar' },
  { code: 'U', rule: 'Libre, limpia e inspeccionada: se puede asignar' },
];

/** El texto de cada letra: el badge lo dice con palabras, nunca sólo con color. */
export const V2_LABEL: Readonly<Record<V2Code, string>> = {
  C: 'No disponible',
  K: 'Contaminada',
  I: 'Aislamiento',
  O: 'Ocupada',
  R: 'Reservada',
  H: 'Limpieza pendiente',
  U: 'Libre',
};

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
