/* ============================================================================
    ESPEJO DE LA API (copia, no se edita a mano).

    Este archivo es la copia de `mantra-core-health-api/src/modules/clinical_import/clinical-import.schema.ts`.
    La maqueta valida y genera plantillas con el MISMO código que la API, para
    que lo que se ve en pantalla (vista previa, errores por fila, plantillas
    CSV y JSON) sea lo que dirá la API. Si cambia el esquema en la API, se
    vuelve a copiar; no se corrige acá.
    ========================================================================== */

/* ============================================================================
    Esquema de la carga masiva de historias clínicas: UNA sola fuente.

    La validación del archivo, la plantilla CSV y la plantilla JSON salen de
    este archivo y de ningún otro (regla T1 del plan): por eso la fila de la
    plantilla siempre pasa la validación, y una columna fuera de la plantilla
    se rechaza.

    Cada columna lleva en `source` la entidad y la columna de la API a la que
    va (`clinical.encounters.start_at`…). Nada de lo clínico se inventa:

    - Los códigos clínicos (diagnóstico, medicamento, alérgeno, signo vital,
      estudio, estado…) NO se escriben acá. Cada concepto viaja como PAR
      `<campo>System` + `<campo>Code` y lo resuelve la terminología existente
      (`terminology.catalog_concepts`); un par que no resuelve se rechaza.
    - Los estados históricos que la entidad exige (`ENC_FINISHED`, `OBS_FINAL`,
      tipo de valor `VT_DECIMAL`/`VT_STRING`) los fija el escritor con los
      conceptos que ya existen en `clinical.concepts.ts`; el archivo no los
      trae.

    Los ejemplos son SINTÉTICOS y están declarados como tales: documento
    `SINT-0001`, sistema `sistema-demo`, códigos `SINT-…`. Ninguno existe en la
    terminología: la plantilla pasa la validación de forma, no la resolución.
    ========================================================================== */

export type ColumnType =
  | 'string'
  | 'text'
  | 'date'
  | 'datetime'
  | 'dateOrDatetime'
  | 'decimal';

export interface ColumnSpec {
  readonly name: string;
  readonly type: ColumnType;
  readonly required: boolean;
  readonly description: string;
  readonly example: string;
  /** Entidad y columna de la API a la que va, o quién la usa. */
  readonly source: string;
  /** Largo máximo; por omisión el del tipo. */
  readonly max?: number;
  /** Si es mitad de un concepto: su grupo y qué mitad. */
  readonly concept?: {
    readonly group: string;
    readonly part: 'system' | 'code';
  };
}

export interface KindSpec {
  readonly kind: string;
  readonly version: '1';
  readonly title: string;
  readonly description: string;
  /** Entidad(es) de destino, para la traza. */
  readonly target: string;
  readonly columns: readonly ColumnSpec[];
  /** Reglas entre columnas (ya con todas las columnas individuales válidas). */
  readonly rules: readonly CrossRule[];
}

export interface CrossRule {
  readonly id: string;
  /** Columna a la que se ancla el hallazgo. */
  readonly field: string;
  readonly code: 'FIELD_COMBINATION_INVALID';
  readonly message: string;
  /** `true` si la fila INFRINGE la regla. */
  readonly violated: (values: Readonly<Record<string, string>>) => boolean;
}

export const TEXT_MAX = 2_000;
export const STRING_MAX = 120;
export const DOCUMENT_PATTERN = /^[A-Za-z0-9.-]{4,40}$/;
export const DECIMAL_PATTERN = /^-?\d{1,12}(\.\d{1,6})?$/;

/** Las tres columnas que identifican al paciente y la fila en el origen. Van en todo tipo. */
const PATIENT_REF: readonly ColumnSpec[] = [
  {
    name: 'documentNumber',
    type: 'string',
    required: true,
    description:
      'Documento de identidad del paciente, que ya debe existir (letras, dígitos, punto y guion)',
    example: 'SINT-0001',
    source: 'common.identifiers.value (resolución del paciente)',
    max: 40,
  },
  {
    name: 'birthDate',
    type: 'date',
    required: true,
    description:
      'Fecha de nacimiento AAAA-MM-DD; junto con el documento debe dar un único paciente',
    example: '1990-01-15',
    source: 'profiles.persons.birth_date (resolución del paciente)',
  },
  {
    name: 'sourceRecordId',
    type: 'string',
    required: true,
    description:
      'Identificador del registro en el sistema de origen; la misma clave es el mismo registro',
    example: 'ORIGEN-0001',
    source: 'procedencia y deduplicación (no es columna clínica)',
  },
];

const col = (
  name: string,
  type: ColumnType,
  required: boolean,
  description: string,
  example: string,
  source: string,
  max?: number,
): ColumnSpec => ({
  name,
  type,
  required,
  description,
  example,
  source,
  ...(max === undefined ? {} : { max }),
});

/** Un concepto de terminología: dos columnas, las dos obligatorias o las dos opcionales. */
function concept(
  group: string,
  que: string,
  required: boolean,
  source: string,
): readonly ColumnSpec[] {
  return [
    {
      name: `${group}System`,
      type: 'string',
      required,
      description: `Sistema de codificación de ${que}, tal como figura en la terminología`,
      example: 'sistema-demo',
      source: `${source} (sistema)`,
      concept: { group, part: 'system' },
    },
    {
      name: `${group}Code`,
      type: 'string',
      required,
      description: `Código de ${que} dentro de ese sistema`,
      example: 'SINT-0001',
      source: `${source} (código)`,
      concept: { group, part: 'code' },
    },
  ];
}

const orderedRange = (
  from: string,
  to: string,
  message: string,
  id: string,
): CrossRule => ({
  id,
  field: to,
  code: 'FIELD_COMBINATION_INVALID',
  message,
  violated: (v) => {
    const a = v[from] ?? '';
    const b = v[to] ?? '';
    if (a === '' || b === '') return false;
    return Date.parse(b) < Date.parse(a);
  },
});

const atLeastOne = (
  fields: readonly string[],
  anchor: string,
  message: string,
  id: string,
): CrossRule => ({
  id,
  field: anchor,
  code: 'FIELD_COMBINATION_INVALID',
  message,
  violated: (v) => fields.every((f) => (v[f] ?? '') === ''),
});

export const KIND_SPECS: readonly KindSpec[] = [
  {
    kind: 'hc-encuentro',
    version: '1',
    title: 'Historia clínica · encuentros',
    description: 'Encuentros ya ocurridos de pacientes existentes.',
    target: 'clinical.encounters',
    columns: [
      ...PATIENT_REF,
      col(
        'startAt',
        'datetime',
        true,
        'Inicio del encuentro (ISO 8601 con hora)',
        '2026-01-15T09:00:00Z',
        'clinical.encounters.start_at',
      ),
      col(
        'endAt',
        'datetime',
        false,
        'Fin del encuentro (ISO 8601 con hora)',
        '2026-01-15T09:30:00Z',
        'clinical.encounters.end_at',
      ),
      col(
        'reasonText',
        'text',
        false,
        'Motivo de la consulta, en texto',
        'Texto de ejemplo (sintético)',
        'clinical.encounters.reason_text',
      ),
      ...concept(
        'class',
        'la clase de encuentro',
        false,
        'clinical.encounters.class_concept_id',
      ),
      ...concept(
        'type',
        'el tipo de encuentro',
        false,
        'clinical.encounters.type_concept_id',
      ),
    ],
    rules: [
      orderedRange(
        'startAt',
        'endAt',
        'El fin no puede ser anterior al inicio',
        'END_BEFORE_START',
      ),
    ],
  },
  {
    kind: 'hc-diagnostico',
    version: '1',
    title: 'Historia clínica · diagnósticos',
    description: 'Diagnósticos ya registrados en el sistema de origen.',
    target: 'clinical.conditions',
    columns: [
      ...PATIENT_REF,
      ...concept(
        'condition',
        'el diagnóstico',
        true,
        'clinical.conditions.code_concept_id',
      ),
      ...concept(
        'clinicalStatus',
        'el estado clínico',
        false,
        'clinical.conditions.clinical_status_concept_id',
      ),
      ...concept(
        'verificationStatus',
        'el estado de verificación',
        false,
        'clinical.conditions.verification_status_concept_id',
      ),
      col(
        'onsetAt',
        'dateOrDatetime',
        false,
        'Inicio, AAAA-MM-DD o ISO 8601',
        '2025-06-01',
        'clinical.conditions.onset_at',
      ),
      col(
        'resolvedAt',
        'dateOrDatetime',
        false,
        'Resolución, AAAA-MM-DD o ISO 8601',
        '2025-09-01',
        'clinical.conditions.resolved_at',
      ),
      col(
        'noteText',
        'text',
        false,
        'Observación',
        'Texto de ejemplo (sintético)',
        'clinical.conditions.note_text',
      ),
    ],
    rules: [
      orderedRange(
        'onsetAt',
        'resolvedAt',
        'La resolución no puede ser anterior al inicio',
        'RESOLVED_BEFORE_ONSET',
      ),
    ],
  },
  {
    kind: 'hc-medicacion',
    version: '1',
    title: 'Historia clínica · medicación',
    description: 'Medicación administrada, registrada en el origen.',
    target: 'clinical.medication_records',
    columns: [
      ...PATIENT_REF,
      ...concept(
        'medication',
        'el medicamento',
        true,
        'clinical.medication_records.medication_concept_id',
      ),
      col(
        'doseDecimal',
        'decimal',
        false,
        'Dosis, número con punto decimal',
        '1',
        'clinical.medication_records.dose_decimal',
      ),
      ...concept(
        'unit',
        'la unidad de la dosis',
        false,
        'clinical.medication_records.unit_concept_id',
      ),
      col(
        'administeredAt',
        'datetime',
        false,
        'Cuándo se administró (ISO 8601 con hora)',
        '2026-01-15T09:10:00Z',
        'clinical.medication_records.administered_at',
      ),
    ],
    rules: [],
  },
  {
    kind: 'hc-alergia',
    version: '1',
    title: 'Historia clínica · alergias',
    description: 'Alergias e intolerancias registradas en el origen.',
    target: 'clinical.allergy_intolerances',
    columns: [
      ...PATIENT_REF,
      ...concept(
        'substance',
        'el alérgeno',
        true,
        'clinical.allergy_intolerances.substance_concept_id',
      ),
      ...concept(
        'allergyType',
        'el tipo de reacción',
        false,
        'clinical.allergy_intolerances.type_concept_id',
      ),
      ...concept(
        'category',
        'la categoría',
        false,
        'clinical.allergy_intolerances.category_concept_id',
      ),
      ...concept(
        'criticality',
        'la criticidad',
        false,
        'clinical.allergy_intolerances.criticality_concept_id',
      ),
      ...concept(
        'clinicalStatus',
        'el estado clínico',
        false,
        'clinical.allergy_intolerances.clinical_status_concept_id',
      ),
      ...concept(
        'verificationStatus',
        'el estado de verificación',
        false,
        'clinical.allergy_intolerances.verification_status_concept_id',
      ),
    ],
    rules: [],
  },
  {
    kind: 'hc-signo-vital',
    version: '1',
    title: 'Historia clínica · signos vitales',
    description: 'Mediciones de signos vitales ya tomadas.',
    target: 'clinical.observations',
    columns: [
      ...PATIENT_REF,
      ...concept(
        'vital',
        'el signo vital',
        true,
        'clinical.observations.code_concept_id',
      ),
      col(
        'value',
        'decimal',
        true,
        'Valor medido, número con punto decimal',
        '36.5',
        'clinical.observations.value_decimal / quantity_value',
      ),
      ...concept(
        'unit',
        'la unidad de medida',
        false,
        'clinical.observations.quantity_unit_concept_id',
      ),
      col(
        'effectiveAt',
        'datetime',
        true,
        'Cuándo se midió (ISO 8601 con hora)',
        '2026-01-15T09:05:00Z',
        'clinical.observations.effective_start_at',
      ),
    ],
    rules: [],
  },
  {
    kind: 'hc-resultado',
    version: '1',
    title: 'Historia clínica · resultados',
    description: 'Resultados de estudios ya informados.',
    target: 'clinical.observations',
    columns: [
      ...PATIENT_REF,
      ...concept(
        'study',
        'el estudio',
        true,
        'clinical.observations.code_concept_id',
      ),
      col(
        'valueDecimal',
        'decimal',
        false,
        'Resultado numérico',
        '5.2',
        'clinical.observations.value_decimal / quantity_value',
      ),
      col(
        'valueText',
        'text',
        false,
        'Resultado en texto',
        'Texto de ejemplo (sintético)',
        'clinical.observations.value_text',
      ),
      ...concept(
        'unit',
        'la unidad del resultado',
        false,
        'clinical.observations.quantity_unit_concept_id',
      ),
      col(
        'rangeLow',
        'decimal',
        false,
        'Límite inferior del rango de referencia',
        '3.5',
        'clinical.observations.range_low_value',
      ),
      col(
        'rangeHigh',
        'decimal',
        false,
        'Límite superior del rango de referencia',
        '6.0',
        'clinical.observations.range_high_value',
      ),
      ...concept(
        'interpretation',
        'la interpretación',
        false,
        'clinical.observations.interpretation_concept_id',
      ),
      col(
        'effectiveAt',
        'datetime',
        true,
        'Fecha del resultado (ISO 8601 con hora)',
        '2026-01-15T09:00:00Z',
        'clinical.observations.effective_start_at',
      ),
      col(
        'issuedAt',
        'datetime',
        false,
        'Cuándo se informó (ISO 8601 con hora)',
        '2026-01-15T12:00:00Z',
        'clinical.observations.issued_at',
      ),
    ],
    rules: [
      atLeastOne(
        ['valueDecimal', 'valueText'],
        'valueDecimal',
        'Falta el resultado: numérico o en texto',
        'RESULT_WITHOUT_VALUE',
      ),
      {
        id: 'RANGE_INVERTED',
        field: 'rangeHigh',
        code: 'FIELD_COMBINATION_INVALID',
        message: 'El límite superior no puede ser menor que el inferior',
        violated: (v) =>
          (v['rangeLow'] ?? '') !== '' &&
          (v['rangeHigh'] ?? '') !== '' &&
          Number(v['rangeHigh']) < Number(v['rangeLow']),
      },
    ],
  },
  {
    kind: 'hc-nota',
    version: '1',
    title: 'Historia clínica · notas',
    description: 'Notas clínicas de profesionales ya registradas.',
    target: 'chart.clinical_note_headers + chart.clinical_note_versions',
    columns: [
      ...PATIENT_REF,
      ...concept(
        'noteType',
        'el tipo de nota',
        true,
        'chart.clinical_note_headers.note_type_concept_id',
      ),
      col(
        'authorLicenseNumber',
        'string',
        true,
        'Matrícula de quien firmó la nota',
        'MAT-SINT-01',
        'profiles.jurisdiction_authorizations.license_number → chart.clinical_note_versions.author_profile_id',
        40,
      ),
      col(
        'chiefComplaintText',
        'text',
        false,
        'Motivo de consulta',
        'Texto de ejemplo (sintético)',
        'chart.clinical_note_versions.chief_complaint_text',
      ),
      col(
        'subjectiveText',
        'text',
        false,
        'Subjetivo',
        'Texto de ejemplo (sintético)',
        'chart.clinical_note_versions.subjective_text',
      ),
      col(
        'objectiveText',
        'text',
        false,
        'Objetivo',
        'Texto de ejemplo (sintético)',
        'chart.clinical_note_versions.objective_text',
      ),
      col(
        'assessmentText',
        'text',
        false,
        'Evaluación',
        'Texto de ejemplo (sintético)',
        'chart.clinical_note_versions.assessment_text',
      ),
      col(
        'planText',
        'text',
        false,
        'Plan',
        'Texto de ejemplo (sintético)',
        'chart.clinical_note_versions.plan_text',
      ),
      col(
        'recordedAt',
        'datetime',
        true,
        'Cuándo se escribió (ISO 8601 con hora)',
        '2026-01-15T09:40:00Z',
        'chart.clinical_note_versions.recorded_at',
      ),
    ],
    rules: [
      atLeastOne(
        [
          'chiefComplaintText',
          'subjectiveText',
          'objectiveText',
          'assessmentText',
          'planText',
        ],
        'subjectiveText',
        'La nota no trae ninguna sección con texto',
        'NOTE_WITHOUT_TEXT',
      ),
    ],
  },
];

export function kindSpec(kind: string): KindSpec | undefined {
  return KIND_SPECS.find((k) => k.kind === kind);
}

/** Los grupos de concepto de un tipo, con si son obligatorios. */
export function conceptGroups(
  spec: KindSpec,
): readonly {
  group: string;
  required: boolean;
  systemField: string;
  codeField: string;
}[] {
  const groups = new Map<
    string,
    { group: string; required: boolean; systemField: string; codeField: string }
  >();
  for (const c of spec.columns) {
    if (c.concept === undefined) continue;
    const actual = groups.get(c.concept.group) ?? {
      group: c.concept.group,
      required: c.required,
      systemField: '',
      codeField: '',
    };
    groups.set(c.concept.group, {
      ...actual,
      ...(c.concept.part === 'system'
        ? { systemField: c.name }
        : { codeField: c.name }),
    });
  }
  return [...groups.values()];
}

/** Las columnas de contenido: lo que no es paciente, ni procedencia, ni concepto, ni matrícula. */
export const NON_CONTENT_COLUMNS: ReadonlySet<string> = new Set([
  'documentNumber',
  'birthDate',
  'sourceRecordId',
  'authorLicenseNumber',
]);
