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
          operatingRoom: { id: 'or-1', code: 'QX-01', name: 'Quirófano 1' },
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

  /*
   * Antes: «sin tiempos → lista vacía». Era el defecto B1: una lista vacía
   * inventada dejaba la botonera derivando el orden de un dato que la API no
   * mandó. Ahora lo ausente queda ausente y la ficha lo dice.
   */
  it('el detalle de la API actual (toSummary, sin campos de F4) deja ausente lo que no vino', () => {
    let detalle: SurgicalCaseDetail | null = null;
    client.getCase('c-1').subscribe((d) => (detalle = d));
    // Forma literal de `CaseDetailDto` hoy: `case` es `toSummary` y no hay roomEvents ni turnoverCleaning.
    http.expectOne('/procedure-cases/c-1').flush({
      case: { id: 'c-1', caseNumber: 'CX-1', patientProfileId: 'p', primarySurgeonProfileId: 's', operatingRoomId: 'or-1', statusConceptId: 'st', scheduledStartAt: '2026-11-02T12:00:00.000Z', scheduledEndAt: '2026-11-02T14:00:00.000Z' },
      diagnoses: [],
      team: [],
      milestones: [],
      preoperativeOrders: [],
      operativeReports: [],
      operativeSteps: [],
      findings: [],
      implants: [],
    });
    expect(detalle!.roomEvents).toBeUndefined();
    expect('turnoverCleaning' in detalle!).toBe(false);
    expect(detalle!.checklistReported).toBe(false);
    expect(detalle!.case.operatingRoomId).toBe('or-1');
    expect(detalle!.case.operatingRoom).toBeUndefined();
  });

  it('con la API de `3036730d2`: cabecera de F4, check-list del detalle, tiempos y recambio', () => {
    let detalle: SurgicalCaseDetail | null = null;
    client.getCase('c-1').subscribe((d) => (detalle = d));
    // Forma literal de `toSummary(c, or)` + `CaseOrViewBuilder.detail`.
    http.expectOne('/procedure-cases/c-1').flush({
      case: {
        id: 'c-1', caseNumber: 'CX-1', patientProfileId: 'p', statusConceptId: 'st', operatingRoomId: 'or-1',
        operatingRoom: { id: 'or-1', code: 'QX-01', name: 'Quirófano 1' }, block: { id: 'b-1', label: 'Traumatología' },
        caseType: { code: 'ELECTIVE', display: 'Elective' }, encounterId: 'enc-1',
        reservedStartAt: '2026-11-02T11:40:00.000Z', reservedEndAt: '2026-11-02T14:30:00.000Z', prepMinutes: 20, cleanupMinutes: 30,
      },
      checklist: { id: 'k-1', signIn: { completedAt: '2026-11-02T11:50:00.000Z' }, timeOut: { completedAt: null }, signOut: { completedAt: null } },
      roomEvents: [{ id: 'e', eventCode: 'PATIENT_IN_ROOM', occurredAt: '2026-11-02T12:00:00.000Z', recordedByUserId: 'u' }],
      turnoverCleaning: { id: 'co', status: 'CLN_PENDING', rowVersion: 1, allowedTransitions: ['start', 'cancel'] },
      team: [],
    });
    expect(detalle!.case.operatingRoom).toEqual({ id: 'or-1', code: 'QX-01', name: 'Quirófano 1' });
    expect(detalle!.case.block).toEqual({ id: 'b-1', label: 'Traumatología' });
    expect(detalle!.case.encounterId).toBe('enc-1');
    expect(detalle!.checklist?.signIn.completedAt).toBe('2026-11-02T11:50:00.000Z');
    expect(detalle!.checklistReported).toBe(true);
    expect(detalle!.roomEvents?.map((e) => e.eventCode)).toEqual(['PATIENT_IN_ROOM']);
    expect(detalle!.turnoverCleaning).toEqual({ id: 'co', statusCode: 'CLN_PENDING', rowVersion: 1, allowedTransitions: ['start', 'cancel'] });
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
    // Forma de `RecordRoomEventUseCase`: con la orden de recambio (null salvo en la salida).
    let result: unknown = null;
    evento.flush({ utilizationEventId: 'u', milestoneId: 'm', cleaningOrderId: null });
    client.recordRoomEvent('c', 'PATIENT_OUT_OF_ROOM', '2026-11-02T14:00:00.000Z').subscribe((r) => (result = r));
    http.expectOne('/procedure-cases/c/room-events').flush({ utilizationEventId: 'u2', milestoneId: 'm2', cleaningOrderId: 'co-1' });
    expect(result).toEqual({ utilizationEventId: 'u2', milestoneId: 'm2', cleaningOrderId: 'co-1' });
  });
});
