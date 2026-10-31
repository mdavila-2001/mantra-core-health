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
import { TIPO_CITA_RECONSULTA } from '../fixtures/agenda';
import {
  ACTIVITY,
  CANAL,
  ENCOUNTER_CLASS,
  STATUS,
  ENCOUNTER_STATUS,
  BOOKING_STATUS,
  BLOCK_TYPE,
  APPOINTMENT_TYPE,
} from '../fixtures/concepts';
import { encounterList, type SimulatedEncounter } from '../fixtures/clinic';
import type { FollowUpOrigin } from '../../data-access/scheduling/scheduling.types';
import { emitirNotificacion } from './notifications.handlers';
import { avisarPorChatDeSoporte, fechaDelAviso } from './aviso-por-chat';
import { writeFromSupport } from './community.handlers';
import { solicitudDeLaCita } from './insurance.handlers';
import { patientById, patientList } from '../fixtures/people';
import { representaA } from './profiles.handlers';
import {
  conflict,
  forbidden,
  isMockReply,
  noContent,
  notFound,
  preconditionFailed,
  reply,
  validation,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { ahora, cuerpo, masMinutos, nuevoId, texto, uuid } from '../mock-store';
import { emitirInvitacionDeAtencion } from './surveys-forms.handlers';
import {
  liberarCupoDeServicio,
  liberarSobranteDeServicio,
  ofertaDelCupo,
} from './service-offerings.handlers';

/** El motivo con el que la API cancela al cambiar el horario (`SCHEDULE_CHANGE_CANCELLATION_REASON`). */
const MOTIVO_CAMBIO_DE_HORARIO = 'Cambio en el horario de atención del profesional';

/** Cuántas citas vivas nombra la respuesta del retiro (`MAX_BOOKINGS_IN_NOTICE`). */
const MAX_CITAS_EN_EL_AVISO = 10;

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
  {
    type: 'ABSENCE',
    conceptId: BLOCK_TYPE['EXC-PERSONAL']!,
    label: 'Ausencia',
    requiresText: false,
    blocks: true,
  },
  {
    type: 'HOLIDAY',
    conceptId: BLOCK_TYPE['EXC-FERIADO']!,
    label: 'Feriado',
    requiresText: false,
    blocks: true,
  },
  {
    type: 'VACATION',
    conceptId: BLOCK_TYPE['EXC-VACACIONES']!,
    label: 'Vacaciones',
    requiresText: false,
    blocks: true,
  },
  {
    type: 'CONFERENCE',
    conceptId: BLOCK_TYPE['EXC-CONGRESO']!,
    label: 'Congreso',
    requiresText: false,
    blocks: true,
  },
  {
    type: 'ERRAND',
    conceptId: BLOCK_TYPE['EXC-PERSONAL']!,
    label: 'Trámite personal',
    requiresText: false,
    blocks: true,
  },
  {
    type: 'EXTRA',
    conceptId: BLOCK_TYPE['EXC-CIRUGIA']!,
    label: 'Horario extra',
    requiresText: false,
    blocks: false,
  },
  {
    type: 'OTHER',
    conceptId: BLOCK_TYPE['EXC-PERSONAL']!,
    label: 'Otro',
    requiresText: true,
    blocks: true,
  },
] as const;

function dentro(instante: string, from: string | null, to: string | null): boolean {
  if (from !== null && instante < from) return false;
  if (to !== null && instante > to) return false;
  return true;
}

function estadoEs(r: ReservaSimulada, ...estados: (keyof typeof BOOKING_STATUS)[]): boolean {
  return estados.some((e) => BOOKING_STATUS[e] === r.statusConceptId);
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

/* ---- la reconsulta (C4) ---------------------------------------------------

   El vínculo se guarda en UN solo lado —la reconsulta apunta a su origen— y el
   sentido inverso (`followUpBookingId`) se **deriva al leer**, igual que
   `insuranceClaim`. Guardarlo en los dos lados dejaría dos verdades que se
   pueden contradecir: una cancelación que actualizara un lado y no el otro
   bastaría para que la cita origen siguiera diciendo que ya tiene reconsulta. */

/** La reconsulta viva de una cita, si alguien la agendó. */
function reconsultaDe(bookingId: string): ReservaSimulada | undefined {
  return reservas
    .todos()
    .find(
      (r) => r.followUpOf?.bookingId === bookingId && !estadoEs(r, 'BK-CANCELLED', 'BK-REJECTED'),
    );
}

/**
 * La reconsulta **por venir** de una cita, que es la que impide agendar otra.
 *
 * Una reconsulta ya pasada no bloquea: si a la persona se la citó de nuevo en
 * marzo y ya vino, citarla otra vez por la misma consulta es legítimo. Lo que
 * la regla prohíbe es tener dos turnos futuros colgando de la misma consulta.
 */
function reconsultaVigenteDe(bookingId: string): ReservaSimulada | undefined {
  const candidata = reconsultaDe(bookingId);
  if (candidata === undefined) return undefined;
  return new Date(candidata.startAt).getTime() > Date.now() ? candidata : undefined;
}

/**
 * La reserva con los dos campos de reconsulta resueltos, como la ve la API.
 *
 * Al origen se le agrega **cuándo fue**: es lo que la agenda y «Mis citas»
 * necesitan para decir «de la cita del 12 de septiembre», y resolverlo acá
 * evita una petición por fila. Si el origen ya no existe, el vínculo viaja como
 * vino: la reconsulta sigue siendo una reconsulta.
 */
function conReconsulta(r: ReservaSimulada) {
  const origen = r.followUpOf === null ? undefined : reservas.get(r.followUpOf.bookingId);
  return {
    ...r,
    followUpOf:
      r.followUpOf === null || origen === undefined
        ? r.followUpOf
        : { ...r.followUpOf, startAt: origen.startAt },
    followUpBookingId: reconsultaDe(r.id)?.id ?? null,
  };
}

function cambiarEstado(
  id: string,
  estado: keyof typeof BOOKING_STATUS,
  extra: Partial<ReservaSimulada> = {},
) {
  const r = reservas.get(id);
  if (r === undefined) return undefined;
  return reservas.actualizar(id, { statusConceptId: BOOKING_STATUS[estado]!, ...extra });
}

/**
 * Confirma una solicitud y se lo avisa al paciente por el chat de la app. Es
 * lo que hace «Aceptar la solicitud» de la agenda del profesional, y lo que la
 * maqueta hace sola con las solicitudes del portal (ver
 * {@link activarAceptacionDeDemostracion}).
 */
function _aceptarYAvisar(id: string): void {
  const r = reservas.get(id);
  if (r === undefined || r.statusConceptId !== BOOKING_STATUS['BK-REQUESTED']) return;
  cambiarEstado(id, 'BK-CONFIRMED', { confirmedAt: ahora(), appointmentId: nuevoId('appointment') });
  const quien = recursos.get(r.resourceId)?.practitionerName ?? null;
  avisarPorChatDeSoporte(
    r.patientProfileId,
    `${quien === null ? 'Su cita' : `Su solicitud de cita con ${quien}`} fue aceptada para el ${fechaDelAviso(r.startAt)}. Puede ver el detalle en «Mis citas».`,
  );
}

/**
 * En la maqueta no hay un profesional del otro lado que acepte a tiempo para
 * una demostración: con esto encendido, una solicitud del portal se acepta
 * sola a los pocos segundos y el paciente recibe la confirmación por chat.
 * Lo enciende `crearRouterSimulado()`, o sea la app; las pruebas que arman su
 * propio router no lo encienden y siguen viendo la solicitud pendiente.
 */
let _aceptacionDeDemostracionMs: number | null = null;

export function activarAceptacionDeDemostracion(ms = 6000): void {
  _aceptacionDeDemostracionMs = ms;
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
  const paciente = patientById(reserva.patientProfileId);
  if (paciente === undefined) return false;

  const hora = new Date(reserva.startAt).toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    // 24 h, como la API (`timeText`): «05:30 p. m.» terminaba en «p. m..».
    hour12: false,
  });
  // El mensaje del profesional va DESPUÉS del dato duro y entre comillas: es su
  // voz, no la del sistema, y quien lee necesita primero cuánto y de qué cita.
  const explicacion = mensaje === undefined || mensaje.trim() === '' ? '' : ` «${mensaje.trim()}»`;

  emitirNotificacion({
    userId: paciente.userId,
    category: 'SCHEDULING',
    subject: `Su cita de las ${hora} se demora ${minutos} minutos`,
    // El nombre sale del RECURSO, que es donde vive: la reserva guarda el del
    // paciente, no el de quien atiende.
    bodyText: `${recursos.get(reserva.resourceId)?.practitionerName ?? 'Su profesional'} avisó una demora de ${minutos} minutos en su cita de las ${hora}.${explicacion}`,
    // Mismo literal que emite `RECURSO_CITA` en la API real
    // (`scheduling/notices/agenda-notices.ts`): el mock honesto no inventa
    // vocabulario (AG-06).
    destination: { type: 'scheduling.appointment_bookings', id: reserva.id },
    // Igual que la API (`delayNoticeFor`): el `kind` es lo que levanta el push
    // (`DelayNotice`) y `route` a dónde lleva su botón.
    payloadJson: {
      kind: 'PRACTITIONER_DELAY',
      route: `/my-account/appointments?turno=${reserva.id}`,
      bookingId: reserva.id,
      delayMinutes: minutos,
    },
  });
  // Y al chat, con el mismo formato que la API (`chatTextForNotice`).
  const quien = recursos.get(reserva.resourceId)?.practitionerName ?? 'Su profesional';
  writeFromSupport(
    [paciente.id, paciente.userId, paciente.personId],
    textoDeChat(
      '⏳ Aviso de demora',
      `Su cita de las ${hora} con ${quien} se atrasa unos ${minutos} minutos.${explicacion}`,
      'Gracias por su paciencia. 🙏',
      reserva.id,
    ),
  );
  return true;
}

/* ---- Idempotency-Key -------------------------------------------------------

   El espejo del `IdempotencyInterceptor` de la API (PR #494 del API) para el
   turno de mostrador, que es la escritura de este archivo que el cliente manda
   con la cabecera (PR #727 del front):

   - la clave vale por usuario + método + ruta: la misma en otra operación es
     otra operación;
   - la repetición con el mismo cuerpo devuelve **la misma respuesta y el mismo
     status** sin volver a ejecutar, con `Idempotent-Replayed: true`;
   - la misma clave con otro cuerpo es **422 `IDEMPOTENCY_KEY_REUSED`**;
   - sólo se recuerdan los éxitos: un 409 o un 422 de negocio pueden dejar de
     serlo, y fijarlos obligaría a cambiar de clave para un reintento legítimo;
   - sin cabecera, nada cambia.

   Sin esto, un doble clic en «Registrar ingreso» daba de alta dos pacientes
   con la misma cédula en la maqueta, y la API real responde el segundo con la
   respuesta del primero. */

const idempotentReplies = new Map<
  string,
  { readonly fingerprint: string; readonly reply: MockReply }
>();

/** JSON con las claves ordenadas: el orden en que viajan no cambia la huella. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function withIdempotency(request: MockRequest, execute: () => MockReply): MockReply {
  const key = request.headers.get('Idempotency-Key');
  if (key === null) return execute();
  if (key.trim() === '' || key !== key.trim() || key.length > 255) {
    return validation('Idempotency-Key inválida', [
      {
        field: 'Idempotency-Key',
        message: 'must be a non-empty string without spaces of up to 255 characters',
      },
    ]);
  }
  const scope = `${request.user?.id ?? 'anonymous'} ${request.method} ${request.path} ${key}`;
  const fingerprint = canonicalJson({
    body: request.body ?? null,
    query: request.query.toString(),
  });
  const previous = idempotentReplies.get(scope);
  if (previous !== undefined) {
    if (previous.fingerprint !== fingerprint) {
      return reply(422, {
        statusCode: 422,
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'La clave de idempotencia ya se usó con otro contenido.',
        error: 'Unprocessable Entity',
      });
    }
    return {
      ...previous.reply,
      headers: { ...previous.reply.headers, 'Idempotent-Replayed': 'true' },
    };
  }
  const result = execute();
  if (result.status >= 200 && result.status < 300)
    idempotentReplies.set(scope, { fingerprint, reply: result });
  return result;
}

/**
 * Si el instante cae en una franja con telemedicina de alguna plantilla no
 * retirada y vigente ese día (`validFrom`/`validTo`, inclusive) del recurso. La franja es de pared y se mide en la hora local, como
 * el generador de cupos; el fin es exclusivo.
 */
function teleconsultaEnFranja(resourceId: string, instante: Date): boolean {
  const minuto = instante.getHours() * 60 + instante.getMinutes();
  const aMinutos = (hora: string): number => {
    const [h, m] = hora.split(':');
    return Number(h) * 60 + Number(m);
  };
  const fecha = `${instante.getFullYear()}-${String(instante.getMonth() + 1).padStart(2, '0')}-${String(instante.getDate()).padStart(2, '0')}`;
  return plantillas
    .filtrar(
      (t) =>
        t.resourceId === resourceId &&
        !t.retired &&
        t.validFrom.slice(0, 10) <= fecha &&
        (t.validTo === undefined || fecha <= t.validTo.slice(0, 10)),
    )
    .some((t) =>
      t.rules.some(
        (r) =>
          r.telemedicineEnabled === true &&
          r.dayOfWeek === instante.getDay() &&
          aMinutos(r.startTime) <= minuto &&
          minuto < aMinutos(r.endTime),
      ),
    );
}

/**
 * El aviso de agenda tal como la API lo deja en el chat
 * (`scheduling/domain/notices/chat-messages.ts`): encabezado con emoji, cuerpo,
 * cierre y la línea con el enlace que el hilo convierte en «Ir a la cita».
 */
function textoDeChat(encabezado: string, cuerpoDelAviso: string, cierre: string, bookingId: string): string {
  const base = globalThis.location?.origin ?? 'https://alovida.bo';
  return [encabezado, cuerpoDelAviso, cierre, `👉 Ver la cita: ${base}/my-account/appointments?turno=${bookingId}`].join('\n\n');
}

export function registrarAgenda(router: MockRouter): void {
  router.get('/scheduling/resources', ({ query }) => {
    const tenantId = texto(query, 'tenantId');
    const practiceId = texto(query, 'practiceId');
    const includeInactive = query.get('includeInactive') === 'true';
    const items = recursos
      .todos()
      // Aislado por organización, como la API (`findResources` filtra
      // `where.tenantId` siempre): el `|| true` que había acá le mostraba a
      // cualquier sesión las agendas de todas las organizaciones, y tapaba en
      // la maqueta las pantallas que piden con el tenant equivocado.
      .filter((r) => tenantId === null || r.tenantId === tenantId)
      .filter((r) => practiceId === null || r.practiceId === practiceId)
      .filter((r) => includeInactive || r.stateConceptId === STATUS['ST-ACTIVE'])
      .map(({ tenantId: _t, ...r }) => r);
    return { items, count: items.length };
  });

  router.post('/scheduling/resources', (request) => {
    const datos = cuerpo<{
      name: string;
      tenantId: string;
      resourceRefType: string;
      resourceRefId: string;
      practiceId?: string;
      timeZone?: string;
      capacity?: number;
    }>(request);
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
      stateConceptId: STATUS['ST-ACTIVE']!,
      site: null,
    });
    return {
      status: 201,
      body: { id: nuevo.id, name: nuevo.name, stateConceptId: nuevo.stateConceptId },
    };
  });

  router.post('/scheduling/booking-policies', (request) => {
    const datos = cuerpo<{ code: string }>(request);
    return {
      status: 201,
      body: {
        id: nuevoId('policy'),
        code: datos.code ?? 'POL',
        stateConceptId: STATUS['ST-ACTIVE']!,
      },
    };
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
      .filter(
        (c) =>
          !onlyAvailable || (c.remainingCapacity > 0 && c.statusConceptId === STATUS['ST-ACTIVE']),
      )
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    return {
      items: todos.slice(0, limit),
      count: Math.min(todos.length, limit),
      limit,
      truncated: todos.length > limit,
    };
  });

  router.post('/scheduling/slots/:id/holds', ({ params }) => {
    const cupo = cupos.get(params['id']!);
    if (cupo === undefined) return notFound('Cupo no encontrado');
    // Cerrado por un bloqueo o conservado de un horario retirado: la API
    // responde 422 antes de mirar la capacidad (`slotHoldRefusal`).
    if (cupo.statusConceptId === STATUS['ST-CLOSED'])
      return preconditionFailed('El slot está bloqueado', { slotId: cupo.id });
    if (cupo.remainingCapacity <= 0)
      return conflict('El cupo ya no tiene lugar', { slotId: cupo.id });
    return {
      status: 201,
      body: {
        id: nuevoId('hold'),
        holdToken: `hold.${cupo.id}`,
        expiresAt: masMinutos(ahora(), 5),
        remainingCapacity: cupo.remainingCapacity - 1,
      },
    };
  });

  const confirmar = (estado: 'BK-CONFIRMED' | 'BK-REQUESTED') => (request: MockRequest) => {
    const token = request.params['token'] ?? '';
    const slotId = token.startsWith('hold.') ? token.slice(5) : token;
    const cupo = cupos.get(slotId);
    if (cupo === undefined) return preconditionFailed('El hold venció o no existe');
    const datos = cuerpo<{ patientProfileId: string; channel?: string; reasonText?: string }>(
      request,
    );
    const paciente = patientById(datos.patientProfileId ?? request.user?.patientProfileId ?? '');
    // v4.2.40 — el cupo de un servicio manda sobre el pedido: de la oferta salen la
    // modalidad, lo que el paciente acepta y si la reserva espera aprobación. Un
    // servicio que NO requiere aprobación nace confirmado aunque el paciente "pida".
    const delServicio = ofertaDelCupo(cupo);
    const estadoFinal: 'BK-CONFIRMED' | 'BK-REQUESTED' =
      delServicio !== undefined && estado === 'BK-REQUESTED' && !delServicio.oferta.requiresApproval
        ? 'BK-CONFIRMED'
        : estado;
    const nueva: ReservaSimulada = {
      id: nuevoId('booking'),
      patientProfileId: paciente?.id ?? datos.patientProfileId ?? '',
      resourceId: cupo.resourceId,
      bookableSlotId: cupo.id,
      appointmentId: estadoFinal === 'BK-CONFIRMED' ? nuevoId('appointment') : null,
      // Un servicio es un procedimiento para la agenda (la API lo clasifica así): es lo
      // que la pinta con su tipología y no como una consulta más.
      typeConceptId:
        delServicio === undefined
          ? APPOINTMENT_TYPE['APT-PRIMERA']!
          : ACTIVITY['ACT-PROCEDIMIENTO']!,
      startAt: cupo.startAt,
      endAt: cupo.endAt,
      statusConceptId: BOOKING_STATUS[estadoFinal]!,
      serviceConceptId:
        delServicio === undefined
          ? (cupo.serviceConceptId ?? ACTIVITY['ACT-CONSULTA']!)
          : delServicio.oferta.channel === 'TELECONSULTA'
            ? ACTIVITY['ACT-TELECONSULTA']!
            : ACTIVITY['ACT-PROCEDIMIENTO']!,
      bookingChannelConceptId:
        datos.channel === 'PHONE' ? CANAL['CH-TELECONSULTA']! : CANAL['CH-PRESENCIAL']!,
      confirmedAt: estadoFinal === 'BK-CONFIRMED' ? ahora() : null,
      checkedInAt: null,
      reasonText: datos.reasonText ?? 'Consulta',
      patientName: paciente?.displayName ?? 'Paciente',
      insuranceCarrierName: paciente?.aseguradora ?? null,
      rescheduledFrom: null,
      statusReason: null,
      delayNotice: null,
      paymentState: null,
      // Un turno que el paciente pidió por su cuenta no sale de ninguna
      // consulta: la reconsulta la agenda el profesional (C4).
      followUpOf: null,
      ...(delServicio === undefined
        ? {}
        : {
            serviceOfferingId: delServicio.oferta.id,
            service: {
              offeringId: delServicio.oferta.id,
              name: delServicio.dto.serviceName,
              price: delServicio.dto.price,
              minDurationMinutes: delServicio.oferta.minDurationMinutes,
              maxDurationMinutes: delServicio.oferta.maxDurationMinutes,
              requiresApproval: delServicio.oferta.requiresApproval,
            },
          }),
      createdAt: ahora(),
    };
    reservas.agregar(nueva);
    cupos.actualizar(cupo.id, {
      remainingCapacity: Math.max(0, cupo.remainingCapacity - 1),
      ...(delServicio === undefined ? {} : { heldUntil: null }),
    });
    return {
      status: 201,
      body: {
        id: nueva.id,
        bookableSlotId: cupo.id,
        statusConceptId: nueva.statusConceptId,
        remindersScheduled: estadoFinal === 'BK-CONFIRMED' ? 2 : 0,
      },
    };
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
    const items = todos
      .slice(0, limit)
      .map((r) => ({ ...conReconsulta(r), insuranceClaim: solicitudDeLaCita(r) }));
    return { items, count: Math.min(todos.length, limit), limit, truncated: todos.length > limit };
  });

  router.get('/scheduling/bookings/:id', ({ params }) => {
    const r = reservas.get(params['id']!);
    return r === undefined ? notFound('Reserva no encontrada') : conReconsulta(r);
  });

  /* El cliente hace `PUT` (es idempotente) y devuelve `PaymentStateInfo`, no
     la reserva: la agenda lee `estado.label` para el aviso. Con `POST` y la
     reserva entera el eco genérico decía «undefined.» y nada cambiaba. */
  const marcarPago = (request: MockRequest) => {
    const r = reservas.get(request.params['id']!);
    if (r === undefined) return notFound();
    const datos = cuerpo<{ state: 'PENDING' | 'PARTIALLY_PAID' | 'PAID'; insuranceUsed?: boolean }>(
      request,
    );
    const state = datos.state ?? 'PAID';
    const actualizada = reservas.actualizar(r.id, {
      paymentState: {
        state,
        label:
          state === 'PAID' ? 'Pagada' : state === 'PARTIALLY_PAID' ? 'Pago parcial' : 'Pendiente',
        conceptId: STATUS['ST-COMPLETED']!,
        insuranceUsed: datos.insuranceUsed ?? false,
        markedByUserId: request.user?.id ?? '',
        markedAt: ahora(),
      },
    });
    return actualizada?.paymentState ?? notFound();
  };
  router.put('/scheduling/bookings/:id/payment-state', marcarPago);

  router.post('/scheduling/bookings/:id/cancel', (request) => {
    const r = reservas.get(request.params['id']!);
    if (r === undefined) return notFound();
    const datos = cuerpo<{
      cancelledBy: 'PATIENT' | 'PROVIDER';
      isNoShow?: boolean;
      reasonText: string;
    }>(request);
    const estado = datos.isNoShow ? 'BK-NO-SHOW' : 'BK-CANCELLED';
    cambiarEstado(r.id, estado, {
      statusReason: {
        reasonText: datos.reasonText ?? '',
        actorKind: datos.cancelledBy ?? 'PROVIDER',
        toStateConceptId: BOOKING_STATUS[estado]!,
        changedAt: ahora(),
      },
    });
    // El cupo de un servicio nació para esta reserva: se borra y vuelven las
    // consultas que había retraído. El de una consulta se reabre, como siempre.
    if (!liberarCupoDeServicio(r.bookableSlotId)) {
      const cupo = cupos.get(r.bookableSlotId);
      if (cupo !== undefined) cupos.actualizar(cupo.id, { remainingCapacity: cupo.capacity });
    }
    return {
      bookingId: r.id,
      feeAmount: datos.isNoShow ? '50.00' : undefined,
      capacityReleased: true,
    };
  });

  router.post('/scheduling/bookings/:id/reject', (request) => {
    const r = reservas.get(request.params['id']!);
    if (r === undefined) return notFound();
    const datos = cuerpo<{ reasonText: string }>(request);
    cambiarEstado(r.id, 'BK-REJECTED', {
      statusReason: {
        reasonText: datos.reasonText ?? '',
        actorKind: 'PROVIDER',
        toStateConceptId: BOOKING_STATUS['BK-REJECTED']!,
        changedAt: ahora(),
      },
    });
    liberarCupoDeServicio(r.bookableSlotId);
    return { bookingId: r.id, capacityReleased: true };
  });

  router.post('/scheduling/bookings/:id/reschedule', (request) => {
    const r = reservas.get(request.params['id']!);
    if (r === undefined) return notFound();
    const datos = cuerpo<{ toSlotId: string; reasonText: string }>(request);
    const destino = cupos.get(datos.toSlotId ?? '');
    if (destino === undefined || destino.remainingCapacity <= 0)
      return conflict('El cupo de destino no está disponible');
    cupos.actualizar(r.bookableSlotId, { remainingCapacity: 1 });
    cupos.actualizar(destino.id, { remainingCapacity: 0 });
    reservas.actualizar(r.id, {
      bookableSlotId: destino.id,
      resourceId: destino.resourceId,
      startAt: destino.startAt,
      endAt: destino.endAt,
      rescheduledFrom: r.startAt,
      statusReason: {
        reasonText: datos.reasonText ?? '',
        actorKind: 'PROVIDER',
        toStateConceptId: r.statusConceptId,
        changedAt: ahora(),
      },
    });
    return { bookingId: r.id, fromSlotId: r.bookableSlotId, toSlotId: destino.id };
  });

  const decision =
    (
      estado: keyof typeof BOOKING_STATUS,
      extra: (r: ReservaSimulada) => Partial<ReservaSimulada> = () => ({}),
    ) =>
    (request: MockRequest) => {
      const r = reservas.get(request.params['id']!);
      if (r === undefined) return notFound();
      cambiarEstado(r.id, estado, extra(r));
      return { bookingId: r.id, statusConceptId: BOOKING_STATUS[estado]!, occurredAt: ahora() };
    };
  router.post('/scheduling/bookings/:id/accept', (request) => {
    const respuesta = decision('BK-CONFIRMED', () => ({ confirmedAt: ahora(), appointmentId: nuevoId('appointment') }))(request);
    const r = reservas.get(request.params['id']!);
    const paciente = r === undefined ? undefined : patientById(r.patientProfileId);
    if (r !== undefined && paciente !== undefined) {
      const cuando = new Date(r.startAt).toLocaleString('es-BO', { dateStyle: 'full', timeStyle: 'short' });
      const quien = recursos.get(r.resourceId)?.practitionerName ?? 'su profesional';
      writeFromSupport(
        [paciente.id, paciente.userId, paciente.personId],
        textoDeChat('✅ ¡Cita confirmada!', `Su cita con ${quien} del ${cuando} quedó confirmada.`, '¡Lo esperamos! 💙', r.id),
      );
    }
    return respuesta;
  });
  router.post('/scheduling/bookings/:id/start', decision('BK-IN-PROGRESS'));
  router.post('/scheduling/bookings/:id/complete', (request) => {
    const respuesta = decision('BK-COMPLETED')(request);
    // Terminar antes de lo reservado libera el sobrante del servicio.
    const r = reservas.get(request.params['id']!);
    if (r !== undefined) liberarSobranteDeServicio(r);
    // La atención terminó: la encuesta base sale sola hacia el paciente (sólo si
    // la decisión se aplicó: un rechazo no emite nada).
    if (r !== undefined && !(isMockReply(respuesta) && respuesta.status >= 400)) {
      emitirInvitacionDeAtencion(r.id);
    }
    return respuesta;
  });

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
    reservas.actualizar(r.id, {
      delayNotice: {
        delayMinutes: minutos,
        message: datos.message ?? 'Demora en la atención',
        announcedAt: ahora(),
      },
    });
    const avisado = avisarDemoraAlPaciente(r, minutos, datos.message);
    return {
      notified: avisado ? 1 : 0,
      affected: 1,
      bookingIds: [r.id],
      detail: avisado
        ? `Se avisó a ${r.patientName} una demora de ${minutos} minutos.`
        : `${r.patientName} no tiene cuenta de portal: avísele por otro medio.`,
    };
  });

  router.post('/scheduling/resources/:id/delay', (request) => {
    const datos = cuerpo<{ delayMinutes: number; message?: string; from?: string; to?: string }>(
      request,
    );
    const hoy = new Date().toDateString();
    const afectadas = reservas
      .todos()
      .filter(
        (r) =>
          r.resourceId === request.params['id'] &&
          new Date(r.startAt).toDateString() === hoy &&
          estadoEs(r, 'BK-CONFIRMED', 'BK-CHECKED-IN'),
      )
      .filter((r) => new Date(r.startAt).getTime() > Date.now());
    const minutos = datos.delayMinutes ?? 15;
    let avisados = 0;
    for (const r of afectadas) {
      reservas.actualizar(r.id, {
        delayNotice: {
          delayMinutes: minutos,
          message: datos.message ?? 'Demora en la atención',
          announcedAt: ahora(),
        },
      });
      if (avisarDemoraAlPaciente(r, minutos, datos.message)) avisados += 1;
    }
    return {
      notified: avisados,
      affected: afectadas.length,
      bookingIds: afectadas.map((r) => r.id),
      detail: `${avisados} de ${afectadas.length} pacientes avisados.`,
    };
  });

  /**
   * La cita puntual (AG-2) y, desde C4, **la reconsulta**.
   *
   * Es el mismo endpoint a propósito: una reconsulta no es otra cosa que una
   * cita directa que recuerda de qué consulta salió. Lo único que agrega es
   * `followUpOf`, y con él cuatro rechazos que **sólo corren cuando ese campo
   * viene**: una cita puntual sin reconsulta se sigue creando exactamente como
   * antes, que es lo que `appointment-new` y el mostrador esperan.
   *
   * Orden de los rechazos, y por qué:
   *
   * 1. **403** — la agenda no es del profesional de la sesión. Va primero
   *    porque es lo único que se decide sin mirar nada ajeno: citar de nuevo a
   *    alguien en la agenda de un colega no es un error de datos, es no tener
   *    permiso.
   * 2. **404** — la cita de origen no existe.
   * 3. **422** — el paciente no es el de esa cita, o el horario no es futuro.
   * 4. **409** — esa consulta ya tiene una reconsulta por venir.
   */
  router.post('/scheduling/appointments/direct', (request) => {
    const datos = cuerpo<{
      patientProfileId: string;
      resourceId: string;
      startAt: string;
      durationMinutes: number;
      reasonText?: string;
      channel?: string;
      followUpOf?: FollowUpOrigin;
    }>(request);
    const paciente = patientById(datos.patientProfileId ?? '');
    const startAt = datos.startAt ?? ahora();
    const origenPedido = datos.followUpOf ?? null;

    let origen: ReservaSimulada | undefined;
    if (origenPedido !== null) {
      const hpid = request.user?.practitionerProfileId;
      const propias = new Set(
        recursos.filtrar((r) => hpid !== undefined && r.resourceRefId === hpid).map((r) => r.id),
      );
      if (!propias.has(datos.resourceId ?? '')) {
        return forbidden(
          'La reconsulta se agenda en su propia agenda, no en la de otro profesional',
        );
      }

      origen = reservas.get(origenPedido.bookingId ?? '');
      if (origen === undefined) {
        return notFound('La cita de la que sale esta reconsulta no existe');
      }
      if (origen.patientProfileId !== (datos.patientProfileId ?? '')) {
        return validation('La reconsulta es para el paciente de la cita de origen', [
          {
            field: 'patientProfileId',
            code: 'FOLLOW_UP_PATIENT_MISMATCH',
            message: 'El paciente no es el de la cita de origen.',
          },
        ]);
      }
      if (new Date(startAt).getTime() <= Date.now()) {
        return validation('Una reconsulta se agenda para más adelante', [
          {
            field: 'startAt',
            code: 'FOLLOW_UP_NOT_FUTURE',
            message: 'La fecha de la reconsulta tiene que ser futura.',
          },
        ]);
      }
      const yaAgendada = reconsultaVigenteDe(origen.id);
      if (yaAgendada !== undefined) {
        return conflict('Esta consulta ya tiene una reconsulta agendada', {
          bookingId: yaAgendada.id,
          startAt: yaAgendada.startAt,
        });
      }
    }

    // La teleconsulta sólo cabe en una franja vigente con telemedicina: el
    // mismo 422 que `CreateDirectAppointmentUseCase` (reason
    // `TELEMEDICINE_NOT_ENABLED`). Las demás modalidades no miran franjas.
    if (
      datos.channel === 'TELECONSULTA' &&
      !teleconsultaEnFranja(datos.resourceId ?? '', new Date(startAt))
    ) {
      // `reason` en el primer nivel, como lo deja el filtro de excepciones.
      return reply(422, {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message:
          'Ese horario no atiende por telemedicina. Habilítela en la franja de su horario de atención o elija otra modalidad.',
        error: 'Unprocessable Entity',
        reason: 'TELEMEDICINE_NOT_ENABLED',
        details: { resourceId: datos.resourceId ?? '', startAt },
      });
    }

    const endAt = masMinutos(startAt, datos.durationMinutes ?? 30);
    const pisados = cupos.filtrar(
      (c) => c.resourceId === datos.resourceId && c.startAt < endAt && c.endAt > startAt,
    );
    for (const c of pisados)
      cupos.actualizar(c.id, { remainingCapacity: 0, statusConceptId: STATUS['ST-CLOSED']! });
    const cupo: CupoSimulado = {
      id: nuevoId('slot-directo'),
      resourceId: datos.resourceId ?? '',
      scheduleTemplateId: null,
      startAt,
      endAt,
      capacity: 1,
      remainingCapacity: 0,
      statusConceptId: STATUS['ST-ACTIVE']!,
      serviceConceptId: ACTIVITY['ACT-CONSULTA']!,
    };
    cupos.agregar(cupo);
    const nueva: ReservaSimulada = {
      id: nuevoId('booking-directa'),
      patientProfileId: paciente?.id ?? datos.patientProfileId ?? '',
      resourceId: cupo.resourceId,
      bookableSlotId: cupo.id,
      appointmentId: nuevoId('appointment'),
      typeConceptId: origen === undefined ? APPOINTMENT_TYPE['APT-CONTROL']! : TIPO_CITA_RECONSULTA,
      startAt,
      endAt,
      statusConceptId: BOOKING_STATUS['BK-CONFIRMED']!,
      serviceConceptId: ACTIVITY['ACT-CONSULTA']!,
      bookingChannelConceptId:
        datos.channel === 'TELECONSULTA'
          ? CANAL['CH-TELECONSULTA']!
          : datos.channel === 'DOMICILIO'
            ? CANAL['CH-DOMICILIO']!
            : CANAL['CH-PRESENCIAL']!,
      confirmedAt: ahora(),
      checkedInAt: null,
      // El motivo que mandaron; si no mandaron ninguno y esto es una
      // reconsulta, el de la consulta de origen con su prefijo. Una reconsulta
      // sin motivo es una cita que después nadie sabe explicar.
      reasonText:
        datos.reasonText ??
        (origen === undefined
          ? 'Cita creada por el profesional'
          : `Reconsulta: ${origen.reasonText}`),
      patientName: paciente?.displayName ?? 'Paciente',
      insuranceCarrierName: paciente?.aseguradora ?? null,
      rescheduledFrom: null,
      statusReason: null,
      delayNotice: null,
      paymentState: null,
      followUpOf:
        origen === undefined || origenPedido === null
          ? null
          : {
              bookingId: origen.id,
              encounterId: origenPedido.encounterId ?? null,
              ...(origenPedido.formInstanceId === undefined
                ? {}
                : { formInstanceId: origenPedido.formInstanceId }),
            },
      createdAt: ahora(),
    };
    reservas.agregar(nueva);
    return {
      status: 201,
      body: {
        bookingId: nueva.id,
        bookableSlotId: cupo.id,
        statusConceptId: nueva.statusConceptId,
        retractedSlots: pisados.length,
      },
    };
  });

  /**
   * El turno de mostrador (AC-3.3): alta del paciente sin cuenta, reserva,
   * encuentro abierto e inicio de la atención, todo o nada — el espejo de
   * `SchedulingWalkInService`.
   *
   * Los rechazos, en el orden en que la API los encuentra:
   *
   * 1. **400** — falta un dato obligatorio del paciente o de la cita, o viene
   *    el teléfono del tutor sin su nombre.
   * 2. **404** — la agenda no existe.
   * 3. **409** — el documento YA está registrado: el mostrador tiene que
   *    buscarlo y agendarle con `appointments/direct`, no duplicarlo.
   * 4. **422** — el horario pisa otro turno vivo de esa agenda.
   *
   * La reserva nace `IN_PROGRESS` y el encuentro `IN_PROGRESS`: quien llegó al
   * mostrador ya está siendo atendido.
   */
  router.post('/scheduling/appointments/walk-in', (request) =>
    withIdempotency(request, () => {
      const data = cuerpo<{
        patient: {
          name?: string;
          middleName?: string;
          lastName?: string;
          motherLastName?: string;
          nationalId?: string;
          phone?: string;
          birthDate?: string;
          occupationConceptId?: string;
          issuerAdministrativeAreaConceptId?: string;
          guardianName?: string;
          guardianPhone?: string;
        };
        resourceId: string;
        startAt: string;
        durationMinutes: number;
        reasonText?: string;
        channel?: string;
      }>(request);
      const patientData = data.patient ?? {};

      const missing = [
        ...(['name', 'lastName', 'nationalId', 'phone'] as const)
          .filter((field) => (patientData[field] ?? '').trim() === '')
          .map((field) => ({ field: `patient.${field}`, message: 'should not be empty' })),
        ...(['resourceId', 'startAt'] as const)
          .filter((field) => (data[field] ?? '') === '')
          .map((field) => ({ field, message: 'should not be empty' })),
        ...(typeof data.durationMinutes === 'number' && data.durationMinutes > 0
          ? []
          : [{ field: 'durationMinutes', message: 'must be a positive number' }]),
        ...(patientData.guardianPhone !== undefined &&
        (patientData.guardianName ?? '').trim() === ''
          ? [
              {
                field: 'patient.guardianName',
                message: 'is required when guardianPhone is present',
              },
            ]
          : []),
      ];
      if (missing.length > 0) return validation('Faltan datos del turno de mostrador', missing);

      const resource = recursos.get(data.resourceId!);
      if (resource === undefined) return notFound('La agenda no existe');

      const nationalId = patientData.nationalId!.trim();
      if (patientList.todos().some((p) => p.nationalId === nationalId)) {
        return conflict(
          'Ya existe un paciente con ese documento de identidad. Búsquelo con ' +
            'GET /profiles/patients?nationalId= en vez de registrarlo de nuevo.',
        );
      }

      const startAt = data.startAt!;
      const endAt = masMinutos(startAt, data.durationMinutes!);
      const clash = reservas
        .todos()
        .find(
          (r) =>
            r.resourceId === resource.id &&
            !estadoEs(r, 'BK-CANCELLED', 'BK-REJECTED', 'BK-COMPLETED', 'BK-NO-SHOW') &&
            r.startAt < endAt &&
            r.endAt > startAt,
        );
      if (clash !== undefined) {
        const time = new Date(clash.startAt).toLocaleTimeString('es-BO', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return preconditionFailed(
          `${resource.practitionerName ?? 'La agenda'} ya tiene a ${clash.patientName} a las ${time}: el turno de mostrador se superpone.`,
          { bookingId: clash.id, startAt: clash.startAt, endAt: clash.endAt },
        );
      }

      // El alta del paciente: lo mismo que `POST /profiles/patients`, con lo
      // que el mostrador pregunta y nada inventado para completar la fila.
      const displayName = [
        patientData.name,
        patientData.middleName,
        patientData.lastName,
        patientData.motherLastName,
      ]
        .map((part) => (part ?? '').trim())
        .filter((part) => part !== '')
        .join(' ');
      const patientProfileId = nuevoId('paciente-mostrador');
      const newPatient: Parameters<typeof patientList.agregar>[0] = {
        id: patientProfileId,
        personId: uuid(`person-${patientProfileId}`),
        userId: uuid(`user-${patientProfileId}`),
        patientCode: `PAT-${patientProfileId.slice(-8).toUpperCase()}`,
        displayName,
        name: patientData.name!.trim(),
        ...(patientData.middleName === undefined
          ? {}
          : { middleName: patientData.middleName.trim() }),
        lastName: patientData.lastName!.trim(),
        motherLastName: (patientData.motherLastName ?? '').trim(),
        birthDate: patientData.birthDate ?? '',
        nationalId,
        email: '',
        phone: patientData.phone!.trim(),
        municipioId: '',
        departamentoId: patientData.issuerAdministrativeAreaConceptId ?? '',
        ocupacionId: patientData.occupationConceptId ?? '',
        direccion: '',
        deceased: false,
        // Nace sin identidad probada: nadie verificó nada en el mostrador.
        identityVerified: false,
      };
      patientList.agregar(newPatient);

      // La cita, igual que la directa: retira los cupos ofrecidos que pisa.
      const overlapped = cupos.filtrar(
        (c) => c.resourceId === resource.id && c.startAt < endAt && c.endAt > startAt,
      );
      for (const c of overlapped)
        cupos.actualizar(c.id, { remainingCapacity: 0, statusConceptId: STATUS['ST-CLOSED']! });
      const slot: CupoSimulado = {
        id: nuevoId('slot-mostrador'),
        resourceId: resource.id,
        scheduleTemplateId: null,
        startAt,
        endAt,
        capacity: 1,
        remainingCapacity: 0,
        statusConceptId: STATUS['ST-ACTIVE']!,
        serviceConceptId: ACTIVITY['ACT-CONSULTA']!,
      };
      cupos.agregar(slot);
      const booking: ReservaSimulada = {
        id: nuevoId('booking-mostrador'),
        patientProfileId,
        resourceId: resource.id,
        bookableSlotId: slot.id,
        appointmentId: nuevoId('appointment'),
        typeConceptId: APPOINTMENT_TYPE['APT-PRIMERA']!,
        startAt,
        endAt,
        statusConceptId: BOOKING_STATUS['BK-IN-PROGRESS']!,
        serviceConceptId: ACTIVITY['ACT-CONSULTA']!,
        bookingChannelConceptId:
          data.channel === 'TELECONSULTA'
            ? CANAL['CH-TELECONSULTA']!
            : data.channel === 'DOMICILIO'
              ? CANAL['CH-DOMICILIO']!
              : CANAL['CH-PRESENCIAL']!,
        confirmedAt: ahora(),
        checkedInAt: ahora(),
        reasonText: data.reasonText ?? 'Turno de mostrador',
        patientName: displayName,
        insuranceCarrierName: null,
        rescheduledFrom: null,
        statusReason: null,
        delayNotice: null,
        paymentState: null,
        followUpOf: null,
        createdAt: ahora(),
      };
      reservas.agregar(booking);

      // El encuentro abierto, que es a donde el médico entra a registrar la
      // atención apenas se cierra el alta.
      const encounter: SimulatedEncounter = {
        id: nuevoId('encounter'),
        patientProfileId,
        statusConceptId: ENCOUNTER_STATUS['ENCST-IN-PROGRESS']!,
        classConceptId: ENCOUNTER_CLASS['ENC-AMB']!,
        primaryPractitionerId: resource.resourceRefId,
        reasonText: booking.reasonText,
        startAt: ahora(),
        endAt: null,
      };
      encounterList.agregar(encounter);

      return reply(201, {
        patientProfileId,
        personId: newPatient.personId,
        patientCode: newPatient.patientCode,
        bookingId: booking.id,
        bookableSlotId: slot.id,
        appointmentId: booking.appointmentId,
        encounterId: encounter.id,
        statusConceptId: booking.statusConceptId,
        retractedSlots: overlapped.length,
      });
    }),
  );

  /* ---- plantillas --------------------------------------------------------- */

  router.get('/scheduling/resources/:id/templates', ({ params }) => {
    const items = plantillas
      .filtrar((t) => t.resourceId === params['id'])
      // La API devuelve `telemedicineEnabled` siempre, como booleano: la
      // columna es anulable y el `null` se lee como «no».
      .map(({ resourceId: _r, ...t }) => ({
        ...t,
        rules: t.rules.map((r) => ({ ...r, telemedicineEnabled: r.telemedicineEnabled === true })),
      }));
    return { items, count: items.length };
  });

  router.post('/scheduling/resources/:id/templates', (request) => {
    const datos = cuerpo<{
      name: string;
      rules: PlantillaSimulada['rules'];
      slotMinutes?: number;
      bookingPolicyId?: string;
      validFrom?: string;
      validTo?: string;
      flexibleHours?: boolean;
    }>(request);
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
      statusConceptId: STATUS['ST-PUBLISHED']!,
    });
    return {
      status: 201,
      body: {
        id: nueva.id,
        name: nueva.name,
        ruleCount: nueva.rules.length,
        statusConceptId: nueva.statusConceptId,
        flexibleHours: nueva.flexibleHours === true,
      },
    };
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
   * Las citas de un horario como las ve el retiro: las que se pueden cancelar
   * (confirmadas y solicitudes sin responder) y las de pacientes ya recibidos,
   * que lo frenan. Igual que `BlockedBookingsCanceller.describe` de la API: sin
   * filtro de fecha.
   */
  function citasDelHorario(templateId: string) {
    const delHorario = new Map(
      cupos.filtrar((c) => c.scheduleTemplateId === templateId).map((c) => [c.id, c]),
    );
    const deSusCupos = reservas.filtrar((r) => delHorario.has(r.bookableSlotId));
    const describir = (r: ReservaSimulada) => {
      const cupo = delHorario.get(r.bookableSlotId)!;
      return {
        bookingId: r.id,
        startAt: cupo.startAt,
        endAt: cupo.endAt,
        patientName: r.patientName === '' ? null : r.patientName,
        pending: estadoEs(r, 'BK-REQUESTED'),
      };
    };
    return {
      delHorario,
      deSusCupos,
      cancelables: deSusCupos.filter((r) => estadoEs(r, 'BK-CONFIRMED', 'BK-REQUESTED')),
      presentes: deSusCupos.filter((r) => estadoEs(r, 'BK-CHECKED-IN', 'BK-IN-PROGRESS')),
      describir,
    };
  }

  /** `GET /scheduling/templates/:id/live-bookings`: la vista previa del retiro. */
  router.get('/scheduling/templates/:id/live-bookings', ({ params }) => {
    const t = plantillas.get(params['id']!);
    if (t === undefined) return notFound('Plantilla no encontrada');
    const { cancelables, presentes, describir } = citasDelHorario(t.id);
    return {
      templateId: t.id,
      total: cancelables.length + presentes.length,
      bookings: cancelables.map(describir),
      present: presentes.map(describir),
    };
  });

  /**
   * Retira un horario publicado — el mismo contrato que la API (P23).
   *
   * Antes respondía **409** con cualquier cita comprometida; la API dejó de
   * hacerlo en M4 (26/09/2026) y la maqueta seguía frenando, así que «Cambiar mi
   * horario» era imposible justo acá, con 42 citas de demostración. Ahora:
   *
   * - Por omisión **conserva** las citas: sus cupos quedan, cerrados, y la
   *   respuesta las cuenta en `liveBookings`/`liveBookingIds`.
   * - Con `?affectedBookings=cancel` cancela las confirmadas y rechaza las
   *   solicitudes con el motivo «cambio de horario», salvo que haya un paciente
   *   ya recibido (422, como la API).
   * - Suelta (borra) los cupos sin ninguna cita, pasada o presente; los que
   *   tienen historia se conservan **cerrados**: un horario retirado no vuelve a
   *   ofrecer turnos con su hora y su duración viejas.
   */
  router.delete('/scheduling/templates/:id', (request) => {
    const t = plantillas.get(request.params['id']!);
    if (t === undefined) return notFound('Plantilla no encontrada');

    let cancelledBookings = 0;
    if (request.query.get('affectedBookings') === 'cancel') {
      const { cancelables, presentes } = citasDelHorario(t.id);
      if (presentes.length > 0) {
        return preconditionFailed(
          'Hay un paciente ya recibido en ese rato. Atiéndalo o cancele su cita desde la agenda antes de bloquear.',
          { resourceId: t.resourceId, bookingIds: presentes.map((r) => r.id) },
        );
      }
      for (const r of cancelables) {
        const estado = estadoEs(r, 'BK-REQUESTED') ? 'BK-REJECTED' : 'BK-CANCELLED';
        cambiarEstado(r.id, estado, {
          statusReason: {
            reasonText: MOTIVO_CAMBIO_DE_HORARIO,
            actorKind: 'PROVIDER',
            toStateConceptId: BOOKING_STATUS[estado]!,
            changedAt: ahora(),
          },
        });
        const cupo = cupos.get(r.bookableSlotId);
        if (cupo !== undefined) cupos.actualizar(cupo.id, { remainingCapacity: cupo.capacity });
      }
      cancelledBookings = cancelables.length;
    }

    const { delHorario, deSusCupos } = citasDelHorario(t.id);
    const conHistoria = new Set(deSusCupos.map((r) => r.bookableSlotId));
    let releasedSlots = 0;
    for (const c of delHorario.values()) {
      if (conHistoria.has(c.id)) {
        cupos.actualizar(c.id, { statusConceptId: STATUS['ST-CLOSED']! });
      } else {
        cupos.borrar(c.id);
        releasedSlots++;
      }
    }
    plantillas.actualizar(t.id, { retired: true, statusConceptId: STATUS['ST-ARCHIVED']! });

    const vivas = deSusCupos.filter((r) => estadoEs(r, 'BK-CONFIRMED', 'BK-CHECKED-IN'));
    const muestra = vivas.slice(0, MAX_CITAS_EN_EL_AVISO);
    return {
      id: t.id,
      statusConceptId: STATUS['ST-ARCHIVED']!,
      releasedSlots,
      keptSlots: conHistoria.size,
      liveBookings: vivas.length,
      liveBookingIds: muestra.map((r) => r.id),
      truncated: vivas.length > muestra.length,
      cancelledBookings,
    };
  });

  router.post('/scheduling/templates/:id/reactivate', ({ params }) => {
    const t = plantillas.get(params['id']!);
    if (t === undefined) return notFound();
    plantillas.actualizar(t.id, { retired: false, statusConceptId: STATUS['ST-PUBLISHED']! });
    return { id: t.id, statusConceptId: STATUS['ST-PUBLISHED']!, slotsPendientes: true };
  });

  router.post('/scheduling/templates/:id/generate-slots', (request) => {
    const t = plantillas.get(request.params['id']!);
    if (t === undefined) return notFound();
    const datos = cuerpo<{ from: string; to: string }>(request);
    const desde = new Date(datos.from ?? ahora());
    const hasta = new Date(datos.to ?? masMinutos(ahora(), 60 * 24 * 14));
    let created = 0;
    let skipped = 0;
    let omittedByCommitments = 0;
    // Las citas vivas del profesional: un turno nuevo que las pisa no se genera
    // (`commitments` de la API). Es lo que impide que el horario nuevo ofrezca
    // las 08:00 encima de la cita que el retiro del viejo conservó (P23).
    const comprometidas = reservas.filtrar(
      (r) =>
        r.resourceId === t.resourceId && estadoEs(r, 'BK-CONFIRMED', 'BK-CHECKED-IN', 'BK-IN-PROGRESS'),
    );
    for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
      // TODAS las franjas del día, no la primera: con hora de almuerzo un día
      // son dos franjas (mañana y tarde), igual que en el generador real, que
      // recorre cada regla. Con `find` la tarde desaparecía en silencio.
      // Horario flexible (P36): no hay grilla; las horas se calculan al leer y
      // el cupo nace al retener (`flexible-hours.handlers.ts`), como en la API.
      // Vale para la plantilla entera o para la franja (`isFlexibleBand`).
      for (const regla of t.rules.filter(
        (r) =>
          t.flexibleHours !== true &&
          r.flexibleHours !== true &&
          r.dayOfWeek === d.getDay() &&
          r.bookingMode !== 'SERVICES',
      )) {
        const [hi, mi] = regla.startTime.split(':').map(Number) as [number, number];
        const [hf, mf] = regla.endTime.split(':').map(Number) as [number, number];
        const apertura = hi * 60 + mi;
        const cierre = hf * 60 + mf;
        const dur = regla.slotMinutes ?? t.slotMinutes;
        const paso = dur + (regla.gapMinutes ?? 0);
        const capacidad = regla.capacityPerSlot ?? 1;
        if (dur <= 0) continue;
        for (let m = apertura; m + dur <= cierre; m += paso) {
          const inicio = new Date(d);
          inicio.setHours(Math.floor(m / 60), m % 60, 0, 0);
          const id = uuid(`slot-${t.id}-${inicio.toISOString()}`);
          const fin = new Date(inicio.getTime() + dur * 60_000).toISOString();
          if (cupos.has(id)) {
            skipped++;
            continue;
          }
          if (comprometidas.some((r) => r.startAt < fin && r.endAt > inicio.toISOString())) {
            omittedByCommitments++;
            continue;
          }
          // Un cupo del mismo instante en otro horario VIGENTE de la agenda. Los
          // de un horario retirado no cuentan: quedaron cerrados y no se ofrecen.
          if (
            cupos.filtrar(
              (c) =>
                c.resourceId === t.resourceId &&
                c.startAt === inicio.toISOString() &&
                plantillas.get(c.scheduleTemplateId ?? '')?.retired !== true,
            ).length > 0
          ) {
            skipped++;
            continue;
          }
          cupos.agregar({
            id,
            resourceId: t.resourceId,
            scheduleTemplateId: t.id,
            startAt: inicio.toISOString(),
            endAt: fin,
            capacity: capacidad,
            remainingCapacity: capacidad,
            statusConceptId: STATUS['ST-ACTIVE']!,
            serviceConceptId: ACTIVITY['ACT-CONSULTA']!,
          });
          created++;
        }
      }
    }
    return { templateId: t.id, created, skipped, omittedByCommitments };
  });

  router.post('/scheduling/resources/:id/shift-slots', (request) => {
    const datos = cuerpo<{ shiftMinutes: number; from: string; to: string; slotIds?: string[] }>(
      request,
    );
    const afectados = cupos.filtrar(
      (c) =>
        c.resourceId === request.params['id'] &&
        (datos.slotIds === undefined
          ? dentro(c.startAt, datos.from ?? null, datos.to ?? null)
          : datos.slotIds.includes(c.id)),
    );
    for (const c of afectados) {
      cupos.actualizar(c.id, {
        startAt: masMinutos(c.startAt, datos.shiftMinutes ?? 0),
        endAt: masMinutos(c.endAt, datos.shiftMinutes ?? 0),
      });
      for (const r of reservas.filtrar((r) => r.bookableSlotId === c.id)) {
        reservas.actualizar(r.id, {
          startAt: masMinutos(r.startAt, datos.shiftMinutes ?? 0),
          endAt: masMinutos(r.endAt, datos.shiftMinutes ?? 0),
        });
      }
    }
    return {
      movedSlots: afectados.length,
      notified: reservas.filtrar((r) => afectados.some((c) => c.id === r.bookableSlotId)).length,
      shiftMinutes: datos.shiftMinutes ?? 0,
    };
  });

  router.post('/scheduling/resources/:id/close-slots', (request) => {
    const datos = cuerpo<{ exceptionType: string; reason?: string; slotIds: string[] }>(request);
    const cerrados = cupos.filtrar((c) => (datos.slotIds ?? []).includes(c.id));
    for (const c of cerrados)
      cupos.actualizar(c.id, { remainingCapacity: 0, statusConceptId: STATUS['ST-CLOSED']! });
    const ordenados = cerrados.map((c) => c.startAt).sort();
    const bloqueo = bloqueos.agregar({
      id: nuevoId('exception'),
      resourceId: request.params['id']!,
      exceptionTypeConceptId:
        TIPOS_DE_BLOQUEO.find((t) => t.type === datos.exceptionType)?.conceptId ??
        BLOCK_TYPE['EXC-PERSONAL']!,
      exceptionType: datos.exceptionType ?? 'OTHER',
      startAt: ordenados[0] ?? ahora(),
      endAt:
        cerrados
          .map((c) => c.endAt)
          .sort()
          .at(-1) ?? ahora(),
      reasonLabel: TIPOS_DE_BLOQUEO.find((t) => t.type === datos.exceptionType)?.label ?? 'Otro',
      reason: datos.reason ?? '',
      isAvailable: false,
    });
    return {
      closedSlots: cerrados.length,
      exceptionId: bloqueo.id,
      from: bloqueo.startAt,
      to: bloqueo.endAt,
    };
  });

  /* ---- catálogos de la agenda --------------------------------------------- */

  router.get('/scheduling/activity-types', () => ({
    items: [
      {
        type: 'CONSULTATION',
        conceptId: ACTIVITY['ACT-CONSULTA']!,
        label: 'Consulta',
        tone: 'primary',
      },
      { type: 'FOLLOW_UP', conceptId: ACTIVITY['ACT-CONTROL']!, label: 'Control', tone: 'success' },
      {
        type: 'PROCEDURE',
        conceptId: ACTIVITY['ACT-PROCEDIMIENTO']!,
        label: 'Procedimiento',
        tone: 'warning',
      },
      {
        type: 'TELEHEALTH',
        conceptId: ACTIVITY['ACT-TELECONSULTA']!,
        label: 'Teleconsulta',
        tone: 'info',
      },
      { type: 'EXAM', conceptId: ACTIVITY['ACT-EXAMEN']!, label: 'Examen', tone: 'neutral' },
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
    const datos = cuerpo<{
      exceptionType: string;
      startAt: string;
      endAt: string;
      reason?: string;
      isAvailable?: boolean;
    }>(request);
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
        details: {
          messages: [
            `exceptionType must be one of the following values: ${TIPOS_DE_BLOQUEO.map((t) => t.type).join(', ')}`,
          ],
        },
      });
    }
    // «Otro» sin explicación no dice nada: regla del catálogo, no de la
    // pantalla. En la API es una precondición de negocio —
    // `PreconditionFailedException` en `createException`
    // (scheduling-catalog.service.ts:1262), que en este proyecto es 422, no
    // 412 (domain.exception.ts:106-118)— y no una validación de forma: por
    // eso va después del `@IsIn` (400) y no junto a él.
    if (tipo.requiresText && (datos.reason === undefined || datos.reason.trim() === '')) {
      return validation('Eligió «Otro» como motivo: escriba cuál es.');
    }
    const inicio = datos.startAt ?? ahora();
    const fin = datos.endAt ?? masMinutos(inicio, 60);
    if (fin <= inicio) {
      return validation('La excepción debe empezar antes de terminar.');
    }
    const nuevo: BloqueoSimulado = {
      id: nuevoId('exception'),
      resourceId: request.params['id']!,
      exceptionTypeConceptId: tipo?.conceptId ?? BLOCK_TYPE['EXC-PERSONAL']!,
      exceptionType: tipo.type,
      startAt: inicio,
      endAt: fin,
      reasonLabel: tipo.label,
      reason: datos.reason ?? '',
      isAvailable: datos.isAvailable ?? false,
    };
    bloqueos.agregar(nuevo);
    const bloqueados = nuevo.isAvailable
      ? []
      : cupos.filtrar(
          (c) =>
            c.resourceId === nuevo.resourceId && c.startAt < nuevo.endAt && c.endAt > nuevo.startAt,
        );
    for (const c of bloqueados)
      cupos.actualizar(c.id, { remainingCapacity: 0, statusConceptId: STATUS['ST-CLOSED']! });
    // La maqueta no tiene citas que un bloqueo alcance: nunca cancela ninguna.
    return {
      status: 201,
      body: { id: nuevo.id, blockedSlots: bloqueados.length, cancelledBookings: 0 },
    };
  });

  router.patch('/scheduling/exceptions/:id', (request) => {
    const b = bloqueos.get(request.params['id']!);
    if (b === undefined) return notFound();
    const datos = cuerpo<{
      exceptionType?: string;
      reason?: string;
      startAt?: string;
      endAt?: string;
    }>(request);
    const tipo =
      datos.exceptionType === undefined
        ? undefined
        : TIPOS_DE_BLOQUEO.find((t) => t.type === datos.exceptionType);
    if (datos.exceptionType !== undefined && tipo === undefined) {
      // Mismo contrato que el POST: `@IsIn` a nivel de DTO es 400, no 422.
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        error: 'Bad Request',
        details: {
          messages: [
            `exceptionType must be one of the following values: ${TIPOS_DE_BLOQUEO.map((t) => t.type).join(', ')}`,
          ],
        },
      });
    }
    const actualizado = bloqueos.actualizar(b.id, {
      ...(datos.reason === undefined ? {} : { reason: datos.reason }),
      ...(datos.startAt === undefined ? {} : { startAt: datos.startAt }),
      ...(datos.endAt === undefined ? {} : { endAt: datos.endAt }),
      ...(tipo === undefined
        ? {}
        : {
            exceptionType: tipo.type,
            exceptionTypeConceptId: tipo.conceptId,
            reasonLabel: tipo.label,
          }),
    })!;
    return {
      id: actualizado.id,
      startAt: actualizado.startAt,
      endAt: actualizado.endAt,
      blockedSlots: cupos.filtrar(
        (c) =>
          c.resourceId === b.resourceId &&
          c.startAt < actualizado.endAt &&
          c.endAt > actualizado.startAt,
      ).length,
    };
  });

  router.delete('/scheduling/exceptions/:id', ({ params }) => {
    const b = bloqueos.get(params['id']!);
    if (b !== undefined) {
      for (const c of cupos.filtrar(
        (c) =>
          c.resourceId === b.resourceId &&
          c.startAt < b.endAt &&
          c.endAt > b.startAt &&
          c.statusConceptId === STATUS['ST-CLOSED'],
      )) {
        cupos.actualizar(c.id, {
          remainingCapacity: c.capacity,
          statusConceptId: STATUS['ST-ACTIVE']!,
        });
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
        .filter((e) => includeClosed || e.statusConceptId === STATUS['ST-PENDING']),
    };
  });

  router.post('/scheduling/waitlist', (request) => {
    const datos = cuerpo<{
      patientProfileId: string;
      resourceId?: string;
      desiredFrom?: string;
      desiredTo?: string;
      priority?: number;
    }>(request);
    const recurso = datos.resourceId === undefined ? undefined : recursos.get(datos.resourceId);
    const nueva = listaDeEspera.agregar({
      id: nuevoId('waitlist'),
      patientProfileId: datos.patientProfileId ?? request.user?.patientProfileId ?? '',
      resourceId: datos.resourceId ?? '',
      resourceLabel: recurso?.name ?? 'Cualquier profesional',
      desiredFrom: datos.desiredFrom ?? ahora(),
      desiredTo: datos.desiredTo ?? masMinutos(ahora(), 60 * 24 * 14),
      priority: datos.priority ?? 3,
      statusConceptId: STATUS['ST-PENDING']!,
      createdAt: ahora(),
    });
    return {
      status: 201,
      body: { id: nueva.id, priority: nueva.priority, statusConceptId: nueva.statusConceptId },
    };
  });
}

/** Sincroniza un pago QR confirmado con el estado de la cita del mock. */
export function registrarPagoConfirmadoDeReserva(referencia: string, amount: string): void {
  const reserva = reservas.todos().find((r) => r.id === referencia || r.appointmentId === referencia);
  if (reserva === undefined) return;
  reservas.actualizar(reserva.id, {
    paymentState: {
      state: 'PAID',
      label: 'Pagada',
      conceptId: STATUS['ST-COMPLETED']!,
      insuranceUsed: false,
      markedByUserId: 'confirmacion-pago-demo',
      markedAt: ahora(),
    },
    paymentAmount: amount,
  });
}
