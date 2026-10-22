/* ---- FT-22 · Aspectos médicos del titular --------------------------------- */

/**
 * Lo que el propio paciente declara sobre su salud.
 *
 * ## Por qué es un contrato aparte del resumen clínico
 *
 * `ClinicalSummary` es lo que **un profesional registró**: condiciones,
 * alergias y observaciones firmadas, que el paciente no puede ni debe editar.
 * Esto es lo otro: lo que la persona dice de sí misma antes de que nadie la
 * examine —qué toma, a qué es alérgica según ella, qué le operaron—. Mezclarlos
 * en una sola lectura haría que un dato declarado se leyera como un diagnóstico.
 *
 * Todo texto libre y opcional a propósito: es una declaración, no un formulario
 * clínico codificado. Obligar a elegir de un catálogo dejaría fuera justo lo que
 * la persona quiere aclarar.
 */
export interface OwnMedicalAspects {
  /** Grupo y factor, tal como la persona lo declara («O+»). */
  readonly bloodType?: string;
  /** A qué dice ser alérgica. No reemplaza a las alergias registradas. */
  readonly allergiesText?: string;
  /** Enfermedades crónicas o condiciones que declara. */
  readonly chronicConditionsText?: string;
  /** Qué está tomando ahora, incluidos los de venta libre. */
  readonly currentMedicationsText?: string;
  /** Cirugías y hospitalizaciones anteriores. */
  readonly surgeriesText?: string;
  /** Antecedentes familiares relevantes. */
  readonly familyHistoryText?: string;
  /** Hábitos: tabaco, alcohol, actividad física, alimentación. */
  readonly habitsText?: string;
  /** Cuándo se guardó por última vez. Sólo lectura: lo pone el servidor. */
  readonly updatedAt?: Date;
}

/**
 * Los cambios que el titular manda.
 *
 * Cada campo ausente **no se toca**; un campo en `''` lo borra. Es la
 * distinción que permite guardar una sección sin pisar las otras.
 */
export type OwnMedicalAspectsChanges = Omit<OwnMedicalAspects, 'updatedAt'>;
