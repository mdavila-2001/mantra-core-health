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
   * Nombre legible del campo, si su definición sigue existiendo. Es la
   * etiqueta con que una pantalla sin acceso a las plantillas de chart —el
   * archivo del paciente— re-pinta el valor.
   */
  readonly fieldName?: string;
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

/**
 * Respuesta de `GET /forms/me/instances`: los formularios del paciente de la
 * sesión, de todos sus encuentros del tenant activo. Sin `encounterId`: acá no
 * se filtra por un encuentro elegido sino por la titularidad de la sesión.
 */
export interface MyFormInstanceList {
  readonly items: readonly FormInstanceListItem[];
  /** Tope aplicado al listado. */
  readonly limit: number;
  /** true si quedaron instancias fuera del tope. */
  readonly truncated: boolean;
}

/* ============================================================================
   Generador de formularios — lo que un doctor agrega a un formulario estándar
   ========================================================================== */

/**
 * Los tipos de dato que declara `terminology.technical_data_type`.
 *
 * Es el catálogo entero del backend; qué subconjunto ofrece cada pantalla es
 * decisión suya. El generador ofrece menos, por el mismo motivo que el editor
 * de plantillas: los que piden un dato extra —un target de referencia, un
 * archivo, un concepto del catálogo— dejarían un campo que el backend rechaza
 * al completarse.
 */
export type TechnicalDataType =
  | 'string'
  | 'text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'uuid'
  | 'json'
  | 'binary'
  | 'reference'
  | 'code';

/** Cuerpo de `POST /forms/field-definitions` (UC-09-02). */
export interface CreateFieldDefinitionInput {
  /** Código único del campo en toda la instalación, no sólo en el formulario. */
  readonly code: string;
  readonly name: string;
  readonly dataType: TechnicalDataType;
  readonly cardinalityMin?: number;
  readonly cardinalityMax?: number;
  readonly regex?: string;
  /**
   * Las respuestas ofrecidas, para un campo `code`.
   *
   * Texto libre y no un `valueSetId`: ver {@link ChartTemplateField.options}.
   * **El backend real todavía no acepta esta clave** — ver
   * `docs/pendientes-backend-formularios.md`.
   */
  readonly options?: readonly string[];
  /** Si el campo de elección admite varias respuestas. */
  readonly multiple?: boolean;
  /** La ayuda bajo la pregunta. Ver {@link ChartTemplateField.description}. */
  readonly description?: string;
  /** Si ofrece «Otro» con texto libre. Ver {@link ChartTemplateField.allowOther}. */
  readonly allowOther?: boolean;
}

/** Cuerpo de `POST /forms/assignments` (UC-09-06). */
export interface CreateAssignmentInput {
  readonly fieldId: string;
  readonly targetResourceConceptId: string;
  /** Sección destino; sin ella el backend aprovisiona una suelta. */
  readonly sectionId?: string;
  readonly required?: boolean;
  readonly visible?: boolean;
  readonly editable?: boolean;
  readonly ordinal?: number;
}

/**
 * Respuesta de `GET /forms/assignments/budget`.
 *
 * `maximumFields` y `remaining` faltan cuando la política no declara tope. No
 * es lo mismo que cero, y la pantalla tiene que decir cosas distintas.
 */
export interface ExtensionBudget {
  readonly targetResourceConceptId: string;
  /** Si la política deja a la organización colgar campos propios. */
  readonly allowTenantFields: boolean;
  readonly maximumFields?: number;
  readonly used: number;
  readonly remaining?: number;
}

/**
 * Cambios sobre la definición de un campo propio.
 *
 * Todo opcional: se manda sólo lo que cambió. La definición es global, así que
 * esto afecta al campo en todos los formularios donde esté colgado.
 */
export interface UpdateFieldDefinitionInput {
  readonly name?: string;
  readonly dataType?: TechnicalDataType;
  /**
   * Las opciones, **enteras**.
   *
   * No hay edición parcial de una opción suelta, por lo mismo que en
   * `surveys`: el orden importa y un parche por índice se rompe en cuanto
   * alguien inserta una en el medio.
   */
  readonly options?: readonly string[];
  /** Si el campo de elección admite varias respuestas. */
  readonly multiple?: boolean;
  /** La ayuda bajo la pregunta; `null` la quita. */
  readonly description?: string | null;
  /** Si ofrece «Otro» con texto libre. */
  readonly allowOther?: boolean;
  /**
   * Cuántas respuestas hay que marcar como mínimo / máximo, en un campo de
   * varias. `null` quita el tope. Ver {@link ChartTemplateField.cardinalityMin}.
   */
  readonly cardinalityMin?: number | null;
  readonly cardinalityMax?: number | null;
}

/**
 * Cambios sobre la asignación de un campo a un formulario.
 *
 * Lo obligatorio vive acá y no en la definición: el mismo campo puede ser
 * obligatorio en un formulario y opcional en otro.
 */
export interface UpdateAssignmentInput {
  readonly required?: boolean;
}
