import {
  ACTIVIDAD_DEL_PLAN,
  CATEGORIA_ALERGIA,
  CATEGORIA_DOCUMENTAL,
  CATEGORIA_ORDEN,
  CLASE_ENCUENTRO,
  CRITICIDAD,
  DIAGNOSTICO,
  ESTADO,
  ESTADO_CONDICION,
  ESTADO_ENCUENTRO,
  ESTADO_RECETA,
  ESTUDIO,
  INTENCION_DEL_PLAN,
  MEDICAMENTO,
  OBSERVACION,
  PRIORIDAD,
  SEVERIDAD,
  UNIDAD,
  VERIFICACION_DX,
} from './conceptos';
import { MEDICA, PACIENTES, PROFESIONALES, type PacienteSimulado } from './personas';
import { TENANT_CLINICA } from '../mock-session';
import { Coleccion, iso, isoDia, uuid } from '../mock-store';

/* ============================================================================
    El expediente clínico de cada paciente: condiciones, alergias, recetas,
    observaciones, encuentros, episodios, notas, planes y documentos. Se
    genera por paciente de forma determinística, así que un expediente
    siempre se ve igual entre recargas.
    ========================================================================== */

/**
 * La evidencia que respalda una decisión sobre un presuntivo (C3, P41): una
 * nota del expediente o un análisis —la orden y, si existe, su informe—.
 */
export interface EvidenciaSimulada {
  readonly kind: 'NOTE' | 'ANALYSIS';
  readonly noteId?: string;
  readonly encounterId?: string;
  readonly serviceRequestId?: string;
  readonly diagnosticReportId?: string;
}

/** La decisión de C3 sobre un presuntivo, con sus instantes en ISO. */
export interface VerificacionSimulada {
  readonly outcome: 'CONFIRMED' | 'REFUTED';
  readonly decidedAt: string;
  readonly decidedByProfileId: string;
  readonly reasonText: string | null;
  readonly basedOn: EvidenciaSimulada | null;
}

export interface CondicionSimulada {
  readonly id: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
  readonly clinicalStatusConceptId: string;
  readonly verificationStatusConceptId: string;
  /** Sólo después de confirmar o rechazar (C3). Un presuntivo no la tiene. */
  readonly verification?: VerificacionSimulada;
  readonly severityConceptId: string;
  readonly lateralityConceptId?: string;
  /** Curso clínico: agudo, crónico, subagudo, recurrente (Patch v4.0.8). */
  readonly clinicalCourseConceptId?: string;
  readonly encounterId?: string;
  readonly onsetAt: string;
  /** Fecha esperada de resolución. Sólo tiene sentido en curso agudo o subagudo. */
  readonly expectedResolutionAt?: string;
  readonly resolvedAt?: string;
  readonly noteText: string;
  readonly createdAt: string;
}

export interface AlergiaSimulada {
  readonly id: string;
  readonly patientProfileId: string;
  readonly substanceConceptId: string;
  readonly typeConceptId: string;
  readonly categoryConceptId: string;
  readonly criticalityConceptId: string;
  readonly clinicalStatusConceptId: string;
  /**
   * La consulta en la que se detectó.
   *
   * ⚠️ **La columna no existe en el backend**: `allergy_intolerances` no tiene
   * `encounter_id` ni el DTO lo acepta. Ver P26.
   */
  readonly encounterId?: string;
  /** Qué le pasó a la persona. Al menos una manifestación por reacción. */
  readonly reactions?: readonly {
    readonly id: string;
    readonly manifestationConceptId: string;
    readonly severityConceptId?: string;
    readonly description?: string;
  }[];
  readonly createdAt: string;
}

export interface RecetaSimulada {
  readonly id: string;
  readonly patientProfileId: string;
  readonly medicationConceptId: string;
  /** La consulta en la que se prescribió, si nació de una. */
  readonly encounterId?: string;
  /** El diagnóstico que la motiva (v4.1.6). */
  readonly indicationConditionId?: string;
  /** El motivo escrito a mano, cuando no hay diagnóstico detrás. Ver P24. */
  readonly indicationText?: string;
  readonly statusConceptId: string;
  readonly prescriberProfileId: string;
  readonly doseText: string;
  readonly frequencyText: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly patientInstructionsText: string;
  readonly signedAt: string | null;
  readonly issuedAt: string | null;
  readonly createdAt: string;
}

export interface ObservacionSimulada {
  readonly id: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly statusConceptId: string;
  readonly valueDecimal: string;
  readonly quantityValue: string;
  readonly quantityUnitConceptId: string;
  readonly effectiveStartAt: string;
  readonly encounterId?: string;
  /** Cómo se lee el valor. Opcional: el fixture no la trae y el alta sí. */
  readonly interpretationConceptId?: string;
  /** De dónde sale la medición: signos vitales, laboratorio, examen físico. */
  readonly categoryConceptId?: string;
  /** UC-08-04: sube con cada enmienda; los sembrados nacen en 1. */
  readonly rowVersion?: number;
}

export interface EncuentroSimulado {
  readonly id: string;
  readonly patientProfileId: string;
  readonly episodeId?: string;
  readonly statusConceptId: string;
  readonly classConceptId: string;
  readonly primaryPractitionerId: string;
  readonly reasonText: string;
  readonly startAt: string;
  readonly endAt: string | null;
  /** BR-14/CL-16: bloqueo optimista; los sembrados nacen en 1. */
  readonly rowVersion?: number;
}

/** Una fila de la nota médica: el campo y lo que vale, como lo escribió la médica. */
export interface FilaDeNotaSimulada {
  readonly label: string;
  readonly value: string;
}

export interface NotaSimulada {
  readonly id: string;
  readonly noteId: string;
  readonly patientProfileId: string;
  readonly encounterId?: string;
  readonly noteTypeConceptId: string;
  readonly lifecycleStatusConceptId: string;
  readonly currentVersionId: string;
  readonly versionNumber: number;
  readonly authorProfileId: string;
  /**
   * Las filas campo/valor de C1 (P39). Las notas viejas —las SOAP de antes del
   * 25/09/2026— no las tienen y traen su texto en los cinco apartados.
   */
  readonly entries?: readonly FilaDeNotaSimulada[];
  readonly chiefComplaintText: string;
  readonly subjectiveText: string;
  readonly objectiveText: string;
  readonly assessmentText: string;
  readonly planText: string;
  readonly signedAt: string | null;
  readonly releasedToPatient: boolean;
  readonly createdAt: string;
}

export const NOTA_TIPO_EVOLUCION = uuid('concept-note-type-evolution');
export const CATEGORIA_DX = uuid('concept-condition-category-problem-list');
export const TIPO_ALERGIA = uuid('concept-allergy-type-allergy');
export const TIPO_EPISODIO = uuid('concept-episode-type-inpatient');
/**
 * La categoría documental por omisión de la maqueta.
 *
 * Apunta al concepto **del conjunto publicado** (`VS_DOCUMENT_CATEGORY`) y no a
 * un uuid acuñado aparte: el documento registrado desde el expediente muestra su
 * categoría en palabras, y un identificador que no está en ningún conjunto se
 * leía como «Sin registrar».
 */
export const CATEGORIA_DOCUMENTO = CATEGORIA_DOCUMENTAL['DOC-CAT-REPORT']!;

const PERFILES_CLINICOS: readonly {
  readonly dx: readonly (readonly [
    keyof typeof DIAGNOSTICO,
    'COND-ACTIVE' | 'COND-RESOLVED' | 'COND-REMISSION',
    string,
  ])[];
  readonly alergias: readonly (readonly [
    keyof typeof MEDICAMENTO | 'ALIMENTO-MANI' | 'POLVO',
    'CRIT-LOW' | 'CRIT-HIGH',
  ])[];
  readonly recetas: readonly (readonly [
    keyof typeof MEDICAMENTO,
    string,
    string,
    'RX-ACTIVE' | 'RX-COMPLETED',
  ])[];
}[] = [
  {
    dx: [
      ['I10', 'COND-ACTIVE', 'Diagnosticada hace 3 años. Buen control con enalapril.'],
      ['E78.5', 'COND-ACTIVE', 'LDL 165 en el último control.'],
      ['J06.9', 'COND-RESOLVED', 'Cuadro viral autolimitado.'],
    ],
    alergias: [
      ['MED-AMOXICILINA', 'CRIT-HIGH'],
      ['POLVO', 'CRIT-LOW'],
    ],
    recetas: [
      ['MED-ENALAPRIL', '10 mg', 'Una vez al día por la mañana', 'RX-ACTIVE'],
      ['MED-ATORVASTATINA', '20 mg', 'Una vez al día por la noche', 'RX-ACTIVE'],
      ['MED-PARACETAMOL', '500 mg', 'Cada 8 horas si hay dolor, máximo 3 días', 'RX-COMPLETED'],
    ],
  },
  {
    dx: [
      ['E11', 'COND-ACTIVE', 'HbA1c 7,8 %. Se ajusta metformina.'],
      ['I10', 'COND-ACTIVE', 'Asociada a la diabetes.'],
      ['E66', 'COND-ACTIVE', 'IMC 31.'],
    ],
    alergias: [],
    recetas: [
      ['MED-METFORMINA', '850 mg', 'Con el desayuno y la cena', 'RX-ACTIVE'],
      ['MED-LOSARTAN', '50 mg', 'Una vez al día', 'RX-ACTIVE'],
    ],
  },
  {
    dx: [
      ['J45', 'COND-ACTIVE', 'Asma leve persistente, controlada.'],
      ['L20', 'COND-REMISSION', 'Brotes en invierno.'],
    ],
    alergias: [['ALIMENTO-MANI', 'CRIT-HIGH']],
    recetas: [
      ['MED-SALBUTAMOL', '100 mcg', 'Dos inhalaciones a demanda', 'RX-ACTIVE'],
      ['MED-LORATADINA', '10 mg', 'Una vez al día en época de polen', 'RX-COMPLETED'],
    ],
  },
  {
    dx: [['J06.9', 'COND-RESOLVED', 'Resfrío común.']],
    alergias: [],
    recetas: [['MED-PARACETAMOL', '250 mg', 'Cada 8 horas por 3 días', 'RX-COMPLETED']],
  },
  {
    dx: [
      ['E03.9', 'COND-ACTIVE', 'TSH 8,2. Inicia levotiroxina.'],
      ['D50', 'COND-ACTIVE', 'Hemoglobina 10,4.'],
    ],
    alergias: [['MED-IBUPROFENO', 'CRIT-LOW']],
    recetas: [
      ['MED-LEVOTIROXINA', '50 mcg', 'En ayunas, 30 minutos antes del desayuno', 'RX-ACTIVE'],
      ['MED-SULFATO-FERROSO', '300 mg', 'Una vez al día con jugo de naranja', 'RX-ACTIVE'],
    ],
  },
  {
    dx: [
      ['M54.5', 'COND-ACTIVE', 'Lumbalgia mecánica por postura laboral.'],
      ['G43', 'COND-ACTIVE', 'Migraña sin aura, 2 episodios al mes.'],
    ],
    alergias: [],
    recetas: [['MED-IBUPROFENO', '400 mg', 'Cada 8 horas con comida, 5 días', 'RX-ACTIVE']],
  },
  {
    dx: [['F41.1', 'COND-ACTIVE', 'En tratamiento con sertralina y psicoterapia.']],
    alergias: [],
    recetas: [['MED-SERTRALINA', '50 mg', 'Una vez al día por la mañana', 'RX-ACTIVE']],
  },
  {
    dx: [
      ['I10', 'COND-ACTIVE', 'Hipertensión de larga data.'],
      ['M17', 'COND-ACTIVE', 'Gonartrosis bilateral, grado II.'],
      ['E11', 'COND-ACTIVE', 'Diabetes tipo 2 con buen control.'],
    ],
    alergias: [['MED-CIPROFLOXACINO', 'CRIT-HIGH']],
    recetas: [
      ['MED-ENALAPRIL', '10 mg', 'Dos veces al día', 'RX-ACTIVE'],
      ['MED-METFORMINA', '850 mg', 'Con las comidas', 'RX-ACTIVE'],
      ['MED-INSULINA-NPH', '12 UI', 'Por la noche, subcutánea', 'RX-ACTIVE'],
    ],
  },
  {
    dx: [['K21.0', 'COND-ACTIVE', 'Reflujo con pirosis nocturna.']],
    alergias: [],
    recetas: [['MED-OMEPRAZOL', '20 mg', 'En ayunas por 8 semanas', 'RX-ACTIVE']],
  },
  {
    dx: [['N39.0', 'COND-RESOLVED', 'Tratada con ciprofloxacino.']],
    alergias: [],
    recetas: [['MED-CIPROFLOXACINO', '500 mg', 'Cada 12 horas por 7 días', 'RX-COMPLETED']],
  },
];

export const SUSTANCIA_MANI = uuid('concept-allergen-peanut');
export const SUSTANCIA_POLVO = uuid('concept-allergen-dust');

function perfilClinicoDe(p: PacienteSimulado) {
  const indice = PACIENTES.indexOf(p);
  return PERFILES_CLINICOS[(indice < 0 ? 0 : indice) % PERFILES_CLINICOS.length]!;
}

export const condiciones = new Coleccion<CondicionSimulada>(
  PACIENTES.flatMap((p) =>
    perfilClinicoDe(p).dx.map(([code, estado, nota], i) => ({
      id: uuid(`condition-${p.id}-${code}`),
      patientProfileId: p.id,
      codeConceptId: DIAGNOSTICO[code]!,
      categoryConceptId: CATEGORIA_DX,
      clinicalStatusConceptId: ESTADO_CONDICION[estado]!,
      verificationStatusConceptId:
        i === 0 ? VERIFICACION_DX['DXV-CONFIRMED']! : VERIFICACION_DX['DXV-PROVISIONAL']!,
      severityConceptId: i === 0 ? SEVERIDAD['SEV-MODERATE']! : SEVERIDAD['SEV-MILD']!,
      encounterId: uuid(`encounter-${p.id}-0`),
      onsetAt: iso(-400 + i * 90),
      ...(estado === 'COND-RESOLVED' ? { resolvedAt: iso(-30 - i * 10) } : {}),
      noteText: nota,
      createdAt: iso(-400 + i * 90),
    })),
  ),
);

export const alergias = new Coleccion<AlergiaSimulada>(
  PACIENTES.flatMap((p) =>
    perfilClinicoDe(p).alergias.map(([sustancia, criticidad]) => ({
      id: uuid(`allergy-${p.id}-${sustancia}`),
      patientProfileId: p.id,
      substanceConceptId:
        sustancia === 'ALIMENTO-MANI'
          ? SUSTANCIA_MANI
          : sustancia === 'POLVO'
            ? SUSTANCIA_POLVO
            : MEDICAMENTO[sustancia]!,
      typeConceptId: TIPO_ALERGIA,
      categoryConceptId:
        sustancia === 'ALIMENTO-MANI'
          ? CATEGORIA_ALERGIA['ALG-FOOD']!
          : sustancia === 'POLVO'
            ? CATEGORIA_ALERGIA['ALG-ENVIRONMENT']!
            : CATEGORIA_ALERGIA['ALG-MEDICATION']!,
      criticalityConceptId: CRITICIDAD[criticidad]!,
      clinicalStatusConceptId: ESTADO_CONDICION['COND-ACTIVE']!,
      createdAt: iso(-500),
    })),
  ),
);

export const recetas = new Coleccion<RecetaSimulada>(
  PACIENTES.flatMap((p, k) =>
    perfilClinicoDe(p).recetas.map(([med, dosis, frecuencia, estado], i) => ({
      id: uuid(`rx-${p.id}-${med}`),
      patientProfileId: p.id,
      medicationConceptId: MEDICAMENTO[med]!,
      statusConceptId: ESTADO_RECETA[estado]!,
      prescriberProfileId: i === 0 ? MEDICA.id : PROFESIONALES[(k + i) % 5]!.id,
      // La primera receta de cada persona cuelga de su primer diagnóstico, y la
      // segunda dice su motivo a mano: son los dos caminos que la tabla del
      // expediente tiene que poder mostrar. Sin datos así, la columna
      // «Diagnóstico» no aparecía nunca y no se podía ver el pedido cumplido.
      ...(i === 0
        ? {
            encounterId: uuid(`encounter-${p.id}-0`),
            indicationConditionId: uuid(`condition-${p.id}-${perfilClinicoDe(p).dx[0]?.[0] ?? ''}`),
          }
        : { indicationText: 'Control sintomático' }),
      doseText: dosis,
      frequencyText: frecuencia,
      validFrom: isoDia(estado === 'RX-ACTIVE' ? -20 - i * 3 : -120),
      validTo: isoDia(estado === 'RX-ACTIVE' ? 70 - i * 3 : -90),
      patientInstructionsText: `Tomar ${dosis} — ${frecuencia.toLowerCase()}. Consultar ante cualquier molestia.`,
      signedAt: iso(estado === 'RX-ACTIVE' ? -20 - i * 3 : -120, 10),
      issuedAt: iso(estado === 'RX-ACTIVE' ? -20 - i * 3 : -120, 10, 15),
      createdAt: iso(estado === 'RX-ACTIVE' ? -20 - i * 3 : -120, 9, 50),
    })),
  ),
);

export const observaciones = new Coleccion<ObservacionSimulada>(
  PACIENTES.flatMap((p, k) => {
    const base = [
      ['OBS-BP-SYS', 118 + (k % 5) * 8, 'UNIT-MG'],
      ['OBS-BP-DIA', 76 + (k % 4) * 4, 'UNIT-MG'],
      ['OBS-HR', 64 + (k % 6) * 5, 'UNIT-MG'],
      ['OBS-WEIGHT', 58 + (k % 7) * 6, 'UNIT-MG'],
      ['OBS-HEIGHT', 158 + (k % 5) * 6, 'UNIT-MG'],
      ['OBS-TEMP', 36.4 + (k % 3) * 0.2, 'UNIT-MG'],
      ['OBS-SPO2', 96 + (k % 3), 'UNIT-MG'],
      ['OBS-GLUCOSE', 88 + (k % 6) * 12, 'UNIT-MG'],
    ] as const;
    return base.flatMap(([code, valor], i) =>
      [0, 1, 2].map((visita) => ({
        id: uuid(`obs-${p.id}-${code}-${visita}`),
        patientProfileId: p.id,
        codeConceptId: OBSERVACION[code]!,
        statusConceptId: ESTADO['ST-COMPLETED']!,
        valueDecimal: String(Number((valor + visita * (i % 2 === 0 ? -1.5 : 1)).toFixed(1))),
        quantityValue: String(Number((valor + visita * (i % 2 === 0 ? -1.5 : 1)).toFixed(1))),
        quantityUnitConceptId: UNIDAD['UNIT-MG']!,
        effectiveStartAt: iso(-visita * 45 - 2, 9 + i),
        encounterId: uuid(`encounter-${p.id}-${visita}`),
      })),
    );
  }),
);

export const encuentros = new Coleccion<EncuentroSimulado>(
  PACIENTES.flatMap((p, k) =>
    [0, 1, 2].map((visita) => ({
      id: uuid(`encounter-${p.id}-${visita}`),
      patientProfileId: p.id,
      ...(k % 4 === 3 && visita === 2 ? { episodeId: uuid(`episode-${p.id}`) } : {}),
      statusConceptId: ESTADO_ENCUENTRO['ENCST-FINISHED']!,
      classConceptId: visita === 1 ? CLASE_ENCUENTRO['ENC-VIRTUAL']! : CLASE_ENCUENTRO['ENC-AMB']!,
      primaryPractitionerId: visita === 0 ? MEDICA.id : PROFESIONALES[(k + visita) % 6]!.id,
      reasonText: ['Control de rutina', 'Lectura de resultados', 'Consulta por síntomas'][visita]!,
      startAt: iso(-visita * 45 - 2, 9),
      endAt: iso(-visita * 45 - 2, 9, 35),
    })),
  ),
);

export const episodios = new Coleccion<{
  id: string;
  patientProfileId: string;
  tenantId: string;
  typeConceptId: string;
  statusConceptId: string;
  responsiblePractitionerId: string;
  startAt: string;
  endAt: string | null;
  createdAt: string;
}>(
  PACIENTES.filter((_, k) => k % 4 === 3).map((p) => ({
    id: uuid(`episode-${p.id}`),
    patientProfileId: p.id,
    tenantId: TENANT_CLINICA,
    typeConceptId: TIPO_EPISODIO,
    statusConceptId: ESTADO['ST-CLOSED']!,
    responsiblePractitionerId: MEDICA.id,
    startAt: iso(-95, 8),
    endAt: iso(-92, 12),
    createdAt: iso(-95, 8),
  })),
);

/**
 * Las filas que una médica anota en una consulta, campo por campo. Cinco
 * juegos realistas de cuatro a siete filas: la semilla elige uno por paciente
 * y por visita, así dos notas de la misma persona nunca dicen lo mismo.
 */
const FILAS_DE_NOTA: readonly (readonly FilaDeNotaSimulada[])[] = [
  [
    { label: 'Presión arterial', value: '120/80 mmHg' },
    { label: 'Frecuencia cardíaca', value: '72 lpm' },
    { label: 'Peso', value: '68 kg' },
    { label: 'Exploración', value: 'Abdomen blando, depresible, no doloroso' },
    { label: 'Conducta', value: 'Continuar tratamiento. Control en 3 meses con laboratorio.' },
  ],
  [
    { label: 'Dolor', value: 'Región lumbar, 6/10' },
    { label: 'Duración', value: '3 días' },
    { label: 'Irradiación', value: 'No' },
    { label: 'Desencadenante', value: 'Esfuerzo al levantar peso' },
    { label: 'Exploración', value: 'Contractura paravertebral, Lasègue negativo' },
    { label: 'Conducta', value: 'Reposo relativo, analgesia, control en 7 días' },
  ],
  [
    { label: 'Motivo', value: 'Cansancio y dolor de cabeza' },
    { label: 'Tiempo de evolución', value: '2 semanas' },
    { label: 'Presión arterial', value: '134/88 mmHg' },
    { label: 'Temperatura', value: '36,6 °C' },
    { label: 'Impresión', value: 'Cefalea tensional probable. Descartar anemia.' },
    { label: 'Estudios pedidos', value: 'Hemograma, perfil tiroideo' },
    { label: 'Conducta', value: 'Paracetamol a demanda. Control en 2 semanas.' },
  ],
  [
    { label: 'Glucemia en ayunas', value: '112 mg/dL' },
    { label: 'Hemoglobina glicosilada', value: '6,8 %' },
    { label: 'Peso', value: '81 kg' },
    { label: 'Adherencia', value: 'Buena, sin olvidos' },
  ],
  [
    { label: 'Tos', value: 'Seca, de predominio nocturno' },
    { label: 'Duración', value: '5 días' },
    { label: 'Fiebre', value: 'No' },
    { label: 'Saturación', value: '97 %' },
    { label: 'Auscultación', value: 'Murmullo vesicular conservado, sin ruidos agregados' },
    { label: 'Conducta', value: 'Antitusivo, hidratación, control si empeora' },
  ],
];

export const notas = new Coleccion<NotaSimulada>(
  PACIENTES.flatMap((p, k) =>
    [0, 1].map((visita) => ({
      noteId: uuid(`note-${p.id}-${visita}`),
      id: uuid(`note-${p.id}-${visita}`),
      patientProfileId: p.id,
      encounterId: uuid(`encounter-${p.id}-${visita}`),
      noteTypeConceptId: NOTA_TIPO_EVOLUCION,
      lifecycleStatusConceptId: visita === 0 ? ESTADO['ST-COMPLETED']! : ESTADO['ST-DRAFT']!,
      currentVersionId: uuid(`note-version-${p.id}-${visita}`),
      versionNumber: visita === 0 ? 2 : 1,
      authorProfileId: MEDICA.id,
      // C1: la nota es la tabla de filas. Los apartados SOAP quedan vacíos
      // en las notas nuevas y la pantalla no los dibuja cuando están en blanco.
      entries: FILAS_DE_NOTA[(k + visita * 2) % FILAS_DE_NOTA.length]!,
      chiefComplaintText: '',
      subjectiveText:
        visita === 0 ? '' : 'Refiere que el cuadro empezó tras un viaje largo en bus.',
      objectiveText: '',
      assessmentText: '',
      planText: '',
      signedAt: visita === 0 ? iso(-47, 10) : null,
      releasedToPatient: visita === 0,
      createdAt: iso(-visita * 45 - 2, 9, 40),
    })),
  ) as (NotaSimulada & { id: string })[],
);

/* ---- planes de cuidados y documentos --------------------------------------

   Dejaron de ser funciones puras y pasaron a colecciones el 10/09/2026, cuando
   el expediente aprendió a crear un plan y a registrar un documento. Mientras
   la lectura los recalculaba a partir del paciente, lo recién creado
   desaparecía en la recarga siguiente —y una maqueta que pierde lo que acaba de
   guardar no sirve para demostrar una mutación de punta a punta—. El fixture
   sigue estando: es la semilla de la colección, no su contenido. */

export interface PlanSimulado {
  readonly id: string;
  readonly patientProfileId: string;
  readonly statusConceptId: string;
  readonly intentConceptId: string;
  readonly goalText: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly encounterId?: string;
  readonly conditionId?: string;
  /** El motivo escrito a mano, cuando el plan no cuelga de un diagnóstico. */
  readonly reasonText?: string;
  readonly activities: readonly {
    readonly id: string;
    readonly statusConceptId: string;
    readonly detailText: string;
    readonly scheduledAt: string | null;
    readonly activityConceptId?: string;
  }[];
  readonly createdAt: string;
}

export interface DocumentoSimulado {
  readonly id: string;
  readonly patientProfileId: string;
  readonly title: string;
  readonly categoryConceptId: string;
  readonly statusConceptId: string;
  readonly authorText: string;
  readonly isExternal: boolean;
  readonly documentDate: string;
  readonly encounterId?: string;
  /**
   * Los archivos gobernados del documento (`ChartDocumentFileItemDto` de la
   * API): la lectura del expediente los devuelve y la ruta de contenido los
   * valida (CL-27). Sin esto el documento no podía volver a abrirse.
   */
  readonly files?: readonly { readonly fileId: string; readonly contentRole: 'PRIMARY' | 'ATTACHMENT'; readonly ordinal: number }[];
  readonly createdAt: string;
}

function planesSemilla(p: PacienteSimulado): readonly PlanSimulado[] {
  const perfil = perfilClinicoDe(p);
  if (perfil.dx.length < 2) return [];
  return [
    {
      id: uuid(`careplan-${p.id}`),
      patientProfileId: p.id,
      statusConceptId: ESTADO['ST-ACTIVE']!,
      intentConceptId: INTENCION_DEL_PLAN['CP-INTENT-PLAN']!,
      goalText: 'Presión arterial por debajo de 130/80 y LDL menor a 100 en 6 meses.',
      startDate: isoDia(-60),
      endDate: isoDia(120),
      activities: [
        {
          id: uuid(`cp-act-1-${p.id}`),
          statusConceptId: ESTADO['ST-COMPLETED']!,
          detailText: 'Perfil lipídico basal',
          scheduledAt: iso(-55),
          activityConceptId: ACTIVIDAD_DEL_PLAN['CP-ACT-STUDY']!,
        },
        {
          id: uuid(`cp-act-2-${p.id}`),
          statusConceptId: ESTADO['ST-IN-PROGRESS']!,
          detailText: 'Caminata 30 minutos, 5 veces por semana',
          scheduledAt: iso(-50),
          activityConceptId: ACTIVIDAD_DEL_PLAN['CP-ACT-TREATMENT']!,
        },
        {
          id: uuid(`cp-act-3-${p.id}`),
          statusConceptId: ESTADO['ST-PENDING']!,
          detailText: 'Control con nutrición',
          scheduledAt: iso(12),
          activityConceptId: ACTIVIDAD_DEL_PLAN['CP-ACT-CONTROL']!,
        },
        {
          id: uuid(`cp-act-4-${p.id}`),
          statusConceptId: ESTADO['ST-PENDING']!,
          detailText: 'Ecocardiograma de control',
          scheduledAt: iso(40),
          activityConceptId: ACTIVIDAD_DEL_PLAN['CP-ACT-STUDY']!,
        },
      ],
      createdAt: iso(-60),
    },
  ];
}

function documentosSemilla(p: PacienteSimulado): readonly DocumentoSimulado[] {
  return [
    {
      id: uuid(`doc-lab-${p.id}`),
      patientProfileId: p.id,
      title: 'Laboratorio completo',
      categoryConceptId: CATEGORIA_DOCUMENTAL['DOC-CAT-LAB']!,
      statusConceptId: ESTADO['ST-PUBLISHED']!,
      authorText: 'Laboratorio Central',
      isExternal: true,
      documentDate: iso(-48),
      // El PDF del laboratorio que `files.handlers.ts` siembra para cada paciente.
      files: [{ fileId: uuid(`file-lab-${p.id}`), contentRole: 'PRIMARY', ordinal: 0 }],
      createdAt: iso(-47),
    },
    {
      id: uuid(`doc-ecg-${p.id}`),
      patientProfileId: p.id,
      title: 'Electrocardiograma de reposo',
      categoryConceptId: CATEGORIA_DOCUMENTAL['DOC-CAT-REPORT']!,
      statusConceptId: ESTADO['ST-PUBLISHED']!,
      authorText: MEDICA.displayName,
      isExternal: false,
      documentDate: iso(-2),
      files: [{ fileId: uuid(`file-ecg-${p.id}`), contentRole: 'PRIMARY', ordinal: 0 }],
      createdAt: iso(-2),
    },
    {
      id: uuid(`doc-rx-${p.id}`),
      patientProfileId: p.id,
      title: 'Radiografía de tórax — informe',
      categoryConceptId: CATEGORIA_DOCUMENTAL['DOC-CAT-IMAGING']!,
      statusConceptId: ESTADO['ST-DRAFT']!,
      authorText: 'Centro de Imagen Sur',
      isExternal: true,
      documentDate: iso(-100),
      createdAt: iso(-99),
    },
  ];
}

export const planes = new Coleccion<PlanSimulado>(PACIENTES.flatMap(planesSemilla));

export const documentos = new Coleccion<DocumentoSimulado>(PACIENTES.flatMap(documentosSemilla));

/** Los planes de una persona, del más nuevo al más viejo y sin su paciente. */
export function planesDe(p: PacienteSimulado) {
  return planes
    .filtrar((plan) => plan.patientProfileId === p.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ patientProfileId: _p, ...plan }) => plan);
}

/** Los documentos de una persona, del más nuevo al más viejo. */
export function documentosDe(p: PacienteSimulado) {
  return documentos
    .filtrar((doc) => doc.patientProfileId === p.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ patientProfileId: _p, ...doc }) => doc);
}

/* ---- órdenes (laboratorio e imagen) --------------------------------------- */

export interface OrdenSimulada {
  readonly id: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
  readonly priorityConceptId: string;
  readonly statusConceptId: string;
  readonly requesterProfileId: string;
  readonly encounterId?: string;
  readonly reasonText: string;
  readonly createdAt: string;
  /**
   * Antiduplicación de estudios (v4.2.17, T-26, subtarea 3.2): el informe
   * previo que satisface esta orden, cuando el médico decidió reutilizarlo o
   * repetir el estudio con justificación. Ausente en cualquier otra orden —
   * ninguna de las cuatro sembradas por paciente lo trae.
   */
  readonly previousDiagnosticReportId?: string;
  readonly duplicateOverrideReason?: string;
}

export const ordenes = new Coleccion<OrdenSimulada>(
  PACIENTES.flatMap((p, k) =>
    [
      ['STUDY-HEMOGRAMA', 'SRQ-LAB', 'ST-COMPLETED'],
      ['STUDY-PERFIL-LIPIDICO', 'SRQ-LAB', 'ST-COMPLETED'],
      ['STUDY-ECG', 'SRQ-PROCEDURE', 'ST-COMPLETED'],
      ...(k % 2 === 0
        ? [['STUDY-ECO-ABD', 'SRQ-IMAGING', 'ST-PENDING']]
        : [['STUDY-TSH', 'SRQ-LAB', 'ST-IN-PROGRESS']]),
    ].map(([estudio, categoria, estado], i) => ({
      id: uuid(`order-${p.id}-${estudio}`),
      patientProfileId: p.id,
      codeConceptId: ESTUDIO[estudio as keyof typeof ESTUDIO]!,
      categoryConceptId: CATEGORIA_ORDEN[categoria as keyof typeof CATEGORIA_ORDEN]!,
      priorityConceptId: i === 3 ? PRIORIDAD['PRI-URGENT']! : PRIORIDAD['PRI-ROUTINE']!,
      statusConceptId: ESTADO[estado as keyof typeof ESTADO]!,
      requesterProfileId: MEDICA.id,
      encounterId: uuid(`encounter-${p.id}-${i % 3}`),
      reasonText: [
        'Control anual',
        'Seguimiento de dislipidemia',
        'Palpitaciones',
        'Dolor abdominal / control tiroideo',
      ][i]!,
      createdAt: iso(-50 + i * 12),
    })),
  ),
);

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
condiciones.persistirEn('mock.clinica.condiciones');
alergias.persistirEn('mock.clinica.alergias');
recetas.persistirEn('mock.clinica.recetas');
observaciones.persistirEn('mock.clinica.observaciones');
encuentros.persistirEn('mock.clinica.encuentros');
episodios.persistirEn('mock.clinica.episodios');
notas.persistirEn('mock.clinica.notas-medicas');
planes.persistirEn('mock.clinica.planes');
documentos.persistirEn('mock.clinica.documentos');
ordenes.persistirEn('mock.clinica.ordenes');
