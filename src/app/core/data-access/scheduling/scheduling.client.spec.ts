import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SchedulingClient } from './scheduling.client';
import type {
  AgendaResourceCreated,
  AgendaSlot,
  AvailabilityExceptionCreated,
  Booking,
  BookingPolicyCreated,
  DelayNoticeResult,
  ScheduleTemplateCreated,
  SlotsGenerated,
  WaitlistPage,
} from './scheduling.types';
import { esReconsulta, motivoDeReconsulta, type BookingConReconsulta } from './follow-up.types';

const DESDE = new Date('2026-08-08T00:00:00.000Z');
const HASTA = new Date('2026-08-15T00:00:00.000Z');

describe('SchedulingClient', () => {
  let client: SchedulingClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(SchedulingClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * El backend valida con `forbidNonWhitelisted`: un opcional presente en
   * `undefined` viaja como clave declarada y la petición vuelve con 400. Es el
   * defecto más fácil de introducir y el más difícil de ver en una captura.
   */
  it('listResources manda sólo tenantId cuando no hay más filtros', () => {
    client.listResources({ tenantId: 't-1' }).subscribe();

    const req = http.expectOne((r) => r.url === '/scheduling/resources');
    expect(req.request.params.get('tenantId')).toBe('t-1');
    expect(req.request.params.has('practiceId')).toBe(false);
    expect(req.request.params.has('resourceType')).toBe(false);
    expect(req.request.params.has('includeInactive')).toBe(false);

    req.flush({ items: [], count: 0 });
  });

  it('listSlots manda la ventana en ISO 8601', () => {
    client.listSlots({ from: DESDE, to: HASTA, limit: 100 }).subscribe();

    const req = http.expectOne((r) => r.url === '/scheduling/slots');
    expect(req.request.params.get('from')).toBe(DESDE.toISOString());
    expect(req.request.params.get('to')).toBe(HASTA.toISOString());
    expect(req.request.params.get('limit')).toBe('100');
    expect(req.request.params.has('resourceId')).toBe(false);

    req.flush({ items: [], count: 0, limit: 100, truncated: false });
  });

  it('listSlots convierte los instantes de cada cupo en fechas', () => {
    let cupos: readonly AgendaSlot[] = [];
    client.listSlots({ from: DESDE, to: HASTA }).subscribe((p) => (cupos = p.items));

    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({
        items: [
          {
            id: 's-1',
            resourceId: 'r-1',
            scheduleTemplateId: null,
            startAt: '2026-08-08T13:00:00.000Z',
            endAt: '2026-08-08T13:30:00.000Z',
            capacity: 2,
            remainingCapacity: 1,
            statusConceptId: 'c-open',
            serviceConceptId: null,
          },
        ],
        count: 1,
        limit: 200,
        truncated: false,
      });

    expect(cupos[0].startAt).toBeInstanceOf(Date);
    expect(cupos[0].startAt.toISOString()).toBe('2026-08-08T13:00:00.000Z');
    expect(cupos[0].endAt).toBeInstanceOf(Date);
  });

  /**
   * El contrato admite una cita sin cupo (`startAt: null`). Si el `null`
   * sobreviviera, cada pantalla tendría que comprobar dos formas de ausencia y
   * tarde o temprano alguna comprobaría una sola.
   */
  it('searchBookings normaliza a ausencia el instante nulo de una cita sin cupo', () => {
    let citas: readonly Booking[] = [];
    client.searchBookings().subscribe((p) => (citas = p.items));

    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush({
        items: [
          {
            id: 'b-1',
            statusConceptId: 'c-conf',
            startAt: null,
            endAt: null,
            createdAt: '2026-08-01T10:00:00.000Z',
          },
        ],
        count: 1,
        limit: 100,
        truncated: false,
      });

    expect(citas[0].startAt).toBeUndefined();
    expect('startAt' in citas[0]).toBe(false);
    expect(citas[0].createdAt).toBeInstanceOf(Date);
  });

  it('searchBookings sin filtros no declara ninguna clave', () => {
    client.searchBookings().subscribe();

    const req = http.expectOne((r) => r.url === '/scheduling/bookings');
    expect(req.request.params.keys()).toEqual([]);

    req.flush({ items: [], count: 0, limit: 100, truncated: false });
  });

  it('searchBookings traduce includeCancelled a texto, que es como lo lee el backend', () => {
    client.searchBookings({ includeCancelled: true }).subscribe();

    const req = http.expectOne((r) => r.url === '/scheduling/bookings');
    expect(req.request.params.get('includeCancelled')).toBe('true');

    req.flush({ items: [], count: 0, limit: 100, truncated: false });
  });

  it('getBooking escapa el identificador en la ruta', () => {
    client.getBooking('b/1').subscribe();

    const req = http.expectOne('/scheduling/bookings/b%2F1');
    req.flush({
      id: 'b/1',
      statusConceptId: 'c-conf',
      createdAt: '2026-08-01T10:00:00.000Z',
    });
  });

  /* ---- el ciclo de reserva: hold → confirm ------------------------------- */

  it('placeHold sin paciente manda el cuerpo vacío, no una clave en undefined', () => {
    client.placeHold('s-1').subscribe();

    const req = http.expectOne('/scheduling/slots/s-1/holds');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({
      id: 'h-1',
      holdToken: 'tok-1',
      expiresAt: '2026-08-10T13:05:00.000Z',
      remainingCapacity: 1,
    });
  });

  it('placeHold convierte el vencimiento de la retención en fecha', () => {
    let retencion: { expiresAt: Date } | undefined;
    client.placeHold('s-1', { patientProfileId: 'pp-1' }).subscribe((hold) => (retencion = hold));

    const req = http.expectOne('/scheduling/slots/s-1/holds');
    expect(req.request.body).toEqual({ patientProfileId: 'pp-1' });

    req.flush({
      id: 'h-1',
      holdToken: 'tok-1',
      expiresAt: '2026-08-10T13:05:00.000Z',
      remainingCapacity: 0,
    });

    expect(retencion?.expiresAt).toBeInstanceOf(Date);
    expect(retencion?.expiresAt.toISOString()).toBe('2026-08-10T13:05:00.000Z');
  });

  it('confirmHold manda el token por la ruta y el motivo sólo si existe', () => {
    client
      .confirmHold('tok-1', {
        tenantId: 't-1',
        patientProfileId: 'pp-1',
        channel: 'DESK',
      })
      .subscribe();

    const req = http.expectOne('/scheduling/holds/tok-1/confirm');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      patientProfileId: 'pp-1',
      channel: 'DESK',
    });

    req.flush({
      id: 'b-9',
      bookableSlotId: 's-1',
      statusConceptId: 'c-conf',
      remindersScheduled: 0,
    });
  });

  it('cancelBooking manda el motivo y no manda isNoShow si nadie lo marcó', () => {
    client
      .cancelBooking('b-1', { cancelledBy: 'PROVIDER', reasonText: 'El profesional se enfermó' })
      .subscribe();

    const req = http.expectOne('/scheduling/bookings/b-1/cancel');
    // `isNoShow` es lo que dispara el cargo de la política: mandarlo en falso
    // es distinto de no mandarlo sólo para quien lea el cuerpo, pero mandarlo
    // en `undefined` es un 400 seguro. `reasonText` sí va siempre: el servidor
    // lo exige desde la corrección #14.
    expect(req.request.body).toEqual({
      cancelledBy: 'PROVIDER',
      reasonText: 'El profesional se enfermó',
    });

    req.flush({ bookingId: 'b-1', capacityReleased: true });
  });

  it('rescheduleBooking manda toSlotId y el motivo obligatorio', () => {
    let resultado: { bookingId: string } | undefined;
    client
      .rescheduleBooking('b-1', { toSlotId: 's-2', reasonText: 'Se superpone con una cirugía' })
      .subscribe((r) => (resultado = r));

    const req = http.expectOne('/scheduling/bookings/b-1/reschedule');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      toSlotId: 's-2',
      reasonText: 'Se superpone con una cirugía',
    });

    req.flush({ bookingId: 'b-1', fromSlotId: 's-1', toSlotId: 's-2' });
    expect(resultado?.bookingId).toBe('b-1');
  });

  it('requestHold pide el turno por la ruta de solicitud, no por la de confirmación', () => {
    let resultado: { statusConceptId: string } | undefined;
    client
      .requestHold('tok-1', {
        tenantId: 't-1',
        patientProfileId: 'pp-1',
        channel: 'PORTAL',
        reasonText: 'Control anual',
      })
      .subscribe((r) => (resultado = r));

    const req = http.expectOne('/scheduling/holds/tok-1/request');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      patientProfileId: 'pp-1',
      channel: 'PORTAL',
      reasonText: 'Control anual',
    });

    req.flush({
      id: 'b-9',
      bookableSlotId: 's-1',
      statusConceptId: 'c-pend',
      remindersScheduled: 0,
    });
    expect(resultado?.statusConceptId).toBe('c-pend');
  });

  it('aceptar manda el cuerpo vacío y convierte el instante de la decisión', () => {
    let decision: { statusConceptId: string; occurredAt: Date } | undefined;
    client.acceptBooking('b-1').subscribe((d) => (decision = d));

    const req = http.expectOne('/scheduling/bookings/b-1/accept');
    expect(req.request.method).toBe('POST');
    // Sin recordatorios pedidos no viaja la clave: en `undefined` sería un 400.
    expect(req.request.body).toEqual({});

    req.flush({
      bookingId: 'b-1',
      statusConceptId: 'c-conf',
      occurredAt: '2026-08-15T12:00:00.000Z',
    });
    expect(decision?.occurredAt).toEqual(new Date('2026-08-15T12:00:00.000Z'));
  });

  it('aceptar con recordatorios los manda', () => {
    client.acceptBooking('b-1', [1440, 120]).subscribe();

    const req = http.expectOne('/scheduling/bookings/b-1/accept');
    expect(req.request.body).toEqual({ reminderOffsetsMinutes: [1440, 120] });
    req.flush({ bookingId: 'b-1', statusConceptId: 'c', occurredAt: '2026-08-15T12:00:00.000Z' });
  });

  it('rechazar manda el motivo obligatorio', () => {
    client.rejectBooking('b-1', 'La agenda de ese día se cerró').subscribe();

    const req = http.expectOne('/scheduling/bookings/b-1/reject');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reasonText: 'La agenda de ese día se cerró' });
    req.flush({ bookingId: 'b-1', capacityReleased: true });
  });

  it('iniciar y completar pegan a su propia ruta, sin datos de fecha', () => {
    client.startBooking('b-1').subscribe();
    const inicio = http.expectOne('/scheduling/bookings/b-1/start');
    // Ningún dato de reloj viaja: la corrección #15 es que la fecha no decide.
    expect(inicio.request.body).toEqual({});
    inicio.flush({
      bookingId: 'b-1',
      statusConceptId: 'c',
      occurredAt: '2026-08-15T12:00:00.000Z',
    });

    client.completeBooking('b-1').subscribe();
    const cierre = http.expectOne('/scheduling/bookings/b-1/complete');
    expect(cierre.request.body).toEqual({});
    cierre.flush({
      bookingId: 'b-1',
      statusConceptId: 'c',
      occurredAt: '2026-08-15T12:30:00.000Z',
    });
  });

  it('una cita con motivo de cambio lo entrega con la fecha convertida', () => {
    let recibida: { statusReason?: { reasonText: string; changedAt: Date } } | undefined;
    client.getBooking('b-1').subscribe((b) => (recibida = b));

    http.expectOne('/scheduling/bookings/b-1').flush({
      id: 'b-1',
      statusConceptId: 'c-canc',
      createdAt: '2026-08-01T10:00:00.000Z',
      statusReason: {
        reasonText: 'El profesional se enfermó',
        actorKind: 'PROVIDER',
        changedAt: '2026-08-02T09:00:00.000Z',
      },
    });

    expect(recibida?.statusReason?.reasonText).toBe('El profesional se enfermó');
    expect(recibida?.statusReason?.changedAt).toEqual(new Date('2026-08-02T09:00:00.000Z'));
  });

  it('rescheduleBooking incluye reasonText cuando se dio', () => {
    client
      .rescheduleBooking('b-1', { toSlotId: 's-2', reasonText: 'Cambio de horario' })
      .subscribe();

    const req = http.expectOne('/scheduling/bookings/b-1/reschedule');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ toSlotId: 's-2', reasonText: 'Cambio de horario' });

    req.flush({ bookingId: 'b-1', fromSlotId: 's-1', toSlotId: 's-2' });
  });

  it('checkInBooking convierte la marca de llegada en fecha', () => {
    let llegada: { checkedInAt: Date } | undefined;
    client.checkInBooking('b-1').subscribe((resultado) => (llegada = resultado));

    const req = http.expectOne('/scheduling/bookings/b-1/check-in');
    expect(req.request.body).toEqual({});

    req.flush({ bookingId: 'b-1', checkedInAt: '2026-08-12T14:00:00.000Z' });

    expect(llegada?.checkedInAt).toBeInstanceOf(Date);
  });

  /* ---- construcción de agenda: recurso → política → plantilla → slots →
     excepción. En todas se verifica lo mismo que en el ciclo de reserva: los
     opcionales ausentes NO viajan, porque en `undefined` son un 400. --------- */

  it('createResource omite los opcionales que no se dieron', () => {
    let creado: AgendaResourceCreated | undefined;
    client
      .createResource({
        tenantId: 't-1',
        resourceType: 'PRACTITIONER',
        resourceRefType: 'practitioner_profiles',
        resourceRefId: 'hp-1',
        name: 'Dra. Ríos',
      })
      .subscribe((r) => (creado = r));

    const req = http.expectOne('/scheduling/resources');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      resourceType: 'PRACTITIONER',
      resourceRefType: 'practitioner_profiles',
      resourceRefId: 'hp-1',
      name: 'Dra. Ríos',
    });

    req.flush({ id: 'res-1', name: 'Dra. Ríos', stateConceptId: 'c-active' });
    expect(creado?.id).toBe('res-1');
  });

  it('createResource incluye los opcionales presentes', () => {
    client
      .createResource({
        tenantId: 't-1',
        resourceType: 'ROOM',
        resourceRefType: 'practice_sites',
        resourceRefId: 'ps-1',
        name: 'Box 3',
        practiceId: 'pr-1',
        timeZone: 'America/La_Paz',
        capacity: 2,
      })
      .subscribe();

    const req = http.expectOne('/scheduling/resources');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      resourceType: 'ROOM',
      resourceRefType: 'practice_sites',
      resourceRefId: 'ps-1',
      name: 'Box 3',
      practiceId: 'pr-1',
      timeZone: 'America/La_Paz',
      capacity: 2,
    });

    req.flush({ id: 'res-2', name: 'Box 3', stateConceptId: 'c-active' });
  });

  it('createPolicy manda code y name y omite los ajustes ausentes', () => {
    let creada: BookingPolicyCreated | undefined;
    client
      .createPolicy({ tenantId: 't-1', code: 'POL-STD', name: 'Estándar', holdTtlSeconds: 300 })
      .subscribe((p) => (creada = p));

    const req = http.expectOne('/scheduling/booking-policies');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      code: 'POL-STD',
      name: 'Estándar',
      holdTtlSeconds: 300,
    });

    req.flush({ id: 'pol-1', code: 'POL-STD', stateConceptId: 'c-active' });
    expect(creada?.id).toBe('pol-1');
  });

  it('createTemplate escapa el recurso y limpia los opcionales de cada franja', () => {
    let creada: ScheduleTemplateCreated | undefined;
    client
      .createTemplate('res/1', {
        name: 'Mañanas',
        rules: [
          { dayOfWeek: 1, startTime: '08:00', endTime: '12:00', slotMinutes: 30 },
          { dayOfWeek: 3, startTime: '08:00', endTime: '12:00' },
        ],
        bookingPolicyId: 'pol-1',
      })
      .subscribe((t) => (creada = t));

    const req = http.expectOne('/scheduling/resources/res%2F1/templates');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Mañanas',
      rules: [
        { dayOfWeek: 1, startTime: '08:00', endTime: '12:00', slotMinutes: 30 },
        { dayOfWeek: 3, startTime: '08:00', endTime: '12:00' },
      ],
      bookingPolicyId: 'pol-1',
    });

    req.flush({ id: 'tpl-1', name: 'Mañanas', ruleCount: 2, statusConceptId: 'c-active' });
    expect(creada?.id).toBe('tpl-1');
  });

  it('generateSlots escapa la plantilla y manda sólo la ventana', () => {
    let resultado: SlotsGenerated | undefined;
    client
      .generateSlots('tpl/1', {
        from: '2026-08-18T00:00:00.000Z',
        to: '2026-08-25T00:00:00.000Z',
      })
      .subscribe((r) => (resultado = r));

    const req = http.expectOne('/scheduling/templates/tpl%2F1/generate-slots');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      from: '2026-08-18T00:00:00.000Z',
      to: '2026-08-25T00:00:00.000Z',
    });

    req.flush({ templateId: 'tpl/1', created: 40, skipped: 0 });
    expect(resultado?.created).toBe(40);
  });

  it('createException escapa el recurso y omite los opcionales ausentes', () => {
    let creada: AvailabilityExceptionCreated | undefined;
    client
      .createException('res/1', {
        exceptionType: 'HOLIDAY',
        startAt: '2026-09-14T00:00:00.000Z',
        endAt: '2026-09-15T00:00:00.000Z',
      })
      .subscribe((e) => (creada = e));

    const req = http.expectOne('/scheduling/resources/res%2F1/exceptions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      exceptionType: 'HOLIDAY',
      startAt: '2026-09-14T00:00:00.000Z',
      endAt: '2026-09-15T00:00:00.000Z',
    });

    req.flush({ id: 'exc-1', blockedSlots: 6 });
    expect(creada?.blockedSlots).toBe(6);
  });

  /* ======================================================================
     P8 · lista de espera y avisos de demora
     ====================================================================== */

  it('enrollWaitlist omite los opcionales ausentes y manda las fechas en ISO', () => {
    client
      .enrollWaitlist({
        tenantId: 't-1',
        patientProfileId: 'p-1',
        resourceId: 'r-1',
        desiredFrom: DESDE,
        desiredTo: HASTA,
      })
      .subscribe();

    const req = http.expectOne('/scheduling/waitlist');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      patientProfileId: 'p-1',
      resourceId: 'r-1',
      desiredFrom: DESDE.toISOString(),
      desiredTo: HASTA.toISOString(),
    });
    // `priority` no viaja: con `forbidNonWhitelisted`, una clave en `undefined`
    // vuelve 400.
    expect(Object.keys(req.request.body as object)).not.toContain('priority');

    req.flush({ id: 'w-1', priority: 0, statusConceptId: 'c-activa' });
  });

  it('listWaitlist pide sólo las activas por omisión y convierte las fechas', () => {
    let pagina: WaitlistPage | undefined;
    client.listWaitlist({ patientProfileId: 'p-1' }).subscribe((p) => (pagina = p));

    const req = http.expectOne((r) => r.url === '/scheduling/waitlist');
    expect(req.request.params.get('patientProfileId')).toBe('p-1');
    expect(req.request.params.has('includeClosed')).toBe(false);
    expect(req.request.params.has('limit')).toBe(false);

    req.flush({
      items: [
        {
          id: 'w-1',
          patientProfileId: 'p-1',
          resourceId: 'r-1',
          resourceLabel: 'Dra. Rivas',
          desiredFrom: '2026-08-18T00:00:00.000Z',
          desiredTo: null,
          priority: 0,
          statusConceptId: 'c-activa',
          createdAt: '2026-08-17T10:00:00.000Z',
        },
      ],
    });

    expect(pagina?.items[0].resourceLabel).toBe('Dra. Rivas');
    expect(pagina?.items[0].desiredFrom).toEqual(new Date('2026-08-18T00:00:00.000Z'));
    // `null` se normaliza a ausencia, como en las citas: un `null` conviviendo
    // con `undefined` obliga a comprobar los dos en cada pantalla.
    expect(pagina?.items[0].desiredTo).toBeUndefined();
    expect(pagina?.items[0].createdAt).toEqual(new Date('2026-08-17T10:00:00.000Z'));
  });

  it('listWaitlist declara includeClosed sólo cuando se pide', () => {
    client.listWaitlist({ patientProfileId: 'p-1', includeClosed: true, limit: 5 }).subscribe();

    const req = http.expectOne((r) => r.url === '/scheduling/waitlist');
    expect(req.request.params.get('includeClosed')).toBe('true');
    expect(req.request.params.get('limit')).toBe('5');

    req.flush({ items: [] });
  });

  it('delayBooking escapa el id y omite el mensaje vacío', () => {
    let resultado: DelayNoticeResult | undefined;
    client
      .delayBooking('bk/1', { delayMinutes: 20, message: '' })
      .subscribe((r) => (resultado = r));

    const req = http.expectOne('/scheduling/bookings/bk%2F1/delay');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ delayMinutes: 20 });

    req.flush({ notified: 1, affected: 1, bookingIds: ['bk/1'], detail: 'ok' });
    expect(resultado?.notified).toBe(1);
  });

  it('delayResource manda la ventana en ISO cuando se acota', () => {
    client
      .delayResource('r-1', {
        delayMinutes: 30,
        message: 'Estoy en una urgencia',
        from: DESDE,
        to: HASTA,
      })
      .subscribe();

    const req = http.expectOne('/scheduling/resources/r-1/delay');
    expect(req.request.body).toEqual({
      delayMinutes: 30,
      message: 'Estoy en una urgencia',
      from: DESDE.toISOString(),
      to: HASTA.toISOString(),
    });

    req.flush({ notified: 0, affected: 0, bookingIds: [], detail: 'ok' });
  });

  it('la cita trae la demora informada con su instante convertido', () => {
    let recibida: Booking | undefined;
    client.getBooking('b-1').subscribe((b) => (recibida = b));

    http.expectOne('/scheduling/bookings/b-1').flush({
      id: 'b-1',
      statusConceptId: 'c-confirmada',
      createdAt: '2026-08-17T10:00:00.000Z',
      delayNotice: {
        delayMinutes: 20,
        message: 'Estoy en una urgencia',
        announcedAt: '2026-08-20T13:40:00.000Z',
      },
    });

    expect(recibida?.delayNotice?.delayMinutes).toBe(20);
    expect(recibida?.delayNotice?.announcedAt).toEqual(new Date('2026-08-20T13:40:00.000Z'));
  });

  it('una cita sin demora no inventa el campo', () => {
    let recibida: Booking | undefined;
    client.getBooking('b-1').subscribe((b) => (recibida = b));

    http.expectOne('/scheduling/bookings/b-1').flush({
      id: 'b-1',
      statusConceptId: 'c-confirmada',
      createdAt: '2026-08-17T10:00:00.000Z',
      delayNotice: null,
    });

    expect(recibida?.delayNotice).toBeUndefined();
  });
});

/**
 * `createDirectAppointment` con `followUpOf` (C4).
 *
 * El cuerpo de este cliente se arma **campo por campo**, así que lo que el
 * contrato declare y la lista no repita se descarta en silencio: la petición
 * sale sin el campo y nada falla. Es el defecto que ya dejó la modalidad sin
 * escribir, y por eso acá se afirma el cuerpo completo con `toEqual` y no la
 * presencia de una clave.
 */
describe('SchedulingClient · reconsulta', () => {
  let client: SchedulingClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(SchedulingClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const CITA = {
    patientProfileId: 'pp-1',
    resourceId: 'r-1',
    startAt: '2026-10-08T13:00:00.000Z',
    durationMinutes: 30,
    reasonText: 'Reconsulta: control de presión',
  } as const;

  it('manda followUpOf con sus dos campos y nada más', () => {
    client
      .createDirectAppointment({
        ...CITA,
        followUpOf: { bookingId: 'b-origen', encounterId: 'enc-1' },
      })
      .subscribe();

    const req = http.expectOne('/scheduling/appointments/direct');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'pp-1',
      resourceId: 'r-1',
      startAt: '2026-10-08T13:00:00.000Z',
      durationMinutes: 30,
      reasonText: 'Reconsulta: control de presión',
      followUpOf: { bookingId: 'b-origen', encounterId: 'enc-1' },
    });

    req.flush({
      bookingId: 'b-nueva',
      bookableSlotId: 's-nuevo',
      statusConceptId: 'c-conf',
      retractedSlots: 0,
    });
  });

  it('un encuentro ausente viaja como null explícito, que es lo que el contrato declara', () => {
    client
      .createDirectAppointment({ ...CITA, followUpOf: { bookingId: 'b-origen', encounterId: null } })
      .subscribe();

    const req = http.expectOne('/scheduling/appointments/direct');
    expect(req.request.body).toMatchObject({
      followUpOf: { bookingId: 'b-origen', encounterId: null },
    });

    req.flush({
      bookingId: 'b-nueva',
      bookableSlotId: 's-nuevo',
      statusConceptId: 'c-conf',
      retractedSlots: 0,
    });
  });

  it('sin followUpOf la clave NO se declara: una cita puntual sigue siendo la de antes', () => {
    client.createDirectAppointment(CITA).subscribe();

    const req = http.expectOne('/scheduling/appointments/direct');
    expect('followUpOf' in (req.request.body as object)).toBe(false);

    req.flush({
      bookingId: 'b-nueva',
      bookableSlotId: 's-nuevo',
      statusConceptId: 'c-conf',
      retractedSlots: 0,
    });
  });

  it('searchBookings devuelve followUpOf y followUpBookingId tal como llegan', () => {
    let citas: readonly BookingConReconsulta[] = [];
    client.searchBookings().subscribe((p) => (citas = p.items));

    http.expectOne((r) => r.url === '/scheduling/bookings').flush({
      items: [
        {
          id: 'b-reconsulta',
          statusConceptId: 'c-conf',
          createdAt: '2026-09-25T10:00:00.000Z',
          followUpOf: { bookingId: 'b-origen', encounterId: null },
          followUpBookingId: null,
        },
        {
          id: 'b-origen',
          statusConceptId: 'c-done',
          createdAt: '2026-09-01T10:00:00.000Z',
          followUpOf: null,
          followUpBookingId: 'b-reconsulta',
        },
      ],
      count: 2,
      limit: 100,
      truncated: false,
    });

    expect(citas[0].followUpOf).toEqual({ bookingId: 'b-origen', encounterId: null });
    expect(citas[1].followUpBookingId).toBe('b-reconsulta');
    // Y las fechas siguen convirtiéndose: los campos nuevos no atropellan nada.
    expect(citas[0].createdAt).toBeInstanceOf(Date);
  });

  it('getBooking también los devuelve, y esReconsulta los interpreta', () => {
    let cita: BookingConReconsulta | undefined;
    client.getBooking('b-reconsulta').subscribe((b) => (cita = b));

    http.expectOne('/scheduling/bookings/b-reconsulta').flush({
      id: 'b-reconsulta',
      statusConceptId: 'c-conf',
      createdAt: '2026-09-25T10:00:00.000Z',
      followUpOf: { bookingId: 'b-origen', encounterId: 'enc-1' },
      followUpBookingId: null,
    });

    expect(esReconsulta(cita!)).toBe(true);
    expect(cita!.followUpOf?.encounterId).toBe('enc-1');
  });

  it('una cita sin el campo no es una reconsulta, y eso no es un dato faltante', () => {
    let cita: BookingConReconsulta | undefined;
    client.getBooking('b-comun').subscribe((b) => (cita = b));

    http
      .expectOne('/scheduling/bookings/b-comun')
      .flush({ id: 'b-comun', statusConceptId: 'c-conf', createdAt: '2026-09-25T10:00:00.000Z' });

    expect(esReconsulta(cita!)).toBe(false);
  });
});

describe('motivoDeReconsulta', () => {
  it('antepone «Reconsulta: » al motivo de la consulta de origen', () => {
    expect(motivoDeReconsulta('Control de presión arterial')).toBe(
      'Reconsulta: Control de presión arterial',
    );
  });

  it('no duplica el prefijo cuando el origen ya era una reconsulta', () => {
    expect(motivoDeReconsulta('Reconsulta: Control de presión arterial')).toBe(
      'Reconsulta: Control de presión arterial',
    );
  });

  it('sin motivo de origen deja la palabra sola, que igual dice algo', () => {
    expect(motivoDeReconsulta(null)).toBe('Reconsulta');
    expect(motivoDeReconsulta(undefined)).toBe('Reconsulta');
    expect(motivoDeReconsulta('   ')).toBe('Reconsulta');
  });
});
