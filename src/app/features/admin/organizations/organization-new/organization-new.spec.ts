import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { OrganizationNew } from './organization-new';
import { environment } from '../../../../../environments/environment';

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


// Estas pruebas ejercitan funciones que hoy sólo existen en la maqueta (informe B):
// contra la API real sus claves no viajan, y eso lo cubren simulator-only.spec y
// contract-drift.spec. En esta rama la maqueta viene apagada: se enciende acá.
const mockBackendOriginal = environment.mockBackend;
beforeAll(() => Object.assign(environment, { mockBackend: true }));
afterAll(() => Object.assign(environment, { mockBackend: mockBackendOriginal }));

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
    // Owner, país y jurisdicción se eligen en buscadores, pero viven en el
    // grupo: es lo que deja al motor validarlos página por página.
    // Una farmacia es territorial: sin país y jurisdicción el backend la
    // rechaza con 422, así que el formulario los exige.
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      owner: OWNER,
      pais: PAIS,
      jurisdiccion: JURISDICCION,
    });
  }

  /** Un control del grupo, por nombre. */
  function control(nombre: string): { valid: boolean; enabled: boolean; errors: object | null } {
    return interno<{ get: (n: string) => { valid: boolean; enabled: boolean; errors: object | null } }>(
      'form',
    ).get(nombre);
  }

  function enviar() {
    interno<() => void>('submit')();
  }

  /** Pulsa «Siguiente» hasta la página con ese título (o hasta que no avance). */
  function irALaPagina(titulo: string): void {
    const raiz = fixture.nativeElement as HTMLElement;
    for (let intento = 0; intento < 6; intento += 1) {
      fixture.detectChanges();
      if (raiz.querySelector('.paginated-form__titulo')?.textContent?.trim() === titulo) return;
      raiz.querySelector<HTMLButtonElement>('[data-testid="paginated-form-continuar"]')?.click();
    }
    fixture.detectChanges();
  }

  it('sin tipo o sin owner no se envía nada: los dos son obligatorios', () => {
    completar();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ tipo: null });
    enviar();

    interno<{ patchValue: (v: object) => void }>('form').patchValue({ tipo: 'PHARMACY' });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ owner: null });
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
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ pais: null });
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
    crudo<{ buscar: (t: string) => void }>('owners').buscar('maria');

    http.expectOne((r) => r.url === '/iam/users/search').flush({
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

    const opciones = crudo<{ candidatos: () => readonly ReferenceOption[] }>('owners').candidatos();
    expect(opciones).toEqual([
      { value: 'u-1', label: 'María Condori', hint: 'Correo sin verificar' },
    ]);
  });

  it('un fallo de la búsqueda de owner se dice en la pantalla, no como «ningún usuario coincide»', () => {
    crudo<{ buscar: (t: string) => void }>('owners').buscar('maria');
    http
      .expectOne((r) => r.url === '/iam/users/search')
      .flush(
        { code: 'INTERNAL', message: 'boom', correlationId: 'req-77' },
        { status: 500, statusText: 'Server Error' },
      );
    fixture.detectChanges();

    const buscador = crudo<{ candidatos: () => readonly ReferenceOption[]; error: () => string | null }>(
      'owners',
    );
    expect(buscador.candidatos()).toEqual([]);
    expect(buscador.error()).toContain('No pudimos buscar personas');
    expect(buscador.error()).toContain('req-77');
  });

  it('no se envía dos veces mientras la primera está en vuelo', () => {
    completar();
    enviar();
    enviar();

    // `expectOne` falla si hubo dos.
    http.expectOne('/admin/tenants').flush(RESPUESTA);
  });
  /**
   * `CLINIC` (Clínica) llegó con la API que lo agrega a `CreateTenantDto` y lo
   * declara territorial: se ofrece después de «Hospital», como en el alta
   * pública, y viaja con país y jurisdicción.
   */
  it('ofrece «Clínica» después de «Hospital» en el selector de tipo', () => {
    const opciones = crudo<readonly { value: string; label: string }[]>('opcionesDeTipo');
    const valores = opciones.map((o) => o.value);

    expect(opciones).toContainEqual({ value: 'CLINIC', label: 'Clínica' });
    expect(valores.indexOf('CLINIC')).toBe(valores.indexOf('HOSPITAL') + 1);
  });

  it('una clínica viaja con tenantType CLINIC, país y jurisdicción', () => {
    completar({ code: 'CLINICA-NORTE', legalName: 'Clínica Norte S.R.L.' });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ tipo: 'CLINIC' });
    enviar();

    const req = http.expectOne('/admin/tenants');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      code: 'CLINICA-NORTE',
      legalName: 'Clínica Norte S.R.L.',
      ownerUserId: 'u-1',
      tenantType: 'CLINIC',
      countryConceptId: 'c-pe',
      jurisdictionConceptId: 'c-jur-bo',
    });

    req.flush({ ...RESPUESTA, code: 'CLINICA-NORTE', legalName: 'Clínica Norte S.R.L.' });
  });

  it('una clínica sin jurisdicción no se envía y el campo dice qué falta', () => {
    completar();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      tipo: 'CLINIC',
      jurisdiccion: null,
    });
    enviar();

    // `http.verify()` del afterEach: nada salió a la red.
    expect(interno<() => { status: string }>('state')().status).toBe('ready');
    expect(interno<() => boolean>('jurisdiccionFaltante')()).toBe(true);
    // El control vive en el grupo y está encendido para un tipo territorial:
    // es lo que hace que el motor bloquee «Siguiente» en «Dónde opera».
    expect(control('jurisdiccion').enabled).toBe(true);
    expect(control('jurisdiccion').errors).toEqual({ required: true });

    const wherePage = interno<() => readonly { titulo: string; campos: readonly { key: string; mensajeDeError?: string }[] }[]>(
      'paginas',
    )().find((p) => p.titulo === 'Dónde opera');
    expect(wherePage?.campos.find((c) => c.key === 'jurisdiccion')?.mensajeDeError).toBe(
      'Elija la jurisdicción: sin ella este tipo de organización no se puede registrar.',
    );
  });

  it('una clínica sin jurisdicción: «Siguiente» no pasa de «Dónde opera» y el mensaje se ve', () => {
    completar();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      tipo: 'CLINIC',
      jurisdiccion: null,
    });
    irALaPagina('Dónde opera');
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="paginated-form-continuar"]')!
      .click();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.paginated-form__titulo')?.textContent?.trim()).toBe('Dónde opera');
    expect(raiz.textContent).toContain(
      'Elija la jurisdicción: sin ella este tipo de organización no se puede registrar.',
    );
  });

  it('un tipo no territorial apaga país y jurisdicción: no lo bloquean ni viajan', () => {
    completar();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      tipo: 'BROKER',
      pais: null,
      jurisdiccion: null,
      brokerCode: 'CORR-1',
      licenseNumber: 'LIC-9',
    });

    expect(control('pais').enabled).toBe(false);
    expect(control('jurisdiccion').enabled).toBe(false);

    enviar();
    const req = http.expectOne('/admin/tenants');
    expect(req.request.body).toEqual({
      code: 'FARMACIA-SUR',
      legalName: 'Farmacia del Sur S.R.L.',
      ownerUserId: 'u-1',
      tenantType: 'BROKER',
      broker: { brokerCode: 'CORR-1', licenseNumber: 'LIC-9' },
    });
    req.flush(RESPUESTA);
  });
});
