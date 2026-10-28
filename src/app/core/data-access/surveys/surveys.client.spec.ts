import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { SurveysClient } from './surveys.client';

/**
 * Los cuerpos se escriben como los manda el servidor —fechas en texto, opcionales
 * ausentes o en `null`—, no como los declara el tipo de la vista: fabricarlos ya
 * convertidos haría pasar la prueba con la conversión rota (ver `wire.ts`).
 */
describe('SurveysClient', () => {
  let client: SurveysClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(SurveysClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const BASE = {
    id: 'inv-1',
    title: 'Encuesta de su consulta médica',
    description: 'Le pedimos un minuto.',
    status: 'PENDING',
    issuedAt: '2026-10-28T12:00:00.000Z',
    expiresAt: '2026-11-04T12:00:00.000Z',
    answeredAt: null,
    appointmentBookingId: 'bk-1',
  };

  describe('GET /surveys/me/invitations — de qué atención salió cada una', () => {
    it('trae kind, médico, servicio y la fecha de la atención como Date', async () => {
      const pedido = firstValueFrom(client.listMyQuestionnaires());
      http.expectOne((r) => r.url.endsWith('/surveys/me/invitations')).flush([
        {
          ...BASE,
          kind: 'CONSULTATION',
          practitionerDisplayName: 'Dra. Rojas',
          serviceName: null,
          attendedAt: '2026-10-20T14:00:00.000Z',
        },
        {
          ...BASE,
          id: 'inv-2',
          kind: 'SERVICE',
          serviceName: 'Ecografía abdominal',
          attendedAt: '2026-10-21T15:30:00.000Z',
        },
      ]);

      const [consulta, servicio] = await pedido;
      expect(consulta).toMatchObject({ kind: 'CONSULTATION', practitionerDisplayName: 'Dra. Rojas' });
      expect(consulta?.attendedAt).toEqual(new Date('2026-10-20T14:00:00.000Z'));
      expect(servicio).toMatchObject({ kind: 'SERVICE', serviceName: 'Ecografía abdominal' });
      expect(servicio?.attendedAt).toBeInstanceOf(Date);
    });

    it('con una API que todavía no manda los campos nuevos, la clave queda AUSENTE', async () => {
      const pedido = firstValueFrom(client.listMyQuestionnaires());
      http.expectOne((r) => r.url.endsWith('/surveys/me/invitations')).flush([BASE]);

      const [invitacion] = await pedido;
      expect(invitacion).toBeDefined();
      expect('attendedAt' in invitacion!).toBe(false);
      expect('kind' in invitacion!).toBe(false);
      // Lo de siempre sigue normalizado.
      expect(invitacion?.issuedAt).toEqual(new Date('2026-10-28T12:00:00.000Z'));
      expect(invitacion?.answeredAt).toBeNull();
    });

    it('un attendedAt en null llega como null, no como 1970', async () => {
      const pedido = firstValueFrom(client.listMyQuestionnaires());
      http
        .expectOne((r) => r.url.endsWith('/surveys/me/invitations'))
        .flush([{ ...BASE, kind: 'SERVICE', attendedAt: null }]);

      expect((await pedido)[0]?.attendedAt).toBeNull();
    });

    it('el detalle para responder trae los mismos campos que la lista', async () => {
      const pedido = firstValueFrom(client.getMyQuestionnaire('inv-1'));
      http.expectOne((r) => r.url.endsWith('/surveys/me/invitations/inv-1')).flush({
        ...BASE,
        kind: 'CONSULTATION',
        practitionerDisplayName: 'Dra. Rojas',
        attendedAt: '2026-10-20T14:00:00.000Z',
        questions: [],
      });

      const cuestionario = await pedido;
      expect(cuestionario.kind).toBe('CONSULTATION');
      expect(cuestionario.attendedAt).toEqual(new Date('2026-10-20T14:00:00.000Z'));
      expect(cuestionario.questions).toEqual([]);
    });
  });
});
