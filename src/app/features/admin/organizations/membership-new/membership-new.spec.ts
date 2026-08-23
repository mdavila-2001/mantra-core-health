import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { MembershipNew } from './membership-new';

/**
 * Sumar a alguien son una o dos peticiones, y cuál es depende del alcance.
 *
 * Lo que estas pruebas fijan: que con alcance por sede la asignación se
 * encadene —declararlo sin sucursal deja a esa persona sin nada a la vista— y
 * que si esa segunda llamada falla, la membresía ya creada **no** se presente
 * como un fracaso: existe, y hay que decir qué quedó pendiente.
 */
const TENANT_ID = 't-9';
const MEMBRESIA_ID = 'm-1';

const SEDES = {
  count: 1,
  items: [
    {
      id: 'b-1',
      code: 'CENTRO',
      name: 'Sede Centro',
      statusConceptId: 'c-activa',
      createdAt: '2026-08-22T12:00:00.000Z',
    },
  ],
};

const RESPUESTA = {
  id: MEMBRESIA_ID,
  userId: 'u-1',
  tenantRoleConceptId: 'c-staff',
  statusConceptId: 'c-activa',
  createdAt: '2026-08-22T12:00:00.000Z',
};

const PERSONA: ReferenceOption = { value: 'u-1', label: 'María Condori' };

describe('MembershipNew', () => {
  let fixture: ComponentFixture<MembershipNew>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MembershipNew],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(new Map([['tenantId', TENANT_ID]])) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MembershipNew);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // Al entrar pide las sedes: alimentan el alcance por sucursal.
    http.expectOne(`/tenants/${TENANT_ID}/branches`).flush(SEDES);
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

  function elegirPersona(): void {
    crudo<{ set: (v: ReferenceOption) => void }>('persona').set(PERSONA);
  }

  it('sin sedes, el botón de alta queda deshabilitado y no sólo inerte', () => {
    // Con alcance por sede y cero sedes, `submit()` cortaba antes de pedir nada
    // y el aviso ya estaba en pantalla: apretar el botón no producía ningún
    // cambio visible, que se lee como que la pantalla está rota.
    const otro = TestBed.createComponent(MembershipNew);
    otro.detectChanges();
    http.expectOne(`/tenants/${TENANT_ID}/branches`).flush({ count: 0, items: [] });
    otro.detectChanges();

    const instancia = otro.componentInstance as unknown as Record<string, unknown>;
    (instancia['alcance'] as { set: (v: string) => void }).set('BRANCH');
    otro.detectChanges();

    expect((instancia['sinSedes'] as () => boolean).call(instancia)).toBe(true);
    const boton = (otro.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(boton?.getAttribute('aria-disabled')).toBe('true');
  });

  it('con alcance sobre toda la organización manda una sola petición', () => {
    elegirPersona();
    interno<() => void>('submit')();

    const pedido = http.expectOne(`/tenants/${TENANT_ID}/memberships`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.headers.get('X-Tenant-Id')).toBe(TENANT_ID);
    expect(pedido.request.body).toEqual({
      userId: 'u-1',
      role: 'STAFF',
      accessScope: 'ALL_TENANT',
    });

    pedido.flush(RESPUESTA);
    // Sin alcance por sede no hay segunda llamada: `http.verify()` lo comprueba.
  });

  it('con alcance por sede encadena la asignación', () => {
    // Son dos operaciones del contrato pero una sola decisión de quien las usa:
    // declarar «sólo una sede» sin asignarla deja a esa persona sin nada.
    elegirPersona();
    crudo<{ set: (v: string) => void }>('alcance').set('BRANCH');
    crudo<{ set: (v: string) => void }>('sede').set('b-1');
    interno<() => void>('submit')();

    const alta = http.expectOne(`/tenants/${TENANT_ID}/memberships`);
    expect(alta.request.body).toMatchObject({ accessScope: 'BRANCH', primaryBranchId: 'b-1' });
    alta.flush(RESPUESTA);

    const asignacion = http.expectOne(
      `/tenants/${TENANT_ID}/memberships/${MEMBRESIA_ID}/branch-assignments`,
    );
    expect(asignacion.request.body).toEqual({ branchId: 'b-1' });
    asignacion.flush({
      id: 'a-1',
      branchId: 'b-1',
      statusConceptId: 'c-activa',
      createdAt: '2026-08-22T12:00:00.000Z',
    });
  });

  it('si la asignación falla, la membresía sigue creada y se avisa qué falta', () => {
    // Deshacerla sería peor: la persona quedaría fuera sin que nadie lo pidiera.
    elegirPersona();
    crudo<{ set: (v: string) => void }>('alcance').set('BRANCH');
    crudo<{ set: (v: string) => void }>('sede').set('b-1');
    interno<() => void>('submit')();

    http.expectOne(`/tenants/${TENANT_ID}/memberships`).flush(RESPUESTA);
    http
      .expectOne(`/tenants/${TENANT_ID}/memberships/${MEMBRESIA_ID}/branch-assignments`)
      .flush({ message: 'No se pudo' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    // La pantalla no queda en error: el alta salió bien y lo pendiente es otra cosa.
    expect(crudo<() => { status: string }>('state').call(fixture.componentInstance).status).toBe(
      'ready',
    );
  });

  it('sin persona elegida no llama al backend', () => {
    interno<() => void>('submit')();
    http.expectNone(`/tenants/${TENANT_ID}/memberships`);
  });

  it('con alcance por sede y sin sede elegida tampoco llama', () => {
    elegirPersona();
    crudo<{ set: (v: string) => void }>('alcance').set('BRANCH');
    interno<() => void>('submit')();

    http.expectNone(`/tenants/${TENANT_ID}/memberships`);
  });

  it('la búsqueda de personas marca las cuentas sin verificar', () => {
    interno<(t: string) => void>('buscarPersona')('maria');

    http.expectOne((r) => r.url === '/iam/users').flush({
      items: [
        { id: 'u-1', displayName: 'María Condori', emailVerified: true },
        { id: 'u-2', displayName: 'Juan Pérez', emailVerified: false },
      ],
      count: 2,
      limit: 10,
      nextCursor: null,
    });

    const candidatos = crudo<() => readonly ReferenceOption[]>('candidatos').call(
      fixture.componentInstance,
    );
    expect(candidatos[0].hint).toBeUndefined();
    expect(candidatos[1].hint).toBe('Correo sin verificar');
  });
});
