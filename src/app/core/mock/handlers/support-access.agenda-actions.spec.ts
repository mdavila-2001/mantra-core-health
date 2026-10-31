import { HttpHeaders } from '@angular/common/http';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { SupportAgenda, SupportAgendaItem } from '../../data-access/support-access/support-access.types';
import type { WireSupportAgenda, WireSupportFreeSlots } from '../../data-access/support-access/support-agenda.wire';
import type { SupportPatientRegistration, SupportPatientSearchResult } from '../../data-access/support-access/support-patients.types';
import { patientList } from '../fixtures/people';
import { ANTELO, LOC, MENDEZ, PEREZ, ROJAS, SUAREZ } from '../fixtures/support-hospital';
import { agendaDePartida, recursoDeAgenda } from '../fixtures/support-hospital-agenda';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_CESPEDES, TENANT_HOSPITAL_PILOTO, type MockUser } from '../mock-session';
import { crearRouterSimulado } from './index';
import { agendaVista, perfilDelDoctor } from './support-access.agenda-view';
import { SUPPORT_DENIED_MESSAGE } from './support-access.errors';
import { agotarTopePorIp, reiniciarTopeDeBusquedas } from './support-access.patients.handlers';

/**
 * La agenda combinada contra el simulador: la **semana** del hospital piloto
 * (con lo permitido y lo negado a la vista), las acciones que se agregaron
 * —cancelar, reprogramar, confirmar, atender sin cita, lista de espera— y la
 * búsqueda exacta y el registro de pacientes.
 *
 * El estado vive en colecciones del módulo: estas pruebas se leen en orden.
 */
let router: MockRouter;

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}

function llamar<T = unknown>(user: MockUser | null, method: MockMethod, path: string, opciones: { body?: unknown; query?: Record<string, string> } = {}): Respuesta<T> {
  const [ruta, cadena] = path.split('?');
  const query = new URLSearchParams(cadena ?? '');
  for (const [k, v] of Object.entries(opciones.query ?? {})) query.set(k, v);
  const match = router.match(method, ruta!);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({ method, path: ruta!, params: match.params, query, body: opciones.body ?? null, headers: new HttpHeaders(), user });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}

const ana = buscarUsuario('ana')!;
const lucia = buscarUsuario('lucia')!;
const marcos = buscarUsuario('marcos')!;
const elena = buscarUsuario('elena')!;
const rosa = buscarUsuario('rosa')!;

/** Lunes de la semana de hoy a domingo. */
function semana(): { from: string; to: string } {
  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6, 23, 59, 59, 999);
  return { from: lunes.toISOString(), to: domingo.toISOString() };
}

/** Los próximos quince días, para encontrar horarios a futuro. */
function proximos(): { from: string; to: string } {
  return { from: new Date().toISOString(), to: new Date(Date.now() + 15 * 86_400_000).toISOString() };
}

const DOCTORES_REALES = [ANTELO, MENDEZ, PEREZ, ROJAS, SUAREZ];

const agendaDe = (user: MockUser, rango: { from: string; to: string }, tenant = TENANT_HOSPITAL_PILOTO): SupportAgenda => {
  const query = { org: tenant, ...rango };
  const agenda = llamar<WireSupportAgenda>(user, 'GET', '/me/support-agenda', { query }).body;
  return agendaVista(agenda, llamar<WireSupportFreeSlots>(user, 'GET', '/me/support-agenda/free-slots', { query }).body);
};

function libreFuturo(user: MockUser, doctorId: string, espacio: string, despuesDe = 0): SupportAgendaItem {
  const manana = Date.now() + despuesDe * 86_400_000;
  const item = agendaDe(user, proximos()).items.find(
    (i) => i.practitionerRoleAssignmentId === perfilDelDoctor(doctorId) && i.careSpaceId === LOC[espacio]!.id && i.status === 'FREE' && new Date(i.start).getTime() > manana && i.allowedActions.includes('schedule.view'),
  );
  if (item === undefined) throw new Error(`No hay un horario libre a futuro de ${doctorId} en ${espacio}`);
  return item;
}

function citaFutura(user: MockUser, doctorId: string, espacio: string, estado: SupportAgendaItem['status']): SupportAgendaItem {
  const item = agendaDe(user, proximos()).items.find((i) => i.practitionerRoleAssignmentId === perfilDelDoctor(doctorId) && i.careSpaceId === LOC[espacio]!.id && i.status === estado);
  if (item === undefined) throw new Error(`No hay una cita ${estado} de ${doctorId} en ${espacio}`);
  return item;
}

describe('agenda combinada en el simulador', () => {
  beforeAll(() => {
    router = crearRouterSimulado();
  });

  describe('la semana del hospital piloto', () => {
    it('Ana ve a Pérez y a Rojas en los siete días, con horarios libres y citas', () => {
      const agenda = agendaDe(ana, semana());
      expect(agenda.doctors.map((d) => d.id).sort()).toEqual([PEREZ.practitionerProfileId, ROJAS.practitionerProfileId].sort());
      const dias = new Set(agenda.items.map((i) => new Date(i.start).getDate()));
      expect(dias.size).toBe(7);
      expect(agenda.items.some((i) => i.status === 'FREE')).toBe(true);
      expect(agenda.items.some((i) => i.status === 'CONFIRMED')).toBe(true);
      expect(agenda.items.some((i) => i.status === 'BOOKED')).toBe(true);
      expect(agenda.items.every((i) => i.resourceId === recursoDeAgenda(DOCTORES_REALES.find((d) => d.practitionerProfileId === i.practitionerRoleAssignmentId)!.id, i.careSpaceId))).toBe(true);
    });

    it('un doctor nunca está en dos lugares a la vez', () => {
      const porDoctor = new Map<string, Set<string>>();
      for (const f of agendaDePartida().filter((x) => x.tenantId === TENANT_HOSPITAL_PILOTO)) {
        const clave = f.doctorId;
        const visto = porDoctor.get(clave) ?? new Set<string>();
        expect(visto.has(f.start), `${clave} duplicado a las ${f.start}`).toBe(false);
        visto.add(f.start);
        porDoctor.set(clave, visto);
      }
    });

    it('Lucía solo tiene entre las ubicaciones sus consultorios del Piso 1 (la API da una lista plana de espacios, sin pisos): ni el piso 2 ni la internación', () => {
      const agenda = agendaDe(lucia, semana());
      const nombres = agenda.locations.map((l) => l.name);
      expect(nombres).toContain('Consultorio 103');
      expect(nombres.some((n) => n.startsWith('Piso 2') || n.startsWith('Piso 4') || n.startsWith('Cama'))).toBe(false);
    });

    it('lo que está fuera de su piso NO sale: una cita sin ninguna acción de agenda permitida no aparece ni como bloque', () => {
      const items = agendaDe(lucia, semana()).items;
      expect(items.some((i) => i.practitionerRoleAssignmentId === MENDEZ.practitionerProfileId && i.careSpaceId === LOC['a-p4-401']!.id)).toBe(false);
      expect(items.every((i) => i.allowedActions.some((a) => a.startsWith('schedule.')))).toBe(true);
    });

    it('Lucía no tiene «Crear» en ningún horario, y sí «Atender sin cita» (caso 05)', () => {
      const propios = agendaDe(lucia, semana()).items.filter((i) => i.allowedActions.length > 0);
      expect(propios.length).toBeGreaterThan(0);
      expect(propios.every((i) => !i.allowedActions.includes('schedule.create'))).toBe(true);
      expect(propios.every((i) => i.allowedActions.includes('schedule.walk_in'))).toBe(true);
    });

    it('Marcos ve Ecografía de todo el hospital y la combinación Suárez × Norte (casos 06 a 08)', () => {
      const agenda = agendaDe(marcos, semana());
      const eco = agenda.items.filter((i) => i.practitionerRoleAssignmentId === ANTELO.practitionerProfileId && i.careSpaceId === LOC['a-p2-201']!.id);
      expect(eco.length).toBeGreaterThan(0);
      expect(eco.every((i) => i.allowedActions.includes('schedule.create'))).toBe(true);
      const norte = agenda.items.filter((i) => i.practitionerRoleAssignmentId === SUAREZ.practitionerProfileId && i.careSpaceId === LOC['n-p1-n102']!.id);
      const edificioB = agenda.items.filter((i) => i.practitionerRoleAssignmentId === SUAREZ.practitionerProfileId && i.careSpaceId === LOC['b-p1-b102']!.id);
      expect(norte.length).toBeGreaterThan(0);
      expect(norte.every((i) => i.allowedActions.includes('schedule.create'))).toBe(true);
      // El Edificio B no es suyo: sin ninguna acción de agenda, no sale ni como bloque.
      expect(edificioB).toHaveLength(0);
      // Rojas (eco obstétrica) no es de Marcos: ni siquiera aparece su agenda.
      expect(agenda.doctors.some((d) => d.id === ROJAS.id)).toBe(false);
    });

    it('Marcos tiene servicios solo de lo que cubre: Ecografía y la consulta de pediatría de Suárez', () => {
      const servicios = agendaDe(marcos, semana()).services.map((s) => s.name);
      expect(servicios).toContain('Ecografía');
      expect(servicios).not.toContain('Ecografía obstétrica');
    });
  });

  describe('cancelar', () => {
    it('el motivo falta, es corto o es relleno: 422 con REASON_REQUIRED o REASON_PLACEHOLDER; 400 solo si no es texto o pasa de 500', () => {
      const cita = citaFutura(ana, PEREZ.id, 'a-p1-103', 'CONFIRMED');
      const probar = (reasonText: unknown) => llamar<{ reason?: string; details?: { reason?: string } }>(ana, 'POST', `/scheduling/bookings/${cita.id}/cancel`, { body: { cancelledBy: 'PROVIDER', ...(reasonText === undefined ? {} : { reasonText }) } });
      for (const falta of [undefined, '', '   ', 'no', 'N/A']) {
        const r = probar(falta);
        expect(r.status, String(falta)).toBe(422);
        expect(r.body.reason).toBe('REASON_REQUIRED');
        expect(r.body.details?.reason).toBe('REASON_REQUIRED');
      }
      for (const relleno of ['prueba', 'no aplica', 'xxxxx', '.....', 'Sin motivo']) {
        const r = probar(relleno);
        expect(r.status, relleno).toBe(422);
        expect(r.body.reason).toBe('REASON_PLACEHOLDER');
      }
      expect(probar(42).status).toBe(400);
      expect(probar('a'.repeat(501)).status).toBe(400);
      // «no aplica el tratamiento» es un motivo de verdad: el relleno se compara entero, no por pedazos.
      expect(probar('No aplica el tratamiento indicado').status).toBe(200);
    });

    it('sin motivo no cancela: 422', () => {
      const cita = citaFutura(ana, PEREZ.id, 'a-p1-103', 'CONFIRMED');
      expect(llamar(ana, 'POST', `/scheduling/bookings/${cita.id}/cancel`, { body: { cancelledBy: 'PROVIDER', reasonText: '  ' } }).status).toBe(422);
    });

    it('con motivo cancela y el horario vuelve a estar libre', () => {
      const cita = citaFutura(ana, PEREZ.id, 'a-p1-103', 'CONFIRMED');
      const r = llamar(ana, 'POST', `/scheduling/bookings/${cita.id}/cancel`, { body: { cancelledBy: 'PROVIDER', reasonText: 'El paciente avisó que no puede venir' } });
      expect(r.status).toBe(200);
      const despues = agendaDe(ana, proximos()).items.find((i) => i.id === cita.id)!;
      expect(despues.status).toBe('FREE');
      expect(despues.patientLabel).toBeUndefined();
    });

    it('Lucía no cancela: 403 con el mensaje genérico, que no dice por qué ni nombra nada', () => {
      const cita = citaFutura(lucia, MENDEZ.id, 'a-p1-105', 'CONFIRMED');
      const r = llamar<{ message: string }>(lucia, 'POST', `/scheduling/bookings/${cita.id}/cancel`, { body: { cancelledBy: 'PROVIDER', reasonText: 'No viene' } });
      expect(r.status).toBe(403);
      expect(r.body.message).toBe(SUPPORT_DENIED_MESSAGE);
    });
  });

  describe('reprogramar', () => {
    it('Ana mueve una cita a un horario libre del mismo servicio: el viejo queda libre y el nuevo, ocupado con la misma cita', () => {
      const cita = citaFutura(ana, PEREZ.id, 'a-p1-103', 'CONFIRMED');
      const destino = libreFuturo(ana, PEREZ.id, 'a-p1-103', 1);
      const r = llamar<{ toSlotId: string }>(ana, 'POST', `/scheduling/bookings/${cita.id}/reschedule`, { body: { toSlotId: destino.id, reasonText: 'El doctor tiene una cirugía ese día' } });
      expect(r.status).toBe(200);
      const items = agendaDe(ana, proximos()).items;
      expect(items.find((i) => i.id === cita.id)!.status).toBe('FREE');
      const nuevo = items.find((i) => i.id === destino.id)!;
      expect(nuevo.status).toBe('CONFIRMED');
      expect(nuevo.patientLabel).toBe(cita.patientLabel);
    });

    it('a otro servicio no: 422 con la razón', () => {
      const cita = citaFutura(ana, PEREZ.id, 'a-p2-201', 'CONFIRMED');
      const destino = libreFuturo(ana, PEREZ.id, 'a-p1-103', 1);
      const r = llamar<{ message: string }>(ana, 'POST', `/scheduling/bookings/${cita.id}/reschedule`, { body: { toSlotId: destino.id, reasonText: 'Cambio de servicio' } });
      expect(r.status).toBe(422);
      expect(r.body.message).toContain('mismo servicio');
    });

    it('sin motivo no se mueve nada: 422', () => {
      const cita = citaFutura(ana, PEREZ.id, 'a-p1-103', 'CONFIRMED');
      const destino = libreFuturo(ana, PEREZ.id, 'a-p1-103', 2);
      expect(llamar(ana, 'POST', `/scheduling/bookings/${cita.id}/reschedule`, { body: { toSlotId: destino.id, reasonText: '' } }).status).toBe(422);
    });

    it('a un horario pasado no: 422', () => {
      const cita = citaFutura(ana, PEREZ.id, 'a-p1-103', 'CONFIRMED');
      const pasado = agendaDePartida().find((f) => f.doctorId === PEREZ.id && f.careSpaceId === LOC['a-p1-103']!.id && f.status === 'FREE' && new Date(f.start).getTime() < Date.now())!;
      const r = llamar<{ message: string }>(ana, 'POST', `/scheduling/bookings/${cita.id}/reschedule`, { body: { toSlotId: pasado.id, reasonText: 'Para atrás' } });
      expect(r.status).toBe(422);
      expect(r.body.message).toBe('Ese horario ya pasó.');
      expect((r.body as unknown as { reason: string }).reason).toBe('RESCHEDULE_TARGET_NOT_FUTURE');
    });

    it('sobre una cita ocupada no: 422 con el motivo RESCHEDULE_TARGET_NOT_FREE', () => {
      const cita = citaFutura(ana, PEREZ.id, 'a-p1-103', 'CONFIRMED');
      const otra = agendaDe(ana, proximos()).items.find((i) => i.id !== cita.id && i.practitionerRoleAssignmentId === PEREZ.practitionerProfileId && i.careSpaceId === cita.careSpaceId && i.status === 'CONFIRMED' && new Date(i.start).getTime() > Date.now())!;
      const r = llamar<{ reason: string; details: { reason: string } }>(ana, 'POST', `/scheduling/bookings/${cita.id}/reschedule`, { body: { toSlotId: otra.id, reasonText: 'Pisar otra cita' } });
      expect(r.status).toBe(422);
      expect(r.body.reason).toBe('RESCHEDULE_TARGET_NOT_FREE');
      expect(r.body.details.reason).toBe('RESCHEDULE_TARGET_NOT_FREE');
    });

    it('Lucía no reprograma: 403', () => {
      const cita = citaFutura(lucia, MENDEZ.id, 'a-p1-105', 'CONFIRMED');
      const destino = libreFuturo(ana, PEREZ.id, 'a-p1-103', 3);
      expect(llamar(lucia, 'POST', `/scheduling/bookings/${cita.id}/reschedule`, { body: { toSlotId: destino.id, reasonText: 'Otro día' } }).status).toBe(403);
    });
  });

  describe('confirmar', () => {
    it('Ana confirma una cita reservada; otra ya confirmada no se vuelve a confirmar', () => {
      const reservada = citaFutura(ana, PEREZ.id, 'a-p1-103', 'BOOKED');
      expect(llamar(ana, 'POST', `/scheduling/bookings/${reservada.id}/accept`).status).toBe(200);
      expect(agendaDe(ana, proximos()).items.find((i) => i.id === reservada.id)!.status).toBe('CONFIRMED');
      expect(llamar(ana, 'POST', `/scheduling/bookings/${reservada.id}/accept`).status).toBe(422);
    });

    it('Marcos (call center) no confirma: su permiso no lo incluye', () => {
      const reservada = agendaDe(marcos, proximos()).items.find((i) => i.status === 'BOOKED' && i.allowedActions.includes('schedule.view'))!;
      expect(llamar(marcos, 'POST', `/scheduling/bookings/${reservada.id}/accept`).status).toBe(403);
    });
  });

  describe('atender sin cita y lista de espera', () => {
    it('Lucía atiende sin cita: la cita nace con la llegada registrada', () => {
      const lib = libreFuturo(lucia, MENDEZ.id, 'a-p1-105', 0);
      const paciente = patientList.todos()[0]!;
      const r = llamar(lucia, 'POST', '/scheduling/appointments/direct', {
        body: { patientProfileId: paciente.id, resourceId: lib.resourceId, startAt: lib.start, durationMinutes: 30, walkIn: true },
      });
      expect(r.status).toBe(201);
      // Atender sin cita deja la llegada registrada en el mismo gesto: la respuesta lo dice.
      expect((r.body as { checkedInAt?: string }).checkedInAt).toEqual(expect.any(String));
      expect(agendaDe(lucia, proximos()).items.find((i) => i.id === lib.id)!.status).toBe('CHECKED_IN');
    });

    it('Lucía no crea una cita común sobre el mismo servicio: 403 (caso 05)', () => {
      const lib = agendaDe(lucia, proximos()).items.find((i) => i.status === 'FREE' && i.allowedActions.includes('schedule.view'))!;
      const paciente = patientList.todos()[0]!;
      const r = llamar(lucia, 'POST', '/scheduling/appointments/direct', { body: { patientProfileId: paciente.id, resourceId: lib.resourceId, startAt: lib.start, durationMinutes: 30 } });
      expect(r.status).toBe(403);
    });

    it('Ana anota a alguien en la lista de espera: el horario muestra cuántos esperan y sobrevive a otra lectura', () => {
      const cita = citaFutura(ana, PEREZ.id, 'a-p1-103', 'CONFIRMED');
      const paciente = patientList.todos()[1]!;
      const r = llamar(ana, 'POST', '/scheduling/waitlist', { body: { tenantId: TENANT_HOSPITAL_PILOTO, patientProfileId: paciente.id, bookableSlotId: cita.id } });
      expect(r.status).toBe(201);
      expect(agendaDe(ana, proximos()).items.find((i) => i.id === cita.id)!.waitlistCount).toBe(1);
    });

    it('Marcos no maneja la lista de espera: su permiso no la incluye', () => {
      const libre = agendaDe(marcos, proximos()).items.find((i) => i.status === 'FREE' && i.allowedActions.includes('schedule.view'))!;
      expect(llamar(marcos, 'POST', '/scheduling/waitlist', { body: { patientProfileId: 'x', bookableSlotId: libre.id } }).status).toBe(403);
    });
  });

  describe('búsqueda exacta de pacientes', () => {
    beforeEach(reiniciarTopeDeBusquedas);
    const paciente = patientList.todos()[0]!;
    const buscar = (user: MockUser | null, body: unknown, org = TENANT_HOSPITAL_PILOTO) => llamar<SupportPatientSearchResult & { message?: string }>(user, 'POST', '/me/support-patient-search', { body: { org, ...(body as object) } });

    it('por documento completo: datos mínimos, nada en claro', () => {
      const r = buscar(ana, { document: paciente.nationalId });
      expect(r.status).toBe(200);
      expect(r.body.items).toHaveLength(1);
      const encontrado = r.body.items[0]!;
      expect(encontrado.profileId).toBe(paciente.id);
      expect(encontrado.documentMasked).toBe(`***${paciente.nationalId.slice(-3)}`);
      expect(JSON.stringify(r.body)).not.toContain(paciente.nationalId);
    });

    it('«Juan» se rechaza (caso 13) con 422 SUPPORT_PATIENT_SEARCH_INEXACT: ni documento, ni teléfono, ni nombre completo con nacimiento', () => {
      for (const parcial of [{ document: 'Juan' }, { phone: '7123' }, { fullName: 'Juan', birthDate: '1990-05-12' }, {}]) {
        const r = buscar(ana, parcial) as unknown as { status: number; body: { reason: string; details: { reason: string } } };
        expect(r.status, JSON.stringify(parcial)).toBe(422);
        expect(r.body.reason).toBe('SUPPORT_PATIENT_SEARCH_INEXACT');
        expect(r.body.details.reason).toBe('SUPPORT_PATIENT_SEARCH_INEXACT');
      }
    });

    it('la respuesta trae `count` y el perfil con los dos nombres (patientProfileId y profileId, el mismo valor)', () => {
      const r = buscar(ana, { nationalId: paciente.nationalId });
      expect(r.body.count).toBe(1);
      expect(r.body.items[0]).toMatchObject({ profileId: paciente.id, patientProfileId: paciente.id });
    });

    it('si un par llega con valores distintos: 400 SUPPORT_PATIENT_INPUT_CONFLICT; con el mismo valor, pasa', () => {
      const distinto = buscar(ana, { tenantId: TENANT_CESPEDES, document: paciente.nationalId }) as unknown as { status: number; body: { reason: string } };
      expect(distinto.status).toBe(400);
      expect(distinto.body.reason).toBe('SUPPORT_PATIENT_INPUT_CONFLICT');
      const documentos = buscar(ana, { nationalId: paciente.nationalId, document: '0000000' }) as unknown as { status: number; body: { reason: string } };
      expect(documentos.status).toBe(400);
      expect(documentos.body.reason).toBe('SUPPORT_PATIENT_INPUT_CONFLICT');
      expect(buscar(ana, { tenantId: TENANT_HOSPITAL_PILOTO, nationalId: paciente.nationalId, document: paciente.nationalId }).status).toBe(200);
    });

    it('pasado el tope de 20 por minuto: 429 SUPPORT_PATIENT_SEARCH_THROTTLED, y el alta cuenta en el mismo tope', () => {
      reiniciarTopeDeBusquedas();
      for (let i = 0; i < 20; i += 1) expect(buscar(ana, { nationalId: paciente.nationalId }).status).toBe(200);
      const r = buscar(ana, { nationalId: paciente.nationalId }) as unknown as { status: number; body: { code: string; reason: string } };
      expect(r.status).toBe(429);
      expect(r.body.code).toBe('RATE_LIMITED');
      expect(r.body.reason).toBe('SUPPORT_PATIENT_SEARCH_THROTTLED');
      // El tope es por persona: otra no lo siente.
      expect(buscar(lucia, { nationalId: paciente.nationalId }).status).toBe(200);
      reiniciarTopeDeBusquedas();
    });

    it('el 429 dice qué tope fue y de quién: `details.limit` (PER_MINUTE, PER_DAY) y `details.scope` (PERSON, IP)', () => {
      interface Frenado { status: number; body: { details: { limit: string; scope: string } } }
      reiniciarTopeDeBusquedas();
      for (let i = 0; i < 20; i += 1) buscar(ana, { nationalId: paciente.nationalId });
      const persona = buscar(ana, { nationalId: paciente.nationalId }) as unknown as Frenado;
      expect(persona.status).toBe(429);
      expect(persona.body.details).toMatchObject({ limit: 'PER_MINUTE', scope: 'PERSON' });
      reiniciarTopeDeBusquedas();
      agotarTopePorIp('PER_MINUTE');
      const ipMinuto = buscar(lucia, { nationalId: paciente.nationalId }) as unknown as Frenado;
      expect(ipMinuto.status).toBe(429);
      expect(ipMinuto.body.details).toMatchObject({ limit: 'PER_MINUTE', scope: 'IP' });
      reiniciarTopeDeBusquedas();
      agotarTopePorIp('PER_DAY');
      const ipDia = buscar(lucia, { nationalId: paciente.nationalId }) as unknown as Frenado;
      expect(ipDia.body.details).toMatchObject({ limit: 'PER_DAY', scope: 'IP' });
      reiniciarTopeDeBusquedas();
    });

    it('por teléfono completo, con o sin el 591', () => {
      const digitos = paciente.phone.replace(/\D/g, '');
      expect(buscar(ana, { phone: digitos.slice(-8) }).body.items.map((i) => i.profileId)).toContain(paciente.id);
      expect(buscar(ana, { phone: `591${digitos.slice(-8)}` }).body.items.map((i) => i.profileId)).toContain(paciente.id);
    });

    it('por nombre completo y fecha de nacimiento: con otra fecha no aparece', () => {
      expect(buscar(ana, { fullName: `${paciente.name} ${paciente.lastName}`, birthDate: paciente.birthDate }).body.items.map((i) => i.profileId)).toContain(paciente.id);
      expect(buscar(ana, { fullName: `${paciente.name} ${paciente.lastName}`, birthDate: '1901-01-01' }).body.items).toHaveLength(0);
    });

    it('un menor trae a sus representantes, o ninguno si no los tiene registrados', () => {
      const menor = patientList.todos().find((p) => p.displayName === 'Martín Rocha Antelo')!;
      const r = buscar(ana, { document: menor.nationalId });
      expect(r.body.items[0]).toMatchObject({ isMinor: true });
      expect(r.body.items[0]!.representatives!.map((x) => x.relationship)).toEqual(['Madre', 'Padre']);
      const sinRep = patientList.todos().find((p) => p.displayName.startsWith('Sebastián Rivero'))!;
      expect(buscar(ana, { document: sinRep.nationalId }).body.items[0]!.representatives).toEqual([]);
    });

    it('sin vínculo con esa organización, no busca: 403 (caso 11)', () => {
      expect(buscar(rosa, { document: paciente.nationalId }).status).toBe(403);
      expect(buscar(null, { document: paciente.nationalId }).status).toBe(403);
    });
  });

  describe('registro rápido de pacientes', () => {
    beforeEach(reiniciarTopeDeBusquedas);
    const registrar = (user: MockUser, body: unknown, org = TENANT_HOSPITAL_PILOTO) =>
      llamar<SupportPatientRegistration & { message?: string }>(user, 'POST', '/me/support-patients', { body: { org, ...(body as object) } });
    const nuevo = { name: 'Tomás', lastName: 'Zambrana', motherLastName: 'Peña', document: '9100001', birthDate: '1985-04-02', phone: '71230001', inviteToPortal: true };

    it('Ana registra a un paciente nuevo; después aparece en la búsqueda exacta', () => {
      const r = registrar(ana, nuevo);
      expect(r.status).toBe(201);
      // `invitationSent: true` solo quiere decir que la invitación quedó encolada.
      expect(r.body).toMatchObject({ outcome: 'CREATED', invitationSent: true });
      const hallado = llamar<SupportPatientSearchResult>(ana, 'POST', '/me/support-patient-search', { body: { org: TENANT_HOSPITAL_PILOTO, document: '9100001' } });
      expect(hallado.body.items[0]!.displayName).toBe('Tomás Zambrana Peña');
    });

    it('el mismo documento no se registra dos veces: 409 SUPPORT_PATIENT_DOCUMENT_REGISTERED, también si se insiste con acknowledgeDuplicates', () => {
      for (const extra of [{}, { acknowledgeDuplicates: true }]) {
        const r = registrar(ana, { ...nuevo, ...extra }) as unknown as { status: number; body: { reason: string } };
        expect(r.status).toBe(409);
        expect(r.body.reason).toBe('SUPPORT_PATIENT_DOCUMENT_REGISTERED');
      }
    });

    it('un nombre y nacimiento parecidos avisan de posible duplicado y NO crean; si se insiste, crea', () => {
      const parecido = { ...nuevo, document: '9100002', phone: '71230002' };
      const aviso = registrar(ana, parecido);
      expect(aviso.status).toBe(200);
      expect(aviso.body.outcome).toBe('POSSIBLE_DUPLICATES');
      // Lo registró alguien de esta organización: viene completo y se puede usar («Es esta persona»).
      const propio = (aviso.body as unknown as { duplicates: { linkedToOrganization: boolean; profileId?: string; displayName: string; matchedBy: string[] }[] }).duplicates[0]!;
      expect(propio).toMatchObject({ linkedToOrganization: true, displayName: 'Tomás Zambrana Peña' });
      expect(propio.profileId).toBeDefined();
      expect(propio.matchedBy).toContain('NAME_AND_BIRTH_DATE');
      expect(patientList.todos().some((p) => p.nationalId === '9100002')).toBe(false);
      const insistido = registrar(ana, { ...parecido, acknowledgeDuplicates: true });
      expect(insistido.status).toBe(201);
    });

    it('un posible duplicado de OTRA organización viene sin perfil, nombre ni edad ajenos: solo linkedToOrganization:false y matchedBy', () => {
      const ajeno = patientList.todos().find((p) => !agendaDePartida().some((f) => (f.patientLabel ?? '').startsWith(p.displayName)) && p.nationalId !== '9100001')!;
      const aviso = registrar(ana, { ...nuevo, name: ajeno.name, lastName: ajeno.lastName, motherLastName: ajeno.motherLastName, document: '9100077', phone: '71239977', birthDate: ajeno.birthDate });
      expect(aviso.status).toBe(200);
      const [d] = (aviso.body as unknown as { duplicates: Record<string, unknown>[] }).duplicates;
      expect(d).toMatchObject({ linkedToOrganization: false, displayName: 'Persona registrada en otra organización' });
      expect(d!['matchedBy']).toEqual(expect.arrayContaining(['NAME_AND_BIRTH_DATE']));
      for (const campo of ['profileId', 'patientProfileId', 'representatives', 'phoneMasked']) expect(d).not.toHaveProperty(campo);
      // Lo que sale es lo que quien registra escribió: ni el nombre ni el documento del registro ajeno.
      expect(JSON.stringify(d)).not.toContain(ajeno.displayName);
      expect(JSON.stringify(d)).not.toContain(ajeno.nationalId);
    });

    it('un menor sin representante no se registra: 422 SUPPORT_PATIENT_GUARDIAN_REQUIRED', () => {
      const anioPasado = new Date().getFullYear() - 6;
      const r = registrar(ana, { ...nuevo, name: 'Pequeño', document: '9100003', phone: '71230003', birthDate: `${anioPasado}-02-02` }) as unknown as { status: number; body: { reason: string; message: string } };
      expect(r.status).toBe(422);
      expect(r.body.reason).toBe('SUPPORT_PATIENT_GUARDIAN_REQUIRED');
      expect(r.body.message).toContain('representante');
      const conRep = registrar(ana, { ...nuevo, name: 'Pequeño', document: '9100003', phone: '71230003', birthDate: `${anioPasado}-02-02`, guardian: { name: 'Marta Zambrana', document: '4000009', phone: '71230004', relationship: 'Madre' } });
      expect(conRep.status).toBe(201);
      expect((conRep.body as unknown as { patient: { representatives: unknown[] } }).patient.representatives).toHaveLength(1);
      // El mostrador no crea representaciones legales: el representante queda pendiente de verificación y `guardianLink` ya no existe.
      expect(conRep.body).toMatchObject({ outcome: 'CREATED', identityVerified: false, guardian: { recorded: true, status: 'PENDING_VERIFICATION' } });
      expect(conRep.body).not.toHaveProperty('guardianLink');
      // Un adulto no trae representante, pero también nace sin identidad verificada.
      const adulta = registrar(lucia, { ...nuevo, document: '9100008', phone: '71230008', name: 'Adulta', lastName: 'Cualquiera' }).body;
      expect(adulta).toMatchObject({ outcome: 'CREATED', identityVerified: false });
      expect(adulta).not.toHaveProperty('guardian');
      expect(adulta).not.toHaveProperty('guardianLink');
    });

    it('un representante sin teléfono o sin parentesco tampoco pasa: la API exige los cuatro datos', () => {
      const anioPasado = new Date().getFullYear() - 6;
      const menor = { ...nuevo, name: 'Pequeño', document: '9100013', phone: '71230013', birthDate: `${anioPasado}-02-02` };
      expect(registrar(ana, { ...menor, guardian: { name: 'Marta Zambrana', document: '4000009', phone: '', relationship: 'Madre' } }).status).toBe(422);
      expect(registrar(ana, { ...menor, guardian: { name: 'Marta Zambrana', document: '4000009', phone: '71230004', relationship: '' } }).status).toBe(422);
    });

    it('un documento sin contenido (menos de 4 caracteres canónicos) es 400 con el campo', () => {
      const sinContenido = registrar(ana, { ...nuevo, document: '000000', phone: '71230014', name: 'Sin', lastName: 'Contenido' }) as unknown as { status: number; body: { details: { field: string } } };
      expect(sinContenido.status).toBe(400);
      expect(sinContenido.body.details.field).toBe('document');
    });

    it('el documento ya registrado vale también para sus variantes: «0.9100.015» y «9100015»', () => {
      expect(registrar(ana, { ...nuevo, document: '9100015', phone: '71230015', name: 'Primera', lastName: 'Vez' }).status).toBe(201);
      const variante = registrar(ana, { ...nuevo, document: '0.9100-015', phone: '71230016', name: 'Segunda', lastName: 'Vez', acknowledgeDuplicates: true }) as unknown as { status: number; body: { reason: string } };
      expect(variante.status).toBe(409);
      expect(variante.body.reason).toBe('SUPPORT_PATIENT_DOCUMENT_REGISTERED');
    });

    it('Marcos no tiene «Registrar pacientes nuevos»: 403; Lucía sí lo tiene', () => {
      expect(registrar(marcos, { ...nuevo, document: '9100005', phone: '71230005', name: 'Otro' }).status).toBe(403);
      expect(registrar(lucia, { ...nuevo, document: '9100006', phone: '71230006', name: 'Otra', lastName: 'Distinta' }).status).toBe(201);
    });
  });

  describe('una persona en dos organizaciones (Elena)', () => {
    it('sus vínculos son dos, uno por organización', () => {
      const { items: engagements } = llamar<{ items: { tenantId: string }[] }>(elena, 'GET', '/me/support-engagements').body;
      expect(engagements.map((e) => e.tenantId).sort()).toEqual([TENANT_CESPEDES, TENANT_HOSPITAL_PILOTO].sort());
    });

    it('en cada organización ve solo a sus doctores, y no se cruzan', () => {
      const hospital = agendaDe(elena, semana(), TENANT_HOSPITAL_PILOTO);
      const consultorio = agendaDe(elena, semana(), TENANT_CESPEDES);
      expect(hospital.doctors.map((d) => d.id)).toEqual([PEREZ.practitionerProfileId]);
      expect(consultorio.doctors.map((d) => d.name)).toEqual(['Dra. Paola Céspedes']);
      expect(hospital.items.some((i) => i.careSpaceName.includes('principal'))).toBe(false);
    });
  });
});
