import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BranchNew } from './branch-new';

/**
 * El alta de sucursal es una sola petición contra `POST /tenants/{id}/branches`.
 *
 * Lo que estas pruebas fijan es lo que se rompe callado: que la petición lleve
 * la cabecera de organización, que los opcionales vacíos no viajen —el backend
 * valida con `forbidNonWhitelisted` y un `undefined` declarado es un 400— y la
 * regla propia de la pantalla: media coordenada no ubica nada.
 */
const TENANT_ID = 't-9';

const RESPUESTA = {
  id: 'b-1',
  code: 'CENTRO',
  name: 'Sede Centro',
  statusConceptId: 'c-activa',
  createdAt: '2026-08-22T12:00:00.000Z',
};

describe('BranchNew', () => {
  let fixture: ComponentFixture<BranchNew>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BranchNew],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Comodín: al crear la sede la pantalla vuelve a la ficha, y un router
        // sin rutas convierte esa navegación en un rechazo suelto.
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(new Map([['tenantId', TENANT_ID]])) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BranchNew);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function crudo<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, unknown>)[nombre] as T;
  }

  function completar(valores?: Partial<Record<string, unknown>>): void {
    interno<{ setValue: (v: unknown) => void }>('form').setValue({
      code: 'CENTRO',
      name: 'Sede Centro',
      timeZone: '',
      latitude: null,
      longitude: null,
      ...valores,
    });
  }

  it('manda sólo lo cargado y con la cabecera de la organización', () => {
    completar();
    interno<() => void>('submit')();

    const pedido = http.expectOne(`/tenants/${TENANT_ID}/branches`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.headers.get('X-Tenant-Id')).toBe(TENANT_ID);
    // Los opcionales vacíos no viajan: el backend valida con
    // `forbidNonWhitelisted` y una clave declarada en `undefined` es un 400.
    expect(pedido.request.body).toEqual({ code: 'CENTRO', name: 'Sede Centro' });

    pedido.flush(RESPUESTA);
  });

  it('el tipo viaja como código, no como concept id', () => {
    completar();
    crudo<{ set: (v: string) => void }>('tipo').set('CLINIC');
    interno<() => void>('submit')();

    const pedido = http.expectOne(`/tenants/${TENANT_ID}/branches`);
    expect(pedido.request.body).toMatchObject({ branchType: 'CLINIC' });

    pedido.flush(RESPUESTA);
  });

  it('con una sola coordenada no envía nada y lo dice', () => {
    // Media coordenada no ubica una sede: es una línea alrededor del planeta.
    // El backend acepta cada una por separado, así que la regla es de la vista.
    completar({ latitude: -17.78 });

    expect(crudo<() => boolean>('coordenadaIncompleta').call(fixture.componentInstance)).toBe(true);

    interno<() => void>('submit')();
    http.expectNone(`/tenants/${TENANT_ID}/branches`);
  });

  it('con el par completo las coordenadas viajan juntas', () => {
    completar({ latitude: -17.78, longitude: -63.18 });
    interno<() => void>('submit')();

    const pedido = http.expectOne(`/tenants/${TENANT_ID}/branches`);
    expect(pedido.request.body).toMatchObject({ latitude: -17.78, longitude: -63.18 });

    pedido.flush(RESPUESTA);
  });

  it('sin los obligatorios no llama al backend', () => {
    completar({ code: '', name: '' });
    interno<() => void>('submit')();

    http.expectNone(`/tenants/${TENANT_ID}/branches`);
  });

  it('un código repetido se muestra sobre el campo del código', () => {
    // Es el único campo con clave única dentro de la organización, así que un
    // 409 sólo puede venir de él.
    completar();
    interno<() => void>('submit')();

    http
      .expectOne(`/tenants/${TENANT_ID}/branches`)
      .flush(
        { code: 'CONFLICT', message: 'Ya existe una sede con ese código' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(crudo<() => boolean>('codigoEnConflicto').call(fixture.componentInstance)).toBe(true);
  });
});
