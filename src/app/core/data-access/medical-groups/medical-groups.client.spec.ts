import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MedicalGroupsClient } from './medical-groups.client';
import type { MedicalGroup, MedicalGroupPage } from './medical-groups.types';

/**
 * El cliente de grupos médicos no decide nada: pega en la ruta del contrato
 * y convierte las fechas ISO a `Date`. Eso es lo que se fija.
 */
describe('MedicalGroupsClient', () => {
  let client: MedicalGroupsClient;
  let http: HttpTestingController;

  const wireGroup = {
    id: 'g 1',
    serviceCatalogId: 's-1',
    serviceName: 'Colecistectomía',
    requestingPractitionerId: 'p-1',
    patientName: null,
    scheduledAt: '2026-11-02T13:00:00.000Z',
    locationText: 'Quirófano 2',
    termsText: 'Términos',
    status: 'PENDING_TEAM',
    proposedRescheduleAt: null,
    isRealized: false,
    canEditExerciseNotes: false,
    isClosed: false,
    createdAt: '2026-10-25T10:00:00.000Z',
    members: [
      {
        id: 'm-1',
        practitionerProfileId: 'p-1',
        practitionerName: 'Paula Arce',
        roleTitle: 'Cirujana',
        agreedPaymentAmount: '0.00',
        isCreator: true,
        invitationStatus: 'ACCEPTED',
        respondedAt: '2026-10-25T10:00:00.000Z',
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

  afterEach(() => http.verify());

  it('lista la pestaña pedida, con el cursor, y convierte la fecha', () => {
    let page: MedicalGroupPage | undefined;
    client.list('recibidas', 'abc').subscribe((p) => (page = p));

    const request = http.expectOne(
      (r) =>
        r.url === '/medical-groups' &&
        r.params.get('tab') === 'recibidas' &&
        r.params.get('cursor') === 'abc',
    );
    request.flush({
      items: [{ ...wireGroup, pendingMembersCount: 1, isCreator: false }],
      nextCursor: null,
    });

    expect(page?.items[0]?.scheduledAt).toEqual(new Date('2026-11-02T13:00:00.000Z'));
    expect(page?.nextCursor).toBeNull();
  });

  it('lee un grupo con el id escapado y convierte todas sus fechas; un null no se vuelve fecha', () => {
    let group: MedicalGroup | undefined;
    client.get('g 1').subscribe((g) => (group = g));

    http.expectOne('/medical-groups/g%201').flush(wireGroup);

    expect(group?.scheduledAt).toBeInstanceOf(Date);
    expect(group?.createdAt).toBeInstanceOf(Date);
    expect(group?.members[0]?.respondedAt).toBeInstanceOf(Date);
    expect(group && 'proposedRescheduleAt' in group).toBe(false);
  });

  it('propone el cambio de horario como ISO y responde invitaciones y cambios con la decisión', () => {
    const proposed = new Date('2026-11-05T15:30:00.000Z');
    client.requestReschedule('g-1', proposed).subscribe();
    const reschedule = http.expectOne('/medical-groups/g-1/reschedule-requests');
    expect(reschedule.request.method).toBe('POST');
    expect(reschedule.request.body).toEqual({ proposedAt: '2026-11-05T15:30:00.000Z' });
    reschedule.flush(wireGroup);

    client.respondToInvitation('g-1', 'm-2', 'REJECTED').subscribe();
    const invitation = http.expectOne('/medical-groups/g-1/members/m-2/respond');
    expect(invitation.request.body).toEqual({ decision: 'REJECTED' });
    invitation.flush(wireGroup);

    client.respondToReschedule('g-1', 'ACCEPTED').subscribe();
    http.expectOne('/medical-groups/g-1/reschedule-requests/respond').flush(wireGroup);

    client.updateExerciseNotes('g-1', 'Sin complicaciones').subscribe();
    const notes = http.expectOne('/medical-groups/g-1/exercise-notes');
    expect(notes.request.method).toBe('PATCH');
    expect(notes.request.body).toEqual({ notesText: 'Sin complicaciones' });
    notes.flush(wireGroup);
  });
});
