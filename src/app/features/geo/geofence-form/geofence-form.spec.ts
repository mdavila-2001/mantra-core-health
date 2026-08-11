import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { GeofenceForm } from './geofence-form';

const TENANT = 't-1';

/** JWT de mentira: la firma no se verifica en el cliente, así que da igual. */
function tokenConTenant(): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode({
    sub: 'u-1',
    typ: 'access',
    roles: ['SECURITY_ADMIN'],
    tenants: [TENANT],
  })}.x`;
}

describe('GeofenceForm', () => {
  let fixture: ComponentFixture<GeofenceForm>;
  let component: GeofenceForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeofenceForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    // El tenant activo sale de la sesión; con una sola membresía es implícito.
    TestBed.inject(SessionStore).start({ accessToken: tokenConTenant(), refreshToken: 'r' });

    fixture = TestBed.createComponent(GeofenceForm);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') return valor as T;
    const esSenal = 'set' in valor || 'update' in valor || 'asReadonly' in valor;
    return (esSenal ? valor : valor.bind(component)) as T;
  }

  it('un círculo sin radio no sale a la red: la coherencia se valida acá', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      name: 'Depósito central',
      centerLat: '-34.6',
      centerLng: '-58.38',
    });
    interno<{ set: (v: string) => void }>('shapeType').set('CIRCLE');

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('el círculo viaja con números y con el tenant activo de la sesión', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      name: 'Depósito central',
      radiusM: '500',
      centerLat: '-34.6',
      centerLng: '-58.38',
    });
    interno<{ set: (v: string) => void }>('shapeType').set('CIRCLE');

    interno<() => void>('submit')();

    const req = http.expectOne('/geo/geofences');
    // `tenantId` es de propiedad: viaja igual al `X-Tenant-Id` o el backend
    // responde 403. Por eso sale de la sesión y no de un campo.
    expect(req.request.body).toEqual({
      tenantId: TENANT,
      name: 'Depósito central',
      shapeType: 'CIRCLE',
      radiusM: 500,
      centerLat: -34.6,
      centerLng: -58.38,
    });
    req.flush({
      id: 'g-1',
      tenantId: TENANT,
      name: 'Depósito central',
      shapeType: 'c-circle',
      state: 'c-active',
      createdAt: '2026-08-11T00:00:00.000Z',
    });
  });

  it('el polígono exige su geometría y NO manda los campos del círculo', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      name: 'Zona norte',
      // Los campos del círculo quedaron escritos de un intento anterior.
      radiusM: '500',
      centerLat: '-34.6',
      centerLng: '-58.38',
    });
    interno<{ set: (v: string) => void }>('shapeType').set('POLYGON');
    interno<{ set: (v: string) => void }>('geometryJson').set(
      '{"type": "Polygon", "coordinates": []}',
    );

    interno<() => void>('submit')();

    const req = http.expectOne('/geo/geofences');
    expect(req.request.body).toEqual({
      tenantId: TENANT,
      name: 'Zona norte',
      shapeType: 'POLYGON',
      geometryJson: { type: 'Polygon', coordinates: [] },
    });
    req.flush({
      id: 'g-2',
      tenantId: TENANT,
      name: 'Zona norte',
      shapeType: 'c-polygon',
      state: 'c-active',
      createdAt: '2026-08-11T00:00:00.000Z',
    });
  });

  it('un polígono sin geometría no sale a la red', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ name: 'Zona sur' });
    interno<{ set: (v: string) => void }>('shapeType').set('POLYGON');

    interno<() => void>('submit')();

    const estado = interno<() => ViewState<null>>('state')();
    expect(estado.status).toBe('ready');
  });

  it('el selector acepta el valor del contrato y rechaza lo desconocido', () => {
    interno<(v: unknown) => void>('elegirForma')('CIRCLE');
    expect(interno<() => string | null>('shapeType')()).toBe('CIRCLE');

    interno<(v: unknown) => void>('elegirForma')('CUALQUIER_COSA');
    // Un valor fuera del contrato no pisa nada.
    expect(interno<() => string | null>('shapeType')()).toBeNull();
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraGeocerca')();
    expect(interno<() => unknown>('created')()).toBeNull();
  });
});
