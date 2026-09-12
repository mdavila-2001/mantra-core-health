import { reservas } from '../fixtures/agenda';
import { ESTADO } from '../fixtures/conceptos';
import { PACIENTE } from '../fixtures/personas';
import { notFound, type MockRouter } from '../mock-router';
import { plantillasVigentes } from './clinical.handlers';
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

/** Devuelve las preguntas con `position` correlativa desde 1. */
function renumerar(questions: readonly PreguntaSimulada[]): readonly PreguntaSimulada[] {
  return questions.map((q, i) => ({ ...q, position: i + 1 }));
}

/**
 * Quita los datos que el tipo de la pregunta ya no usa.
 *
 * Cambiar una elección a texto libre tiene que borrar sus opciones: si quedan
 * guardadas, el `GET` las devuelve, la vista previa las ignora —el tipo manda—
 * y quien edita ve un cuestionario que no coincide con lo que guardó.
 */
function limpiarSegunTipo(questions: readonly PreguntaSimulada[]): readonly PreguntaSimulada[] {
  const conOpciones = (t: TipoRespuesta) => t === 'SINGLE_CHOICE' || t === 'MULTIPLE_CHOICE';
  return questions.map((q) => {
    const { options, scaleMin, scaleMax, ...resto } = q;
    return {
      ...resto,
      ...(conOpciones(q.answerType) && options !== undefined ? { options } : {}),
      ...(q.answerType === 'SCALE' && scaleMin !== undefined ? { scaleMin } : {}),
      ...(q.answerType === 'SCALE' && scaleMax !== undefined ? { scaleMax } : {}),
    };
  });
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

  /* -- Edición del borrador (4 rutas que el backend todavía no tiene) -------

     Ver `docs/pendientes-backend-surveys.md`. Son las que hacen falta para que
     componer un cuestionario se parezca a un editor y no a un formulario de
     una sola dirección: hoy una pregunta mal escrita sólo se puede arreglar
     tirando la encuesta.

     Las cuatro **sólo tocan el borrador**: sobre una versión publicada
     devuelven 422, igual que `POST /questions`. Eso no es una limitación del
     simulador —es lo que hace que una respuesta dada hace meses se pueda
     seguir interpretando— y el backend real tendrá que hacer lo mismo. */

  /** Rechaza tocar una versión publicada, con el mismo código que el backend. */
  const soloBorrador = (e: EncuestaSimulada) =>
    e.published
      ? { status: 422, body: { message: 'La versión ya está publicada: creá una versión nueva para corregir el cuestionario.' } }
      : null;

  router.patch('/surveys/templates/:id', (request) => {
    const e = encuestas.get(request.params['id']!);
    if (e === undefined) return notFound();
    const bloqueado = soloBorrador(e);
    if (bloqueado !== null) return bloqueado;
    const datos = cuerpo<{ title?: string; description?: string; responseWindowDays?: number }>(request);
    encuestas.actualizar(e.id, {
      ...(datos.title === undefined ? {} : { title: datos.title }),
      ...(datos.description === undefined ? {} : { description: datos.description }),
      ...(datos.responseWindowDays === undefined ? {} : { responseWindowDays: datos.responseWindowDays }),
    });
    return { ok: true };
  });

  router.patch('/surveys/templates/:id/questions/:questionId', (request) => {
    const e = encuestas.get(request.params['id']!);
    if (e === undefined) return notFound();
    const bloqueado = soloBorrador(e);
    if (bloqueado !== null) return bloqueado;
    const questionId = request.params['questionId']!;
    if (!e.questions.some((q) => q.id === questionId)) return notFound('Pregunta no encontrada');
    const datos = cuerpo<Partial<PreguntaSimulada>>(request);
    const questions = e.questions.map((q) =>
      q.id !== questionId
        ? q
        : {
            ...q,
            ...(datos.questionText === undefined ? {} : { questionText: datos.questionText }),
            ...(datos.answerType === undefined ? {} : { answerType: datos.answerType }),
            ...(datos.required === undefined ? {} : { required: datos.required }),
            // Las opciones y la escala se reemplazan enteras cuando vienen, y
            // se BORRAN al cambiar a un tipo que no las usa: dejarlas colgando
            // haría que volver al tipo anterior resucitara opciones viejas.
            ...(datos.options === undefined ? {} : { options: datos.options }),
            ...(datos.scaleMin === undefined ? {} : { scaleMin: datos.scaleMin }),
            ...(datos.scaleMax === undefined ? {} : { scaleMax: datos.scaleMax }),
          },
    );
    encuestas.actualizar(e.id, { questions: limpiarSegunTipo(questions) });
    return { ok: true };
  });

  router.delete('/surveys/templates/:id/questions/:questionId', ({ params }) => {
    const e = encuestas.get(params['id']!);
    if (e === undefined) return notFound();
    const bloqueado = soloBorrador(e);
    if (bloqueado !== null) return bloqueado;
    const questions = e.questions.filter((q) => q.id !== params['questionId']);
    if (questions.length === e.questions.length) return notFound('Pregunta no encontrada');
    // Renumerar: `position` es lo que la pantalla dibuja delante de cada
    // pregunta, y borrar la 2 de 4 dejaría un cuestionario que va 1, 3, 4.
    encuestas.actualizar(e.id, { questions: renumerar(questions) });
    return { ok: true };
  });

  router.put('/surveys/templates/:id/questions/order', (request) => {
    const e = encuestas.get(request.params['id']!);
    if (e === undefined) return notFound();
    const bloqueado = soloBorrador(e);
    if (bloqueado !== null) return bloqueado;
    const { questionIds } = cuerpo<{ questionIds: string[] }>(request);
    const porId = new Map(e.questions.map((q) => [q.id, q]));
    const ordenadas = (questionIds ?? [])
      .map((id) => porId.get(id))
      .filter((q): q is PreguntaSimulada => q !== undefined);
    // Las que el cliente no nombró van al final en su orden previo: un orden
    // incompleto no debe hacer desaparecer preguntas.
    const faltantes = e.questions.filter((q) => !questionIds?.includes(q.id));
    encuestas.actualizar(e.id, { questions: renumerar([...ordenadas, ...faltantes]) });
    return { ok: true };
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

  /* -- Campos propios de un formulario --------------------------------------

     Antes eran dos stubs que devolvian un id y **no guardaban nada**: agregar
     un campo desde «Formularios» parecia funcionar —salia el aviso de exito— y
     al releer la plantilla el campo no estaba. Ahora las definiciones se
     guardan y las asignaciones cuelgan de la plantilla de verdad.

     Se cuelgan buscando la plantilla por `targetResourceConceptId`, que es lo
     unico que el contrato manda; por eso cada plantilla tiene el suyo. */

  /** Lo que una definicion declara ademas del tipo: es lo que Google Forms llama
      «la pregunta» —descripcion, opciones, «Otro», topes de respuestas—. */
  interface DefinicionSimulada {
    name: string;
    dataType: string;
    code: string;
    options?: string[];
    multiple?: boolean;
    description?: string;
    allowOther?: boolean;
    cardinalityMin?: number;
    cardinalityMax?: number;
  }

  /** Las definiciones declaradas, por id. Son globales, como en el backend. */
  const definiciones = new Map<string, DefinicionSimulada>();

  /** Copia a la asignacion lo que la definicion declara y la pantalla dibuja. */
  const deLaDefinicion = (d: DefinicionSimulada) => ({
    ...(d.options === undefined ? {} : { options: d.options }),
    ...(d.multiple === undefined ? {} : { multiple: d.multiple }),
    ...(d.description === undefined ? {} : { description: d.description }),
    ...(d.allowOther === undefined ? {} : { allowOther: d.allowOther }),
    ...(d.cardinalityMin === undefined ? {} : { cardinalityMin: d.cardinalityMin }),
    ...(d.cardinalityMax === undefined ? {} : { cardinalityMax: d.cardinalityMax }),
  });

  /** La plantilla cuyo target coincide, o `undefined`. */
  const plantillaPorTarget = (target: string) =>
    plantillasVigentes().find((t) => t.fieldTargetConceptId === target);

  /** La plantilla que tiene colgada esta asignacion, o `undefined`. */
  const plantillaPorAsignacion = (assignmentId: string) =>
    plantillasVigentes().find((t) => t.fields.some((f) => f.assignmentId === assignmentId));

  router.post('/forms/field-definitions', (request) => {
    const datos = cuerpo<Partial<DefinicionSimulada>>(request);
    const id = nuevoId('field');
    definiciones.set(id, {
      code: datos.code ?? id,
      name: datos.name ?? 'Campo',
      dataType: datos.dataType ?? 'string',
      ...deLaDefinicion(datos as DefinicionSimulada),
    });
    return { status: 201, body: { id } };
  });

  router.post('/forms/assignments', (request) => {
    const datos = cuerpo<{ fieldId: string; targetResourceConceptId: string; required?: boolean; ordinal?: number }>(request);
    const plantilla = plantillaPorTarget(datos.targetResourceConceptId ?? '');
    if (plantilla === undefined) return notFound('Formulario no encontrado');
    const definicion = definiciones.get(datos.fieldId ?? '');
    if (definicion === undefined) return notFound('El campo no esta declarado');

    const assignmentId = nuevoId('field-assignment');
    plantilla.fields.push({
      assignmentId,
      fieldId: datos.fieldId ?? '',
      code: definicion.code,
      name: definicion.name,
      dataType: definicion.dataType,
      ...deLaDefinicion(definicion),
      required: datos.required ?? false,
      ordinal: plantilla.fields.length + 1,
      // `true`: lo agrego esta organizacion. Es lo que lo separa del estandar
      // y lo que lo hace editable en la pantalla.
      own: true,
    });
    return { status: 201, body: { id: assignmentId } };
  });

  /** Corrige el nombre o el tipo de un campo propio. */
  router.patch('/forms/field-definitions/:id', (request) => {
    const fieldId = request.params['id']!;
    const datos = cuerpo<{
      name?: string;
      dataType?: string;
      options?: string[];
      multiple?: boolean;
      description?: string | null;
      allowOther?: boolean;
      cardinalityMin?: number | null;
      cardinalityMax?: number | null;
    }>(request);
    // Las opciones se reemplazan **enteras** y no por índice: el orden importa
    // y un parche por posición se rompe al insertar una en el medio.
    const cambios = {
      ...(datos.name === undefined ? {} : { name: datos.name }),
      ...(datos.dataType === undefined ? {} : { dataType: datos.dataType }),
      ...(datos.options === undefined ? {} : { options: datos.options }),
      ...(datos.multiple === undefined ? {} : { multiple: datos.multiple }),
      ...(datos.allowOther === undefined ? {} : { allowOther: datos.allowOther }),
    };
    // Con `null` se QUITA: es la única forma de sacar una descripción o un tope
    // que ya estaba, porque «no viene» significa «no cambió».
    const anulables = ['description', 'cardinalityMin', 'cardinalityMax'] as const;
    const aplicar = <T extends object>(objeto: T): T => {
      const resultado: Record<string, unknown> = { ...objeto, ...cambios };
      for (const clave of anulables) {
        const valor = datos[clave];
        if (valor === null) delete resultado[clave];
        else if (valor !== undefined) resultado[clave] = valor;
      }
      return resultado as T;
    };
    const definicion = definiciones.get(fieldId);
    if (definicion !== undefined) {
      definiciones.set(fieldId, aplicar(definicion));
    }
    // Y en la plantilla, que es de donde lee la pantalla.
    for (const plantilla of plantillasVigentes()) {
      plantilla.fields = plantilla.fields.map((f) =>
        f.fieldId !== fieldId || !f.own ? f : aplicar(f),
      );
    }
    return { ok: true };
  });

  /** Cambia si el campo es obligatorio. */
  router.patch('/forms/assignments/:id', (request) => {
    const assignmentId = request.params['id']!;
    const plantilla = plantillaPorAsignacion(assignmentId);
    if (plantilla === undefined) return notFound('Campo no encontrado');
    const campo = plantilla.fields.find((f) => f.assignmentId === assignmentId)!;
    // Los del estandar no se tocan: son la parte que hace comparable una ficha
    // entre consultorios.
    if (!campo.own) {
      return { status: 403, body: { message: 'Un campo del formulario estandar no se puede modificar.' } };
    }
    const datos = cuerpo<{ required?: boolean }>(request);
    plantilla.fields = plantilla.fields.map((f) =>
      f.assignmentId !== assignmentId
        ? f
        : { ...f, ...(datos.required === undefined ? {} : { required: datos.required }) },
    );
    return { ok: true };
  });

  /** Descuelga un campo propio del formulario. */
  router.delete('/forms/assignments/:id', ({ params }) => {
    const assignmentId = params['id']!;
    const plantilla = plantillaPorAsignacion(assignmentId);
    if (plantilla === undefined) return notFound('Campo no encontrado');
    const campo = plantilla.fields.find((f) => f.assignmentId === assignmentId)!;
    if (!campo.own) {
      return { status: 403, body: { message: 'Un campo del formulario estandar no se puede quitar.' } };
    }
    plantilla.fields = plantilla.fields
      .filter((f) => f.assignmentId !== assignmentId)
      .map((f, i) => ({ ...f, ordinal: i + 1 }));
    return { ok: true };
  });

  /**
   * Reordena los campos propios.
   *
   * Se manda la lista entera y no «subi este»: dos reordenamientos seguidos
   * sobre una posicion relativa se pisan. Los del estandar conservan su lugar
   * arriba — el orden que se manda es solo el de los propios.
   */
  router.put('/forms/assignments/order', (request) => {
    const { targetResourceConceptId, assignmentIds } = cuerpo<{ targetResourceConceptId: string; assignmentIds: string[] }>(request);
    const plantilla = plantillaPorTarget(targetResourceConceptId ?? '');
    if (plantilla === undefined) return notFound('Formulario no encontrado');
    const estandar = plantilla.fields.filter((f) => !f.own);
    const propios = plantilla.fields.filter((f) => f.own);
    const porId = new Map(propios.map((f) => [f.assignmentId, f]));
    const ordenados = (assignmentIds ?? [])
      .map((id) => porId.get(id))
      .filter((f): f is (typeof propios)[number] => f !== undefined);
    const faltantes = propios.filter((f) => !assignmentIds?.includes(f.assignmentId));
    plantilla.fields = [...estandar, ...ordenados, ...faltantes].map((f, i) => ({ ...f, ordinal: i + 1 }));
    return { ok: true };
  });

  /** El presupuesto se calcula sobre los campos propios de verdad, no fijo. */
  router.get('/forms/assignments/budget', ({ query }) => {
    const target = query.get('targetResourceConceptId') ?? '';
    const plantilla = plantillaPorTarget(target);
    const used = plantilla?.fields.filter((f) => f.own).length ?? 0;
    const maximumFields = 20;
    return { targetResourceConceptId: target, allowTenantFields: true, maximumFields, used, remaining: maximumFields - used };
  });
}
