import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionStore } from '../../../core/auth/session.store';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type { AgendaResource, AgendaSlot } from '../../../core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ValueSetOption } from '../../../core/data-access/terminology/terminology.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import {
  Appointments,
  etiquetaDeRecurso,
  etiquetasSinColision,
  opcionesDeSedeDe,
} from './appointments';
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

  /**
   * Abre la sesión y monta. `pid` ausente = cuenta que no es de un paciente.
   *
   * Desde P8 el arranque hace **tres** lecturas y no dos: la lista de espera se
   * pide junto con los turnos y las agendas. Se responde acá —vacía salvo que
   * la prueba diga otra cosa— para que las pruebas que no van de esperas no
   * tengan que saber que existe.
   */
  function montar({ pid, esperas }: { pid?: string; esperas?: unknown[] } = { pid: 'pp-1' }): void {
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

    if (pid !== undefined) {
      http.expectOne((r) => r.url === '/scheduling/waitlist').flush({ items: esperas ?? [] });
      fixture.detectChanges();
    }
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /**
   * El miembro tal cual, sin ligar.
   *
   * `interno` liga las funciones al componente, y una señal **es** una función:
   * ligarla devuelve una copia sin `.set`. Para escribir en una señal hace falta
   * la original.
   */
  function crudo<T>(nombre: string): T {
    return (componente as unknown as Record<string, unknown>)[nombre] as T;
  }

  /**
   * Responde las dos lecturas de datos del arranque: los turnos y las agendas.
   * La lista de espera (P8) ya la respondió {@link montar}.
   */
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

  /* ---- Refactor UX · piloto «Mis citas» (docs/refactor-profesional) ------- */

  describe('refactor UX: lo que viene primero y la acción a la vista', () => {
    /** Una cita con fecha propia: la del helper `cita` es siempre la misma. */
    function citaEn(id: string, inicio: string, fin: string): Record<string, unknown> {
      return { ...cita(id, CONFIRMADO), startAt: inicio, endAt: fin };
    }

    function arrancarConCitas(citas: unknown[]): void {
      montar();
      responderArranque(citas);
      responderTerminologia([
        { conceptId: CONFIRMADO, code: 'BOOKING_CONFIRMED', display: 'Booking confirmed' },
      ]);
    }

    function textoDe(selector: string): string[] {
      const nodos = fixture.nativeElement.querySelectorAll(selector) as NodeListOf<HTMLElement>;
      return Array.from(nodos, (nodo) => nodo.textContent?.trim() ?? '');
    }

    it('R-02 · las próximas encabezan la lista y las atendidas van debajo, la más reciente arriba', () => {
      // El servidor las manda ascendentes: así, el historial enterraba la próxima (H-04).
      arrancarConCitas([
        citaEn('vieja', '2020-01-10T13:00:00.000Z', '2020-01-10T13:30:00.000Z'),
        citaEn('reciente', '2021-05-10T13:00:00.000Z', '2021-05-10T13:30:00.000Z'),
        citaEn('futura', '2099-03-01T13:00:00.000Z', '2099-03-01T13:30:00.000Z'),
      ]);

      expect(textoDe('.turnos__grupo-titulo').map((t) => t.replace(/\s+/g, ' '))).toEqual([
        'Próximas 1',
        'Anteriores 2',
      ]);
      const proximas = fixture.nativeElement.querySelector('[data-testid="turnos-lista-upcoming"]');
      const anteriores = fixture.nativeElement.querySelector('[data-testid="turnos-lista-past"]');
      // La fecha se pinta sin año; el 1 de marzo sólo existe en la futura.
      expect(proximas.textContent).toMatch(/\b1 mar/i);
      const fechas = Array.from(
        anteriores.querySelectorAll('.turnos__fecha') as NodeListOf<HTMLElement>,
        (nodo) => nodo.textContent ?? '',
      );
      // La más reciente (mayo de 2021) arriba; la más vieja (enero de 2020) abajo.
      expect(fechas[0]).toMatch(/may/i);
      expect(fechas[1]).toMatch(/jan|ene/i);
      // El orden de `turnosListos` —del que cuelgan calendario y cancelación— no cambia.
      expect(interno<() => readonly { id: string }[]>('turnosListos')().map((t) => t.id)).toEqual([
        'vieja',
        'reciente',
        'futura',
      ]);
    });

    it('R-02 · sin citas pasadas no dibuja un grupo «Anteriores» vacío', () => {
      arrancarConCitas([
        citaEn('a', '2099-03-01T13:00:00.000Z', '2099-03-01T13:30:00.000Z'),
        citaEn('b', '2099-03-02T13:00:00.000Z', '2099-03-02T13:30:00.000Z'),
      ]);

      expect(textoDe('.turnos__grupo-titulo')).toHaveLength(1);
      expect(fixture.nativeElement.querySelector('[data-testid="turnos-lista-past"]')).toBeNull();
    });

    it('R-01 · el botón del encabezado cambia de sección —no scrollea— y deja el foco detrás', async () => {
      arrancarConCitas([cita('b-1', CONFIRMADO)]);

      const boton = (): HTMLButtonElement | null =>
        fixture.nativeElement.querySelector('app-page-header [data-testid="turnos-pedir"]');
      expect(boton()?.textContent?.trim()).toBe('Pedir una cita');
      expect(
        fixture.nativeElement.querySelector('[aria-labelledby="turnos-propios"]'),
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[aria-labelledby="pedir-turno"]')).toBeNull();

      boton()?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      // Cambió de sección: «Tus citas» ya no está en el DOM, no sólo fuera de vista.
      expect(fixture.nativeElement.querySelector('[aria-labelledby="turnos-propios"]')).toBeNull();
      expect(
        fixture.nativeElement.querySelector('[aria-labelledby="pedir-turno"]'),
      ).not.toBeNull();
      expect(document.activeElement?.id).toBe('pedir-turno');
      expect(document.activeElement?.textContent?.trim()).toBe('Agendar una cita');
      expect(boton()?.textContent?.trim()).toBe('Tus citas');

      // Y el mismo botón vuelve, con el foco en el título de «Tus citas».
      boton()?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[aria-labelledby="turnos-propios"]'),
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[aria-labelledby="pedir-turno"]')).toBeNull();
      expect(document.activeElement?.id).toBe('turnos-propios');
      expect(boton()?.textContent?.trim()).toBe('Pedir una cita');
    });

    it('R-01 · una cuenta sin perfil de paciente no recibe el botón', () => {
      montar({});

      expect(fixture.nativeElement.querySelector('[data-testid="turnos-pedir"]')).toBeNull();
    });

    it('R-03 · «Más filtros» anuncia si está abierto y cuántos filtros esconde', () => {
      arrancarConCitas([cita('b-1', CONFIRMADO), cita('b-2', CONFIRMADO)]);
      const boton = (): HTMLElement =>
        fixture.nativeElement.querySelector('[data-testid="turnos-mas-filtros"]');

      expect(boton().getAttribute('aria-expanded')).toBe('false');
      expect(boton().getAttribute('aria-controls')).toBe('turnos-filtros-plegables');

      boton().click();
      fixture.detectChanges();

      expect(boton().getAttribute('aria-expanded')).toBe('true');
      expect(
        fixture.nativeElement
          .querySelector('[data-testid="turnos-filtros"]')
          .classList.contains('turnos__filtros--abiertos'),
      ).toBe(true);
    });
  });

  /* ---- TJ-2 · la ventana y la reprogramación ------------------------------ */

  describe('reglas finas de la cita (TJ-2)', () => {
    it('un turno movido dice de cuándo, para que no se lea como ajeno', () => {
      montar();
      http
        .expectOne((r) => r.url === '/scheduling/bookings')
        .flush({
          items: [
            {
              id: 'b-1',
              resourceId: 'r-1',
              statusConceptId: 'c-conf',
              startAt: '2026-09-01T13:00:00.000Z',
              rescheduledFrom: '2026-08-20T19:30:00.000Z',
            },
          ],
          count: 1,
          limit: 50,
          truncated: false,
        });
      http.expectOne((r) => r.url === '/scheduling/resources').flush({ items: [], count: 0 });
      fixture.detectChanges();
      responderTerminologia([]);

      expect(fixture.nativeElement.textContent).toContain('Reprogramado desde el');
    });

    it('un turno que nunca se movió no dice nada de reprogramación', () => {
      montar();
      responderArranque([
        {
          id: 'b-1',
          resourceId: 'r-1',
          statusConceptId: 'c-conf',
          startAt: '2026-09-01T13:00:00.000Z',
        },
      ]);
      responderTerminologia([]);

      expect(fixture.nativeElement.textContent).not.toContain('Reprogramado desde');
    });

    it('fuera de la ventana, se muestra lo que el servidor explica y NO se relee', () => {
      montar();
      responderArranque([]);

      // El 422 de la ventana trae el plazo y qué hacer ahora. El texto genérico
      // —«ya no se puede»— dejaba a la persona sin saber por qué ni qué le
      // queda, y releer la lista sólo hacía parpadear lo mismo.
      const aviso = interno<(e: unknown) => void>('avisarFalloCancelacion');
      aviso({
        status: 422,
        error: {
          message:
            'Podés cancelar hasta 24 horas antes del turno. Si ya no podés asistir, comunicate con el consultorio.',
        },
      });
      fixture.detectChanges();

      http.expectNone((r) => r.url === '/scheduling/bookings');
    });
  });

  /* ---- J2 · pedir turno en un laboratorio --------------------------------- */

  describe('con quién se pide el turno (J2)', () => {
    it('por defecto sólo pide PROFESIONALES, no todos los recursos del tenant', () => {
      montar();
      http
        .expectOne((r) => r.url === '/scheduling/bookings')
        .flush({ items: [], count: 0, limit: 50, truncated: false });

      const pedido = http.expectOne((r) => r.url === '/scheduling/resources');
      // Sin este filtro, en cuanto un laboratorio publique agenda aparecería
      // bajo «¿con quién te querés atender?» y alguien pediría una consulta
      // médica en una sala de toma de muestras.
      expect(pedido.request.params.get('resourceType')).toBe('PRACTITIONER');
      pedido.flush({ items: [], count: 0 });
    });

    it('refactor UX: con ?resource=lab (desde «Mis órdenes») arranca pidiendo laboratorios', async () => {
      await TestBed.inject(Router).navigateByUrl('/?resource=lab');
      montar();
      http
        .expectOne((r) => r.url === '/scheduling/bookings')
        .flush({ items: [], count: 0, limit: 50, truncated: false });

      const pedido = http.expectOne((r) => r.url === '/scheduling/resources');
      expect(pedido.request.params.get('resourceType')).toBe('ROOM');
      pedido.flush({ items: [], count: 0 });
      expect(interno<() => boolean>('esLaboratorio')()).toBe(true);

      // Abre «Agendar una cita» directo, sin pasar por «Tus citas» primero, y
      // deja el foco en su título (lo mismo que promete el botón del
      // encabezado, para quien llega acá desde «Mis órdenes»).
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[aria-labelledby="pedir-turno"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[aria-labelledby="turnos-propios"]')).toBeNull();
      expect(document.activeElement?.id).toBe('pedir-turno');
    });

    it('al cambiar a laboratorio, vuelve a preguntar por recursos de tipo ROOM', () => {
      montar();
      responderArranque([]);

      interno<(tipo: string) => void>('cambiarTipoDeRecurso')('ROOM');
      fixture.detectChanges();

      const pedido = http.expectOne((r) => r.url === '/scheduling/resources');
      expect(pedido.request.params.get('resourceType')).toBe('ROOM');
      pedido.flush({
        items: [{ id: 'lab-1', name: 'Laboratorio Central', capacity: 2 }],
        count: 1,
      });
    });

    it('cambiar de tipo limpia lo elegido: el recurso era de la otra lista', () => {
      montar();
      responderArranque([]);

      crudo<{ set: (v: string | null) => void }>('agendaElegida').set('recurso:r-1');
      interno<(tipo: string) => void>('cambiarTipoDeRecurso')('ROOM');
      fixture.detectChanges();

      // Dejarlo puesto mostraría horarios de un profesional bajo el rótulo de
      // laboratorio hasta que la lectura vuelva.
      expect(crudo<() => string | null>('agendaElegida')()).toBeNull();
      http.expectOne((r) => r.url === '/scheduling/resources').flush({ items: [], count: 0 });
    });

    it('cambiar al tipo que ya está puesto no vuelve a pedir nada', () => {
      montar();
      responderArranque([]);

      interno<(tipo: string) => void>('cambiarTipoDeRecurso')('PRACTITIONER');
      fixture.detectChanges();

      http.expectNone((r) => r.url === '/scheduling/resources');
    });

    it('un turno médico conserva el nombre de su agenda al mirar laboratorios', () => {
      montar();
      // Un turno ya sacado con un profesional…
      http
        .expectOne((r) => r.url === '/scheduling/bookings')
        .flush({
          items: [
            {
              id: 'b-1',
              resourceId: 'r-1',
              statusConceptId: 'c-conf',
              startAt: '2026-09-01T13:00:00.000Z',
            },
          ],
          count: 1,
          limit: 50,
          truncated: false,
        });
      http
        .expectOne((r) => r.url === '/scheduling/resources')
        .flush({
          items: [{ id: 'r-1', name: 'Consultorio Cardiología', capacity: 1 }],
          count: 1,
        });
      fixture.detectChanges();
      responderTerminologia([]);

      // …y ahora la persona se pone a mirar laboratorios.
      interno<(tipo: string) => void>('cambiarTipoDeRecurso')('ROOM');
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === '/scheduling/resources')
        .flush({
          items: [{ id: 'lab-1', name: 'Laboratorio Central', capacity: 2 }],
          count: 1,
        });
      fixture.detectChanges();

      // El rótulo sale del catálogo acumulado, no de la lista filtrada: con una
      // sola lista, entrar al modo laboratorio dejaba sin nombre a todos los
      // turnos médicos ya sacados.
      expect(fixture.nativeElement.textContent).toContain('Consultorio Cardiología');
    });

    it('el vacío de laboratorios no le dice a la persona que espere sin más', async () => {
      montar();
      responderArranque([]);

      // «Agendar una cita» está en la otra sección desde el toggle del
      // encabezado; hay que abrirla para ver este aviso.
      interno<(s: string) => void>('elegirSeccion')('pedir');
      await fixture.whenStable();
      interno<(tipo: string) => void>('cambiarTipoDeRecurso')('ROOM');
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/scheduling/resources').flush({ items: [], count: 0 });
      fixture.detectChanges();

      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('Todavía no hay laboratorios con horarios');
      // La salida honesta: la orden se puede llevar al mostrador igual.
      expect(texto).toContain('mostrador');
    });
  });

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

    interno<(clave: string | null) => void>('elegirAgenda')(null);
    fixture.detectChanges();

    // El `http.verify()` del afterEach falla si se pidieron cupos.
    const estado = interno<() => { status: string }>('horarios')();
    expect(estado.status).toBe('empty');
  });

  /* ---- elegir el día en el calendario (F-10) ------------------------------ */

  /**
   * Señalar un día acota los horarios a ese día. Antes había que recorrer los
   * catorce de la ventana, y para la semana siguiente, más scroll.
   */
  it('elegir un día en el calendario acota los horarios a ese día', () => {
    montar();
    responderArranque([]);

    const hoy = new Date();
    hoy.setHours(9, 0, 0, 0);
    const pasadoManana = new Date(hoy);
    pasadoManana.setDate(hoy.getDate() + 2);

    // Se inyectan los horarios ya resueltos: lo que se prueba es el filtro, no
    // la lectura, que tiene su propia prueba.
    crudo<{ set: (v: unknown) => void }>('horarios').set({
      status: 'ready',
      data: [
        { id: 'h-hoy', desde: hoy, hasta: hoy, resourceId: 'r-1', lugaresLibres: 1 },
        {
          id: 'h-otro',
          desde: pasadoManana,
          hasta: pasadoManana,
          resourceId: 'r-1',
          lugaresLibres: 1,
        },
      ],
    });

    expect(interno<() => readonly { id: string }[]>('horariosListos')()).toHaveLength(2);

    interno<(d: Date) => void>('elegirDiaDeHorarios')(hoy);
    const acotados = interno<() => readonly { id: string }[]>('horariosListos')();
    expect(acotados).toHaveLength(1);
    expect(acotados[0].id).toBe('h-hoy');

    interno<() => void>('verTodosLosHorarios')();
    expect(interno<() => readonly { id: string }[]>('horariosListos')()).toHaveLength(2);
  });

  /* ---- buscar al profesional en vez de recorrer la lista (F-13) ----------- */

  it('el buscador de profesional filtra por nombre, sin tildes ni mayúsculas', () => {
    montar();
    responderArranque([]);

    crudo<{ set: (v: unknown) => void }>('recursos').set([
      { id: 'r-1', name: 'Agenda 1', practitionerName: 'Dra. Ana Muñoz' },
      { id: 'r-2', name: 'Agenda 2', practitionerName: 'Dr. Beto Peña' },
    ]);

    const buscar = crudo<{ set: (v: string) => void }>('busquedaDeRecurso');
    const opciones = interno<() => readonly { value: string; label: string }[]>('opcionesBuscadas');

    expect(opciones()).toHaveLength(2);

    buscar.set('munoz');
    expect(opciones()).toHaveLength(1);
    // El valor es la clave de la agenda AGRUPADA (F-23), no el id del recurso:
    // sin referencia a un perfil, cada recurso es su propio grupo.
    expect(opciones()[0].value).toBe('recurso:r-1');

    buscar.set('PEÑA');
    expect(opciones()[0].value).toBe('recurso:r-2');

    buscar.set('');
    expect(opciones()).toHaveLength(2);
  });

  /* ---- elegir el lugar cuando atiende en varios (FX-6 · F-23) ------------- */

  /**
   * Lo que estas pruebas fijan, y que un refactor no puede romper en silencio:
   *
   * 1. **Un profesional es UNA entrada** aunque tenga dos consultorios. Antes
   *    salía dos veces con el mismo nombre y elegir mal escondía la mitad de
   *    los horarios: ése es el defecto que reportó Pablo.
   * 2. **La pregunta del lugar sólo aparece si hay algo que elegir.** Con un
   *    consultorio —hoy, casi todas las agendas— la pantalla no cambia.
   * 3. **«Cualquier lugar» consulta las dos agendas y mezcla por hora**, y cada
   *    hueco dice de dónde es; acotado a una sede se consulta sólo ésa y el
   *    rótulo desaparece, porque sería el mismo en todas las filas.
   */
  const DOS_CONSULTORIOS = [
    {
      id: 'r-centro',
      name: 'Cardiología · Centro',
      practitionerName: 'Dra. Ana Muñoz',
      resourceRefType: 'health_practitioner_profiles',
      resourceRefId: 'perfil-ana',
      site: { id: 'sede-centro', name: 'Sede Centro', code: 'C', addressText: 'Av. Siempreviva 1' },
    },
    {
      id: 'r-norte',
      name: 'Cardiología · Norte',
      practitionerName: 'Dra. Ana Muñoz',
      resourceRefType: 'health_practitioner_profiles',
      resourceRefId: 'perfil-ana',
      site: { id: 'sede-norte', name: 'Sede Norte', code: 'N', addressText: null },
    },
  ];

  /** Dos horas del mismo dia, para fijar que la lista se ORDENA y no se concatena. */
  const HORA_TEMPRANO = '2026-09-02T09:00:00.000Z';
  const HORA_TARDE = '2026-09-02T15:00:00.000Z';

  /** La clave con la que la pantalla agrupa las dos agendas de Ana. */
  const AGENDA_DE_ANA = 'health_practitioner_profiles:perfil-ana';

  /** Los cupos que devuelve cada sede, indexados por el recurso que se pidió. */
  function cuposPorRecurso(): Map<string | null, TestRequest> {
    return new Map(
      http
        .match((r) => r.url === '/scheduling/slots')
        .map((pedido) => [pedido.request.params.get('resourceId'), pedido]),
    );
  }

  function paginaDeCupos(items: readonly unknown[]) {
    return { items, count: items.length, limit: 100, truncated: false };
  }

  function cupo(id: string, resourceId: string, inicio: string) {
    return {
      id,
      resourceId,
      startAt: inicio,
      endAt: inicio,
      capacity: 1,
      remainingCapacity: 1,
      statusConceptId: 's-libre',
    };
  }

  it('agrupa los dos consultorios de la misma profesional en una sola opción', () => {
    montar();
    responderArranque([]);

    crudo<{ set: (v: unknown) => void }>('recursos').set(DOS_CONSULTORIOS);

    const opciones = interno<() => readonly { value: string; label: string }[]>('opcionesBuscadas');
    expect(opciones()).toHaveLength(1);
    // El nombre interno de cada agenda es justo lo que las distingue: repetirlo
    // ací sería el ruido que F-23 viene a sacar. Queda la persona.
    expect(opciones()[0].label).toBe('Dra. Ana Muñoz');
  });

  it('con un solo consultorio no pregunta dónde', () => {
    montar();
    responderArranque([]);

    crudo<{ set: (v: unknown) => void }>('recursos').set([DOS_CONSULTORIOS[0]]);
    interno<(clave: string | null) => void>('elegirAgenda')(AGENDA_DE_ANA);

    expect(interno<() => boolean>('preguntaPorSede')()).toBe(false);
    http.expectOne((r) => r.url === '/scheduling/slots').flush(paginaDeCupos([]));
  });

  it('«cualquier lugar» pide las dos agendas, mezcla por hora y dice de dónde es cada hueco', () => {
    montar();
    responderArranque([]);

    crudo<{ set: (v: unknown) => void }>('recursos').set(DOS_CONSULTORIOS);
    interno<(clave: string | null) => void>('elegirAgenda')(AGENDA_DE_ANA);

    expect(interno<() => boolean>('preguntaPorSede')()).toBe(true);
    // «Cualquier lugar» + las dos sedes.
    expect(
      interno<() => readonly { value: string; label: string }[]>('opcionesDeSede')(),
    ).toHaveLength(3);

    const pedidos = cuposPorRecurso();
    expect(pedidos.size).toBe(2);
    // El de la sede Norte contesta PRIMERO y con hora POSTERIOR: si la pantalla
    // concatenara en vez de ordenar, quedaría arriba y la lista mentiría.
    pedidos.get('r-norte')?.flush(paginaDeCupos([cupo('h-norte', 'r-norte', HORA_TARDE)]));
    pedidos.get('r-centro')?.flush(paginaDeCupos([cupo('h-centro', 'r-centro', HORA_TEMPRANO)]));

    const listos = interno<() => readonly { id: string; sede: string }[]>('horariosListos')();
    expect(listos.map((h) => h.id)).toEqual(['h-centro', 'h-norte']);
    expect(listos[0].sede).toBe('Sede Centro · Av. Siempreviva 1');
    // Sin dirección cargada va el nombre solo, no un separador colgado.
    expect(listos[1].sede).toBe('Sede Norte');
  });

  it('elegir un lugar consulta sólo ése y deja de rotular la sede en cada fila', () => {
    montar();
    responderArranque([]);

    crudo<{ set: (v: unknown) => void }>('recursos').set(DOS_CONSULTORIOS);
    interno<(clave: string | null) => void>('elegirAgenda')(AGENDA_DE_ANA);
    for (const pedido of cuposPorRecurso().values()) {
      pedido.flush(paginaDeCupos([]));
    }

    interno<(sede: string | null) => void>('elegirSede')('sede-centro');

    const pedidos = cuposPorRecurso();
    expect(pedidos.size).toBe(1);
    pedidos.get('r-centro')?.flush(paginaDeCupos([cupo('h-centro', 'r-centro', HORA_TEMPRANO)]));

    expect(interno<() => boolean>('mostrarSedeEnHorarios')()).toBe(false);
    expect(interno<() => readonly { sede: string }[]>('horariosListos')()[0].sede).toBe('');
  });

  it('si una sede no contesta, muestra los horarios de la otra y lo avisa', () => {
    montar();
    responderArranque([]);

    crudo<{ set: (v: unknown) => void }>('recursos').set(DOS_CONSULTORIOS);
    interno<(clave: string | null) => void>('elegirAgenda')(AGENDA_DE_ANA);

    const pedidos = cuposPorRecurso();
    pedidos.get('r-norte')?.error(new ProgressEvent('error'), { status: 500 });
    pedidos.get('r-centro')?.flush(paginaDeCupos([cupo('h-centro', 'r-centro', HORA_TEMPRANO)]));

    // Callarse dejaría una lista corta, que se lee como «tiene poco lugar».
    expect(interno<() => boolean>('horariosIncompletos')()).toBe(true);
    expect(interno<() => readonly { id: string }[]>('horariosListos')()).toHaveLength(1);
  });

  it('si NINGUNA sede contesta es un error, no una lista corta', () => {
    montar();
    responderArranque([]);

    crudo<{ set: (v: unknown) => void }>('recursos').set(DOS_CONSULTORIOS);
    interno<(clave: string | null) => void>('elegirAgenda')(AGENDA_DE_ANA);

    for (const pedido of cuposPorRecurso().values()) {
      pedido.error(new ProgressEvent('error'), { status: 500 });
    }

    expect(interno<() => boolean>('horariosIncompletos')()).toBe(false);
    expect(interno<() => { status: string }>('horarios')().status).toBe('error');
  });

  it('con varios lugares en foco no ofrece la lista de espera: es de UNA agenda', () => {
    montar();
    responderArranque([]);

    crudo<{ set: (v: unknown) => void }>('recursos').set(DOS_CONSULTORIOS);
    interno<(clave: string | null) => void>('elegirAgenda')(AGENDA_DE_ANA);
    for (const pedido of cuposPorRecurso().values()) {
      pedido.flush(paginaDeCupos([]));
    }

    expect(interno<() => string | null>('recursoParaEspera')()).toBeNull();

    interno<(sede: string | null) => void>('elegirSede')('sede-norte');
    http.expectOne((r) => r.url === '/scheduling/slots').flush(paginaDeCupos([]));

    expect(interno<() => string | null>('recursoParaEspera')()).toBe('r-norte');
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
function citaMock(
  id: string,
  statusConceptId: string,
  /** La demora informada sobre el turno (P8), cuando la prueba la necesita. */
  delayNotice?: {
    readonly delayMinutes: number;
    readonly message?: string;
    readonly announcedAt: Date;
  },
) {
  return {
    id,
    patientProfileId: 'p-1',
    resourceId: 'r-1',
    statusConceptId,
    startAt: new Date('2026-08-12T12:00:00.000Z'),
    endAt: new Date('2026-08-12T12:30:00.000Z'),
    reasonText: '',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    ...(delayNotice === undefined ? {} : { delayNotice }),
  };
}

function etiqueta(conceptId: string, code: string, display = code): [string, unknown] {
  return [conceptId, { conceptId, code, display, codeSystemVersionId: 'csv-1' }];
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
  readonly slots?: readonly AgendaSlot[];
  /** Las esperas activas del titular (P8). Por omisión, ninguna. */
  readonly waitlist?: readonly {
    id: string;
    patientProfileId: string;
    resourceId?: string;
    resourceLabel: string;
    priority: number;
    statusConceptId: string;
    createdAt: Date;
  }[];
}

function montarCancelacion(opts: Opciones) {
  const searchBookings = vi.fn().mockReturnValue(of(page(opts.bookings)));
  const listResources = vi.fn().mockReturnValue(of(page(opts.resources ?? [])));
  const listSlots = vi.fn().mockReturnValue(of(page(opts.slots ?? [])));
  const cancelBooking = vi.fn().mockReturnValue(of({ bookingId: 'x', capacityReleased: true }));
  const rescheduleBooking = vi
    .fn()
    .mockReturnValue(of({ bookingId: 'x', fromSlotId: 'a', toSlotId: 'b' }));
  // P8 · lista de espera: leerla y anotarse.
  const listWaitlist = vi.fn().mockReturnValue(of({ items: opts.waitlist ?? [] }));
  const enrollWaitlist = vi
    .fn()
    .mockReturnValue(of({ id: 'w1', priority: 0, statusConceptId: 'c-waiting' }));
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
        useValue: {
          searchBookings,
          listResources,
          listSlots,
          cancelBooking,
          rescheduleBooking,
          listWaitlist,
          enrollWaitlist,
        },
      },
      { provide: TerminologyClient, useValue: { readConceptLabels } },
      // Sin token de paciente del seed, se inyecta el mínimo que la pantalla usa:
      // el perfil (para pedir sus turnos) y la organización, que por omisión no
      // hay — los casos de la grilla la declaran.
      {
        provide: AuthService,
        // `userId` y `displayName` los necesita `PatientContextService` (B.1),
        // del que la pantalla toma por quién se está operando: sin ellos el
        // efecto que descarta la elección al cambiar de cuenta revienta.
        useValue: {
          userId: () => 'u-1',
          displayName: () => 'Ana Quispe',
          patientProfileId: () => 'p-1',
          activeTenantId: () => opts.tenant ?? null,
        },
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
    listWaitlist,
    enrollWaitlist,
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
    elegirAgenda(clave: string | null): void;
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
 * **El paciente NO reprograma** (pedido del propietario, 13/09/2026).
 *
 * Antes esta pantalla ofrecía «Reprogramar» sobre las citas vigentes y tenía un
 * modo entero para mover el turno desde la grilla de horarios. Mover una cita
 * reordena la agenda del profesional, así que la decisión es suya: el botón, el
 * modo y el segundo significado del hueco de la grilla se fueron, y al titular
 * le quedan **ver y cancelar**. La mitad que falta —que quien atiende SÍ pueda
 * moverla— vive en `features/agenda`.
 *
 * Lo que NO se tocó y estas pruebas cuidan: «Reprogramado desde el …» sigue
 * apareciendo. Cuando el profesional mueve la cita, el paciente necesita
 * reconocer que es la suya movida y no una ajena.
 */
describe('Appointments · el paciente no reprograma', () => {
  it('ninguna cita vigente ofrece «Reprogramar»', () => {
    const { fixture } = montarCancelacion({
      bookings: [citaMock('b-conf', 's-conf'), citaMock('b-in', 's-in')],
      labels: [etiqueta('s-conf', 'BOOKING_CONFIRMED'), etiqueta('s-in', 'BOOKING_CHECKED_IN')],
    });

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Reprogramar');
    expect(fixture.nativeElement.querySelectorAll('.turnos__reprogramar').length).toBe(0);
    // Cancelar es lo que queda, y sigue estando: las dos son vigentes.
    expect(fixture.nativeElement.querySelectorAll('.turnos__cancelar').length).toBe(2);
  });

  it('no queda rastro del modo de reprogramación en la pantalla', () => {
    const { fixture } = montarCancelacion({
      bookings: [citaMock('b-conf', 's-conf')],
      labels: [etiqueta('s-conf', 'BOOKING_CONFIRMED')],
    });

    expect(fixture.nativeElement.querySelector('[data-testid="turnos-reprogramando"]')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Volver sin mover la cita',
    );
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

  it('sin organización activa, el aviso dice que se elige desde el encabezado', async () => {
    // Sin `tenant`: el caso real de una sesión sin organización activa.
    const { fixture, comp } = montarCancelacion({ bookings: [], labels: [] });
    fixture.detectChanges();

    // El aviso vive en «Agendar una cita», la otra sección del toggle.
    p8(comp).elegirSeccion('pedir');
    await fixture.whenStable();
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

/* ==========================================================================
   P8 · lista de espera y demora del profesional, en la pantalla del paciente
   ========================================================================== */

/** Acceso tipado a lo que las pruebas de P8 ejercen. */
function p8(comp: Appointments) {
  return comp as unknown as {
    elegirAgenda(clave: string | null): void;
    anotarmeEnEspera(): Promise<void>;
    yaEnEspera(): boolean;
    esperas(): readonly { id: string; agenda: string }[];
    elegirSeccion(seccion: 'citas' | 'pedir'): void;
  };
}

/** Una espera tal como la devuelve `GET /scheduling/waitlist`. */
function esperaMock(resourceId = 'r-1') {
  return {
    id: `w-${resourceId}`,
    patientProfileId: 'p-1',
    resourceId,
    resourceLabel: 'Dra. Rivas',
    priority: 0,
    statusConceptId: 'c-activa',
    createdAt: new Date('2026-08-17T10:00:00.000Z'),
  };
}

describe('Appointments · lista de espera (P8)', () => {
  it('sin esperas no dibuja el bloque: no hay cola que mostrar', () => {
    const { fixture } = montarCancelacion({ bookings: [], labels: [] });

    expect(fixture.nativeElement.querySelector('[data-testid="turnos-esperas"]')).toBeNull();
  });

  it('con una espera activa la muestra con el nombre de la agenda', () => {
    const { fixture, comp } = montarCancelacion({
      bookings: [],
      labels: [],
      waitlist: [esperaMock()],
    });

    const bloque = fixture.nativeElement.querySelector('[data-testid="turnos-esperas"]');
    expect(bloque).not.toBeNull();
    expect(bloque.textContent).toContain('Dra. Rivas');
    // El servidor ya resuelve el nombre: la pantalla no cruza contra recursos.
    expect(p8(comp).esperas()).toHaveLength(1);
  });

  it('anotarse pide confirmación y da de alta con la agenda elegida', async () => {
    const { comp, enrollWaitlist, confirm, toast } = montarCancelacion({
      bookings: [],
      labels: [],
      tenant: 't-1',
      resources: [{ id: 'r-1', name: 'Consultorio Cardiología' }],
    });

    p8(comp).elegirAgenda('recurso:r-1');
    await p8(comp).anotarmeEnEspera();

    expect(confirm).toHaveBeenCalled();
    expect(enrollWaitlist).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't-1',
        patientProfileId: 'p-1',
        resourceId: 'r-1',
      }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('si se arrepiente no da de alta nada', async () => {
    const { comp, enrollWaitlist } = montarCancelacion({
      bookings: [],
      labels: [],
      confirm: false,
      tenant: 't-1',
      resources: [{ id: 'r-1', name: 'Consultorio Cardiología' }],
    });

    p8(comp).elegirAgenda('recurso:r-1');
    await p8(comp).anotarmeEnEspera();

    expect(enrollWaitlist).not.toHaveBeenCalled();
  });

  it('sin agenda elegida no hay a qué cola anotarse', async () => {
    const { comp, enrollWaitlist } = montarCancelacion({
      bookings: [],
      labels: [],
      tenant: 't-1',
    });

    await p8(comp).anotarmeEnEspera();

    expect(enrollWaitlist).not.toHaveBeenCalled();
  });

  it('ya anotado en esa agenda: se dice, no se ofrece anotarse de nuevo', async () => {
    const { fixture, comp } = montarCancelacion({
      bookings: [],
      labels: [],
      tenant: 't-1',
      resources: [{ id: 'r-1', name: 'Consultorio Cardiología' }],
      waitlist: [esperaMock('r-1')],
    });

    // «Anotarme en la lista de espera» vive en «Agendar una cita».
    p8(comp).elegirSeccion('pedir');
    await fixture.whenStable();
    p8(comp).elegirAgenda('recurso:r-1');
    fixture.detectChanges();

    expect(p8(comp).yaEnEspera()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-testid="turnos-ya-en-espera"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="turnos-anotarme-espera"]'),
    ).toBeNull();
  });
});

describe('Appointments · la demora se ve en el turno (P8)', () => {
  it('muestra los minutos y el mensaje del profesional', () => {
    const { fixture } = montarCancelacion({
      bookings: [
        citaMock('b-1', 's-conf', {
          delayMinutes: 20,
          message: 'Estoy en una urgencia',
          announcedAt: new Date('2026-08-12T11:40:00.000Z'),
        }),
      ],
      labels: [etiqueta('s-conf', 'BOOKING_CONFIRMED', 'Booking confirmed')],
    });

    const aviso = fixture.nativeElement.querySelector('[data-testid="turnos-motivo-demora"]');
    expect(aviso).not.toBeNull();
    expect(aviso.textContent).toContain('20 minutos');
    expect(aviso.textContent).toContain('Estoy en una urgencia');
  });

  it('sin mensaje dice los minutos igual y no deja la frase colgando', () => {
    const { fixture } = montarCancelacion({
      bookings: [
        citaMock('b-1', 's-conf', {
          delayMinutes: 15,
          announcedAt: new Date('2026-08-12T11:40:00.000Z'),
        }),
      ],
      labels: [etiqueta('s-conf', 'BOOKING_CONFIRMED', 'Booking confirmed')],
    });

    const aviso = fixture.nativeElement.querySelector('[data-testid="turnos-motivo-demora"]');
    expect(aviso.textContent).toContain('15 minutos');
    // La frase cierra con punto y no con «minutos:» seguido de nada.
    expect(aviso.textContent).toContain('15 minutos.');
    expect(aviso.textContent).not.toContain('minutos:');
  });

  it('un turno sin demora no muestra el aviso', () => {
    const { fixture } = montarCancelacion({
      bookings: [citaMock('b-1', 's-conf')],
      labels: [etiqueta('s-conf', 'BOOKING_CONFIRMED', 'Booking confirmed')],
    });

    expect(fixture.nativeElement.querySelector('[data-testid="turnos-motivo-demora"]')).toBeNull();
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
    expect(etiquetaDeRecurso({ name: 'Agenda mañana', practitionerName: 'Rosa Quispe' })).toBe(
      'Rosa Quispe — Agenda mañana',
    );
  });

  it('no repite cuando la agenda ya se llama como la persona', () => {
    expect(etiquetaDeRecurso({ name: 'Rosa Quispe', practitionerName: 'Rosa Quispe' })).toBe(
      'Rosa Quispe',
    );
  });

  it('cae al nombre del recurso para salas o perfiles sin resolver', () => {
    expect(etiquetaDeRecurso({ name: 'Consultorio 3', practitionerName: null })).toBe(
      'Consultorio 3',
    );
    // Los dobles de prueba y las respuestas viejas de la API no traen el campo.
    expect(etiquetaDeRecurso({ name: 'Consultorio 3' })).toBe('Consultorio 3');
  });
});

describe('etiquetasSinColision · dos agendas nunca se llaman igual', () => {
  let contador = 0;

  function recurso(campos: Partial<AgendaResource> = {}): AgendaResource {
    contador += 1;
    return {
      id: `rec-${contador}`,
      name: 'Consultorio',
      resourceTypeConceptId: 'tipo',
      resourceRefType: 'health_practitioner_profiles',
      resourceRefId: 'perfil',
      practitionerName: null,
      practiceId: null,
      timeZone: null,
      capacity: 1,
      stateConceptId: 'activo',
      site: null,
      ...campos,
    };
  }

  const sede = (id: string, name: string, addressText: string | null = null) => ({
    id,
    name,
    code: id,
    addressText,
    timeZone: null,
  });

  it('deja el rótulo limpio cuando no hay dos iguales', () => {
    const etiquetas = etiquetasSinColision([
      { recursos: [recurso({ practitionerName: 'Elena Salas', name: 'Norte' }), recurso({ practitionerName: 'Elena Salas', name: 'Sur' })] },
      { recursos: [recurso({ practitionerName: 'Oliver Urgel', name: 'Propio' }), recurso({ practitionerName: 'Oliver Urgel', name: 'Tarde' })] },
    ]);

    expect(etiquetas).toEqual(['Elena Salas', 'Oliver Urgel']);
  });

  it('separa por sede a dos profesionales del mismo nombre', () => {
    const etiquetas = etiquetasSinColision([
      {
        recursos: [
          recurso({ practitionerName: 'Elena Salas', name: 'Norte', site: sede('s1', 'Clínica Norte', 'Av. Siempre 123') }),
          recurso({ practitionerName: 'Elena Salas', name: 'Sur', site: sede('s1', 'Clínica Norte', 'Av. Siempre 123') }),
        ],
      },
      {
        recursos: [
          recurso({ practitionerName: 'Elena Salas', name: 'Norte', site: sede('s2', 'Centro Sur') }),
          recurso({ practitionerName: 'Elena Salas', name: 'Tarde', site: sede('s2', 'Centro Sur') }),
        ],
      },
    ]);

    expect(etiquetas[0]).toBe('Elena Salas — Clínica Norte · Av. Siempre 123');
    expect(etiquetas[1]).toBe('Elena Salas — Centro Sur');
    expect(new Set(etiquetas).size).toBe(2);
  });

  it('cae a los nombres de los consultorios cuando ninguna tiene sede', () => {
    const etiquetas = etiquetasSinColision([
      { recursos: [recurso({ practitionerName: 'Elena Salas', name: 'Norte' }), recurso({ practitionerName: 'Elena Salas', name: 'Sur' })] },
      { recursos: [recurso({ practitionerName: 'Elena Salas', name: 'Martes' }), recurso({ practitionerName: 'Elena Salas', name: 'Tarde' })] },
    ]);

    expect(etiquetas[0]).toBe('Elena Salas — Norte, Sur');
    expect(etiquetas[1]).toBe('Elena Salas — Martes, Tarde');
  });

  it('numera cuando no queda nada que las distinga — el caso observado en Neon', () => {
    // Dos personas homónimas, mismos nombres de consultorio, ninguna con sede:
    // una tenía 22 cupos libres y la otra ninguno, y la lista las mostraba
    // idénticas.
    const mismos = () => [
      recurso({ practitionerName: 'Elena Salas', name: 'Consultorio Norte' }),
      recurso({ practitionerName: 'Elena Salas', name: 'Consultorio Sur' }),
    ];
    const etiquetas = etiquetasSinColision([{ recursos: mismos() }, { recursos: mismos() }]);

    expect(etiquetas[0]).toBe('Elena Salas — Consultorio Norte, Consultorio Sur (1 de 2)');
    expect(etiquetas[1]).toBe('Elena Salas — Consultorio Norte, Consultorio Sur (2 de 2)');
    expect(new Set(etiquetas).size).toBe(2);
  });

  it('no toca a la agenda de un solo recurso, que ya trae su nombre interno', () => {
    const etiquetas = etiquetasSinColision([
      { recursos: [recurso({ practitionerName: 'Elena Salas', name: 'Consultorio FX-7' })] },
      { recursos: [recurso({ practitionerName: 'Elena Salas', name: 'Norte' }), recurso({ practitionerName: 'Elena Salas', name: 'Sur' })] },
    ]);

    expect(etiquetas[0]).toBe('Elena Salas — Consultorio FX-7');
    expect(etiquetas[1]).toBe('Elena Salas');
  });

  it('tolera una lista vacía', () => {
    expect(etiquetasSinColision([])).toEqual([]);
  });
});

describe('opcionesDeSedeDe · el desplegable de lugar tampoco repite', () => {
  let n = 0;

  function recurso(name: string, site: AgendaResource['site'] = null): AgendaResource {
    n += 1;
    return {
      id: `rec-s-${n}`,
      name,
      resourceTypeConceptId: 'tipo',
      resourceRefType: 'health_practitioner_profiles',
      resourceRefId: 'perfil',
      practitionerName: 'Elena Salas',
      practiceId: null,
      timeZone: null,
      capacity: 1,
      stateConceptId: 'activo',
      site,
    };
  }

  const sede = (id: string, name: string, addressText: string | null = null) => ({
    id,
    name,
    code: id,
    addressText,
    timeZone: null,
  });

  it('no pregunta cuando hay un solo lugar', () => {
    expect(opcionesDeSedeDe([recurso('Norte', sede('s1', 'Clínica Norte'))])).toEqual([]);
  });

  it('distingue los lugares sin sede por el nombre del recurso — lo visto en pantalla', () => {
    // Cuatro consultorios de la misma persona, ninguno con sede cargada: el
    // desplegable mostraba cuatro veces «Sin consultorio registrado».
    const opciones = opcionesDeSedeDe([
      recurso('Consultorio Martes'),
      recurso('Consultorio Norte'),
      recurso('Consultorio Sur'),
      recurso('Consultorio Tarde'),
    ]);

    const rotulos = opciones.map((o) => o.label);
    expect(rotulos[0]).toBe('Cualquier lugar — ver todos los horarios');
    expect(new Set(rotulos).size).toBe(rotulos.length);
    expect(rotulos).toContain('Sin consultorio registrado — Consultorio Norte');
  });

  it('deja el nombre de la sede limpio cuando ya son distintos', () => {
    const opciones = opcionesDeSedeDe([
      recurso('Mañana', sede('s1', 'Clínica Norte', 'Av. Siempre 123')),
      recurso('Tarde', sede('s2', 'Centro Sur')),
    ]);

    expect(opciones.map((o) => o.label)).toEqual([
      'Cualquier lugar — ver todos los horarios',
      'Clínica Norte · Av. Siempre 123',
      'Centro Sur',
    ]);
  });

  it('junta en un solo lugar los recursos que comparten sede', () => {
    const misma = sede('s1', 'Clínica Norte');
    const opciones = opcionesDeSedeDe([
      recurso('Mañana', misma),
      recurso('Tarde', misma),
      recurso('Nocturno', sede('s2', 'Centro Sur')),
    ]);

    expect(opciones).toHaveLength(3);
    expect(opciones.map((o) => o.label)).toContain('Clínica Norte');
  });
});
