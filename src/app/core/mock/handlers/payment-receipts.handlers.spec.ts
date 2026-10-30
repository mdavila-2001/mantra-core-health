import { HttpHeaders } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reservas } from '../fixtures/agenda';
import { BOOKING_STATUS } from '../fixtures/concepts';
import { PACIENTE } from '../fixtures/people';
import { isMockReply, MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarArchivos } from './files.handlers';
import {
  paymentReceipts,
  RECEIPTS_BOOKING_ID,
  registerPaymentReceipts,
  seedPaymentReceipts,
} from './payment-receipts.handlers';
import { registrarAgenda } from './scheduling.handlers';

/**
 * El doble de los comprobantes de pago sirve el contrato de la API: los mismos
 * códigos (201, 400, 403, 404, 409, 422), la cita pagada al confirmar y el pago
 * intacto al rechazar.
 */
describe('handlers de comprobantes de pago', () => {
  const router = new MockRouter();
  registrarAgenda(router);
  registrarArchivos(router);
  registerPaymentReceipts(router);

  const doctor = buscarUsuario('medica')!;
  const patient = buscarUsuario('paciente')!;
  /** Una paciente que no es la de la cita: no tiene que poder ni saber que existe. */
  const strangerPatient: MockUser = {
    ...patient,
    id: 'u-otra-paciente',
    patientProfileId: 'pid-otra-paciente',
  };

  const RECEIPTS_URL = `/scheduling/bookings/${RECEIPTS_BOOKING_ID}/payment-receipts`;

  interface Answer<T> {
    readonly status: number;
    readonly body: T;
    readonly headers?: Readonly<Record<string, string>>;
  }

  interface WireReceipt {
    readonly id: string;
    readonly status: string;
    readonly fileId: string;
    readonly mimeType: string;
    readonly amount: string | null;
    readonly note: string | null;
    readonly uploadedBy: { readonly userId: string; readonly displayName: string };
    readonly reviewedBy: { readonly userId: string } | null;
    readonly rejectionReason: string | null;
  }

  function call<T = unknown>(
    method: MockMethod,
    path: string,
    who: MockUser | null,
    body: unknown = {},
    query = new URLSearchParams(),
  ): Answer<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders(),
      user: who,
    });
    return isMockReply(result) ? (result as Answer<T>) : { status: 200, body: result as T };
  }

  function list(who: MockUser = doctor): Answer<readonly WireReceipt[]> {
    return call<readonly WireReceipt[]>('GET', RECEIPTS_URL, who);
  }

  /** Sube un archivo como lo hace la pantalla: primero a `common/files`. */
  function uploadFile(who: MockUser, file: File): string {
    const form = new FormData();
    form.append('file', file);
    form.append('category', file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT');
    form.append('sensitivity', 'NORMAL');
    return call<{ fileId: string }>('POST', '/common/files/upload', who, form).body.fileId;
  }

  function pdf(name = 'comprobante.pdf', bytes = 1024): File {
    return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });
  }

  function pendingIds(): string[] {
    return list()
      .body.filter((r) => r.status === 'PENDING')
      .map((r) => r.id);
  }

  beforeEach(() => {
    // De vuelta al punto de partida: la cita sin pago y sus dos semillas pendientes.
    for (const receipt of paymentReceipts.filtrar((r) => r.bookingId === RECEIPTS_BOOKING_ID)) {
      paymentReceipts.borrar(receipt.id);
    }
    reservas.actualizar(RECEIPTS_BOOKING_ID, {
      paymentState: null,
      statusConceptId: BOOKING_STATUS['BK-CONFIRMED']!,
    });
    seedPaymentReceipts();
  });

  it('la cita de la médica trae dos comprobantes pendientes, del más reciente al más viejo', () => {
    const answer = list();

    expect(answer.status).toBe(200);
    expect(answer.body).toHaveLength(2);
    expect(answer.body.every((r) => r.status === 'PENDING')).toBe(true);
    expect(answer.body.map((r) => r.mimeType)).toEqual(['application/pdf', 'image/png']);
    expect(answer.body[0]!.uploadedBy.displayName).toBe(PACIENTE.displayName);
    // Lo que sólo la maqueta usa no viaja: el DTO es el de la API.
    expect(Object.keys(answer.body[0]!)).not.toContain('drawing');
  });

  it('la cita es de la paciente principal y la ve en «Mis citas»', () => {
    const query = new URLSearchParams({
      patientProfileId: PACIENTE.id,
      includeCancelled: 'true',
      limit: '50',
    });
    const page = call<{ items: readonly { id: string }[] }>('GET', '/scheduling/bookings', patient, {}, query);

    expect(page.body.items.map((b) => b.id)).toContain(RECEIPTS_BOOKING_ID);
  });

  it('la paciente de la cita lee sus comprobantes; otra paciente recibe 404', () => {
    expect(list(patient).status).toBe(200);
    expect(list(strangerPatient).status).toBe(404);
  });

  it('la paciente sube un comprobante: 201, pendiente y primero en la lista', () => {
    const fileId = uploadFile(patient, pdf());

    const answer = call<WireReceipt>('POST', RECEIPTS_URL, patient, {
      fileId,
      amount: '150.00',
      paidAt: '2026-10-27T14:00:00.000Z',
      note: 'Pago en caja del banco',
    });

    expect(answer.status).toBe(201);
    expect(answer.body.status).toBe('PENDING');
    expect(answer.body.mimeType).toBe('application/pdf');
    expect(answer.body.uploadedBy.userId).toBe(patient.id);
    expect(list().body[0]!.id).toBe(answer.body.id);
  });

  it('subir no es del médico: 403', () => {
    const fileId = uploadFile(doctor, pdf());
    expect(call('POST', RECEIPTS_URL, doctor, { fileId }).status).toBe(403);
  });

  it('un archivo ajeno no sirve como comprobante: 422', () => {
    const fileId = uploadFile(doctor, pdf());
    const answer = call<{ code: string }>('POST', RECEIPTS_URL, patient, { fileId });

    expect(answer.status).toBe(422);
    expect(answer.body.code).toBe('PRECONDITION_FAILED');
  });

  it('un formato que no es imagen ni PDF, o de más de 5 MB, da 422', () => {
    const text = uploadFile(patient, new File(['hola'], 'nota.txt', { type: 'text/plain' }));
    const heavy = uploadFile(patient, pdf('grande.pdf', 5 * 1024 * 1024 + 1));

    expect(call('POST', RECEIPTS_URL, patient, { fileId: text }).status).toBe(422);
    expect(call('POST', RECEIPTS_URL, patient, { fileId: heavy }).status).toBe(422);
  });

  it('un monto con coma o una clave de más es un 400, como `forbidNonWhitelisted`', () => {
    const fileId = uploadFile(patient, pdf());

    const badAmount = call<{ code: string }>('POST', RECEIPTS_URL, patient, { fileId, amount: '150,00' });
    const extraKey = call<{ code: string }>('POST', RECEIPTS_URL, patient, { fileId, currency: 'BOB' });

    expect(badAmount.status).toBe(400);
    expect(badAmount.body.code).toBe('VALIDATION_FAILED');
    expect(extraKey.status).toBe(400);
  });

  it('una cita cancelada no lleva comprobante: 422', () => {
    reservas.actualizar(RECEIPTS_BOOKING_ID, { statusConceptId: BOOKING_STATUS['BK-CANCELLED']! });
    const fileId = uploadFile(patient, pdf());

    expect(call('POST', RECEIPTS_URL, patient, { fileId }).status).toBe(422);
  });

  it('confirmar uno deja la cita PAID y devuelve su estado de pago', () => {
    const [receiptId] = pendingIds();

    const answer = call<{ receipt: WireReceipt; paymentState: { state: string; label: string } }>(
      'POST',
      `${RECEIPTS_URL}/${receiptId}/confirm`,
      doctor,
    );

    expect(answer.status).toBe(200);
    expect(answer.body.receipt.status).toBe('CONFIRMED');
    expect(answer.body.receipt.reviewedBy?.userId).toBe(doctor.id);
    expect(answer.body.paymentState.state).toBe('PAID');
    expect(reservas.get(RECEIPTS_BOOKING_ID)?.paymentState?.state).toBe('PAID');
    // Los otros pendientes quedan como están.
    expect(pendingIds()).toHaveLength(1);
  });

  it('volver a confirmar uno ya confirmado no escribe y devuelve lo mismo', () => {
    const [receiptId] = pendingIds();
    const first = call<{ paymentState: { markedAt: string } }>('POST', `${RECEIPTS_URL}/${receiptId}/confirm`, doctor);
    const again = call<{ paymentState: { markedAt: string } }>('POST', `${RECEIPTS_URL}/${receiptId}/confirm`, doctor);

    expect(again.status).toBe(200);
    expect(again.body.paymentState.markedAt).toBe(first.body.paymentState.markedAt);
  });

  it('con la cita ya pagada, subir otro comprobante da 409', () => {
    const [receiptId] = pendingIds();
    call('POST', `${RECEIPTS_URL}/${receiptId}/confirm`, doctor);
    const fileId = uploadFile(patient, pdf());

    const answer = call<{ code: string }>('POST', RECEIPTS_URL, patient, { fileId });

    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('CONFLICT');
  });

  it('rechazar guarda el motivo y no toca el estado de pago', () => {
    const [receiptId] = pendingIds();

    const answer = call<WireReceipt>('POST', `${RECEIPTS_URL}/${receiptId}/reject`, doctor, {
      reason: '  No se lee el monto  ',
    });

    expect(answer.status).toBe(200);
    expect(answer.body.status).toBe('REJECTED');
    expect(answer.body.rejectionReason).toBe('No se lee el monto');
    expect(reservas.get(RECEIPTS_BOOKING_ID)?.paymentState).toBeNull();
  });

  it('confirmar un comprobante ya rechazado da 409', () => {
    const [receiptId] = pendingIds();
    call('POST', `${RECEIPTS_URL}/${receiptId}/reject`, doctor, { reason: 'Es de otra cita' });

    const answer = call<{ code: string }>('POST', `${RECEIPTS_URL}/${receiptId}/confirm`, doctor);

    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('CONFLICT');
    expect(reservas.get(RECEIPTS_BOOKING_ID)?.paymentState).toBeNull();
  });

  it('rechazar uno ya confirmado da 409', () => {
    const [receiptId] = pendingIds();
    call('POST', `${RECEIPTS_URL}/${receiptId}/confirm`, doctor);

    expect(call('POST', `${RECEIPTS_URL}/${receiptId}/reject`, doctor, { reason: 'Me equivoqué' }).status).toBe(409);
  });

  it('el motivo de menos de 3 caracteres es un 400', () => {
    const [receiptId] = pendingIds();
    expect(call('POST', `${RECEIPTS_URL}/${receiptId}/reject`, doctor, { reason: 'no' }).status).toBe(400);
  });

  it('la paciente no confirma ni rechaza: 403', () => {
    const [receiptId] = pendingIds();
    expect(call('POST', `${RECEIPTS_URL}/${receiptId}/confirm`, patient).status).toBe(403);
    expect(call('POST', `${RECEIPTS_URL}/${receiptId}/reject`, patient, { reason: 'Prueba' }).status).toBe(403);
  });

  it('un comprobante de otra cita es un 404', () => {
    expect(call('POST', `${RECEIPTS_URL}/no-existe/confirm`, doctor).status).toBe(404);
  });

  it('el contenido sale con su tipo y sin caché', () => {
    const [pdfReceipt] = list().body;

    const answer = call<Blob>('GET', `${RECEIPTS_URL}/${pdfReceipt!.id}/content`, doctor);

    expect(answer.status).toBe(200);
    expect(answer.headers?.['Cache-Control']).toBe('private, no-store');
    expect(answer.body).toBeInstanceOf(Blob);
    expect(answer.body.type).toBe('application/pdf');
  });

  it('el contenido de lo subido es el archivo subido', () => {
    const fileId = uploadFile(patient, pdf('mio.pdf', 2048));
    const uploaded = call<WireReceipt>('POST', RECEIPTS_URL, patient, { fileId }).body;

    const answer = call<Blob>('GET', `${RECEIPTS_URL}/${uploaded.id}/content`, doctor);

    expect(answer.body.size).toBe(2048);
  });

  /*
   * Las reservas sobreviven a F5. Si la cita sembrada dependiera del día, la
   * pestaña que sigue abierta al día siguiente sumaría otra cada mañana a la
   * agenda de la médica y a «Mis citas» de la paciente.
   */
  it('la cita sembrada es una sola: al otro día, la pestaña abierta no suma otra', async () => {
    const original = reservas.get(RECEIPTS_BOOKING_ID)!;
    const stored = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)!).map(
      (key) => [key, sessionStorage.getItem(key)!] as const,
    );
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 24 * 60 * 60 * 1000 });
    try {
      // Cargar la maqueta de nuevo, «mañana», con lo que guardó la pestaña.
      vi.resetModules();
      const nextDay = await import('./payment-receipts.handlers');
      const scheduleFixture = await import('../fixtures/agenda');

      expect(nextDay.RECEIPTS_BOOKING_ID).toBe(RECEIPTS_BOOKING_ID);
      const seeded = scheduleFixture.reservas.filtrar(
        (r) =>
          r.patientProfileId === PACIENTE.id &&
          r.reasonText === original.reasonText &&
          new Date(r.startAt).getHours() === 13,
      );
      expect(seeded.map((r) => r.id)).toEqual([RECEIPTS_BOOKING_ID]);
      // Y se queda en su día, como cualquier otra reserva guardada.
      expect(seeded[0]!.startAt).toBe(original.startAt);
    } finally {
      vi.useRealTimers();
      vi.resetModules();
      sessionStorage.clear();
      for (const [key, value] of stored) sessionStorage.setItem(key, value);
    }
  });
});
