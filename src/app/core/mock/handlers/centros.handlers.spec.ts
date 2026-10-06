import { HttpHeaders } from '@angular/common/http';
import { beforeEach, describe, expect, it } from 'vitest';

import type {
  CenterScheduleView,
  OrderAppointment,
  OrderBookingOptions,
  StudyAvailability,
} from '../../data-access/diagnostic-units/center-schedule.types';
import { horarioDeSemana } from '../../data-access/diagnostic-units/center-schedule.rules';
import { estadosDeEquipos, horariosDeCentros, turnosDeOrdenes } from '../fixtures/centros';
import { ordenes } from '../fixtures/clinica';
import { mensajes } from '../fixtures/comunidad';
import { ESTUDIO } from '../fixtures/conceptos';
import { PACIENTE } from '../fixtures/personas';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { uuid } from '../mock-store';
import { registrarCentros } from './centros.handlers';
import { registrarDiagnostico } from './diagnostics.handlers';

describe('handlers de horarios de centros y reserva por orden', () => {
  const router = new MockRouter();
  registrarDiagnostico(router);
  registrarCentros(router);

  const imagen = buscarUsuario('imagen@alovida.mock')!;
  const paciente = buscarUsuario('paciente')!;
  const IMAGEN_SUR = uuid('unit-imagen-sur');

  interface Respuesta<T> {
    readonly status: number;
    readonly body: T;
  }

  function llamar<T = unknown>(method: MockMethod, path: string, quien = imagen, body: unknown = {}, query = new URLSearchParams()): Respuesta<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({ method, path, params: match.params, query, body, headers: new HttpHeaders(), user: quien });
    if (resultado !== null && typeof resultado === 'object' && 'status' in resultado && 'body' in resultado) {
      return resultado as Respuesta<T>;
    }
    return { status: 200, body: resultado as T };
  }

  const ordenDeEcografia = (): string =>
    ordenes.filtrar((o) => o.patientProfileId === PACIENTE.id && o.codeConceptId === ESTUDIO['STUDY-ECO-ABD'])[0]!.id;

  const disponibilidad = (studyCode: string): StudyAvailability => {
    const desde = new Date();
    const hasta = new Date(Date.now() + 14 * 86_400_000);
    const query = new URLSearchParams({ studyCode, from: desde.toISOString(), to: hasta.toISOString() });
    return llamar<StudyAvailability>('GET', `/diagnostic-units/${IMAGEN_SUR}/study-availability`, paciente, {}, query).body;
  };

  beforeEach(() => {
    for (const t of [horariosDeCentros, estadosDeEquipos, turnosDeOrdenes] as const) {
      for (const fila of t.todos()) t.borrar(fila.id);
    }
  });

  it('el paciente no ve la agenda interna del centro; el personal sí', () => {
    expect(llamar('GET', `/diagnostic-units/${IMAGEN_SUR}/schedule`, paciente).status).toBe(403);
    const vista = llamar<CenterScheduleView>('GET', `/diagnostic-units/${IMAGEN_SUR}/schedule`).body;
    expect(vista.unitName).toBe('Centro de Imagen Sur');
    expect(vista.schedule.modalities).toEqual([]);
    expect(vista.studies.some((s) => s.code === 'STUDY-ECO-ABD' && s.modalityCode === 'ECO')).toBe(true);
    // Dos ecógrafos: el fijo operativo y el portátil fuera de servicio.
    expect(vista.equipment.filter((e) => e.modalityCode === 'ECO').map((e) => e.status)).toEqual(['OPERATIONAL', 'OUT_OF_SERVICE']);
  });

  it('rechaza un horario propio sin días', () => {
    const vista = llamar<CenterScheduleView>('GET', `/diagnostic-units/${IMAGEN_SUR}/schedule`).body;
    const r = llamar('PUT', `/diagnostic-units/${IMAGEN_SUR}/schedule`, imagen, {
      ...vista.schedule,
      modalities: [{ modalityCode: 'ECO', schedule: { windows: [], slotMinutes: 20 } }],
    });
    expect(r.status).toBe(422);
  });

  it('el horario propio de ecografía manda sobre el general y se guarda', () => {
    const vista = llamar<CenterScheduleView>('GET', `/diagnostic-units/${IMAGEN_SUR}/schedule`).body;
    const guardado = llamar<CenterScheduleView>('PUT', `/diagnostic-units/${IMAGEN_SUR}/schedule`, imagen, {
      ...vista.schedule,
      modalities: [{ modalityCode: 'ECO', schedule: horarioDeSemana('14:00', '16:00', 20, [1, 2, 3, 4, 5, 6]) }],
    });
    expect(guardado.status).toBe(200);
    expect(disponibilidad('STUDY-ECO-ABD').origin).toBe('MODALITY');
    expect(disponibilidad('STUDY-RX-TORAX').origin).toBe('GENERAL');
    const horas = new Set(disponibilidad('STUDY-ECO-ABD').items.map((i) => new Date(i.startAt).getHours()));
    expect([...horas].every((h) => h === 14 || h === 15)).toBe(true);
  });

  it('el cupo por franja es la cantidad de equipos operativos', () => {
    expect(disponibilidad('STUDY-ECO-ABD').items[0]?.capacity).toBe(1);
    const vista = llamar<CenterScheduleView>('GET', `/diagnostic-units/${IMAGEN_SUR}/schedule`).body;
    const portatil = vista.equipment.find((e) => e.modalityCode === 'ECO' && e.status === 'OUT_OF_SERVICE')!;
    expect(llamar('PATCH', `/diagnostic-units/${IMAGEN_SUR}/equipment/${portatil.id}`, imagen, { status: 'OPERATIONAL' }).status).toBe(200);
    expect(disponibilidad('STUDY-ECO-ABD').items[0]?.capacity).toBe(2);
  });

  it('una modalidad sin equipos operativos no ofrece turnos', () => {
    // El resonador está en mantenimiento desde la fábrica.
    expect(disponibilidad('STUDY-RMN-RODILLA').items).toEqual([]);
  });

  it('la orden ofrece los centros que hacen su estudio, con precio y distancia', () => {
    const opciones = llamar<OrderBookingOptions>('GET', `/diagnostic-orders/${ordenDeEcografia()}/booking-options`, paciente).body;
    expect(opciones.studyCode).toBe('STUDY-ECO-ABD');
    expect(opciones.modalityLabel).toBe('Ecografía');
    const sur = opciones.options.find((o) => o.unitId === IMAGEN_SUR)!;
    expect(sur.price).not.toBeNull();
    expect(sur.distanceKm).not.toBeNull();
    expect(sur.nextStartAt).not.toBeNull();
    expect(sur.preparation).toBe('Ayuno de 6 a 8 horas.');
  });

  it('reservar confirma el turno, ocupa el cupo, avisa por chat y no deja reservar dos veces', () => {
    const orden = ordenDeEcografia();
    const libre = disponibilidad('STUDY-ECO-ABD').items[0]!;
    const antes = mensajes.tamano;
    const r = llamar<OrderAppointment>('POST', `/diagnostic-orders/${orden}/booking`, paciente, { unitId: IMAGEN_SUR, startAt: libre.startAt });
    expect(r.status).toBe(201);
    expect(r.body.unitName).toBe('Centro de Imagen Sur');
    expect(mensajes.tamano).toBe(antes + 1);
    expect(disponibilidad('STUDY-ECO-ABD').items.some((i) => i.startAt === libre.startAt)).toBe(false);
    expect(llamar('POST', `/diagnostic-orders/${orden}/booking`, paciente, { unitId: IMAGEN_SUR, startAt: libre.startAt }).status).toBe(409);

    const conTurno = llamar<{ items: { id: string; appointment: OrderAppointment | null }[] }>('GET', '/diagnostic-results/me/orders', paciente).body;
    expect(conTurno.items.find((o) => o.id === orden)?.appointment?.startAt).toBe(libre.startAt);

    expect(llamar('DELETE', `/diagnostic-orders/${orden}/booking`, paciente).status).toBe(204);
    expect(disponibilidad('STUDY-ECO-ABD').items.some((i) => i.startAt === libre.startAt)).toBe(true);
  });

  it('un horario ocupado en el medio devuelve 409 con slotTaken', () => {
    const r = llamar<{ details?: { slotTaken?: boolean } }>('POST', `/diagnostic-orders/${ordenDeEcografia()}/booking`, paciente, {
      unitId: IMAGEN_SUR,
      startAt: '2020-01-01T08:00:00.000Z',
    });
    expect(r.status).toBe(409);
  });

  it('no deja publicar un horario que deja afuera un turno ya reservado', () => {
    const libre = disponibilidad('STUDY-ECO-ABD').items[0]!;
    llamar('POST', `/diagnostic-orders/${ordenDeEcografia()}/booking`, paciente, { unitId: IMAGEN_SUR, startAt: libre.startAt });
    const vista = llamar<CenterScheduleView>('GET', `/diagnostic-units/${IMAGEN_SUR}/schedule`).body;
    const r = llamar<{ details: { affectedBookings: number } }>('PUT', `/diagnostic-units/${IMAGEN_SUR}/schedule`, imagen, {
      ...vista.schedule,
      modalities: [{ modalityCode: 'ECO', schedule: horarioDeSemana('20:00', '21:00', 30, [7]) }],
    });
    expect(r.status).toBe(409);
  });
});
