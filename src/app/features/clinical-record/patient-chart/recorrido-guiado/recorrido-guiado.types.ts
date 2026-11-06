/* ============================================================================
    The guided tour's contracts: what goes in (`core/data-access/` records and
    how to read their concepts) and what comes out (steps with traceable
    sentences). See `recorrido-guiado.model.ts` and ADR-0022.
    ========================================================================== */

import type {
  CareEpisode,
  Condition,
  Encounter,
  MedicationRequest,
} from '../../../../core/data-access/clinical/clinical.types';
import type { DiagnosticOrder, DiagnosticReport } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { SurgicalCase } from '../../../../core/data-access/procedures/procedures.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';

/* -- Contrato de entrada --------------------------------------------------- */

/** The chart records the tour knows how to tell. All optional. */
export interface RegistrosDelRecorrido {
  readonly atenciones?: readonly Encounter[];
  readonly citas?: readonly Booking[];
  readonly derivaciones?: readonly Referral[];
  readonly diagnosticos?: readonly Condition[];
  readonly ordenes?: readonly DiagnosticOrder[];
  readonly informes?: readonly DiagnosticReport[];
  readonly recetas?: readonly MedicationRequest[];
  readonly internaciones?: readonly CareEpisode[];
  readonly procedimientos?: readonly SurgicalCase[];
}

/**
 * How the data arriving as identifiers is read.
 *
 * `etiqueta` translates a terminology concept to its name; it returns
 * `undefined` if it does not know it. Whatever looks like an identifier (uuid,
 * catalogue code) is discarded anyway: the narration prefers «sin nombre
 * disponible» to a uuid.
 */
export interface LectorDelRecorrido {
  readonly etiqueta: (conceptId: string | undefined) => string | undefined;
  /** A concept's catalogue code (`COND_CONFIRMED`…), for the verification. */
  readonly codigo?: (conceptId: string | undefined) => string | undefined;
  /** An encounter's service or specialty («Medicina general»), if known. */
  readonly servicioDeAtencion?: (atencion: Encounter) => string | undefined;
  /** A practitioner's name by their profile, if known. */
  readonly profesional?: (profileId: string | undefined) => string | undefined;
}

/* -- Contrato de salida ---------------------------------------------------- */

/** A sentence of the narration and the records it comes from. */
export interface FraseDelPaso {
  readonly texto: string;
  /** Real ids of the records backing the sentence. Never empty. */
  readonly fuentes: readonly string[];
  /** `true` if the sentence joins records by coincidence (same encounter), not by a contract link. */
  readonly inferida: boolean;
}

export interface PasoDelRecorrido {
  /** Stable across reads: the clinical day (`2026-02-03`, `dia-clinico.ts`) or `sin-fecha`. */
  readonly clave: string;
  readonly fecha: Date | null;
  /** «3 feb 2026», o «Sin fecha». */
  readonly fechaTexto: string;
  readonly titulo: string;
  /** The sentences joined: what is read and what the screen reader announces. */
  readonly narracion: string;
  readonly frases: readonly FraseDelPaso[];
  /** The network nodes this step brings to the front. */
  readonly enfocar: readonly string[];
  /** Every node revealed up to this step, included. */
  readonly revelados: readonly string[];
}
