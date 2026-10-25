import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import { PracticeOnboardingClient } from '../../../core/data-access/practice-onboarding/practice-onboarding.client';
import type {
  CreatedOrganizationPractice,
  NewOrganizationPractice,
} from '../../../core/data-access/practice-onboarding/practice-onboarding.types';
import { CARGADOR_DE_LEAFLET } from '../../../shared/components/organisms/map/map';
import { mensajeDeLaConfiguracion, MedicalCenterSetup } from './medical-center-setup';

const TENANT = 'tenant-centro';

interface Internal {
  set: (field: string, value: string) => void;
  point: { set: (value: { lat: number; lng: number } | null) => void };
  errorMessage: () => string | null;
  created: () => CreatedOrganizationPractice | null;
  saving: () => boolean;
}

describe('MedicalCenterSetup', () => {
  let fixture: ComponentFixture<MedicalCenterSetup>;
  let createPractice: ReturnType<typeof vi.fn<(t: string, p: NewOrganizationPractice) => Observable<CreatedOrganizationPractice>>>;
  const activeTenant = signal<string | null>(TENANT);

  const interno = (): Internal => fixture.componentInstance as unknown as Internal;

  function completar(): void {
    interno().set('practiceName', 'Centro Médico Norte');
    interno().set('siteName', 'Sede Norte');
    interno().set('addressText', 'Av. San Martín 123');
    interno().set('cityText', 'Santa Cruz');
    interno().point.set({ lat: -17.78, lng: -63.18 });
  }

  beforeEach(async () => {
    activeTenant.set(TENANT);
    createPractice = vi.fn(() => of({ practiceId: 'pr-1', practiceSiteId: 'site-1' }));

    await TestBed.configureTestingModule({
      imports: [MedicalCenterSetup],
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: { activeTenantId: activeTenant } },
        { provide: PracticeOnboardingClient, useValue: { createPractice } },
        { provide: CARGADOR_DE_LEAFLET, useValue: () => new Promise<never>(() => undefined) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MedicalCenterSetup);
    await fixture.whenStable();
  });

  it('envía el cuerpo exacto a la organización activa', () => {
    completar();
    fixture.componentInstance.save();

    expect(createPractice).toHaveBeenCalledWith(TENANT, {
      name: 'Centro Médico Norte',
      site: {
        name: 'Sede Norte',
        addressText: 'Av. San Martín 123',
        latitude: -17.78,
        longitude: -63.18,
        cityText: 'Santa Cruz',
      },
    });
  });

  it('sin la ciudad no manda la clave', () => {
    completar();
    interno().set('cityText', '  ');
    fixture.componentInstance.save();

    const body = createPractice.mock.calls[0]![1];
    expect('cityText' in body.site).toBe(false);
  });

  it('sin punto en el mapa no envía y lo dice', () => {
    completar();
    interno().point.set(null);
    fixture.componentInstance.save();
    fixture.detectChanges();

    expect(createPractice).not.toHaveBeenCalled();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="centro-medico-setup-point-error"]')?.textContent).toContain(
      'Marque la sede en el mapa.',
    );
  });

  it('con campos vacíos no envía y muestra los errores', () => {
    fixture.componentInstance.save();
    fixture.detectChanges();

    expect(createPractice).not.toHaveBeenCalled();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Escriba el nombre del centro médico.');
    expect(texto).toContain('Escriba la dirección de la sede.');
  });

  it('sin organización activa no envía', () => {
    activeTenant.set(null);
    completar();
    fixture.componentInstance.save();

    expect(createPractice).not.toHaveBeenCalled();
    expect(interno().errorMessage()).toContain('No encontramos la organización activa');
  });

  it('al guardar muestra la práctica y la sede creadas', () => {
    completar();
    fixture.componentInstance.save();
    fixture.detectChanges();

    expect(interno().created()).toEqual({ practiceId: 'pr-1', practiceSiteId: 'site-1' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="centro-medico-setup-site-id"]')?.textContent).toContain('site-1');
  });

  it.each([
    [403, 'Solo quien administra esta organización'],
    [409, 'ya tiene un centro con ese nombre'],
    [422, 'todavía no fue verificada'],
  ])('un %s se explica en castellano y deja corregir', (status, fragmento) => {
    createPractice.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    completar();
    fixture.componentInstance.save();

    expect(interno().errorMessage()).toContain(fragmento);
    expect(interno().created()).toBeNull();
    expect(interno().saving()).toBe(false);
  });
});

describe('mensajeDeLaConfiguracion', () => {
  it('un fallo inesperado no filtra el detalle', () => {
    expect(mensajeDeLaConfiguracion(new HttpErrorResponse({ status: 500 }))).toBe(
      'No pudimos guardar el centro. Intente de nuevo en unos segundos.',
    );
  });
});
