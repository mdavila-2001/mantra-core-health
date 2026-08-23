import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { OrganizationVerify } from './organization-verify';

/**
 * Verificar es una sola petición contra `POST /admin/tenants/{id}/verification`.
 *
 * Lo que estas pruebas fijan: que va por la superficie de plataforma —sin la
 * cabecera de organización, porque quien verifica no pertenece a lo que
 * verifica— y que los dos campos son de veras opcionales: sin corregir nada, el
 * cuerpo va vacío y lo declarado en el alta queda como estaba.
 */
const TENANT_ID = 't-9';

const RESPUESTA = {
  id: TENANT_ID,
  code: 'FARMACIA-SUR',
  legalName: 'Farmacia del Sur S.R.L.',
  status: 'c-activa',
  verificationStatus: 'c-verificada',
  createdAt: '2026-08-22T12:00:00.000Z',
};

const PAIS: ReferenceOption = { value: 'c-bo', label: 'Bolivia', hint: 'BO' };
const JURISDICCION: ReferenceOption = { value: 'c-jur-bo', label: 'Bolivia', hint: 'JUR_BO' };

describe('OrganizationVerify', () => {
  let fixture: ComponentFixture<OrganizationVerify>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizationVerify],
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

    fixture = TestBed.createComponent(OrganizationVerify);
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

  it('sin correcciones manda el cuerpo vacío por la superficie de plataforma', () => {
    interno<() => void>('submit')();

    const pedido = http.expectOne(`/admin/tenants/${TENANT_ID}/verification`);
    expect(pedido.request.method).toBe('POST');
    // Sin cabecera de organización: verificar no exige pertenecer.
    expect(pedido.request.headers.get('X-Tenant-Id')).toBeNull();
    expect(pedido.request.body).toEqual({});

    pedido.flush(RESPUESTA);
  });

  it('sólo viaja lo que se corrigió', () => {
    crudo<{ set: (v: ReferenceOption) => void }>('pais').set(PAIS);
    interno<() => void>('submit')();

    const pedido = http.expectOne(`/admin/tenants/${TENANT_ID}/verification`);
    // La jurisdicción no se tocó: omitirla deja la del alta, que es distinto de
    // mandarla vacía.
    expect(pedido.request.body).toEqual({ countryConceptId: 'c-bo' });

    pedido.flush(RESPUESTA);
  });

  it('con los dos corregidos viajan los dos', () => {
    crudo<{ set: (v: ReferenceOption) => void }>('pais').set(PAIS);
    crudo<{ set: (v: ReferenceOption) => void }>('jurisdiccion').set(JURISDICCION);
    interno<() => void>('submit')();

    const pedido = http.expectOne(`/admin/tenants/${TENANT_ID}/verification`);
    expect(pedido.request.body).toEqual({
      countryConceptId: 'c-bo',
      jurisdictionConceptId: 'c-jur-bo',
    });

    pedido.flush(RESPUESTA);
  });

  it('un 403 muestra lo que dijo el servidor', () => {
    interno<() => void>('submit')();

    http
      .expectOne(`/admin/tenants/${TENANT_ID}/verification`)
      .flush(
        { code: 'FORBIDDEN', message: 'Rol insuficiente para la operación' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    expect(crudo<() => string | null>('errorMessage').call(fixture.componentInstance)).toBe(
      'Rol insuficiente para la operación',
    );
  });

  it('un 403 sin mensaje cae en la explicación de la pantalla', () => {
    // El servidor manda el motivo cuando lo tiene; cuando no, un «prohibido» a
    // secas no le dice a nadie qué le falta.
    interno<() => void>('submit')();

    http
      .expectOne(`/admin/tenants/${TENANT_ID}/verification`)
      .flush({ code: 'FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(crudo<() => string | null>('errorMessage').call(fixture.componentInstance)).toContain(
      'seguridad',
    );
  });

  it('la búsqueda de conceptos usa el código como pista', () => {
    // La búsqueda es sobre el catálogo entero —estas dos columnas no tienen
    // binding en dynamic-enums—, así que «Bolivia» también trae la moneda: el
    // código es lo que permite elegir el correcto.
    interno<(t: string) => void>('buscarJurisdiccion')('bolivia');

    http.expectOne((r) => r.url === '/terminology/concepts').flush({
      items: [{ conceptId: 'c-jur-bo', code: 'JUR_BO', display: 'Bolivia' }],
      count: 1,
      limit: 10,
      nextCursor: null,
    });

    const candidatos = crudo<() => readonly ReferenceOption[]>('candidatosJurisdiccion').call(
      fixture.componentInstance,
    );
    expect(candidatos[0]).toEqual({ value: 'c-jur-bo', label: 'Bolivia', hint: 'JUR_BO' });
  });
});
