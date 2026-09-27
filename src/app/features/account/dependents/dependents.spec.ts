import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { PatientContextService } from '../../../core/patient-context/patient-context.service';
import { Dependents } from './dependents';

/**
 * La pantalla de dependientes.
 *
 * Lo que fija, que es lo que no se deduce del componente:
 *
 * - **Una cuenta sin perfil de paciente no sale a la red** ni ofrece registrar:
 *   quien atiende tiene sesión válida y ninguna razón para tener dependientes.
 * - **La tarjeta dice el parentesco dado vuelta** —«Hijo/a»— y la edad tal como
 *   la calculó el servidor: la pantalla no la deriva.
 * - **Elegir a alguien cambia el contexto** que después consumen las citas y la
 *   historia clínica.
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
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.x`;
}

/**
 * Un dependiente **como viaja por el cable**.
 *
 * La fecha va como instante ISO y no como `Date`, que es lo que de verdad manda
 * el servidor: fabricar la respuesta con la forma de la vista dejaría sin
 * probar la conversión de la frontera, que es donde vivían los dos defectos que
 * `wire.ts` documenta.
 */
function dependienteDelCable(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'proxy-1',
    patientProfileId: 'pp-hijo',
    personId: 'per-hijo',
    fullName: 'Mateo Quispe',
    birthDate: '2018-03-14T00:00:00.000Z',
    ageYears: 7,
    relationshipCode: 'CHILD',
    relationshipDisplay: 'Hijo/a',
    isLegalGuardian: true,
    ...overrides,
  };
}

describe('Dependents', () => {
  let fixture: ComponentFixture<Dependents>;
  let http: HttpTestingController;
  let sesion: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  const INCOMING = '/profiles/patients/me/dependent-requests/incoming';

  /** Abre sesión, monta la pantalla y responde la bandeja de solicitudes recibidas. */
  function montar({
    pid = 'pp-titular',
    solicitudes = [],
  }: { pid?: string | null; solicitudes?: readonly Record<string, unknown>[] } = {}): void {
    sesion.start({
      accessToken: jwt({
        sub: 'user-1',
        roles: ['USER', 'PATIENT'],
        tenants: ['t-1'],
        name: 'Ana Quispe',
        ...(pid === null ? {} : { pid }),
      }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(Dependents);
    fixture.detectChanges();
    if (pid !== null) {
      http.expectOne((r) => r.url === INCOMING).flush(solicitudes);
      fixture.detectChanges();
    }
  }

  /** Responde la carga de dependientes con cuerpos del cable. */
  function responder(dependientes: readonly Record<string, unknown>[]): void {
    http
      .expectOne((r) => r.url === '/profiles/patients/me/dependents')
      .flush(dependientes);
    fixture.detectChanges();
  }

  /** El texto visible de la pantalla. */
  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('sin dependientes invita a registrar al primero', () => {
    montar();
    responder([]);

    expect(texto()).toContain('Todavía no registraste a nadie');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="dependents-nuevo"]'),
    ).not.toBeNull();
  });

  it('dibuja una tarjeta por dependiente, con parentesco y edad', () => {
    montar();
    responder([dependienteDelCable()]);

    const visible = texto();
    expect(visible).toContain('Mateo Quispe');
    // Dado vuelta por el servidor: la madre declaró «soy su madre», la tarjeta
    // dice qué es él para ella.
    expect(visible).toContain('Hijo/a');
    // La edad viene calculada; la pantalla no la deriva de la fecha.
    expect(visible).toContain('7 años');
  });

  it('una edad sin declarar se dice, no se inventa un cero', () => {
    montar();
    responder([dependienteDelCable({ ageYears: null, birthDate: null })]);

    expect(texto()).toContain('Edad no declarada');
    expect(texto()).not.toContain('0 años');
  });

  it('elegir a un dependiente cambia el paciente activo', () => {
    montar();
    responder([dependienteDelCable()]);
    const contexto = TestBed.inject(PatientContextService);

    const boton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Actuar por Mateo Quispe"]',
    );
    boton!.click();
    fixture.detectChanges();

    expect(contexto.activePatientProfileId()).toBe('pp-hijo');
    // Y la tarjeta deja de ofrecer la acción: ya es el perfil activo.
    expect(texto()).toContain('Perfil activo');
  });

  it('con un dependiente activo se ofrece volver al perfil propio', () => {
    montar();
    responder([dependienteDelCable()]);
    const contexto = TestBed.inject(PatientContextService);
    contexto.selectPatient('pp-hijo');
    fixture.detectChanges();

    const volver = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="dependents-volver-a-mi"]',
    );
    expect(volver).not.toBeNull();

    volver!.click();
    fixture.detectChanges();

    expect(contexto.activePatientProfileId()).toBe('pp-titular');
  });

  it('muestra las solicitudes recibidas y aceptar las responde', () => {
    montar({
      solicitudes: [
        { id: 'sol-1', requesterDisplayName: 'Rosa Choque', createdAt: '2026-09-25T10:00:00.000Z' },
      ],
    });
    responder([]);

    expect(texto()).toContain('Te quieren registrar como dependiente');
    expect(texto()).toContain('Rosa Choque');

    const aceptar = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Aceptar la solicitud de Rosa Choque"]',
    );
    aceptar!.click();

    const peticion = http.expectOne(
      (r) => r.method === 'POST' && r.url === '/profiles/patients/me/dependent-requests/sol-1/accept',
    );
    peticion.flush({ id: 'sol-1', status: 'ACCEPTED' });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="dependents-solicitudes"]'),
    ).toBeNull();
  });

  it('rechazar llama al rechazo, no a la aceptación', () => {
    montar({
      solicitudes: [
        { id: 'sol-2', requesterDisplayName: 'Rosa Choque', createdAt: '2026-09-25T10:00:00.000Z' },
      ],
    });
    responder([]);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label="Rechazar la solicitud de Rosa Choque"]')!
      .click();

    http
      .expectOne(
        (r) => r.method === 'POST' && r.url === '/profiles/patients/me/dependent-requests/sol-2/reject',
      )
      .flush({ id: 'sol-2', status: 'REJECTED' });
    http.expectNone((r) => r.url.endsWith('/accept'));
  });

  it('una cuenta sin perfil de paciente no pide nada y lo explica', () => {
    montar({ pid: null });

    http.expectNone((r) => r.url === '/profiles/patients/me/dependents');
    http.expectNone((r) => r.url === INCOMING);
    expect(texto()).toContain('no tiene perfil de paciente');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="dependents-nuevo"]'),
    ).toBeNull();
  });
});
