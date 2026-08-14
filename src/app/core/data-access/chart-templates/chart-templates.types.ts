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
  readonly fields: readonly ChartTemplateField[];
}
