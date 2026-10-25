import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MedicalGroupsClient } from './medical-groups.client';
import type { MedicalGroup, MedicalGroupPage } from './medical-groups.types';

/**
 * Lo que fijan estas pruebas es el contrato con `MedicalGroupsController`: verbo,
 * ruta exacta, **sólo** las claves que sus DTO admiten (`forbidNonWhitelisted`
 * vuelve un 400 cualquier propiedad de más) y la normalización de los `null`
 * con los que el servidor manda los opcionales vacíos.
 */
describe('MedicalGroupsClient', () => {
  let client: MedicalGroupsClient;
  let http: HttpTestingController;

  const GROUP_ID = '11111111-1111-4111-8111-111111111111';
  const MEMBER_ID = '22222222-2222-4222-8222-222222222222';

  /** La ficha como la manda el servidor: los opcionales vacíos van en `null`. */
  const WIRE_GROUP = {
    id: GROUP_ID,
    serviceCatalogId: 'svc-1',
    requestingPractitionerId: 'pr-1',
    patientProfileId: null,
    conditionId: null,
    scheduledAt: '2026-11-05T14:00:00.000Z',
    locationText: 'Quirófano 2',
    notesText: null,
    termsText: 'Términos del servicio.',
    status: 'PENDING_TEAM',
    exerciseNotesText: null,
    exerciseNotesUpdatedAt: null,
    proposedRescheduleAt: null,
    proposedByPractitionerId: null,
    isRealized: false,
    canEditExerciseNotes: false,
    isClosed: false,
    createdAt: '2026-10-24T10:00:00.000Z',
    members: [
      {
        id: MEMBER_ID,
        practitionerProfileId: 'pr-2',
        roleTitle: 'Anestesiólogo',
        agreedPaymentAmount: '500.00',
        agreedPaymentCurrencyConceptId: null,
        additionalTermsText: null,
        isCreator: false,
        invitationStatus: 'PENDING',
        respondedAt: null,
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(MedicalGroupsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('list', () => {
    it('pide la pestaña y nada más cuando no hay paginación', () => {
      client.list('recibidas').subscribe();

      const req = http.expectOne((r) => r.url === '/medical-groups');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual(['tab']);
      expect(req.request.params.get('tab')).toBe('recibidas');
      req.flush({ items: [], nextCursor: null });
    });

    it('manda cursor y limit sólo si vienen', () => {
      client.list('historico', { cursor: 'abc', limit: 10 }).subscribe();

      const req = http.expectOne((r) => r.url === '/medical-groups');
      expect(req.request.params.get('cursor')).toBe('abc');
      expect(req.request.params.get('limit')).toBe('10');
      req.flush({ items: [], nextCursor: null });
    });

    it('quita los null de cada fila y conserva el null del final de la lista', () => {
      let page: MedicalGroupPage | undefined;
      client.list('enviadas').subscribe((value) => (page = value));

      http.expectOne((r) => r.url === '/medical-groups').flush({
        items: [
          {
            id: GROUP_ID,
            serviceCatalogId: 'svc-1',
            scheduledAt: '2026-11-05T14:00:00.000Z',
            locationText: 'Quirófano 2',
            status: 'SCHEDULED',
            isCreator: true,
            patientProfileId: null,
            pendingMembersCount: 0,
          },
        ],
        nextCursor: null,
      });

      expect(page?.items[0]).not.toHaveProperty('patientProfileId');
      expect(page?.items[0]?.pendingMembersCount).toBe(0);
      expect(page?.nextCursor).toBeNull();
    });

    it('devuelve el cursor de la página siguiente', () => {
      let page: MedicalGroupPage | undefined;
      client.list('historico').subscribe((value) => (page = value));

      http.expectOne((r) => r.url === '/medical-groups').flush({ items: [], nextCursor: 'sig' });

      expect(page?.nextCursor).toBe('sig');
    });
  });

  describe('get', () => {
    it('lee la ficha y deja sin clave lo que el servidor mandó en null', () => {
      let group: MedicalGroup | undefined;
      client.get(GROUP_ID).subscribe((value) => (group = value));

      const req = http.expectOne(`/medical-groups/${GROUP_ID}`);
      expect(req.request.method).toBe('GET');
      req.flush(WIRE_GROUP);

      expect(group).toBeDefined();
      expect(group).not.toHaveProperty('patientProfileId');
      expect(group).not.toHaveProperty('proposedRescheduleAt');
      expect(group?.members[0]).not.toHaveProperty('respondedAt');
      expect(group?.members[0]?.roleTitle).toBe('Anestesiólogo');
      // El importe es texto decimal y así se queda.
      expect(group?.members[0]?.agreedPaymentAmount).toBe('500.00');
    });

    it('codifica el identificador en la ruta', () => {
      client.get('a/b').subscribe();

      http.expectOne('/medical-groups/a%2Fb').flush(WIRE_GROUP);
    });
  });

  describe('listPatientConditions', () => {
    it('cuelga de /medical-groups/patients/:id/conditions y no de /clinical', () => {
      let first: { id: string; onsetAt?: string } | undefined;
      client.listPatientConditions('pat-1').subscribe((rows) => (first = rows[0]));

      const req = http.expectOne('/medical-groups/patients/pat-1/conditions');
      expect(req.request.method).toBe('GET');
      req.flush([
        { id: 'c-1', code: 'I10', display: 'Hipertensión', onsetAt: null, isMostRecent: true },
      ]);

      expect(first).toEqual({ id: 'c-1', code: 'I10', display: 'Hipertensión', isMostRecent: true });
    });
  });

  describe('escrituras', () => {
    it('el alta manda exactamente el cuerpo recibido, sin claves de más', () => {
      const body = {
        serviceCatalogId: 'svc-1',
        scheduledAt: '2026-11-05T14:00:00.000Z',
        locationText: 'Quirófano 2',
        members: [
          { practitionerProfileId: 'pr-2', roleTitle: 'Anestesiólogo', agreedPaymentAmount: '500' },
        ],
      };
      let group: MedicalGroup | undefined;
      client.create(body).subscribe((value) => (group = value));

      const req = http.expectOne('/medical-groups');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      expect(Object.keys(req.request.body as object).sort()).toEqual([
        'locationText',
        'members',
        'scheduledAt',
        'serviceCatalogId',
      ]);
      req.flush(WIRE_GROUP);

      expect(group?.id).toBe(GROUP_ID);
    });

    it('la respuesta a la invitación lleva el grupo y el cargo en la ruta y sólo `decision` en el cuerpo', () => {
      client.respondToInvitation(GROUP_ID, MEMBER_ID, 'ACCEPTED').subscribe();

      const req = http.expectOne(`/medical-groups/${GROUP_ID}/members/${MEMBER_ID}/respond`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ decision: 'ACCEPTED' });
      req.flush(WIRE_GROUP);
    });

    it('proponer otro horario manda sólo `proposedAt`', () => {
      client.requestReschedule(GROUP_ID, '2026-11-06T15:00:00.000Z').subscribe();

      const req = http.expectOne(`/medical-groups/${GROUP_ID}/reschedule-requests`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ proposedAt: '2026-11-06T15:00:00.000Z' });
      req.flush(WIRE_GROUP);
    });

    it('resolver el cambio de horario va a /respond con sólo `decision`', () => {
      client.respondToReschedule(GROUP_ID, 'REJECTED').subscribe();

      const req = http.expectOne(`/medical-groups/${GROUP_ID}/reschedule-requests/respond`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ decision: 'REJECTED' });
      req.flush(WIRE_GROUP);
    });

    it('las notas del ejercicio van por PATCH con sólo `notesText`', () => {
      client.updateExerciseNotes(GROUP_ID, 'Sin complicaciones.').subscribe();

      const req = http.expectOne(`/medical-groups/${GROUP_ID}/exercise-notes`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ notesText: 'Sin complicaciones.' });
      req.flush(WIRE_GROUP);
    });
  });
});
