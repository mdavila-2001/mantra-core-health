/* ============================================================================
    What the chart-to-panel translation reads from each chart read: the
    contract types trimmed with `Pick` (`red-clinica-del-expediente.ts`).
    ========================================================================== */

import type { Condition } from '../../../../core/data-access/clinical/clinical.types';
import type { DiagnosticOrder, DiagnosticReport } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';

export type DiagnosticoDelDetalle = Pick<
  Condition,
  'id' | 'noteText' | 'onsetAt' | 'replacedByConditionId' | 'verification'
>;

export type CitaDelDetalle = Pick<Booking, 'id' | 'reasonText' | 'followUpOf'>;

export type DerivacionDelDetalle = Pick<
  Referral,
  | 'id'
  | 'status'
  | 'referralType'
  | 'reasonText'
  | 'diagnosisText'
  | 'clinicalSummary'
  | 'respondedAt'
  | 'rejectReason'
  | 'targetEncounterId'
  | 'counterReferralText'
  | 'counterReferralAt'
  | 'targetDisplayName'
  | 'targetTenantName'
  | 'targetExternalName'
  | 'targetServiceName'
  | 'requestedServiceText'
> & { readonly transfer?: { readonly arrivedAt?: Date; readonly arrivalNotes?: string } };

export type OrdenDelDetalle = Pick<DiagnosticOrder, 'id' | 'category' | 'priorityConceptId'>;

export type InformeDelDetalle = Pick<DiagnosticReport, 'id' | 'serviceRequestId' | 'currentReleasedVersionId'>;

/** What the chart already shows of one of its blocks' records: the summary and label/value pairs. */
export interface DetalleDeBloque {
  readonly resumen?: string;
  readonly datos?: readonly { readonly rotulo: string; readonly valor: string }[];
}

/**
 * The reads each node's analysis comes from. All optional: one that failed
 * (`null`) leaves its nodes with the header and the links.
 */
export interface FuenteDelDetalle {
  readonly diagnosticos?: readonly DiagnosticoDelDetalle[] | null;
  readonly citas?: readonly CitaDelDetalle[] | null;
  readonly derivaciones?: readonly DerivacionDelDetalle[] | null;
  readonly estudios?: {
    readonly orders: readonly OrdenDelDetalle[];
    readonly reports: readonly InformeDelDetalle[];
  } | null;
  /** Encounter, medication, observation, note, plan, document, admission. */
  readonly bloques?: ReadonlyMap<string, DetalleDeBloque>;
}
