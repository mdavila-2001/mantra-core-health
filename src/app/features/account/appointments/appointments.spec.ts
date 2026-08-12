import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
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
