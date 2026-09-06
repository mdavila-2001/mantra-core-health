import { reservas } from '../fixtures/agenda';
import { conversaciones } from '../fixtures/comunidad';
import { recetas } from '../fixtures/clinica';
import { MEDICA, PACIENTE } from '../fixtures/personas';
import { notFound, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, paginar, uuid } from '../mock-store';

/* ============================================================================
    Notificaciones in-app (la campana) y las preferencias por categoría.
    ========================================================================== */

type Categoria = 'CLINICAL' | 'SCHEDULING' | 'MESSAGES' | 'SOCIAL';

interface NotificacionSimulada {
  readonly id: string;
  readonly userId: string;
  readonly category: Categoria;
  readonly subject: string;
  readonly bodyText: string;
  readonly destination: { type: string; id: string } | null;
  readonly payloadJson: unknown;
  readonly unread: boolean;
  readonly availableAt: string;
  readonly readAt: string | null;
}

function paraPaciente(): NotificacionSimulada[] {
  const citas = reservas.filtrar((r) => r.patientProfileId === PACIENTE.id).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const proxima = citas.find((r) => r.startAt > ahora());
  const receta = recetas.filtrar((r) => r.patientProfileId === PACIENTE.id)[0];
  const conversacion = conversaciones.filtrar((c) => c.participantes.some((p) => p === uuid(`public-profile-${PACIENTE.id}`)))[0];
  return [
    { id: uuid('notif-pac-1'), userId: PACIENTE.userId, category: 'SCHEDULING', subject: 'Tu cita fue confirmada', bodyText: `La Dra. Valeria Rojas Mendoza confirmó tu cita${proxima === undefined ? '' : ` para el ${new Date(proxima.startAt).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${new Date(proxima.startAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`}.`, destination: { type: 'APPOINTMENT', id: proxima?.id ?? '' }, payloadJson: { bookingId: proxima?.id }, unread: true, availableAt: iso(-1, 9), readAt: null },
    { id: uuid('notif-pac-2'), userId: PACIENTE.userId, category: 'CLINICAL', subject: 'Nueva receta disponible', bodyText: 'La Dra. Rojas emitió una receta de enalapril 10 mg. Ya la podés ver en tu historia clínica.', destination: { type: 'PRESCRIPTION', id: receta?.id ?? '' }, payloadJson: null, unread: true, availableAt: iso(-2, 11), readAt: null },
    { id: uuid('notif-pac-3'), userId: PACIENTE.userId, category: 'MESSAGES', subject: 'Te escribió la Dra. Rojas', bodyText: 'Sí. Y si el dolor sigue más de una semana, avisame y lo vemos en consulta.', destination: { type: 'CONVERSATION', id: conversacion?.id ?? '' }, payloadJson: null, unread: false, availableAt: iso(-3, 18), readAt: iso(-3, 18, 30) },
    { id: uuid('notif-pac-4'), userId: PACIENTE.userId, category: 'CLINICAL', subject: 'Resultados de laboratorio listos', bodyText: 'Laboratorio Central publicó los resultados de tu hemograma y perfil lipídico.', destination: { type: 'DIAGNOSTIC_REPORT', id: uuid('report-1') }, payloadJson: null, unread: false, availableAt: iso(-5, 8), readAt: iso(-5, 9) },
    { id: uuid('notif-pac-5'), userId: PACIENTE.userId, category: 'SCHEDULING', subject: 'Recordatorio de cita', bodyText: 'Mañana tenés control con el Dr. Salazar Vaca (pediatría) a las 10:00.', destination: { type: 'APPOINTMENT', id: citas[1]?.id ?? '' }, payloadJson: null, unread: false, availableAt: iso(-8, 20), readAt: iso(-8, 21) },
    { id: uuid('notif-pac-6'), userId: PACIENTE.userId, category: 'SOCIAL', subject: 'Nueva publicación de la Dra. Rojas', bodyText: '«¿Sabías que la hipertensión no suele dar síntomas?…»', destination: { type: 'POST', id: uuid('post-0') }, payloadJson: null, unread: false, availableAt: iso(-1, 10), readAt: iso(-1, 12) },
    { id: uuid('notif-pac-7'), userId: PACIENTE.userId, category: 'CLINICAL', subject: 'Un profesional pide ver tu historia clínica', bodyText: 'El Dr. Daniel Aguilar Roca pide tu autorización para ver tu expediente. Podés elegir qué áreas autorizar, o rechazarlo.', destination: { type: 'CARE_RELATIONSHIP_REQUEST', id: uuid('care-request-pendiente') }, payloadJson: null, unread: true, availableAt: iso(0, 8, 30), readAt: null },
    { id: uuid('notif-pac-8'), userId: PACIENTE.userId, category: 'SCHEDULING', subject: 'Tu pedido de farmacia está listo', bodyText: 'Farmacia Vida preparó tu pedido. Podés retirarlo o esperar la entrega a domicilio.', destination: { type: 'PHARMACY_ORDER', id: uuid('pharmacy-order-1') }, payloadJson: null, unread: false, availableAt: iso(-4, 16), readAt: iso(-4, 17) },
  ];
}

function paraMedica(): NotificacionSimulada[] {
  const solicitudes = reservas.filtrar((r) => r.startAt > ahora()).sort((a, b) => a.startAt.localeCompare(b.startAt));
  return [
    { id: uuid('notif-med-1'), userId: MEDICA.userId, category: 'SCHEDULING', subject: 'Nueva solicitud de consulta', bodyText: `${solicitudes[0]?.patientName ?? 'Un paciente'} pidió turno: «${solicitudes[0]?.reasonText ?? 'Consulta'}».`, destination: { type: 'APPOINTMENT', id: solicitudes[0]?.id ?? '' }, payloadJson: null, unread: true, availableAt: iso(0, 7, 45), readAt: null },
    { id: uuid('notif-med-2'), userId: MEDICA.userId, category: 'MESSAGES', subject: 'Ana Lucía Pérez Quiroga te escribió', bodyText: 'Doctora, ya me llegaron los resultados del laboratorio…', destination: { type: 'CONVERSATION', id: uuid('conv-medica-paciente') }, payloadJson: null, unread: true, availableAt: iso(0, 9, 12), readAt: null },
    { id: uuid('notif-med-3'), userId: MEDICA.userId, category: 'SCHEDULING', subject: 'Cita cancelada', bodyText: 'Jorge Luis Mamani Choque canceló su cita de mañana: «El paciente avisó que viajaba».', destination: { type: 'APPOINTMENT', id: '' }, payloadJson: null, unread: true, availableAt: iso(-1, 17), readAt: null },
    { id: uuid('notif-med-4'), userId: MEDICA.userId, category: 'CLINICAL', subject: 'Resultado crítico', bodyText: 'Laboratorio Central informa potasio 5,9 mmol/L en Ricardo Condori Apaza.', destination: { type: 'DIAGNOSTIC_REPORT', id: uuid('report-critico') }, payloadJson: null, unread: false, availableAt: iso(-2, 13), readAt: iso(-2, 13, 20) },
    { id: uuid('notif-med-5'), userId: MEDICA.userId, category: 'SOCIAL', subject: 'Tu publicación tiene 30 reacciones', bodyText: '«¿Sabías que la hipertensión no suele dar síntomas?…» sigue sumando.', destination: { type: 'POST', id: uuid('post-0') }, payloadJson: null, unread: false, availableAt: iso(-1, 20), readAt: iso(-1, 21) },
    { id: uuid('notif-med-6'), userId: MEDICA.userId, category: 'SCHEDULING', subject: 'Solicitud de vinculación aprobada', bodyText: 'Hospital San Lucas aprobó tu vinculación como médica de planta.', destination: null, payloadJson: null, unread: false, availableAt: iso(-6, 10), readAt: iso(-6, 11) },
    { id: uuid('notif-med-7'), userId: MEDICA.userId, category: 'MESSAGES', subject: 'Dra. Terrazas te escribió', bodyText: 'Le pedí un Holter, cuando lo tengas lo vemos juntas.', destination: { type: 'CONVERSATION', id: uuid('conv-medica-endocrino') }, payloadJson: null, unread: true, availableAt: iso(-1, 8, 47), readAt: null },
  ];
}

const notificaciones = new Coleccion<NotificacionSimulada>([...paraPaciente(), ...paraMedica()]);

const preferencias = new Map<string, { categories: { category: Categoria; optedIn: boolean }[]; quietHours: { start: string; end: string } | null }>();

function preferenciasDe(userId: string) {
  let p = preferencias.get(userId);
  if (p === undefined) {
    p = { categories: [{ category: 'CLINICAL', optedIn: true }, { category: 'SCHEDULING', optedIn: true }, { category: 'MESSAGES', optedIn: true }, { category: 'SOCIAL', optedIn: userId !== MEDICA.userId }], quietHours: userId === MEDICA.userId ? { start: '22:00', end: '07:00' } : null };
    preferencias.set(userId, p);
  }
  return p;
}

function propias(request: MockRequest): NotificacionSimulada[] {
  const userId = request.user?.id;
  return notificaciones.filtrar((n) => n.userId === userId || (userId !== undefined && userId !== PACIENTE.userId && userId !== MEDICA.userId && n.userId === MEDICA.userId && n.category === 'SCHEDULING'));
}

export function registrarNotificaciones(router: MockRouter): void {
  router.get('/notifications/me', (request) => {
    const soloNoLeidas = request.query.get('unread') === 'true';
    const todas = propias(request)
      .filter((n) => !soloNoLeidas || n.unread)
      .sort((a, b) => b.availableAt.localeCompare(a.availableAt))
      .map(({ userId: _u, ...n }) => n);
    return { ...paginar(todas, request.query, 20), unreadCount: propias(request).filter((n) => n.unread).length };
  });

  router.post('/notifications/in-app/:id/read', ({ params }) => {
    const n = notificaciones.get(params['id']!);
    if (n === undefined) return notFound('Notificación no encontrada');
    const yaLeida = !n.unread;
    const readAt = n.readAt ?? ahora();
    notificaciones.actualizar(n.id, { unread: false, readAt });
    return { id: n.id, readAt, alreadyRead: yaLeida };
  });

  router.post('/notifications/in-app/read-all', (request) => {
    const pendientes = propias(request).filter((n) => n.unread);
    for (const n of pendientes) notificaciones.actualizar(n.id, { unread: false, readAt: ahora() });
    return { marked: pendientes.length, unreadCount: 0 };
  });

  router.get('/notifications/preferences/me', (request) => preferenciasDe(request.user?.id ?? ''));

  router.put('/notifications/preferences/me', (request) => {
    const actuales = preferenciasDe(request.user?.id ?? '');
    const datos = cuerpo<{ categories?: { category: Categoria; optedIn: boolean }[]; quietHours?: { start: string; end: string } | null }>(request);
    const siguiente = {
      categories: datos.categories ?? actuales.categories,
      quietHours: datos.quietHours === undefined ? actuales.quietHours : datos.quietHours,
    };
    preferencias.set(request.user?.id ?? '', siguiente);
    return siguiente;
  });
  router.patch('/notifications/preferences/me', (request) => {
    const actuales = preferenciasDe(request.user?.id ?? '');
    const datos = cuerpo<{ categories?: { category: Categoria; optedIn: boolean }[]; quietHours?: { start: string; end: string } | null }>(request);
    const siguiente = { categories: datos.categories ?? actuales.categories, quietHours: datos.quietHours === undefined ? actuales.quietHours : datos.quietHours };
    preferencias.set(request.user?.id ?? '', siguiente);
    return siguiente;
  });
}
