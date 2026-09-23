import { conceptos, ESPECIALIDAD, ESTADO } from '../fixtures/conceptos';
import { MEDICA, PROFESIONALES } from '../fixtures/personas';
import { notFound, reply, validation, type MockRequest, type MockRouter } from '../mock-router';
import { IDS, TENANT_FARMACIA } from '../mock-session';
import { ahora, Coleccion, cuerpo, iso, isoDia, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Laboratorio farmacéutico y visitadores médicos: el laboratorio, su
    personal, productos, materiales, la agenda de visitas del médico y las
    solicitudes de visita en ambos sentidos.
    ========================================================================== */

const LAB_ID = uuid('pharma-lab-inti');
const LAB_2 = uuid('pharma-lab-bago');
const VISITADOR_ID = uuid('medical-visitor-carla');
const MODALIDAD = { PRESENCIAL: uuid('concept-visit-modality-onsite'), VIRTUAL: uuid('concept-visit-modality-virtual') } as const;
const ESTADO_VISITA = { SOLICITADA: uuid('concept-visit-requested'), CONFIRMADA: uuid('concept-visit-confirmed'), REPROGRAMACION: uuid('concept-visit-reschedule-proposed'), RECHAZADA: uuid('concept-visit-rejected'), CANCELADA: uuid('concept-visit-cancelled'), REALIZADA: uuid('concept-visit-completed') } as const;

const LABS = [
  { id: LAB_ID, tenantId: TENANT_FARMACIA, labTypeConceptId: uuid('concept-lab-type-manufacturer'), legalName: 'Laboratorios Inti S.A.', tradeName: 'Inti', taxId: '1020304050', description: 'Laboratorio farmacéutico boliviano con más de 90 años. Genéricos y marcas propias.', researchAreas: ['Cardiovascular', 'Antibióticos', 'Analgésicos'], statusConceptId: ESTADO['ST-ACTIVE']! },
  { id: LAB_2, tenantId: uuid('tenant-bago'), labTypeConceptId: uuid('concept-lab-type-manufacturer'), legalName: 'Laboratorios Bagó de Bolivia S.A.', tradeName: 'Bagó', taxId: '1030405060', description: 'Filial de Bagó con planta en Santa Cruz.', researchAreas: ['Diabetes', 'Salud mental'], statusConceptId: ESTADO['ST-ACTIVE']! },
];

const PRODUCTOS = [
  ['Intipril', 'Enalapril', 'Comprimidos', '10 mg', 'Hipertensión arterial'],
  ['Losarti', 'Losartán', 'Comprimidos', '50 mg', 'Hipertensión arterial'],
  ['Glucofen', 'Metformina', 'Comprimidos', '850 mg', 'Diabetes tipo 2'],
  ['Atorvin', 'Atorvastatina', 'Comprimidos', '20 mg', 'Dislipidemia'],
  ['Amoxinti', 'Amoxicilina', 'Cápsulas', '500 mg', 'Infecciones bacterianas'],
].map(([tradeName, activeIngredient, presentation, concentration, indication], i) => ({
  id: uuid(`pharma-product-${tradeName}`),
  pharmaLabId: LAB_ID,
  tradeName: tradeName!,
  activeIngredient: activeIngredient!,
  presentation: presentation!,
  concentration: concentration!,
  authorizedIndication: indication!,
  regulatoryStatusConceptId: ESTADO['ST-VERIFIED']!,
  sanitaryRegistryNumber: `RS-${20000 + i}`,
  registryExpiresOn: isoDia(365 * (2 + i)),
  disclosureLevelConceptId: uuid('concept-disclosure-public'),
  versionNo: 1 + (i % 2),
}));

interface SolicitudDeVisita {
  readonly id: string;
  readonly medicalVisitorId: string;
  readonly pharmaLabId: string;
  readonly doctorUserId: string;
  readonly doctorTenantId: string;
  readonly reason: string;
  readonly requestedStartAt: string;
  readonly durationMinutes: number;
  readonly timeZone: string;
  readonly modalityConceptId: string;
  readonly location: string;
  readonly observations: string;
  readonly statusConceptId: string;
  readonly proposedStartAt: string | null;
  readonly confirmedAt: string | null;
}

const solicitudes = new Coleccion<SolicitudDeVisita>([
  { id: uuid('visit-request-1'), medicalVisitorId: VISITADOR_ID, pharmaLabId: LAB_ID, doctorUserId: MEDICA.userId, doctorTenantId: MEDICA.tenantId, reason: 'Presentar Intipril 10 mg y estudios de bioequivalencia', requestedStartAt: iso(2, 13), durationMinutes: 20, timeZone: 'America/La_Paz', modalityConceptId: MODALIDAD.PRESENCIAL, location: 'Consultorio 3, Clínica Los Olivos', observations: 'Llevo muestras médicas.', statusConceptId: ESTADO_VISITA.SOLICITADA, proposedStartAt: null, confirmedAt: null },
  { id: uuid('visit-request-2'), medicalVisitorId: VISITADOR_ID, pharmaLabId: LAB_ID, doctorUserId: MEDICA.userId, doctorTenantId: MEDICA.tenantId, reason: 'Novedades en el tratamiento de dislipidemia', requestedStartAt: iso(-7, 13), durationMinutes: 15, timeZone: 'America/La_Paz', modalityConceptId: MODALIDAD.PRESENCIAL, location: 'Consultorio 3', observations: '', statusConceptId: ESTADO_VISITA.REALIZADA, proposedStartAt: null, confirmedAt: iso(-9, 10) },
  { id: uuid('visit-request-3'), medicalVisitorId: VISITADOR_ID, pharmaLabId: LAB_ID, doctorUserId: PROFESIONALES[9]!.userId, doctorTenantId: PROFESIONALES[9]!.tenantId, reason: 'Glucofen: nueva presentación de liberación prolongada', requestedStartAt: iso(4, 16), durationMinutes: 20, timeZone: 'America/La_Paz', modalityConceptId: MODALIDAD.VIRTUAL, location: '', observations: '', statusConceptId: ESTADO_VISITA.CONFIRMADA, proposedStartAt: null, confirmedAt: iso(-1, 9) },
  { id: uuid('visit-request-4'), medicalVisitorId: VISITADOR_ID, pharmaLabId: LAB_ID, doctorUserId: PROFESIONALES[1]!.userId, doctorTenantId: PROFESIONALES[1]!.tenantId, reason: 'Amoxinti suspensión pediátrica', requestedStartAt: iso(-3, 12), durationMinutes: 15, timeZone: 'America/La_Paz', modalityConceptId: MODALIDAD.PRESENCIAL, location: 'Consultorio pediatría', observations: '', statusConceptId: ESTADO_VISITA.RECHAZADA, proposedStartAt: null, confirmedAt: null },
  { id: uuid('visit-request-5'), medicalVisitorId: VISITADOR_ID, pharmaLabId: LAB_ID, doctorUserId: MEDICA.userId, doctorTenantId: MEDICA.tenantId, reason: 'Material sobre insuficiencia cardíaca', requestedStartAt: iso(9, 13), durationMinutes: 20, timeZone: 'America/La_Paz', modalityConceptId: MODALIDAD.PRESENCIAL, location: 'Consultorio 3', observations: '', statusConceptId: ESTADO_VISITA.REPROGRAMACION, proposedStartAt: iso(10, 13, 30), confirmedAt: null },
]);

const agendas = new Map<string, { timeZone: string; autoConfirm: boolean; minNoticeHours: number; rescheduleCutoffHours: number; maxDurationMinutes: number; allowedSpecialtyConceptIds: string[]; windows: { weekday: number; startTime: string; endTime: string; slotDurationMinutes: number; modalityConceptId: string; location: string }[] }>();
agendas.set(MEDICA.userId, { timeZone: 'America/La_Paz', autoConfirm: false, minNoticeHours: 24, rescheduleCutoffHours: 12, maxDurationMinutes: 20, allowedSpecialtyConceptIds: [ESPECIALIDAD['CARDIOLOGIA']!], windows: [{ weekday: 2, startTime: '13:00', endTime: '14:00', slotDurationMinutes: 20, modalityConceptId: MODALIDAD.PRESENCIAL, location: 'Consultorio 3, Clínica Los Olivos' }, { weekday: 4, startTime: '13:00', endTime: '14:00', slotDurationMinutes: 20, modalityConceptId: MODALIDAD.PRESENCIAL, location: 'Consultorio 3, Clínica Los Olivos' }] });

function agendaDe(doctorUserId: string) {
  const a = agendas.get(doctorUserId) ?? { timeZone: 'America/La_Paz', autoConfirm: true, minNoticeHours: 24, rescheduleCutoffHours: 12, maxDurationMinutes: 15, allowedSpecialtyConceptIds: [], windows: [{ weekday: 3, startTime: '12:00', endTime: '13:00', slotDurationMinutes: 15, modalityConceptId: MODALIDAD.PRESENCIAL, location: 'Consultorio' }] };
  return { doctorUserId, ...a };
}

function registroDe(s: SolicitudDeVisita) {
  return { id: uuid(`visit-record-${s.id}`), visitRequestId: s.id, doctorUserId: s.doctorUserId, medicalVisitorId: s.medicalVisitorId, pharmaLabId: s.pharmaLabId, occurredAt: s.requestedStartAt, location: s.location, topicsDiscussed: s.reason, nextAction: 'Enviar bibliografía por correo', visitorAttendanceConceptId: uuid('concept-attendance-present'), doctorAttendanceConceptId: uuid('concept-attendance-present'), confirmationConceptId: uuid('concept-record-confirmed-by-both') };
}

/**
 * El diccionario `*_concept_id` → rótulo que pide `PharmaLabConcepts`.
 *
 * Sin él la respuesta genérica devolvía `{ items: [] }` donde el cliente
 * espera un arreglo, `concepts.map` reventaba y las pantallas de visitas
 * mostraban los estados como UUID crudos. Los códigos y rótulos son los del
 * `pharma-lab-reference.controller` de la API; los identificadores, las
 * mismas semillas que usan las filas de este archivo.
 */
const CONCEPTOS_PHL: readonly { key: string; id: string; code: string; display: string }[] = [
  ['PHL_VISIT_REQUESTED', 'concept-visit-requested', 'Solicitada'],
  ['PHL_VISIT_CONFIRMED', 'concept-visit-confirmed', 'Confirmada'],
  ['PHL_VISIT_RESCHEDULED', 'concept-visit-reschedule-proposed', 'Reprogramada'],
  ['PHL_VISIT_REJECTED', 'concept-visit-rejected', 'Rechazada'],
  ['PHL_VISIT_CANCELLED_BY_VISITOR', 'concept-visit-cancelled', 'Cancelada por el visitador'],
  ['PHL_VISIT_COMPLETED', 'concept-visit-completed', 'Completada'],
  ['PHL_MODALITY_IN_PERSON', 'concept-visit-modality-onsite', 'Presencial'],
  ['PHL_MODALITY_VIRTUAL', 'concept-visit-modality-virtual', 'Virtual'],
  ['LAB_TYPE_DRUG_MANUFACTURER', 'concept-lab-type-manufacturer', 'Fabricante de medicamentos'],
  ['PHL_STAFF_MEDICAL', 'concept-staff-manager', 'Personal médico'],
  ['PHL_STAFF_REGULATORY', 'concept-staff-regulatory', 'Personal regulatorio'],
  ['PHL_STAFF_MEDICAL_VISITOR', 'concept-staff-visitor', 'Visitador médico'],
  ['PHL_DISCLOSURE_PUBLIC', 'concept-disclosure-public', 'Pública'],
  ['PHL_MATERIAL_KIND_DATA_SHEET', 'concept-material-monograph', 'Ficha técnica'],
  ['PHL_MATERIAL_KIND_STUDY', 'concept-material-study', 'Estudio'],
  ['PHL_MATERIAL_KIND_SCIENTIFIC_DOC', 'concept-material-guide', 'Documento científico'],
  ['PHL_ATTENDANCE_ATTENDED', 'concept-attendance-present', 'Asistió'],
  ['PHL_RECORD_CONFIRMED', 'concept-record-confirmed-by-both', 'Visita confirmada por el doctor'],
  ['PHL_ADVERSE_EVENT_COUGH', 'concept-adverse-event-cough', 'Tos seca'],
  ['PHL_ADVERSE_EVENT_RASH', 'concept-adverse-event-rash', 'Exantema cutáneo'],
  ['PHL_SEVERITY_MILD', 'concept-severity-mild', 'Leve'],
  ['PHL_DOC_GMP', 'concept-doc-gmp', 'Certificado de buenas prácticas'],
  ['PHL_DOC_LICENSE', 'concept-doc-license', 'Licencia de funcionamiento'],
  ['PHL_DOC_REGISTRY', 'concept-doc-registry', 'Registro sanitario'],
].map(([key, semilla, display]) => ({ key: key!, id: uuid(semilla!), code: key!, display: display! }));

function diccionarioDeConceptos() {
  const generales = conceptos().map((c) => ({ key: c.code, id: c.id, code: c.code, display: c.display }));
  return [...CONCEPTOS_PHL, ...generales];
}

function esVisitador(request: MockRequest): boolean {
  return request.user?.roles.includes('MEDICAL_VISITOR') ?? false;
}

export function registrarLaboratorioFarmaceutico(router: MockRouter): void {
  router.get('/pharma-labs', () => LABS);
  router.get('/pharma-labs/reference/concepts', () => diccionarioDeConceptos());
  router.get('/pharma-labs/:id', ({ params }) => LABS.find((l) => l.id === params['id']) ?? notFound('Laboratorio no encontrado'));

  router.get('/pharma-labs/:id/staff', ({ params }) => [
    { id: uuid('lab-staff-1'), pharmaLabId: params['id'], userId: uuid('user-lab-gerente'), staffTypeConceptId: uuid('concept-staff-manager'), position: 'Gerente médico', area: 'Dirección médica', hiredOn: isoDia(-1500), permissions: ['MATERIALS', 'VISITORS', 'PHARMACOVIGILANCE'], statusConceptId: ESTADO['ST-ACTIVE']! },
    { id: uuid('lab-staff-2'), pharmaLabId: params['id'], userId: uuid('user-lab-regulatorio'), staffTypeConceptId: uuid('concept-staff-regulatory'), position: 'Responsable de asuntos regulatorios', area: 'Regulatorio', hiredOn: isoDia(-900), permissions: ['REGULATORY'], statusConceptId: ESTADO['ST-ACTIVE']! },
    { id: uuid('lab-staff-3'), pharmaLabId: params['id'], userId: IDS.visitador.userId, staffTypeConceptId: uuid('concept-staff-visitor'), position: 'Visitadora médica', area: 'Fuerza de ventas · Santa Cruz', hiredOn: isoDia(-400), permissions: ['VISITS'], statusConceptId: ESTADO['ST-ACTIVE']! },
  ]);

  router.get('/pharma-labs/:id/medical-visitors', ({ params }) => [
    { id: VISITADOR_ID, pharmaLabId: params['id'], userId: IDS.visitador.userId, fullName: 'Carla Fernández Ríos', internalCode: 'VM-0031', position: 'Visitadora médica senior', region: 'Santa Cruz', commercialArea: 'Cardiología y medicina interna', assignedZone: 'Zona norte', startedOn: isoDia(-400), identityVerificationConceptId: ESTADO['ST-VERIFIED']!, contractVerificationConceptId: ESTADO['ST-VERIFIED']!, credentialVerificationConceptId: ESTADO['ST-VERIFIED']!, statusConceptId: ESTADO['ST-ACTIVE']!, publiclyListed: true },
    { id: uuid('medical-visitor-2'), pharmaLabId: params['id'], userId: uuid('user-visitador-2'), fullName: 'Rubén Quispe Mamani', internalCode: 'VM-0044', position: 'Visitador médico', region: 'Cochabamba', commercialArea: 'Pediatría', assignedZone: 'Zona centro', startedOn: isoDia(-120), identityVerificationConceptId: ESTADO['ST-VERIFIED']!, contractVerificationConceptId: ESTADO['ST-PENDING']!, credentialVerificationConceptId: ESTADO['ST-PENDING']!, statusConceptId: ESTADO['ST-PENDING']!, publiclyListed: false },
    { id: uuid('medical-visitor-3'), pharmaLabId: params['id'], userId: uuid('user-visitador-3'), fullName: 'Lucía Antelo Roca', internalCode: 'VM-0012', position: 'Visitadora médica', region: 'Santa Cruz', commercialArea: 'Ginecología', assignedZone: 'Zona sur', startedOn: isoDia(-1000), endedOn: isoDia(-30), identityVerificationConceptId: ESTADO['ST-VERIFIED']!, contractVerificationConceptId: ESTADO['ST-VERIFIED']!, credentialVerificationConceptId: ESTADO['ST-VERIFIED']!, statusConceptId: ESTADO['ST-INACTIVE']!, publiclyListed: false, unlinkReason: 'Fin de contrato' },
  ]);

  router.post('/pharma-labs/:id/medical-visitors/:visitorId/unlink', ({ params }) => ({ id: params['visitorId'], statusConceptId: ESTADO['ST-INACTIVE']!, revokedSessions: 1, revokedRefreshTokens: 1, cancelledVisitRequests: solicitudes.filtrar((s) => s.medicalVisitorId === params['visitorId'] && s.statusConceptId === ESTADO_VISITA.SOLICITADA).length }));

  router.get('/pharma-labs/:id/products', ({ params }) => PRODUCTOS.map((p) => ({ ...p, pharmaLabId: params['id'] })));

  router.get('/pharma-labs/:id/materials', ({ params }) => [
    { id: uuid('material-1'), pharmaLabId: params['id'], pharmaProductId: PRODUCTOS[0]!.id, title: 'Monografía Intipril 10 mg', kindConceptId: uuid('concept-material-monograph'), version: '3.1', authorName: 'Dirección médica Inti', validFrom: isoDia(-200), validTo: isoDia(165), statusConceptId: ESTADO['ST-VERIFIED']!, approvedAt: iso(-200) },
    { id: uuid('material-2'), pharmaLabId: params['id'], pharmaProductId: PRODUCTOS[3]!.id, title: 'Estudio de bioequivalencia Atorvin vs. referencia', kindConceptId: uuid('concept-material-study'), version: '1.0', authorName: 'Universidad Mayor de San Simón', validFrom: isoDia(-90), statusConceptId: ESTADO['ST-VERIFIED']!, approvedAt: iso(-90) },
    { id: uuid('material-3'), pharmaLabId: params['id'], title: 'Guía de manejo de hipertensión 2026', kindConceptId: uuid('concept-material-guide'), version: '2026.1', authorName: 'Sociedad Boliviana de Cardiología', statusConceptId: ESTADO['ST-PENDING']!, approvedAt: null },
  ]);

  router.get('/pharma-labs/:id/pharmacovigilance/reports', ({ params }) => [
    { id: uuid('pv-1'), pharmaLabId: params['id'], pharmaProductId: PRODUCTOS[0]!.id, caseCode: 'FV-2026-0012', batchNumber: 'L2403', eventDate: isoDia(-20), eventTypeConceptId: uuid('concept-adverse-event-cough'), description: 'Tos seca persistente a las 3 semanas de iniciar el tratamiento.', severityConceptId: uuid('concept-severity-mild'), statusConceptId: ESTADO['ST-IN-PROGRESS']! },
    { id: uuid('pv-2'), pharmaLabId: params['id'], pharmaProductId: PRODUCTOS[4]!.id, caseCode: 'FV-2026-0009', batchNumber: 'L2311', eventDate: isoDia(-45), eventTypeConceptId: uuid('concept-adverse-event-rash'), description: 'Exantema cutáneo leve; remitió al suspender.', severityConceptId: uuid('concept-severity-mild'), statusConceptId: ESTADO['ST-CLOSED']! },
  ]);

  router.get('/pharma-labs/:id/regulatory-documents', ({ params }) => [
    { id: uuid('reg-1'), pharmaLabId: params['id'], name: 'Certificado de Buenas Prácticas de Manufactura', documentTypeConceptId: uuid('concept-doc-gmp'), code: 'BPM-2024-118', currentVersion: '2024', issuerName: 'AGEMED', issuedOn: isoDia(-300), expiresOn: isoDia(430), statusConceptId: ESTADO['ST-VERIFIED']! },
    { id: uuid('reg-2'), pharmaLabId: params['id'], name: 'Licencia de funcionamiento de planta', documentTypeConceptId: uuid('concept-doc-license'), code: 'LF-SCZ-0092', currentVersion: '2023', issuerName: 'SEDES Santa Cruz', issuedOn: isoDia(-700), expiresOn: isoDia(30), statusConceptId: ESTADO['ST-VERIFIED']! },
    { id: uuid('reg-3'), pharmaLabId: params['id'], name: 'Registro sanitario Intipril', documentTypeConceptId: uuid('concept-doc-registry'), code: 'RS-20000', currentVersion: '2', issuerName: 'AGEMED', issuedOn: isoDia(-1000), expiresOn: isoDia(-15), statusConceptId: ESTADO['ST-INACTIVE']! },
  ]);

  /* ---- agenda de visitas ------------------------------------------------- */

  router.get('/visit-agenda/me', (request) => agendaDe(request.user?.id ?? MEDICA.userId));
  router.put('/visit-agenda/me', (request) => {
    const datos = cuerpo<{ timeZone?: string; autoConfirm?: boolean; minNoticeHours?: number; rescheduleCutoffHours?: number; maxDurationMinutes?: number; windows?: { weekday: number; startTime: string; endTime: string; slotDurationMinutes: number; modalityConceptId: string; location?: string }[] }>(request);
    const actual = agendaDe(request.user?.id ?? MEDICA.userId);
    agendas.set(request.user?.id ?? MEDICA.userId, {
      timeZone: datos.timeZone ?? actual.timeZone,
      autoConfirm: datos.autoConfirm ?? actual.autoConfirm,
      minNoticeHours: datos.minNoticeHours ?? actual.minNoticeHours,
      rescheduleCutoffHours: datos.rescheduleCutoffHours ?? actual.rescheduleCutoffHours,
      maxDurationMinutes: datos.maxDurationMinutes ?? actual.maxDurationMinutes,
      allowedSpecialtyConceptIds: actual.allowedSpecialtyConceptIds,
      windows: (datos.windows ?? actual.windows).map((w) => ({ ...w, location: w.location ?? '' })),
    });
    return { id: request.user?.id ?? MEDICA.userId, statusConceptId: ESTADO['ST-PUBLISHED']! };
  });
  router.get('/visit-agenda/doctors/:id', ({ params }) => agendaDe(params['id']!));

  router.post('/visit-requests', (request) => {
    const datos = cuerpo<{ doctorUserId: string; doctorTenantId?: string; reason: string; requestedStartAt: string; durationMinutes: number; modalityConceptId: string; location?: string; observations?: string }>(request);
    const agenda = agendaDe(datos.doctorUserId ?? MEDICA.userId);
    // 15 minutos por omisión (C-13): "cuando el profesional no definió nada,
    // dura 15; cuando definió otra cosa, dura eso" — el "otra cosa" es
    // `maxDurationMinutes` de SU política, no un número fijo del cliente.
    const duracion = datos.durationMinutes ?? 15;
    // Mismo contrato que el `ValidationPipe` real: `visits.dto.ts` declara
    // `durationMinutes` con `@IsInt() @Min(5) @Max(240)`. Sin este rechazo el
    // doble es más permisivo que la API real.
    if (!Number.isInteger(duracion) || duracion < 5 || duracion > 240) {
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        error: 'Bad Request',
        details: { messages: ['durationMinutes must be an integer number not less than 5 and not greater than 240'] },
      });
    }
    // Precondición de negocio (no de forma): `visit-agenda.service.ts` la
    // valida contra la política del doctor con `PreconditionFailedException`,
    // que en este proyecto es 422 (no 412 — ver `domain.exception.ts`).
    if (duracion > agenda.maxDurationMinutes) {
      return validation(`La duración máxima admitida es de ${agenda.maxDurationMinutes} minutos`);
    }
    const nueva = solicitudes.agregar({
      id: nuevoId('visit-request'),
      medicalVisitorId: VISITADOR_ID,
      pharmaLabId: LAB_ID,
      doctorUserId: datos.doctorUserId ?? MEDICA.userId,
      doctorTenantId: datos.doctorTenantId ?? '',
      reason: datos.reason ?? '',
      requestedStartAt: datos.requestedStartAt ?? ahora(),
      durationMinutes: duracion,
      timeZone: agenda.timeZone,
      modalityConceptId: datos.modalityConceptId ?? MODALIDAD.PRESENCIAL,
      location: datos.location ?? '',
      observations: datos.observations ?? '',
      statusConceptId: agenda.autoConfirm ? ESTADO_VISITA.CONFIRMADA : ESTADO_VISITA.SOLICITADA,
      proposedStartAt: null,
      confirmedAt: agenda.autoConfirm ? ahora() : null,
    });
    return { status: 201, body: { id: nueva.id } };
  });

  router.get('/visit-requests/mine', () => solicitudes.filtrar((s) => s.medicalVisitorId === VISITADOR_ID).sort((a, b) => b.requestedStartAt.localeCompare(a.requestedStartAt)));
  router.get('/visit-requests/inbox', (request) => solicitudes.filtrar((s) => s.doctorUserId === (request.user?.id ?? MEDICA.userId)).sort((a, b) => b.requestedStartAt.localeCompare(a.requestedStartAt)));

  router.post('/visit-requests/:id/accept', ({ params }) => {
    const s = solicitudes.get(params['id']!);
    if (s === undefined) return notFound('Solicitud no encontrada');
    solicitudes.actualizar(s.id, { statusConceptId: ESTADO_VISITA.CONFIRMADA, confirmedAt: ahora() });
    return { id: s.id, statusConceptId: ESTADO_VISITA.CONFIRMADA };
  });
  router.post('/visit-requests/:id/reject', ({ params }) => {
    const s = solicitudes.get(params['id']!);
    if (s === undefined) return notFound('Solicitud no encontrada');
    solicitudes.actualizar(s.id, { statusConceptId: ESTADO_VISITA.RECHAZADA });
    return { id: s.id, statusConceptId: ESTADO_VISITA.RECHAZADA };
  });
  router.post('/visit-requests/:id/cancel', ({ params }) => {
    const s = solicitudes.get(params['id']!);
    if (s === undefined) return notFound('Solicitud no encontrada');
    solicitudes.actualizar(s.id, { statusConceptId: ESTADO_VISITA.CANCELADA });
    return { id: s.id, statusConceptId: ESTADO_VISITA.CANCELADA };
  });

  router.get('/visit-records/inbox', (request) => solicitudes.filtrar((s) => s.statusConceptId === ESTADO_VISITA.REALIZADA && (esVisitador(request) || s.doctorUserId === (request.user?.id ?? MEDICA.userId))).map(registroDe));
  router.get('/visit-records/labs/:id', ({ params }) => solicitudes.filtrar((s) => s.pharmaLabId === params['id'] && s.statusConceptId === ESTADO_VISITA.REALIZADA).map(registroDe));
  router.get('/visit-records/labs/:id/rating-summary', () => ({ sampleSize: 14, punctuality: 4.6, informationQuality: 4.4, clarity: 4.7, relevance: 4.2, professionalConduct: 4.9, materialUsefulness: 4.1, overallSatisfaction: 4.5 }));
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
solicitudes.persistirEn('mock.pharma-lab.solicitudes');
