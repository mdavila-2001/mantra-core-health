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
   * Las respuestas ofrecidas, cuando el campo es de elección (`dataType`
   * `code`).
   *
   * Texto libre y no un `valueSetId`: un value set es del catálogo de
   * terminología y lo arma un administrador, y lo que se pidió acá es que el
   * doctor escriba sus propias opciones —«Nunca / Ex fumador / Fumador»— sin
   * pedirle nada a nadie. Los campos del estándar sí pueden traer `valueSetId`;
   * los propios traen esto.
   *
   * **El backend real todavía no lo persiste.** Ver
   * `docs/pendientes-backend-formularios.md`.
   */
  readonly options?: readonly string[];
  /**
   * Si un campo de elección admite varias respuestas.
   *
   * Es lo que separa «Opción múltiple» —una sola, círculos— de «Casillas de
   * verificación» —varias, cuadrados—, que en Google Forms son dos tipos
   * distintos y acá son el mismo `dataType` con distinta cardinalidad.
   */
  readonly multiple?: boolean;
  /**
   * La ayuda que se lee debajo de la pregunta cuando el rótulo no alcanza.
   *
   * Es la «Descripción» de una pregunta de Google Forms: «Contá desde el último
   * cigarrillo», «En ayunas». Se sirve como `hint` del campo, así que además de
   * verse viaja en el `aria-describedby` del control.
   */
  readonly description?: string;
  /**
   * Si un campo de elección ofrece además «Otro», con un texto libre.
   *
   * Es la salida para la respuesta que la lista no previó. Lo que se guarda es
   * el texto escrito, no un código «otro»: es lo que después se lee en la ficha.
   */
  readonly allowOther?: boolean;
  /**
   * Cuántas respuestas hay que marcar, como mínimo, en un campo de varias.
   *
   * Sólo tiene sentido con `multiple`. Con `cardinalityMin === cardinalityMax`
   * se pide una cantidad exacta. Son las tres reglas de «validación de
   * respuesta» de las casillas de Google Forms: al menos, como máximo,
   * exactamente.
   */
  readonly cardinalityMin?: number;
  /** Cuántas respuestas se pueden marcar, como máximo. Ver {@link cardinalityMin}. */
  readonly cardinalityMax?: number;
  /**
   * Las **filas** de una cuadrícula, cuando la pregunta se repite sobre varios
   * sujetos.
   *
   * Tenerlas es lo que convierte un campo de elección en una cuadrícula: las
   * {@link options} pasan a ser las **columnas** —las respuestas que cada fila
   * elige— y esto son las filas. No hay un `dataType` propio ni un interruptor
   * aparte: el dato guardado sigue siendo uno de los códigos ofrecidos, igual
   * que en cualquier campo `code`.
   *
   * Con {@link multiple} en falso es la «Cuadrícula de opción única» —una
   * respuesta por fila—; en verdadero, la «Cuadrícula de casillas».
   *
   * **El backend real todavía no lo persiste.** Ver
   * `docs/pendientes-backend-formularios.md`.
   */
  readonly rows?: readonly string[];
  /**
   * Cuadrículas: si hay que responder **todas** las filas.
   *
   * Es la restricción «Requerir una respuesta en cada fila». No es lo mismo que
   * {@link required}, que sólo exige que la pregunta tenga alguna respuesta:
   * una cuadrícula obligatoria con una sola fila contestada ya cumple
   * `required`, y con esto no.
   */
  readonly requireEachRow?: boolean;
  /**
   * Cuadrículas: si una columna sólo puede usarse en **una** fila.
   *
   * Es la restricción «Limitar a una respuesta por columna», la que sirve para
   * ordenar sin empates. Con ella puesta, una columna ya elegida deja de
   * ofrecerse en las demás filas.
   */
  readonly oneResponsePerColumn?: boolean;
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
