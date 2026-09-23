/* ============================================================================
    El plan de cuidados: qué se va a hacer con esta persona, y cuándo.

    No es una nota ni una receta. Una nota cuenta lo que pasó; una receta indica
    un medicamento. El plan declara un **objetivo** —«presión por debajo de
    130/80 en seis meses»— y las actividades con las que se llega. Por eso su
    alta pide una meta escrita y una lista de pasos, y no un campo de texto.
   ========================================================================== */

/**
 * Una actividad inicial del plan (UC-15-10).
 *
 * Las tres son opcionales en el DTO. La pantalla exige el detalle: una
 * actividad sin decir qué hay que hacer no es un paso del plan, es una fila.
 */
export interface NewCarePlanActivity {
  /** Qué clase de actividad es, como concepto del catálogo. */
  readonly activityConceptId?: string;
  /** Cuándo está programada. */
  readonly scheduledAt?: Date;
  /** Qué hay que hacer, en palabras. */
  readonly detailText?: string;
}

/**
 * Lo que hace falta para abrir un plan de cuidados (`POST /charts/care-plans`).
 *
 * Sólo `patientProfileId` es obligatorio en el contrato. Que la meta y las
 * actividades sean opcionales del lado del servidor no las vuelve opcionales
 * para quien lo escribe: un plan sin objetivo ni pasos es un registro vacío que
 * después nadie sabe para qué se creó, así que el formulario pide la meta.
 */
export interface NewCarePlan {
  readonly patientProfileId: string;
  /** El diagnóstico que motiva el plan, si cuelga de uno. */
  readonly conditionId?: string;
  /** La consulta en la que se acordó, si nace dentro de una. */
  readonly encounterId?: string;
  /** La intención del plan —propuesta, plan, orden— como concepto. */
  readonly intentConceptId?: string;
  /** Quién lo escribe. */
  readonly authorProfileId?: string;
  /** La meta clínica, en palabras. */
  readonly goalText?: string;
  /** Desde cuándo corre. Viaja como `YYYY-MM-DD`: el contrato pide fecha, no instante. */
  readonly startDate?: Date;
  /** Hasta cuándo. Mismo formato que {@link startDate}. */
  readonly endDate?: Date;
  /** Los pasos con los que se llega a la meta. */
  readonly activities?: readonly NewCarePlanActivity[];
}

/** El plan recién abierto, tal como lo devuelve el servidor. */
export interface CarePlanRegistration {
  readonly id: string;
  readonly statusConceptId: string;
  /** Cuántas actividades quedaron creadas. Es lo que confirma que la lista entró. */
  readonly activityCount: number;
  readonly createdAt: Date;
}
