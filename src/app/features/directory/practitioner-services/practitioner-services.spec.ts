import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import { PractitionerServices } from './practitioner-services';

/**
 * Los servicios de un profesional en su ficha (v4.2.40).
 *
 * Lo que se fija: la sección **sólo existe si hay algo que pedir**, cada servicio dice
 * cuánto dura y cuánto sale, «Pedir turno» lleva con el profesional y el servicio ya
 * elegidos, y un fallo no tumba el resto de la ficha.
 */

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const oferta = (over: Record<string, unknown> = {}) => ({
  id: 'of-1',
  practitionerProfileId: 'prof-1',
  serviceCatalogId: 's-1',
  serviceCode: 'ECO',
  serviceName: 'Ecocardiograma Doppler',
  price: '480.00',
  minDurationMinutes: 30,
  maxDurationMinutes: 45,
  prepMinutes: 0,
  cleanupMinutes: 0,
  isPatientBookable: true,
  requiresApproval: false,
  isActive: true,
  ...over,
});

@Component({
  imports: [PractitionerServices],
  template: '<app-practitioner-services [practitionerProfileId]="perfil()" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Anfitrion {
  readonly perfil = signal('prof-1');
}

describe('PractitionerServices', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function montar(conSesion = true): void {
    if (conSesion) {
      TestBed.inject(SessionStore).start({
        accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'] }),
        refreshToken: 'r-1',
      });
    }
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (testId: string): Element | null => raiz().querySelector(`[data-testid="${testId}"]`);

  function responder(items: readonly unknown[]): void {
    http.expectOne((r) => r.url === '/scheduling/service-offerings').flush({ items });
    fixture.detectChanges();
  }

  it('pide los servicios del profesional de la ficha', () => {
    montar();
    const pedido = http.expectOne((r) => r.url === '/scheduling/service-offerings');
    expect(pedido.request.params.get('practitionerProfileId')).toBe('prof-1');
    pedido.flush({ items: [] });
  });

  it('cada servicio dice cuánto dura, en rango, y cuánto sale', () => {
    montar();
    responder([oferta()]);

    expect(q('ficha-servicios')).not.toBeNull();
    expect(raiz().textContent).toContain('Ecocardiograma Doppler');
    expect(q('servicio-duracion')?.textContent).toContain('Dura 30–45 min');
    expect(q('servicio-precio')?.textContent).toContain('480.00');
    expect(q('servicio-precio')?.textContent).toContain('Bs');
  });

  it('con mínimo y máximo iguales dice un solo número', () => {
    montar();
    responder([oferta({ minDurationMinutes: 20, maxDurationMinutes: 20 })]);

    expect(q('servicio-duracion')?.textContent).toContain('Dura 20 min');
    expect(q('servicio-duracion')?.textContent).not.toContain('–');
  });

  it('«Pedir cita» lleva a agendar con el profesional y el servicio ya elegidos', () => {
    montar();
    responder([oferta()]);

    const enlace = q('servicio-pedir') as HTMLAnchorElement;
    const url = new URL(enlace.href, 'http://localhost');
    expect(url.pathname).toBe('/my-account/appointments');
    expect(url.searchParams.get('seccion')).toBe('pedir');
    expect(url.searchParams.get('profesional')).toBe('prof-1');
    expect(url.searchParams.get('servicio')).toBe('of-1');
    // El nombre accesible dice QUÉ se pide: «Pedir turno» repetido no se distingue.
    expect(enlace.getAttribute('aria-label')).toBe('Pedir cita: Ecocardiograma Doppler');
  });

  it('avisa cuando el profesional tiene que confirmarlo', () => {
    montar();
    responder([oferta({ requiresApproval: true })]);
    expect(raiz().textContent).toContain('tiene que confirmarlo');
  });

  it('un profesional sin servicios NO dibuja la sección', () => {
    montar();
    responder([]);

    expect(q('ficha-servicios')).toBeNull();
    expect(raiz().textContent?.trim()).toBe('');
  });

  it('mientras carga no dibuja nada: ni sección ni esqueleto', () => {
    montar();
    expect(raiz().textContent?.trim()).toBe('');
    http.expectOne((r) => r.url === '/scheduling/service-offerings').flush({ items: [] });
  });

  it('un fallo avisa sin tumbar la ficha y deja reintentar', () => {
    montar();
    http
      .expectOne((r) => r.url === '/scheduling/service-offerings')
      .flush({ message: 'caído' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(q('ficha-servicios-error')).not.toBeNull();

    (raiz().querySelector('[data-testid="ficha-servicios-error"] button') as HTMLButtonElement).click();
    http.expectOne((r) => r.url === '/scheduling/service-offerings').flush({ items: [oferta()] });
    fixture.detectChanges();
    expect(q('ficha-servicios')).not.toBeNull();
  });

  it('sin sesión no pide nada: la lectura la exige y un 401 sería peor que no mostrarla', () => {
    montar(false);
    http.expectNone((r) => r.url === '/scheduling/service-offerings');
    expect(raiz().textContent?.trim()).toBe('');
  });

  it('al cambiar de profesional vuelve a pedir los servicios del nuevo', () => {
    montar();
    responder([oferta()]);

    fixture.componentInstance.perfil.set('prof-2');
    fixture.detectChanges();

    const pedido = http.expectOne((r) => r.url === '/scheduling/service-offerings');
    expect(pedido.request.params.get('practitionerProfileId')).toBe('prof-2');
    pedido.flush({ items: [] });
    fixture.detectChanges();
    expect(q('ficha-servicios')).toBeNull();
  });
});
