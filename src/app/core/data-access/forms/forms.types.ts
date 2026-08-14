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
