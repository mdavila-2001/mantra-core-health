import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import type { PublishedTemplate } from '../../../core/data-access/scheduling/scheduling.types';
import { ServicesSchedule, servicesRulesOf } from './services-schedule';

/**
 * «Horarios de otros servicios» — la pestaña que el propietario pidió para ver,
 * separados de las consultas, los horarios de estudios y procedimientos.
 *
 * Lo que se fija: junta las franjas de servicios de **todas** las plantillas
 * vigentes (la causa de que hoy no se vieran en ningún lado), no muestra las de
 * consultas, y sin franjas de servicios lleva a «Cambiar mi horario».
 */

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const RECURSO = {
  id: 'res-1',
  name: 'Agenda de la doctora',
  resourceTypeConceptId: 'c',
  resourceRefType: 'healthcare_professional_profiles',
  resourceRefId: 'hp-1',
  practitionerName: 'Dra. Prueba',
  practiceId: null,
  timeZone: null,
  capacity: 1,
  stateConceptId: 'c',
  site: { id: 'site-1', name: 'Clínica Norte' },
};

function plantilla(over: Partial<PublishedTemplate>): PublishedTemplate {
  return {
    id: 'tpl',
    retired: false,
    name: 'Horario',
    rules: [],
    statusConceptId: 'c',
    ...over,
  } as PublishedTemplate;
}

const MANANAS = plantilla({
  id: 'tpl-m',
  name: 'Mañanas en la clínica',
  slotMinutes: 30,
  rules: [
    { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' },
    { dayOfWeek: 3, startTime: '08:00', endTime: '12:00', bookingMode: 'MIXED' },
  ],
});

const ESTUDIOS = plantilla({
  id: 'tpl-e',
  name: 'Estudios en la clínica',
  slotMinutes: 30,
  rules: [
    { dayOfWeek: 2, startTime: '14:00', endTime: '18:00', bookingMode: 'SERVICES' },
    { dayOfWeek: 4, startTime: '14:00', endTime: '18:00', bookingMode: 'SERVICES' },
  ],
});

describe('servicesRulesOf', () => {
  it('junta las franjas de servicios y «Ambos» de todas las plantillas vigentes', () => {
    const { rules, templateNames } = servicesRulesOf([MANANAS, ESTUDIOS]);
    expect(rules.map((r) => `${r.dayOfWeek}-${r.bookingMode}`)).toEqual([
      '3-MIXED',
      '2-SERVICES',
      '4-SERVICES',
    ]);
    expect(templateNames).toBe('Mañanas en la clínica · Estudios en la clínica');
    // Cada regla se lleva el turno de su plantilla: la grilla recibe uno solo.
    expect(rules.every((r) => r.slotMinutes === 30)).toBe(true);
  });

  it('ignora las plantillas retiradas', () => {
    const { rules } = servicesRulesOf([{ ...ESTUDIOS, retired: true }, MANANAS]);
    expect(rules.map((r) => r.dayOfWeek)).toEqual([3]);
  });

  it('sin franjas de servicios no hay nombre que mostrar', () => {
    expect(servicesRulesOf([plantilla({ rules: [{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }] })])).toEqual({
      rules: [],
      templateNames: null,
    });
  });
});

describe('ServicesSchedule', () => {
  let fixture: ComponentFixture<ServicesSchedule>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function montar(claims: Record<string, unknown> = { hpid: 'hp-1' }): void {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'], ...claims }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(ServicesSchedule);
    fixture.detectChanges();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const todos = (testId: string): Element[] => [...raiz().querySelectorAll(`[data-testid="${testId}"]`)];

  function responder(plantillas: readonly PublishedTemplate[], ofertas: readonly unknown[] = []): void {
    http.expectOne((r) => r.url.endsWith('/scheduling/service-offerings')).flush({ items: ofertas });
    http.expectOne((r) => r.url.endsWith('/scheduling/resources')).flush({ items: [RECURSO], count: 1 });
    http
      .expectOne((r) => r.url.endsWith('/scheduling/resources/res-1/templates') || r.url.endsWith('/templates'))
      .flush({ items: plantillas, count: plantillas.length });
    fixture.detectChanges();
  }

  it('dibuja la grilla con las franjas de servicios, no las de consulta', () => {
    montar();
    responder([MANANAS, ESTUDIOS]);

    expect(todos('services-schedule-grid')).toHaveLength(1);
    const bloques = todos('horario-bloque') as HTMLElement[];
    // Martes, miércoles («Ambos») y jueves; el lunes de consultas no.
    expect(bloques).toHaveLength(3);
    expect(bloques.map((b) => b.getAttribute('data-mode')).sort()).toEqual([
      'MIXED',
      'SERVICES',
      'SERVICES',
    ]);
    expect(raiz().textContent).toContain('Clínica Norte');
  });

  it('lista los servicios activos con duración y precio', () => {
    montar();
    responder(
      [ESTUDIOS],
      [
        {
          id: 'of-1',
          practitionerProfileId: 'hp-1',
          serviceCatalogId: 's-1',
          serviceCode: 'ECO',
          serviceName: 'Ecografía abdominal',
          price: '250.00',
          minDurationMinutes: 20,
          maxDurationMinutes: 30,
          prepMinutes: 0,
          cleanupMinutes: 5,
          isPatientBookable: true,
          requiresApproval: false,
          isActive: true,
        },
        {
          id: 'of-2',
          practitionerProfileId: 'hp-1',
          serviceCatalogId: 's-2',
          serviceCode: 'OFF',
          serviceName: 'Apagado',
          price: '1.00',
          minDurationMinutes: 10,
          maxDurationMinutes: 10,
          prepMinutes: 0,
          cleanupMinutes: 0,
          isPatientBookable: true,
          requiresApproval: false,
          isActive: false,
        },
      ],
    );
    const ofertas = todos('services-schedule-offering');
    expect(ofertas).toHaveLength(1);
    expect(ofertas[0]?.textContent).toContain('Ecografía abdominal');
    expect(ofertas[0]?.textContent).toContain('20–30 min');
  });

  it('sin franjas de servicios lleva a «Cambiar mi horario»', () => {
    montar();
    responder([MANANAS].map((t) => ({ ...t, rules: [t.rules[0]!] })));

    expect(todos('services-schedule-grid')).toHaveLength(0);
    expect(raiz().textContent).toContain('Todavía no declaraste horarios para otros servicios');
    const enlaces = [...raiz().querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(enlaces).toContain('/schedule/edit');
  });

  it('una sesión sin perfil profesional no pide nada al servidor', () => {
    montar({});
    expect(raiz().textContent).toContain('Todavía no publicaste tu horario');
  });
});
