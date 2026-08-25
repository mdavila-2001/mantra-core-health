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
const PAIS: ReferenceOption = { value: 'c-pe', label: 'Peru', hint: 'PE' };
const JURISDICCION: ReferenceOption = { value: 'c-jur-bo', label: 'Bolivia', hint: 'JUR_BO' };

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
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      code: valores?.code ?? 'FARMACIA-SUR',
      legalName: valores?.legalName ?? 'Farmacia del Sur S.R.L.',
      tradeName: '',
      timeZone: '',
    });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ tipo: 'PHARMACY' });
    crudo<{ set: (v: unknown) => void }>('owner').set(OWNER);
    // Una farmacia es territorial: sin país y jurisdicción el backend la
    // rechaza con 422, así que el formulario los exige.
    crudo<{ set: (v: unknown) => void }>('pais').set(PAIS);
    crudo<{ set: (v: unknown) => void }>('jurisdiccion').set(JURISDICCION);
  }

  function enviar() {
    interno<() => void>('submit')();
  }

  it('sin tipo o sin owner no se envía nada: los dos son obligatorios', () => {
    completar();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ tipo: null });
    enviar();

    interno<{ patchValue: (v: object) => void }>('form').patchValue({ tipo: 'PHARMACY' });
    crudo<{ set: (v: unknown) => void }>('owner').set(null);
    enviar();

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  it('una farmacia viaja con país y jurisdicción, sin bloques y sin vacíos', () => {
    completar();
    enviar();

    const req = http.expectOne('/admin/tenants');
    // El backend rechaza un bloque `payer` en una farmacia, y valida con
    // `forbidNonWhitelisted`: lo que no corresponde no viaja. País y
    // jurisdicción sí: sin ellos el tipo territorial vuelve con 422.
    expect(req.request.body).toEqual({
      code: 'FARMACIA-SUR',
      legalName: 'Farmacia del Sur S.R.L.',
      ownerUserId: 'u-1',
      tenantType: 'PHARMACY',
      countryConceptId: 'c-pe',
      jurisdictionConceptId: 'c-jur-bo',
    });

    req.flush(RESPUESTA);
  });

  it('un tipo territorial sin país no se envía', () => {
    completar();
    crudo<{ set: (v: unknown) => void }>('pais').set(null);
    enviar();

    expect(interno<() => { status: string }>('state')().status).toBe('ready');
    expect(interno<() => boolean>('paisFaltante')()).toBe(true);
  });

  it('una aseguradora exige su bloque: sin él no se envía', () => {
    completar();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ tipo: 'PAYER' });
    enviar();

    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  it('una aseguradora viaja con su bloque, y sólo con el suyo', () => {
    completar();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ tipo: 'PAYER' });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      carrierCode: 'ANDINA',
      regulatorIdentifier: 'APS-123',
      sigla: 'AND',
      address: 'Av. Siempre Viva 123',
    });
    enviar();

    const req = http.expectOne('/admin/tenants');
    expect((req.request.body as { payer?: unknown }).payer).toEqual({
      carrierCode: 'ANDINA',
      regulatorIdentifier: 'APS-123',
      sigla: 'AND',
      address: 'Av. Siempre Viva 123',
    });
    expect('broker' in (req.request.body as object)).toBe(false);
    // No es territorial: aunque haya país elegido de un tipo anterior, no
    // viaja — su regulador va dentro del bloque.
    expect('countryConceptId' in (req.request.body as object)).toBe(false);

    req.flush(RESPUESTA);
  });

  /**
   * `sigla` y `address` son tan obligatorios como `carrierCode` y
   * `regulatorIdentifier`: el backend los exige a los cuatro cuando el tipo
   * es `PAYER`.
   */
  it('una aseguradora sin sigla o sin dirección tampoco se envía', () => {
    completar();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ tipo: 'PAYER' });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      carrierCode: 'ANDINA',
      regulatorIdentifier: 'APS-123',
      sigla: '',
      address: '',
    });
    enviar();

    expect(interno<() => { status: string }>('state')().status).toBe('ready');
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

    expect(navegado).toEqual(['/administration/organizations']);
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
