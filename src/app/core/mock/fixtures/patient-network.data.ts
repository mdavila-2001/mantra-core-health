import type { FollowUpOrigin } from '../../data-access/scheduling/scheduling.types';
import type {
  SimulatedCondition,
  SimulatedEncounter,
  SimulatedNote,
  SimulatedObservation,
  SimulatedOrder,
  SimulatedPrescription,
} from './clinic';
import type { ReservaSimulada } from './agenda';
import {
  APPOINTMENT_TYPE,
  ACTIVITY,
  BOOKING_STATUS,
  CANAL,
  CLINICAL_COURSE,
  CONDITION_STATUS,
  DIAGNOSIS,
  ENCOUNTER_CLASS,
  ENCOUNTER_STATUS,
  ESTUDIO,
  MEDICAMENTO,
  MEDICAMENTO_POR_CONCENTRACION,
  OBSERVATION,
  OBSERVATION_CATEGORY,
  OBSERVATION_UNIT,
  ORDER_CATEGORY,
  PRESCRIPTION_STATUS,
  PRIORITY,
  SEVERITY,
  STATUS,
  VERIFICATION_DX,
} from './concepts';
import { MEDICAL, PACIENTE, PROFESSIONALS } from './people';
import { iso, isoDia, uuid } from '../mock-store';
import { TENANT_CLINICA, TENANT_LABORATORIO } from '../mock-session';

/* ============================================================================
    La historia clínica completa de la paciente de prueba (Ana Lucía Pérez
    Quiroga, `pid-paciente`) para la red clínica del expediente (Franja 1 de
    «Recorrido → red de nodos», contrato del 06/11/2026).

    Son ~18 meses coherentes que ejercitan cada vínculo del contrato:

    - **Episodio tiroideo.** Primera consulta por cansancio, cefalea y caída de
      cabello (día −540). Dos presuntivos en diferencial —anemia ferropénica e
      hipotiroidismo—, cada uno con su análisis (`reasonConditionId`). El
      hemograma normal **descarta** la anemia, que queda reemplazada por el
      hipotiroidismo (`replacedByConditionId`); la TSH elevada lo **confirma**
      (`basedOn` → informe). Levotiroxina 25 → 50 → 75 mcg, cada receta
      reemplazada por la siguiente.
    - **Citas.** Primera consulta, reconsultas encadenadas con `followUpOf`, una
      reconsulta cancelada por la paciente y un control al que no asistió.
    - **Derivaciones.** Endocrinología (aceptada, con la atención de llegada en
      `targetEncounterId` y la contrarreferencia) y neurología (rechazada con
      motivo).
    - **Internación.** Pielonefritis aguda (día −210): urgencia, internación de
      cuatro días con urocultivo y ecografía pedidos para ese diagnóstico, y
      ciprofloxacino con indicación.
    - **Último control** (día −25): palpitaciones; un presuntivo de ansiedad
      todavía **en estudio** —es el que la demostración rechaza desde el
      diálogo de verificación— y una TSH suprimida que lo explica.

    Todo se **agrega** al final de cada colección: los datos que ya usaban las
    pruebas de la paciente (sus tres diagnósticos, recetas, órdenes y
    derivaciones) no cambian ni de lugar ni de índice. Archivo `.data.ts`: es un
    catálogo de datos, no lógica.
    ========================================================================== */

/** Los profesionales de esta historia, por su slug fijo (`people.ts`). */
function bySlug(slug: string) {
  return PROFESSIONALS.find((p) => p.slug === slug) ?? MEDICAL;
}
const ENDOCRINOLOGIST = bySlug('endocrinologa');
const NEUROLOGIST = bySlug('neurologa');
const ER_DOCTOR = bySlug('medgeneral');

const P = PACIENTE.id;
const id = (key: string) => uuid(`patient-network-${key}`);

/** Los identificadores que el resto de la historia (y sus pruebas) nombra. */
export const NETWORK_IDS = {
  firstVisit: id('encounter-first-visit'),
  results: id('encounter-results'),
  doseControl: id('encounter-dose-control'),
  endocrinology: id('encounter-endocrinology'),
  emergency: id('encounter-emergency'),
  inpatient: id('encounter-inpatient'),
  postDischarge: id('encounter-post-discharge'),
  palpitations: id('encounter-palpitations'),
  episode: id('episode-pyelonephritis'),
  hypothyroidism: id('condition-hypothyroidism'),
  anemia: id('condition-anemia'),
  pyelonephritis: id('condition-pyelonephritis'),
  anxiety: id('condition-anxiety'),
  bloodCount: id('order-blood-count'),
  tsh: id('order-tsh'),
  tshControl: id('order-tsh-control'),
  urineCulture: id('order-urine-culture'),
  kidneyUltrasound: id('order-kidney-ultrasound'),
  tshSuppressed: id('order-tsh-suppressed'),
  levo25: id('rx-levothyroxine-25'),
  levo50: id('rx-levothyroxine-50'),
  levo75: id('rx-levothyroxine-75'),
  ciprofloxacin: id('rx-ciprofloxacin'),
  referralEndocrinology: id('referral-endocrinology'),
  referralNeurology: id('referral-neurology'),
  bookingFirst: id('booking-first'),
  bookingResults: id('booking-results'),
  bookingCancelled: id('booking-cancelled'),
  bookingDose: id('booking-dose'),
  bookingNoShow: id('booking-no-show'),
  bookingPostDischarge: id('booking-post-discharge'),
  bookingPalpitations: id('booking-palpitations'),
  firstVisitNote: id('note-first-visit'),
} as const;

const N = NETWORK_IDS;
const report = (orderId: string) => uuid(`report-${orderId}`);

/* ---- atenciones ---------------------------------------------------------- */

export function networkEncounters(): SimulatedEncounter[] {
  const finished = ENCOUNTER_STATUS['ENCST-FINISHED']!;
  const row = (
    encounterId: string,
    day: number,
    klass: keyof typeof ENCOUNTER_CLASS,
    practitionerId: string,
    reasonText: string,
    endDay = day,
    extra: Partial<SimulatedEncounter> = {},
  ): SimulatedEncounter => ({
    id: encounterId,
    patientProfileId: P,
    statusConceptId: finished,
    classConceptId: ENCOUNTER_CLASS[klass]!,
    primaryPractitionerId: practitionerId,
    reasonText,
    startAt: iso(day, 9),
    endAt: endDay === day ? iso(day, 9, 40) : iso(endDay, 11),
    ...extra,
  });
  return [
    row(N.firstVisit, -540, 'ENC-AMB', MEDICAL.id, 'Cansancio, cefalea y caída de cabello de dos meses'),
    row(N.results, -526, 'ENC-AMB', MEDICAL.id, 'Reconsulta: lectura de hemograma y TSH'),
    row(N.doseControl, -470, 'ENC-VIRTUAL', MEDICAL.id, 'Reconsulta: control de levotiroxina, persiste el cansancio'),
    row(N.endocrinology, -430, 'ENC-AMB', ENDOCRINOLOGIST.id, 'Interconsulta por hipotiroidismo y deseo de embarazo'),
    row(N.emergency, -210, 'ENC-EMER', ER_DOCTOR.id, 'Fiebre, escalofríos, disuria y dolor lumbar derecho'),
    row(N.inpatient, -210, 'ENC-IMP', MEDICAL.id, 'Internación por pielonefritis aguda', -206, { episodeId: N.episode }),
    row(N.postDischarge, -190, 'ENC-AMB', MEDICAL.id, 'Control después del alta de internación'),
    row(N.palpitations, -25, 'ENC-AMB', MEDICAL.id, 'Palpitaciones y temblor fino de tres semanas'),
  ];
}

export function networkEpisodes(episodeTypeConceptId: string) {
  return [
    {
      id: N.episode,
      patientProfileId: P,
      tenantId: TENANT_CLINICA,
      typeConceptId: episodeTypeConceptId,
      statusConceptId: STATUS['ST-CLOSED']!,
      responsiblePractitionerId: MEDICAL.id,
      startAt: iso(-210, 12),
      endAt: iso(-206, 11),
      createdAt: iso(-210, 12),
    },
  ];
}

/* ---- diagnósticos -------------------------------------------------------- */

export function networkConditions(dxCategory: string): SimulatedCondition[] {
  const base = {
    patientProfileId: P,
    categoryConceptId: dxCategory,
    severityConceptId: SEVERITY['SEV-MILD']!,
  };
  return [
    {
      ...base,
      id: N.hypothyroidism,
      codeConceptId: DIAGNOSIS['E03.9']!,
      clinicalStatusConceptId: CONDITION_STATUS['COND_ACTIVE']!,
      verificationStatusConceptId: VERIFICATION_DX['COND_CONFIRMED']!,
      verification: {
        outcome: 'CONFIRMED',
        decidedAt: iso(-526, 9, 30),
        decidedByProfileId: MEDICAL.id,
        reasonText: 'TSH 8,9 mUI/L con T4 libre baja: hipotiroidismo primario.',
        basedOn: { kind: 'ANALYSIS', serviceRequestId: N.tsh, diagnosticReportId: report(N.tsh) },
      },
      clinicalCourseConceptId: CLINICAL_COURSE['COND_COURSE_CHRONIC']!,
      encounterId: N.firstVisit,
      onsetAt: iso(-600),
      noteText: 'Presuntivo en la primera consulta; confirmado con la TSH. Tiroiditis de Hashimoto según endocrinología.',
      createdAt: iso(-540, 9, 30),
    },
    {
      ...base,
      id: N.anemia,
      codeConceptId: DIAGNOSIS['D50']!,
      clinicalStatusConceptId: CONDITION_STATUS['COND_RESOLVED']!,
      verificationStatusConceptId: VERIFICATION_DX['COND_REFUTED']!,
      verification: {
        outcome: 'REFUTED',
        decidedAt: iso(-526, 9, 25),
        decidedByProfileId: MEDICAL.id,
        reasonText: 'Hemoglobina y ferritina normales: el cansancio no se explica por anemia.',
        basedOn: { kind: 'ANALYSIS', serviceRequestId: N.bloodCount, diagnosticReportId: report(N.bloodCount) },
      },
      replacedByConditionId: N.hypothyroidism,
      encounterId: N.firstVisit,
      onsetAt: iso(-540),
      resolvedAt: iso(-526, 9, 25),
      noteText: 'Diferencial del cansancio con menstruaciones abundantes.',
      createdAt: iso(-540, 9, 31),
    },
    {
      ...base,
      id: N.pyelonephritis,
      codeConceptId: DIAGNOSIS['N39.0']!,
      clinicalStatusConceptId: CONDITION_STATUS['COND_RESOLVED']!,
      verificationStatusConceptId: VERIFICATION_DX['COND_CONFIRMED']!,
      severityConceptId: SEVERITY['SEV-MODERATE']!,
      clinicalCourseConceptId: CLINICAL_COURSE['COND_COURSE_ACUTE']!,
      encounterId: N.emergency,
      onsetAt: iso(-212),
      expectedResolutionAt: iso(-196),
      resolvedAt: iso(-190, 9, 30),
      noteText: 'Pielonefritis aguda derecha por E. coli sensible a ciprofloxacino.',
      createdAt: iso(-210, 10),
    },
    {
      ...base,
      id: N.anxiety,
      codeConceptId: DIAGNOSIS['F41.1']!,
      clinicalStatusConceptId: CONDITION_STATUS['COND_ACTIVE']!,
      verificationStatusConceptId: VERIFICATION_DX['COND_PROVISIONAL']!,
      encounterId: N.palpitations,
      onsetAt: iso(-46),
      expectedResolutionAt: iso(70),
      noteText: 'Palpitaciones, insomnio e irritabilidad. Descartar sobredosificación de levotiroxina.',
      createdAt: iso(-25, 9, 30),
    },
  ];
}

/* ---- órdenes e informes -------------------------------------------------- */

interface NetworkStudy {
  readonly orderId: string;
  readonly study: keyof typeof ESTUDIO;
  readonly category: keyof typeof ORDER_CATEGORY;
  readonly encounterId: string;
  readonly reasonConditionId: string;
  readonly day: number;
  readonly reasonText: string;
  readonly conclusion: string;
}

const STUDIES: readonly NetworkStudy[] = [
  { orderId: N.bloodCount, study: 'STUDY-HEMOGRAMA', category: 'SRQ-LAB', encounterId: N.firstVisit, reasonConditionId: N.anemia, day: -540, reasonText: 'Descartar anemia ferropénica', conclusion: 'Hemoglobina 13,6 g/dL, VCM 89 fL, ferritina 64 ng/mL. Sin anemia ni ferropenia.' },
  { orderId: N.tsh, study: 'STUDY-TSH', category: 'SRQ-LAB', encounterId: N.firstVisit, reasonConditionId: N.hypothyroidism, day: -540, reasonText: 'Sospecha de hipotiroidismo', conclusion: 'TSH 8,9 mUI/L (elevada), T4 libre 0,68 ng/dL (baja). Compatible con hipotiroidismo primario.' },
  { orderId: N.tshControl, study: 'STUDY-TSH', category: 'SRQ-LAB', encounterId: N.doseControl, reasonConditionId: N.hypothyroidism, day: -470, reasonText: 'Control de dosis de levotiroxina', conclusion: 'TSH 5,6 mUI/L: mejora parcial con 25 mcg.' },
  { orderId: N.urineCulture, study: 'STUDY-CULTIVO', category: 'SRQ-LAB', encounterId: N.emergency, reasonConditionId: N.pyelonephritis, day: -210, reasonText: 'Urocultivo con antibiograma', conclusion: 'Más de 100.000 UFC/mL de E. coli, sensible a ciprofloxacino y resistente a ampicilina.' },
  { orderId: N.kidneyUltrasound, study: 'STUDY-ECO-ABD', category: 'SRQ-IMAGING', encounterId: N.inpatient, reasonConditionId: N.pyelonephritis, day: -209, reasonText: 'Ecografía renal: descartar obstrucción o absceso', conclusion: 'Riñón derecho aumentado de tamaño con edema perirrenal leve. Sin dilatación de la vía excretora ni litiasis.' },
  { orderId: N.tshSuppressed, study: 'STUDY-TSH', category: 'SRQ-LAB', encounterId: N.palpitations, reasonConditionId: N.anxiety, day: -25, reasonText: 'Palpitaciones: descartar exceso de levotiroxina', conclusion: 'TSH 0,09 mUI/L (suprimida), T4 libre 1,9 ng/dL (alta): sobredosificación de levotiroxina.' },
];

export function networkOrders(): SimulatedOrder[] {
  return STUDIES.map((s) => ({
    id: s.orderId,
    patientProfileId: P,
    codeConceptId: ESTUDIO[s.study]!,
    categoryConceptId: ORDER_CATEGORY[s.category]!,
    priorityConceptId: s.encounterId === N.emergency ? PRIORITY['PRI-URGENT']! : PRIORITY['PRI-ROUTINE']!,
    statusConceptId: STATUS['ST-COMPLETED']!,
    requesterProfileId: s.encounterId === N.emergency ? ER_DOCTOR.id : MEDICAL.id,
    encounterId: s.encounterId,
    reasonConditionId: s.reasonConditionId,
    reasonText: s.reasonText,
    createdAt: iso(s.day, 9, 35),
  }));
}

/** Los ids de las órdenes de esta historia: sus informes se siembran aparte, todos liberados. */
export const NETWORK_ORDER_IDS: ReadonlySet<string> = new Set(STUDIES.map((s) => s.orderId));

/**
 * Un valor de un informe de esta historia, como lo publica
 * `GET /diagnostics/patients/:id/reports/:reportId` (lectura del profesional,
 * 06/11/2026): el número como texto decimal exacto, el rango impreso y, si el
 * laboratorio lo marcó, su interpretación (código y rótulo, tal cual).
 */
export interface ValorDeInformeSimulado {
  readonly code: string;
  readonly name: string;
  readonly value: string;
  readonly valueKind: 'QUANTITY' | 'TEXT';
  readonly unit: string | null;
  readonly low: string | null;
  readonly high: string | null;
  readonly rangeText: string | null;
  readonly interpretation: { readonly code: string; readonly label: string } | null;
}

const ALTO = { code: 'H', label: 'Alto' } as const;
const BAJO = { code: 'L', label: 'Bajo' } as const;
const ANORMAL = { code: 'A', label: 'Anormal' } as const;
const q = (
  code: string,
  name: string,
  value: string,
  unit: string,
  low: string,
  high: string,
  interpretation: ValorDeInformeSimulado['interpretation'] = null,
): ValorDeInformeSimulado => ({ code, name, value, valueKind: 'QUANTITY', unit, low, high, rangeText: null, interpretation });

/** Los valores de cada informe, coherentes con su conclusión. La ecografía no trae valores. */
const VALORES_POR_ORDEN: Readonly<Record<string, readonly ValorDeInformeSimulado[]>> = {
  [N.bloodCount]: [
    q('LAB-HB', 'Hemoglobina', '13.6', 'g/dL', '12.0', '16.0'),
    q('LAB-VCM', 'Volumen corpuscular medio', '89', 'fL', '80', '100'),
    q('LAB-FERRITINA', 'Ferritina', '64', 'ng/mL', '15', '150'),
  ],
  [N.tsh]: [
    q('LAB-TSH', 'TSH', '8.9', 'mUI/L', '0.4', '4.0', ALTO),
    q('LAB-T4L', 'T4 libre', '0.68', 'ng/dL', '0.80', '1.80', BAJO),
  ],
  [N.tshControl]: [q('LAB-TSH', 'TSH', '5.6', 'mUI/L', '0.4', '4.0', ALTO)],
  [N.urineCulture]: [
    {
      code: 'LAB-UROCULTIVO',
      name: 'Urocultivo',
      value: 'Más de 100.000 UFC/mL de Escherichia coli',
      valueKind: 'TEXT',
      unit: null,
      low: null,
      high: null,
      rangeText: 'Menos de 10.000 UFC/mL',
      interpretation: ANORMAL,
    },
  ],
  [N.tshSuppressed]: [
    q('LAB-TSH', 'TSH', '0.09', 'mUI/L', '0.4', '4.0', BAJO),
    q('LAB-T4L', 'T4 libre', '1.9', 'ng/dL', '0.80', '1.80', ALTO),
  ],
};

/** Los valores del informe `reportId` de esta historia; `[]` si no es de ella o no trae valores. */
export function valoresDelInforme(reportId: string): readonly ValorDeInformeSimulado[] {
  const estudio = STUDIES.find((s) => report(s.orderId) === reportId);
  return estudio === undefined ? [] : (VALORES_POR_ORDEN[estudio.orderId] ?? []);
}

/** Los informes, con la misma forma que `InformeSimulado` (`diagnostics.handlers.ts`). */
export function networkReports() {
  return STUDIES.map((s) => ({
    id: report(s.orderId),
    patientProfileId: P,
    serviceRequestId: s.orderId,
    codeConceptId: ESTUDIO[s.study]!,
    categoryConceptId: ORDER_CATEGORY[s.category]!,
    lifecycleStatusConceptId: STATUS['ST-COMPLETED']!,
    currentVersionId: uuid(`report-version-${s.orderId}`),
    released: true,
    patientVisible: true,
    conclusionText: s.conclusion,
    issuedAt: iso(s.day + 2, 14),
    releasedAt: iso(s.day + 2, 16),
    createdAt: iso(s.day + 2, 13),
    custodianTenantId: s.category === 'SRQ-IMAGING' ? TENANT_CLINICA : TENANT_LABORATORIO,
  }));
}

/* ---- medicación ---------------------------------------------------------- */

export function networkPrescriptions(): SimulatedPrescription[] {
  // Cada receta con el concepto de su concentración: la de 25 no puede decir
  // «Levotiroxina 50 mcg comprimidos».
  const CONCEPTO_DE_LA_DOSIS: Readonly<Record<string, string>> = {
    '25 mcg': MEDICAMENTO_POR_CONCENTRACION['MED-LEVOTIROXINA-25']!,
    '50 mcg': MEDICAMENTO['MED-LEVOTIROXINA']!,
    '75 mcg': MEDICAMENTO_POR_CONCENTRACION['MED-LEVOTIROXINA-75']!,
  };
  const levo = (
    rxId: string,
    dose: string,
    encounterId: string,
    prescriber: string,
    from: number,
    to: number | null,
    replacedBy?: string,
  ): SimulatedPrescription => ({
    id: rxId,
    patientProfileId: P,
    medicationConceptId: CONCEPTO_DE_LA_DOSIS[dose]!,
    encounterId,
    indicationConditionId: N.hypothyroidism,
    statusConceptId: PRESCRIPTION_STATUS[to === null ? 'MR_ISSUED' : 'MR_COMPLETED']!,
    prescriberProfileId: prescriber,
    doseText: dose,
    frequencyText: 'En ayunas, 30 minutos antes del desayuno',
    validFrom: isoDia(from),
    validTo: to === null ? null : isoDia(to),
    patientInstructionsText: `Tomar ${dose} en ayunas con agua, siempre a la misma hora.`,
    signedAt: iso(from, 9, 45),
    issuedAt: iso(from, 9, 50),
    createdAt: iso(from, 9, 40),
    ...(replacedBy === undefined ? {} : { replacedByRequestId: replacedBy }),
  });
  return [
    levo(N.levo25, '25 mcg', N.results, MEDICAL.id, -526, -470, N.levo50),
    levo(N.levo50, '50 mcg', N.doseControl, MEDICAL.id, -470, -430, N.levo75),
    levo(N.levo75, '75 mcg', N.endocrinology, ENDOCRINOLOGIST.id, -430, null),
    {
      id: N.ciprofloxacin,
      patientProfileId: P,
      medicationConceptId: MEDICAMENTO['MED-CIPROFLOXACINO']!,
      encounterId: N.inpatient,
      indicationConditionId: N.pyelonephritis,
      statusConceptId: PRESCRIPTION_STATUS['MR_COMPLETED']!,
      prescriberProfileId: MEDICAL.id,
      doseText: '500 mg',
      frequencyText: 'Cada 12 horas por 10 días',
      validFrom: isoDia(-210),
      validTo: isoDia(-200),
      patientInstructionsText: 'Completar los 10 días aunque desaparezca la fiebre. Alergia a amoxicilina registrada.',
      signedAt: iso(-210, 12, 30),
      issuedAt: iso(-210, 12, 35),
      createdAt: iso(-210, 12, 20),
    },
  ];
}

/* ---- signos vitales ------------------------------------------------------ */

export function networkObservations(): SimulatedObservation[] {
  const rows: readonly (readonly [string, keyof typeof OBSERVATION, number, keyof typeof OBSERVATION_UNIT, number])[] = [
    [N.firstVisit, 'OBS-BP-SYS', 112, 'OBSU-MMHG', -540],
    [N.firstVisit, 'OBS-BP-DIA', 72, 'OBSU-MMHG', -540],
    [N.firstVisit, 'OBS-HR', 58, 'OBSU-BPM', -540],
    [N.firstVisit, 'OBS-TEMP', 36.2, 'OBSU-CELSIUS', -540],
    [N.firstVisit, 'OBS-WEIGHT', 64.5, 'OBSU-KG', -540],
    [N.emergency, 'OBS-BP-SYS', 104, 'OBSU-MMHG', -210],
    [N.emergency, 'OBS-BP-DIA', 66, 'OBSU-MMHG', -210],
    [N.emergency, 'OBS-HR', 108, 'OBSU-BPM', -210],
    [N.emergency, 'OBS-TEMP', 38.9, 'OBSU-CELSIUS', -210],
    [N.palpitations, 'OBS-HR', 104, 'OBSU-BPM', -25],
    [N.palpitations, 'OBS-WEIGHT', 61.8, 'OBSU-KG', -25],
  ];
  return rows.map(([encounterId, code, value, unit, day], i) => ({
    id: id(`obs-${encounterId}-${code}`),
    patientProfileId: P,
    codeConceptId: OBSERVATION[code]!,
    statusConceptId: STATUS['ST-COMPLETED']!,
    valueDecimal: String(value),
    quantityValue: String(value),
    quantityUnitConceptId: OBSERVATION_UNIT[unit]!,
    effectiveStartAt: iso(day, 9, 5 + i),
    encounterId,
    categoryConceptId: OBSERVATION_CATEGORY['OBSC-VITALS']!,
  }));
}

/* ---- nota de la primera consulta ----------------------------------------- */

export function networkNotes(noteTypeConceptId: string): SimulatedNote[] {
  return [
    {
      id: N.firstVisitNote,
      noteId: N.firstVisitNote,
      patientProfileId: P,
      encounterId: N.firstVisit,
      noteTypeConceptId,
      lifecycleStatusConceptId: STATUS['ST-COMPLETED']!,
      currentVersionId: id('note-first-visit-version'),
      versionNumber: 1,
      authorProfileId: MEDICAL.id,
      entries: [
        { label: 'Motivo', value: 'Cansancio, cefalea y caída de cabello de dos meses' },
        { label: 'Frecuencia cardíaca', value: '58 lpm' },
        { label: 'Exploración', value: 'Piel seca, tiroides no palpable, reflejos lentos' },
        { label: 'Impresión', value: 'Hipotiroidismo probable. Descartar anemia ferropénica.' },
        { label: 'Estudios pedidos', value: 'Hemograma con ferritina, TSH y T4 libre' },
      ],
      chiefComplaintText: '',
      subjectiveText: '',
      objectiveText: '',
      assessmentText: '',
      planText: '',
      signedAt: iso(-540, 9, 45),
      releasedToPatient: true,
      createdAt: iso(-540, 9, 40),
    },
  ];
}

/* ---- citas --------------------------------------------------------------- */

/**
 * Las citas con la médica. Caen antes de la ventana de ±21 días de los cupos
 * generados, así que llevan un cupo propio que no existe en `cupos` —como
 * cualquier cita vieja cuyo horario ya no se publica— y la reconsulta sembrada
 * de `agenda.ts` (la más reciente atendida) no cambia.
 */
export function networkBookings(resourceId: string): ReservaSimulada[] {
  const row = (
    bookingId: string,
    day: number,
    state: keyof typeof BOOKING_STATUS,
    type: keyof typeof APPOINTMENT_TYPE,
    reasonText: string,
    extra: Partial<ReservaSimulada> = {},
  ): ReservaSimulada => {
    const startAt = iso(day, 9);
    const endAt = iso(day, 9, 30);
    const attended = state === 'BK-COMPLETED';
    return {
      id: bookingId,
      patientProfileId: P,
      resourceId,
      bookableSlotId: id(`slot-${bookingId}`),
      appointmentId: state === 'BK-CANCELLED' ? null : id(`appointment-${bookingId}`),
      typeConceptId: APPOINTMENT_TYPE[type]!,
      startAt,
      endAt,
      statusConceptId: BOOKING_STATUS[state]!,
      serviceConceptId: ACTIVITY['ACT-CONSULTA']!,
      bookingChannelConceptId: CANAL['CH-PRESENCIAL']!,
      confirmedAt: iso(day - 2, 10),
      checkedInAt: attended ? iso(day, 8, 50) : null,
      reasonText,
      patientName: PACIENTE.displayName,
      insuranceCarrierName: PACIENTE.aseguradora ?? null,
      rescheduledFrom: null,
      statusReason: null,
      delayNotice: null,
      paymentState: attended
        ? { state: 'PAID', label: 'Pagada', conceptId: STATUS['ST-COMPLETED']!, insuranceUsed: false, markedByUserId: MEDICAL.userId, markedAt: iso(day, 9, 35) }
        : null,
      followUpOf: null,
      createdAt: iso(day - 7, 18),
      ...extra,
    };
  };
  const from = (bookingId: string, encounterId: string): FollowUpOrigin => ({ bookingId, encounterId });
  return [
    row(N.bookingFirst, -540, 'BK-COMPLETED', 'APT-PRIMERA', 'Cansancio y caída de cabello'),
    row(N.bookingResults, -526, 'BK-COMPLETED', 'APT-RECONSULTA', 'Reconsulta: resultados de laboratorio', {
      followUpOf: from(N.bookingFirst, N.firstVisit),
    }),
    row(N.bookingCancelled, -485, 'BK-CANCELLED', 'APT-RECONSULTA', 'Reconsulta: control de levotiroxina', {
      followUpOf: from(N.bookingResults, N.results),
      statusReason: { reasonText: 'Viaje de trabajo; pide otra fecha', actorKind: 'PATIENT', toStateConceptId: BOOKING_STATUS['BK-CANCELLED']!, changedAt: iso(-487, 18) },
    }),
    row(N.bookingDose, -470, 'BK-COMPLETED', 'APT-RECONSULTA', 'Reconsulta: control de levotiroxina', {
      followUpOf: from(N.bookingResults, N.results),
      bookingChannelConceptId: CANAL['CH-TELECONSULTA']!,
      serviceConceptId: ACTIVITY['ACT-TELECONSULTA']!,
    }),
    row(N.bookingNoShow, -300, 'BK-NO-SHOW', 'APT-CONTROL', 'Control trimestral de TSH', {
      statusReason: { reasonText: 'No se presentó ni avisó', actorKind: 'PROVIDER', toStateConceptId: BOOKING_STATUS['BK-NO-SHOW']!, changedAt: iso(-300, 9, 45) },
    }),
    row(N.bookingPostDischarge, -190, 'BK-COMPLETED', 'APT-CONTROL', 'Control después del alta de internación'),
    row(N.bookingPalpitations, -25, 'BK-COMPLETED', 'APT-CONTROL', 'Palpitaciones y temblor'),
  ];
}

/* ---- derivaciones -------------------------------------------------------- */

/**
 * Las dos derivaciones, con la forma de `SimulatedReferral`
 * (`referrals.handlers.ts`). El estado llega por parámetro para no importar
 * aquel módulo, que importa éste.
 */
export function networkReferrals(status: { readonly completed: string; readonly rejected: string }) {
  return [
    {
      id: N.referralEndocrinology,
      patientProfileId: P,
      sourceEncounterId: N.doseControl,
      referringProfileId: MEDICAL.id,
      targetProfileId: ENDOCRINOLOGIST.id,
      targetTenantId: null,
      targetServiceCatalogId: null,
      referralType: 'CONSULTATION',
      reasonText: 'Hipotiroidismo en ajuste en mujer que planifica embarazo.',
      priorityConceptId: null,
      statusConceptId: status.completed,
      validUntil: `${isoDia(-380)}T00:00:00.000Z`,
      respondedAt: iso(-466, 11),
      createdAt: iso(-470, 9, 50),
      targetDisplayName: ENDOCRINOLOGIST.displayName,
      targetServiceName: null,
      requestedServiceText: 'Evaluación endocrinológica preconcepcional',
      diagnosisText: 'Hipotiroidismo primario (E03.9)',
      clinicalSummary: 'TSH 8,9 → 5,6 mUI/L con levotiroxina 25 mcg. Desea embarazo en el próximo año.',
      treatmentGivenText: 'Levotiroxina 50 mcg desde hoy.',
      counterReferralText:
        'Anti-TPO 412 UI/mL: tiroiditis de Hashimoto. Meta de TSH menor a 2,5 mUI/L antes de buscar embarazo: levotiroxina 75 mcg. TSH en 6 semanas y control al confirmar embarazo.',
      counterReferralAt: iso(-428, 12),
      targetEncounterId: N.endocrinology,
    },
    {
      id: N.referralNeurology,
      patientProfileId: P,
      sourceEncounterId: N.firstVisit,
      referringProfileId: MEDICAL.id,
      targetProfileId: NEUROLOGIST.id,
      targetTenantId: null,
      targetServiceCatalogId: null,
      referralType: 'CONSULTATION',
      reasonText: 'Cefalea de dos meses.',
      priorityConceptId: null,
      statusConceptId: status.rejected,
      validUntil: `${isoDia(-480)}T00:00:00.000Z`,
      respondedAt: iso(-537, 16),
      createdAt: iso(-540, 9, 55),
      targetDisplayName: NEUROLOGIST.displayName,
      targetServiceName: null,
      requestedServiceText: 'Evaluación neurológica de cefalea',
      diagnosisText: 'Cefalea en estudio',
      clinicalSummary: 'Cefalea opresiva bilateral vespertina, sin signos de alarma. Examen neurológico normal.',
      rejectReason:
        'Cefalea tensional sin signos de alarma y examen normal: corresponde manejo en atención primaria. Reenviar si aparecen signos de alarma.',
      targetEncounterId: null,
    },
  ];
}
