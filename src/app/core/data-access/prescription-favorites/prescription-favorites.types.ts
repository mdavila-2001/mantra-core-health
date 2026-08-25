/** Tipos de la vista para `clinical_ext` · favoritos de prescripción (Patch v4.1.7). */

/**
 * Lo que un favorito rellena en el formulario de receta.
 *
 * Es deliberadamente el subconjunto de `NewMedicationRequest` que se repite
 * entre pacientes: el medicamento y su pauta. Lo que cambia en cada receta
 * —paciente, encuentro, indicación diagnóstica, fecha— **no** vive acá, porque
 * un favorito que recordara al paciente no sería un favorito.
 *
 * Todos los campos salvo el medicamento son opcionales: el profesional guarda
 * lo que quiera prefijar y deja el resto para el momento de prescribir.
 */
interface PrescriptionDefaults {
  /** Medicamento codificado (`terminology.catalog_concepts`). */
  readonly medicationConceptId: string;
  /** Principio activo ATC, cuando el favorito lo fija. */
  readonly substanceAtcConceptId?: string;
  /** Posología en palabras: «500 mg». Texto libre del contrato. */
  readonly doseText?: string;
  /** Vía de administración, como concepto. */
  readonly routeConceptId?: string;
  /** Frecuencia en palabras: «cada 8 horas». */
  readonly frequencyText?: string;
  /**
   * Cantidad a dispensar.
   *
   * **Siempre `number` de este lado.** La API lo recibe numérico al crear pero
   * lo devuelve como texto al leer, porque la columna es `numeric` de Postgres y
   * el driver la serializa como string para no perder precisión. Esa asimetría
   * la absorbe el cliente: ver `prescription-favorites.client.ts`.
   */
  readonly quantityDecimal?: number;
  /** Unidad de la cantidad, como concepto. */
  readonly unitConceptId?: string;
  /** Indicaciones al paciente, separadas de la posología. */
  readonly patientInstructionsText?: string;
}

/**
 * Cuerpo de `POST /prescription-favorites`.
 *
 * No lleva `practitionerProfileId`: el dueño lo deduce el servidor del vínculo
 * de la sesión. Mandarlo sería, además de inútil, un 400 —el DTO valida con
 * `forbidNonWhitelisted`—.
 */
export interface NewPrescriptionFavorite extends PrescriptionDefaults {
  /**
   * Rótulo con el que el profesional reconoce el favorito en su lista.
   *
   * Entre 1 y 120 caracteres, y **único dentro de la lista propia**: repetirlo
   * responde 409 en vez de pisar el anterior.
   */
  readonly name: string;
}

/** Un favorito ya guardado, tal como lo devuelven `GET` y `POST`. */
export interface PrescriptionFavorite extends PrescriptionDefaults {
  readonly id: string;
  readonly name: string;
}
