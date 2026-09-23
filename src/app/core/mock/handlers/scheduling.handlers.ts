import {
  bloqueos,
  cupos,
  listaDeEspera,
  plantillas,
  POLITICA_ESTANDAR,
  recursos,
  reservas,
  type BloqueoSimulado,
  type CupoSimulado,
  type PlantillaSimulada,
  type ReservaSimulada,
} from '../fixtures/agenda';
import { ACTIVIDAD, CANAL, ESTADO, ESTADO_RESERVA, TIPO_BLOQUEO, TIPO_CITA } from '../fixtures/conceptos';
import { emitirNotificacion } from './notifications.handlers';
import { solicitudDeLaCita } from './insurance.handlers';
import { pacientePorId } from '../fixtures/personas';
import { representaA } from './profiles.handlers';
import { conflict, noContent, notFound, preconditionFailed, reply, validation, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, cuerpo, masMinutos, nuevoId, texto, uuid } from '../mock-store';

/* ============================================================================
    Agenda: recursos, cupos, reservas, plantillas, bloqueos y lista de espera.
    Las escrituras cambian el estado en memoria, así que un flujo entero
    (reservar → aceptar → llegada → atender → cobrar) se puede recorrer.
    ========================================================================== */

/**
 * `requiresText` sólo es `true` en `OTHER`.
 *
 * Antes lo llevaban también `ABSENCE`, `CONFERENCE` y `ERRAND` — divergía del
 * contrato real, que declara un único motivo que exige explicación:
 * `MOTIVO_QUE_EXIGE_TEXTO: ExceptionType = 'OTHER'`
 * (`scheduling-catalog.service.ts:163`, con `requiresText: type ===
 * MOTIVO_QUE_EXIGE_TEXTO` en la 1245). Con el doble como estaba, un
 * formulario que sólo manda `reason` cuando el usuario escribió algo podía
 * dar 201 contra la API real y un rechazo (por falta de texto en pantalla)
 * contra la maqueta — el error simétrico de "más permisivo que la API".
 */
const TIPOS_DE_BLOQUEO = [
  { type: 'ABSENCE', conceptId: TIPO_BLOQUEO['EXC-PERSONAL']!, label: 'Ausencia', requiresText: false, blocks: true },
  { type: 'HOLIDAY', conceptId: TIPO_BLOQUEO['EXC-FERIADO']!, label: 'Feriado', requiresText: false, blocks: true },
  { type: 'VACATION', conceptId: TIPO_BLOQUEO['EXC-VACACIONES']!, label: 'Vacaciones', requiresText: false, blocks: true },
  { type: 'CONFERENCE', conceptId: TIPO_BLOQUEO['EXC-CONGRESO']!, label: 'Congreso', requiresText: false, blocks: true },
  { type: 'ERRAND', conceptId: TIPO_BLOQUEO['EXC-PERSONAL']!, label: 'Trámite personal', requiresText: false, blocks: true },
  { type: 'EXTRA', conceptId: TIPO_BLOQUEO['EXC-CIRUGIA']!, label: 'Horario extra', requiresText: false, blocks: false },
  { type: 'OTHER', conceptId: TIPO_BLOQUEO['EXC-PERSONAL']!, label: 'Otro', requiresText: true, blocks: true },
] as const;

function dentro(instante: string, from: string | null, to: string | null): boolean {
  if (from !== null && instante < from) return false;
  if (to !== null && instante > to) return false;
  return true;
}

function estadoEs(r: ReservaSimulada, ...estados: (keyof typeof ESTADO_RESERVA)[]): boolean {
  return estados.some((e) => ESTADO_RESERVA[e] === r.statusConceptId);
}

function reservaVisible(request: MockRequest, r: ReservaSimulada): boolean {
  const user = request.user;
  if (user === null) return false;
  if (user.patientProfileId !== undefined && user.practitionerProfileId === undefined) {
    // Lo suyo, y lo de quienes representa (B.1): quien pidió el turno de su hijo
    // tiene que verlo en su listado.
    return (
      r.patientProfileId === user.patientProfileId ||
      representaA(user.patientProfileId, r.patientProfileId)
    );
  }
  return true;
}

function cambiarEstado(id: string, estado: keyof typeof ESTADO_RESERVA, extra: Partial<ReservaSimulada> = {}) {
  const r = reservas.get(id);
  if (r === undefined) return undefined;
  return reservas.actualizar(id, { statusConceptId: ESTADO_RESERVA[estado]!, ...extra });
}

/**
 * Deja el aviso de demora en la campana del paciente de una reserva.
 *
 * El aviso ya viajaba pegado a la cita —la portada del paciente y su listado lo
 * muestran—, pero eso sólo se ve si la persona ENTRA a mirar. La demora se
 * avisa justo cuando el paciente no está en la aplicación: está yendo al
 * consultorio. Por eso además se le deja una notificación, que es lo que el
 * registro de procesos pide en el módulo Paciente («SI EL MEDICO SE DEMORARÁ
 * PUEDES RECIBIR UNA NOTIFICACION DE LA APP») y en el módulo Médico («EL
 * PACIENTE RECIBIRA UNA NOTIFICACION DEL COMUNICADO DEL MEDICO»).
 *
 * @returns `true` si el paciente tiene cuenta y se le pudo dejar el aviso.
 */
function avisarDemoraAlPaciente(
  reserva: ReservaSimulada,
  minutos: number,
  mensaje: string | undefined,
): boolean {
  const paciente = pacientePorId(reserva.patientProfileId);
  if (paciente === undefined) return false;

  const hora = new Date(reserva.startAt).toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  // El mensaje del profesional va DESPUÉS del dato duro y entre comillas: es su
  // voz, no la del sistema, y quien lee necesita primero cuánto y de qué cita.
  const explicacion = mensaje === undefined || mensaje.trim() === '' ? '' : ` «${mensaje.trim()}»`;

  emitirNotificacion({
    userId: paciente.userId,
    category: 'SCHEDULING',
    subject: `Tu cita de las ${hora} se demora ${minutos} minutos`,
    // El nombre sale del RECURSO, que es donde vive: la reserva guarda el del
    // paciente, no el de quien atiende.
    bodyText: `${recursos.get(reserva.resourceId)?.practitionerName ?? 'Tu profesional'} avisó una demora de ${minutos} minutos en tu cita de las ${hora}.${explicacion}`,
    destination: { type: 'APPOINTMENT', id: reserva.id },
    payloadJson: { bookingId: reserva.id, delayMinutes: minutos },
  });
  return true;
}

export function registrarAgenda(router: MockRouter): void {
  router.get('/scheduling/resources', ({ query }) => {
    const tenantId = texto(query, 'tenantId');
    const practiceId = texto(query, 'practiceId');
    const includeInactive = query.get('includeInactive') === 'true';
    const items = recursos
      .todos()
      .filter((r) => tenantId === null || r.tenantId === tenantId || true)
      .filter((r) => practiceId === null || r.practiceId === practiceId)
      .filter((r) => includeInactive || r.stateConceptId === ESTADO['ST-ACTIVE'])
      .map(({ tenantId: _t, ...r }) => r);
    return { items, count: items.length };
  });

  router.post('/scheduling/resources', (request) => {
    const datos = cuerpo<{ name: string; tenantId: string; resourceRefType: string; resourceRefId: string; practiceId?: string; timeZone?: string; capacity?: number }>(request);
    const nuevo = recursos.agregar({
      id: nuevoId('resource'),
      name: datos.name ?? 'Recurso nuevo',
      resourceTypeConceptId: uuid('concept-resource-practitioner'),
      resourceRefType: datos.resourceRefType ?? 'health_practitioner_profiles',
      resourceRefId: datos.resourceRefId ?? '',
      practitionerName: datos.name ?? null,
      practiceId: datos.practiceId ?? null,
      tenantId: datos.tenantId ?? '',
      timeZone: datos.timeZone ?? 'America/La_Paz',
      capacity: datos.capacity ?? 1,
      stateConceptId: ESTADO['ST-ACTIVE']!,
      site: null,
    });
    return { status: 201, body: { id: nuevo.id, name: nuevo.name, stateConceptId: nuevo.stateConceptId } };
  });

  router.post('/scheduling/booking-policies', (request) => {
    const datos = cuerpo<{ code: string }>(request);
    return { status: 201, body: { id: nuevoId('policy'), code: datos.code ?? 'POL', stateConceptId: ESTADO['ST-ACTIVE']! } };
  });

  router.get('/scheduling/slots', ({ query }) => {
    const resourceId = texto(query, 'resourceId');
    const templateId = texto(query, 'scheduleTemplateId');
    const from = texto(query, 'from');
    const to = texto(query, 'to');
    const onlyAvailable = query.get('onlyAvailable') === 'true';
    const limit = Number(query.get('limit') ?? 500) || 500;
    const todos = cupos
      .todos()
      .filter((c) => resourceId === null || c.resourceId === resourceId)
      .filter((c) => templateId === null || c.scheduleTemplateId === templateId)
      .filter((c) => dentro(c.startAt, from, to))
      .filter((c) => !onlyAvailable || (c.remainingCapacity > 0 && c.statusConceptId === ESTADO['ST-ACTIVE']))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    return { items: todos.slice(0, limit), count: Math.min(todos.length, limit), limit, truncated: todos.length > limit };
  });

  router.post('/scheduling/slots/:id/holds', ({ params }) => {
    const cupo = cupos.get(params['id']!);
    if (cupo === undefined) return notFound('Cupo no encontrado');
    if (cupo.remainingCapacity <= 0) return conflict('El cupo ya no tiene lugar', { slotId: cupo.id });
    return {
      status: 201,
      body: { id: nuevoId('hold'), holdToken: `hold.${cupo.id}`, expiresAt: masMinutos(ahora(), 5), remainingCapacity: cupo.remainingCapacity - 1 },
    };
  });

  const confirmar = (estado: 'BK-CONFIRMED' | 'BK-REQUESTED') => (request: MockRequest) => {
    const token = request.params['token'] ?? '';
    const slotId = token.startsWith('hold.') ? token.slice(5) : token;
    const cupo = cupos.get(slotId);
    if (cupo === undefined) return preconditionFailed('El hold venció o no existe');
    const datos = cuerpo<{ patientProfileId: string; channel?: string; reasonText?: string }>(request);
    const paciente = pacientePorId(datos.patientProfileId ?? request.user?.patientProfileId ?? '');
    const nueva: ReservaSimulada = {
      id: nuevoId('booking'),
      patientProfileId: paciente?.id ?? datos.patientProfileId ?? '',
      resourceId: cupo.resourceId,
      bookableSlotId: cupo.id,
      appointmentId: estado === 'BK-CONFIRMED' ? nuevoId('appointment') : null,
      typeConceptId: TIPO_CITA['APT-PRIMERA']!,
      startAt: cupo.startAt,
      endAt: cupo.endAt,
      statusConceptId: ESTADO_RESERVA[estado]!,
      serviceConceptId: cupo.serviceConceptId ?? ACTIVIDAD['ACT-CONSULTA']!,
      bookingChannelConceptId: datos.channel === 'PHONE' ? CANAL['CH-TELECONSULTA']! : CANAL['CH-PRESENCIAL']!,
      confirmedAt: estado === 'BK-CONFIRMED' ? ahora() : null,
      checkedInAt: null,
      reasonText: datos.reasonText ?? 'Consulta',
      patientName: paciente?.displayName ?? 'Paciente',
      insuranceCarrierName: paciente?.aseguradora ?? null,
      rescheduledFrom: null,
      statusReason: null,
      delayNotice: null,
      paymentState: null,
      createdAt: ahora(),
    };
    reservas.agregar(nueva);
    cupos.actualizar(cupo.id, { remainingCapacity: Math.max(0, cupo.remainingCapacity - 1) });
    return { status: 201, body: { id: nueva.id, bookableSlotId: cupo.id, statusConceptId: nueva.statusConceptId, remindersScheduled: 2 } };
  };
  router.post('/scheduling/holds/:token/confirm', confirmar('BK-CONFIRMED'));
  router.post('/scheduling/holds/:token/request', confirmar('BK-REQUESTED'));

  router.get('/scheduling/bookings', (request) => {
    const { query } = request;
    const patientProfileId = texto(query, 'patientProfileId');
    const resourceId = texto(query, 'resourceId');
    const from = texto(query, 'from');
    const to = texto(query, 'to');
    const includeCancelled = query.get('includeCancelled') === 'true';
    const limit = Number(query.get('limit') ?? 100) || 100;
    const todos = reservas
      .todos()
      .filter((r) => reservaVisible(request, r))
      .filter((r) => patientProfileId === null || r.patientProfileId === patientProfileId)
      .filter((r) => resourceId === null || r.resourceId === resourceId)
      .filter((r) => dentro(r.startAt, from, to))
      .filter((r) => includeCancelled || !estadoEs(r, 'BK-CANCELLED', 'BK-REJECTED'))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    // `insuranceClaim` se resuelve al leer, como en la API: la solicitud cambia de
    // estado sin que la cita se entere.
    const items = todos.slice(0, limit).map((r) => ({ ...r, insuranceClaim: solicitudDeLaCita(r) }));
    return { items, count: Math.min(todos.length, limit), limit, truncated: todos.length > limit };
  });

  router.get('/scheduling/bookings/:id', ({ params }) => reservas.get(params['id']!) ?? notFound('Reserva no encontrada'));

  /* El cliente hace `PUT` (es idempotente) y devuelve `PaymentStateInfo`, no
     la reserva: la agenda lee `estado.label` para el aviso. Con `POST` y la
     reserva entera el eco genérico decía «undefined.» y nada cambiaba. */
  const marcarPago = (request: MockRequest) => {
    const r = reservas.get(request.params['id']!);
    if (r === undefined) return notFound();
    const datos = cuerpo<{ state: 'PENDING' | 'PARTIALLY_PAID' | 'PAID'; insuranceUsed?: boolean }>(request);
    const state = datos.state ?? 'PAID';
    const actualizada = reservas.actualizar(r.id, {
      paymentState: {
        state,
        label: state === 'PAID' ? 'Pagada' : state === 'PARTIALLY_PAID' ? 'Pago parcial' : 'Pendiente',
        conceptId: ESTADO['ST-COMPLETED']!,
        insuranceUsed: datos.insuranceUsed ?? false,
        markedByUserId: request.user?.id ?? '',
        markedAt: ahora(),
      },
    });
    return actualizada?.paymentState ?? notFound();
  };
  router.put('/scheduling/bookings/:id/payment-state', marcarPago);
  router.post('/scheduling/bookings/:id/payment-state', marcarPago);

  router.post('/scheduling/bookings/:id/cancel', (request) => {
    const r = reservas.get(request.params['id']!);
    if (r === undefined) return notFound();
    const datos = cuerpo<{ cancelledBy: 'PATIENT' | 'PROVIDER'; isNoShow?: boolean; reasonText: string }>(request);
    const estado = datos.isNoShow ? 'BK-NO-SHOW' : 'BK-CANCELLED';
    cambiarEstado(r.id, estado, {
      statusReason: { reasonText: datos.reasonText ?? '', actorKind: datos.cancelledBy ?? 'PROVIDER', toStateConceptId: ESTADO_RESERVA[estado]!, changedAt: ahora() },
    });
    const cupo = cupos.get(r.bookableSlotId);
    if (cupo !== undefined) cupos.actualizar(cupo.id, { remainingCapacity: cupo.capacity });
    return { bookingId: r.id, feeAmount: datos.isNoShow ? '50.00' : undefined, capacityReleased: true };
  });

  router.post('/scheduling/bookings/:id/reject', (request) => {
    const r = reservas.get(request.params['id']!);
    if (r === undefined) return notFound();
    const datos = cuerpo<{ reasonText: string }>(request);
    cambiarEstado(r.id, 'BK-REJECTED', {
      statusReason: { reasonText: datos.reasonText ?? '', actorKind: 'PROVIDER', toStateConceptId: ESTADO_RESERVA['BK-REJECTED']!, changedAt: ahora() },
    });
    return { bookingId: r.id, capacityReleased: true };
  });

  router.post('/scheduling/bookings/:id/reschedule', (request) => {
    const r = reservas.get(request.params['id']!);
    if (r === undefined) return notFound();
    const datos = cuerpo<{ toSlotId: string; reasonText: string }>(request);
    const destino = cupos.get(datos.toSlotId ?? '');
    if (destino === undefined || destino.remainingCapacity <= 0) return conflict('El cupo de destino no está disponible');
    cupos.actualizar(r.bookableSlotId, { remainingCapacity: 1 });
    cupos.actualizar(destino.id, { remainingCapacity: 0 });
    reservas.actualizar(r.id, {
      bookableSlotId: destino.id,
      resourceId: destino.resourceId,
      startAt: destino.startAt,
      endAt: destino.endAt,
      rescheduledFrom: r.startAt,
      statusReason: { reasonText: datos.reasonText ?? '', actorKind: 'PROVIDER', toStateConceptId: r.statusConceptId, changedAt: ahora() },
    });
    return { bookingId: r.id, fromSlotId: r.bookableSlotId, toSlotId: destino.id };
  });

  const decision = (estado: keyof typeof ESTADO_RESERVA, extra: (r: ReservaSimulada) => Partial<ReservaSimulada> = () => ({})) => (request: MockRequest) => {
    const r = reservas.get(request.params['id']!);
    if (r === undefined) return notFound();
    cambiarEstado(r.id, estado, extra(r));
    return { bookingId: r.id, statusConceptId: ESTADO_RESERVA[estado]!, occurredAt: ahora() };
  };
  router.post('/scheduling/bookings/:id/accept', decision('BK-CONFIRMED', () => ({ confirmedAt: ahora(), appointmentId: nuevoId('appointment') })));
  router.post('/scheduling/bookings/:id/start', decision('BK-IN-PROGRESS'));
  router.post('/scheduling/bookings/:id/complete', decision('BK-COMPLETED'));

  router.post('/scheduling/bookings/:id/check-in', ({ params }) => {
    const r = reservas.get(params['id']!);
    if (r === undefined) return notFound();
    const checkedInAt = ahora();
    cambiarEstado(r.id, 'BK-CHECKED-IN', { checkedInAt });
    return { bookingId: r.id, checkedInAt };
  });

  router.post('/scheduling/bookings/:id/delay', (request) => {
    const r = reservas.get(request.params['id']!);
    if (r === undefined) return notFound();
    const datos = cuerpo<{ delayMinutes: number; message?: string }>(request);
    const minutos = datos.delayMinutes ?? 15;
    reservas.actualizar(r.id, { delayNotice: { delayMinutes: minutos, message: datos.message ?? 'Demora en la atención', announcedAt: ahora() } });
    const avisado = avisarDemoraAlPaciente(r, minutos, datos.message);
    return { notified: avisado ? 1 : 0, affected: 1, bookingIds: [r.id], detail: avisado ? `Se avisó a ${r.patientName} una demora de ${minutos} minutos.` : `${r.patientName} no tiene cuenta de portal: avisale por otro medio.` };
  });

  router.post('/scheduling/resources/:id/delay', (request) => {
    const datos = cuerpo<{ delayMinutes: number; message?: string; from?: string; to?: string }>(request);
    const hoy = new Date().toDateString();
    const afectadas = reservas
      .todos()
      .filter((r) => r.resourceId === request.params['id'] && new Date(r.startAt).toDateString() === hoy && estadoEs(r, 'BK-CONFIRMED', 'BK-CHECKED-IN'))
      .filter((r) => new Date(r.startAt).getTime() > Date.now());
    const minutos = datos.delayMinutes ?? 15;
    let avisados = 0;
    for (const r of afectadas) {
      reservas.actualizar(r.id, { delayNotice: { delayMinutes: minutos, message: datos.message ?? 'Demora en la atención', announcedAt: ahora() } });
      if (avisarDemoraAlPaciente(r, minutos, datos.message)) avisados += 1;
    }
    return { notified: avisados, affected: afectadas.length, bookingIds: afectadas.map((r) => r.id), detail: `${avisados} de ${afectadas.length} pacientes avisados.` };
  });

  router.post('/scheduling/appointments/direct', (request) => {
    const datos = cuerpo<{ patientProfileId: string; resourceId: string; startAt: string; durationMinutes: number; reasonText?: string; channel?: string }>(request);
    const paciente = pacientePorId(datos.patientProfileId ?? '');
    const startAt = datos.startAt ?? ahora();
    const endAt = masMinutos(startAt, datos.durationMinutes ?? 30);
    const pisados = cupos.filtrar((c) => c.resourceId === datos.resourceId && c.startAt < endAt && c.endAt > startAt);
    for (const c of pisados) cupos.actualizar(c.id, { remainingCapacity: 0, statusConceptId: ESTADO['ST-CLOSED']! });
    const cupo: CupoSimulado = {
      id: nuevoId('slot-directo'),
      resourceId: datos.resourceId ?? '',
      scheduleTemplateId: null,
      startAt,
      endAt,
      capacity: 1,
      remainingCapacity: 0,
      statusConceptId: ESTADO['ST-ACTIVE']!,
      serviceConceptId: ACTIVIDAD['ACT-CONSULTA']!,
    };
    cupos.agregar(cupo);
    const nueva: ReservaSimulada = {
      id: nuevoId('booking-directa'),
      patientProfileId: paciente?.id ?? datos.patientProfileId ?? '',
      resourceId: cupo.resourceId,
      bookableSlotId: cupo.id,
      appointmentId: nuevoId('appointment'),
      typeConceptId: TIPO_CITA['APT-CONTROL']!,
      startAt,
      endAt,
      statusConceptId: ESTADO_RESERVA['BK-CONFIRMED']!,
      serviceConceptId: ACTIVIDAD['ACT-CONSULTA']!,
      bookingChannelConceptId: datos.channel === 'TELECONSULTA' ? CANAL['CH-TELECONSULTA']! : datos.channel === 'DOMICILIO' ? CANAL['CH-DOMICILIO']! : CANAL['CH-PRESENCIAL']!,
      confirmedAt: ahora(),
      checkedInAt: null,
      reasonText: datos.reasonText ?? 'Cita creada por el profesional',
      patientName: paciente?.displayName ?? 'Paciente',
      insuranceCarrierName: paciente?.aseguradora ?? null,
      rescheduledFrom: null,
      statusReason: null,
      delayNotice: null,
      paymentState: null,
      createdAt: ahora(),
    };
    reservas.agregar(nueva);
    return { status: 201, body: { bookingId: nueva.id, bookableSlotId: cupo.id, statusConceptId: nueva.statusConceptId, retractedSlots: pisados.length } };
  });

  /* ---- plantillas --------------------------------------------------------- */

  router.get('/scheduling/resources/:id/templates', ({ params }) => {
    const items = plantillas.filtrar((t) => t.resourceId === params['id']).map(({ resourceId: _r, ...t }) => t);
    return { items, count: items.length };
  });

  router.post('/scheduling/resources/:id/templates', (request) => {
    const datos = cuerpo<{ name: string; rules: PlantillaSimulada['rules']; slotMinutes?: number; bookingPolicyId?: string; validFrom?: string; validTo?: string; flexibleHours?: boolean }>(request);
    const nueva = plantillas.agregar({
      id: nuevoId('template'),
      resourceId: request.params['id']!,
      retired: false,
      name: datos.name ?? 'Horario nuevo',
      rules: datos.rules ?? [],
      slotMinutes: datos.slotMinutes ?? 30,
      validFrom: datos.validFrom ?? ahora().slice(0, 10),
      ...(datos.validTo === undefined ? {} : { validTo: datos.validTo }),
      ...(datos.flexibleHours === true ? { flexibleHours: true } : {}),
      bookingPolicyId: datos.bookingPolicyId ?? POLITICA_ESTANDAR,
      statusConceptId: ESTADO['ST-PUBLISHED']!,
    });
    return { status: 201, body: { id: nueva.id, name: nueva.name, ruleCount: nueva.rules.length, statusConceptId: nueva.statusConceptId } };
  });

  router.patch('/scheduling/templates/:id', (request) => {
    const t = plantillas.get(request.params['id']!);
    if (t === undefined) return notFound();
    const datos = cuerpo<Partial<PlantillaSimulada>>(request);
    const actualizada = plantillas.actualizar(t.id, datos)!;
    const { resourceId: _r, ...resto } = actualizada;
    return resto;
  });

  /**
   * Retira un horario publicado.
   *
   * **Responde 409 con las citas comprometidas**, igual que el contrato: sin
   * eso la maqueta dejaba retirar cualquier horario y el camino del error —el
   * que impide mover turnos de pacientes sin avisar— no se podía ni ver ni
   * probar.
   */
  router.delete('/scheduling/templates/:id', ({ params }) => {
    const t = plantillas.get(params['id']!);
    if (t === undefined) return notFound();
    const delHorario = new Set(cupos.filtrar((c) => c.scheduleTemplateId === t.id).map((c) => c.id));
    const comprometidas = reservas.filtrar(
      (r) =>
        delHorario.has(r.bookableSlotId) &&
        r.startAt > ahora() &&
        estadoEs(r, 'BK-CONFIRMED', 'BK-CHECKED-IN', 'BK-IN-PROGRESS'),
    );
    if (comprometidas.length > 0) {
      return conflict(
        `El horario tiene ${comprometidas.length} ${comprometidas.length === 1 ? 'cita comprometida' : 'citas comprometidas'}: resolvelas antes de cambiarlo.`,
        { bookingIds: comprometidas.map((r) => r.id) },
      );
    }
    plantillas.actualizar(t.id, { retired: true, statusConceptId: ESTADO['ST-ARCHIVED']! });
    const libres = cupos.filtrar((c) => c.scheduleTemplateId === t.id && c.remainingCapacity > 0 && c.startAt > ahora());
    for (const c of libres) cupos.borrar(c.id);
    return { id: t.id, statusConceptId: ESTADO['ST-ARCHIVED']!, releasedSlots: libres.length, keptSlots: cupos.filtrar((c) => c.scheduleTemplateId === t.id).length };
  });

  router.post('/scheduling/templates/:id/reactivate', ({ params }) => {
    const t = plantillas.get(params['id']!);
    if (t === undefined) return notFound();
    plantillas.actualizar(t.id, { retired: false, statusConceptId: ESTADO['ST-PUBLISHED']! });
    return { id: t.id, statusConceptId: ESTADO['ST-PUBLISHED']!, slotsPendientes: true };
  });

  router.post('/scheduling/templates/:id/generate-slots', (request) => {
    const t = plantillas.get(request.params['id']!);
    if (t === undefined) return notFound();
    const datos = cuerpo<{ from: string; to: string }>(request);
    const desde = new Date(datos.from ?? ahora());
    const hasta = new Date(datos.to ?? masMinutos(ahora(), 60 * 24 * 14));
    let created = 0;
    let skipped = 0;
    for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
      // TODAS las franjas del día, no la primera: con hora de almuerzo un día
      // son dos franjas (mañana y tarde), igual que en el generador real, que
      // recorre cada regla. Con `find` la tarde desaparecía en silencio.
      for (const regla of t.rules.filter((r) => r.dayOfWeek === d.getDay())) {
        const [hi, mi] = regla.startTime.split(':').map(Number) as [number, number];
        const [hf, mf] = regla.endTime.split(':').map(Number) as [number, number];
        const apertura = hi * 60 + mi;
        const cierre = hf * 60 + mf;
        // Horario flexible (P36): la franja entera es UN bloque abierto y el
        // paciente pide dentro de ella la hora que quiera. La capacidad es una
        // suposición de la maqueta —una consulta cada 15 min como techo— hasta
        // que el backend defina el modo; está anotado en P36.
        const flexible = t.flexibleHours === true;
        const dur = flexible ? cierre - apertura : (regla.slotMinutes ?? t.slotMinutes);
        const paso = flexible ? dur : dur + (regla.gapMinutes ?? 0);
        const capacidad = flexible ? Math.max(1, Math.floor(dur / 15)) : (regla.capacityPerSlot ?? 1);
        if (dur <= 0) continue;
        for (let m = apertura; m + dur <= cierre; m += paso) {
          const inicio = new Date(d);
          inicio.setHours(Math.floor(m / 60), m % 60, 0, 0);
          const id = uuid(`slot-${t.id}-${inicio.toISOString()}`);
          if (cupos.has(id) || cupos.filtrar((c) => c.resourceId === t.resourceId && c.startAt === inicio.toISOString()).length > 0) {
            skipped++;
            continue;
          }
          cupos.agregar({
            id,
            resourceId: t.resourceId,
            scheduleTemplateId: t.id,
            startAt: inicio.toISOString(),
            endAt: new Date(inicio.getTime() + dur * 60_000).toISOString(),
            capacity: capacidad,
            remainingCapacity: capacidad,
            statusConceptId: ESTADO['ST-ACTIVE']!,
            serviceConceptId: ACTIVIDAD['ACT-CONSULTA']!,
          });
          created++;
        }
      }
    }
    return { templateId: t.id, created, skipped };
  });

  router.post('/scheduling/resources/:id/shift-slots', (request) => {
    const datos = cuerpo<{ shiftMinutes: number; from: string; to: string; slotIds?: string[] }>(request);
    const afectados = cupos.filtrar((c) => c.resourceId === request.params['id'] && (datos.slotIds === undefined ? dentro(c.startAt, datos.from ?? null, datos.to ?? null) : datos.slotIds.includes(c.id)));
    for (const c of afectados) {
      cupos.actualizar(c.id, { startAt: masMinutos(c.startAt, datos.shiftMinutes ?? 0), endAt: masMinutos(c.endAt, datos.shiftMinutes ?? 0) });
      for (const r of reservas.filtrar((r) => r.bookableSlotId === c.id)) {
        reservas.actualizar(r.id, { startAt: masMinutos(r.startAt, datos.shiftMinutes ?? 0), endAt: masMinutos(r.endAt, datos.shiftMinutes ?? 0) });
      }
    }
    return { movedSlots: afectados.length, notified: reservas.filtrar((r) => afectados.some((c) => c.id === r.bookableSlotId)).length, shiftMinutes: datos.shiftMinutes ?? 0 };
  });

  router.post('/scheduling/resources/:id/close-slots', (request) => {
    const datos = cuerpo<{ exceptionType: string; reason?: string; slotIds: string[] }>(request);
    const cerrados = cupos.filtrar((c) => (datos.slotIds ?? []).includes(c.id));
    for (const c of cerrados) cupos.actualizar(c.id, { remainingCapacity: 0, statusConceptId: ESTADO['ST-CLOSED']! });
    const ordenados = cerrados.map((c) => c.startAt).sort();
    const bloqueo = bloqueos.agregar({
      id: nuevoId('exception'),
      resourceId: request.params['id']!,
      exceptionTypeConceptId: TIPOS_DE_BLOQUEO.find((t) => t.type === datos.exceptionType)?.conceptId ?? TIPO_BLOQUEO['EXC-PERSONAL']!,
      exceptionType: datos.exceptionType ?? 'OTHER',
      startAt: ordenados[0] ?? ahora(),
      endAt: cerrados.map((c) => c.endAt).sort().at(-1) ?? ahora(),
      reasonLabel: TIPOS_DE_BLOQUEO.find((t) => t.type === datos.exceptionType)?.label ?? 'Otro',
      reason: datos.reason ?? '',
      isAvailable: false,
    });
    return { closedSlots: cerrados.length, exceptionId: bloqueo.id, from: bloqueo.startAt, to: bloqueo.endAt };
  });

  /* ---- catálogos de la agenda --------------------------------------------- */

  router.get('/scheduling/activity-types', () => ({
    items: [
      { type: 'CONSULTATION', conceptId: ACTIVIDAD['ACT-CONSULTA']!, label: 'Consulta', tone: 'primary' },
      { type: 'FOLLOW_UP', conceptId: ACTIVIDAD['ACT-CONTROL']!, label: 'Control', tone: 'success' },
      { type: 'PROCEDURE', conceptId: ACTIVIDAD['ACT-PROCEDIMIENTO']!, label: 'Procedimiento', tone: 'warning' },
      { type: 'TELEHEALTH', conceptId: ACTIVIDAD['ACT-TELECONSULTA']!, label: 'Teleconsulta', tone: 'info' },
      { type: 'EXAM', conceptId: ACTIVIDAD['ACT-EXAMEN']!, label: 'Examen', tone: 'neutral' },
    ],
  }));

  router.get('/scheduling/exception-types', () => ({ items: TIPOS_DE_BLOQUEO }));

  /* ---- bloqueos ----------------------------------------------------------- */

  router.get('/scheduling/resources/:id/exceptions', ({ params, query }) => {
    const from = texto(query, 'from');
    const to = texto(query, 'to');
    const items = bloqueos
      .filtrar((b) => b.resourceId === params['id'])
      .filter((b) => (from === null || b.endAt >= from) && (to === null || b.startAt <= to))
      .map(({ resourceId: _r, exceptionType: _e, ...b }) => b);
    return { items, count: items.length };
  });

  router.post('/scheduling/resources/:id/exceptions', (request) => {
    const datos = cuerpo<{ exceptionType: string; startAt: string; endAt: string; reason?: string; isAvailable?: boolean }>(request);
    const tipo = TIPOS_DE_BLOQUEO.find((t) => t.type === datos.exceptionType);
    // El doble no puede ser más permisivo que el contrato real. `exceptionType`
    // se valida a nivel de DTO con `@IsIn(EXCEPTION_TYPES)`
    // (scheduling-catalog.dto.ts:754): sin `exceptionFactory` propio, el
    // `ValidationPipe` global de la API devuelve 400 ante esto (main.ts:158-165),
    // no 422 — mismo contrato que el `ValidationPipe` real, igual que el resto
    // de las validaciones de forma del proyecto (ver auth.handlers.ts).
    if (tipo === undefined) {
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        error: 'Bad Request',
        details: { messages: [`exceptionType must be one of the following values: ${TIPOS_DE_BLOQUEO.map((t) => t.type).join(', ')}`] },
      });
    }
    // «Otro» sin explicación no dice nada: regla del catálogo, no de la
    // pantalla. En la API es una precondición de negocio —
    // `PreconditionFailedException` en `createException`
    // (scheduling-catalog.service.ts:1262), que en este proyecto es 422, no
    // 412 (domain.exception.ts:106-118)— y no una validación de forma: por
    // eso va después del `@IsIn` (400) y no junto a él.
    if (tipo.requiresText && (datos.reason === undefined || datos.reason.trim() === '')) {
      return validation('Elegiste «Otro» como motivo: escribí cuál es.');
    }
    const inicio = datos.startAt ?? ahora();
    const fin = datos.endAt ?? masMinutos(inicio, 60);
    if (fin <= inicio) {
      return validation('La excepción debe empezar antes de terminar.');
    }
    const nuevo: BloqueoSimulado = {
      id: nuevoId('exception'),
      resourceId: request.params['id']!,
      exceptionTypeConceptId: tipo?.conceptId ?? TIPO_BLOQUEO['EXC-PERSONAL']!,
      exceptionType: tipo.type,
      startAt: inicio,
      endAt: fin,
      reasonLabel: tipo.label,
      reason: datos.reason ?? '',
      isAvailable: datos.isAvailable ?? false,
    };
    bloqueos.agregar(nuevo);
    const bloqueados = nuevo.isAvailable ? [] : cupos.filtrar((c) => c.resourceId === nuevo.resourceId && c.startAt < nuevo.endAt && c.endAt > nuevo.startAt);
    for (const c of bloqueados) cupos.actualizar(c.id, { remainingCapacity: 0, statusConceptId: ESTADO['ST-CLOSED']! });
    return { status: 201, body: { id: nuevo.id, blockedSlots: bloqueados.length } };
  });

  router.patch('/scheduling/exceptions/:id', (request) => {
    const b = bloqueos.get(request.params['id']!);
    if (b === undefined) return notFound();
    const datos = cuerpo<{ exceptionType?: string; reason?: string; startAt?: string; endAt?: string }>(request);
    const tipo = datos.exceptionType === undefined ? undefined : TIPOS_DE_BLOQUEO.find((t) => t.type === datos.exceptionType);
    if (datos.exceptionType !== undefined && tipo === undefined) {
      // Mismo contrato que el POST: `@IsIn` a nivel de DTO es 400, no 422.
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        error: 'Bad Request',
        details: { messages: [`exceptionType must be one of the following values: ${TIPOS_DE_BLOQUEO.map((t) => t.type).join(', ')}`] },
      });
    }
    const actualizado = bloqueos.actualizar(b.id, {
      ...(datos.reason === undefined ? {} : { reason: datos.reason }),
      ...(datos.startAt === undefined ? {} : { startAt: datos.startAt }),
      ...(datos.endAt === undefined ? {} : { endAt: datos.endAt }),
      ...(tipo === undefined ? {} : { exceptionType: tipo.type, exceptionTypeConceptId: tipo.conceptId, reasonLabel: tipo.label }),
    })!;
    return { id: actualizado.id, startAt: actualizado.startAt, endAt: actualizado.endAt, blockedSlots: cupos.filtrar((c) => c.resourceId === b.resourceId && c.startAt < actualizado.endAt && c.endAt > actualizado.startAt).length };
  });

  router.delete('/scheduling/exceptions/:id', ({ params }) => {
    const b = bloqueos.get(params['id']!);
    if (b !== undefined) {
      for (const c of cupos.filtrar((c) => c.resourceId === b.resourceId && c.startAt < b.endAt && c.endAt > b.startAt && c.statusConceptId === ESTADO['ST-CLOSED'])) {
        cupos.actualizar(c.id, { remainingCapacity: c.capacity, statusConceptId: ESTADO['ST-ACTIVE']! });
      }
      bloqueos.borrar(b.id);
    }
    return noContent();
  });

  /* ---- lista de espera ---------------------------------------------------- */

  router.get('/scheduling/waitlist', ({ query }) => {
    const patientProfileId = texto(query, 'patientProfileId');
    const includeClosed = query.get('includeClosed') === 'true';
    return {
      items: listaDeEspera
        .filtrar((e) => patientProfileId === null || e.patientProfileId === patientProfileId)
        .filter((e) => includeClosed || e.statusConceptId === ESTADO['ST-PENDING']),
    };
  });

  router.post('/scheduling/waitlist', (request) => {
    const datos = cuerpo<{ patientProfileId: string; resourceId?: string; desiredFrom?: string; desiredTo?: string; priority?: number }>(request);
    const recurso = datos.resourceId === undefined ? undefined : recursos.get(datos.resourceId);
    const nueva = listaDeEspera.agregar({
      id: nuevoId('waitlist'),
      patientProfileId: datos.patientProfileId ?? request.user?.patientProfileId ?? '',
      resourceId: datos.resourceId ?? '',
      resourceLabel: recurso?.name ?? 'Cualquier profesional',
      desiredFrom: datos.desiredFrom ?? ahora(),
      desiredTo: datos.desiredTo ?? masMinutos(ahora(), 60 * 24 * 14),
      priority: datos.priority ?? 3,
      statusConceptId: ESTADO['ST-PENDING']!,
      createdAt: ahora(),
    });
    return { status: 201, body: { id: nueva.id, priority: nueva.priority, statusConceptId: nueva.statusConceptId } };
  });
}
