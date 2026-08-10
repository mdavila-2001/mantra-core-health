import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { OrganizationNew } from './organization-new';

/**
 * El alta es una sola petición contra `POST /admin/tenants`: organización y
 * membresía owner nacen en la misma transacción.
 *
 * Lo que estas pruebas fijan es la regla que el backend hace cumplir y que se
 * rompe callada: el bloque de aseguradora o corredor viaja **sólo** cuando el
 * tipo lo exige, y se exige cuando corresponde.
 */
const RESPUESTA = {
  id: 't-9',
  code: 'FARMACIA-SUR',
  legalName: 'Farmacia del Sur S.R.L.',
  status: 'c-pendiente',
  verificationStatus: 'c-sin-verificar',
  createdAt: '2026-08-09T12:00:00.000Z',
};

const OWNER: ReferenceOption = { value: 'u-1', label: 'María Condori' };

describe('OrganizationNew', () => {
  let fixture: ComponentFixture<OrganizationNew>;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizationNew],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Comodín: al crear la organización la pantalla vuelve al listado, y
        // un router sin rutas convierte esa navegación en un rechazo suelto.
        provideRouter([{ path: '**', children: [] }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationNew);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  /** Igual que {@link interno}, pero sin enlazar: un signal pierde `.set` con `bind`. */
  function crudo<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, unknown>)[nombre] as T;
  }

  function completar(valores?: { code?: string; legalName?: string }) {
    interno<{ setValue: (v: unknown) => void }>('form').setValue({
      code: valores?.code ?? 'FARMACIA-SUR',
      legalName: valores?.legalName ?? 'Farmacia del Sur S.R.L.',
      tradeName: '',
      timeZone: '',
    });
    crudo<{ set: (v: unknown) => void }>('tipo').set('PHARMACY');
    crudo<{ set: (v: unknown) => void }>('owner').set(OWNER);
  }

  function enviar() {
    interno<() => void>('submit')();
  }

  it('sin tipo o sin owner no se envía nada: los dos son obligatorios', () => {
    completar();
    crudo<{ set: (v: unknown) => void }>('tipo').set(null);
    enviar();

    crudo<{ set: (v: unknown) => void }>('tipo').set('PHARMACY');
    crudo<{ set: (v: unknown) => void }>('owner').set(null);
    enviar();

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  it('una farmacia viaja sin bloques y sin opcionales vacíos', () => {
    completar();
    enviar();

    const req = http.expectOne('/admin/tenants');
    // El backend rechaza un bloque `payer` en una farmacia, y valida con
    // `forbidNonWhitelisted`: lo que no corresponde no viaja.
    expect(req.request.body).toEqual({
      code: 'FARMACIA-SUR',
      legalName: 'Farmacia del Sur S.R.L.',
      ownerUserId: 'u-1',
      tenantType: 'PHARMACY',
    });

    req.flush(RESPUESTA);
  });

  it('una aseguradora exige su bloque: sin él no se envía', () => {
    completar();
    crudo<{ set: (v: unknown) => void }>('tipo').set('PAYER');
    enviar();

    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  it('una aseguradora viaja con su bloque, y sólo con el suyo', () => {
    completar();
    crudo<{ set: (v: unknown) => void }>('tipo').set('PAYER');
    interno<{ setValue: (v: unknown) => void }>('formPayer').setValue({
      carrierCode: 'ANDINA',
      regulatorIdentifier: 'APS-123',
    });
    enviar();

    const req = http.expectOne('/admin/tenants');
    expect((req.request.body as { payer?: unknown }).payer).toEqual({
      carrierCode: 'ANDINA',
      regulatorIdentifier: 'APS-123',
    });
    expect('broker' in (req.request.body as object)).toBe(false);

    req.flush(RESPUESTA);
  });

  it('al crearla vuelve al listado', () => {
    const navegado: string[] = [];
    vi.spyOn(router, 'navigateByUrl').mockImplementation((url) => {
      navegado.push(String(url));
      return Promise.resolve(true);
    });

    completar();
    enviar();
    http.expectOne('/admin/tenants').flush(RESPUESTA);

    expect(navegado).toEqual(['/administracion/organizaciones']);
  });

  /**
   * `code` es el único campo con clave única global del formulario, así que un
   * conflicto sólo puede venir de él: «señalar el campo en conflicto, no un
   * error genérico», pide la ficha.
   */
  it('un 409 señala el código, no un error suelto', () => {
    completar();
    enviar();

    http
      .expectOne('/admin/tenants')
      .flush(
        { code: 'CONFLICT', message: 'Ya existe una organización con ese código' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(interno<() => boolean>('codigoEnConflicto')()).toBe(true);
  });

  it('la búsqueda de owner traduce usuarios a opciones con su aviso', () => {
    interno<(t: string) => void>('buscarOwner')('maria');

    http.expectOne((r) => r.url === '/iam/users').flush({
      items: [
        {
          id: 'u-1',
          displayName: 'María Condori',
          statusConceptId: 'c-activo',
          emailVerified: false,
          lastLoginAt: null,
          createdAt: '2026-08-01T10:00:00.000Z',
        },
      ],
      count: 1,
      limit: 10,
      nextCursor: null,
    });

    const opciones = interno<() => readonly ReferenceOption[]>('candidatosOwner')();
    expect(opciones).toEqual([
      { value: 'u-1', label: 'María Condori', hint: 'Correo sin verificar' },
    ]);
  });

  it('no se envía dos veces mientras la primera está en vuelo', () => {
    completar();
    enviar();
    enviar();

    // `expectOne` falla si hubo dos.
    http.expectOne('/admin/tenants').flush(RESPUESTA);
  });
});
