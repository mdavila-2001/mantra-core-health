import { REVIEW_STATUSES } from '../../../../../core/data-access/admin-portal/data-catalog.types';
import type {
  PiiColumn,
  PiiColumnsQuery,
  PiiDiscrepancy,
  PiiReconciliationKind,
  PiiReconciliationQuery,
  PiiReconciliationSummary,
  PiiSummary,
} from '../../../../../core/data-access/admin-portal/governance-policies.types';
import {
  PII_MIN_SENSITIVITIES,
  PII_RECONCILIATION_KINDS,
} from '../../../../../core/data-access/admin-portal/governance-policies.types';
import { sensitivityLabel, type Rotulo } from '../../../platform/platform-labels';
import { nonEmpty } from '../../support/route-query';

/* ============================================================================
    Datos personales: rótulos y consultas.

    El nivel lo clasifica el escaneo del catálogo de datos; la marca de datos
    personales o de salud, el registro de gobierno. Esta capa no vuelve a
    clasificar nada: traduce los códigos de `GET /admin/catalog/pii/*`.
    ========================================================================== */

export const PII_URL_KEYS = ['q', 'schema', 'minSensitivity', 'reviewStatus', 'kind'] as const;
export type PiiUrlValues = Readonly<Record<(typeof PII_URL_KEYS)[number], string>>;

const LEVEL_TONES: Readonly<Record<string, Rotulo['tone']>> = {
  PSEUDONYMIZED: 'info',
  PERSONAL: 'warning',
  PHI_IDENTIFIER: 'error',
  PHI_SENSITIVE: 'error',
  PHI_SPECIAL: 'error',
  CREDENTIAL: 'error',
};

export const piiLevel = (code: string | null | undefined): Rotulo =>
  code
    ? { label: sensitivityLabel(code), tone: LEVEL_TONES[code] ?? 'secondary' }
    : { label: 'Sin clasificar', tone: 'secondary' };

export const PII_LEVEL_OPTIONS = PII_MIN_SENSITIVITIES.map((value) => ({
  value,
  label: piiLevel(value).label,
}));

/** Las tres discrepancias entre el catálogo y el registro declarado, con lo que significan. */
export const RECONCILIATION_INFO: Readonly<
  Record<PiiReconciliationKind, { label: string; hint: string }>
> = {
  MISSING_IN_REGISTRY: {
    label: 'Personal sin declarar',
    hint: 'La ficha aprobada la marca como dato personal y el registro de gobierno no la declara',
  },
  REGISTRY_DISAGREES: {
    label: 'Declarada sin marca',
    hint: 'El registro la declara, pero sin marca de datos personales ni de salud',
  },
  ORPHAN_IN_REGISTRY: {
    label: 'Declarada y no observada',
    hint: 'El registro declara un campo que el último escaneo no encuentra',
  },
};

export const reconciliationKind = (code: string): Rotulo =>
  code in RECONCILIATION_INFO
    ? {
        label: RECONCILIATION_INFO[code as PiiReconciliationKind].label,
        tone: code === 'MISSING_IN_REGISTRY' ? 'warning' : 'info',
      }
    : { label: code, tone: 'secondary' };

export const RECONCILIATION_OPTIONS = PII_RECONCILIATION_KINDS.map((value) => ({
  value,
  label: RECONCILIATION_INFO[value].label,
}));

/** Lo que el registro de gobierno dice de la columna; `null` = no la declara (no es «no personal»). */
export function registryMark(column: Pick<PiiColumn, 'registryMarksPersonal'>): string {
  switch (column.registryMarksPersonal) {
    case true:
      return 'Registro de gobierno: declarada como personal';
    case false:
      return 'Registro de gobierno: declarada sin marca de datos personales';
    default:
      return 'Registro de gobierno: no la declara';
  }
}

export const columnName = (
  c: Pick<PiiColumn | PiiDiscrepancy, 'schemaName' | 'objectName' | 'columnName'>,
) => `${c.schemaName}.${c.objectName}.${c.columnName}`;

const SCHEMA = /^[A-Za-z0-9_]{1,63}$/;
const isSchema = (s: string): boolean => SCHEMA.test(s);

/** La consulta de columnas: sólo filtros con valor, y niveles/estados que la API acepta. */
export function columnsQuery(values: PiiUrlValues): PiiColumnsQuery {
  return nonEmpty({
    q: values.q,
    schema: isSchema(values.schema) ? values.schema : '',
    minSensitivity: (PII_MIN_SENSITIVITIES as readonly string[]).includes(values.minSensitivity)
      ? values.minSensitivity
      : '',
    reviewStatus: (REVIEW_STATUSES as readonly string[]).includes(values.reviewStatus)
      ? values.reviewStatus
      : '',
  }) as PiiColumnsQuery;
}

export function reconciliationQuery(values: PiiUrlValues): PiiReconciliationQuery {
  return nonEmpty({
    kind: (PII_RECONCILIATION_KINDS as readonly string[]).includes(values.kind) ? values.kind : '',
    schema: isSchema(values.schema) ? values.schema : '',
  }) as PiiReconciliationQuery;
}

/** Por qué la lista de columnas está vacía, dicho con lo que informa el resumen de la API. */
export function emptyColumnsReason(summary: PiiSummary | null, filtered: boolean): string {
  if (filtered) return 'Ninguna columna coincide con los filtros elegidos.';
  if (summary === null) return 'No hay columnas clasificadas como datos personales.';
  if (summary.observedColumns === 0) {
    return 'El catálogo de datos no tiene columnas observadas: falta un escaneo.';
  }
  return `El catálogo tiene ${summary.observedColumns.toLocaleString('es-BO')} columnas observadas y ninguna clasificada como dato personal. Una columna sin clasificar no está garantizada libre de datos personales: el catálogo no lee valores.`;
}

/** Por qué la conciliación no tiene discrepancias, sin presentar «cero» como «todo en orden». */
export function emptyReconciliationReason(
  summary: Pick<PiiReconciliationSummary, 'approvedPersonalColumns'> | null,
  filtered: boolean,
): string {
  if (filtered) return 'Ninguna discrepancia coincide con los filtros elegidos.';
  if (summary === null) return 'No hay discrepancias entre el catálogo y el registro de gobierno.';
  if (summary.approvedPersonalColumns === 0) {
    return 'Todavía no hay columnas personales con ficha aprobada, así que no hay nada que conciliar. Las pendientes de revisión están en la pestaña Columnas.';
  }
  return 'Las columnas personales aprobadas coinciden con el registro de gobierno.';
}

/**
 * ¿Hay filtros que la API recibe? Se mide sobre la consulta ya depurada: un valor inventado en la URL
 * se descarta, y decir «ningún resultado coincide con los filtros» por un filtro que no se aplicó
 * sería explicar la lista vacía con una causa falsa.
 */
export function hasColumnFilters(values: PiiUrlValues): boolean {
  return Object.keys(columnsQuery(values)).length > 0;
}

export function hasReconciliationFilters(values: PiiUrlValues): boolean {
  return Object.keys(reconciliationQuery(values)).length > 0;
}
