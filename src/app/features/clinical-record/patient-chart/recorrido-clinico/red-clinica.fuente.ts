/* ============================================================================
    What the clinical network reads from the chart: the contract types
    (`core/data-access`) trimmed with `Pick` to the fields it uses, plus the
    already presented rows of the chart blocks.
    ========================================================================== */

import type { Tone } from '../../../../shared/components/tone/tone.types';
import type { CertezaDiagnostica } from './red-clinica.model';
import type { TipoDelRecorrido } from './recorrido-clinico.model';
import type {
  CarePlan,
  ChartNote,
  Condition,
  DiagnosisEvidence,
  Encounter,
  MedicationRequest,
  Observation,
} from '../../../../core/data-access/clinical/clinical.types';
import type { DiagnosticOrder, DiagnosticReport } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';
import type { DentalProcedure } from '../../../../core/data-access/procedures/procedures.types';


/** A record of the chart blocks, already presented (the screen builds it, with the same rule as the table). */
export interface FilaPresentada {
  readonly id: string;
  readonly tipo: TipoDelRecorrido;
  readonly titulo: string;
  readonly detalle: string;
  readonly estado: string;
  readonly tonoDelEstado?: Tone;
  readonly cuando: Date | null;
  readonly certeza?: CertezaDiagnostica;
  readonly concepto?: string;
}

/**
 * What the network reads from each read: the contract types
 * (`core/data-access`), trimmed to the fields it uses. That way tests do not
 * build a whole clinical summary, and a rename in the contract breaks the
 * build here instead of silently erasing a line.
 */
export interface FuenteDeLaRed {
  readonly encounters: readonly Pick<Encounter, 'id' | 'episodeId'>[];
  readonly conditions: readonly (Pick<Condition, 'id' | 'encounterId' | 'replacedByConditionId'> & {
    readonly verification?: { readonly basedOn: DiagnosisEvidence | null } | null;
  })[];
  readonly medicationRequests: readonly Pick<
    MedicationRequest,
    'id' | 'encounterId' | 'indicationConditionId' | 'replacedByRequestId'
  >[];
  readonly observations: readonly Pick<Observation, 'id' | 'encounterId'>[];
  readonly notes: readonly Pick<ChartNote, 'noteId' | 'encounterId'>[];
  readonly carePlans: readonly Pick<CarePlan, 'id' | 'conditionId'>[];
  /** The reads the network requests separately. `null`: could not be read or has not arrived yet. */
  readonly citas?: readonly CitaDeLaFuente[] | null;
  readonly derivaciones?: readonly DerivacionDeLaFuente[] | null;
  readonly estudios?: {
    readonly orders: readonly OrdenDeLaFuente[];
    readonly reports: readonly InformeDeLaFuente[];
  } | null;
  readonly procedimientos?: readonly ProcedimientoDeLaFuente[] | null;
}

export type CitaDeLaFuente = Pick<
  Booking,
  'id' | 'startAt' | 'createdAt' | 'statusConceptId' | 'typeConceptId' | 'reasonText' | 'followUpOf'
> & { readonly service?: Pick<NonNullable<Booking['service']>, 'name'> };

export type DerivacionDeLaFuente = Pick<
  Referral,
  | 'id'
  | 'createdAt'
  | 'status'
  | 'sourceEncounterId'
  | 'targetEncounterId'
  | 'targetDisplayName'
  | 'targetTenantName'
  | 'targetExternalName'
  | 'targetServiceName'
  | 'requestedServiceText'
  | 'reasonText'
  | 'diagnosisText'
  | 'counterReferralAt'
> & { readonly transfer?: Pick<NonNullable<Referral['transfer']>, 'arrivedAt'> };

export type OrdenDeLaFuente = Pick<
  DiagnosticOrder,
  'id' | 'encounterId' | 'codeConceptId' | 'statusConceptId' | 'createdAt' | 'reasonConditionId'
>;

export type InformeDeLaFuente = Pick<
  DiagnosticReport,
  'id' | 'serviceRequestId' | 'encounterId' | 'codeConceptId' | 'lifecycleStatusConceptId' | 'createdAt'
>;

export type ProcedimientoDeLaFuente = Pick<
  DentalProcedure,
  'id' | 'encounterId' | 'procedureCodeConceptId' | 'statusConceptId' | 'performedAt' | 'createdAt'
>;

/** A concept's label: `display` to show, `code` to decide. */
export type Rotulador = (conceptId: string | undefined) => { readonly display?: string; readonly code?: string };
