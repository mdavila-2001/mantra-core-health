import { recursos, reservas, type ReservaSimulada } from '../fixtures/agenda';
import { STATUS } from '../fixtures/concepts';
import { patientById } from '../fixtures/people';
import {
  conflict,
  forbidden,
  isMockReply,
  notFound,
  preconditionFailed,
  reply,
  validation,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { ahora, Coleccion, cuerpo, nuevoId } from '../mock-store';
import { archivoAdjuntable, fileContent } from './files.handlers';
import { emitirNotificacion } from './notifications.handlers';
import { estadoEs, reservaVisible } from './scheduling.handlers';

/* ---- comprobantes de pago (v4.2.64) ------------------------------------------
   El paciente sube el comprobante de lo que pagó y el prestador lo confirma o
   lo rechaza. Mismas reglas que la API: un archivo propio de los cuatro tipos y
   hasta 5 MB, nada sobre una cita cancelada, nada nuevo sobre una pagada, y
   confirmar deja la cita pagada en el mismo paso. */

interface ComprobanteSimulado {
  readonly id: string;
  readonly bookingId: string;
  readonly fileId: string;
  readonly mimeType: string;
  readonly originalName: string | null;
  readonly amount: string | null;
  readonly paidAt: string | null;
  readonly note: string | null;
  readonly uploadedAt: string;
  readonly uploadedBy: { readonly userId: string; readonly displayName: string };
  readonly status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  readonly reviewedAt: string | null;
  readonly reviewedBy: { readonly userId: string; readonly displayName: string } | null;
  readonly rejectionReason: string | null;
}

const TIPOS_DE_COMPROBANTE = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const TOPE_DE_COMPROBANTE = 5 * 1024 * 1024;

/* Sobreviven a F5 dentro de la pestaña, como el resto de la agenda. */
const comprobantes = new Coleccion<ComprobanteSimulado>([]).persistirEn(
  'mock.scheduling.comprobantes',
);

/** Avisa al paciente cómo quedó su comprobante, como `receiptReviewedNotice`. */
function avisarRevision(reserva: ReservaSimulada, confirmado: boolean, motivo?: string): void {
  const paciente = patientById(reserva.patientProfileId);
  if (paciente === undefined) return;
  const quien = recursos.get(reserva.resourceId)?.practitionerName ?? 'Su profesional';
  emitirNotificacion({
    userId: paciente.userId,
    category: 'SCHEDULING',
    subject: confirmado ? 'Confirmaron su pago' : 'Rechazaron su comprobante de pago',
    bodyText: confirmado
      ? `${quien} confirmó el pago de su cita.`
      : `${quien} rechazó el comprobante de su cita. Motivo: ${motivo ?? 'sin motivo'}. Puede subir otro desde su cita.`,
    destination: { type: 'scheduling.appointment_bookings', id: reserva.id },
    payloadJson: { bookingId: reserva.id },
  });
}

/** El paciente no revisa su propio comprobante (la API no le da el rol). */
function esPacienteSolo(request: MockRequest): boolean {
  return request.user?.patientProfileId !== undefined && request.user.practitionerProfileId === undefined;
}

export function registrarComprobantesDePago(router: MockRouter): void {
  /** La cita, o el 404 que la API da también a quien no es de ella. */
  const citaVisible = (request: MockRequest): ReservaSimulada | MockReply => {
    const r = reservas.get(request.params['id']!);
    return r === undefined || !reservaVisible(request, r) ? notFound('Reserva no encontrada') : r;
  };
  const delaCita = (bookingId: string, receiptId: string) => {
    const c = comprobantes.get(receiptId);
    return c === undefined || c.bookingId !== bookingId ? undefined : c;
  };
  const revisor = (request: MockRequest) => ({
    userId: request.user?.id ?? '',
    displayName: request.user?.displayName ?? 'Profesional',
  });

  router.post('/scheduling/bookings/:id/payment-receipts', (request) => {
    const r = citaVisible(request);
    if (isMockReply(r)) return r;
    if (request.user?.patientProfileId === undefined) {
      return forbidden('Sólo el paciente sube el comprobante de su cita');
    }
    if (estadoEs(r, 'BK-CANCELLED', 'BK-REJECTED')) {
      return preconditionFailed('La cita está cancelada: no se le puede adjuntar un pago', {
        bookingId: r.id,
      });
    }
    if (r.paymentState?.state === 'PAID') {
      return conflict('La cita ya está pagada', { bookingId: r.id });
    }
    const datos = cuerpo<{ fileId: string; amount?: string; paidAt?: string; note?: string }>(
      request,
    );
    const archivo = datos.fileId === undefined ? undefined : archivoAdjuntable(datos.fileId);
    if (archivo === undefined || archivo.uploaderUserId !== request.user.id) {
      return preconditionFailed('El comprobante no es un archivo suyo que se pueda adjuntar', {
        fileId: datos.fileId,
      });
    }
    if (!TIPOS_DE_COMPROBANTE.includes(archivo.mimeType)) {
      return preconditionFailed('El comprobante tiene que ser PNG, JPEG, WEBP o PDF', {
        fileId: datos.fileId,
      });
    }
    if (archivo.sizeBytes > TOPE_DE_COMPROBANTE) {
      return preconditionFailed('El comprobante supera los 5 MB', { fileId: datos.fileId });
    }
    const nuevo = comprobantes.agregar({
      id: nuevoId('receipt'),
      bookingId: r.id,
      fileId: datos.fileId!,
      mimeType: archivo.mimeType,
      originalName: archivo.originalName,
      amount: datos.amount ?? null,
      paidAt: datos.paidAt ?? null,
      note: datos.note ?? null,
      uploadedAt: ahora(),
      uploadedBy: { userId: request.user.id, displayName: request.user.displayName },
      status: 'PENDING',
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    });
    return reply(201, nuevo);
  });

  router.get('/scheduling/bookings/:id/payment-receipts', (request) => {
    const r = citaVisible(request);
    if (isMockReply(r)) return r;
    return comprobantes
      .filtrar((c) => c.bookingId === r.id)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  });

  router.get('/scheduling/bookings/:id/payment-receipts/:receiptId/content', (request) => {
    const r = citaVisible(request);
    if (isMockReply(r)) return r;
    const c = delaCita(r.id, request.params['receiptId']!);
    const contenido = c === undefined ? undefined : fileContent(c.fileId);
    if (contenido === undefined) return notFound('El comprobante no existe');
    // Mismo arreglo que `GET /common/files/:id/content`: `{ body, headers }`
    // sin estado no es una respuesta para el interceptor.
    return contenido instanceof Blob
      ? contenido
      : { status: 200, ...(contenido as { body: unknown; headers: Record<string, string> }) };
  });

  router.post('/scheduling/bookings/:id/payment-receipts/:receiptId/confirm', (request) => {
    const r = citaVisible(request);
    if (isMockReply(r)) return r;
    if (esPacienteSolo(request)) return forbidden('El paciente no revisa su propio comprobante');
    const c = delaCita(r.id, request.params['receiptId']!);
    if (c === undefined) return notFound('El comprobante no existe');
    if (c.status === 'REJECTED') return conflict('El comprobante ya se rechazó', { receiptId: c.id });
    if (estadoEs(r, 'BK-CANCELLED', 'BK-REJECTED')) {
      return preconditionFailed('La cita está cancelada', { bookingId: r.id });
    }
    const confirmado =
      c.status === 'CONFIRMED'
        ? c
        : comprobantes.actualizar(c.id, {
            status: 'CONFIRMED',
            reviewedAt: ahora(),
            reviewedBy: revisor(request),
          })!;
    const pagada =
      r.paymentState?.state === 'PAID'
        ? r
        : reservas.actualizar(r.id, {
            paymentState: {
              state: 'PAID',
              label: 'Pagada',
              conceptId: STATUS['ST-COMPLETED']!,
              insuranceUsed: r.paymentState?.insuranceUsed ?? false,
              markedByUserId: request.user?.id ?? '',
              markedAt: ahora(),
            },
          })!;
    if (c.status !== 'CONFIRMED') avisarRevision(r, true);
    return { receipt: confirmado, paymentState: pagada.paymentState };
  });

  router.post('/scheduling/bookings/:id/payment-receipts/:receiptId/reject', (request) => {
    const r = citaVisible(request);
    if (isMockReply(r)) return r;
    if (esPacienteSolo(request)) return forbidden('El paciente no revisa su propio comprobante');
    const c = delaCita(r.id, request.params['receiptId']!);
    if (c === undefined) return notFound('El comprobante no existe');
    if (c.status === 'CONFIRMED') return conflict('El comprobante ya se confirmó', { receiptId: c.id });
    const motivo = (cuerpo<{ reason: string }>(request).reason ?? '').trim();
    if (motivo.length < 3) {
      return validation('El motivo del rechazo es obligatorio', [
        { field: 'reason', code: 'MIN_LENGTH', message: 'Cuente al paciente por qué lo rechaza.' },
      ]);
    }
    if (c.status === 'REJECTED') return c;
    const rechazado = comprobantes.actualizar(c.id, {
      status: 'REJECTED',
      reviewedAt: ahora(),
      reviewedBy: revisor(request),
      rejectionReason: motivo,
    })!;
    avisarRevision(r, false, motivo);
    return rechazado;
  });
}
