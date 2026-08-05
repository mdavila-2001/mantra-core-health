import type { StatusSealVariant } from '../../shared/components/organisms/status-seal/status-seal.types';

/** Cómo se muestra el estado de un caso: variante del sello + el estado en palabras. */
export interface CaseStatusPresentation {
  readonly variant: StatusSealVariant;
  readonly label: string;
}

/**
 * El backend emite el estado como UUID de concepto (UUIDv5 determinista de
 * `identity_assurance`, con namespace constante del proyecto), así que los
 * identificadores son estables y se pueden mapear acá.
 *
 * TODO: migrar esta resolución a terminología (value set) cuando el backend
 * exponga códigos estables — informe a Marcelo del 2026-08-05.
 */
const CASE_STATUS_PRESENTATIONS: Readonly<Record<string, CaseStatusPresentation>> = Object.freeze({
  // CASE_OPEN
  '31f822ab-b48c-5570-a83c-cf16c37b5b9a': { variant: 'pending', label: 'Pendiente' },
  // CASE_IN_VERIFICATION
  'ba5a0b9d-8a27-5379-8662-eea142b98a22': { variant: 'in-review', label: 'En revisión' },
  // CASE_AT_RISK — a la persona verificada no se le revela la marca de riesgo:
  // para ella el caso sigue «en revisión».
  'c919c1c1-e013-5542-914e-1fe706203cd2': { variant: 'in-review', label: 'En revisión' },
  // CASE_MANUAL_REVIEW
  'a02659b9-802a-5acb-ac8f-093e0ddcdbf0': { variant: 'in-review', label: 'En revisión' },
  // CASE_VERIFIED
  '6fb20fdf-1c92-502c-8e1f-54a9bb85ff98': { variant: 'approved', label: 'Aprobado' },
  // CASE_ASSERTED
  'd41fde09-6752-5bb6-8237-b786fe062ab2': { variant: 'approved', label: 'Aprobado' },
  // CASE_REJECTED
  '05c426b8-86f5-5709-a939-d6baa864fd21': { variant: 'rejected', label: 'Rechazado' },
  // CASE_REVOKED
  '235c658e-7679-5604-baba-764055398964': { variant: 'rejected', label: 'Revocado' },
  // CASE_EXPIRED
  '9d172ffe-1b1f-5318-9378-c924732d7967': { variant: 'expired', label: 'Vencido' },
});

const UNKNOWN_PRESENTATION: CaseStatusPresentation = Object.freeze({
  variant: 'unknown',
  label: 'Desconocido',
});

/**
 * Jamás lanza ni devuelve null: un estado que esta versión no conoce se
 * muestra en neutro, no rompe la pantalla del titular.
 */
export function toCaseStatusPresentation(
  statusConceptId: string | null | undefined,
): CaseStatusPresentation {
  if (statusConceptId === null || statusConceptId === undefined) {
    return UNKNOWN_PRESENTATION;
  }
  return CASE_STATUS_PRESENTATIONS[statusConceptId] ?? UNKNOWN_PRESENTATION;
}
