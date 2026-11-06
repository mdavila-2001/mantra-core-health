import {
  PLAN_ACTIVITY,
  ALLERGY_CATEGORY,
  ALLERGEN_SUBSTANCE,
  CATEGORY_DOCUMENTAL,
  ORDER_CATEGORY,
  ENCOUNTER_CLASS,
  CRITICALITY,
  DIAGNOSIS,
  STATUS,
  CONDITION_STATUS,
  ENCOUNTER_STATUS,
  PRESCRIPTION_STATUS,
  ESTUDIO,
  PLAN_INTENT,
  MEDICAMENTO,
  OBSERVATION,
  PRIORITY,
  SEVERITY,
  OBSERVATION_UNIT,
  VERIFICATION_DX,
} from './concepts';
import { MEDICAL, PATIENTS, PROFESSIONALS, type PacienteSimulado } from './people';
import { TENANT_CLINICA } from '../mock-session';
import { Coleccion, iso, isoDia, uuid } from '../mock-store';
import * as network from './patient-network.data';
import { NOTE_ROWS } from './clinic-notes.data';
import type {
  SimulatedCondition,
  SimulatedEncounter,
  SimulatedNote,
  SimulatedObservation,
  SimulatedOrder,
  SimulatedPrescription,
} from './simulated-records.types';

// Re-exported for the handlers and fixtures that name them from here.
export type {
  SimulatedCondition,
  SimulatedEncounter,
  SimulatedEvidence,
  SimulatedNote,
  SimulatedObservation,
  SimulatedOrder,
  SimulatedPrescription,
  SimulatedVerification,
} from './simulated-records.types';

/* ============================================================================
    El expediente clínico de cada paciente: condiciones, alergias, recetas,
    observaciones, encuentros, episodios, notas, planes y documentos. Se
    genera por paciente de forma determinística, así que un expediente
    siempre se ve igual entre recargas.
    ========================================================================== */

export interface SimulatedAllergy {
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

export const PROGRESS_NOTE_TYPE = uuid('concept-note-type-evolution');
export const DX_CATEGORY = uuid('concept-condition-category-problem-list');
export const ALLERGY_TYPE = uuid('concept-allergy-type-allergy');
export const EPISODE_TYPE = uuid('concept-episode-type-inpatient');
/**
 * La categoría documental por omisión de la maqueta.
 *
 * Apunta al concepto **del conjunto publicado** (`VS_DOCUMENT_CATEGORY`) y no a
 * un uuid acuñado aparte: el documento registrado desde el expediente muestra su
 * categoría en palabras, y un identificador que no está en ningún conjunto se
 * leía como «Sin registrar».
 */
export const DOCUMENT_CATEGORY = CATEGORY_DOCUMENTAL['DOC-CAT-REPORT']!;

const CLINICAL_PROFILES: readonly {
  readonly dx: readonly (readonly [
    keyof typeof DIAGNOSIS,
    'COND_ACTIVE' | 'COND_RESOLVED' | 'COND_REMISSION',
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
    'clinical:MEDICATION_REQUEST_ISSUED' | 'clinical:MEDICATION_REQUEST_COMPLETED',
  ])[];
}[] = [
  {
    dx: [
      ['I10', 'COND_ACTIVE', 'Diagnosticada hace 3 años. Buen control con enalapril.'],
      ['E78.5', 'COND_ACTIVE', 'LDL 165 en el último control.'],
      ['J06.9', 'COND_RESOLVED', 'Cuadro viral autolimitado.'],
    ],
    alergias: [
      ['MED-AMOXICILINA', 'CRIT-HIGH'],
      ['POLVO', 'CRIT-LOW'],
    ],
    recetas: [
      ['MED-ENALAPRIL', '10 mg', 'Una vez al día por la mañana', 'clinical:MEDICATION_REQUEST_ISSUED'],
      ['MED-ATORVASTATINA', '20 mg', 'Una vez al día por la noche', 'clinical:MEDICATION_REQUEST_ISSUED'],
      ['MED-PARACETAMOL', '500 mg', 'Cada 8 horas si hay dolor, máximo 3 días', 'clinical:MEDICATION_REQUEST_COMPLETED'],
    ],
  },
  {
    dx: [
      ['E11', 'COND_ACTIVE', 'HbA1c 7,8 %. Se ajusta metformina.'],
      ['I10', 'COND_ACTIVE', 'Asociada a la diabetes.'],
      ['E66', 'COND_ACTIVE', 'IMC 31.'],
    ],
    alergias: [],
    recetas: [
      ['MED-METFORMINA', '850 mg', 'Con el desayuno y la cena', 'clinical:MEDICATION_REQUEST_ISSUED'],
      ['MED-LOSARTAN', '50 mg', 'Una vez al día', 'clinical:MEDICATION_REQUEST_ISSUED'],
    ],
  },
  {
    dx: [
      ['J45', 'COND_ACTIVE', 'Asma leve persistente, controlada.'],
      ['L20', 'COND_REMISSION', 'Brotes en invierno.'],
    ],
    alergias: [['ALIMENTO-MANI', 'CRIT-HIGH']],
    recetas: [
      ['MED-SALBUTAMOL', '100 mcg', 'Dos inhalaciones a demanda', 'clinical:MEDICATION_REQUEST_ISSUED'],
      ['MED-LORATADINA', '10 mg', 'Una vez al día en época de polen', 'clinical:MEDICATION_REQUEST_COMPLETED'],
    ],
  },
  {
    dx: [['J06.9', 'COND_RESOLVED', 'Resfrío común.']],
    alergias: [],
    recetas: [['MED-PARACETAMOL', '250 mg', 'Cada 8 horas por 3 días', 'clinical:MEDICATION_REQUEST_COMPLETED']],
  },
  {
    dx: [
      ['E03.9', 'COND_ACTIVE', 'TSH 8,2. Inicia levotiroxina.'],
      ['D50', 'COND_ACTIVE', 'Hemoglobina 10,4.'],
    ],
    alergias: [['MED-IBUPROFENO', 'CRIT-LOW']],
    recetas: [
      ['MED-LEVOTIROXINA', '50 mcg', 'Una vez al día, en ayunas, 30 minutos antes del desayuno', 'clinical:MEDICATION_REQUEST_ISSUED'],
      ['MED-SULFATO-FERROSO', '300 mg', 'Una vez al día con jugo de naranja', 'clinical:MEDICATION_REQUEST_ISSUED'],
    ],
  },
  {
    dx: [
      ['M54.5', 'COND_ACTIVE', 'Lumbalgia mecánica por postura laboral.'],
      ['G43', 'COND_ACTIVE', 'Migraña sin aura, 2 episodios al mes.'],
    ],
    alergias: [],
    recetas: [['MED-IBUPROFENO', '400 mg', 'Cada 8 horas con comida, 5 días', 'clinical:MEDICATION_REQUEST_ISSUED']],
  },
  {
    dx: [['F41.1', 'COND_ACTIVE', 'En tratamiento con sertralina y psicoterapia.']],
    alergias: [],
    recetas: [['MED-SERTRALINA', '50 mg', 'Una vez al día por la mañana', 'clinical:MEDICATION_REQUEST_ISSUED']],
  },
  {
    dx: [
      ['I10', 'COND_ACTIVE', 'Hipertensión de larga data.'],
      ['M17', 'COND_ACTIVE', 'Gonartrosis bilateral, grado II.'],
      ['E11', 'COND_ACTIVE', 'Diabetes tipo 2 con buen control.'],
    ],
    alergias: [['MED-CIPROFLOXACINO', 'CRIT-HIGH']],
    recetas: [
      ['MED-ENALAPRIL', '10 mg', 'Dos veces al día', 'clinical:MEDICATION_REQUEST_ISSUED'],
      ['MED-METFORMINA', '850 mg', 'Con las comidas', 'clinical:MEDICATION_REQUEST_ISSUED'],
      ['MED-INSULINA-NPH', '12 UI', 'Por la noche, subcutánea', 'clinical:MEDICATION_REQUEST_ISSUED'],
    ],
  },
  {
    dx: [['K21.0', 'COND_ACTIVE', 'Reflujo con pirosis nocturna.']],
    alergias: [],
    recetas: [['MED-OMEPRAZOL', '20 mg', 'En ayunas por 8 semanas', 'clinical:MEDICATION_REQUEST_ISSUED']],
  },
  {
    dx: [['N39.0', 'COND_RESOLVED', 'Tratada con ciprofloxacino.']],
    alergias: [],
    recetas: [['MED-CIPROFLOXACINO', '500 mg', 'Cada 12 horas por 7 días', 'clinical:MEDICATION_REQUEST_COMPLETED']],
  },
];

// The terminology catalog's own ids: a made-up uuid resolved to «Sin registrar».
export const PEANUT_SUBSTANCE = ALLERGEN_SUBSTANCE['ALG_SUB_PEANUT']!;
export const POWDER_SUBSTANCE = ALLERGEN_SUBSTANCE['ALG_SUB_DUST']!;

function clinicalProfileOf(p: PacienteSimulado) {
  const indice = PATIENTS.indexOf(p);
  return CLINICAL_PROFILES[(indice < 0 ? 0 : indice) % CLINICAL_PROFILES.length]!;
}

export const conditionList = new Coleccion<SimulatedCondition>([
  ...PATIENTS.flatMap((p) =>
    clinicalProfileOf(p).dx.map(([code, estado, nota], i) => ({
      id: uuid(`condition-${p.id}-${code}`),
      patientProfileId: p.id,
      codeConceptId: DIAGNOSIS[code]!,
      categoryConceptId: DX_CATEGORY,
      clinicalStatusConceptId: CONDITION_STATUS[estado]!,
      verificationStatusConceptId:
        i === 0 ? VERIFICATION_DX['COND_CONFIRMED']! : VERIFICATION_DX['COND_PROVISIONAL']!,
      severityConceptId: i === 0 ? SEVERITY['SEV-MODERATE']! : SEVERITY['SEV-MILD']!,
      encounterId: uuid(`encounter-${p.id}-0`),
      onsetAt: iso(-400 + i * 90),
      ...(estado === 'COND_RESOLVED' ? { resolvedAt: iso(-30 - i * 10) } : {}),
      noteText: nota,
      createdAt: iso(-400 + i * 90),
    })),
  ),
  ...network.networkConditions(DX_CATEGORY),
]);

export const allergyList = new Coleccion<SimulatedAllergy>(
  PATIENTS.flatMap((p) =>
    clinicalProfileOf(p).alergias.map(([sustancia, criticidad]) => ({
      id: uuid(`allergy-${p.id}-${sustancia}`),
      patientProfileId: p.id,
      substanceConceptId:
        sustancia === 'ALIMENTO-MANI'
          ? PEANUT_SUBSTANCE
          : sustancia === 'POLVO'
            ? POWDER_SUBSTANCE
            : MEDICAMENTO[sustancia]!,
      typeConceptId: ALLERGY_TYPE,
      categoryConceptId:
        sustancia === 'ALIMENTO-MANI'
          ? ALLERGY_CATEGORY['ALG-FOOD']!
          : sustancia === 'POLVO'
            ? ALLERGY_CATEGORY['ALG-ENVIRONMENT']!
            : ALLERGY_CATEGORY['ALG-MEDICATION']!,
      criticalityConceptId: CRITICALITY[criticidad]!,
      clinicalStatusConceptId: CONDITION_STATUS['COND_ACTIVE']!,
      createdAt: iso(-500),
    })),
  ),
);

export const prescriptionList = new Coleccion<SimulatedPrescription>([
  ...PATIENTS.flatMap((p, k) =>
    clinicalProfileOf(p).recetas.map(([med, dosis, frecuencia, estado], i) => ({
      id: uuid(`rx-${p.id}-${med}`),
      patientProfileId: p.id,
      medicationConceptId: MEDICAMENTO[med]!,
      statusConceptId: PRESCRIPTION_STATUS[estado]!,
      prescriberProfileId: i === 0 ? MEDICAL.id : PROFESSIONALS[(k + i) % 5]!.id,
      // La primera receta de cada persona cuelga de su primer diagnóstico, y la
      // segunda dice su motivo a mano: son los dos caminos que la tabla del
      // expediente tiene que poder mostrar. Sin datos así, la columna
      // «Diagnóstico» no aparecía nunca y no se podía ver el pedido cumplido.
      ...(i === 0
        ? {
            encounterId: uuid(`encounter-${p.id}-0`),
            indicationConditionId: uuid(`condition-${p.id}-${clinicalProfileOf(p).dx[0]?.[0] ?? ''}`),
          }
        : { indicationText: 'Control sintomático' }),
      doseText: dosis,
      frequencyText: frecuencia,
      validFrom: isoDia(estado === 'clinical:MEDICATION_REQUEST_ISSUED' ? -20 - i * 3 : -120),
      validTo: isoDia(estado === 'clinical:MEDICATION_REQUEST_ISSUED' ? 70 - i * 3 : -90),
      patientInstructionsText: `Tomar ${dosis} — ${frecuencia.toLowerCase()}. Consultar ante cualquier molestia.`,
      signedAt: iso(estado === 'clinical:MEDICATION_REQUEST_ISSUED' ? -20 - i * 3 : -120, 10),
      issuedAt: iso(estado === 'clinical:MEDICATION_REQUEST_ISSUED' ? -20 - i * 3 : -120, 10, 15),
      createdAt: iso(estado === 'clinical:MEDICATION_REQUEST_ISSUED' ? -20 - i * 3 : -120, 9, 50),
    })),
  ),
  ...network.networkPrescriptions(),
]);

export const observationList = new Coleccion<SimulatedObservation>([
  ...PATIENTS.flatMap((p, k) => {
    const base = [
      // The unit comes from `VS_OBSERVATION_UNIT`, not `VS_DOSE_UNIT`: with
      // `UNIT-MG` for everything, the pressure read «118 mg» (06/11/2026).
      ['OBS-BP-SYS', 118 + (k % 5) * 8, 'OBSU-MMHG'],
      ['OBS-BP-DIA', 76 + (k % 4) * 4, 'OBSU-MMHG'],
      ['OBS-HR', 64 + (k % 6) * 5, 'OBSU-BPM'],
      ['OBS-WEIGHT', 58 + (k % 7) * 6, 'OBSU-KG'],
      ['OBS-HEIGHT', 158 + (k % 5) * 6, 'OBSU-CM'],
      ['OBS-TEMP', 36.4 + (k % 3) * 0.2, 'OBSU-CELSIUS'],
      ['OBS-SPO2', 96 + (k % 3), 'OBSU-PERCENT'],
      ['OBS-GLUCOSE', 88 + (k % 6) * 12, 'OBSU-MGDL'],
    ] as const;
    return base.flatMap(([code, valor, unidad], i) =>
      [0, 1, 2].map((visita) => ({
        id: uuid(`obs-${p.id}-${code}-${visita}`),
        patientProfileId: p.id,
        codeConceptId: OBSERVATION[code]!,
        statusConceptId: STATUS['ST-COMPLETED']!,
        valueDecimal: String(Number((valor + visita * (i % 2 === 0 ? -1.5 : 1)).toFixed(1))),
        quantityValue: String(Number((valor + visita * (i % 2 === 0 ? -1.5 : 1)).toFixed(1))),
        quantityUnitConceptId: OBSERVATION_UNIT[unidad]!,
        effectiveStartAt: iso(-visita * 45 - 2, 9 + i),
        encounterId: uuid(`encounter-${p.id}-${visita}`),
      })),
    );
  }),
  ...network.networkObservations(),
]);

export const encounterList = new Coleccion<SimulatedEncounter>([
  ...PATIENTS.flatMap((p, k) =>
    [0, 1, 2].map((visita) => ({
      id: uuid(`encounter-${p.id}-${visita}`),
      patientProfileId: p.id,
      ...(k % 4 === 3 && visita === 2 ? { episodeId: uuid(`episode-${p.id}`) } : {}),
      statusConceptId: ENCOUNTER_STATUS['ENCST-FINISHED']!,
      classConceptId: visita === 1 ? ENCOUNTER_CLASS['ENC-VIRTUAL']! : ENCOUNTER_CLASS['ENC-AMB']!,
      primaryPractitionerId: visita === 0 ? MEDICAL.id : PROFESSIONALS[(k + visita) % 6]!.id,
      reasonText: ['Control de rutina', 'Lectura de resultados', 'Consulta por síntomas'][visita]!,
      startAt: iso(-visita * 45 - 2, 9),
      endAt: iso(-visita * 45 - 2, 9, 35),
    })),
  ),
  ...network.networkEncounters(),
]);

export const episodeList = new Coleccion<{
  id: string;
  patientProfileId: string;
  tenantId: string;
  typeConceptId: string;
  statusConceptId: string;
  responsiblePractitionerId: string;
  startAt: string;
  endAt: string | null;
  createdAt: string;
}>([
  ...PATIENTS.filter((_, k) => k % 4 === 3).map((p) => ({
    id: uuid(`episode-${p.id}`),
    patientProfileId: p.id,
    tenantId: TENANT_CLINICA,
    typeConceptId: EPISODE_TYPE,
    statusConceptId: STATUS['ST-CLOSED']!,
    responsiblePractitionerId: MEDICAL.id,
    startAt: iso(-95, 8),
    endAt: iso(-92, 12),
    createdAt: iso(-95, 8),
  })),
  ...network.networkEpisodes(EPISODE_TYPE),
]);

export const noteList = new Coleccion<SimulatedNote>([
  ...PATIENTS.flatMap((p, k) =>
    [0, 1].map((visita) => ({
      noteId: uuid(`note-${p.id}-${visita}`),
      id: uuid(`note-${p.id}-${visita}`),
      patientProfileId: p.id,
      encounterId: uuid(`encounter-${p.id}-${visita}`),
      noteTypeConceptId: PROGRESS_NOTE_TYPE,
      lifecycleStatusConceptId: visita === 0 ? STATUS['ST-COMPLETED']! : STATUS['ST-DRAFT']!,
      currentVersionId: uuid(`note-version-${p.id}-${visita}`),
      versionNumber: visita === 0 ? 2 : 1,
      authorProfileId: MEDICAL.id,
      // C1: la nota es la tabla de filas. Los apartados SOAP quedan vacíos
      // en las notas nuevas y la pantalla no los dibuja cuando están en blanco.
      entries: NOTE_ROWS[(k + visita * 2) % NOTE_ROWS.length]!,
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
  ) as (SimulatedNote & { id: string })[],
  ...network.networkNotes(PROGRESS_NOTE_TYPE),
]);

/* ---- planes de cuidados y documentos --------------------------------------

   Dejaron de ser funciones puras y pasaron a colecciones el 10/09/2026, cuando
   el expediente aprendió a crear un plan y a registrar un documento. Mientras
   la lectura los recalculaba a partir del paciente, lo recién creado
   desaparecía en la recarga siguiente —y una maqueta que pierde lo que acaba de
   guardar no sirve para demostrar una mutación de punta a punta—. El fixture
   sigue estando: es la semilla de la colección, no su contenido. */

export interface SimulatedPlan {
  /** La respuesta del formulario médico de la que sale (P43). */
  readonly formInstanceId?: string;
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

export interface SimulatedDocument {
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

function seedPlans(p: PacienteSimulado): readonly SimulatedPlan[] {
  const perfil = clinicalProfileOf(p);
  if (perfil.dx.length < 2) return [];
  return [
    {
      id: uuid(`careplan-${p.id}`),
      patientProfileId: p.id,
      statusConceptId: STATUS['ST-ACTIVE']!,
      intentConceptId: PLAN_INTENT['CP-INTENT-PLAN']!,
      goalText: 'Presión arterial por debajo de 130/80 y LDL menor a 100 en 6 meses.',
      startDate: isoDia(-60),
      endDate: isoDia(120),
      activities: [
        {
          id: uuid(`cp-act-1-${p.id}`),
          statusConceptId: STATUS['ST-COMPLETED']!,
          detailText: 'Perfil lipídico basal',
          scheduledAt: iso(-55),
          activityConceptId: PLAN_ACTIVITY['CP-ACT-STUDY']!,
        },
        {
          id: uuid(`cp-act-2-${p.id}`),
          statusConceptId: STATUS['ST-IN-PROGRESS']!,
          detailText: 'Caminata 30 minutos, 5 veces por semana',
          scheduledAt: iso(-50),
          activityConceptId: PLAN_ACTIVITY['CP-ACT-TREATMENT']!,
        },
        {
          id: uuid(`cp-act-3-${p.id}`),
          statusConceptId: STATUS['ST-PENDING']!,
          detailText: 'Control con nutrición',
          scheduledAt: iso(12),
          activityConceptId: PLAN_ACTIVITY['CP-ACT-CONTROL']!,
        },
        {
          id: uuid(`cp-act-4-${p.id}`),
          statusConceptId: STATUS['ST-PENDING']!,
          detailText: 'Ecocardiograma de control',
          scheduledAt: iso(40),
          activityConceptId: PLAN_ACTIVITY['CP-ACT-STUDY']!,
        },
      ],
      createdAt: iso(-60),
    },
  ];
}

function seedDocuments(p: PacienteSimulado): readonly SimulatedDocument[] {
  return [
    {
      id: uuid(`doc-lab-${p.id}`),
      patientProfileId: p.id,
      title: 'Laboratorio completo',
      categoryConceptId: CATEGORY_DOCUMENTAL['DOC-CAT-LAB']!,
      statusConceptId: STATUS['ST-PUBLISHED']!,
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
      categoryConceptId: CATEGORY_DOCUMENTAL['DOC-CAT-REPORT']!,
      statusConceptId: STATUS['ST-PUBLISHED']!,
      authorText: MEDICAL.displayName,
      isExternal: false,
      documentDate: iso(-2),
      files: [{ fileId: uuid(`file-ecg-${p.id}`), contentRole: 'PRIMARY', ordinal: 0 }],
      createdAt: iso(-2),
    },
    {
      id: uuid(`doc-rx-${p.id}`),
      patientProfileId: p.id,
      title: 'Radiografía de tórax — informe',
      categoryConceptId: CATEGORY_DOCUMENTAL['DOC-CAT-IMAGING']!,
      statusConceptId: STATUS['ST-DRAFT']!,
      authorText: 'Centro de Imagen Sur',
      isExternal: true,
      documentDate: iso(-100),
      createdAt: iso(-99),
    },
  ];
}

export const planList = new Coleccion<SimulatedPlan>(PATIENTS.flatMap(seedPlans));

export const documentList = new Coleccion<SimulatedDocument>(PATIENTS.flatMap(seedDocuments));

/** Los planes de una persona, del más nuevo al más viejo y sin su paciente. */
export function plansOf(p: PacienteSimulado) {
  return planList
    .filtrar((plan) => plan.patientProfileId === p.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ patientProfileId: _p, ...plan }) => plan);
}

/** Los documentos de una persona, del más nuevo al más viejo. */
export function documentsOf(p: PacienteSimulado) {
  return documentList
    .filtrar((doc) => doc.patientProfileId === p.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ patientProfileId: _p, ...doc }) => doc);
}

/* ---- órdenes (laboratorio e imagen) --------------------------------------- */

export const orderList = new Coleccion<SimulatedOrder>([
  ...PATIENTS.flatMap((p, k) =>
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
      categoryConceptId: ORDER_CATEGORY[categoria as keyof typeof ORDER_CATEGORY]!,
      priorityConceptId: i === 3 ? PRIORITY['PRI-URGENT']! : PRIORITY['PRI-ROUTINE']!,
      statusConceptId: STATUS[estado as keyof typeof STATUS]!,
      requesterProfileId: MEDICAL.id,
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
  ...network.networkOrders(),
]);

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
conditionList.persistirEn('mock.clinica.condiciones');
allergyList.persistirEn('mock.clinica.alergias');
prescriptionList.persistirEn('mock.clinica.recetas');
observationList.persistirEn('mock.clinica.observaciones');
encounterList.persistirEn('mock.clinica.encuentros');
episodeList.persistirEn('mock.clinica.episodios');
noteList.persistirEn('mock.clinica.notas-medicas');
planList.persistirEn('mock.clinica.planes');
documentList.persistirEn('mock.clinica.documentos');
orderList.persistirEn('mock.clinica.ordenes');
