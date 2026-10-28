import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';

describe('encuestas y formularios del backend demo', () => {
  const router = new MockRouter();
  const storageKeys = ['mock.surveys-forms.encuestas', 'mock.surveys-forms.invitaciones', 'mock.surveys-forms.asignaciones'];
  const previous = new Map<string, string | null>();
  const patient = buscarUsuario('paciente')!;

  beforeAll(async () => {
    for (const key of storageKeys) {
      previous.set(key, sessionStorage.getItem(key));
      sessionStorage.removeItem(key);
    }
    vi.resetModules();
    const { registrarEncuestas } = await import('./surveys-forms.handlers');
    registrarEncuestas(router);
  });

  afterAll(() => {
    for (const key of storageKeys) {
      const value = previous.get(key);
      if (value === null || value === undefined) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    }
    vi.resetModules();
  });

  function request(method: MockMethod, path: string, body: unknown = {}, query = new URLSearchParams()) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders(),
      user: patient,
    } satisfies MockRequest);
  }

  const data = <T>(response: unknown) => (isMockReply(response) ? response.body : response) as T;

  it('cada invitación del paciente dice de qué atención salió (kind, médico o servicio, fecha)', () => {
    interface Invitacion {
      id: string;
      appointmentBookingId: string;
      kind?: 'CONSULTATION' | 'SERVICE';
      serviceName?: string;
      practitionerDisplayName?: string;
      attendedAt?: string;
    }
    const invitaciones = data<Invitacion[]>(request('GET', '/surveys/me/invitations'));
    expect(invitaciones.length).toBeGreaterThan(0);

    const conContexto = invitaciones.filter((i) => i.kind !== undefined);
    expect(conContexto.length).toBeGreaterThan(0);
    for (const invitacion of conContexto) {
      expect(['CONSULTATION', 'SERVICE']).toContain(invitacion.kind);
      expect(Number.isNaN(Date.parse(invitacion.attendedAt ?? ''))).toBe(false);
      // Una consulta nombra al médico; un servicio, al servicio. Nunca el otro campo.
      if (invitacion.kind === 'SERVICE') {
        expect(invitacion.serviceName).toBeTruthy();
      } else {
        expect(invitacion.serviceName).toBeUndefined();
        expect(invitacion.practitionerDisplayName).toBeTruthy();
      }
    }
    // El detalle (la pantalla de responder) trae los mismos campos que la lista.
    const primera = invitaciones[0]!;
    expect(
      data<Invitacion>(request('GET', `/surveys/me/invitations/${primera.id}`)),
    ).toMatchObject({
      kind: primera.kind,
      practitionerDisplayName: primera.practitionerDisplayName,
      attendedAt: primera.attendedAt,
    });
  });

  it('las respuestas recibidas llegan con la fecha redondeada al día y sin la reserva', () => {
    const templates = data<{ id: string; published: boolean }[]>(request('GET', '/surveys/templates'));
    const activa = templates.find((template) => template.published)!;
    const respuestas = data<Record<string, unknown>[]>(request('GET', `/surveys/templates/${activa.id}/responses`));
    expect(respuestas.length).toBeGreaterThan(0);
    for (const respuesta of respuestas) {
      // Medianoche UTC: ninguna hora exacta junto al comentario.
      expect(respuesta['submittedAt']).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
      expect('appointmentBookingId' in respuesta).toBe(false);
    }
  });
});
