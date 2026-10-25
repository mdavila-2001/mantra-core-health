import { HttpHeaders } from '@angular/common/http';

import { MEDICAL, PROFESSIONALS } from '../fixtures/people';
import { MockRouter, isMockReply, preconditionFailed, validation, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registerMedicalGroups } from './medical-groups.handlers';
import { servicios } from './practice.handlers';

/** Las familias de rechazo salen de los ayudantes del simulador, no de un número. */
const PRECONDITION = preconditionFailed('').status;
const INVALID = validation('').status;

/**
 * Los grupos médicos del simulador (`/medical-groups`, FT-21): las rutas de
 * `MedicalGroupsController` con las reglas del servicio real, los datos de
 * arranque que permiten recorrerlas (una invitación, un grupo realizado, uno
 * cerrado) y la persistencia que permite comprobar «guardado → recarga».
 */
describe('grupos médicos del simulador (/medical-groups)', () => {
  const router = new MockRouter();
  registerMedicalGroups(router);
  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;
  const COLEGA = PROFESSIONALS[4]!.id;
  const comoColega: MockUser = { ...medica, practitionerProfileId: COLEGA };

  interface Result<T> {
    readonly status: number;
    readonly body: T;
  }
  interface Miembro {
    id: string;
    practitionerProfileId: string;
    invitationStatus: string;
    isCreator: boolean;
    agreedPaymentAmount: string;
  }
  interface Ficha {
    id: string;
    serviceName: string | null;
    status: string;
    scheduledAt: string;
    locationText: string;
    members: Miembro[];
    proposedRescheduleAt?: string;
    exerciseNotesText?: string;
    isClosed: boolean;
    isRealized: boolean;
    canEditExerciseNotes: boolean;
  }
  interface Fila {
    id: string;
    status: string;
    scheduledAt: string;
    isCreator: boolean;
    pendingMembersCount: number;
    locationText: string;
  }
  interface Pagina {
    items: Fila[];
  }

  function call<T = Ficha & Pagina>(
    method: MockMethod,
    path: string,
    options: { body?: unknown; query?: string; user?: MockUser | null } = {},
  ): Result<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(options.query ?? ''),
      body: options.body ?? null,
      headers: new HttpHeaders(),
      user: options.user === undefined ? medica : options.user,
    });
    return isMockReply(result) ? { status: result.status, body: result.body as T } : { status: 200, body: result as T };
  }

  const nuevo = (extra: Record<string, unknown> = {}) => ({
    serviceCatalogId: 'svc-1',
    scheduledAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    locationText: 'Sala de pruebas',
    members: [],
    ...extra,
  });
  const miembro = { practitionerProfileId: COLEGA, roleTitle: 'Anestesiólogo', agreedPaymentAmount: '500.00' };
  const lista = (tab: string, user?: MockUser) => call('GET', '/medical-groups', { query: `tab=${tab}`, user }).body.items;

  /** Una invitación nueva para la médica: la crea un colega y la invita a ella. */
  function recibida() {
    const g = call('POST', '/medical-groups', {
      user: comoColega,
      body: nuevo({ members: [{ ...miembro, practitionerProfileId: MEDICAL.id }] }),
    }).body;
    return { id: g.id, memberId: g.members.find((m) => m.practitionerProfileId === MEDICAL.id)!.id };
  }

  describe('acceso', () => {
    it('un paciente es 403 en el listado y en el alta', () => {
      expect(call('GET', '/medical-groups', { user: paciente }).status).toBe(403);
      expect(call('POST', '/medical-groups', { user: paciente, body: nuevo() }).status).toBe(403);
    });

    it('sin sesión es 403', () => {
      expect(call('GET', '/medical-groups', { user: null }).status).toBe(403);
    });

    it('un tercero que no es parte del grupo recibe 404, nunca 403', () => {
      const g = call('POST', '/medical-groups', { body: nuevo() }).body;
      const ajeno: MockUser = { ...medica, practitionerProfileId: 'otro-perfil' };

      expect(call('GET', `/medical-groups/${g.id}`, { user: ajeno }).status).toBe(404);
    });
  });

  describe('datos de arranque', () => {
    it('hay una invitación por responder, un grupo realizado y uno cerrado', () => {
      expect(lista('recibidas').length).toBeGreaterThan(0);
      const historico = lista('historico');
      expect(historico.some((g) => g.status === 'CLOSED')).toBe(true);
      expect(historico.some((g) => g.status === 'SCHEDULED' && new Date(g.scheduledAt) < new Date())).toBe(true);
    });

    it('las enviadas son sólo propias y con invitaciones pendientes', () => {
      const enviadas = lista('enviadas');
      expect(enviadas.length).toBeGreaterThan(0);
      expect(enviadas.every((g) => g.isCreator && g.pendingMembersCount > 0)).toBe(true);
    });

    it('hay colegas para invitar', () => {
      const r = call<{ practitionerProfileId: string; name: string | null }[]>('GET', '/medical-groups/eligible-members', { query: 'serviceCatalogId=svc-1' });
      expect(r.status).toBe(200);
      expect(r.body.length).toBeGreaterThan(0);
      expect(r.body.every((m) => m.practitionerProfileId !== MEDICAL.id)).toBe(true);
    });
  });

  describe('alta', () => {
    it('el creador entra aceptado y sin pago, y los invitados quedan pendientes', () => {
      const r = call('POST', '/medical-groups', { body: nuevo({ members: [miembro] }) });

      expect(r.status).toBe(201);
      expect(r.body.status).toBe('PENDING_TEAM');
      expect(r.body.members[0]).toMatchObject({ isCreator: true, invitationStatus: 'ACCEPTED', agreedPaymentAmount: '0.00' });
      expect(r.body.members[1]).toMatchObject({ practitionerProfileId: COLEGA, invitationStatus: 'PENDING' });
    });

    it('el grupo creado lleva el nombre del servicio del catálogo, no un rótulo genérico', () => {
      const servicio = servicios.todos()[0]!;

      const r = call('POST', '/medical-groups', { body: nuevo({ serviceCatalogId: servicio.id }) });

      expect(r.body.serviceName).toBe(servicio.name);
    });

    it('sin equipo queda programado de una vez', () => {
      expect(call('POST', '/medical-groups', { body: nuevo() }).body.status).toBe('SCHEDULED');
    });

    it('lo creado se lee de nuevo y se guarda para sobrevivir a una recarga', () => {
      const creado = call('POST', '/medical-groups', { body: nuevo({ locationText: 'Lugar único 123' }) }).body;

      expect(call('GET', `/medical-groups/${creado.id}`).body.locationText).toBe('Lugar único 123');
      const guardado = JSON.parse(sessionStorage.getItem('mock.medical-groups')!) as { groups: { id: string }[] };
      expect(guardado.groups.map((g) => g.id)).toContain(creado.id);
    });

    it.each([
      ['sin servicio', { serviceCatalogId: '' }],
      ['fecha inválida', { scheduledAt: 'ayer' }],
      ['lugar vacío', { locationText: '   ' }],
      ['pago con signo', { members: [{ ...miembro, agreedPaymentAmount: '-1' }] }],
      ['pago con tres decimales', { members: [{ ...miembro, agreedPaymentAmount: '1.234' }] }],
    ])('rechaza un cuerpo inválido: %s', (_motivo, extra) => {
      expect(call('POST', '/medical-groups', { body: nuevo(extra) }).status).toBe(INVALID);
    });
  });

  describe('invitaciones', () => {
    it('aceptar deja el cargo aceptado, programa el grupo y lo saca de «recibidas»', () => {
      const { id, memberId } = recibida();

      const r = call('POST', `/medical-groups/${id}/members/${memberId}/respond`, { body: { decision: 'ACCEPTED' } });

      expect(r.status).toBe(200);
      expect(r.body.members.find((m) => m.id === memberId)!.invitationStatus).toBe('ACCEPTED');
      expect(r.body.status).toBe('SCHEDULED');
      expect(lista('recibidas').map((g) => g.id)).not.toContain(id);
    });

    it('responder dos veces es una precondición fallida', () => {
      const { id, memberId } = recibida();
      call('POST', `/medical-groups/${id}/members/${memberId}/respond`, { body: { decision: 'REJECTED' } });

      expect(call('POST', `/medical-groups/${id}/members/${memberId}/respond`, { body: { decision: 'ACCEPTED' } }).status).toBe(PRECONDITION);
    });

    it('quien no es el invitado recibe 404', () => {
      const creado = call('POST', '/medical-groups', { body: nuevo({ members: [miembro] }) }).body;

      expect(call('POST', `/medical-groups/${creado.id}/members/${creado.members[1]!.id}/respond`, { body: { decision: 'ACCEPTED' } }).status).toBe(404);
    });
  });

  describe('horario', () => {
    it('el creador cambia la fecha y se aplica directo', () => {
      const g = call('POST', '/medical-groups', { body: nuevo() }).body;
      const otra = new Date(Date.now() + 9 * 86_400_000).toISOString();

      const r = call('POST', `/medical-groups/${g.id}/reschedule-requests`, { body: { proposedAt: otra } });

      expect(r.body.scheduledAt).toBe(otra);
      expect(r.body.status).toBe('SCHEDULED');
    });

    it('un integrante propone y sólo el creador resuelve', () => {
      const g = call('POST', '/medical-groups', { body: nuevo({ members: [miembro] }) }).body;
      call('POST', `/medical-groups/${g.id}/members/${g.members[1]!.id}/respond`, { user: comoColega, body: { decision: 'ACCEPTED' } });
      const otra = new Date(Date.now() + 9 * 86_400_000).toISOString();

      const propuesta = call('POST', `/medical-groups/${g.id}/reschedule-requests`, { user: comoColega, body: { proposedAt: otra } });
      expect(propuesta.body.status).toBe('RESCHEDULE_PENDING');
      expect(propuesta.body.proposedRescheduleAt).toBe(otra);
      expect(call('POST', `/medical-groups/${g.id}/reschedule-requests/respond`, { user: comoColega, body: { decision: 'ACCEPTED' } }).status).toBe(404);

      const resuelta = call('POST', `/medical-groups/${g.id}/reschedule-requests/respond`, { body: { decision: 'ACCEPTED' } });
      expect(resuelta.body.scheduledAt).toBe(otra);
      expect(resuelta.body.status).toBe('SCHEDULED');
    });

    it('rechazar la propuesta conserva la fecha anterior', () => {
      const g = call('POST', '/medical-groups', { body: nuevo({ members: [miembro] }) }).body;
      call('POST', `/medical-groups/${g.id}/members/${g.members[1]!.id}/respond`, { user: comoColega, body: { decision: 'ACCEPTED' } });
      call('POST', `/medical-groups/${g.id}/reschedule-requests`, { user: comoColega, body: { proposedAt: new Date(Date.now() + 9 * 86_400_000).toISOString() } });

      expect(call('POST', `/medical-groups/${g.id}/reschedule-requests/respond`, { body: { decision: 'REJECTED' } }).body.scheduledAt).toBe(g.scheduledAt);
    });

    it('una fecha pasada o un grupo ya realizado no admiten cambio', () => {
      const g = call('POST', '/medical-groups', { body: nuevo() }).body;
      expect(call('POST', `/medical-groups/${g.id}/reschedule-requests`, { body: { proposedAt: new Date(Date.now() - 1000).toISOString() } }).status).toBe(PRECONDITION);

      const realizado = lista('historico').find((x) => x.status === 'SCHEDULED' && new Date(x.scheduledAt) < new Date())!;
      expect(call('POST', `/medical-groups/${realizado.id}/reschedule-requests`, { body: { proposedAt: new Date(Date.now() + 86_400_000).toISOString() } }).status).toBe(PRECONDITION);
    });
  });

  describe('notas del ejercicio', () => {
    it('antes de la cita no se cargan', () => {
      const g = call('POST', '/medical-groups', { body: nuevo() }).body;
      expect(call('PATCH', `/medical-groups/${g.id}/exercise-notes`, { body: { notesText: 'x' } }).status).toBe(PRECONDITION);
    });

    it('después de la cita se guardan y se leen al volver', () => {
      const g = lista('historico').find((x) => x.status === 'SCHEDULED' && new Date(x.scheduledAt) < new Date())!;

      const r = call('PATCH', `/medical-groups/${g.id}/exercise-notes`, { body: { notesText: 'Nota nueva' } });

      expect(r.status).toBe(200);
      expect(r.body.canEditExerciseNotes).toBe(true);
      expect(call('GET', `/medical-groups/${g.id}`).body.exerciseNotesText).toBe('Nota nueva');
    });

    it('pasada la semana el expediente está cerrado y es inmutable', () => {
      const g = lista('historico').find((x) => x.status === 'CLOSED')!;

      expect(call('PATCH', `/medical-groups/${g.id}/exercise-notes`, { body: { notesText: 'tarde' } }).status).toBe(PRECONDITION);
      expect(call('GET', `/medical-groups/${g.id}`).body).toMatchObject({ isClosed: true, canEditExerciseNotes: false });
    });
  });
});
