import type { MedicalNoteEntry } from '../clinical/clinical.types';

/* ============================================================================
    La nota clínica narrativa: lo que el médico escribe con sus palabras.

    El modelo la parte en los cinco bloques de la nota SOAP —motivo, subjetivo,
    objetivo, apreciación y plan—, que no son «campos a llenar» sino las cinco
    cosas que un médico ya escribe cuando escribe una consulta. Quien no quiera
    ninguna estructura usa uno solo y deja el resto vacío: es exactamente lo que
    hace la hoja en blanco.
   ========================================================================== */

/** Lo que se manda para abrir una nota nueva. */
export interface CreateClinicalNoteInput {
  /** De qué paciente es la historia. */
  readonly patientProfileId: string;
  /** Quién la escribe. */
  readonly authorProfileId: string;
  /** La consulta a la que pertenece, si nace dentro de una. */
  readonly encounterId?: string;
  /** Qué clase de nota es; sin él, la que el servidor tome por omisión. */
  readonly noteTypeConceptId?: string;
  /** Filas estructuradas de C1; lectura y escritura reales pendientes de backend P39. */
  readonly entries?: readonly MedicalNoteEntry[];
  /** Motivo de consulta. */
  readonly chiefComplaintText?: string;
  /** Lo que refiere el paciente. */
  readonly subjectiveText?: string;
  /** Lo que se observa y se mide. */
  readonly objectiveText?: string;
  /** La impresión del profesional. */
  readonly assessmentText?: string;
  /** Qué se va a hacer. */
  readonly planText?: string;
}

/** Lo que devuelve el servidor al abrir la nota o al agregarle una versión. */
export interface ClinicalNoteVersionRef {
  /** La nota, estable entre versiones. */
  readonly noteId: string;
  /** La versión concreta que acaba de nacer. */
  readonly versionId: string;
  /** Su número, empezando en 1. */
  readonly versionNumber: number;
  /** En qué punto del ciclo de vida quedó la nota. */
  readonly lifecycleStatusConceptId: string;
  /** En qué punto quedó esta versión. */
  readonly versionStatusConceptId: string;
}

/**
 * Lo que se manda para agregar una versión a una nota que ya existe.
 *
 * No lleva `patientProfileId`: la nota ya sabe de quién es, y admitir que
 * viniera abriría la puerta a moverla de paciente por descuido.
 */
export interface AppendClinicalNoteVersionInput {
  /** Quién escribe esta versión. */
  readonly authorProfileId: string;
  /** Filas estructuradas de C1; lectura y escritura reales pendientes de backend P39. */
  readonly entries?: readonly MedicalNoteEntry[];
  /** Motivo de consulta. */
  readonly chiefComplaintText?: string;
  /** Lo que refiere el paciente. */
  readonly subjectiveText?: string;
  /** Lo que se observa y se mide. */
  readonly objectiveText?: string;
  /** La impresión del profesional. */
  readonly assessmentText?: string;
  /** Qué se va a hacer. */
  readonly planText?: string;
}
