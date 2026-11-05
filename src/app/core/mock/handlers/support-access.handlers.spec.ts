import { HttpHeaders } from '@angular/common/http';

import type {
  DoctorTeam,
  MySupportEngagements,
  SupportAgenda,
  SupportAgendaItem,
  SupportEngagementPage,
  SupportEngagementRequest,
  SupportRequestPage,
} from '../../data-access/support-access/support-access.types';
import type { WireSupportAgenda, WireSupportFreeSlots } from '../../data-access/support-access/support-agenda.wire';
import { patientList } from '../fixtures/people';
import { ANTELO, DOC, FLORES, LOC, MENDEZ, PEREZ, ROJAS, SUAREZ, VACA } from '../fixtures/support-hospital';
import { agendaDePartida } from '../fixtures/support-hospital-agenda';
import { PRACTICE_CM_NORTE } from '../fixtures/role-assignments';
import { perfilDeChatDe } from '../fixtures/support-hospital-inbox';
import { crearRouterSimulado } from './index';
import { agendaVista, perfilDelDoctor } from './support-access.agenda-view';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_CESPEDES, TENANT_HOSPITAL_PILOTO, type MockUser } from '../mock-session';

/**
 * El hospital piloto contra el simulador: los trece casos del contrato y los
 * recorridos que las pantallas dan por hechos (aprobación parcial, aceptación
 * del doctor, fin de vínculo).
 *
 * El estado vive en `Coleccion`es del módulo, así que las pruebas **se leen en
 * orden**: cada una parte de lo que dejó la anterior, como una persona
 * recorriendo la maqueta. Por eso el orden importa y no se baraja.
 */
let router: MockRouter;
/** Inicio y fin del día local, como ISO. */
function dayRange(day: Date): { from: string; to: string } {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(day);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

const org = buscarUsuario('hospital_piloto')!;
const ana = buscarUsuario('ana')!;
const lucia = buscarUsuario('lucia')!;
const marcos = buscarUsuario('marcos')!;
const rosa = buscarUsuario('rosa')!;
const perez = buscarUsuario('perez')!;
const suarez = buscarUsuario('suarez')!;

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}

function llamar<T = unknown>(
  user: MockUser | null,
  method: MockMethod,
  path: string,
  opciones: { body?: unknown; query?: Record<string, string>; tenant?: string } = {},
): Respuesta<T> {
  const [ruta, cadena] = path.split('?');
  const query = new URLSearchParams(cadena ?? '');
  for (const [k, v] of Object.entries(opciones.query ?? {})) query.set(k, v);
  const match = router.match(method, ruta!);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({
    method,
    path: ruta!,
    params: match.params,
    query,
    body: opciones.body ?? null,
    headers: new HttpHeaders(opciones.tenant === undefined ? {} : { 'X-Tenant-Id': opciones.tenant }),
    user,
  });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}

const comoOrg = <T = unknown>(method: MockMethod, path: string, body?: unknown) =>
  llamar<T>(org, method, path, { ...(body === undefined ? {} : { body }), tenant: TENANT_HOSPITAL_PILOTO });

function agendaDe(user: MockUser, tenant = TENANT_HOSPITAL_PILOTO): Respuesta<SupportAgenda> {
  const { from, to } = dayRange(new Date());
  const query = { tenantId: tenant, from, to };
  const real = llamar<WireSupportAgenda>(user, 'GET', '/me/support-agenda', { query });
  if (real.status !== 200) return real as unknown as Respuesta<SupportAgenda>;
  const libres = llamar<WireSupportFreeSlots>(user, 'GET', '/me/support-agenda/free-slots', { query });
  return { status: 200, body: agendaVista(real.body, libres.body) };
}

function horario(
  agenda: SupportAgenda,
  doctorId: string,
  espacio: string,
  estado: SupportAgendaItem['status'],
): SupportAgendaItem {
  const item = agenda.items.find(
    (i) => i.practitionerRoleAssignmentId === perfilDelDoctor(doctorId) && i.careSpaceId === LOC[espacio]!.id && i.status === estado,
  );
  if (item === undefined) throw new Error(`No hay un horario ${estado} de ${doctorId} en ${espacio}`);
  return item;
}

const paciente = patientList.todos()[0]!;

/** Crear una cita como lo hace la pantalla: retener y confirmar. */
function crearCita(user: MockUser, item: SupportAgendaItem): Respuesta {
  const hold = llamar<{ holdToken: string }>(user, 'POST', `/scheduling/slots/${item.id}/holds`, { body: { patientProfileId: paciente.id } });
  if (hold.status >= 400) return hold;
  return llamar(user, 'POST', `/scheduling/holds/${hold.body.holdToken}/confirm`, {
    body: { tenantId: TENANT_HOSPITAL_PILOTO, patientProfileId: paciente.id, channel: 'DESK', reasonText: 'Control' },
  });
}

function llegada(user: MockUser, item: SupportAgendaItem): Respuesta {
  return llamar(user, 'POST', `/scheduling/bookings/${item.id}/check-in`);
}

describe('hospital piloto en el simulador', () => {
  beforeAll(() => {
    router = crearRouterSimulado();
  });

  describe('los casos del contrato', () => {
    it('01 · Ana crea una cita con Pérez en consulta (Edificio A, piso 1): permitido', () => {
      const libre = horario(agendaDe(ana).body, PEREZ.id, 'a-p1-103', 'FREE');
      expect(libre.allowedActions).toContain('schedule.create');

      expect(crearCita(ana, libre).status).toBe(201);

      // Persistió: el horario ya no está libre y trae el paciente.
      const despues = agendaDe(ana).body.items.find((i) => i.id === libre.id)!;
      expect(despues.status).toBe('CONFIRMED');
      expect(despues.patientLabel).toContain(paciente.displayName);
    });

    it('02 · Ana agenda un ecocardiograma con Pérez (piso 2): permitido', () => {
      const libre = horario(agendaDe(ana).body, PEREZ.id, 'a-p2-201', 'FREE');
      expect(libre.serviceName).toBe('Ecocardiograma');
      expect(crearCita(ana, libre).status).toBe(201);
    });

    it('03 · Lucía registra la llegada de un paciente de Méndez en el consultorio 105: permitido', () => {
      const cita = horario(agendaDe(lucia).body, MENDEZ.id, 'a-p1-105', 'CONFIRMED');
      expect(cita.allowedActions).toContain('schedule.check_in');

      expect(llegada(lucia, cita).status).toBe(200);
      expect(agendaDe(lucia).body.items.find((i) => i.id === cita.id)!.status).toBe('CHECKED_IN');
    });

    it('04 · Lucía no registra la llegada en el piso 4: la cita ni siquiera sale (sin ninguna acción de agenda no hay ni bloque) y la API lo niega', () => {
      const agenda = agendaDe(lucia).body;
      expect(agenda.items.some((i) => i.practitionerRoleAssignmentId === MENDEZ.practitionerProfileId && i.careSpaceId === LOC['a-p4-401']!.id)).toBe(false);
      const fila = agendaDePartida().find((f) => f.doctorId === MENDEZ.id && f.careSpaceId === LOC['a-p4-401']!.id && f.status === 'CONFIRMED')!;
      const r = llamar<{ message: string }>(lucia, 'POST', `/scheduling/bookings/${fila.id}/check-in`);
      expect(r.status).toBe(403);
      expect(r.body.message).toBe('Su vínculo de apoyo no le permite esta acción.');
    });

    it('05 · Lucía no crea citas con Pérez en el piso 1: la acción no existe y la API lo niega', () => {
      const libre = horario(agendaDe(lucia).body, PEREZ.id, 'a-p1-103', 'FREE');

      expect(libre.allowedActions).not.toContain('schedule.create');
      const r = crearCita(lucia, libre);
      expect(r.status).toBe(403);
      expect((r.body as { message: string }).message).toBe('Su vínculo de apoyo no le permite esta acción.');
    });

    it('06 · Marcos agenda una ecografía con Antelo en la sala 201: permitido', () => {
      const libre = horario(agendaDe(marcos).body, ANTELO.id, 'a-p2-201', 'FREE');
      expect(crearCita(marcos, libre).status).toBe(201);
    });

    it('07 · Marcos no agenda una eco obstétrica con Rojas en B204: negado', () => {
      const agenda = agendaDe(marcos).body;
      // Rojas ni siquiera figura en «Mis doctores» de Marcos: ningún permiso suyo la alcanza.
      expect(agenda.doctors.some((d) => d.id === ROJAS.id)).toBe(false);
      const ruta = llamar(marcos, 'POST', `/scheduling/slots/${horarioDe(ROJAS.id, 'b-p2-b204')}/holds`, { body: {} });
      expect(ruta.status).toBe(403);
    });

    it('08 · Marcos atiende a Suárez en la Sede Norte pero no en el Edificio B', () => {
      const agenda = agendaDe(marcos).body;
      const norte = horario(agenda, SUAREZ.id, 'n-p1-n102', 'FREE');
      // El Edificio B no es suyo: sin ninguna acción de agenda, sus horarios no salen ni como bloque.
      expect(agenda.items.some((i) => i.practitionerRoleAssignmentId === SUAREZ.practitionerProfileId && i.careSpaceId === LOC['b-p1-b102']!.id)).toBe(false);

      expect(norte.allowedActions).toContain('schedule.create');
      expect(crearCita(marcos, norte).status).toBe(201);
      expect(llamar(marcos, 'POST', `/scheduling/slots/${horarioDe(SUAREZ.id, 'b-p1-b102')}/holds`, { body: { patientProfileId: paciente.id } }).status).toBe(403);
    });

    it('09 · responder en nombre del doctor exige su aceptación: Pérez autorizó a Ana, Rojas no', () => {
      const conRojas = llamar(ana, 'POST', '/community/conversations/c-1/messages', {
        body: { senderProfileId: 'x', bodyText: 'Hola', onBehalfOfProfileId: perfilDeChatDe(ROJAS) },
      });
      expect(conRojas.status).toBe(403);
      expect(JSON.stringify(conRojas.body)).toContain('todavía no le autorizó');

      // Con Pérez la autorización pasa; la conversación de prueba no existe, así que la ruta original contesta 404, no 403.
      const conPerez = llamar(ana, 'POST', '/community/conversations/c-inexistente/messages', {
        body: { senderProfileId: 'x', bodyText: 'Hola', onBehalfOfProfileId: perfilDeChatDe(PEREZ) },
      });
      expect(conPerez.status).toBe(404);

      // El remitente es el perfil PÚBLICO: con el profesional del doctor, quien manda no es participante y se rechaza.
      const conElProfesional = llamar(ana, 'POST', '/community/conversations/c-inexistente/messages', {
        body: { senderProfileId: PEREZ.practitionerProfileId, bodyText: 'Hola', onBehalfOfProfileId: PEREZ.practitionerProfileId },
      });
      expect(conElProfesional.status).toBe(403);
    });

    it('10 · Ana pide acceso clínico temporal y quien decide es el doctor', () => {
      const equipo = llamar<DoctorTeam>(perez, 'GET', '/me/practitioner/support-team').body;
      const miembro = equipo.items.find((m) => m.personName === 'Ana Gutiérrez')!;
      expect(miembro.pendingClinicalRequests).toHaveLength(1);
      const pedido = miembro.pendingClinicalRequests[0]!;

      // Ni la organización ni Ana deciden.
      expect(llamar(org, 'POST', `/access-requests/${pedido.requestId}/decision`, { body: { decision: 'APPROVED' } }).status).toBe(403);
      expect(llamar(ana, 'POST', `/access-requests/${pedido.requestId}/decision`, { body: { decision: 'APPROVED' } }).status).toBe(403);

      expect(llamar(perez, 'POST', `/access-requests/${pedido.requestId}/decision`, { body: { decision: 'APPROVED', validTo: '2026-11-01T00:00:00Z' } }).status).toBe(200);
      const despues = llamar<DoctorTeam>(perez, 'GET', '/me/practitioner/support-team').body;
      expect(despues.items.find((m) => m.personName === 'Ana Gutiérrez')!.pendingClinicalRequests).toEqual([]);
    });

    it('11 · Rosa no ve la agenda de Céspedes en el hospital piloto: negado; en su consultorio sí', () => {
      expect(agendaDe(rosa, TENANT_HOSPITAL_PILOTO).status).toBe(403);
      const propia = agendaDe(rosa, TENANT_CESPEDES);
      expect(propia.status).toBe(200);
      expect(propia.body.doctors.map((d) => d.name)).toEqual(['Dra. Paola Céspedes']);
      // Y su lista de vínculos no menciona al hospital.
      const mios = llamar<{ items: { organizationName: string; ownerKind: string }[] }>(rosa, 'GET', '/me/support-engagements').body;
      expect(mios.items.map((e) => e.organizationName)).toEqual(['Consultorio Dra. Paola Céspedes']);
      expect(mios.items[0]!.ownerKind).toBe('PRIVATE_PRACTICE');
    });

    it('13 · Ana busca «Juan»: negado, la búsqueda es exacta; con el documento completo sí pasa', () => {
      const parcial = llamar(ana, 'POST', '/profiles/patients/search', { body: { query: 'Juan' } });
      expect(parcial.status).toBe(400);
      expect(JSON.stringify(parcial.body)).toContain('exacta');

      const exacta = llamar(ana, 'POST', '/profiles/patients/search', { body: { nationalId: paciente.nationalId } });
      expect(exacta.status).toBe(200);

      // Un doctor no tiene esa restricción.
      expect(llamar(perez, 'POST', '/profiles/patients/search', { body: { query: 'Juan' } }).status).toBe(200);
    });
  });

  describe('la organización', () => {
    it('solo la cuenta de la organización administra: Ana recibe 403, Rosa también', () => {
      expect(llamar(ana, 'GET', '/org/support-engagements', { tenant: TENANT_HOSPITAL_PILOTO }).status).toBe(403);
      expect(llamar(rosa, 'GET', '/org/support-engagements', { tenant: TENANT_CESPEDES }).status).toBe(403);
      expect(comoOrg('GET', '/org/support-engagements').status).toBe(200);
    });

    it('lista a las cuatro personas del contrato con su rol y su alcance', () => {
      const { items } = comoOrg<SupportEngagementPage>('GET', '/org/support-engagements').body;
      const porNombre = Object.fromEntries(items.map((e) => [e.personName, e]));

      // Las tres del contrato más las que la revisión periódica necesita (por vencer, vencido, suspendido).
      expect(Object.keys(porNombre)).toEqual(expect.arrayContaining(['Ana Gutiérrez', 'Lucía Paz', 'Marcos Ribera', 'Gabriel Rojas', 'Pedro Camacho', 'Silvia Soria']));
      // Por la red va el nombre de la API (`roleTemplateCode`); el cliente lo traduce.
      const codigo = (nombre: string): string => (porNombre[nombre] as unknown as { roleTemplateCode: string }).roleTemplateCode;
      expect(codigo('Ana Gutiérrez')).toBe('SECRETARY');
      expect(codigo('Lucía Paz')).toBe('FRONT_DESK');
      expect(codigo('Marcos Ribera')).toBe('CALL_CENTER');
      expect(porNombre['Marcos Ribera']!.grants.map((g) => g.targetKind).sort()).toEqual(['PRACTITIONER_LOCATION', 'SERVICE']);
    });

    it('la aprobación parcial de la solicitud de Ana: aprueba con ajustes a Suárez y rechaza a Vaca', () => {
      const pendientes = comoOrg<SupportRequestPage>('GET', '/org/support-engagement-requests?status=PENDING').body.items;
      expect(pendientes.map((r) => r.requesterName)).toEqual(expect.arrayContaining(['Ana Gutiérrez', 'Julia Mamani', 'Rocío Vargas', 'Sofía Aguilar']));
      // La que ya pasó su plazo no está entre las pendientes: se barrió a «vencida».
      expect(pendientes.map((r) => r.requesterName)).not.toContain('Luis Terán');
      const solicitud = pendientes.find((r) => r.requesterName === 'Ana Gutiérrez')!;
      const itemSuarez = solicitud.items.find((i) => i.practitionerRoleAssignmentId === SUAREZ.id)!;
      const itemVaca = solicitud.items.find((i) => i.practitionerRoleAssignmentId === VACA.id)!;

      // Sin decidir todos los ítems, no se guarda nada.
      expect(comoOrg('POST', `/org/support-engagement-requests/${solicitud.id}/decision`, { items: [{ itemId: itemSuarez.id, decision: 'APPROVED' }] }).status).toBe(400);
      // Rechazar exige motivo.
      expect(
        comoOrg('POST', `/org/support-engagement-requests/${solicitud.id}/decision`, {
          items: [{ itemId: itemSuarez.id, decision: 'APPROVED' }, { itemId: itemVaca.id, decision: 'REJECTED' }],
        }).status,
      ).toBe(400);

      const r = comoOrg<{ status: string; requestId: string; grantIds: string[] }>('POST', `/org/support-engagement-requests/${solicitud.id}/decision`, {
        items: [
          { itemId: itemSuarez.id, decision: 'ADJUSTED', actions: ['schedule.view', 'schedule.create', 'schedule.check_in'] },
          { itemId: itemVaca.id, decision: 'REJECTED', comment: 'Cubre traumatología otra persona.' },
        ],
      });

      expect(r.status).toBe(200);
      // La API responde cómo quedó la decisión, no la solicitud.
      expect(r.body.status).toBe('PARTIAL');
      expect(r.body.requestId).toBe(solicitud.id);
      expect(r.body.grantIds).toHaveLength(1);
      expect(r.body).not.toHaveProperty('items');
      const resuelta = comoOrg<{ items: { id: string; items: { decision: string }[] }[] }>('GET', '/org/support-engagement-requests').body.items.find((x) => x.id === solicitud.id)!;
      expect(resuelta.items.map((i) => i.decision)).toEqual(['ADJUSTED', 'REJECTED']);
      // Ya resuelta: no se decide dos veces.
      expect(comoOrg('POST', `/org/support-engagement-requests/${solicitud.id}/decision`, { items: [] }).status).toBe(409);

      // Ana tiene ahora un permiso nuevo por Suárez, con SOLO las acciones del ajuste.
      const vinculo = comoOrg<SupportEngagementPage>('GET', '/org/support-engagements').body.items.find((e) => e.personName === 'Ana Gutiérrez')!;
      const porSuarez = vinculo.grants.find((g) => g.practitionerRoleAssignmentId === SUAREZ.id)!;
      expect(porSuarez.actions).toEqual(['schedule.view', 'schedule.create', 'schedule.check_in']);
      expect(vinculo.grants.some((g) => g.practitionerRoleAssignmentId === VACA.id)).toBe(false);
    });

    it('el doctor aprobado acepta una sola vez; antes de aceptar, el permiso que lo nombra no rige', () => {
      // Antes: Ana no ve la agenda de Suárez.
      expect(agendaDe(ana).body.doctors.some((d) => d.id === SUAREZ.practitionerProfileId)).toBe(false);

      const equipo = llamar<DoctorTeam>(suarez, 'GET', '/me/practitioner/support-team').body;
      const miembro = equipo.items.find((m) => m.personName === 'Ana Gutiérrez')!;
      expect(miembro.status).toBe('PENDING_ACCEPTANCE');

      // Otro doctor no puede aceptar por él.
      expect(llamar(perez, 'POST', `/practitioner-delegates/${miembro.delegateId}/accept`, { body: { acceptsSupportClause: true } }).status).toBe(403);

      expect(llamar(suarez, 'POST', `/practitioner-delegates/${miembro.delegateId}/accept`, { body: { acceptsSupportClause: true, mayReplyOnBehalf: false } }).status).toBe(200);
      const despues = llamar<DoctorTeam>(suarez, 'GET', '/me/practitioner/support-team').body.items.find((m) => m.personName === 'Ana Gutiérrez')!;
      expect(despues.status).toBe('ACTIVE');
      expect(despues.acceptedAt).toBeDefined();

      // Después: ya la ve.
      expect(agendaDe(ana).body.doctors.some((d) => d.id === SUAREZ.practitionerProfileId)).toBe(true);
    });

    it('el doctor decide si Ana responde en su nombre y si se muestra «respondido por su equipo»', () => {
      const miembro = llamar<DoctorTeam>(suarez, 'GET', '/me/practitioner/support-team').body.items.find((m) => m.personName === 'Ana Gutiérrez')!;

      expect(llamar(suarez, 'PATCH', `/practitioner-delegates/${miembro.delegateId}/reply-settings`, { body: { mayReplyOnBehalf: true, replyDisclosure: 'HIDE' } }).status).toBe(200);

      const despues = llamar<DoctorTeam>(suarez, 'GET', '/me/practitioner/support-team').body.items.find((m) => m.personName === 'Ana Gutiérrez')!;
      expect(despues.mayReplyOnBehalf).toBe(true);
      expect(despues.replyDisclosure).toBe('HIDE');
    });

    it('«Quién tiene acceso»: sobre Antelo en la sala 201 aparecen Marcos (por el servicio) y nadie más', () => {
      const r = comoOrg<{ items: { personName: string }[] }>('GET', `/org/access-lookup?doctor=${ANTELO.id}`);
      expect(r.body.items.map((e) => e.personName)).toEqual(['Marcos Ribera']);

      const piso = comoOrg<{ items: { personName: string }[] }>('GET', `/org/access-lookup?location=${LOC['a-p1']!.id}`);
      expect(piso.body.items.map((e) => e.personName)).toEqual(expect.arrayContaining(['Ana Gutiérrez', 'Lucía Paz']));

      expect(comoOrg('GET', '/org/access-lookup').status).toBe(400);
    });

    it('el editor guarda: un permiso nuevo, uno cambiado y uno retirado, y las lecturas lo reflejan', () => {
      const vinculo = comoOrg<SupportEngagementPage>('GET', '/org/support-engagements').body.items.find((e) => e.personName === 'Lucía Paz')!;
      const idActual = vinculo.grants[0]!.id;

      const nuevo = comoOrg<{ id: string }>('POST', `/org/support-engagements/${vinculo.id}/grants`, {
        targetKind: 'PRACTITIONER_SERVICE',
        practitionerRoleAssignmentId: FLORES.id,
        healthcareServiceId: DOC[FLORES.id]!.placements[0]!.healthcareServiceId,
        expansionMode: 'DYNAMIC',
        actions: ['schedule.view'],
      });
      expect(nuevo.status).toBe(201);
      // El mismo objetivo dos veces es un conflicto.
      expect(
        comoOrg('POST', `/org/support-engagements/${vinculo.id}/grants`, {
          targetKind: 'PRACTITIONER_SERVICE',
          practitionerRoleAssignmentId: FLORES.id,
          healthcareServiceId: DOC[FLORES.id]!.placements[0]!.healthcareServiceId,
          expansionMode: 'DYNAMIC',
          actions: ['schedule.view'],
        }).status,
      ).toBe(409);
      // Sin acciones, o con una que no existe, es un 400.
      expect(comoOrg('POST', `/org/support-engagements/${vinculo.id}/grants`, { targetKind: 'ALL', expansionMode: 'DYNAMIC', actions: [] }).status).toBe(400);
      expect(comoOrg('PATCH', `/org/support-engagements/${vinculo.id}/grants`, { grantId: idActual, actions: ['schedule.explotar'] }).status).toBe(400);

      expect(comoOrg('PATCH', `/org/support-engagements/${vinculo.id}/grants`, { grantId: idActual, actions: ['schedule.view'] }).status).toBe(200);
      expect(comoOrg('PATCH', `/org/support-engagements/${vinculo.id}/grants`, { grantId: nuevo.body.id, revoke: true }).status).toBe(200);

      const grants = comoOrg<{ actions: string[]; id: string }[]>('GET', `/org/support-engagements/${vinculo.id}/grants`).body;
      expect(grants.map((g) => g.id)).toEqual([idActual]);
      expect(grants[0]!.actions).toEqual(['schedule.view']);
    });

    it('invitaciones: el código se ve al emitir y no en la lista; canjear uno dirigido suma a la persona sin permisos', () => {
      // Con persona destino el código es de un solo uso y afilia directo; sin ella (multiuso) el canje queda pendiente.
      const emitida = comoOrg<{ code: string; id: string }>('POST', '/org/affiliation-invitations', { kind: 'SUPPORT_STAFF', targetPersonId: '00000000-0000-4000-8000-0000000000aa', maxUses: 1, expiresInDays: 7, roleTemplateCode: 'FRONT_DESK' });
      expect(emitida.status).toBe(201);
      // 24 bytes al azar en base64url: 32 caracteres, sin relleno ni signos que no sean de URL.
      expect(emitida.body.code).toMatch(/^[A-Za-z0-9_-]{32}$/);

      const lista = comoOrg<{ items: { id: string; code?: string }[] }>('GET', '/org/affiliation-invitations').body.items;
      expect(lista.find((i) => i.id === emitida.body.id)).toBeDefined();
      expect(lista.every((i) => i.code === undefined)).toBe(true);

      const nueva = buscarUsuario('aseguradora_staff')!;
      const rechazo = llamar<{ message: string; details: { reason: string } }>(nueva, 'POST', '/affiliation-invitations/redeem', { body: { code: 'codigo-que-no-existe' } });
      expect(rechazo.status).toBe(422);
      // El código distingue mayúsculas de minúsculas: el mismo en minúsculas es otro código.
      const enMinusculas = llamar<{ message: string }>(nueva, 'POST', '/affiliation-invitations/redeem', { body: { code: emitida.body.code.toLowerCase() } });
      expect(enMinusculas.status).toBe(422);
      const canje = llamar<{ kind: string; tenantId: string; engagementId: string }>(nueva, 'POST', '/affiliation-invitations/redeem', { body: { code: emitida.body.code } });
      expect(canje.status).toBe(200);
      expect(canje.body).toMatchObject({ kind: 'SUPPORT_STAFF', tenantId: TENANT_HOSPITAL_PILOTO });
      // De un solo uso: el segundo intento ya no está disponible, y se dice **igual** que si no existiera.
      const usado = llamar<{ message: string; details: { reason: string } }>(nueva, 'POST', '/affiliation-invitations/redeem', { body: { code: emitida.body.code } });
      expect(usado.status).toBe(422);
      expect(usado.body).toEqual(rechazo.body);
      expect(enMinusculas.body).toEqual(rechazo.body);
      expect(rechazo.body.details.reason).toBe('SUPPORT_INVITATION_INVALID');
      expect(comoOrg('POST', '/org/affiliation-invitations', { kind: 'SUPPORT_STAFF', maxUses: 0, expiresInDays: 7 }).status).toBe(400);
    });

    it('E · el canje de un código MULTIUSO queda pendiente: doctor sin requestId ni membershipId, apoyo con requestId', () => {
      const doctor = comoOrg<{ code: string }>('POST', '/org/affiliation-invitations', { kind: 'PRACTITIONER', maxUses: 5, expiresInDays: 7 });
      // Sin perfil profesional no hay a quién afiliar: 422 con su motivo, y el código sigue valiendo.
      const sinPerfil = llamar<{ details: { reason: string } }>(buscarUsuario('aseguradora_staff')!, 'POST', '/affiliation-invitations/redeem', { body: { code: doctor.body.code } });
      expect(sinPerfil.status).toBe(422);
      expect(sinPerfil.body.details.reason).toBe('SUPPORT_PRACTITIONER_PROFILE_REQUIRED');
      const quien = buscarUsuario('suarez')!;
      const canjeDoctor = llamar<Record<string, unknown>>(quien, 'POST', '/affiliation-invitations/redeem', { body: { code: doctor.body.code } });
      expect(canjeDoctor.status).toBe(200);
      expect(canjeDoctor.body).toEqual({ kind: 'PRACTITIONER', tenantId: TENANT_HOSPITAL_PILOTO, roleAssignmentId: expect.any(String), pendingApproval: true });
      expect(canjeDoctor.body).not.toHaveProperty('requestId');
      expect(canjeDoctor.body).not.toHaveProperty('membershipId');
      // La solicitud aparece en «Médicos del centro» con `initiatedBy: 'PRACTITIONER'`, sin sede ni servicio.
      const filas = llamar<{ items: { id: string; initiatedBy: string; practiceSiteId: string | null; serviceDisplay: string | null; statusCode: string }[] }>(org, 'GET', '/practices/' + PRACTICE_CM_NORTE + '/role-assignments').body.items;
      expect(filas.find((f) => f.id === canjeDoctor.body['roleAssignmentId'])).toMatchObject({ initiatedBy: 'PRACTITIONER', practiceSiteId: null, serviceDisplay: null, statusCode: 'ROLE_ASG_PENDING' });

      const apoyo = comoOrg<{ code: string }>('POST', '/org/affiliation-invitations', { kind: 'SUPPORT_STAFF', maxUses: 5, expiresInDays: 7, roleTemplateCode: 'FRONT_DESK' });
      const otra = buscarUsuario('farmacia_staff') ?? buscarUsuario('paciente')!;
      const canjeApoyo = llamar<{ kind: string; requestId?: string; pendingApproval?: boolean; engagementId?: string }>(otra, 'POST', '/affiliation-invitations/redeem', { body: { code: apoyo.body.code } });
      expect(canjeApoyo.status).toBe(200);
      expect(canjeApoyo.body).toMatchObject({ kind: 'SUPPORT_STAFF', pendingApproval: true });
      expect(canjeApoyo.body.requestId).toBeDefined();
      expect(canjeApoyo.body.engagementId).toBeUndefined();
      // La solicitud llega a la bandeja de la organización, pendiente.
      const bandeja = comoOrg<{ items: { id: string; status: string }[] }>('GET', '/org/support-engagement-requests?status=PENDING').body.items;
      expect(bandeja.find((r) => r.id === canjeApoyo.body.requestId)?.status).toBe('PENDING');
    });

    it('12 · al terminar el vínculo de Ana, ella queda sin acceso y sus citas siguen', () => {
      const vinculo = comoOrg<SupportEngagementPage>('GET', '/org/support-engagements').body.items.find((e) => e.personName === 'Ana Gutiérrez')!;
      const citaDeAna = agendaDe(lucia).body.items.find((i) => i.practitionerRoleAssignmentId === PEREZ.practitionerProfileId && i.careSpaceId === LOC['a-p1-103']!.id && i.status === 'CONFIRMED' && i.patientLabel?.includes(paciente.displayName))!;
      expect(citaDeAna).toBeDefined();

      expect(comoOrg('POST', `/org/support-engagements/${vinculo.id}/end`, { reason: 'Cambió de área' }).status).toBe(200);

      expect(agendaDe(ana).status).toBe(403);
      expect(llamar(ana, 'POST', `/scheduling/slots/${citaDeAna.id}/holds`).status).toBe(403);
      // La cita se mantiene: la recepción (Lucía) la sigue viendo.
      expect(agendaDe(lucia).body.items.find((i) => i.id === citaDeAna.id)!.status).toBe('CONFIRMED');
      // Y en el equipo del doctor figura como retirada, no como activa.
      expect(llamar<DoctorTeam>(perez, 'GET', '/me/practitioner/support-team').body.items.find((m) => m.personName === 'Ana Gutiérrez')!.status).toBe('REVOKED');
      expect(comoOrg('POST', `/org/support-engagements/${vinculo.id}/end`, { reason: 'otra vez' }).status).toBe(409);
      // `reason` es obligatorio, como en `EndEngagementDto`.
      expect(comoOrg('POST', `/org/support-engagements/${vinculo.id}/end`, {}).status).toBe(400);
    });
  });

  describe('la persona de apoyo', () => {
    it('pide ampliar su vínculo y ve su solicitud en el historial; no pide a medias', () => {
      expect(llamar(lucia, 'POST', '/support-engagement-requests', { body: { tenantId: TENANT_HOSPITAL_PILOTO, roleTemplateCode: 'FRONT_DESK', items: [] } }).status).toBe(400);
      expect(llamar(lucia, 'POST', '/support-engagement-requests', { body: { tenantId: TENANT_HOSPITAL_PILOTO, roleTemplateCode: 'FRONT_DESK', items: [{ targetKind: 'PRACTITIONER', actions: ['schedule.view'] }] } }).status).toBe(400);

      const r = llamar<SupportEngagementRequest>(lucia, 'POST', '/support-engagement-requests', {
        body: { tenantId: TENANT_HOSPITAL_PILOTO, roleTemplateCode: 'FRONT_DESK', message: 'Pido el piso 2', items: [{ targetKind: 'LOCATION', careSpaceId: LOC['a-p2']!.id, actions: ['schedule.view', 'schedule.check_in'] }] },
      });
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('PENDING');
      expect(new Date(r.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 86_400_000);

      const historial = llamar<MySupportEngagements>(lucia, 'GET', '/me/support-engagements').body.requests;
      expect(historial.map((h) => h.id)).toContain(r.body.id);
    });

    it('lee el catálogo de SU organización y no el de otra', () => {
      expect(llamar(lucia, 'GET', '/me/support-catalog', { query: { org: TENANT_HOSPITAL_PILOTO } }).status).toBe(200);
      expect(llamar(rosa, 'GET', '/me/support-catalog', { query: { org: TENANT_HOSPITAL_PILOTO } }).status).toBe(403);
    });
  });

  describe('el hospital piloto como cuenta de organización', () => {
    it('trae el claim accountKind ORGANIZATION en su token y el personal, PERSON', () => {
      expect(org.accountKind).toBe('ORGANIZATION');
      for (const persona of [ana, lucia, marcos, rosa, perez]) expect(persona.accountKind).toBe('PERSON');
    });

    it('la agenda de Céspedes no filtra a otra organización: sus doctores son solo los de su consultorio', () => {
      const { doctors } = agendaDe(rosa, TENANT_CESPEDES).body;
      expect(doctors.every((d) => DOC[d.id] === undefined)).toBe(true);
    });
  });
});

/** El primer horario de un doctor en un espacio, el que sea (para probar la negativa). */
function horarioDe(doctorId: string, espacio: string): string {
  const fila = agendaDePartida().find((f) => f.doctorId === doctorId && f.careSpaceId === LOC[espacio]!.id && f.status === 'FREE');
  if (fila === undefined) throw new Error('sin horario');
  return fila.id;
}

