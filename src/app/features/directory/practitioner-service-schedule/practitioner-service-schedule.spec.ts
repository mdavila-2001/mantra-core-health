import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import { PractitionerServiceSchedule } from './practitioner-service-schedule';

/**
 * «Otros servicios» en la ficha del profesional, del lado del paciente.
 *
 * Lo que se fija: el paciente ve cuándo puede pedir cada servicio sin entrar a
 * «Agendar una cita», cada inicio lleva a la confirmación con el mismo contrato
 * que usa la reserva, y un profesional sin servicios lo dice en vez de mostrar
 * una grilla vacía.
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
  serviceName: 'Ecografía abdominal',
  price: '250.00',
  minDurationMinutes: 20,
  maxDurationMinutes: 30,
  prepMinutes: 0,
  cleanupMinutes: 0,
  isPatientBookable: true,
  requiresApproval: false,
  isActive: true,
  ...over,
});

const RECURSO = {
  id: 'res-1',
  name: 'Agenda',
  resourceTypeConceptId: 'c',
  resourceRefType: 'practitioner_profiles',
  resourceRefId: 'prof-1',
  practitionerName: 'Dra. Prueba',
  practiceId: null,
  timeZone: null,
  capacity: 1,
  stateConceptId: 'c',
  site: { id: 'site-1', name: 'Clínica Norte' },
};

@Component({
  imports: [PractitionerServiceSchedule],
  template:
    '<app-practitioner-service-schedule [practitionerProfileId]="perfil()" [tenantId]="tenant()" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Anfitrion {
  readonly perfil = signal('prof-1');
  readonly tenant = signal<string | null>('t-1');
}

describe('PractitionerServiceSchedule', () => {
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
  const todos = (testId: string): HTMLElement[] => [
    ...raiz().querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`),
  ];

  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('sin sesión no pide nada y lo dice', () => {
    montar(false);
    expect(raiz().textContent).toContain('Entre para ver los horarios');
  });

  it('un profesional sin servicios lo dice en vez de mostrar una grilla vacía', async () => {
    montar();
    http.expectOne((r) => r.url.endsWith('/scheduling/service-offerings')).flush({ items: [] });
    await estabilizar();
    expect(todos('service-schedule-none')).toHaveLength(1);
    expect(todos('service-schedule-start')).toHaveLength(0);
  });

  it('elige el primer servicio, lista sus inicios y cada uno lleva a confirmar la reserva', async () => {
    montar();
    http
      .expectOne((r) => r.url.endsWith('/scheduling/service-offerings'))
      .flush({ items: [oferta(), oferta({ id: 'of-2', serviceName: 'Sólo interno', isPatientBookable: false })] });
    await estabilizar();

    http.expectOne((r) => r.url.endsWith('/scheduling/resources')).flush({ items: [RECURSO], count: 1 });
    await estabilizar();

    const disponibilidad = http.expectOne((r) => r.url.endsWith('/scheduling/service-availability'));
    expect(disponibilidad.request.params.get('offeringId')).toBe('of-1');
    expect(disponibilidad.request.params.get('resourceId')).toBe('res-1');
    const inicio = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const fin = new Date(inicio.getTime() + 30 * 60 * 1000);
    disponibilidad.flush({
      offeringId: 'of-1',
      minDurationMinutes: 20,
      maxDurationMinutes: 30,
      items: [
        {
          resourceId: 'res-1',
          startAt: inicio.toISOString(),
          endAtMax: fin.toISOString(),
          endAtMin: new Date(inicio.getTime() + 20 * 60 * 1000).toISOString(),
        },
      ],
    });
    await estabilizar();

    expect(raiz().textContent).toContain('Ecografía abdominal');
    expect(raiz().textContent).toContain('Clínica Norte');
    const chips = todos('service-schedule-start');
    expect(chips).toHaveLength(1);
    const enlace = new URL(chips[0]?.getAttribute('href') ?? '', 'http://x');
    expect(enlace.pathname).toBe('/my-account/appointments/book/servicio');
    expect(enlace.searchParams.get('recurso')).toBe('res-1');
    expect(enlace.searchParams.get('oferta')).toBe('of-1');
    expect(enlace.searchParams.get('desde')).toBe(inicio.toISOString());
    expect(enlace.searchParams.get('hasta')).toBe(fin.toISOString());
    expect(chips[0]?.getAttribute('aria-label')).toContain('Pedir Ecografía abdominal el');
  });
});
