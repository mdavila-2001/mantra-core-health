import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { PatientHome } from './patient-home';

/**
 * «Mi salud» — el panel de quien viene a atenderse (F-16 / F-17).
 *
 * Lo que estas pruebas fijan no es la maqueta sino las tres promesas del
 * carril: que el paciente vea **lo suyo**, que quien recién llega no se
 * encuentre una pantalla vacía, y que en ninguna parte aparezca vocabulario de
 * sistema —organización, secciones, roles, uuid—, que es exactamente lo que la
 * analista marcó del panel anterior.
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

const PERFIL = 'pp-1';

/** Una historia vacía, con la forma exacta del resumen clínico. */
function historiaVacia(): Record<string, unknown> {
  return {
    patientProfileId: PERFIL,
    conditions: [],
    allergies: [],
    medicationRequests: [],
    observations: [],
    encounters: [],
    careEpisodes: [],
    limit: 20,
    truncated: [],
  };
}

describe('PatientHome', () => {
  let fixture: ComponentFixture<PatientHome>;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // Declarado en `imports` para que `compileComponents` lo alcance: la
      // plantilla trae un `@defer` desde C5 y sin compilar queda sin metadatos.
      imports: [PatientHome],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  /**
   * Abre sesión de paciente y monta. `pid` ausente = cuenta sin ficha.
   *
   * `async` desde que el panel encabeza con el flujo de síntomas (C5 del plan
   * de UX): va dentro de un `@defer` —la tabla de síntomas no puede viajar en
   * el bundle inicial— y una plantilla con `@defer` exige `compileComponents`.
   */
  async function montar({ pid }: { pid?: string } = { pid: PERFIL }): Promise<void> {
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
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(PatientHome);
    fixture.detectChanges();
  }

  /** Responde las dos lecturas del panel. */
  function responder(citas: unknown[], historia: Record<string, unknown> | null): void {
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush({ items: citas, count: citas.length, limit: 20, truncated: false });
    http
      .expectOne((r) => r.url === `/clinical/patients/${PERFIL}/summary`)
      .flush(historia ?? historiaVacia());
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('saluda por el nombre y habla de lo suyo, no de la organización', async () => {
    await montar();
    responder([], null);

    expect(texto()).toContain('Ana Quispe');
    // El subtítulo cambió con C5: el panel ahora encabeza con los síntomas.
    expect(texto()).toContain('Contanos qué te pasa');
  });

  /**
   * F-16 / F-17. Lo que la analista marcó del panel anterior: «¿a qué se
   * refiere organización desde la vista del paciente?», «Secciones disponibles:
   * 12», «estado del sistema». Nada de eso es del paciente.
   */
  it('no usa vocabulario de sistema ni muestra identificadores', async () => {
    await montar();
    responder([{ id: 'b-1', statusConceptId: 'c-1', startAt: '2099-01-01T13:00:00.000Z' }], null);

    const t = texto().toLowerCase();
    for (const palabra of [
      'organización',
      'organizaciones',
      'secciones',
      'estado del sistema',
      'tenant',
      'patient',
    ]) {
      expect(t).not.toContain(palabra);
    }
    expect(texto()).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it('muestra el próximo turno, no el más viejo ni uno que ya pasó', async () => {
    await montar();
    responder(
      [
        { id: 'pasado', statusConceptId: 'c-1', startAt: '2020-01-01T13:00:00.000Z' },
        { id: 'lejano', statusConceptId: 'c-1', startAt: '2099-12-31T13:00:00.000Z' },
        { id: 'proximo', statusConceptId: 'c-1', startAt: '2099-01-01T13:00:00.000Z' },
      ],
      null,
    );

    // Se comprueba cuál es, no cómo se formatea la fecha.
    const tarjeta = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="mi-salud-proximo-turno"]',
    );
    expect(tarjeta?.getAttribute('data-turno')).toBe('proximo');
  });

  it('quien recién llega recibe una invitación, no tres tarjetas vacías', async () => {
    await montar();
    responder([], null);

    const primera = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="mi-salud-primera-vez"]',
    );
    expect(primera).not.toBeNull();
    expect(primera?.textContent).toContain('Pedir mi primer turno');
  });

  it('con historia, ofrece ver y descargar la última receta', async () => {
    await montar();
    responder([], {
      ...historiaVacia(),
      medicationRequests: [
        { id: 'r-1', medicationConceptId: 'm-1', issuedAt: '2026-08-10T10:00:00.000Z' },
      ],
    });

    const receta = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="mi-salud-receta"]',
    );
    expect(receta?.textContent).toContain('Ver y descargar');
    expect(receta?.textContent).toContain('2026');
  });

  /** La Guía es de los pacientes: es donde buscan con quién atenderse. */
  it('ofrece los accesos del paciente, la Guía incluida', async () => {
    await montar();
    responder([], null);

    const rutas = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
        '[data-testid="mi-salud-acceso"]',
      ),
    ].map((enlace) => enlace.getAttribute('href'));

    expect(rutas).toContain('/directory');
    expect(rutas).toContain('/my-account/appointments');
    expect(rutas).toContain('/my-account/medical-record');
  });

  /** Media pantalla útil es mejor que un error que tapa lo que sí se pudo leer. */
  it('si falla una lectura, muestra la otra', async () => {
    await montar();
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush('nope', { status: 500, statusText: 'Server Error' });
    http.expectOne((r) => r.url === `/clinical/patients/${PERFIL}/summary`).flush({
      ...historiaVacia(),
      medicationRequests: [
        { id: 'r-1', medicationConceptId: 'm-1', issuedAt: '2026-08-10T10:00:00.000Z' },
      ],
    });
    fixture.detectChanges();

    expect(texto()).toContain('Ver y descargar');
  });

  it('sin ficha de paciente no sale a la red', async () => {
    await montar({ pid: undefined });

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(texto()).toContain('ficha de paciente');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="mi-salud-sin-ficha"]'),
    ).not.toBeNull();
  });
});
