import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import { PracticeOnboardingClient } from '../../../core/data-access/practice-onboarding/practice-onboarding.client';
import type {
  CreatedOrganizationPractice,
  NewOrganizationPractice,
} from '../../../core/data-access/practice-onboarding/practice-onboarding.types';
import { CARGADOR_DE_LEAFLET } from '../../../shared/components/organisms/map/map';
import { RUTA_MI_ORGANIZACION, RUTA_PANEL, setupErrorMessage, MedicalCenterSetup } from './medical-center-setup';

const TENANT = 'tenant-centro';

interface Internal {
  errorMessage: () => string | null;
  created: () => CreatedOrganizationPractice | null;
  saving: () => boolean;
}

describe('MedicalCenterSetup', () => {
  let fixture: ComponentFixture<MedicalCenterSetup>;
  let createPractice: ReturnType<typeof vi.fn<(t: string, p: NewOrganizationPractice) => Observable<CreatedOrganizationPractice>>>;
  const activeTenant = signal<string | null>(TENANT);
  /** Lo que responde `GET /tenants/me`: la organización activa, verificada o no. */
  let misOrganizaciones: () => Observable<readonly { id: string; isVerified: boolean }[]>;

  const interno = (): Internal => fixture.componentInstance as unknown as Internal;

  function completar(): void {
    fixture.componentInstance.form.setValue({
      practiceName: 'Centro Médico Norte',
      siteName: 'Sede Norte',
      addressText: 'Av. San Martín 123',
      cityText: 'Santa Cruz',
      point: { lat: -17.78, lng: -63.18 },
    });
  }

  beforeEach(async () => {
    activeTenant.set(TENANT);
    createPractice = vi.fn(() => of({ practiceId: 'pr-1', practiceSiteId: 'site-1' }));
    misOrganizaciones = () => of([{ id: TENANT, isVerified: true }]);

    await TestBed.configureTestingModule({
      imports: [MedicalCenterSetup],
      providers: [
        provideRouter([]),
        {
          provide: SessionStore,
          useValue: {
            activeTenantId: activeTenant,
            roles: signal(['USER']),
            tenants: signal([TENANT]),
            activeTenantType: signal('CLINIC'),
          },
        },
        { provide: PracticeOnboardingClient, useValue: { createPractice } },
        {
          provide: DirectoryClient,
          useValue: { listMyOrganizations: () => misOrganizaciones() },
        },
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
    fixture.componentInstance.form.controls.cityText.setValue('  ');
    fixture.componentInstance.save();

    const body = createPractice.mock.calls[0]![1];
    expect('cityText' in body.site).toBe(false);
  });

  it('sin punto en el mapa no envía y marca el campo', () => {
    completar();
    fixture.componentInstance.form.controls.point.setValue(null);
    fixture.componentInstance.save();

    expect(createPractice).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.point.touched).toBe(true);
  });

  it('con campos vacíos no envía y los marca', () => {
    fixture.componentInstance.save();

    expect(createPractice).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.practiceName.touched).toBe(true);
    expect(fixture.componentInstance.form.controls.addressText.touched).toBe(true);
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
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="medical-center-setup-site-id"]')?.textContent).toContain('site-1');
  });

  it.each([
    [403, 'Solo quien administra esta organización'],
    [409, 'Su organización ya usa ese nombre'],
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

describe('MedicalCenterSetup · organización todavía no verificada (S3)', () => {
  const TENANT_NUEVO = 'tenant-nuevo';

  async function armar(
    activa: string | null,
    respuesta: () => Observable<readonly { id: string; isVerified: boolean }[]>,
    roles: readonly string[] = ['USER'],
  ): Promise<ComponentFixture<MedicalCenterSetup>> {
    await TestBed.configureTestingModule({
      imports: [MedicalCenterSetup],
      providers: [
        provideRouter([]),
        {
          provide: SessionStore,
          useValue: {
            activeTenantId: signal(activa),
            roles: signal(roles),
            tenants: signal(activa === null ? [] : [activa]),
            activeTenantType: signal('MEDICAL_OFFICE'),
          },
        },
        { provide: PracticeOnboardingClient, useValue: { createPractice: vi.fn() } },
        { provide: DirectoryClient, useValue: { listMyOrganizations: respuesta } },
        { provide: CARGADOR_DE_LEAFLET, useValue: () => new Promise<never>(() => undefined) },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(MedicalCenterSetup);
    await f.whenStable();
    return f;
  }

  it('al entrar dice que falta la verificación, con la próxima acción, y no ofrece el formulario', async () => {
    const f = await armar(TENANT_NUEVO, () => of([{ id: TENANT_NUEVO, isVerified: false }]));
    const raiz = f.nativeElement as HTMLElement;

    const vacio = raiz.querySelector('[data-testid="medical-center-setup-unverified"]');
    expect(vacio?.textContent).toContain('todavía no fue verificada');
    const accion = vacio?.querySelector('a');
    expect(accion?.getAttribute('href')).toBe(RUTA_MI_ORGANIZACION);
    expect(raiz.querySelector('[data-testid="medical-center-setup-form"]')).toBeNull();
  });

  it('a un médico que administra su consultorio no lo manda a una pantalla que lo rebota', async () => {
    // «Mi organización» tiene `hiddenFor: ['PATIENT', 'PRACTITIONER']` y su
    // guard rebota: para él, la próxima acción es el panel.
    const f = await armar(TENANT_NUEVO, () => of([{ id: TENANT_NUEVO, isVerified: false }]), [
      'PRACTITIONER',
    ]);
    const accion = (f.nativeElement as HTMLElement).querySelector(
      '[data-testid="medical-center-setup-unverified"] a',
    );
    expect(accion?.getAttribute('href')).toBe(RUTA_PANEL);
    expect(accion?.textContent).toContain('Volver al panel');
  });

  it('el aviso se lee como pendiente: lleva el reloj, no la bandeja vacía', async () => {
    const f = await armar(TENANT_NUEVO, () => of([{ id: TENANT_NUEVO, isVerified: false }]));
    const icono = (f.nativeElement as HTMLElement).querySelector(
      '[data-testid="medical-center-setup-unverified-icon"]',
    );
    // El reloj: un círculo y una aguja. La bandeja vacía es un `path` y un `polyline`.
    expect(icono?.tagName.toLowerCase()).toBe('svg');
    expect(icono?.querySelector('circle')).not.toBeNull();
    expect(icono?.querySelector('polyline')).toBeNull();
  });

  it('verificada, muestra el formulario y no el aviso', async () => {
    const f = await armar(TENANT_NUEVO, () => of([{ id: TENANT_NUEVO, isVerified: true }]));
    const raiz = f.nativeElement as HTMLElement;

    expect(raiz.querySelector('[data-testid="medical-center-setup-form"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="medical-center-setup-unverified"]')).toBeNull();
  });

  it('si la organización activa no está entre las propias, no afirma nada: deja el formulario y decide la API', async () => {
    const f = await armar(TENANT_NUEVO, () => of([{ id: 'otra', isVerified: false }]));
    const raiz = f.nativeElement as HTMLElement;

    expect(raiz.querySelector('[data-testid="medical-center-setup-form"]')).not.toBeNull();
  });

  it('si la lectura falla, muestra el error con su código y no el formulario', async () => {
    const f = await armar(TENANT_NUEVO, () =>
      throwError(() => new HttpErrorResponse({ status: 500, error: { correlationId: 'req-42' } })),
    );
    const raiz = f.nativeElement as HTMLElement;

    expect(raiz.querySelector('[data-testid="medical-center-setup-form"]')).toBeNull();
    expect(raiz.textContent).toContain('Algo salió mal');
  });
});

describe('setupErrorMessage', () => {
  it('un fallo inesperado no filtra el detalle', () => {
    expect(setupErrorMessage(new HttpErrorResponse({ status: 500 }))).toBe(
      'No pudimos guardar la configuración. Intente de nuevo en unos segundos.',
    );
  });
});
