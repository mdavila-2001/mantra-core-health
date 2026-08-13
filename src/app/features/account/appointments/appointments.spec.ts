import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionStore } from '../../../core/auth/session.store';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { Appointments } from './appointments';

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

interface Opciones {
  readonly bookings: readonly ReturnType<typeof citaMock>[];
  readonly labels: readonly [string, unknown][];
  readonly confirm?: boolean;
}

function montarCancelacion(opts: Opciones) {
  const searchBookings = vi.fn().mockReturnValue(of(page(opts.bookings)));
  const listResources = vi.fn().mockReturnValue(of(page([])));
  const listSlots = vi.fn().mockReturnValue(of(page([])));
  const cancelBooking = vi.fn().mockReturnValue(of({ bookingId: 'x', capacityReleased: true }));
  const readConceptLabels = vi.fn().mockReturnValue(of(new Map(opts.labels)));
  const confirm = vi.fn().mockResolvedValue(opts.confirm ?? true);
  const toast = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() };

  TestBed.configureTestingModule({
    imports: [Appointments],
    providers: [
      { provide: SchedulingClient, useValue: { searchBookings, listResources, listSlots, cancelBooking } },
      { provide: TerminologyClient, useValue: { readConceptLabels } },
      // Sin token de paciente del seed, se inyecta el mínimo que la pantalla usa:
      // el perfil (para pedir sus turnos) y la organización (aquí sin elegir).
      { provide: AuthService, useValue: { patientProfileId: () => 'p-1', activeTenantId: () => null } },
      { provide: DialogService, useValue: { confirm } },
      { provide: ToastService, useValue: toast },
      provideRouter([]),
    ],
  });

  const fixture = TestBed.createComponent(Appointments);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, searchBookings, cancelBooking, confirm, toast };
}

/** Acceso tipado a los miembros protegidos que las pruebas ejercen. */
function api(comp: Appointments) {
  return comp as unknown as {
    esCancelable(t: { codigo: string }): boolean;
    cancelarTurno(t: unknown): Promise<void>;
    turnosListos(): readonly { id: string; codigo: string }[];
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

  it('con la confirmación afirmativa cancela como PATIENT', async () => {
    const { comp, cancelBooking } = montarCancelacion({
      bookings: [citaMock('b1', 's1')],
      labels: [etiqueta('s1', 'BOOKING_CONFIRMED')],
    });

    await api(comp).cancelarTurno(api(comp).turnosListos()[0]);
    expect(cancelBooking).toHaveBeenCalledWith('b1', { cancelledBy: 'PATIENT' });
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
        () => new HttpErrorResponse({ status: 409, error: { code: 'CONFLICT', message: 'La cita ya está cancelada' } }),
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
            error: { code: 'PRECONDITION_FAILED', message: 'La cita no está en un estado cancelable' },
          }),
      ),
    );

    await api(comp).cancelarTurno(api(comp).turnosListos()[0]);

    expect(toast.info).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
