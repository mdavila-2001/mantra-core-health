import { reservas } from '../fixtures/agenda';
import { ESTADO } from '../fixtures/conceptos';
import { PACIENTE } from '../fixtures/personas';
import { notFound, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, isoDia, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Encuestas de satisfacción (motor de cuestionarios) y el motor de
    formularios clínicos (instancias, valores, campos y asignaciones).
    ========================================================================== */

type TipoRespuesta = 'TEXT' | 'SCALE' | 'BOOLEAN' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';

interface PreguntaSimulada {
  readonly id: string;
  readonly position: number;
  readonly questionText: string;
  readonly answerType: TipoRespuesta;
  readonly required: boolean;
  readonly options?: readonly string[];
  readonly scaleMin?: number;
  readonly scaleMax?: number;
}

interface EncuestaSimulada {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  readonly latestVersionNumber: number;
  readonly latestVersionId: string;
  readonly published: boolean;
  readonly responseWindowDays: number;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly questions: readonly PreguntaSimulada[];
}

function pregunta(encuesta: string, position: number, questionText: string, answerType: TipoRespuesta, extra: Partial<PreguntaSimulada> = {}): PreguntaSimulada {
  return { id: uuid(`q-${encuesta}-${position}`), position, questionText, answerType, required: position <= 2, ...extra };
}

const encuestas = new Coleccion<EncuestaSimulada>([
  {
    id: uuid('survey-satisfaccion'),
    title: 'Satisfacción con la consulta',
    description: 'Tres minutos para contarnos cómo fue tu atención.',
    status: 'ACTIVE',
    latestVersionNumber: 2,
    latestVersionId: uuid('survey-satisfaccion-v2'),
    published: true,
    responseWindowDays: 7,
    effectiveFrom: isoDia(-60),
    effectiveTo: null,
    questions: [
      pregunta('sat', 1, '¿Cómo calificarías la atención recibida?', 'SCALE', { scaleMin: 1, scaleMax: 5 }),
      pregunta('sat', 2, '¿Te atendieron a la hora acordada?', 'BOOLEAN'),
      pregunta('sat', 3, '¿Qué fue lo mejor de la consulta?', 'SINGLE_CHOICE', { options: ['La explicación', 'El trato', 'La puntualidad', 'Las instalaciones'] }),
      pregunta('sat', 4, '¿Qué mejorarías?', 'MULTIPLE_CHOICE', { options: ['Tiempo de espera', 'Claridad de las indicaciones', 'Comodidad del consultorio', 'Nada'] }),
      pregunta('sat', 5, 'Comentarios', 'TEXT'),
    ],
  },
  {
    id: uuid('survey-teleconsulta'),
    title: 'Experiencia de teleconsulta',
    description: 'Cómo funcionó la videollamada y qué faltó.',
    status: 'ACTIVE',
    latestVersionNumber: 1,
    latestVersionId: uuid('survey-teleconsulta-v1'),
    published: true,
    responseWindowDays: 5,
    effectiveFrom: isoDia(-20),
    effectiveTo: null,
    questions: [
      pregunta('tele', 1, '¿La conexión fue estable?', 'BOOLEAN'),
      pregunta('tele', 2, 'Calidad del audio y video', 'SCALE', { scaleMin: 1, scaleMax: 5 }),
      pregunta('tele', 3, '¿Preferís teleconsulta o presencial para el próximo control?', 'SINGLE_CHOICE', { options: ['Teleconsulta', 'Presencial', 'Indistinto'] }),
    ],
  },
  {
    id: uuid('survey-borrador'),
    title: 'Encuesta post-cirugía',
    description: 'Seguimiento a los 30 días de un procedimiento.',
    status: 'DRAFT',
    latestVersionNumber: 1,
    latestVersionId: uuid('survey-borrador-v1'),
    published: false,
    responseWindowDays: 14,
    effectiveFrom: null,
    effectiveTo: null,
    questions: [pregunta('post', 1, '¿Tuviste dolor en la primera semana?', 'SCALE', { scaleMin: 0, scaleMax: 10 })],
  },
  {
    id: uuid('survey-inactiva'),
    title: 'Encuesta de vacunación 2025',
    description: 'Cerrada.',
    status: 'INACTIVE',
    latestVersionNumber: 3,
    latestVersionId: uuid('survey-inactiva-v3'),
    published: false,
    responseWindowDays: 7,
    effectiveFrom: isoDia(-400),
    effectiveTo: isoDia(-100),
    questions: [pregunta('vac', 1, '¿Recibiste la vacuna antigripal?', 'BOOLEAN')],
  },
]);

function resumen(e: EncuestaSimulada) {
  return { id: e.id, title: e.title, description: e.description, status: e.status, latestVersionNumber: e.latestVersionNumber, published: e.published, questionCount: e.questions.length };
}

const invitaciones = new Coleccion<{ id: string; surveyId: string; patientProfileId: string; status: 'PENDING' | 'ANSWERED' | 'EXPIRED'; issuedAt: string; expiresAt: string; answeredAt: string | null; appointmentBookingId: string }>(
  (() => {
    const citas = reservas.filtrar((r) => r.patientProfileId === PACIENTE.id).sort((a, b) => b.startAt.localeCompare(a.startAt));
    return [
      { id: uuid('invitation-1'), surveyId: uuid('survey-satisfaccion'), patientProfileId: PACIENTE.id, status: 'PENDING' as const, issuedAt: iso(-1, 12), expiresAt: iso(6), answeredAt: null, appointmentBookingId: citas[0]?.id ?? uuid('booking-x') },
      { id: uuid('invitation-2'), surveyId: uuid('survey-teleconsulta'), patientProfileId: PACIENTE.id, status: 'ANSWERED' as const, issuedAt: iso(-15, 12), expiresAt: iso(-10), answeredAt: iso(-14, 9), appointmentBookingId: citas[1]?.id ?? uuid('booking-y') },
      { id: uuid('invitation-3'), surveyId: uuid('survey-satisfaccion'), patientProfileId: PACIENTE.id, status: 'EXPIRED' as const, issuedAt: iso(-40, 12), expiresAt: iso(-33), answeredAt: null, appointmentBookingId: citas[2]?.id ?? uuid('booking-z') },
    ];
  })(),
);

function respuestasDe(e: EncuestaSimulada) {
  const invitados = reservas.todos().slice(0, 9);
  return invitados.map((r, i) => ({
    id: uuid(`response-${e.id}-${i}`),
    invitationId: uuid(`inv-resp-${e.id}-${i}`),
    appointmentBookingId: r.id,
    submittedAt: iso(-i * 3 - 1, 18),
    answers: e.questions.map((q) => ({
      questionId: q.id,
      questionText: q.questionText,
      answerType: q.answerType,
      ...(q.answerType === 'SCALE' ? { valueNumber: (q.scaleMin ?? 1) + ((i + q.position) % ((q.scaleMax ?? 5) - (q.scaleMin ?? 1) + 1)) } : {}),
      ...(q.answerType === 'BOOLEAN' ? { valueBoolean: (i + q.position) % 3 !== 0 } : {}),
      ...(q.answerType === 'SINGLE_CHOICE' ? { valueChoices: [q.options![(i + q.position) % q.options!.length]!] } : {}),
      ...(q.answerType === 'MULTIPLE_CHOICE' ? { valueChoices: q.options!.filter((_, k) => (i + k) % 2 === 0) } : {}),
      ...(q.answerType === 'TEXT' ? { valueText: ['Muy buena atención.', 'Me hicieron esperar bastante.', 'La doctora explica muy bien.', ''][i % 4]! } : {}),
    })),
  }));
}

export function registrarEncuestas(router: MockRouter): void {
  router.get('/surveys/templates', () => encuestas.todos().map(resumen));

  router.post('/surveys/templates', (request) => {
    const datos = cuerpo<{ title: string; description?: string; responseWindowDays?: number }>(request);
    const id = nuevoId('survey');
    const versionId = nuevoId('survey-version');
    encuestas.agregar({ id, title: datos.title ?? 'Encuesta nueva', description: datos.description ?? '', status: 'DRAFT', latestVersionNumber: 1, latestVersionId: versionId, published: false, responseWindowDays: datos.responseWindowDays ?? 7, effectiveFrom: null, effectiveTo: null, questions: [] });
    return { status: 201, body: { id, versionId, versionNumber: 1 } };
  });

  router.get('/surveys/templates/:id', ({ params }) => {
    const e = encuestas.get(params['id']!);
    return e === undefined ? notFound('Encuesta no encontrada') : { ...resumen(e), latestVersionId: e.latestVersionId, responseWindowDays: e.responseWindowDays, effectiveFrom: e.effectiveFrom, effectiveTo: e.effectiveTo, questions: e.questions };
  });

  router.post('/surveys/templates/:id/versions', ({ params }) => {
    const e = encuestas.get(params['id']!);
    if (e === undefined) return notFound();
    const versionId = nuevoId('survey-version');
    encuestas.actualizar(e.id, { latestVersionId: versionId, latestVersionNumber: e.latestVersionNumber + 1, status: 'DRAFT', published: false });
    return { status: 201, body: { id: e.id, versionId, versionNumber: e.latestVersionNumber + 1 } };
  });

  router.post('/surveys/templates/:id/questions', (request) => {
    const e = encuestas.get(request.params['id']!);
    if (e === undefined) return notFound();
    const datos = cuerpo<{ questionText: string; answerType: TipoRespuesta; required?: boolean; options?: string[]; scaleMin?: number; scaleMax?: number }>(request);
    const nueva: PreguntaSimulada = { id: nuevoId('question'), position: e.questions.length + 1, questionText: datos.questionText ?? '', answerType: datos.answerType ?? 'TEXT', required: datos.required ?? false, ...(datos.options === undefined ? {} : { options: datos.options }), ...(datos.scaleMin === undefined ? {} : { scaleMin: datos.scaleMin }), ...(datos.scaleMax === undefined ? {} : { scaleMax: datos.scaleMax }) };
    encuestas.actualizar(e.id, { questions: [...e.questions, nueva] });
    return { status: 201, body: nueva };
  });

  router.post('/surveys/templates/:id/publish', (request) => {
    const e = encuestas.get(request.params['id']!);
    if (e === undefined) return notFound();
    const datos = cuerpo<{ effectiveFrom?: string; effectiveTo?: string }>(request);
    encuestas.actualizar(e.id, { status: 'ACTIVE', published: true, effectiveFrom: datos.effectiveFrom ?? isoDia(0), effectiveTo: datos.effectiveTo ?? null });
    return { ok: true };
  });
  router.post('/surveys/templates/:id/versions/:versionId/publish', (request) => {
    const e = encuestas.get(request.params['id']!);
    if (e === undefined) return notFound();
    encuestas.actualizar(e.id, { status: 'ACTIVE', published: true, effectiveFrom: isoDia(0) });
    return { ok: true };
  });

  router.post('/surveys/templates/:id/deactivate', ({ params }) => {
    const e = encuestas.get(params['id']!);
    if (e === undefined) return notFound();
    encuestas.actualizar(e.id, { status: 'INACTIVE', published: false, effectiveTo: isoDia(0) });
    return { ok: true };
  });

  router.get('/surveys/templates/:id/responses', ({ params }) => {
    const e = encuestas.get(params['id']!);
    return e === undefined ? notFound() : e.published || e.status === 'INACTIVE' ? respuestasDe(e) : [];
  });

  router.post('/surveys/assignments', () => ({ status: 201, body: { id: nuevoId('assignment') } }));

  router.post('/surveys/invitations', (request) => {
    const datos = cuerpo<{ appointmentBookingIds?: string[] }>(request);
    const ids = (datos.appointmentBookingIds ?? ['x']).map(() => nuevoId('invitation'));
    return { status: 201, body: { ids, alreadyIssued: 0 } };
  });

  router.get('/surveys/me/invitations', (request) =>
    invitaciones
      .filtrar((i) => i.patientProfileId === (request.user?.patientProfileId ?? PACIENTE.id))
      .map((i) => {
        const e = encuestas.get(i.surveyId)!;
        return { id: i.id, title: e.title, description: e.description, status: i.status, issuedAt: i.issuedAt, expiresAt: i.expiresAt, answeredAt: i.answeredAt, appointmentBookingId: i.appointmentBookingId };
      }),
  );

  router.get('/surveys/me/invitations/:id', ({ params }) => {
    const i = invitaciones.get(params['id']!);
    if (i === undefined) return notFound('Invitación no encontrada');
    const e = encuestas.get(i.surveyId)!;
    return { id: i.id, title: e.title, description: e.description, status: i.status, issuedAt: i.issuedAt, expiresAt: i.expiresAt, answeredAt: i.answeredAt, appointmentBookingId: i.appointmentBookingId, questions: e.questions };
  });

  router.post('/surveys/me/invitations/:id/responses', ({ params }) => {
    const i = invitaciones.get(params['id']!);
    if (i === undefined) return notFound();
    invitaciones.actualizar(i.id, { status: 'ANSWERED', answeredAt: ahora() });
    return { status: 201, body: { id: nuevoId('response'), invitationId: i.id, submittedAt: ahora() } };
  });

  /* ---- formularios clínicos ------------------------------------------------ */

  const TIPO_RECURSO_ENCUENTRO = uuid('concept-resource-type-encounter');
  const instancias = new Coleccion<{ id: string; resourceId: string; resourceTypeConceptId: string; schemaVersion: number; stateConceptId: string; closedAt?: string; createdAt: string; userId: string; values: { id: string; fieldId: string; dataType: string; fieldName: string; value: unknown; ordinal: number; masked: boolean; valueStatusConceptId: string; valueVersion: number; effectiveFrom: string }[] }>([
    {
      id: uuid('form-instance-1'),
      resourceId: uuid(`encounter-${PACIENTE.id}-0`),
      resourceTypeConceptId: TIPO_RECURSO_ENCUENTRO,
      schemaVersion: 1,
      stateConceptId: ESTADO['ST-CLOSED']!,
      closedAt: iso(-2, 10),
      createdAt: iso(-2, 9),
      userId: PACIENTE.userId,
      values: [
        { id: uuid('fv-1'), fieldId: uuid('field-pa-sis'), dataType: 'integer', fieldName: 'Presión sistólica', value: 124, ordinal: 1, masked: false, valueStatusConceptId: ESTADO['ST-COMPLETED']!, valueVersion: 1, effectiveFrom: iso(-2, 9) },
        { id: uuid('fv-2'), fieldId: uuid('field-pa-dia'), dataType: 'integer', fieldName: 'Presión diastólica', value: 80, ordinal: 2, masked: false, valueStatusConceptId: ESTADO['ST-COMPLETED']!, valueVersion: 1, effectiveFrom: iso(-2, 9) },
        { id: uuid('fv-3'), fieldId: uuid('field-nyha'), dataType: 'string', fieldName: 'Clase funcional NYHA', value: 'I', ordinal: 3, masked: false, valueStatusConceptId: ESTADO['ST-COMPLETED']!, valueVersion: 1, effectiveFrom: iso(-2, 9) },
        { id: uuid('fv-4'), fieldId: uuid('field-nota'), dataType: 'text', fieldName: 'Observaciones', value: 'Paciente asintomática, buena adherencia.', ordinal: 4, masked: false, valueStatusConceptId: ESTADO['ST-COMPLETED']!, valueVersion: 1, effectiveFrom: iso(-2, 9) },
      ],
    },
    {
      id: uuid('form-instance-2'),
      resourceId: uuid(`encounter-${PACIENTE.id}-1`),
      resourceTypeConceptId: TIPO_RECURSO_ENCUENTRO,
      schemaVersion: 1,
      stateConceptId: ESTADO['ST-DRAFT']!,
      createdAt: iso(-47, 9),
      userId: PACIENTE.userId,
      values: [{ id: uuid('fv-5'), fieldId: uuid('field-pa-sis'), dataType: 'integer', fieldName: 'Presión sistólica', value: 130, ordinal: 1, masked: false, valueStatusConceptId: ESTADO['ST-DRAFT']!, valueVersion: 1, effectiveFrom: iso(-47, 9) }],
    },
  ]);

  const item = (i: (typeof instancias extends Coleccion<infer T> ? T : never)) => ({ id: i.id, resourceId: i.resourceId, resourceTypeConceptId: i.resourceTypeConceptId, schemaVersion: i.schemaVersion, stateConceptId: i.stateConceptId, ...(i.closedAt === undefined ? {} : { closedAt: i.closedAt }), createdAt: i.createdAt });

  router.post('/forms/instances', (request) => {
    const datos = cuerpo<{ resourceId: string; resourceTypeConceptId?: string; schemaVersion?: number }>(request);
    const nueva = instancias.agregar({ id: nuevoId('form-instance'), resourceId: datos.resourceId ?? '', resourceTypeConceptId: datos.resourceTypeConceptId ?? TIPO_RECURSO_ENCUENTRO, schemaVersion: datos.schemaVersion ?? 1, stateConceptId: ESTADO['ST-DRAFT']!, createdAt: ahora(), userId: request.user?.id ?? '', values: [] });
    return { status: 201, body: { id: nueva.id, schemaVersion: nueva.schemaVersion, state: 'OPEN' } };
  });

  router.post('/forms/instances/:id/values', (request) => {
    const i = instancias.get(request.params['id']!);
    if (i === undefined) return notFound('Instancia no encontrada');
    const datos = cuerpo<{ values?: { fieldId: string; dataType: string; value: unknown; ordinal?: number }[] }>(request);
    const nuevos = (datos.values ?? []).map((v, k) => ({ id: nuevoId('fv'), fieldId: v.fieldId, dataType: v.dataType, fieldName: `Campo ${k + 1}`, value: v.value, ordinal: v.ordinal ?? i.values.length + k + 1, masked: false, valueStatusConceptId: ESTADO['ST-COMPLETED']!, valueVersion: 1, effectiveFrom: ahora() }));
    instancias.actualizar(i.id, { values: [...i.values, ...nuevos] });
    return { status: 201, body: { captured: nuevos.length } };
  });

  router.post('/forms/instances/:id/close', ({ params }) => {
    const i = instancias.get(params['id']!);
    if (i !== undefined) instancias.actualizar(i.id, { stateConceptId: ESTADO['ST-CLOSED']!, closedAt: ahora() });
    return { ok: true };
  });

  router.get('/forms/instances', ({ query }) => {
    const encounterId = query.get('encounterId') ?? '';
    const items = instancias.filtrar((i) => i.resourceId === encounterId).map(item);
    return { encounterId, items, limit: 50, truncated: false };
  });

  router.get('/forms/instances/:id', ({ params }) => {
    const i = instancias.get(params['id']!);
    return i === undefined ? notFound('Instancia no encontrada') : { ...item(i), values: i.values };
  });

  router.get('/forms/me/instances', () => ({ items: instancias.todos().map(item), limit: 50, truncated: false }));
  router.get('/forms/me/instances/:id', ({ params }) => {
    const i = instancias.get(params['id']!);
    return i === undefined ? notFound('Instancia no encontrada') : { ...item(i), values: i.values };
  });

  router.post('/forms/field-definitions', () => ({ status: 201, body: { id: nuevoId('field') } }));
  router.post('/forms/assignments', () => ({ status: 201, body: { id: nuevoId('field-assignment') } }));
  router.get('/forms/assignments/budget', ({ query }) => ({ targetResourceConceptId: query.get('targetResourceConceptId') ?? '', allowTenantFields: true, maximumFields: 20, used: 4, remaining: 16 }));
}
