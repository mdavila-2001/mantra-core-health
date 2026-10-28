import { PACIENTE } from '../fixtures/people';
import { cupos, RECURSO_MEDICA, reservas, type ReservaSimulada } from '../fixtures/agenda';
import { ACTIVITY, APPOINTMENT_TYPE, BOOKING_STATUS, CANAL, STATUS } from '../fixtures/concepts';
import {
  conflict,
  forbidden,
  notFound,
  preconditionFailed,
  reply,
  validation,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import type { MockUser } from '../mock-session';
import { ahora, Coleccion, fecha, imagenSvg, masMinutos, nuevoId, uuid } from '../mock-store';
import { attachableFileFacts, fileContent, pdfMinimo } from './files.handlers';
import { representaA } from './profiles.handlers';

/* ============================================================================
    Comprobantes de pago de una cita: el doble de las cinco rutas
    `:id/payment-receipts` de `scheduling-bookings.controller.ts`.

    Copia el contrato y las reglas de la API (`scheduling-payment-receipts.
    service.ts` y sus casos de uso), con los mismos códigos:

    - el paciente sube (`PATIENT`, 201); 404 si la cita no es suya, 422 si el
      archivo no sirve o la cita está cancelada, 409 si ya está pagada;
    - el paciente y quien atiende leen la lista y el contenido; cualquier otro
      recibe 404, sin contarle si la cita existe;
    - quien atiende confirma (la cita queda `PAID` en el acto; 409 si el
      comprobante ya se rechazó; volver a confirmar no escribe) y rechaza con
      motivo (409 si ya se confirmó; no toca el pago).

    La ruta no está en `api-contract.generated.ts` —el contrato de la maqueta
    es anterior a ella—, así que el validador genérico no mira estos cuerpos:
    los valida este archivo, con las mismas claves y los mismos topes del DTO.
    ========================================================================== */

/** `PAYMENT_RECEIPT_MIME_TYPES` de la API. */
const RECEIPT_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

/** `PAYMENT_RECEIPT_MAX_BYTES` de la API. */
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

/** `MIN_RECEIPT_REJECTION_LENGTH` y `MAX_RECEIPT_TEXT_LENGTH` de la API. */
const REJECTION_MIN_LENGTH = 3;
const TEXT_MAX_LENGTH = 500;

/** El `@Matches` de `UploadPaymentReceiptDto.amount`. */
const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** Los roles de `@Roles` en confirmar y rechazar. */
const REVIEWER_ROLES: readonly string[] = ['PRACTITIONER', 'SCHEDULING_ADMIN', 'SCHEDULING_AGENT'];

/** La etiqueta y el concepto con que la maqueta marca una cita pagada (igual que `PUT payment-state`). */
const PAID_LABEL = 'Pagada';

type ReceiptStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

interface ReceiptActor {
  readonly userId: string;
  readonly displayName: string;
}

/**
 * Un comprobante tal como lo sirve la API, más lo que sólo la maqueta
 * necesita: el dibujo que hace de archivo en las semillas, que no tienen bytes
 * detrás.
 */
interface SimulatedReceipt {
  readonly id: string;
  readonly bookingId: string;
  readonly fileId: string;
  readonly mimeType: string;
  readonly originalName: string | null;
  readonly amount: string | null;
  readonly paidAt: string | null;
  readonly note: string | null;
  readonly uploadedAt: string;
  readonly uploadedBy: ReceiptActor;
  readonly status: ReceiptStatus;
  readonly reviewedAt: string | null;
  readonly reviewedBy: ReceiptActor | null;
  readonly rejectionReason: string | null;
  readonly drawing?: string;
}

/** Los comprobantes de todas las citas. Sobreviven a F5, como las reservas. */
export const paymentReceipts = new Coleccion<SimulatedReceipt>([]).persistirEn(
  'mock.agenda.comprobantes',
);

/* ---- la cita con dos comprobantes por revisar -------------------------------

   Ninguna de las reservas generadas sirve: aquéllas reparten pacientes por
   índice (`reserva()` de `fixtures/agenda.ts`), así que cuál de hoy es de la
   paciente principal con la médica —si alguna lo es— cambia con el día; la
   única fija, la reconsulta de C4, es de mañana en adelante y la cuentan sus
   propias pruebas. Lo que hace falta mostrar es fijo —la médica ve en su día
   una consulta confirmada de la paciente principal, que pagó por adelantado y
   subió dos comprobantes—, así que la cita se crea acá, **una sola vez**:

   - El id es fijo, sin fecha: las reservas sobreviven a F5 y una cita por día
     se iría sumando a la agenda y a «Mis citas» de quien deja la pestaña
     abierta. Nace hoy a las 13:00 y se queda en su día, como cualquier otra.
   - Las 13:00 caen en el hueco entre las mañanas (hasta las 12, o las 13 de
     los sábados) y los estudios de la tarde (desde las 14): no pisa ningún cupo
     de las plantillas de la médica, ningún día.
   - Confirmada vale a cualquier hora: una reserva de la paciente principal no
     entra en la regla del cupo liberado (`released-slot.ts`), así que pasada la
     hora sigue siendo lo que es. */

/** La cita de la paciente principal con la médica que trae comprobantes. */
export const RECEIPTS_BOOKING_ID = uuid('booking-comprobantes-de-pago');

const RECEIPTS_SLOT_ID = uuid('slot-comprobantes-de-pago');

/** La paciente principal tal como firma lo que sube. */
const MAIN_PATIENT_ACTOR: ReceiptActor = {
  userId: PACIENTE.userId,
  displayName: PACIENTE.displayName,
};

/**
 * Deja la cita y sus dos comprobantes pendientes si no están.
 *
 * Idempotente: corre en cada carga del módulo y lo ya guardado no se pisa —un
 * comprobante que se confirmó sigue confirmado después de F5—. El cupo, que no
 * se guarda, se rehace con el horario de la cita guardada, no con el de hoy.
 * Exportada para que las pruebas vuelvan al punto de partida.
 */
export function seedPaymentReceipts(): void {
  const booking = reservas.get(RECEIPTS_BOOKING_ID) ?? reservas.agregar(bookingForReceipts());
  if (!cupos.has(RECEIPTS_SLOT_ID)) {
    cupos.agregar({
      id: RECEIPTS_SLOT_ID,
      resourceId: RECURSO_MEDICA,
      scheduleTemplateId: null,
      startAt: booking.startAt,
      endAt: booking.endAt,
      capacity: 1,
      remainingCapacity: 0,
      statusConceptId: STATUS['ST-ACTIVE']!,
      serviceConceptId: ACTIVITY['ACT-CONSULTA']!,
    });
  }
  for (const seed of seededReceipts()) {
    if (!paymentReceipts.has(seed.id)) paymentReceipts.agregar(seed);
  }
}

/** La cita, hoy a las 13:00: sólo cuando todavía no existe. */
function bookingForReceipts(): ReservaSimulada {
  const startAt = fecha(0, 13, 0).toISOString();
  const endAt = masMinutos(startAt, 30);
  return {
    id: RECEIPTS_BOOKING_ID,
    patientProfileId: PACIENTE.id,
    resourceId: RECURSO_MEDICA,
    bookableSlotId: RECEIPTS_SLOT_ID,
    appointmentId: uuid('appointment-comprobantes-de-pago'),
    typeConceptId: APPOINTMENT_TYPE['APT-CONTROL']!,
    startAt,
    endAt,
    statusConceptId: BOOKING_STATUS['BK-CONFIRMED']!,
    serviceConceptId: ACTIVITY['ACT-CONSULTA']!,
    bookingChannelConceptId: CANAL['CH-PRESENCIAL']!,
    confirmedAt: masMinutos(startAt, -60 * 24),
    checkedInAt: null,
    reasonText: 'Control de presión arterial',
    patientName: PACIENTE.displayName,
    insuranceCarrierName: PACIENTE.aseguradora ?? null,
    rescheduledFrom: null,
    statusReason: null,
    delayNotice: null,
    // Sin marcar: es justo la cita cuyo pago espera revisión.
    paymentState: null,
    followUpOf: null,
    createdAt: masMinutos(startAt, -60 * 24 * 3),
  };
}

/**
 * Una foto de la transferencia y el PDF del banco, los dos sin revisar.
 *
 * Los instantes van **antes de ahora**, a cualquier hora en que se abra la
 * maqueta: el de ayer a la noche y el de hace un rato. Atados a una hora fija
 * del día de hoy, de madrugada quedaban en el futuro y la lista salía en otro
 * orden.
 */
function seededReceipts(): readonly SimulatedReceipt[] {
  const base = {
    bookingId: RECEIPTS_BOOKING_ID,
    uploadedBy: MAIN_PATIENT_ACTOR,
    status: 'PENDING' as const,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
  };
  return [
    {
      ...base,
      id: uuid('receipt-transferencia'),
      fileId: uuid('file-receipt-transferencia'),
      mimeType: 'image/png',
      originalName: 'transferencia-banco-union.png',
      amount: '150.00',
      paidAt: fecha(-1, 19, 0).toISOString(),
      note: 'Transferencia desde Banco Unión, a nombre de Ana Pérez.',
      uploadedAt: fecha(-1, 19, 10).toISOString(),
      drawing: 'Transferencia Banco Unión · 150,00 Bs',
    },
    {
      ...base,
      id: uuid('receipt-qr'),
      fileId: uuid('file-receipt-qr'),
      mimeType: 'application/pdf',
      originalName: 'comprobante-pago-qr.pdf',
      amount: '150.00',
      paidAt: masMinutos(ahora(), -110),
      note: null,
      uploadedAt: masMinutos(ahora(), -95),
      drawing: 'Pago por QR - Bs 150.00',
    },
  ];
}

seedPaymentReceipts();

/* ---- las rutas -------------------------------------------------------------- */

export function registerPaymentReceipts(router: MockRouter): void {
  router.get('/scheduling/bookings/:id/payment-receipts', listReceipts);
  router.post('/scheduling/bookings/:id/payment-receipts', uploadReceipt);
  router.get('/scheduling/bookings/:id/payment-receipts/:receiptId/content', receiptContent);
  router.post('/scheduling/bookings/:id/payment-receipts/:receiptId/confirm', confirmReceipt);
  router.post('/scheduling/bookings/:id/payment-receipts/:receiptId/reject', rejectReceipt);
}

function listReceipts(request: MockRequest): unknown {
  const booking = bookingForReading(request);
  if (booking === undefined) return notFound('Cita no encontrada');
  return receiptsOf(booking.id).map(toDto);
}

/*
 * El orden de las comprobaciones es el de Nest: primero el rol (guard), después
 * el cuerpo (pipe) y recién ahí la cita (caso de uso).
 */
function uploadReceipt(request: MockRequest): unknown {
  const user = request.user;
  if (user === null || !user.roles.includes('PATIENT')) return forbidden();
  const body = (request.body ?? {}) as Record<string, unknown>;
  const invalid = invalidUploadBody(body);
  if (invalid !== null) return invalid;
  const booking = reservas.get(request.params['id']!);
  if (booking === undefined || !actsForPatient(user, booking)) return notFound('Cita no encontrada');

  if (withoutPayment(booking)) {
    return preconditionFailed(
      'Una cita cancelada o rechazada no lleva pago: no hay comprobante que subir.',
      { bookingId: booking.id },
    );
  }
  if (booking.paymentState?.state === 'PAID') {
    return conflict('La cita ya está pagada: no hace falta otro comprobante.', { bookingId: booking.id });
  }
  const fileId = String(body['fileId']);
  const unusable = unusableFile(fileId, user);
  if (unusable !== null) return unusable;

  const facts = attachableFileFacts(fileId)!;
  const created = paymentReceipts.agregar({
    id: nuevoId('payment-receipt'),
    bookingId: booking.id,
    fileId,
    mimeType: facts.mimeType,
    originalName: facts.originalName,
    amount: typeof body['amount'] === 'string' ? body['amount'] : null,
    paidAt: typeof body['paidAt'] === 'string' ? new Date(body['paidAt']).toISOString() : null,
    note: typeof body['note'] === 'string' ? body['note'] : null,
    uploadedAt: ahora(),
    uploadedBy: { userId: user.id, displayName: user.displayName },
    status: 'PENDING',
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
  });
  return reply(201, toDto(created));
}

function receiptContent(request: MockRequest): unknown {
  const booking = bookingForReading(request);
  if (booking === undefined) return notFound('Cita no encontrada');
  const receipt = receiptOf(booking.id, request.params['receiptId']!);
  if (receipt === undefined) return notFound('Comprobante no encontrado');
  return {
    status: 200,
    body: receiptBytes(receipt),
    headers: { 'Content-Type': receipt.mimeType, 'Cache-Control': 'private, no-store' },
  };
}

function confirmReceipt(request: MockRequest): unknown {
  const reviewed = receiptForReview(request);
  if ('status' in reviewed) return reviewed;
  const { booking, receipt, reviewer } = reviewed;

  if (receipt.status === 'REJECTED') {
    return conflict('Ese comprobante ya se rechazó: no se puede confirmar.', {
      bookingId: booking.id,
      receiptId: receipt.id,
    });
  }
  // Volver a confirmar uno ya confirmado no escribe nada y devuelve lo mismo.
  if (receipt.status === 'CONFIRMED' && booking.paymentState !== null) {
    return { receipt: toDto(receipt), paymentState: booking.paymentState };
  }
  if (withoutPayment(booking)) {
    return preconditionFailed(
      'Una cita cancelada o rechazada no lleva estado de pago: no hubo atención que cobrar.',
      { bookingId: booking.id },
    );
  }

  const now = ahora();
  const confirmed = paymentReceipts.actualizar(receipt.id, {
    status: 'CONFIRMED',
    reviewedAt: now,
    reviewedBy: reviewer,
  })!;
  // Confirmar uno basta: la cita queda pagada en el acto, y los otros
  // comprobantes pendientes quedan como están.
  const paid = reservas.actualizar(booking.id, {
    paymentState: {
      state: 'PAID',
      label: PAID_LABEL,
      conceptId: STATUS['ST-COMPLETED']!,
      insuranceUsed: booking.paymentState?.insuranceUsed ?? false,
      markedByUserId: reviewer.userId,
      markedAt: now,
    },
  })!;
  return { receipt: toDto(confirmed), paymentState: paid.paymentState };
}

function rejectReceipt(request: MockRequest): unknown {
  if (request.user === null || !reviews(request.user)) return forbidden();
  const reason = (request.body as Record<string, unknown> | null)?.['reason'];
  if (typeof reason !== 'string' || reason.length < REJECTION_MIN_LENGTH || reason.length > TEXT_MAX_LENGTH) {
    return validation('Error de validación', [
      { field: 'reason', message: `must be between ${REJECTION_MIN_LENGTH} and ${TEXT_MAX_LENGTH} characters` },
    ]);
  }
  const reviewed = receiptForReview(request);
  if ('status' in reviewed) return reviewed;
  const { booking, receipt, reviewer } = reviewed;

  if (receipt.status === 'CONFIRMED') {
    return conflict('Ese comprobante ya se confirmó: no se puede rechazar.', {
      bookingId: booking.id,
      receiptId: receipt.id,
    });
  }
  // No toca el estado de pago: un comprobante que no sirve no dice que la
  // cita no se pagó, dice que esa prueba no alcanza.
  const rejected = paymentReceipts.actualizar(receipt.id, {
    status: 'REJECTED',
    reviewedAt: ahora(),
    reviewedBy: reviewer,
    rejectionReason: reason.trim(),
  })!;
  return toDto(rejected);
}

/* ---- quién llega a qué -------------------------------------------------------- */

/** El paciente de la cita, o quien lo representa (`representsPatient`). */
function actsForPatient(user: MockUser, booking: ReservaSimulada): boolean {
  return (
    user.patientProfileId === booking.patientProfileId ||
    representaA(user.patientProfileId, booking.patientProfileId)
  );
}

/** Quien atiende o reparte turnos, con el rol global o el de su organización. */
function reviews(user: MockUser): boolean {
  const scoped = Object.values(user.scopedRoles ?? {}).flat();
  return [...user.roles, ...scoped].some((role) => REVIEWER_ROLES.includes(role));
}

/** `loadForReading`: el paciente o quien atiende; cualquier otro, como si no existiera. */
function bookingForReading(request: MockRequest): ReservaSimulada | undefined {
  const user = request.user;
  const booking = reservas.get(request.params['id']!);
  if (user === null || booking === undefined) return undefined;
  return actsForPatient(user, booking) || reviews(user) ? booking : undefined;
}

/** Lo que confirmar y rechazar necesitan, o la respuesta de error que corresponde. */
function receiptForReview(
  request: MockRequest,
): MockReply | { booking: ReservaSimulada; receipt: SimulatedReceipt; reviewer: ReceiptActor } {
  const user = request.user;
  if (user === null || !reviews(user)) return forbidden();
  const booking = reservas.get(request.params['id']!);
  if (booking === undefined) return notFound('Cita no encontrada');
  const receipt = receiptOf(booking.id, request.params['receiptId']!);
  if (receipt === undefined) return notFound('Comprobante no encontrado');
  return { booking, receipt, reviewer: { userId: user.id, displayName: user.displayName } };
}

/* ---- reglas del contrato ------------------------------------------------------ */

function withoutPayment(booking: ReservaSimulada): boolean {
  return (
    booking.statusConceptId === BOOKING_STATUS['BK-CANCELLED'] ||
    booking.statusConceptId === BOOKING_STATUS['BK-REJECTED']
  );
}

/** Las claves y los formatos de `UploadPaymentReceiptDto`, como 400. */
function invalidUploadBody(body: Record<string, unknown>): MockReply | null {
  const unexpectedKeys = Object.keys(body).filter(
    (key) => body[key] !== undefined && !['fileId', 'amount', 'paidAt', 'note'].includes(key),
  );
  const issues = [
    ...unexpectedKeys.map((key) => ({ field: key, message: 'should not exist' })),
    ...(typeof body['fileId'] === 'string' ? [] : [{ field: 'fileId', message: 'must be a UUID' }]),
    ...(body['amount'] === undefined || (typeof body['amount'] === 'string' && AMOUNT_PATTERN.test(body['amount']))
      ? []
      : [{ field: 'amount', message: 'debe ser un monto decimal con hasta dos decimales' }]),
    ...(body['paidAt'] === undefined || (typeof body['paidAt'] === 'string' && !Number.isNaN(Date.parse(body['paidAt'])))
      ? []
      : [{ field: 'paidAt', message: 'must be a valid ISO 8601 date string' }]),
    ...(body['note'] === undefined || (typeof body['note'] === 'string' && body['note'].length <= TEXT_MAX_LENGTH)
      ? []
      : [{ field: 'note', message: `must be shorter than or equal to ${TEXT_MAX_LENGTH} characters` }]),
  ];
  return issues.length === 0 ? null : validation('Error de validación', issues);
}

/**
 * `assertAttachable`: propio, de un tipo admitido y de hasta 5 MB. Un archivo
 * ajeno o inexistente es, para quien adjunta, un comprobante que no sirve: 422,
 * igual que uno de otro formato, y no un 404 que se confundiría con la cita.
 */
function unusableFile(fileId: string, user: MockUser): MockReply | null {
  const facts = attachableFileFacts(fileId);
  if (facts === undefined || facts.uploaderUserId !== user.id) {
    return preconditionFailed('El comprobante no es un archivo suyo que se pueda adjuntar', { fileId });
  }
  if (!RECEIPT_MIME_TYPES.includes(facts.mimeType)) {
    return preconditionFailed('El comprobante tiene que ser una imagen (png, jpeg o webp) o un PDF', { fileId });
  }
  if (facts.sizeBytes > RECEIPT_MAX_BYTES) {
    return preconditionFailed('El comprobante supera los 5 MB', { fileId });
  }
  return null;
}

/* ---- lectura ------------------------------------------------------------------ */

function receiptsOf(bookingId: string): SimulatedReceipt[] {
  return paymentReceipts
    .filtrar((receipt) => receipt.bookingId === bookingId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

function receiptOf(bookingId: string, receiptId: string): SimulatedReceipt | undefined {
  const receipt = paymentReceipts.get(receiptId);
  return receipt?.bookingId === bookingId ? receipt : undefined;
}

/**
 * Los bytes del comprobante: los que se subieron, o un dibujo en su lugar.
 *
 * La imagen de una semilla es un SVG con su leyenda —la maqueta no tiene
 * fotos de transferencias—; el PDF sí es un PDF de verdad, para que el visor
 * lo abra como abriría el del banco. Lo subido en esta pestaña vuelve tal
 * cual; después de F5 sus bytes ya no están (`sessionStorage` no guarda un
 * `Blob`) y se dibuja con su nombre, que es mejor que un archivo roto.
 */
function receiptBytes(receipt: SimulatedReceipt): unknown {
  if (receipt.drawing === undefined) {
    const uploaded = uploadedBytes(receipt.fileId);
    if (uploaded !== null) return uploaded;
  }
  const caption = receipt.drawing ?? receipt.originalName ?? 'Comprobante de pago';
  return receipt.mimeType === 'application/pdf' && typeof Blob !== 'undefined'
    ? new Blob([pdfMinimo(caption)], { type: 'application/pdf' })
    : imagenSvg(caption);
}

function uploadedBytes(fileId: string): Blob | string | null {
  const content = fileContent(fileId);
  if (content instanceof Blob) return content;
  const body = (content as { readonly body?: unknown } | undefined)?.body;
  return body instanceof Blob || typeof body === 'string' ? body : null;
}

function toDto({ drawing: _drawing, ...receipt }: SimulatedReceipt): Omit<SimulatedReceipt, 'drawing'> {
  return receipt;
}
