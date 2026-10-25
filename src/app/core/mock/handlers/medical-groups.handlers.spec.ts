import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { MEDICAL, PATIENTS, PROFESSIONALS } from '../fixtures/people';
import { servicios } from './practice.handlers';
import { registrarGruposMedicos } from './medical-groups.handlers';

/**
 * Los grupos médicos del simulador (`/medical-groups`, FT-21): las 8 rutas de
 * `MedicalGroupsController` con las reglas del servicio real.
 */
describe('grupos médicos del simulador (/medical-groups)', () => {
  const router = new MockRouter();
  registrarGruposMedicos(router);
  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;
  const COLEGA = PROFESSIONALS[4]!.id;
  const SERVICIO = servicios.todos().find((s) => s.isActive)!.id;

  interface Miembro {
    id: string;
    practitionerProfileId: string;
    invitationStatus: string;
    isCreator: boolean;
    agreedPaymentAmount: string;
  }
  /** La ficha de un grupo tal como la sirve el simulador (lo vacío viaja en `null`). */
  interface Ficha {
    id: string;
    status: string;
    scheduledAt: string;
    requestingPractitionerId: string;
    locationText: string;
    members: Miembro[];
    proposedRescheduleAt: string | null;
    exerciseNotesText: string | null;
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
  }
  interface Pagina {
    items: Fila[];
    nextCursor: string | null;
  }
  interface Condicion {
    isMostRecent: boolean;
  }

  interface Result<T> {
    readonly status: number;
    readonly body: T;
  }

  function call<T = Ficha & Pagina>(
    method: MockMethod,
    path: string,
    options: { body?: unknown; query?: string; user?: MockUser } = {},
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
      user: options.user ?? medica,
    });
    return isMockReply(result) ? { status: result.status, body: result.body as T } : { status: 200, body: result as T };
  }

  const nuevo = (extra: Record<string, unknown> = {}) => ({
    serviceCatalogId: SERVICIO,
    scheduledAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    locationText: 'Sala de pruebas',
    members: [],
    ...extra,
  });

  it('registra las 8 rutas del controller', () => {
    const rutas: [MockMethod, string][] = [
      ['GET', '/medical-groups'],
      ['GET', '/medical-groups/patients/p-1/conditions'],
      ['GET', '/medical-groups/g-1'],
      ['POST', '/medical-groups'],
      ['POST', '/medical-groups/g-1/members/m-1/respond'],
      ['POST', '/medical-groups/g-1/reschedule-requests'],
      ['POST', '/medical-groups/g-1/reschedule-requests/respond'],
      ['PATCH', '/medical-groups/g-1/exercise-notes'],
    ];
    for (const [metodo, ruta] of rutas) {
      expect(router.match(metodo, ruta), `${metodo} ${ruta}`).not.toBeNull();
    }
  });

  describe('acceso', () => {
    it('un paciente es 403: la ruta es de PRACTITIONER o CLINICIAN', () => {
      expect(call('GET', '/medical-groups', { user: paciente }).status).toBe(403);
    });

    it('sin sesión es 403', () => {
      const match = router.match('GET', '/medical-groups')!;
      const r = match.handler({ method: 'GET', path: '/medical-groups', params: {}, query: new URLSearchParams(), body: null, headers: new HttpHeaders(), user: null });
      expect(isMockReply(r) && r.status).toBe(403);
    });
  });

  describe('listado', () => {
    it('histórico: lo creado más lo aceptado, nunca una invitación pendiente', () => {
      const { body } = call('GET', '/medical-groups', { query: 'tab=historico' });

      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.every((g: { id: string }) => typeof g.id === 'string')).toBe(true);
      const recibidas = call('GET', '/medical-groups', { query: 'tab=recibidas' }).body.items;
      const ids = new Set(body.items.map((g: { id: string }) => g.id));
      expect(recibidas.every((g: { id: string }) => !ids.has(g.id))).toBe(true);
    });

    it('recibidas: invitaciones sin responder, que no son del propio usuario', () => {
      const { body } = call('GET', '/medical-groups', { query: 'tab=recibidas' });

      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.every((g: { isCreator: boolean }) => !g.isCreator)).toBe(true);
    });

    it('enviadas: lo propio con invitaciones pendientes', () => {
      const { body } = call('GET', '/medical-groups', { query: 'tab=enviadas' });

      expect(body.items.every((g: { isCreator: boolean; pendingMembersCount: number }) => g.isCreator && g.pendingMembersCount > 0)).toBe(true);
    });

    it('pagina por cursor y límite', () => {
      const { body } = call('GET', '/medical-groups', { query: 'tab=historico&limit=1' });

      expect(body.items).toHaveLength(1);
      expect(body.nextCursor).not.toBeNull();
    });
  });

  describe('alta', () => {
    it('crea el grupo con el creador aceptado y sin pago, y las invitaciones pendientes', () => {
      const r = call('POST', '/medical-groups', {
        body: nuevo({ members: [{ practitionerProfileId: COLEGA, roleTitle: 'Anestesiólogo', agreedPaymentAmount: '500.00' }] }),
      });

      expect(r.status).toBe(201);
      expect(r.body.status).toBe('PENDING_TEAM');
      expect(r.body.requestingPractitionerId).toBe(MEDICAL.id);
      expect(r.body.members[0]).toMatchObject({ isCreator: true, invitationStatus: 'ACCEPTED', agreedPaymentAmount: '0.00' });
      expect(r.body.members[1]).toMatchObject({ practitionerProfileId: COLEGA, invitationStatus: 'PENDING' });
      expect(r.body.isRealized).toBe(false);
    });

    it('sin equipo queda programado de una vez', () => {
      expect(call('POST', '/medical-groups', { body: nuevo() }).body.status).toBe('SCHEDULED');
    });

    it('lo creado se lee después: la ficha y el listado', () => {
      const creado = call('POST', '/medical-groups', { body: nuevo({ locationText: 'Lugar único 123' }) }).body;

      expect(call('GET', `/medical-groups/${creado.id}`).body.locationText).toBe('Lugar único 123');
      const ids = call('GET', '/medical-groups', { query: 'tab=historico&limit=100' }).body.items.map((g: { id: string }) => g.id);
      expect(ids).toContain(creado.id);
    });

    it.each([
      ['lugar vacío', { locationText: '' }],
      ['fecha inválida', { scheduledAt: 'ayer' }],
      ['pago con signo', { members: [{ practitionerProfileId: COLEGA, roleTitle: 'X', agreedPaymentAmount: '-1' }] }],
      ['pago con tres decimales', { members: [{ practitionerProfileId: COLEGA, roleTitle: 'X', agreedPaymentAmount: '1.234' }] }],
      ['función vacía', { members: [{ practitionerProfileId: COLEGA, roleTitle: '', agreedPaymentAmount: '1' }] }],
    ])('rechaza con 400 un cuerpo inválido: %s', (_motivo, extra) => {
      expect(call('POST', '/medical-groups', { body: nuevo(extra) }).status).toBe(400);
    });

    it('un servicio inexistente es 404', () => {
      expect(call('POST', '/medical-groups', { body: nuevo({ serviceCatalogId: 'no-existe' }) }).status).toBe(404);
    });

    it('un diagnóstico sin paciente es 422', () => {
      expect(call('POST', '/medical-groups', { body: nuevo({ conditionId: 'c-1' }) }).status).toBe(422);
    });

    it('repetir a un profesional, o invitar al creador, es 409', () => {
      const miembro = { practitionerProfileId: COLEGA, roleTitle: 'X', agreedPaymentAmount: '1' };
      expect(call('POST', '/medical-groups', { body: nuevo({ members: [miembro, miembro] }) }).status).toBe(409);
      expect(call('POST', '/medical-groups', { body: nuevo({ members: [{ ...miembro, practitionerProfileId: MEDICAL.id }] }) }).status).toBe(409);
    });
  });

  describe('invitaciones', () => {
    /** Una invitación nueva para la médica: la crea un colega e invita a la médica. */
    function recibida() {
      const comoColega = { ...medica, practitionerProfileId: COLEGA } as MockUser;
      const g = call('POST', '/medical-groups', {
        user: comoColega,
        body: nuevo({ members: [{ practitionerProfileId: MEDICAL.id, roleTitle: 'Cardiólogo de apoyo', agreedPaymentAmount: '450' }] }),
      }).body;
      const mio = g.members.find((m) => m.practitionerProfileId === MEDICAL.id)!;
      return { id: g.id as string, memberId: mio.id as string };
    }

    it('aceptar deja el cargo aceptado y el grupo sale de «recibidas»', () => {
      const { id, memberId } = recibida();

      const r = call('POST', `/medical-groups/${id}/members/${memberId}/respond`, { body: { decision: 'ACCEPTED' } });

      expect(r.status).toBe(200);
      expect(r.body.members.find((m) => m.id === memberId)!.invitationStatus).toBe('ACCEPTED');
      expect(r.body.status).toBe('SCHEDULED');
      const ids = call('GET', '/medical-groups', { query: 'tab=recibidas&limit=100' }).body.items.map((g: { id: string }) => g.id);
      expect(ids).not.toContain(id);
    });

    it('responder dos veces es 422', () => {
      const creado = call('POST', '/medical-groups', {
        body: nuevo({ members: [{ practitionerProfileId: COLEGA, roleTitle: 'X', agreedPaymentAmount: '1' }] }),
      }).body;
      const colega = buscarUsuario('medica')!;
      // El invitado es otro profesional: lo simulamos con un usuario que lo es.
      const comoColega: MockUser = { ...colega, practitionerProfileId: COLEGA };
      const miembro = creado.members[1].id;

      expect(call('POST', `/medical-groups/${creado.id}/members/${miembro}/respond`, { user: comoColega, body: { decision: 'REJECTED' } }).status).toBe(200);
      expect(call('POST', `/medical-groups/${creado.id}/members/${miembro}/respond`, { user: comoColega, body: { decision: 'ACCEPTED' } }).status).toBe(422);
    });

    it('quien no es el invitado recibe 404, no 403', () => {
      const creado = call('POST', '/medical-groups', {
        body: nuevo({ members: [{ practitionerProfileId: COLEGA, roleTitle: 'X', agreedPaymentAmount: '1' }] }),
      }).body;

      const r = call('POST', `/medical-groups/${creado.id}/members/${creado.members[1].id}/respond`, { body: { decision: 'ACCEPTED' } });

      expect(r.status).toBe(404);
    });

    it('una decisión desconocida es 400', () => {
      const { id, memberId } = recibida();
      expect(call('POST', `/medical-groups/${id}/members/${memberId}/respond`, { body: { decision: 'TAL_VEZ' } }).status).toBe(400);
    });

    it('un grupo ajeno no se puede leer: 404', () => {
      const ajeno = { ...medica, practitionerProfileId: 'otro-perfil' } as MockUser;
      const g = call('GET', '/medical-groups', { query: 'tab=historico' }).body.items[0];

      expect(call('GET', `/medical-groups/${g.id}`, { user: ajeno }).status).toBe(404);
    });
  });

  describe('horario', () => {
    it('el creador que cambia la fecha la aplica directo', () => {
      const g = call('POST', '/medical-groups', { body: nuevo() }).body;
      const otra = new Date(Date.now() + 9 * 86_400_000).toISOString();

      const r = call('POST', `/medical-groups/${g.id}/reschedule-requests`, { body: { proposedAt: otra } });

      expect(r.status).toBe(200);
      expect(r.body.scheduledAt).toBe(otra);
      expect(r.body.status).toBe('SCHEDULED');
      // Como la API real, lo vacío viaja en `null`; el cliente lo normaliza.
      expect(r.body.proposedRescheduleAt).toBeNull();
    });

    it('un integrante propone, el grupo queda pendiente y sólo el creador resuelve', () => {
      const g = call('POST', '/medical-groups', {
        body: nuevo({ members: [{ practitionerProfileId: COLEGA, roleTitle: 'X', agreedPaymentAmount: '1' }] }),
      }).body;
      const comoColega = { ...medica, practitionerProfileId: COLEGA } as MockUser;
      call('POST', `/medical-groups/${g.id}/members/${g.members[1].id}/respond`, { user: comoColega, body: { decision: 'ACCEPTED' } });
      const otra = new Date(Date.now() + 9 * 86_400_000).toISOString();

      const propuesta = call('POST', `/medical-groups/${g.id}/reschedule-requests`, { user: comoColega, body: { proposedAt: otra } });
      expect(propuesta.body.status).toBe('RESCHEDULE_PENDING');
      expect(propuesta.body.proposedRescheduleAt).toBe(otra);

      expect(call('POST', `/medical-groups/${g.id}/reschedule-requests/respond`, { user: comoColega, body: { decision: 'ACCEPTED' } }).status).toBe(401);

      const resuelta = call('POST', `/medical-groups/${g.id}/reschedule-requests/respond`, { body: { decision: 'ACCEPTED' } });
      expect(resuelta.body.scheduledAt).toBe(otra);
      expect(resuelta.body.status).toBe('SCHEDULED');
    });

    it('rechazar la propuesta conserva la fecha anterior', () => {
      const g = call('POST', '/medical-groups', {
        body: nuevo({ members: [{ practitionerProfileId: COLEGA, roleTitle: 'X', agreedPaymentAmount: '1' }] }),
      }).body;
      const comoColega = { ...medica, practitionerProfileId: COLEGA } as MockUser;
      call('POST', `/medical-groups/${g.id}/members/${g.members[1].id}/respond`, { user: comoColega, body: { decision: 'ACCEPTED' } });
      call('POST', `/medical-groups/${g.id}/reschedule-requests`, { user: comoColega, body: { proposedAt: new Date(Date.now() + 9 * 86_400_000).toISOString() } });

      const r = call('POST', `/medical-groups/${g.id}/reschedule-requests/respond`, { body: { decision: 'REJECTED' } });

      expect(r.body.scheduledAt).toBe(g.scheduledAt);
    });

    it('resolver sin propuesta pendiente es 422', () => {
      const g = call('POST', '/medical-groups', { body: nuevo() }).body;
      expect(call('POST', `/medical-groups/${g.id}/reschedule-requests/respond`, { body: { decision: 'ACCEPTED' } }).status).toBe(422);
    });
  });

  describe('notas del ejercicio', () => {
    it('antes de la cita es 422', () => {
      const g = call('POST', '/medical-groups', { body: nuevo() }).body;
      expect(call('PATCH', `/medical-groups/${g.id}/exercise-notes`, { body: { notesText: 'x' } }).status).toBe(422);
    });

    it('después de la cita se guardan y se leen al recargar', () => {
      const g = call('GET', '/medical-groups', { query: 'tab=historico&limit=100' }).body.items.find(
        (x) => x.status === 'SCHEDULED' && new Date(x.scheduledAt) < new Date() && Date.now() - new Date(x.scheduledAt).getTime() < 6 * 86_400_000,
      )!;

      const r = call('PATCH', `/medical-groups/${g.id}/exercise-notes`, { body: { notesText: 'Nota nueva' } });

      expect(r.status).toBe(200);
      expect(r.body.canEditExerciseNotes).toBe(true);
      expect(call('GET', `/medical-groups/${g.id}`).body.exerciseNotesText).toBe('Nota nueva');
    });

    it('pasada la semana el expediente está cerrado y es inmutable', () => {
      const g = call('GET', '/medical-groups', { query: 'tab=historico&limit=100' }).body.items.find(
        (x) => x.status === 'CLOSED',
      )!;

      const r = call('PATCH', `/medical-groups/${g.id}/exercise-notes`, { body: { notesText: 'tarde' } });

      expect(r.status).toBe(422);
      expect(call('GET', `/medical-groups/${g.id}`).body).toMatchObject({ isClosed: true, canEditExerciseNotes: false });
    });
  });

  describe('diagnósticos del paciente', () => {
    it('el más reciente primero y marcado', () => {
      const todos = PATIENTS.map((p) => call<Condicion[]>('GET', `/medical-groups/patients/${p.id}/conditions`).body);
      const con = todos.find((c) => c.length > 1)!;

      expect(con[0]!.isMostRecent).toBe(true);
      expect(con.slice(1).every((c) => !c.isMostRecent)).toBe(true);
    });
  });
});
