import {
  CATEGORIA_ALERGIA,
  CATEGORIA_ORDEN,
  CLASE_ENCUENTRO,
  CRITICIDAD,
  DIAGNOSTICO,
  ESTADO,
  ESTADO_CONDICION,
  ESTADO_ENCUENTRO,
  ESTADO_RECETA,
  ESTUDIO,
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

export interface CondicionSimulada {
  readonly id: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
  readonly clinicalStatusConceptId: string;
  readonly verificationStatusConceptId: string;
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
  readonly createdAt: string;
}

export interface RecetaSimulada {
  readonly id: string;
  readonly patientProfileId: string;
  readonly medicationConceptId: string;
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
export const CATEGORIA_DOCUMENTO = uuid('concept-document-category-report');

const PERFILES_CLINICOS: readonly {
  readonly dx: readonly (readonly [keyof typeof DIAGNOSTICO, 'COND-ACTIVE' | 'COND-RESOLVED' | 'COND-REMISSION', string])[];
  readonly alergias: readonly (readonly [keyof typeof MEDICAMENTO | 'ALIMENTO-MANI' | 'POLVO', 'CRIT-LOW' | 'CRIT-HIGH'])[];
  readonly recetas: readonly (readonly [keyof typeof MEDICAMENTO, string, string, 'RX-ACTIVE' | 'RX-COMPLETED'])[];
}[] = [
  {
    dx: [['I10', 'COND-ACTIVE', 'Diagnosticada hace 3 años. Buen control con enalapril.'], ['E78.5', 'COND-ACTIVE', 'LDL 165 en el último control.'], ['J06.9', 'COND-RESOLVED', 'Cuadro viral autolimitado.']],
    alergias: [['MED-AMOXICILINA', 'CRIT-HIGH'], ['POLVO', 'CRIT-LOW']],
    recetas: [['MED-ENALAPRIL', '10 mg', 'Una vez al día por la mañana', 'RX-ACTIVE'], ['MED-ATORVASTATINA', '20 mg', 'Una vez al día por la noche', 'RX-ACTIVE'], ['MED-PARACETAMOL', '500 mg', 'Cada 8 horas si hay dolor, máximo 3 días', 'RX-COMPLETED']],
  },
  {
    dx: [['E11', 'COND-ACTIVE', 'HbA1c 7,8 %. Se ajusta metformina.'], ['I10', 'COND-ACTIVE', 'Asociada a la diabetes.'], ['E66', 'COND-ACTIVE', 'IMC 31.']],
    alergias: [],
    recetas: [['MED-METFORMINA', '850 mg', 'Con el desayuno y la cena', 'RX-ACTIVE'], ['MED-LOSARTAN', '50 mg', 'Una vez al día', 'RX-ACTIVE']],
  },
  {
    dx: [['J45', 'COND-ACTIVE', 'Asma leve persistente, controlada.'], ['L20', 'COND-REMISSION', 'Brotes en invierno.']],
    alergias: [['ALIMENTO-MANI', 'CRIT-HIGH']],
    recetas: [['MED-SALBUTAMOL', '100 mcg', 'Dos inhalaciones a demanda', 'RX-ACTIVE'], ['MED-LORATADINA', '10 mg', 'Una vez al día en época de polen', 'RX-COMPLETED']],
  },
  {
    dx: [['J06.9', 'COND-RESOLVED', 'Resfrío común.']],
    alergias: [],
    recetas: [['MED-PARACETAMOL', '250 mg', 'Cada 8 horas por 3 días', 'RX-COMPLETED']],
  },
  {
    dx: [['E03.9', 'COND-ACTIVE', 'TSH 8,2. Inicia levotiroxina.'], ['D50', 'COND-ACTIVE', 'Hemoglobina 10,4.']],
    alergias: [['MED-IBUPROFENO', 'CRIT-LOW']],
    recetas: [['MED-LEVOTIROXINA', '50 mcg', 'En ayunas, 30 minutos antes del desayuno', 'RX-ACTIVE'], ['MED-SULFATO-FERROSO', '300 mg', 'Una vez al día con jugo de naranja', 'RX-ACTIVE']],
  },
  {
    dx: [['M54.5', 'COND-ACTIVE', 'Lumbalgia mecánica por postura laboral.'], ['G43', 'COND-ACTIVE', 'Migraña sin aura, 2 episodios al mes.']],
    alergias: [],
    recetas: [['MED-IBUPROFENO', '400 mg', 'Cada 8 horas con comida, 5 días', 'RX-ACTIVE']],
  },
  {
    dx: [['F41.1', 'COND-ACTIVE', 'En tratamiento con sertralina y psicoterapia.']],
    alergias: [],
    recetas: [['MED-SERTRALINA', '50 mg', 'Una vez al día por la mañana', 'RX-ACTIVE']],
  },
  {
    dx: [['I10', 'COND-ACTIVE', 'Hipertensión de larga data.'], ['M17', 'COND-ACTIVE', 'Gonartrosis bilateral, grado II.'], ['E11', 'COND-ACTIVE', 'Diabetes tipo 2 con buen control.']],
    alergias: [['MED-CIPROFLOXACINO', 'CRIT-HIGH']],
    recetas: [['MED-ENALAPRIL', '10 mg', 'Dos veces al día', 'RX-ACTIVE'], ['MED-METFORMINA', '850 mg', 'Con las comidas', 'RX-ACTIVE'], ['MED-INSULINA-NPH', '12 UI', 'Por la noche, subcutánea', 'RX-ACTIVE']],
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
      verificationStatusConceptId: i === 0 ? VERIFICACION_DX['DXV-CONFIRMED']! : VERIFICACION_DX['DXV-PROVISIONAL']!,
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
      substanceConceptId: sustancia === 'ALIMENTO-MANI' ? SUSTANCIA_MANI : sustancia === 'POLVO' ? SUSTANCIA_POLVO : MEDICAMENTO[sustancia]!,
      typeConceptId: TIPO_ALERGIA,
      categoryConceptId: sustancia === 'ALIMENTO-MANI' ? CATEGORIA_ALERGIA['ALG-FOOD']! : sustancia === 'POLVO' ? CATEGORIA_ALERGIA['ALG-ENVIRONMENT']! : CATEGORIA_ALERGIA['ALG-MEDICATION']!,
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

export const episodios = new Coleccion<{ id: string; patientProfileId: string; tenantId: string; typeConceptId: string; statusConceptId: string; responsiblePractitionerId: string; startAt: string; endAt: string | null; createdAt: string }>(
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
      chiefComplaintText: ['Control de rutina', 'Cansancio y dolor de cabeza'][visita]!,
      subjectiveText: `Paciente refiere ${['sentirse bien, sin síntomas nuevos', 'cansancio de dos semanas de evolución y cefalea vespertina'][visita]}. Cumple el tratamiento.`,
      objectiveText: `PA ${118 + (k % 5) * 8}/${76 + (k % 4) * 4}, FC ${64 + (k % 6) * 5}, afebril. Examen cardiopulmonar sin hallazgos.`,
      assessmentText: visita === 0 ? 'Estable. Buen control de su patología de base.' : 'Cefalea tensional probable. Descartar anemia.',
      planText: visita === 0 ? 'Continuar tratamiento. Control en 3 meses con laboratorio.' : 'Solicitar hemograma y perfil tiroideo. Paracetamol a demanda. Control en 2 semanas.',
      signedAt: visita === 0 ? iso(-47, 10) : null,
      releasedToPatient: visita === 0,
      createdAt: iso(-visita * 45 - 2, 9, 40),
    })),
  ) as (NotaSimulada & { id: string })[],
);

export function planesDe(p: PacienteSimulado) {
  const perfil = perfilClinicoDe(p);
  if (perfil.dx.length < 2) return [];
  return [
    {
      id: uuid(`careplan-${p.id}`),
      statusConceptId: ESTADO['ST-ACTIVE']!,
      intentConceptId: uuid('concept-careplan-intent-plan'),
      goalText: 'Presión arterial por debajo de 130/80 y LDL menor a 100 en 6 meses.',
      startDate: isoDia(-60),
      endDate: isoDia(120),
      activities: [
        { id: uuid(`cp-act-1-${p.id}`), statusConceptId: ESTADO['ST-COMPLETED']!, detailText: 'Perfil lipídico basal', scheduledAt: iso(-55) },
        { id: uuid(`cp-act-2-${p.id}`), statusConceptId: ESTADO['ST-IN-PROGRESS']!, detailText: 'Caminata 30 minutos, 5 veces por semana', scheduledAt: iso(-50) },
        { id: uuid(`cp-act-3-${p.id}`), statusConceptId: ESTADO['ST-PENDING']!, detailText: 'Control con nutrición', scheduledAt: iso(12) },
        { id: uuid(`cp-act-4-${p.id}`), statusConceptId: ESTADO['ST-PENDING']!, detailText: 'Ecocardiograma de control', scheduledAt: iso(40) },
      ],
      createdAt: iso(-60),
    },
  ];
}

export function documentosDe(p: PacienteSimulado) {
  return [
    { id: uuid(`doc-lab-${p.id}`), title: 'Laboratorio completo', categoryConceptId: CATEGORIA_DOCUMENTO, statusConceptId: ESTADO['ST-PUBLISHED']!, authorText: 'Laboratorio Central', isExternal: true, documentDate: iso(-48), createdAt: iso(-47) },
    { id: uuid(`doc-ecg-${p.id}`), title: 'Electrocardiograma de reposo', categoryConceptId: CATEGORIA_DOCUMENTO, statusConceptId: ESTADO['ST-PUBLISHED']!, authorText: MEDICA.displayName, isExternal: false, documentDate: iso(-2), createdAt: iso(-2) },
    { id: uuid(`doc-rx-${p.id}`), title: 'Radiografía de tórax — informe', categoryConceptId: CATEGORIA_DOCUMENTO, statusConceptId: ESTADO['ST-DRAFT']!, authorText: 'Centro de Imagen Sur', isExternal: true, documentDate: iso(-100), createdAt: iso(-99) },
  ];
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
}

export const ordenes = new Coleccion<OrdenSimulada>(
  PACIENTES.flatMap((p, k) =>
    [
      ['STUDY-HEMOGRAMA', 'SRQ-LAB', 'ST-COMPLETED'],
      ['STUDY-PERFIL-LIPIDICO', 'SRQ-LAB', 'ST-COMPLETED'],
      ['STUDY-ECG', 'SRQ-PROCEDURE', 'ST-COMPLETED'],
      ...(k % 2 === 0 ? [['STUDY-ECO-ABD', 'SRQ-IMAGING', 'ST-PENDING']] : [['STUDY-TSH', 'SRQ-LAB', 'ST-IN-PROGRESS']]),
    ].map(([estudio, categoria, estado], i) => ({
      id: uuid(`order-${p.id}-${estudio}`),
      patientProfileId: p.id,
      codeConceptId: ESTUDIO[estudio as keyof typeof ESTUDIO]!,
      categoryConceptId: CATEGORIA_ORDEN[categoria as keyof typeof CATEGORIA_ORDEN]!,
      priorityConceptId: i === 3 ? PRIORIDAD['PRI-URGENT']! : PRIORIDAD['PRI-ROUTINE']!,
      statusConceptId: ESTADO[estado as keyof typeof ESTADO]!,
      requesterProfileId: MEDICA.id,
      encounterId: uuid(`encounter-${p.id}-${i % 3}`),
      reasonText: ['Control anual', 'Seguimiento de dislipidemia', 'Palpitaciones', 'Dolor abdominal / control tiroideo'][i]!,
      createdAt: iso(-50 + i * 12),
    })),
  ),
);
