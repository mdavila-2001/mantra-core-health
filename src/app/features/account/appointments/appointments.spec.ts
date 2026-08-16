import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionStore } from '../../../core/auth/session.store';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ValueSetOption } from '../../../core/data-access/terminology/terminology.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { Appointments, etiquetaDeRecurso } from './appointments';
import { sufijoDeCodigo, toBookingStatusPresentation } from './booking-status';

/**
 * El portal de turnos es el Acto 2 del recorrido de demo: la pantalla donde
 * alguien que nunca vio el sistema pide hora. Estas pruebas fijan lo que se
 * descubrió corriéndolo contra la API viva y no se deduce leyendo el código:
 *
 * - **El estado del turno se dice en castellano.** El catálogo devuelve
 *   `display: 'Booking confirmed'`, y mostrarlo tal cual le pone al paciente una
 *   etiqueta de API en inglés. La palabra la decide la interfaz a partir del
 *   `code`, que es la identidad semántica del concepto.
 * - **El tono del badge sale del mismo código**, no fijo en `info`: un turno
 *   cancelado y uno confirmado no pueden verse igual.
 * - **Sin perfil de paciente no se sale a la red.** El personal de salud tiene
 *   sesión válida y ninguna razón para tener turnos propios acá.
 */

/** base64url sobre UTF-8, como el token real. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const CONFIRMADO = 'c-confirmado';
const CANCELADO = 'c-cancelado';

/** Una cita tal como la devuelve `GET /scheduling/bookings`. */
function cita(id: string, statusConceptId: string): Record<string, unknown> {
  return {
    id,
    patientProfileId: 'pp-1',
    resourceId: 'r-1',
    bookableSlotId: 's-1',
    statusConceptId,
    startAt: '2026-08-12T13:00:00.000Z',
    endAt: '2026-08-12T13:30:00.000Z',
    createdAt: '2026-08-11T10:00:00.000Z',
    reasonText: 'Control general',
  };
}

describe('Appointments', () => {
  let fixture: ComponentFixture<Appointments>;
  let componente: Appointments;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  /** Abre la sesión y monta. `pid` ausente = cuenta que no es de un paciente. */
  function montar({ pid }: { pid?: string } = { pid: 'pp-1' }): void {
    session.start({
      accessToken: jwt({
        sub: 'u-1',
        roles: ['USER', 'PATIENT'],
        tenants: ['t-1'],
        name: 'Ana Quispe',
        ...(pid === undefined ? {} : { pid }),
      }),
      refreshToken: 'r-1',
    });

    fixture = TestBed.createComponent(Appointments);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /** Responde las dos lecturas del arranque: los turnos y las agendas. */
  function responderArranque(citas: unknown[]): void {
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush({ items: citas, count: citas.length, limit: 50, truncated: false });
    http
      .expectOne((r) => r.url === '/scheduling/resources')
      .flush({ items: [{ id: 'r-1', name: 'Consultorio Cardiología', capacity: 1 }], count: 1 });
    fixture.detectChanges();
  }

  /** Responde la traducción de estados con el `display` en inglés del catálogo. */
  function responderTerminologia(items: unknown[]): void {
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({ items, count: items.length, limit: 50 });
    fixture.detectChanges();
  }

  it('sin perfil de paciente no sale a la red y lo dice', () => {
    montar({ pid: undefined });

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<boolean>('sinPerfilDePaciente')).toBe(true);
  });

  it('sin perfil de paciente ofrece la salida a la agenda, no solo la explicación', () => {
    montar({ pid: undefined });

    // El aviso manda a la agenda de la organización: el enlace tiene que estar.
    // Sigue sin salir nada a la red (el `http.verify()` del afterEach lo fija).
    const ancla = (fixture.nativeElement as HTMLElement).querySelector('a[href="/schedule"]');
    expect(ancla).not.toBeNull();
    expect(ancla?.textContent).toContain('Ir a la agenda');
  });

  it('el turno pide sus turnos por perfil, no por organización', () => {
    montar();

    const req = http.expectOne((r) => r.url === '/scheduling/bookings');
    expect(req.request.params.get('patientProfileId')).toBe('pp-1');
    req.flush({ items: [], count: 0, limit: 50, truncated: false });

    http.expectOne((r) => r.url === '/scheduling/resources').flush({ items: [], count: 0 });
    fixture.detectChanges();
  });

  it('sin turnos, el vacío ofrece la próxima acción en vez de quedar mudo', () => {
    montar();
    responderArranque([]);

    const estado = interno<() => { status: string; nextAction?: { label: string } }>('turnos')();
    expect(estado.status).toBe('empty');
    expect(estado.nextAction?.label).toBe('Elegí una agenda');
  });

  it('dice el estado en castellano, no el «display» en inglés del catálogo', () => {
    montar();
    responderArranque([cita('b-1', CONFIRMADO)]);
    responderTerminologia([
      { conceptId: CONFIRMADO, code: 'BOOKING_CONFIRMED', display: 'Booking confirmed' },
    ]);

    const turnos = interno<() => readonly { estado: string; tono: string }[]>('turnosListos')();
    expect(turnos[0].estado).toBe('Confirmado');
    expect(turnos[0].estado).not.toContain('Booking');
  });

  it('el tono del badge sale del código: confirmado y cancelado no se ven igual', () => {
    montar();
    responderArranque([cita('b-1', CONFIRMADO), cita('b-2', CANCELADO)]);
    responderTerminologia([
      { conceptId: CONFIRMADO, code: 'BOOKING_CONFIRMED', display: 'Booking confirmed' },
      { conceptId: CANCELADO, code: 'BOOKING_CANCELLED', display: 'Booking cancelled' },
    ]);

    const turnos = interno<() => readonly { tono: string }[]>('turnosListos')();
    expect(turnos[0].tono).toBe('success');
    expect(turnos[1].tono).toBe('error');
  });

  it('si el catálogo no responde, la lista sobrevive con el estado en neutro', () => {
    montar();
    responderArranque([cita('b-1', CONFIRMADO)]);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    const turnos = interno<() => readonly { estado: string }[]>('turnosListos')();
    expect(turnos).toHaveLength(1);
    expect(turnos[0].estado).toBe('Sin confirmar el estado');
  });

  it('dice con quién es el turno, aunque las agendas lleguen después', () => {
    montar();

    // Los turnos responden primero: todavía no hay con qué nombrar la agenda.
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush({ items: [cita('b-1', CONFIRMADO)], count: 1, limit: 50, truncated: false });
    fixture.detectChanges();
    expect(interno<() => readonly { agenda: string }[]>('turnosListos')()[0].agenda).toBe('');

    // Y cuando llegan, la lista ya pintada las toma.
    http
      .expectOne((r) => r.url === '/scheduling/resources')
      .flush({
        items: [{ id: 'r-1', name: 'Consultorio Cardiología', capacity: 1 }],
        count: 1,
      });
    fixture.detectChanges();
    responderTerminologia([
      { conceptId: CONFIRMADO, code: 'BOOKING_CONFIRMED', display: 'Booking confirmed' },
    ]);

    expect(interno<() => readonly { agenda: string }[]>('turnosListos')()[0].agenda).toBe(
      'Consultorio Cardiología',
    );
  });

  it('jamás muestra el uuid del estado en pantalla', () => {
    montar();
    responderArranque([cita('b-1', CONFIRMADO)]);
    responderTerminologia([
      { conceptId: CONFIRMADO, code: 'BOOKING_CONFIRMED', display: 'Booking confirmed' },
    ]);

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain(CONFIRMADO);
    expect(texto).toContain('Confirmado');
  });

  it('volver al placeholder de agendas no pide horarios de nadie', () => {
    montar();
    responderArranque([]);

    interno<(id: string | null) => void>('elegirRecurso')(null);
    fixture.detectChanges();

    // El `http.verify()` del afterEach falla si se pidieron cupos.
    const estado = interno<() => { status: string }>('horarios')();
    expect(estado.status).toBe('empty');
  });
});

/**
 * Cancelar el turno propio (V41-02·A, cara paciente).
 *
 * Lo que estas pruebas fijan, y que un refactor no puede romper en silencio:
 *
 * 1. **El botón sale por código, no por `display`.** El catálogo mezcla
 *    convenciones (`BOOKING_CONFIRMED` a secas, `scheduling:BOOKING_REQUESTED`
 *    con prefijo), así que se compara el sufijo normalizado contra una allowlist
 *    —lo verificado contra la API viva—, y un estado desconocido no ofrece nada.
 * 2. **Nada se cancela con un clic perdido.** Sin confirmación no hay llamada.
 * 3. **El servidor es la verdad.** Tras cancelar se relee; no se tacha la fila ni
 *    se resta el cupo a mano.
 * 4. **El doble-cancel no es un error del titular.** El 409 (y el 422 de
 *    transición inválida) son avisos amables, no una alarma roja.
 *
 * Estas pruebas montan con clientes dobles (no `HttpTestingController`) porque
 * ejercen la interacción —confirmar, cancelar, recargar— y no el cableado HTTP,
 * que la suite de arriba ya fija.
 */

function page<T>(items: readonly T[]) {
  return { items, count: items.length, limit: 50, truncated: false };
}

/** Una cita ya mapeada por el cliente (fechas como `Date`), para los dobles. */
function citaMock(id: string, statusConceptId: string) {
  return {
    id,
    patientProfileId: 'p-1',
    resourceId: 'r-1',
    statusConceptId,
    startAt: new Date('2026-08-12T12:00:00.000Z'),
    endAt: new Date('2026-08-12T12:30:00.000Z'),
    reasonText: '',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
  };
}

function etiqueta(conceptId: string, code: string, display = code): [string, unknown] {
  return [conceptId, { conceptId, code, display, codeSystemVersionId: 'csv-1' }];
}

/** Un cupo ya mapeado por el cliente, para poblar la grilla de horarios. */
function cupoMock(id: string) {
  return {
    id,
    resourceId: 'r-1',
    scheduleTemplateId: null,
    startAt: new Date('2026-08-14T13:00:00.000Z'),
    endAt: new Date('2026-08-14T13:30:00.000Z'),
    capacity: 1,
    remainingCapacity: 1,
    statusConceptId: 'c-open',
    serviceConceptId: null,
  };
}

/** El motivo que devuelve el diálogo en las pruebas (corrección #14). */
const MOTIVO_DE_PRUEBA = 'Me surgió un viaje esa semana';

interface Opciones {
  readonly bookings: readonly ReturnType<typeof citaMock>[];
  readonly labels: readonly [string, unknown][];
  readonly confirm?: boolean;
  /** La organización activa. Por omisión no hay, como en los casos de E1. */
  readonly tenant?: string;
  readonly resources?: readonly { id: string; name: string }[];
  readonly slots?: readonly ReturnType<typeof cupoMock>[];
}

function montarCancelacion(opts: Opciones) {
  const searchBookings = vi.fn().mockReturnValue(of(page(opts.bookings)));
  const listResources = vi.fn().mockReturnValue(of(page(opts.resources ?? [])));
  const listSlots = vi.fn().mockReturnValue(of(page(opts.slots ?? [])));
  const cancelBooking = vi.fn().mockReturnValue(of({ bookingId: 'x', capacityReleased: true }));
  const rescheduleBooking = vi
    .fn()
    .mockReturnValue(of({ bookingId: 'x', fromSlotId: 'a', toSlotId: 'b' }));
  const readConceptLabels = vi.fn().mockReturnValue(of(new Map(opts.labels)));
  const confirm = vi.fn().mockResolvedValue(opts.confirm ?? true);
  /**
   * Cancelar y reprogramar piden motivo (corrección #14): el diálogo devuelve
   * el texto, o `null` si se arrepintieron. `opts.confirm: false` es ese `null`.
   */
  const confirmWithReason = vi
    .fn()
    .mockResolvedValue((opts.confirm ?? true) ? MOTIVO_DE_PRUEBA : null);
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  TestBed.configureTestingModule({
    imports: [Appointments],
    providers: [
      {
        provide: SchedulingClient,
        useValue: { searchBookings, listResources, listSlots, cancelBooking, rescheduleBooking },
      },
      { provide: TerminologyClient, useValue: { readConceptLabels } },
      // Sin token de paciente del seed, se inyecta el mínimo que la pantalla usa:
      // el perfil (para pedir sus turnos) y la organización, que por omisión no
      // hay — los casos de la grilla la declaran.
      {
        provide: AuthService,
        useValue: { patientProfileId: () => 'p-1', activeTenantId: () => opts.tenant ?? null },
      },
      { provide: DialogService, useValue: { confirm, confirmWithReason } },
      { provide: ToastService, useValue: toast },
      provideRouter([]),
    ],
  });

  const fixture = TestBed.createComponent(Appointments);
  fixture.detectChanges();
  return {
    fixture,
    comp: fixture.componentInstance,
    searchBookings,
    cancelBooking,
    rescheduleBooking,
    confirm,
    confirmWithReason,
    toast,
  };
}

/** Acceso tipado a los miembros protegidos que las pruebas ejercen. */
function api(comp: Appointments) {
  return comp as unknown as {
    esCancelable(t: { codigo: string }): boolean;
    cancelarTurno(t: unknown): Promise<void>;
    esReprogramable(t: { codigo: string }): boolean;
    iniciarReprogramacion(t: unknown): void;
    cancelarReprogramacion(): void;
    reprogramarA(h: unknown): Promise<void>;
    reprogramando(): string | null;
    elegirRecurso(id: string | null): void;
    turnosListos(): readonly { id: string; codigo: string; resourceId: string; estado: string }[];
  };
}

describe('Appointments · cancelar turno propio', () => {
  it('muestra "Cancelar" solo en turnos cancelables (gate por código normalizado)', () => {
    const { fixture } = montarCancelacion({
      bookings: [
        citaMock('b-conf', 's-conf'),
        citaMock('b-req', 's-req'),
        citaMock('b-canc', 's-canc'),
        citaMock('b-done', 's-done'),
      ],
      labels: [
        etiqueta('s-conf', 'BOOKING_CONFIRMED'),
        etiqueta('s-req', 'scheduling:BOOKING_REQUESTED'),
        etiqueta('s-canc', 'BOOKING_CANCELLED'),
        etiqueta('s-done', 'EV_BOOKING_DONE'),
      ],
    });
    fixture.detectChanges();

    // Confirmado y solicitado sí; cancelado y completado no.
    const botones = fixture.nativeElement.querySelectorAll('.turnos__cancelar');
    expect(botones.length).toBe(2);
  });

  it('no ofrece cancelar para cancelado, completado, no-show, reprogramado ni desconocido', () => {
    const { comp } = montarCancelacion({ bookings: [], labels: [] });
    const a = api(comp);

    for (const code of [
      'BOOKING_CANCELLED',
      'EV_BOOKING_DONE',
      'scheduling:BOOKING_COMPLETED',
      'scheduling:BOOKING_NO_SHOW',
      'BOOKING_RESCHEDULED',
      'FOO',
      '',
    ]) {
      expect(a.esCancelable({ codigo: code })).toBe(false);
    }

    for (const code of [
      'BOOKING_CONFIRMED',
      'BOOKING_CHECKED_IN',
      'scheduling:BOOKING_REQUESTED',
      'scheduling:BOOKING_PENDING_CONFIRMATION',
    ]) {
      expect(a.esCancelable({ codigo: code })).toBe(true);
    }
  });

  it('pide includeCancelled para que el turno cancelado siga visible', () => {
    const { searchBookings } = montarCancelacion({ bookings: [], labels: [] });
    expect(searchBookings).toHaveBeenCalledWith(
      expect.objectContaining({ patientProfileId: 'p-1', includeCancelled: true }),
    );
  });

  it('con la confirmación negada no llama a cancelBooking', async () => {
    const { comp, cancelBooking } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
      confirm: false,
    });

    await api(comp).cancelarTurno(api(comp).turnosListos()[0]);
    expect(cancelBooking).not.toHaveBeenCalled();
  });

  it('con la confirmación afirmativa cancela como PATIENT y manda el motivo', () => {
    const { comp, cancelBooking } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
    });

    return api(comp)
      .cancelarTurno(api(comp).turnosListos()[0])
      .then(() => {
        // El motivo viaja siempre: el servidor lo exige (corrección #14).
        expect(cancelBooking).toHaveBeenCalledWith('b1', {
          cancelledBy: 'PATIENT',
          reasonText: MOTIVO_DE_PRUEBA,
        });
      });
  });

  it('tras cancelar releé turnos y horarios y avisa el éxito', async () => {
    const { comp, searchBookings, toast } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
    });
    const horarios = vi.spyOn(comp as unknown as { cargarHorarios(): void }, 'cargarHorarios');
    const antes = searchBookings.mock.calls.length;

    await api(comp).cancelarTurno(api(comp).turnosListos()[0]);

    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(searchBookings.mock.calls.length).toBe(antes + 1);
    expect(horarios).toHaveBeenCalled();
  });

  it('el 409 de doble-cancel es aviso amable —no rojo— y recarga', async () => {
    const { comp, cancelBooking, searchBookings, toast } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
    });
    cancelBooking.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'CONFLICT', message: 'La cita ya está cancelada' },
          }),
      ),
    );
    const horarios = vi.spyOn(comp as unknown as { cargarHorarios(): void }, 'cargarHorarios');
    const antes = searchBookings.mock.calls.length;

    await api(comp).cancelarTurno(api(comp).turnosListos()[0]);

    expect(toast.info).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(searchBookings.mock.calls.length).toBe(antes + 1);
    expect(horarios).toHaveBeenCalled();
  });

  it('el 422 de transición inválida también es amable y recarga', async () => {
    const { comp, cancelBooking, toast } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
    });
    cancelBooking.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 'PRECONDITION_FAILED',
              message: 'La cita no está en un estado cancelable',
            },
          }),
      ),
    );

    await api(comp).cancelarTurno(api(comp).turnosListos()[0]);

    expect(toast.info).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

/**
 * Reprogramar el turno propio (V41-02·A, cara paciente).
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **La allowlist de reprogramar es propia, no la de cancelar.** El backend
 *    sólo mueve una cita vigente (confirmada o con llegada): una solicitada o
 *    pendiente se puede cancelar pero no mover.
 * 2. **El modo es inequívoco.** Fuera de él, la grilla sigue enlazando a pedir
 *    un turno nuevo; dentro, el mismo hueco mueve el turno y no navega.
 * 3. **El servidor es la verdad.** Tras mover se relee todo; el 422 y el 409
 *    son avisos amables, nunca una alarma roja.
 */
describe('Appointments · reprogramar turno propio', () => {
  const GRILLA = {
    tenant: 't-1',
    resources: [{ id: 'r-1', name: 'Consultorio Cardiología' }],
    slots: [cupoMock('slot-9')],
  };

  /** El horario destino tal como lo entrega la grilla ya mapeada. */
  const HORARIO = {
    id: 'slot-9',
    desde: new Date('2026-08-14T13:00:00.000Z'),
    hasta: new Date('2026-08-14T13:30:00.000Z'),
    resourceId: 'r-1',
    lugaresLibres: 1,
  };

  it('muestra "Reprogramar" solo para confirmado y con llegada', () => {
    const { fixture } = montarCancelacion({
      bookings: [
        citaMock('b-conf', 's-conf'),
        citaMock('b-in', 's-in'),
        citaMock('b-req', 's-req'),
        citaMock('b-canc', 's-canc'),
      ],
      labels: [
        etiqueta('s-conf', 'BOOKING_CONFIRMED'),
        etiqueta('s-in', 'BOOKING_CHECKED_IN'),
        etiqueta('s-req', 'scheduling:BOOKING_REQUESTED'),
        etiqueta('s-canc', 'BOOKING_CANCELLED'),
      ],
    });
    fixture.detectChanges();

    // Confirmado y con llegada sí; solicitado (cancelable pero NO movible) y
    // cancelado, no.
    expect(fixture.nativeElement.querySelectorAll('.turnos__reprogramar').length).toBe(2);
  });

  it('no ofrece reprogramar en los estados que el backend rechaza', () => {
    const { comp } = montarCancelacion({ bookings: [], labels: [] });
    const a = api(comp);

    for (const code of [
      'BOOKING_REQUESTED',
      'scheduling:BOOKING_REQUESTED',
      'BOOKING_PENDING_CONFIRMATION',
      'scheduling:BOOKING_PENDING_CONFIRMATION',
      'BOOKING_CANCELLED',
      'scheduling:BOOKING_COMPLETED',
      'EV_BOOKING_DONE',
      'scheduling:BOOKING_NO_SHOW',
      'BOOKING_RESCHEDULED',
      'FOO',
      '',
    ]) {
      expect(a.esReprogramable({ codigo: code })).toBe(false);
    }

    for (const code of [
      'BOOKING_CONFIRMED',
      'BOOKING_CHECKED_IN',
      'scheduling:BOOKING_CONFIRMED',
    ]) {
      expect(a.esReprogramable({ codigo: code })).toBe(true);
    }
  });

  it('entrar al modo identifica el turno origen', () => {
    const { comp } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
      ...GRILLA,
    });
    const a = api(comp);

    a.iniciarReprogramacion(a.turnosListos()[0]);

    expect(a.reprogramando()).toBe('b1');
  });

  it('salir del modo no toca nada', () => {
    const { comp, rescheduleBooking } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
      ...GRILLA,
    });
    const a = api(comp);
    a.iniciarReprogramacion(a.turnosListos()[0]);

    a.cancelarReprogramacion();

    expect(a.reprogramando()).toBeNull();
    expect(rescheduleBooking).not.toHaveBeenCalled();
  });

  it('fuera del modo, el horario sigue enlazando a pedir un turno nuevo', () => {
    const { fixture, comp } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
      ...GRILLA,
    });
    api(comp).elegirRecurso('r-1');
    fixture.detectChanges();

    const ancla = fixture.nativeElement.querySelector('.turnos__horario a');
    expect(ancla).not.toBeNull();
    expect(ancla.getAttribute('href')).toContain('book/slot-9');
    expect(fixture.nativeElement.querySelector('.turnos__mover')).toBeNull();
  });

  it('en el modo, el horario ofrece «mover acá» y no enlaza a la reserva', () => {
    const { fixture, comp } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
      ...GRILLA,
    });
    const a = api(comp);
    a.iniciarReprogramacion(a.turnosListos()[0]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.turnos__horario a')).toBeNull();
    expect(fixture.nativeElement.querySelector('.turnos__mover')).not.toBeNull();
    // Y el aviso dice qué turno se está moviendo, con su salida.
    expect(
      fixture.nativeElement.querySelector('[data-testid="turnos-reprogramando"]'),
    ).not.toBeNull();
  });

  it('con la confirmación negada no llama a rescheduleBooking', async () => {
    const { comp, rescheduleBooking } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
      confirm: false,
      ...GRILLA,
    });
    const a = api(comp);
    a.iniciarReprogramacion(a.turnosListos()[0]);

    await a.reprogramarA(HORARIO);

    expect(rescheduleBooking).not.toHaveBeenCalled();
  });

  it('con la confirmación afirmativa mueve el turno origen al slot elegido', async () => {
    const { comp, rescheduleBooking } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
      ...GRILLA,
    });
    const a = api(comp);
    a.iniciarReprogramacion(a.turnosListos()[0]);

    await a.reprogramarA(HORARIO);

    expect(rescheduleBooking).toHaveBeenCalledWith('b1', {
      toSlotId: 'slot-9',
      reasonText: MOTIVO_DE_PRUEBA,
    });
  });

  it('tras mover releé turnos y horarios, limpia el modo y avisa el éxito', async () => {
    const { comp, searchBookings, toast } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
      ...GRILLA,
    });
    const a = api(comp);
    a.iniciarReprogramacion(a.turnosListos()[0]);
    const horarios = vi.spyOn(comp as unknown as { cargarHorarios(): void }, 'cargarHorarios');
    const antes = searchBookings.mock.calls.length;

    await a.reprogramarA(HORARIO);

    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(searchBookings.mock.calls.length).toBe(antes + 1);
    expect(horarios).toHaveBeenCalled();
    expect(a.reprogramando()).toBeNull();
  });

  it('el 422 de cita no vigente es aviso amable —no rojo—, recarga y sale del modo', async () => {
    const { comp, rescheduleBooking, searchBookings, toast } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
      ...GRILLA,
    });
    const a = api(comp);
    a.iniciarReprogramacion(a.turnosListos()[0]);
    rescheduleBooking.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'PRECONDITION_FAILED', message: 'Solo se reprograma una cita vigente' },
          }),
      ),
    );
    const horarios = vi.spyOn(comp as unknown as { cargarHorarios(): void }, 'cargarHorarios');
    const antes = searchBookings.mock.calls.length;

    await a.reprogramarA(HORARIO);

    expect(toast.info).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(searchBookings.mock.calls.length).toBe(antes + 1);
    expect(horarios).toHaveBeenCalled();
    expect(a.reprogramando()).toBeNull();
  });

  it('el 409 de cupo recién ocupado es aviso amable, recarga y deja elegir otro', async () => {
    const { comp, rescheduleBooking, searchBookings, toast } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
      ...GRILLA,
    });
    const a = api(comp);
    a.iniciarReprogramacion(a.turnosListos()[0]);
    rescheduleBooking.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'CONFLICT', message: 'El slot destino no tiene cupos' },
          }),
      ),
    );
    const horarios = vi.spyOn(comp as unknown as { cargarHorarios(): void }, 'cargarHorarios');
    const antes = searchBookings.mock.calls.length;

    await a.reprogramarA(HORARIO);

    expect(toast.info).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(searchBookings.mock.calls.length).toBe(antes + 1);
    expect(horarios).toHaveBeenCalled();
    // El modo sigue activo: el turno origen no cambió, sólo hay que elegir
    // otro horario de la lista ya refrescada.
    expect(a.reprogramando()).toBe('b1');
  });
});

/**
 * La presentación del estado (E3 — barrido del lado paciente).
 *
 * Antes el mapa sólo nombraba cuatro estados y comparaba el código **sin
 * normalizar**: un turno `scheduling:BOOKING_REQUESTED` —la forma real del
 * catálogo vivo— se leía «Sin confirmar el estado» al lado de un botón
 * Cancelar que sí sabía qué estado era. Estas pruebas fijan que etiqueta y
 * allowlists usan el mismo normalizador y que ningún estado real queda mudo.
 */
describe('booking-status · presentación por código normalizado', () => {
  function concepto(code: string): ValueSetOption {
    return { conceptId: 'c-x', code, display: code, codeSystemVersionId: 'csv-1' };
  }

  it('recorta el prefijo de módulo hasta el último «:»', () => {
    expect(sufijoDeCodigo('scheduling:BOOKING_REQUESTED')).toBe('BOOKING_REQUESTED');
    expect(sufijoDeCodigo('BOOKING_REQUESTED')).toBe('BOOKING_REQUESTED');
    expect(sufijoDeCodigo('a:b:CODIGO')).toBe('CODIGO');
  });

  it('nombra en castellano los estados que faltaban, con y sin prefijo', () => {
    const casos: readonly [string, string][] = [
      ['BOOKING_REQUESTED', 'Pedido'],
      ['scheduling:BOOKING_REQUESTED', 'Pedido'],
      ['BOOKING_PENDING_CONFIRMATION', 'Por confirmar'],
      ['scheduling:BOOKING_PENDING_CONFIRMATION', 'Por confirmar'],
      ['BOOKING_COMPLETED', 'Atendido'],
      ['scheduling:BOOKING_COMPLETED', 'Atendido'],
      // «Atendido» tiene un segundo código en el catálogo vivo: el evento.
      ['EV_BOOKING_DONE', 'Atendido'],
      ['BOOKING_NO_SHOW', 'No asististe'],
      ['scheduling:BOOKING_NO_SHOW', 'No asististe'],
    ];

    for (const [code, label] of casos) {
      expect(toBookingStatusPresentation(concepto(code)).label).toBe(label);
    }
  });

  it('los estados que ya se nombraban no cambian de palabra ni de tono', () => {
    expect(toBookingStatusPresentation(concepto('BOOKING_CONFIRMED'))).toEqual({
      tone: 'success',
      label: 'Confirmado',
    });
    expect(toBookingStatusPresentation(concepto('BOOKING_CHECKED_IN'))).toEqual({
      tone: 'info',
      label: 'Ya llegaste',
    });
    expect(toBookingStatusPresentation(concepto('BOOKING_CANCELLED'))).toEqual({
      tone: 'error',
      label: 'Cancelado',
    });
    expect(toBookingStatusPresentation(concepto('BOOKING_RESCHEDULED'))).toEqual({
      tone: 'warning',
      label: 'Reprogramado',
    });
  });

  it('lo desconocido y lo no resuelto caen al neutro, nunca al «display»', () => {
    expect(toBookingStatusPresentation(concepto('FOO')).label).toBe('Sin confirmar el estado');
    expect(toBookingStatusPresentation(undefined).label).toBe('Sin confirmar el estado');
  });
});

/**
 * Los avisos del barrido (E3), vistos desde el componente: el estado nuevo
 * llega con su palabra hasta la fila, y el vacío de organización dice dónde
 * está el control en vez de dejar a la persona buscándolo.
 */
describe('Appointments · estados con palabra y avisos con salida (E3)', () => {
  it('un turno solicitado dice «Pedido», se puede cancelar y no se puede mover', () => {
    const { fixture, comp } = montarCancelacion({
      bookings: [citaMock('b-req', 's-req')],
      labels: [etiqueta('s-req', 'scheduling:BOOKING_REQUESTED', 'Booking requested')],
    });
    fixture.detectChanges();

    expect(api(comp).turnosListos()[0].estado).toBe('Pedido');
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Pedido');
    expect(texto).not.toContain('Sin confirmar el estado');
    expect(fixture.nativeElement.querySelector('.turnos__cancelar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.turnos__reprogramar')).toBeNull();
  });

  it('un turno ya atendido dice «Atendido» y no ofrece ninguna acción', () => {
    const { fixture, comp } = montarCancelacion({
      bookings: [citaMock('b-done', 's-done')],
      labels: [etiqueta('s-done', 'EV_BOOKING_DONE', 'Booking done')],
    });
    fixture.detectChanges();

    expect(api(comp).turnosListos()[0].estado).toBe('Atendido');
    expect(fixture.nativeElement.querySelector('.turnos__cancelar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.turnos__reprogramar')).toBeNull();
  });

  it('sin organización activa, el aviso dice que se elige desde el encabezado', () => {
    // Sin `tenant`: el caso real de una sesión sin organización activa.
    const { fixture } = montarCancelacion({ bookings: [], labels: [] });
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Elegí una organización');
    expect(texto).toContain('encabezado');
  });
});

// Carril 06 — vista dual (corrección #10) y motivo visible (corrección #14).

describe('Appointments · lista y calendario', () => {
  it('arranca en lista y el calendario no está dibujado', () => {
    const { fixture } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
    });

    expect(fixture.nativeElement.querySelector('.turnos__lista')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-appointment-calendar')).toBeNull();
  });

  it('el conmutador cambia de vista y las dos miran los MISMOS turnos', async () => {
    const { fixture, comp, searchBookings } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
    });
    const lecturasAntes = searchBookings.mock.calls.length;

    vista(comp).elegirVista('calendario');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-appointment-calendar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.turnos__lista')).toBeNull();
    // Ni una lectura más: el calendario pinta lo que la lista ya trajo. Si
    // pidiera lo suyo, las dos vistas podrían discrepar.
    expect(searchBookings.mock.calls.length).toBe(lecturasAntes);
    expect(vista(comp).turnosDeCalendario()).toHaveLength(1);
  });

  it('elegir un turno en el calendario abre el detalle con sus acciones', async () => {
    const { fixture, comp } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
    });

    vista(comp).elegirVista('calendario');
    await fixture.whenStable();
    fixture.detectChanges();

    vista(comp).abrirDetalle('b1');
    fixture.detectChanges();

    const detalle = fixture.nativeElement.querySelector('[data-testid="turnos-detalle"]');
    expect(detalle).not.toBeNull();
    expect(detalle.textContent).toContain('Cancelar');
  });
});

describe('Appointments · el motivo del cambio llega al paciente', () => {
  it('la lista dice quién lo hizo y qué escribió', () => {
    const cancelada = {
      ...citaMock('b1', 's1'),
      statusReason: {
        reasonText: 'El profesional tuvo una urgencia',
        actorKind: 'PROVIDER' as const,
        changedAt: new Date('2026-08-13T15:00:00.000Z'),
      },
    };
    const { fixture } = montarCancelacion({
      bookings: [cancelada],
      labels: [etiqueta('s1', 'BOOKING_CANCELLED')],
    });
    fixture.detectChanges();

    const aviso = fixture.nativeElement.querySelector('[data-testid="turnos-motivo-cambio"]');
    expect(aviso?.textContent).toContain('El profesional indicó');
    expect(aviso?.textContent).toContain('El profesional tuvo una urgencia');
  });

  it('lo que hizo el propio paciente no se le atribuye al profesional', () => {
    const propia = {
      ...citaMock('b1', 's1'),
      statusReason: {
        reasonText: 'Me surgió un viaje',
        actorKind: 'PATIENT' as const,
        changedAt: new Date('2026-08-13T15:00:00.000Z'),
      },
    };
    const { fixture } = montarCancelacion({
      bookings: [propia],
      labels: [etiqueta('s1', 'BOOKING_CANCELLED')],
    });
    fixture.detectChanges();

    const aviso = fixture.nativeElement.querySelector('[data-testid="turnos-motivo-cambio"]');
    expect(aviso?.textContent).toContain('Indicaste');
    expect(aviso?.textContent).not.toContain('El profesional');
  });

  it('un turno que nadie cambió no muestra ningún aviso', () => {
    const { fixture } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="turnos-motivo-cambio"]')).toBeNull();
  });
});

/** Acceso tipado a lo que las pruebas de vista dual ejercen. */
function vista(comp: Appointments) {
  return comp as unknown as {
    elegirVista(v: 'lista' | 'calendario'): void;
    abrirDetalle(id: string): void;
    enCalendario(): boolean;
    turnosDeCalendario(): readonly unknown[];
  };
}

describe('etiquetaDeRecurso', () => {
  it('muestra a la persona cuando el recurso la resuelve', () => {
    expect(
      etiquetaDeRecurso({ name: 'Agenda mañana', practitionerName: 'Rosa Quispe' }),
    ).toBe('Rosa Quispe — Agenda mañana');
  });

  it('no repite cuando la agenda ya se llama como la persona', () => {
    expect(
      etiquetaDeRecurso({ name: 'Rosa Quispe', practitionerName: 'Rosa Quispe' }),
    ).toBe('Rosa Quispe');
  });

  it('cae al nombre del recurso para salas o perfiles sin resolver', () => {
    expect(etiquetaDeRecurso({ name: 'Consultorio 3', practitionerName: null })).toBe(
      'Consultorio 3',
    );
    // Los dobles de prueba y las respuestas viejas de la API no traen el campo.
    expect(etiquetaDeRecurso({ name: 'Consultorio 3' })).toBe('Consultorio 3');
  });
});
