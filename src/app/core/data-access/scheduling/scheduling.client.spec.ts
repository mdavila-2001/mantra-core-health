import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SchedulingClient } from './scheduling.client';
import type { Booking, AgendaSlot } from './scheduling.types';

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
});
