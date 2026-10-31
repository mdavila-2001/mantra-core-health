import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../core/auth/session.store';
import { RequestAccess } from './request-access';

/** Un JWT sin firma: la sesión sólo lee los claims. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

/**
 * Solicitar vinculación. Lo que estas pruebas fijan:
 *
 * 1. **La composición** (composition-rules §5): el formulario va en UNA
 *    tarjeta y la acción en su pie, no suelta debajo.
 * 2. **El envío**: el motivo viaja a `POST /authz/care-relationships/request`
 *    con la organización activa, el botón queda ocupado mientras tanto y, con
 *    la respuesta, se vuelve al buscador.
 * 3. **El duplicado** (409) se dice en palabras y deja el botón usable.
 */
describe('RequestAccess', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'medical-records/:profileId/request-access', component: RequestAccess },
          { path: 'medical-records', children: [] },
        ]),
      ],
    });
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/medical-records/p-1/request-access', RequestAccess);
    http.expectOne((r) => r.url.endsWith('/profiles/patients/p-1')).flush({
      profileId: 'p-1',
      displayName: 'Ana Lucía Pérez Quiroga',
    });
    harness.detectChanges();
  });

  afterEach(() => http.verify());

  function raiz(): HTMLElement {
    return harness.routeNativeElement!;
  }

  function boton(): HTMLButtonElement {
    return raiz().querySelector<HTMLButtonElement>('[data-testid="solicitar-acceso-enviar"]')!;
  }

  function escribirMotivo(texto: string): void {
    const campo = raiz().querySelector('textarea')!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  it('el formulario va en una tarjeta y la acción en su pie', () => {
    const tarjetas = raiz().querySelectorAll('app-card');
    expect(tarjetas).toHaveLength(1);
    expect(tarjetas[0]!.querySelector('textarea')).not.toBeNull();
    expect(tarjetas[0]!.querySelector('.card__footer [data-testid="solicitar-acceso-enviar"]')).not.toBeNull();
  });

  it('envía el motivo con la organización activa y vuelve al buscador', async () => {
    escribirMotivo('  Seguimiento de una derivación  ');
    boton().click();
    harness.detectChanges();

    const pedido = http.expectOne((r) => r.url.endsWith('/authz/care-relationships/request'));
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({
      tenantId: 't-1',
      patientProfileId: 'p-1',
      reasonText: 'Seguimiento de una derivación',
    });
    expect(boton().getAttribute('aria-busy')).toBe('true');

    pedido.flush({ id: 'rel-1' });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/medical-records');
  });

  it('un duplicado (409) se dice en palabras y deja volver a intentar', () => {
    boton().click();
    http
      .expectOne((r) => r.url.endsWith('/authz/care-relationships/request'))
      .flush({ code: 'CONFLICT', message: 'dup' }, { status: 409, statusText: 'Conflict' });
    harness.detectChanges();

    expect(raiz().textContent).toContain(
      'Ya existe una solicitud pendiente o un vínculo activo con este paciente.',
    );
    expect(boton().disabled).toBe(false);
  });
});
