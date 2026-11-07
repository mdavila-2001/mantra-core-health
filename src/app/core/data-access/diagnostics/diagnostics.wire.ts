/* ============================================================================
    The diagnostics contract's transport shapes and their mapping to the view
    types (`diagnostics.client.ts`).
    ========================================================================== */

import { normalizePatientSettlement } from '../insurance/patient-insurance-settlement.types';
import { sinNulos, type ConNulos } from '../wire';
import { withStudyDetail } from './study-detail.types';
import type {
  DiagnosticOrder,
  DiagnosticOrderCreated,
  DiagnosticReport,
  DiagnosticResultShare,
  DuplicateStudyCheckResult,
  LabWorkOrder,
  PatientDiagnosticResult,
  PatientDiagnosticResults,
  PatientDiagnostics,
  PatientOrder,
  PatientOwnOrders,
  PreviousStudy,
} from './diagnostics.types';
import type { PractitionerDiagnosticResult } from './diagnostics-practitioner-result.types';

/* ---- formas de transporte ------------------------------------------------
   Todas las fechas llegan como texto ISO; el resto del contrato viaja igual.
   `Fechas<T, K>` declara **qué claves** son fechas en cada tipo, en vez de
   inferirlas: una clave nueva del contrato tiene que obligar a decidir, no
   convertirse sola. Mismo criterio —y misma forma— que en `clinical`. */

export type Fechas<T, K extends keyof T> = Omit<T, K> & Partial<Readonly<Record<K, string>>>;

// `previousDiagnosticReportId`/`duplicateOverrideReason` (antiduplicación,
// v4.2.17) son columnas nullable: MikroORM hidrata una fila sin valor como
// `null`, no como propiedad ausente, así que el transporte también viaja con
// `null` y hay que normalizarlo en `toOrder` — mismo motivo que el resto de
// este archivo usa `Fechas<T, K>` en vez de confiar en el tipo de la vista.
export type WireOrder = Omit<
  DiagnosticOrder,
  | 'createdAt'
  | 'previousDiagnosticReportId'
  | 'duplicateOverrideReason'
  | 'previousServiceRequestId'
  | 'reasonConditionId'
> & {
  readonly createdAt: string;
  readonly previousDiagnosticReportId?: string | null;
  readonly duplicateOverrideReason?: string | null;
  readonly previousServiceRequestId?: string | null;
  /** Patch v4291: the contract omits it when null, but a MikroORM row may bring `null`. */
  readonly reasonConditionId?: string | null;
};

export type WireReport = Omit<DiagnosticReport, 'createdAt'> & { readonly createdAt: string };

export type WireLabWorkOrder = Fechas<LabWorkOrder, 'scheduledAt' | 'completedAt'>;

export type WireOrderCreated = Omit<DiagnosticOrderCreated, 'createdAt'> & {
  readonly createdAt: string;
};

export interface WirePatientDiagnostics extends Omit<PatientDiagnostics, 'orders' | 'reports'> {
  readonly orders: readonly WireOrder[];
  readonly reports: readonly WireReport[];
}

export function toOrder({
  createdAt,
  previousDiagnosticReportId,
  duplicateOverrideReason,
  previousServiceRequestId,
  reasonConditionId,
  ...resto
}: WireOrder): DiagnosticOrder {
  return {
    ...withStudyDetail(resto),
    createdAt: new Date(createdAt),
    ...(previousDiagnosticReportId == null ? {} : { previousDiagnosticReportId }),
    ...(duplicateOverrideReason == null ? {} : { duplicateOverrideReason }),
    ...(previousServiceRequestId == null ? {} : { previousServiceRequestId }),
    ...(reasonConditionId == null ? {} : { reasonConditionId }),
  };
}

export function toReport({ createdAt, ...resto }: WireReport): DiagnosticReport {
  return { ...resto, createdAt: new Date(createdAt) };
}

export function toOrderCreated({ createdAt, ...resto }: WireOrderCreated): DiagnosticOrderCreated {
  return { ...resto, createdAt: new Date(createdAt) };
}

/* ---- antiduplicación de estudios, formas de transporte --------------------
   El backend manda `null` en los opcionales vacíos (previousStudy,
   warningMessage, y dentro del estudio previo conclusionText/
   reportDownloadUrl/serviceRequestId), no los omite: se normaliza con
   `sinNulos`, igual que el resto de los clientes. */

export type WirePreviousStudy = ConNulos<Omit<PreviousStudy, 'performedAt'>> & {
  readonly performedAt: string;
};

export interface WireDuplicateStudyCheckResult
  extends ConNulos<Omit<DuplicateStudyCheckResult, 'previousStudy'>> {
  readonly previousStudy: WirePreviousStudy | null;
}

export function toPreviousStudy({ performedAt, ...resto }: WirePreviousStudy): PreviousStudy {
  return {
    ...sinNulos<Omit<PreviousStudy, 'performedAt'>>(resto),
    // `performedAt` no es opcional en el contrato del backend: siempre viene
    // como texto cuando `previousStudy` no es `null`.
    performedAt: new Date(performedAt),
  };
}

export function toDuplicateStudyCheckResult({
  previousStudy,
  ...resto
}: WireDuplicateStudyCheckResult): DuplicateStudyCheckResult {
  return {
    ...sinNulos<Omit<DuplicateStudyCheckResult, 'previousStudy'>>(resto),
    ...(previousStudy === null ? {} : { previousStudy: toPreviousStudy(previousStudy) }),
  };
}

/**
 * Lee `details.previousStudy` de un 422 `DUPLICATE_STUDY_DETECTED` —la carrera
 * entre el chequeo y el alta (antiduplicación de estudios, T-26): alguien
 * liberó el informe entre que se mostró «sin duplicado» y que se mandó el
 * pedido, y el alta lo rechaza con el mismo estudio previo que hubiera dado
 * el chequeo. Es el único punto fuera de este cliente que necesita decodificar
 * la forma de transporte de `PreviousStudy`, así que se expone acá en vez de
 * hacer que quien la usa reimplemente `toPreviousStudy`.
 *
 * Devuelve `null` ante cualquier forma inesperada: no vale la pena fabricar un
 * estudio previo a medias para un diálogo que lo va a mostrar como si fuera
 * un dato real.
 */
export function previousStudyFromErrorDetails(
  details: Record<string, unknown> | undefined,
): PreviousStudy | null {
  const candidato = details?.['previousStudy'];
  if (typeof candidato !== 'object' || candidato === null) {
    return null;
  }
  const wire = candidato as Partial<WirePreviousStudy>;
  if (
    typeof wire.reportId !== 'string' ||
    typeof wire.studyName !== 'string' ||
    typeof wire.providerName !== 'string' ||
    typeof wire.performedAt !== 'string' ||
    typeof wire.daysAgo !== 'number' ||
    typeof wire.resultsAvailable !== 'boolean' ||
    typeof wire.sameOrganization !== 'boolean'
  ) {
    return null;
  }
  return toPreviousStudy(wire as WirePreviousStudy);
}

export function toWorkOrder({ scheduledAt, completedAt, ...resto }: WireLabWorkOrder): LabWorkOrder {
  return {
    ...resto,
    ...fecha('scheduledAt', scheduledAt),
    ...fecha('completedAt', completedAt),
  };
}

/**
 * La clave con su fecha, o nada.
 *
 * Devolver `{}` y esparcirlo —en vez de asignar `undefined`— es lo que deja la
 * clave **ausente** en el objeto resultante. Con `undefined` la clave existe con
 * valor vacío, y `'completedAt' in orden` pasaría a decir que sí hay dato.
 */
export function fecha<K extends string>(
  key: K,
  value: string | null | undefined,
): Partial<Record<K, Date>> {
  return value === null || value === undefined
    ? {}
    : ({ [key]: new Date(value) } as Record<K, Date>);
}

/* ---- el portal del paciente, formas de transporte ------------------------ */

export type WirePatientResult = Fechas<PatientDiagnosticResult, 'issuedAt' | 'releasedAt'> & {
  // `releasedAt` no es opcional en el contrato: un resultado que llega a esta
  // lista está liberado por definición, así que siempre trae cuándo.
  readonly releasedAt: string;
};

export interface WirePatientResults extends Omit<PatientDiagnosticResults, 'items'> {
  readonly items: readonly WirePatientResult[];
}

export type WirePatientOrder = Fechas<PatientOrder, 'createdAt'> & {
  // Toda orden tiene fecha de pedido: es lo que la ordena en la lista.
  readonly createdAt: string;
};

export interface WirePatientOrders extends Omit<PatientOwnOrders, 'items'> {
  readonly items: readonly WirePatientOrder[];
}

export type WireShare = Fechas<DiagnosticResultShare, 'validFrom' | 'validTo'> & {
  readonly validFrom: string;
};

export interface WireShares {
  readonly reportId: string;
  readonly items: readonly WireShare[];
}

export function toPatientResult({
  issuedAt,
  releasedAt,
  ...resto
}: WirePatientResult): PatientDiagnosticResult {
  return { ...resto, ...fecha('issuedAt', issuedAt), releasedAt: new Date(releasedAt) };
}

export type WirePractitionerResult = Omit<PractitionerDiagnosticResult, 'issuedAt' | 'releasedAt'> & {
  readonly issuedAt: string | null;
  readonly releasedAt: string;
};

export function toPractitionerResult({ issuedAt, releasedAt, ...resto }: WirePractitionerResult): PractitionerDiagnosticResult {
  return { ...resto, issuedAt: issuedAt === null ? null : new Date(issuedAt), releasedAt: new Date(releasedAt) };
}

export function toPatientOrder({ createdAt, ...resto }: WirePatientOrder): PatientOrder {
  return { ...withStudyDetail(resto), ...normalizePatientSettlement(resto), createdAt: new Date(createdAt) };
}

export function toShare({ validFrom, validTo, ...resto }: WireShare): DiagnosticResultShare {
  return { ...resto, validFrom: new Date(validFrom), ...fecha('validTo', validTo) };
}
