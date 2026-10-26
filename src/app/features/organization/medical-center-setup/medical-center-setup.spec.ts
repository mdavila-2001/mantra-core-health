import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import { ReverseGeocodingClient } from '../../../core/data-access/geo/reverse-geocoding.client';
import { BoMunicipalitiesCatalog } from '../../../core/data-access/terminology/bo-municipalities.service';
import { PracticeOnboardingClient } from '../../../core/data-access/practice-onboarding/practice-onboarding.client';
import type {
  CreatedOrganizationPractice,
  NewOrganizationPractice,
} from '../../../core/data-access/practice-onboarding/practice-onboarding.types';
import { CARGADOR_DE_LEAFLET } from '../../../shared/components/organisms/map/map';
import {
  MapLocationPicker,
  type LocalityFromPoint,
} from '../../auth/shared-registration/map-location-picker/map-location-picker';
import { RUTA_MI_ORGANIZACION, RUTA_PANEL, setupErrorMessage, MedicalCenterSetup } from './medical-center-setup';

/** Un recorte del catálogo de municipios: alcanza para nombrar la ciudad del punto. */
const MUNICIPIOS = [
  {
    conceptId: 'dep-scz',
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [{ conceptId: 'mun-scz', nombre: 'Santa Cruz de la Sierra', ine: '070101' }],
  },
];

/**
 * El selector de ubicación pide la calle y el catálogo de municipios: la calle
 * no responde (lo deducido se emite a mano por `localidad`) y el catálogo trae
 * el recorte de arriba.
 */
const PROVEEDORES_DE_UBICACION = [
  { provide: ReverseGeocodingClient, useValue: { streetAt: () => NEVER } },
  { provide: BoMunicipalitiesCatalog, useValue: { listar: () => of(MUNICIPIOS) } },
];

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
        ...PROVEEDORES_DE_UBICACION,
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

  describe('la sede: sólo el punto, todo lo demás sale de él (26/10/2026)', () => {
    const PUNTO = { lat: -17.7833, lng: -63.1821 };

    function localidad(
      calle: string | null,
      zona: string | null = null,
      municipioConceptId: string | null = null,
    ): LocalityFromPoint {
      return { punto: PUNTO, calle, calleSola: calle, zona, municipioConceptId };
    }

    /** Completa la primera página y pasa a «La sede», donde está el mapa. */
    function irALaSede(): MapLocationPicker {
      const form = fixture.componentInstance.form;
      form.controls.practiceName.setValue('Centro Médico Norte');
      form.controls.siteName.setValue('Sede Norte');
      fixture.detectChanges();
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('[data-testid="paginated-form-continuar"]')!
        .click();
      fixture.detectChanges();
      return fixture.debugElement.query(By.directive(MapLocationPicker))
        .componentInstance as MapLocationPicker;
    }

    it('el mapa es el primer y único campo de la página, obligatorio; dirección y ciudad no se escriben', () => {
      const sede = fixture.componentInstance['pages'].find((p) => p.titulo === 'La sede')!;
      expect(sede.campos.map((c) => c.key)).toEqual(['point']);
      expect(sede.campos[0]).toMatchObject({
        control: 'custom',
        required: true,
        mensajeDeError: 'Marque el lugar en el mapa y pulse «Confirmar dirección actual».',
      });

      irALaSede();
      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('[data-testid="medical-center-setup-address"]')).toBeNull();
      expect(raiz.querySelector('[data-testid="medical-center-setup-city"]')).toBeNull();
      expect(raiz.querySelector('[data-testid="medical-center-site-map"]')).not.toBeNull();
    });

    it('lo deducido del punto llena la dirección y la ciudad, y con el punto confirmado se envía', () => {
      const selector = irALaSede();

      selector.localidad.emit(localidad('Calle Guapay 3861, Equipetrol', 'Equipetrol', 'mun-scz'));
      selector.confirmado.emit(PUNTO);
      fixture.componentInstance.save();

      expect(createPractice).toHaveBeenCalledWith(TENANT, {
        name: 'Centro Médico Norte',
        site: {
          name: 'Sede Norte',
          addressText: 'Calle Guapay 3861, Equipetrol',
          latitude: -17.7833,
          longitude: -63.1821,
          cityText: 'Santa Cruz de la Sierra',
        },
      });
    });

    it('sin calle, la dirección dice la zona y el municipio, o el punto: nunca una calle inventada', () => {
      const selector = irALaSede();
      const form = fixture.componentInstance.form;

      selector.localidad.emit(localidad(null, 'Equipetrol', 'mun-scz'));
      expect(form.controls.addressText.value).toBe('Equipetrol, Santa Cruz de la Sierra');

      selector.localidad.emit(localidad(null));
      expect(form.controls.addressText.value).toBe('Punto GPS -17.78330, -63.18210');
      expect(form.controls.cityText.value).toBe('');
    });

    it('un punto confirmado nunca deja la dirección obligatoria vacía y escondida', () => {
      const selector = irALaSede();

      selector.confirmado.emit(PUNTO);

      expect(fixture.componentInstance.form.controls.addressText.value).toBe('Punto GPS -17.78330, -63.18210');
      expect(fixture.componentInstance.form.valid).toBe(true);
    });
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
        ...PROVEEDORES_DE_UBICACION,
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
      '[data-testid="medical-center-setup-unverified"] app-nav-icon[empty-icon]',
    );
    expect(icono?.getAttribute('name')).toBe('clock');
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
