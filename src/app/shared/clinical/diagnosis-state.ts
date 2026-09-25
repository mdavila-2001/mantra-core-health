import type { Condition } from '../../core/data-access/clinical/clinical.types';

/** Certeza diagnóstica: el diagnóstico quedó confirmado. */
export const CODIGO_CONFIRMADO = 'DXV-CONFIRMED';

/** Certeza diagnóstica: el profesional lo **descartó**. Es el kill-test de C6. */
export const CODIGO_DESCARTADO = 'DXV-REFUTED';

/** Estado clínico: la condición sigue activa. */
export const CODIGO_ACTIVA = 'COND-ACTIVE';

/** Estado clínico: la condición se resolvió. */
export const CODIGO_RESUELTA = 'COND-RESOLVED';

/** Estado clínico: la condición está en remisión — ya no es una enfermedad activa. */
export const CODIGO_REMISION = 'COND-REMISSION';

/** Curso clínico: la condición no tiene resolución esperada, se sigue de por vida. */
export const CODIGO_CURSO_CRONICO = 'COND_COURSE_CHRONIC';

export type DiagnosisState = 'IN_STUDY' | 'ACTIVE' | 'HISTORIC' | 'REFUTED';

export const DIAGNOSIS_STATES: readonly DiagnosisState[] = [
  'IN_STUDY',
  'ACTIVE',
  'HISTORIC',
  'REFUTED',
];

export const DIAGNOSIS_STATE_LABELS: Readonly<Record<DiagnosisState, string>> = Object.freeze({
  IN_STUDY: 'En estudio',
  ACTIVE: 'Enfermedad activa',
  HISTORIC: 'Diagnóstico histórico',
  REFUTED: 'Rechazado',
});

/** Resuelve un identificador de concepto a su código de catálogo. */
export type ResolverCodigo = (conceptId: string | undefined) => string | undefined;

/**
 * Clasificación canónica de C0. Los identificadores se resuelven en el consumidor,
 * nunca se deducen de etiquetas. El fin esperado es un instante inclusivo.
 */
export function diagnosisStateOf(
  condition: Pick<
    Condition,
    'verificationStatusConceptId' | 'clinicalStatusConceptId' | 'resolvedAt' | 'expectedResolutionAt'
  >,
  codes: { confirmed: string; refuted: string; active: string },
  now = new Date(),
): DiagnosisState {
  if (condition.verificationStatusConceptId === codes.refuted) {
    return 'REFUTED';
  }
  if (condition.verificationStatusConceptId !== codes.confirmed) {
    return 'IN_STUDY';
  }
  const isCurrent =
    condition.expectedResolutionAt === undefined ||
    condition.expectedResolutionAt.getTime() >= now.getTime();
  return condition.clinicalStatusConceptId === codes.active &&
    condition.resolvedAt === undefined &&
    isCurrent
    ? 'ACTIVE'
    : 'HISTORIC';
}

/** La condición se sigue de por vida: no hay «hasta» que mostrar. */
export function esCronica(condicion: Condition, codigo: ResolverCodigo): boolean {
  return codigo(condicion.clinicalCourseConceptId) === CODIGO_CURSO_CRONICO;
}

/** La condición está declarada activa por el catálogo. */
export function estaActiva(condicion: Condition, codigo: ResolverCodigo): boolean {
  return codigo(condicion.clinicalStatusConceptId) === CODIGO_ACTIVA;
}
