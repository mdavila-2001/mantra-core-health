import { HttpHeaders } from '@angular/common/http';
import { afterEach, describe, expect, it } from 'vitest';

import { registrarAgenda } from './scheduling.handlers';
import { registrarServiciosDeAgenda } from './service-offerings.handlers';
import { registrarHorarioFlexible } from './flexible-hours.handlers';
import { cupos, plantillas, recursos, reservas } from '../fixtures/agenda';
import { STATUS } from '../fixtures/concepts';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';

/**
 * El simulador del horario flexible (P36) sirve el mismo contrato que la API:
 * la plantilla flexible no genera cupos, las horas se calculan al leer cada 15
 * min, y el cupo nace al retener con el tiempo por paciente.
 */
describe('handlers de horario flexible (P36)', () => {
  const router = new MockRouter();
  registrarAgenda(router);
  registrarServiciosDeAgenda(router);
  registrarHorarioFlexible(router);

  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;

  interface Respuesta<T> {
    readonly status: number;
    readonly body: T;
  }

  function llamar<T = unknown>(
    method: MockMethod,
    path: string,
    quien = paciente,
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
      user: quien,
    });
    if (resultado !== null && typeof resultado === 'object' && 'status' in resultado && 'body' in resultado) {
      return resultado as Respuesta<T>;
    }
    return { status: 200, body: resultado as T };
  }

  // Una agenda propia de esta prueba, de un profesional sin otros compromisos:
  // así lo ocupado es sólo lo que la prueba toma.
  const SEDE = 'res-p36-prueba';
  const base = recursos.todos()[0]!;
  recursos.agregar({ ...base, id: SEDE, resourceRefId: 'hp-p36-prueba', name: 'Agenda flexible' });

  /** Dentro de una semana, a medianoche local. */
  const dia = new Date();
  dia.setDate(dia.getDate() + 7);
  dia.setHours(0, 0, 0, 0);
  const a = (h: number, m = 0): Date =>
    new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m);

  afterEach(() => {
    for (const c of cupos.filtrar((x) => x.resourceId === SEDE)) cupos.borrar(c.id);
    for (const r of reservas.filtrar((x) => x.resourceId === SEDE)) reservas.borrar(r.id);
    for (const t of plantillas.filtrar((x) => x.resourceId === SEDE)) plantillas.borrar(t.id);
  });

  function publicarFlexible(): string {
    const { status, body } = llamar<{ id: string; flexibleHours: boolean }>(
      'POST',
      `/scheduling/resources/${SEDE}/templates`,
      medica,
      {
        name: 'Flexible',
        flexibleHours: true,
        slotMinutes: 20,
        rules: [{ dayOfWeek: dia.getDay(), startTime: '08:00', endTime: '10:00' }],
      },
    );
    expect(status).toBe(201);
    expect(body.flexibleHours).toBe(true);
    return body.id;
  }

  const horas = () =>
    llamar<{ stepMinutes: number; items: { startAt: string; endAt: string; templateId: string }[] }>(
      'GET',
      `/scheduling/resources/${SEDE}/flexible-availability`,
      paciente,
      {},
      new URLSearchParams({ from: a(0).toISOString(), to: a(23).toISOString() }),
    );

  it('una plantilla flexible no genera cupos', () => {
    const id = publicarFlexible();
    const { body } = llamar<{ created: number }>('POST', `/scheduling/templates/${id}/generate-slots`, medica, {
      from: a(0).toISOString(),
      to: a(23).toISOString(),
    });
    expect(body.created).toBe(0);
    expect(cupos.filtrar((c) => c.scheduleTemplateId === id)).toHaveLength(0);
  });

  it('ofrece una hora cada 15 min y cada una reserva el tiempo por paciente', () => {
    const id = publicarFlexible();
    const { body } = horas();
    expect(body.stepMinutes).toBe(15);
    expect(body.items.map((i) => i.startAt)).toEqual(
      [0, 15, 30, 45, 60, 75, 90].map((m) => a(8, m).toISOString()),
    );
    expect(body.items[0]).toEqual({
      templateId: id,
      startAt: a(8).toISOString(),
      endAt: a(8, 20).toISOString(),
    });
  });

  it('retener crea el cupo de esa hora, ya tomado, y la hora deja de ofrecerse', () => {
    const id = publicarFlexible();
    const { status, body } = llamar<{ bookableSlotId: string; holdToken: string; endAt: string }>(
      'POST',
      `/scheduling/resources/${SEDE}/flexible-holds`,
      paciente,
      { startAt: a(8, 10).toISOString() },
    );
    expect(status).toBe(201);
    expect(body.endAt).toBe(a(8, 30).toISOString());
    expect(cupos.get(body.bookableSlotId)).toMatchObject({
      scheduleTemplateId: id,
      capacity: 1,
      remainingCapacity: 0,
      statusConceptId: STATUS['ST-ACTIVE'],
    });

    const libres = horas().body.items.map((i) => i.startAt);
    expect(libres).not.toContain(a(8, 0).toISOString());
    expect(libres).not.toContain(a(8, 15).toISOString());
    expect(libres).toContain(a(8, 30).toISOString());
  });

  it('una hora que pisa otra retenida es 409', () => {
    publicarFlexible();
    llamar('POST', `/scheduling/resources/${SEDE}/flexible-holds`, paciente, { startAt: a(8, 10).toISOString() });
    const { status } = llamar('POST', `/scheduling/resources/${SEDE}/flexible-holds`, paciente, {
      startAt: a(8, 20).toISOString(),
    });
    expect(status).toBe(409);
  });

  it('una hora fuera de la franja es 422', () => {
    publicarFlexible();
    const { status } = llamar('POST', `/scheduling/resources/${SEDE}/flexible-holds`, paciente, {
      startAt: a(9, 50).toISOString(),
    });
    expect(status).toBe(422);
  });

  it('una agenda de turnos fijos no ofrece horas flexibles', () => {
    llamar('POST', `/scheduling/resources/${SEDE}/templates`, medica, {
      name: 'Fijo',
      rules: [{ dayOfWeek: dia.getDay(), startTime: '08:00', endTime: '10:00', slotMinutes: 30 }],
    });
    expect(horas().body.items).toEqual([]);
  });
});
