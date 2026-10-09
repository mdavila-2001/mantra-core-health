import { HttpHeaders } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registrarAgenda } from './scheduling.handlers';
import { registrarServiciosDeAgenda } from './service-offerings.handlers';
import { cupos, reservas } from '../fixtures/agenda';
import { ACTIVITY, STATUS, BOOKING_STATUS } from '../fixtures/concepts';
import { MEDICAL } from '../fixtures/people';
import { offers } from '../fixtures/offered-services';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { servicios } from './practice.handlers';
import { uuid } from '../mock-store';

/**
 * El simulador de servicios con duración dinámica tiene que hacer lo mismo que la
 * API (v4.2.40): los horarios se calculan al leer, el cupo nace al retener con el
 * MÁXIMO, y una cancelación devuelve las consultas que el servicio había pisado.
 */
describe('handlers de servicios con duración dinámica', () => {
  const router = new MockRouter();
  registrarAgenda(router);
  registrarServiciosDeAgenda(router);

  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;

  interface Respuesta<T> {
    readonly status: number;
    readonly body: T;
  }

  function llamar<T = unknown>(
    method: MockMethod,
    path: string,
    quien = medica,
    body: unknown = {},
    query = new URLSearchParams(),
  ): Respuesta<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({ method, path, params: match.params, query, body, headers: new HttpHeaders(), user: quien });
    if (resultado !== null && typeof resultado === 'object' && 'status' in resultado && 'body' in resultado) {
      return resultado as Respuesta<T>;
    }
    return { status: 200, body: resultado as T };
  }

  const ECO = uuid(`offering-${MEDICAL.id}-ECO-DOPPLER`);
  const ECG = uuid(`offering-${MEDICAL.id}-ECG`);
  const HOLTER = uuid(`offering-${MEDICAL.id}-HOLTER`);

  interface Horarios {
    items: { resourceId: string; startAt: string; endAtMax: string; endAtMin: string }[];
    minDurationMinutes: number;
    maxDurationMinutes: number;
  }
  const dias = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString();
  const query = (id: string): URLSearchParams => new URLSearchParams({ offeringId: id, from: dias(0), to: dias(21) });
  const horarios = (id: string, quien = paciente): Respuesta<Horarios> =>
    llamar<Horarios>('GET', '/scheduling/service-availability', quien, {}, query(id));

  /** El primer horario de un miércoles: la mañana MIXTA, donde conviven consultas y servicios. */
  const unMiercoles = (items: Horarios['items']) => items.find((i) => new Date(i.startAt).getDay() === 3);

  /**
   * Las tablas del simulador son singletons de módulo: lo que un test escribe lo ve
   * el siguiente **y también los otros archivos** que corran en el mismo proceso
   * (el conteo de reclamos de portabilidad, por ejemplo, se alimenta de las
   * reservas). Por eso se guarda una foto al empezar y se restaura **al terminar**,
   * no sólo antes de cada prueba: limpiar al entrar protege a este archivo, limpiar
   * al salir protege a los demás.
   */
  const fotoDeCupos = cupos.todos();
  const fotoDeReservas = reservas.todos();
  const fotoDeOfertas = offers.todos();

  function restaurar<T extends { readonly id: string }>(
    tabla: { todos(): T[]; has(id: string): boolean; borrar(id: string): boolean; agregar(f: T): T; actualizar(id: string, c: Partial<T>): T | undefined },
    foto: readonly T[],
  ): void {
    const ids = new Set(foto.map((f) => f.id));
    for (const fila of tabla.todos()) if (!ids.has(fila.id)) tabla.borrar(fila.id);
    for (const fila of foto) {
      if (tabla.has(fila.id)) tabla.actualizar(fila.id, fila);
      else tabla.agregar(fila);
    }
  }

  function restaurarTodo(): void {
    restaurar(cupos, fotoDeCupos);
    restaurar(reservas, fotoDeReservas);
    restaurar(offers, fotoDeOfertas);
  }

  beforeEach(restaurarTodo);
  afterEach(restaurarTodo);

  describe('la oferta del profesional', () => {
    it('el dueño ve todas las suyas, con el nombre y el precio del catálogo', () => {
      const { body } = llamar<{ items: { serviceName: string; price: string; maxDurationMinutes: number }[] }>(
        'GET',
        '/scheduling/service-offerings',
        medica,
      );
      expect(body.items.length).toBeGreaterThanOrEqual(5);
      expect(body.items.find((i) => i.serviceName === 'Ecocardiograma Doppler')).toMatchObject({ price: '480.00', maxDurationMinutes: 45 });
    });

    it('un paciente sólo ve lo activo y reservable', () => {
      llamar('PATCH', `/scheduling/service-offerings/${ECG}`, medica, { isPatientBookable: false });
      const { body } = llamar<{ items: { id: string }[] }>(
        'GET',
        '/scheduling/service-offerings',
        paciente,
        {},
        new URLSearchParams({ practitionerProfileId: MEDICAL.id }),
      );
      expect(body.items.map((i) => i.id)).not.toContain(ECG);
      expect(body.items.map((i) => i.id)).toContain(ECO);
    });

    it('un paciente no ve la disponibilidad de una oferta que no se puede reservar', () => {
      llamar('PATCH', `/scheduling/service-offerings/${ECG}`, medica, { isPatientBookable: false });
      expect(horarios(ECG).status).toBe(404);
    });

    it('rechaza un mínimo mayor que el máximo', () => {
      const { status, body } = llamar<{ message: string }>('PATCH', `/scheduling/service-offerings/${ECO}`, medica, { minDurationMinutes: 90 });
      expect(status).toBe(422);
      expect(body.message).toMatch(/mínima no puede ser mayor/);
    });

    it('una oferta ajena responde 404, no 403', () => {
      const ajeno = { ...medica, roles: ['PRACTITIONER'], practitionerProfileId: 'otro-profesional' };
      expect(llamar('PATCH', `/scheduling/service-offerings/${ECO}`, ajeno, { isActive: false }).status).toBe(404);
    });

    it('un paciente no crea ofertas', () => {
      const catalogo = servicios.todos().find((s) => s.code === 'MAPA')!;
      expect(llamar('POST', '/scheduling/service-offerings', paciente, { serviceCatalogId: catalogo.id, minDurationMinutes: 10, maxDurationMinutes: 20 }).status).toBe(403);
    });

    it('crear dos veces el mismo servicio da 409', () => {
      const existente = servicios.todos().find((s) => s.code === 'ECG')!;
      expect(llamar('POST', '/scheduling/service-offerings', medica, { serviceCatalogId: existente.id, minDurationMinutes: 10, maxDurationMinutes: 20 }).status).toBe(409);
    });

    it('crea la oferta de un servicio que todavía no ofrecía', () => {
      const mapa = servicios.todos().find((s) => s.code === 'MAPA')!;
      const { status, body } = llamar<{ serviceName: string; isActive: boolean }>('POST', '/scheduling/service-offerings', medica, {
        serviceCatalogId: mapa.id,
        minDurationMinutes: 15,
        maxDurationMinutes: 20,
      });
      expect(status).toBe(201);
      expect(body).toMatchObject({ isActive: true });
      expect(body.serviceName).toContain('MAPA');
    });
  });

  describe('la disponibilidad', () => {
    it('sólo ofrece horarios dentro de las franjas que admiten servicios', () => {
      const { body } = horarios(ECO);
      expect(body.items.length).toBeGreaterThan(0);
      for (const item of body.items) {
        const inicio = new Date(item.startAt);
        const dia = inicio.getDay();
        const hora = inicio.getHours() + inicio.getMinutes() / 60;
        // Martes y jueves de 14 a 18 (SERVICES) o miércoles de 8 a 12 (MIXED).
        const enServicios = (dia === 2 || dia === 4) && hora >= 14 && hora < 18;
        const enMixta = dia === 3 && hora >= 8 && hora < 12;
        expect(enServicios || enMixta, `${item.startAt} cae fuera de las franjas de servicios`).toBe(true);
      }
    });

    it('cada horario reserva el máximo y dice el mínimo como fin posible', () => {
      const { body } = horarios(ECO);
      const primero = body.items[0]!;
      const inicio = new Date(primero.startAt).getTime();
      expect(new Date(primero.endAtMax).getTime() - inicio).toBe(45 * 60_000);
      expect(new Date(primero.endAtMin).getTime() - inicio).toBe(30 * 60_000);
    });

    it('un servicio corto ofrece más inicios que uno largo en la misma franja', () => {
      expect(horarios(ECG).body.items.length).toBeGreaterThan(horarios(ECO).body.items.length);
    });

    it('un inicio sólo se ofrece si cabe CON su limpieza dentro de la ventana pedida', () => {
      // El ECG dura 20 min como máximo y pide 5 de limpieza: ocupa 25. Con la ventana justa del
      // turno (20 min) no cabe; con un margen sí. Por eso la pantalla de reserva relee con margen.
      const item = horarios(ECG).body.items.find((i) => new Date(i.startAt).getTime() - Date.now() > 3 * 3_600_000)!;
      const inicio = new Date(item.startAt).getTime();
      const fin = new Date(item.endAtMax).getTime();
      const leer = (desde: number, hasta: number) =>
        llamar<Horarios>('GET', '/scheduling/service-availability', paciente, {}, new URLSearchParams({
          offeringId: ECG, resourceId: item.resourceId, from: new Date(desde).toISOString(), to: new Date(hasta).toISOString(),
        })).body.items;

      expect(leer(inicio, fin).some((i) => i.startAt === item.startAt)).toBe(false);
      expect(leer(inicio - 2 * 3_600_000, fin + 2 * 3_600_000).some((i) => i.startAt === item.startAt)).toBe(true);
    });
  });

  describe('retener, confirmar y cancelar', () => {
    function retener(id: string, item: { resourceId: string; startAt: string }, quien = paciente) {
      return llamar<{ holdToken: string; bookableSlotId: string; retractedSlots: number; endAt: string; startAt: string }>(
        'POST',
        `/scheduling/service-offerings/${id}/holds`,
        quien,
        { resourceId: item.resourceId, startAt: item.startAt },
      );
    }

    it('crea un cupo puntual del largo MÁXIMO, ya tomado y ligado a la oferta', () => {
      const item = horarios(ECO).body.items[0]!;
      const { status, body } = retener(ECO, item);
      expect(status).toBe(201);
      const cupo = cupos.get(body.bookableSlotId)!;
      expect(cupo).toMatchObject({ capacity: 1, remainingCapacity: 0, serviceOfferingId: ECO, scheduleTemplateId: null });
      expect(new Date(cupo.endAt).getTime() - new Date(cupo.startAt).getTime()).toBe(45 * 60_000);
    });

    it('retira las consultas que pisa, y la cancelación las devuelve', () => {
      const item = unMiercoles(horarios(ECO).body.items)!;
      const { body } = retener(ECO, item);
      expect(body.retractedSlots).toBeGreaterThan(0);
      const retraidos = cupos.filtrar((c) => c.retractedByService === true);
      expect(retraidos.length).toBe(body.retractedSlots);
      expect(retraidos.every((c) => c.statusConceptId !== STATUS['ST-ACTIVE'])).toBe(true);

      const reserva = llamar<{ id: string }>('POST', `/scheduling/holds/${body.holdToken}/request`, paciente, { patientProfileId: paciente.patientProfileId, channel: 'PORTAL' });
      llamar('POST', `/scheduling/bookings/${reserva.body.id}/cancel`, paciente, { cancelledBy: 'PATIENT', reasonText: 'No puedo ir' });

      // El cupo del servicio muere con la cancelación y las consultas vuelven.
      expect(cupos.get(body.bookableSlotId)).toBeUndefined();
      expect(cupos.filtrar((c) => c.retractedByService === true)).toEqual([]);
      expect(retraidos.map((c) => cupos.get(c.id)!.statusConceptId)).toEqual(retraidos.map(() => STATUS['ST-ACTIVE']));
    });

    it('un segundo paciente no puede retener un horario que se pisa: 409', () => {
      const item = horarios(ECO).body.items[0]!;
      expect(retener(ECO, item).status).toBe(201);
      const otra = retener(ECO, item);
      expect(otra.status).toBe(409);
    });

    it('lo retenido deja de ofrecerse a los demás, con el colchón del servicio', () => {
      const antes = horarios(ECO).body.items;
      const elegido = antes[0]!;
      retener(ECO, elegido);
      const despues = horarios(ECO).body.items.map((i) => i.startAt);
      expect(despues).not.toContain(elegido.startAt);
      // El primer inicio libre es posterior al fin del turno retenido más la limpieza (10 min).
      const finConLimpieza = new Date(elegido.endAtMax).getTime() + 10 * 60_000;
      const siguiente = horarios(ECO).body.items.find((i) => i.resourceId === elegido.resourceId && new Date(i.startAt).getTime() >= new Date(elegido.startAt).getTime());
      if (siguiente !== undefined) {
        expect(new Date(siguiente.startAt).getTime()).toBeGreaterThanOrEqual(finConLimpieza + 5 * 60_000);
      }
    });

    it('un servicio SIN aprobación requerida nace confirmado, aunque el paciente lo "pida"', () => {
      const item = horarios(ECO).body.items[0]!;
      const { body } = retener(ECO, item);
      const reserva = llamar<{ statusConceptId: string }>('POST', `/scheduling/holds/${body.holdToken}/request`, paciente, { patientProfileId: paciente.patientProfileId, channel: 'PORTAL' });
      expect(reserva.body.statusConceptId).toBe(BOOKING_STATUS['BK-CONFIRMED']);
      const guardada = reservas.todos().find((r) => r.bookableSlotId === body.bookableSlotId)!;
      expect(guardada.service).toMatchObject({ name: 'Ecocardiograma Doppler', price: '480.00', minDurationMinutes: 30, maxDurationMinutes: 45 });
      // Un servicio es un procedimiento para la agenda, como lo clasifica la API: es lo que
      // la pinta con su tipología y no como una consulta más.
      expect(guardada.typeConceptId).toBe(ACTIVITY['ACT-PROCEDIMIENTO']);
    });

    it('un servicio CON aprobación requerida queda pendiente de aceptación', () => {
      const item = horarios(HOLTER).body.items[0]!;
      const { body } = retener(HOLTER, item);
      const reserva = llamar<{ statusConceptId: string }>('POST', `/scheduling/holds/${body.holdToken}/request`, paciente, { patientProfileId: paciente.patientProfileId, channel: 'PORTAL' });
      expect(reserva.body.statusConceptId).toBe(BOOKING_STATUS['BK-REQUESTED']);
    });

    it('una retención que nadie confirmó vence y libera el horario', () => {
      const item = horarios(ECO).body.items[0]!;
      const { body } = retener(ECO, item);
      cupos.actualizar(body.bookableSlotId, { heldUntil: new Date(Date.now() - 1000).toISOString() });
      expect(horarios(ECO).body.items.map((i) => i.startAt)).toContain(item.startAt);
      expect(cupos.get(body.bookableSlotId)).toBeUndefined();
    });

    it('terminar antes recorta el cupo y libera el sobrante', () => {
      const item = horarios(ECO).body.items[0]!;
      const { body } = retener(ECO, item);
      const reserva = llamar<{ id: string }>('POST', `/scheduling/holds/${body.holdToken}/request`, paciente, { patientProfileId: paciente.patientProfileId, channel: 'PORTAL' });
      // Se adelanta el turno al pasado cercano para que «ahora» caiga dentro.
      const inicio = new Date(Date.now() - 10 * 60_000).toISOString();
      const fin = new Date(Date.now() + 35 * 60_000).toISOString();
      cupos.actualizar(body.bookableSlotId, { startAt: inicio, endAt: fin });
      reservas.actualizar(reserva.body.id, { startAt: inicio, endAt: fin });

      llamar('POST', `/scheduling/bookings/${reserva.body.id}/complete`, medica);

      expect(new Date(cupos.get(body.bookableSlotId)!.endAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      expect(new Date(reservas.get(reserva.body.id)!.endAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('no retiene un horario que ya pasó', () => {
      const item = horarios(ECO).body.items[0]!;
      expect(retener(ECO, { resourceId: item.resourceId, startAt: dias(-1) }).status).toBe(422);
    });

    it('no retiene en la sede de otro profesional', () => {
      expect(retener(ECO, { resourceId: 'sede-inexistente', startAt: horarios(ECO).body.items[0]!.startAt }).status).toBe(404);
    });
  });
});
