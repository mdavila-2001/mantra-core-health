/** Tipos de la vista para `chart` · plantillas por especialidad. */

/** Un campo del esquema, al crear una plantilla (`POST /charts/templates`). */
export interface TemplateFieldInput {
  readonly code: string;
  readonly name: string;
  readonly dataType: string;
  /** Value set de valores permitidos, para campos de selección. */
  readonly valueSetId?: string;
  readonly required?: boolean;
  readonly ordinal?: number;
}

/** Cuerpo de `POST /charts/templates`. */
export interface CreateChartTemplateInput {
  readonly specialtyConceptId: string;
  /** Tenant dueño de la plantilla; ausente = plantilla disponible en cualquier tenant. */
  readonly tenantId?: string;
  readonly code: string;
  readonly name: string;
  readonly fields: readonly TemplateFieldInput[];
}

/** Un campo ya persistido de una plantilla, tal como lo devuelve la API. */
export interface ChartTemplateField {
  /** Id de `forms.field_assignments` — autoriza el campo al capturar valores. */
  readonly assignmentId: string;
  /** Id de `forms.dynamic_field_definitions`. */
  readonly fieldId: string;
  readonly code: string;
  readonly name: string;
  readonly dataType: string;
  readonly valueSetId?: string;
  readonly required: boolean;
  readonly ordinal?: number;
  /**
   * Si el campo lo agregó esta organización, o viene del formulario estándar.
   *
   * El generador lo necesita para dos cosas que no puede adivinar: qué campos
   * puede tocar —los del estándar no— y cuáles cuentan contra su presupuesto.
   */
  readonly own: boolean;
}

/**
 * De dónde salió una plantilla del catálogo de formularios estándar.
 *
 * Muchos formularios clínicos estándar tienen derechos de autor: algunos son de
 * uso libre y citable, otros son propiedad de sociedades científicas o
 * editoriales y no se pueden incorporar a un producto comercial sin licencia,
 * aunque el PDF se baje gratis. Por eso la procedencia se muestra junto al
 * formulario, en pantalla, y no queda en una nota de un chat.
 *
 * Ausente en las plantillas que un admin arma a mano: sólo la traen las del
 * catálogo sembrado.
 */
export interface ChartTemplateProvenance {
  /** Título del documento tal como lo publica el organismo. */
  readonly sourceTitle: string;
  /** Organismo que lo publica. */
  readonly organization: string;
  /** URL de la que se descargó. */
  readonly url: string;
  /** Licencia bajo la que se puede usar. */
  readonly license: string;
  /** Versión o edición del documento de origen. */
  readonly sourceVersion?: string;
  /** Fecha de descarga, en ISO `YYYY-MM-DD`. */
  readonly retrievedAt: string;
  /** Qué se transcribió y qué quedó afuera, cuando no es obvio. */
  readonly note?: string;
}

/** Una plantilla de chart por especialidad, con su esquema de campos. */
export interface ChartTemplate {
  readonly id: string;
  readonly specialtyConceptId: string;
  readonly tenantId?: string;
  readonly code: string;
  readonly name: string;
  readonly version: number;
  /** Concept id del estado de la plantilla. */
  readonly statusConceptId: string;
  /**
   * Sección que aloja los campos. Colgar un campo propio **dentro** de la
   * plantilla exige nombrarla: una asignación en otra sección existe y no la
   * dibuja nadie.
   */
  readonly sectionId?: string;
  /** Target de las asignaciones de campo, para pedir presupuesto y asignar. */
  readonly fieldTargetConceptId: string;
  readonly fields: readonly ChartTemplateField[];
  /** De dónde salió, si vino del catálogo de formularios estándar. */
  readonly provenance?: ChartTemplateProvenance;
}

/** Cuerpo de `POST /charts/templates/:id/assignments` (UC-15-12). */
export interface AssignTemplateInput {
  /** Práctica destino. Ausente: alcance de toda la organización. */
  readonly practiceId?: string;
  /** Perfil profesional destino. Ausente: alcance de toda la organización. */
  readonly practitionerProfileId?: string;
  /** Marca la asignación como la predeterminada de su alcance. */
  readonly isDefault?: boolean;
}

/** Respuesta de `POST /charts/templates/:id/assignments`. */
export interface ChartTemplateAssignment {
  readonly id: string;
  readonly templateId: string;
  readonly isDefault: boolean;
  /** Concept id del estado de la asignación. */
  readonly statusConceptId: string;
}
