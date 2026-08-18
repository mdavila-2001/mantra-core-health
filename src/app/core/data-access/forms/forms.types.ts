/** Tipos de la vista para `forms`. Se mapean desde los DTOs, no son ellos. */

/** Cuerpo de `POST /forms/instances` (UC-09-07). */
export interface OpenFormInstanceInput {
  /** Recurso al que se adjunta el formulario — acá, el encuentro activo. */
  readonly resourceId: string;
  /** Tipo de recurso (concept id). Sin especificar, el backend asume paciente. */
  readonly resourceTypeConceptId?: string;
  readonly tenantContextId?: string;
  /** Versión de schema explícita; por defecto 1. */
  readonly schemaVersion?: number;
}

/** Respuesta de `POST /forms/instances`. */
export interface FormInstance {
  readonly id: string;
  readonly schemaVersion: number;
  /** Concept id del estado de la instancia. */
  readonly state: string;
}

/** Un valor capturado para un campo del formulario (UC-09-08). */
export interface FieldValueInput {
  readonly fieldId: string;
  readonly dataType: string;
  /** Valor tipado; el backend lo persiste en la columna `value_*` que corresponde. */
  readonly value: unknown;
  /** Asignación que autoriza el campo — la de {@link ChartTemplateField}. */
  readonly assignmentId?: string;
  readonly unitConceptId?: string;
  readonly ordinal?: number;
}

/** Una instancia tal como aparece en `GET /forms/instances?encounter=`. */
export interface FormInstanceListItem {
  readonly id: string;
  /** El recurso al que se adjuntó — acá, el encuentro. */
  readonly resourceId: string;
  readonly resourceTypeConceptId: string;
  readonly schemaVersion: number;
  /** Concept id del estado de la instancia, si lo tiene. */
  readonly stateConceptId?: string;
  /** ISO; presente cuando la instancia ya se cerró. */
  readonly closedAt?: string;
  /** ISO. */
  readonly createdAt: string;
}

/** Respuesta de `GET /forms/instances?encounter=`. */
export interface FormInstanceList {
  readonly encounterId: string;
  readonly items: readonly FormInstanceListItem[];
  /** Tope aplicado al listado. */
  readonly limit: number;
  /** true si quedaron instancias fuera del tope. */
  readonly truncated: boolean;
}

/**
 * Un valor vigente de la instancia (`GET /forms/instances/:id`).
 *
 * `masked: true` significa que el campo tiene una regla de acceso que el
 * backend hoy no puede evaluar y responde **sin el valor** (deny-by-default):
 * `value` llega `null` y la pantalla muestra un marcador, nunca un hueco.
 */
export interface FormFieldValue {
  readonly id: string;
  readonly fieldId: string;
  /** Tipo técnico del campo, si su definición sigue existiendo. */
  readonly dataType?: string;
  /**
   * El valor único, resuelto de la columna `value[x]` por el backend. Ojo:
   * `integer` llega como string (bigint) y las fechas como ISO.
   */
  readonly value: unknown;
  readonly unitConceptId?: string;
  readonly valueStatusConceptId?: string;
  readonly valueVersion?: number;
  readonly ordinal: number;
  /** ISO, si el valor declara vigencia. */
  readonly effectiveFrom?: string;
  readonly masked: boolean;
}

/** Respuesta de `GET /forms/instances/:id`: la instancia con sus valores. */
export interface FormInstanceDetail extends FormInstanceListItem {
  readonly values: readonly FormFieldValue[];
}
