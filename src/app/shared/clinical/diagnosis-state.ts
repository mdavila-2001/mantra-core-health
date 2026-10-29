import type { Condition } from '../../core/data-access/clinical/clinical.types';

/*
 * Los códigos son **los de la API** (`CLIN.CONDITION_*` en
 * `clinical/clinical.concepts.ts` de mantra-core-health-api). Antes eran los del
 * simulador (`DXV-CONFIRMED`, `COND-ACTIVE`): contra la API real ningún
 * concepto coincidía y todo diagnóstico se veía «En estudio». El simulador
 * sigue a estos códigos, no al revés.
 */

/** Certeza diagnóstica: el diagnóstico quedó confirmado. */
export const CODIGO_CONFIRMADO = 'COND_CONFIRMED';

/** Certeza diagnóstica: el profesional lo **descartó**. Es el kill-test de C6. */
export const CODIGO_DESCARTADO = 'COND_REFUTED';

/** Estado clínico: la condición sigue activa. */
export const CODIGO_ACTIVA = 'COND_ACTIVE';

/** Estado clínico: la condición se resolvió. */
export const CODIGO_RESUELTA = 'COND_RESOLVED';

/** Estado clínico: la condición está en remisión — ya no es una enfermedad activa. */
export const CODIGO_REMISION = 'COND_REMISSION';

/** Curso clínico: la condición no tiene resolución esperada, se sigue de por vida. */
export const CODIGO_CURSO_CRONICO = 'COND_COURSE_CHRONIC';

/**
 * El catálogo real publica estos conceptos con el prefijo del módulo y la clave
 * completa (`clinical:CONDITION_CONFIRMED`), mientras que las constantes de
 * arriba (y el simulador) usan la forma corta (`COND_CONFIRMED`). Se comparan
 * normalizadas: sin esto, contra la API real todo diagnóstico —también el
 * confirmado— se veía «En estudio».
 */
export function normalizarCodigoDx(codigo: string | undefined): string | undefined {
  return codigo?.replace(/^clinical:CONDITION_/, 'COND_');
}

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
  const verificacion = normalizarCodigoDx(condition.verificationStatusConceptId);
  const estadoClinico = normalizarCodigoDx(condition.clinicalStatusConceptId);
  if (verificacion === normalizarCodigoDx(codes.refuted)) {
    return 'REFUTED';
  }
  if (verificacion !== normalizarCodigoDx(codes.confirmed)) {
    return 'IN_STUDY';
  }
  const isCurrent =
    condition.expectedResolutionAt === undefined ||
    condition.expectedResolutionAt.getTime() >= now.getTime();
  return estadoClinico === normalizarCodigoDx(codes.active) &&
    condition.resolvedAt === undefined &&
    isCurrent
    ? 'ACTIVE'
    : 'HISTORIC';
}

/** La condición se sigue de por vida: no hay «hasta» que mostrar. */
export function esCronica(condicion: Condition, codigo: ResolverCodigo): boolean {
  return normalizarCodigoDx(codigo(condicion.clinicalCourseConceptId)) === CODIGO_CURSO_CRONICO;
}

/** La condición está declarada activa por el catálogo. */
export function estaActiva(condicion: Condition, codigo: ResolverCodigo): boolean {
  return normalizarCodigoDx(codigo(condicion.clinicalStatusConceptId)) === CODIGO_ACTIVA;
}
