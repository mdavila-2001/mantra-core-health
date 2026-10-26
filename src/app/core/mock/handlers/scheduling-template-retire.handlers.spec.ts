import { HttpHeaders } from '@angular/common/http';

import { registrarAgenda } from './scheduling.handlers';
import { RECURSO_MEDICA, cupos, reservas, type ReservaSimulada } from '../fixtures/agenda';
import { BOOKING_STATUS, STATUS } from '../fixtures/concepts';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';

/**
 * P23 · el simulador cambia un horario con citas igual que la API.
 *
 * El doble respondía 409 con cualquier cita comprometida —contrato de antes de
 * M4 (26/09/2026)—, no servía la vista previa `live-bookings` ni
 * `affectedBookings=cancel`, y dejaba abiertos los cupos conservados. Con 42
 * citas de demostración, «Cambiar mi horario» era imposible en la maqueta.
 *
 * Tres niveles del contrato: correcto (retira conservando y el horario nuevo no
 * pisa la cita), límite (todas las citas canceladas con aviso; cupo de un
 * horario retirado que ya no se puede retener) e inválido (paciente ya recibido
 * con cancelación: 422; plantilla inexistente: 404 con su `code`).
 *
 * Datos sintéticos: cupos en un lunes a ~200 días, lejos de la demostración.
 */
describe('simulador · retirar y cambiar un horario con citas (P23)', () => {
  const router = new MockRouter();
  registrarAgenda(router);
  const medica = buscarUsuario('medica')!;

  interface Respuesta<T> {
    readonly status: number;
    readonly body: T;
  }

  function pedir<T>(
    method: MockMethod,
    path: string,
    body: unknown = {},
    query = new URLSearchParams(),
  ): Respuesta<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders(),
      user: medica,
    });
    if (
      resultado !== null &&
      typeof resultado === 'object' &&
      'status' in resultado &&
      'body' in resultado
    ) {
      return resultado as Respuesta<T>;
    }
    return { status: 200, body: resultado as T };
  }

  /** Un lunes lejano, a medianoche local: el generador del simulador trabaja en hora local. */
  function lunesLejano(semanas: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + semanas * 7 + ((8 - d.getDay()) % 7 || 7));
    return d;
  }

  function publicar(minutos: number): string {
    return pedir<{ id: string }>('POST', `/scheduling/resources/${RECURSO_MEDICA}/templates`, {
      name: `Tardes P23 ${minutos}`,
      slotMinutes: minutos,
      rules: [{ dayOfWeek: 1, startTime: '14:00', endTime: '16:00', slotMinutes: minutos }],
    }).body.id;
  }

  function generar(templateId: string, lunes: Date) {
    return pedir<{ created: number; skipped: number; omittedByCommitments: number }>(
      'POST',
      `/scheduling/templates/${templateId}/generate-slots`,
      {
        from: lunes.toISOString(),
        to: new Date(lunes.getTime() + 24 * 3600 * 1000).toISOString(),
      },
    ).body;
  }

  function cuposDe(templateId: string) {
    return cupos
      .filtrar((c) => c.scheduleTemplateId === templateId)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  /** Una cita sintética en un cupo: se copia la forma de una existente. */
  function citar(slotId: string, estado: keyof typeof BOOKING_STATUS): ReservaSimulada {
    const cupo = cupos.get(slotId)!;
    const cita = reservas.agregar({
      ...reservas.todos()[0]!,
      id: `p23-${estado}-${slotId}`,
      resourceId: RECURSO_MEDICA,
      bookableSlotId: slotId,
      startAt: cupo.startAt,
      endAt: cupo.endAt,
      statusConceptId: BOOKING_STATUS[estado]!,
      patientName: 'Paciente sintético',
    });
    cupos.actualizar(slotId, { remainingCapacity: 0 });
    return cita;
  }

  it('correcto — retira con una cita viva: 200, la conserva, cierra su cupo y suelta los libres', () => {
    const lunes = lunesLejano(28);
    const viejo = publicar(30);
    expect(generar(viejo, lunes).created).toBe(4);
    const [primero, segundo] = cuposDe(viejo);
    const viva = citar(primero!.id, 'BK-CONFIRMED');
    citar(segundo!.id, 'BK-CANCELLED');
    cupos.actualizar(segundo!.id, { remainingCapacity: 1 });

    const previa = pedir<{ total: number; bookings: { bookingId: string; pending: boolean }[]; present: unknown[] }>(
      'GET',
      `/scheduling/templates/${viejo}/live-bookings`,
    );
    expect(previa.status).toBe(200);
    expect(previa.body.total).toBe(1);
    expect(previa.body.bookings.map((b) => b.bookingId)).toEqual([viva.id]);
    expect(previa.body.present).toEqual([]);

    const retiro = pedir<Record<string, unknown>>('DELETE', `/scheduling/templates/${viejo}`);
    expect(retiro.status).toBe(200);
    expect(retiro.body).toEqual(
      expect.objectContaining({
        releasedSlots: 2,
        keptSlots: 2,
        liveBookings: 1,
        liveBookingIds: [viva.id],
        truncated: false,
        cancelledBookings: 0,
      }),
    );
    expect(reservas.get(viva.id)!.statusConceptId).toBe(BOOKING_STATUS['BK-CONFIRMED']);

    // Los dos conservados quedan cerrados: ni el de la cita cancelada se ofrece.
    const conservados = cuposDe(viejo);
    expect(conservados.map((c) => c.id)).toEqual([primero!.id, segundo!.id]);
    expect(conservados.every((c) => c.statusConceptId === STATUS['ST-CLOSED'])).toBe(true);
    const ofrecidos = pedir<{ items: { id: string }[] }>(
      'GET',
      '/scheduling/slots',
      {},
      new URLSearchParams({
        resourceId: RECURSO_MEDICA,
        from: lunes.toISOString(),
        to: new Date(lunes.getTime() + 24 * 3600 * 1000).toISOString(),
        onlyAvailable: 'true',
      }),
    ).body.items.map((i) => i.id);
    expect(ofrecidos).not.toContain(segundo!.id);

    // El horario nuevo de 45 min no genera las 14:00 encima de la cita conservada.
    const nuevo = publicar(45);
    const gen = generar(nuevo, lunes);
    expect(gen.omittedByCommitments).toBe(1);
    const nuevos = cuposDe(nuevo);
    expect(nuevos.length).toBeGreaterThan(0);
    expect(nuevos.some((c) => c.startAt < viva.endAt && c.endAt > viva.startAt)).toBe(false);
    expect(nuevos.every((c) => Date.parse(c.endAt) - Date.parse(c.startAt) === 45 * 60_000)).toBe(true);
  });

  it('límite — con affectedBookings=cancel cancela la confirmada y rechaza la solicitud', () => {
    const lunes = lunesLejano(30);
    const tpl = publicar(30);
    generar(tpl, lunes);
    const [a, b] = cuposDe(tpl);
    const confirmada = citar(a!.id, 'BK-CONFIRMED');
    const solicitud = citar(b!.id, 'BK-REQUESTED');

    const previa = pedir<{ bookings: { bookingId: string; pending: boolean }[] }>(
      'GET',
      `/scheduling/templates/${tpl}/live-bookings`,
    ).body;
    expect(previa.bookings.find((x) => x.bookingId === solicitud.id)?.pending).toBe(true);

    const retiro = pedir<Record<string, unknown>>(
      'DELETE',
      `/scheduling/templates/${tpl}`,
      {},
      new URLSearchParams({ affectedBookings: 'cancel' }),
    );
    expect(retiro.status).toBe(200);
    expect(retiro.body).toEqual(
      expect.objectContaining({ cancelledBookings: 2, liveBookings: 0, liveBookingIds: [], keptSlots: 2 }),
    );
    expect(reservas.get(confirmada.id)!.statusConceptId).toBe(BOOKING_STATUS['BK-CANCELLED']);
    expect(reservas.get(solicitud.id)!.statusConceptId).toBe(BOOKING_STATUS['BK-REJECTED']);
    expect(reservas.get(confirmada.id)!.statusReason?.reasonText).toBe(
      'Cambio en el horario de atención del profesional',
    );
  });

  it('límite — un cupo conservado de un horario retirado no se puede retener: 422', () => {
    const lunes = lunesLejano(32);
    const tpl = publicar(30);
    generar(tpl, lunes);
    const [a] = cuposDe(tpl);
    citar(a!.id, 'BK-CANCELLED');
    cupos.actualizar(a!.id, { remainingCapacity: 1 });
    pedir('DELETE', `/scheduling/templates/${tpl}`);

    const hold = pedir<{ code: string }>('POST', `/scheduling/slots/${a!.id}/holds`);
    expect(hold.status).toBe(422);
    expect(hold.body.code).toBe('PRECONDITION_FAILED');
  });

  it('inválido — con un paciente ya recibido, cancelar responde 422 y no retira nada', () => {
    const lunes = lunesLejano(34);
    const tpl = publicar(30);
    generar(tpl, lunes);
    const [a, b] = cuposDe(tpl);
    const recibido = citar(a!.id, 'BK-CHECKED-IN');
    const confirmada = citar(b!.id, 'BK-CONFIRMED');

    const previa = pedir<{ present: { bookingId: string }[] }>(
      'GET',
      `/scheduling/templates/${tpl}/live-bookings`,
    ).body;
    expect(previa.present.map((p) => p.bookingId)).toEqual([recibido.id]);

    const retiro = pedir<{ code: string; details: { bookingIds: string[] } }>(
      'DELETE',
      `/scheduling/templates/${tpl}`,
      {},
      new URLSearchParams({ affectedBookings: 'cancel' }),
    );
    expect(retiro.status).toBe(422);
    expect(retiro.body.code).toBe('PRECONDITION_FAILED');
    expect(retiro.body.details.bookingIds).toEqual([recibido.id]);
    expect(reservas.get(confirmada.id)!.statusConceptId).toBe(BOOKING_STATUS['BK-CONFIRMED']);
    expect(cuposDe(tpl)).toHaveLength(4);
  });

  it('inválido — una plantilla que no existe es 404 con el code del contrato', () => {
    const retiro = pedir<{ code: string }>('DELETE', '/scheduling/templates/no-existe');
    expect(retiro.status).toBe(404);
    expect(retiro.body.code).toBe('NOT_FOUND');
    const previa = pedir<{ code: string }>('GET', '/scheduling/templates/no-existe/live-bookings');
    expect(previa.status).toBe(404);
    expect(previa.body.code).toBe('NOT_FOUND');
  });
});
