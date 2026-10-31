import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProceduresClient } from './procedures.client';
import type { SurgicalCaseDetail, SurgicalCasePage } from './procedures.types';

/** F4 · quirófanos: lo que el cliente agrega sobre el contrato de antes. */
describe('ProceduresClient · F4', () => {
  let client: ProceduresClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(ProceduresClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('trae la sala resuelta y la ventana reservada como fechas', () => {
    let pagina: SurgicalCasePage | null = null;
    client.listAgenda().subscribe((p) => (pagina = p));
    http.expectOne('/procedure-cases').flush({
      items: [
        {
          id: 'c-1',
          caseNumber: 'CX-1',
          patientProfileId: 'p-1',
          statusConceptId: 'st',
          operatingRoom: { id: 'or-1', code: 'QX-01', name: 'Quirófano 1', path: 'Edificio A › Bloque quirúrgico' },
          scheduledStartAt: '2026-11-02T12:00:00.000Z',
          scheduledEndAt: '2026-11-02T14:00:00.000Z',
          reservedStartAt: '2026-11-02T11:40:00.000Z',
          reservedEndAt: '2026-11-02T14:30:00.000Z',
          prepMinutes: 20,
          cleanupMinutes: 30,
          block: null,
          checklist: null,
        },
      ],
      total: 1,
    });
    const caso = pagina!.items[0]!;
    expect(caso.operatingRoom?.code).toBe('QX-01');
    expect(caso.reservedStartAt).toBeInstanceOf(Date);
    expect(caso.reservedEndAt?.toISOString()).toBe('2026-11-02T14:30:00.000Z');
    // `null` del transporte = clave ausente, no `null` en la vista.
    expect('block' in caso).toBe(false);
  });

  it('el detalle sin tiempos de sala trae una lista vacía, no undefined', () => {
    let detalle: SurgicalCaseDetail | null = null;
    client.getCase('c-1').subscribe((d) => (detalle = d));
    http.expectOne('/procedure-cases/c-1').flush({ case: { id: 'c-1', caseNumber: 'CX-1', patientProfileId: 'p', statusConceptId: 's' } });
    expect(detalle!.roomEvents).toEqual([]);
  });

  it('programa con el cuerpo de ScheduleCaseDto', () => {
    const cuerpo = {
      custodianTenantId: 't',
      patientProfileId: 'p',
      caseType: 'ELECTIVE' as const,
      priority: 'ROUTINE' as const,
      primarySurgeonProfileId: 's',
      operatingRoomId: 'or-1',
      scheduledStartAt: '2026-11-02T12:00:00.000Z',
      scheduledEndAt: '2026-11-02T14:00:00.000Z',
    };
    client.scheduleCase(cuerpo).subscribe();
    const req = http.expectOne('/procedure-cases');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    req.flush({ id: 'c', caseNumber: 'CX', statusConceptId: 's', operatingRoomId: 'or-1' });
  });

  it('crea el check-list, responde una fase y registra un tiempo de sala', () => {
    client.createChecklist('c 1').subscribe();
    expect(http.expectOne('/procedure-cases/c%201/safety-checklists').request.method).toBe('POST');

    client
      .submitChecklistPhase('c', 'k', { phase: 'SIGN_IN', respondedByProfileId: 'r', responses: [{ itemId: 'i', status: 'CONFIRMED' }] })
      .subscribe();
    const fase = http.expectOne('/procedure-cases/c/safety-checklists/k/responses');
    expect(fase.request.body.phase).toBe('SIGN_IN');
    fase.flush({ checklistId: 'k', recorded: 1, phaseCompleted: true });

    client.recordRoomEvent('c', 'INCISION', '2026-11-02T12:30:00.000Z').subscribe();
    const evento = http.expectOne('/procedure-cases/c/room-events');
    expect(evento.request.body).toEqual({ eventCode: 'INCISION', occurredAt: '2026-11-02T12:30:00.000Z' });
    evento.flush({ utilizationEventId: 'u', milestoneId: 'm' });
  });
});
