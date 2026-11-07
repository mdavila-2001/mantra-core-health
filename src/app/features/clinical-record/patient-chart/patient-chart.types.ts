/**
 * Types shared by the chart blocks. They live apart from the blocks so that
 * a block, a dialog or the consent helpers can name them without importing
 * another block's component module (which closed import cycles).
 */

/**
 * Una cita del paciente.
 *
 * Vestigio del formulario de alta que este bloque tenía (ver «Sólo la tabla»
 * en `diagnosis-block.ts`): el input `citas` sigue existiendo porque los tres anfitriones
 * (`patient-chart`, `consultation`, `specialty-form-block`) se lo siguen
 * pasando, pero el bloque ya no lo usa para nada.
 */
export interface CitaDelPaciente {
  readonly id: string;
  readonly etiqueta: string;
  readonly enCurso: boolean;
}

/**
 * Un diagnóstico de la persona, ya traducido, para elegirlo como indicación.
 *
 * Baja del expediente hecho —`id` y palabras— por lo mismo que las recetas: acá
 * no hay mapa de etiquetas ni petición de terminología que valga la pena
 * duplicar, y la lista ya está cargada del otro lado.
 */
export interface DiagnosisOption {
  /** El `clinical.conditions.id`, que es lo que viaja como indicación. */
  readonly id: string;
  /** El diagnóstico en palabras. Nunca el uuid del concepto. */
  readonly etiqueta: string;
  /**
   * Si el diagnóstico está **confirmado**. La receta sólo se liga a uno
   * confirmado (pedido literal del propietario, C5) — ver
   * `opcionesDeIndicacion()`. Lo arma {@link diagnosticoParaReceta}.
   */
  readonly confirmado?: boolean;
  /**
   * Cuándo se confirmó, si se sabe: la fecha de la decisión de C3
   * (`verification.decidedAt`). `null` cuando el diagnóstico está confirmado
   * pero no hay registro de esa decisión —los de la semilla, o los cargados
   * ya confirmados—: es un confirmado sin fecha, no un presuntivo.
   */
  readonly confirmadoEl?: string | null;
  /** Ruled out (REFUTED): not offered as a link for anything (clinical network, v4291). */
  readonly descartado?: boolean;
}
