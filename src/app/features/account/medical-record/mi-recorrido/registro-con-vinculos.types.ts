/* ============================================================================
    The neutral «record with links» interface of the patient's tour, and what
    the portal feeds it (`registro-con-vinculos.ts` adapts one to the other).
    ========================================================================== */

import type { ClinicalSummary } from '../../../../core/data-access/clinical/clinical.types';
import type { PatientOrder } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';

/** What kind of fact it is. */
export type TipoDeRegistro = 'atencion' | 'diagnostico' | 'estudio' | 'receta' | 'control';

/** A diagnosis' status, in the four words the patient reads. */
export type EstadoDelDiagnostico = 'en-estudio' | 'confirmado' | 'descartado' | 'resuelto';

/** What happened with the follow-up (the booked re-consultation). */
export type EstadoDelControl = 'realizado' | 'proximo' | 'agendado' | 'no-realizado';

/**
 * A link the tour would need and that is **not on record** in what arrived.
 *
 * It does not tell «the field did not travel» from «it travelled empty»: the
 * clinical network contract omits the three new links when they are `null`,
 * so from here both look the same. What can be said is that it is not on
 * record.
 */
export type VinculoAusente =
  /** The study does not say which diagnosis it was ordered for (`reasonConditionId`). */
  | 'estudio-sin-diagnostico'
  /** The ruled-out diagnosis does not say which took its place (`replacedByConditionId`). */
  | 'descartado-sin-reemplazo'
  /** The prescription does not say which diagnosis it is for (`indicationConditionId`). */
  | 'receta-sin-diagnostico';

/** A portal record, with its links already resolved to identifiers. */
export interface RegistroConVinculos {
  readonly id: string;
  readonly tipo: TipoDeRegistro;
  /** The instant of the fact, or `null` if the record does not bring it. */
  readonly cuando: Date | null;
  /** What is named: the reason, the diagnosis, the study, the medication. */
  readonly nombre: string;
  /** The encounter where it was entered, if on record. */
  readonly atencionId: string | null;
  /** The diagnosis it serves: the prescription's indication or the study's reason. */
  readonly diagnosticoId: string | null;
  /** Diagnosis: the one that replaced it when ruled out (strip 1's new link). */
  readonly reemplazadoPorId: string | null;
  /** Follow-up: the encounter it came from. */
  readonly origenAtencionId: string | null;
  /** Diagnosis: how it ended up. */
  readonly estado: EstadoDelDiagnostico | null;
  /** Diagnosis: when it was decided (confirmed or ruled out), if on record. */
  readonly decididoEl: Date | null;
  /** Diagnosis: the study it was decided with (`verification.basedOn`). */
  readonly evidenciaEstudioId: string | null;
  /** Diagnosis: when it was deemed resolved. */
  readonly resueltoEl: Date | null;
  /** Study: the released report, if there is one yet. */
  readonly informeId: string | null;
  /** Study: the result is already available to the patient. */
  readonly conResultado: boolean;
  /** Follow-up: how it ended up. */
  readonly estadoDelControl: EstadoDelControl | null;
  /** Encounter: still open. */
  readonly enCurso: boolean;
  /** The data the detail sheet shows, already in words. */
  readonly detalle: readonly Hecho[];
  /** The links not on record, to mark them without inferring them. */
  readonly ausentes: readonly VinculoAusente[];
}

/** What the portal already brought, as it brought it. */
export interface FuentesDelPortal {
  readonly resumen: ClinicalSummary;
  readonly ordenes: readonly PatientOrder[];
  readonly citas: readonly Booking[];
}

/** Resolves a concept to its readable label. */
export type ResolverEtiqueta = (conceptId: string | undefined) => string;
