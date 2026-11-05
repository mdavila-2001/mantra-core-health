import { HttpHeaders } from '@angular/common/http';

import type { SupportEngagementPage } from '../../data-access/support-access/support-access.types';
import type { WireSupportAgenda, WireSupportFreeSlots } from '../../data-access/support-access/support-agenda.wire';
import { agendaVista } from './support-access.agenda-view';
import { PEREZ, permisos, VINCULO_ANA, vinculos } from '../fixtures/support-hospital';
import { VINCULOS_PARA_REVISION } from '../fixtures/support-hospital-review';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_HOSPITAL_PILOTO, type MockUser } from '../mock-session';
import { crearRouterSimulado } from './index';
import { reiniciarLaSesionDelSimulador } from './mock-reset';

/**
 * La agenda de apoyo como la deja la API: `bookingId` y `healthcareServiceId` salen **solo** con `schedule.view`; una cita sin
 * ninguna acción `schedule.*` permitida no sale ni como bloque; y con el vínculo vivo pero sin ningún permiso de agenda la lista
 * llega **vacía** (200), no 403. Sin vínculo vigente, sí 403.
 */
let router: MockRouter;
const org = buscarUsuario('hospital_piloto')!;
const ana = buscarUsuario('ana')!;
const mariela = buscarUsuario('mariela')!;
const silvia = buscarUsuario('silvia')!;

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}

function llamar<T = unknown>(user: MockUser | null, method: MockMethod, path: string, body?: unknown, tenant?: string): Respuesta<T> {
  const [ruta, cadena] = path.split('?');
  const match = router.match(method, ruta!);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({
    method,
    path: ruta!,
    params: match.params,
    query: new URLSearchParams(cadena ?? ''),
    body: body ?? null,
    headers: new HttpHeaders(tenant === undefined ? {} : { 'X-Tenant-Id': tenant }),
    user,
  });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}

const RANGO = `from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 14 * 86_400_000).toISOString())}`;
/** Lo que contesta la API: solo citas, con la forma de `SupportAgendaResponseDto`. */
const agendaDe = (user: MockUser): Respuesta<WireSupportAgenda> => llamar<WireSupportAgenda>(user, 'GET', `/me/support-agenda?org=${TENANT_HOSPITAL_PILOTO}&${RANGO}`);
/** Lo mismo, como lo ve la pantalla (con los horarios libres del simulador). */
const agendaDeLaPantalla = (user: MockUser) =>
  agendaVista(agendaDe(user).body, llamar<WireSupportFreeSlots>(user, 'GET', `/me/support-agenda/free-slots?org=${TENANT_HOSPITAL_PILOTO}&${RANGO}`).body);

/** Cómo estaban los vínculos y los permisos al empezar: este archivo los mueve y los deja como estaban para los demás. */
let respaldo: { readonly permisos: ReturnType<typeof permisos.todos>; readonly vinculos: ReturnType<typeof vinculos.todos> };

beforeAll(() => {
  reiniciarLaSesionDelSimulador();
  router = crearRouterSimulado();
  respaldo = { permisos: permisos.todos(), vinculos: vinculos.todos() };
});

afterAll(() => {
  for (const p of permisos.todos()) if (!respaldo.permisos.some((r) => r.id === p.id)) permisos.borrar(p.id);
  for (const p of respaldo.permisos) permisos.agregar(p);
  for (const v of respaldo.vinculos) vinculos.agregar(v);
  // Y las dos personas que este archivo mueve vuelven a como las trae el simulador de fábrica (Ana viva, Silvia suspendida).
  vinculos.agregar(VINCULO_ANA);
  for (const v of VINCULOS_PARA_REVISION.filter((x) => x.userId === silvia.id)) vinculos.agregar(v);
});

/** Parte siempre del mismo punto: Mariela con el vínculo vivo y SIN permisos, y Silvia suspendida (otros specs mueven las colecciones). */
beforeEach(() => {
  for (const v of vinculos.filtrar((x) => x.userId === mariela.id)) {
    vinculos.actualizar(v.id, { status: 'ACTIVE' });
    for (const p of permisos.filtrar((x) => x.engagementId === v.id)) permisos.actualizar(p.id, { status: 'REVOKED' });
  }
  for (const v of vinculos.filtrar((x) => x.userId === silvia.id)) vinculos.actualizar(v.id, { status: 'SUSPENDED' });
  for (const v of vinculos.filtrar((x) => x.userId === ana.id)) vinculos.actualizar(v.id, { status: 'ACTIVE' });
});

describe('agenda: lo que sale sin schedule.view (con la forma de la API)', () => {
  const darPermisos = (acciones: readonly string[]): void => {
    const vinculo = llamar<SupportEngagementPage>(org, 'GET', '/org/support-engagements', undefined, TENANT_HOSPITAL_PILOTO).body.items.find((e) => e.personName === 'Mariela Soliz')!;
    const grant = llamar(org, 'POST', `/org/support-engagements/${vinculo.id}/grants`, { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: PEREZ.id, expansionMode: 'DYNAMIC', actions: acciones }, TENANT_HOSPITAL_PILOTO);
    expect(grant.status).toBe(201);
  };

  it('Mariela tiene vínculo vivo pero ningún permiso de agenda: la lista llega VACÍA (200), no 403', () => {
    const r = agendaDe(mariela);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ doctors: [], services: [], locations: [], items: [] });
  });

  it('un vínculo suspendido sigue siendo 403 con el mensaje genérico', () => {
    expect(agendaDe(silvia).status).toBe(403);
  });

  it('la respuesta no trae horarios libres: la API solo da citas, con un concepto de estado y el doctor por su perfil profesional', () => {
    darPermisos(['schedule.view', 'schedule.check_in']);
    const { items } = agendaDe(mariela).body;
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(typeof i.statusConceptId).toBe('string');
      expect(i).not.toHaveProperty('status');
      expect(i).not.toHaveProperty('kind');
      expect(i.practitionerProfileId).toBe(PEREZ.practitionerProfileId);
      expect(typeof i.startAt).toBe('string');
    }
  });

  it('con «Registrar la llegada» sin «Ver agenda», la cita sale como bloque: sin bookingId, servicio, paciente ni motivo', () => {
    darPermisos(['schedule.check_in']);
    const { items, doctors, services } = agendaDe(mariela).body;
    expect(items.length).toBeGreaterThan(0);
    for (const b of items) {
      expect(b.allowedActions).toEqual(['schedule.check_in']);
      for (const campo of ['bookingId', 'healthcareServiceId', 'patientProfileId', 'patientName', 'waitlistCount']) expect(b).not.toHaveProperty(campo);
      expect(b.denialReason).toBeDefined();
    }
    // Las opciones de filtro salen solo de lo que se VE: sin ver, no hay doctores ni servicios que ofrecer.
    expect(doctors).toEqual([]);
    expect(services).toEqual([]);
    // Y nada de otros doctores: sin ninguna acción de agenda sobre ellos, ni como bloque.
    expect(items.every((i) => i.practitionerProfileId === PEREZ.practitionerProfileId)).toBe(true);
    // La pantalla les pone una clave local y estable que no se parece a una cita.
    const vista = agendaDeLaPantalla(mariela).items.filter((i) => i.status !== 'FREE');
    expect(vista.every((i) => i.id.startsWith('bloque:') && i.bookingId === undefined && i.serviceName === '')).toBe(true);
  });

  it('quien sí ve «Ver agenda» recibe bookingId, servicio y paciente, y las opciones de filtro de lo que ve', () => {
    darPermisos(['schedule.view', 'schedule.check_in']);
    const { items, doctors, services, locations } = agendaDe(mariela).body;
    for (const c of items) {
      expect(typeof c.bookingId).toBe('string');
      expect(c.healthcareServiceId).toBeDefined();
      expect(c.patientName).toBeDefined();
    }
    expect(doctors).toEqual([{ practitionerProfileId: PEREZ.practitionerProfileId, displayName: PEREZ.name }]);
    expect(services.length).toBeGreaterThan(0);
    expect(locations.length).toBeGreaterThan(0);
    for (const l of locations) expect(Object.keys(l).sort()).toEqual(['code', 'id', 'name']);
  });

  it('una cita sin ninguna acción de agenda no sale: ninguna fila con allowedActions sin acciones de agenda', () => {
    darPermisos(['schedule.view']);
    expect(agendaDe(mariela).body.items.every((i) => i.allowedActions.some((a) => a.startsWith('schedule.')))).toBe(true);
  });

  it('los horarios libres son del simulador (la API no los da) y siguen el permiso de crear', () => {
    darPermisos(['schedule.view', 'schedule.create']);
    const libres = llamar<WireSupportFreeSlots>(mariela, 'GET', `/me/support-agenda/free-slots?org=${TENANT_HOSPITAL_PILOTO}&${RANGO}`).body;
    expect(libres.items.length).toBeGreaterThan(0);
    for (const l of libres.items) expect(typeof l.slotId).toBe('string');
  });
});
