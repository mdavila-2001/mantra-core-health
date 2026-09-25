import type { ChartNote, MedicalNoteEntry } from '../clinical/clinical.types';

/* ============================================================================
    La nota médica: lo que la médica escribe en cada cita.

    Desde C1 (25/09/2026) la nota es una **tabla de filas campo/valor**
    —«Presión arterial: 120/80», «Dolor: región lumbar, 6/10»— más un texto
    libre opcional. Es lo que el propietario pidió, literal: «una tabla de
    valores donde los campos son más dinámicos y laxos».

    Los cinco bloques de la nota SOAP —motivo, subjetivo, objetivo,
    apreciación y plan— siguen en el contrato porque el backend los tiene
    (`chart.clinical_note_*`) y las notas viejas los traen. La pantalla nueva
    escribe las filas y, si hay texto libre, lo manda en `subjectiveText`.
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
  /** Las filas campo/valor de C1. Lectura y escritura reales pendientes de backend (P39). */
  readonly entries?: readonly MedicalNoteEntry[];
  /** Motivo de consulta. */
  readonly chiefComplaintText?: string;
  /** Lo que refiere el paciente; desde C1, el texto libre de la nota. */
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
  /** Las filas campo/valor de C1. Lectura y escritura reales pendientes de backend (P39). */
  readonly entries?: readonly MedicalNoteEntry[];
  /** Por qué se corrige una nota ya firmada. Obligatorio sólo en ese caso (409 sin él). */
  readonly amendmentReasonText?: string;
  /** Motivo de consulta. */
  readonly chiefComplaintText?: string;
  /** Lo que refiere el paciente; desde C1, el texto libre de la nota. */
  readonly subjectiveText?: string;
  /** Lo que se observa y se mide. */
  readonly objectiveText?: string;
  /** La impresión del profesional. */
  readonly assessmentText?: string;
  /** Qué se va a hacer. */
  readonly planText?: string;
}

/** Con qué se piden las notas de una persona. */
export interface ListChartNotesParams {
  /** De quién. Obligatorio: no hay listado de notas sin persona. */
  readonly patientProfileId: string;
  /** Sólo las de esta consulta, si se quiere acotar. */
  readonly encounterId?: string;
  /** Tope. La API aplica 50 si no se pide otro. */
  readonly limit?: number;
}

/** Una página de notas, en la forma de las listas paginadas del backend. */
export interface ChartNotesPage {
  readonly items: readonly ChartNote[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}
