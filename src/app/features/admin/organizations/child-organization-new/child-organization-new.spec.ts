import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ChildOrganizationNew } from './child-organization-new';

/**
 * El alta de una filial es una petición contra `POST /tenants/{id}/child-tenants`.
 *
 * Lo que fija: que el tipo **no se herede** —el contrato lo exige a propósito—
 * y que las reglas territoriales del alta raíz sigan valiendo acá.
 */
const TENANT_ID = 't-9';

const RESPUESTA = {
  id: 't-10',
  code: 'FILIAL-NORTE',
  legalName: 'Filial Norte S.R.L.',
  status: 'c-activa',
  verificationStatus: 'c-sin-verificar',
  parentTenantId: TENANT_ID,
  createdAt: '2026-08-22T12:00:00.000Z',
};

const ADMIN: ReferenceOption = { value: 'u-1', label: 'María Condori' };
const PAIS: ReferenceOption = { value: 'c-bo', label: 'Bolivia', hint: 'BO' };
const JURISDICCION: ReferenceOption = { value: 'c-jur-bo', label: 'Bolivia', hint: 'JUR_BO' };

describe('ChildOrganizationNew', () => {
  let fixture: ComponentFixture<ChildOrganizationNew>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChildOrganizationNew],
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

    fixture = TestBed.createComponent(ChildOrganizationNew);
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

  function completar(): void {
    interno<{ setValue: (v: unknown) => void }>('form').setValue({
      code: 'FILIAL-NORTE',
      legalName: 'Filial Norte S.R.L.',
    });
    crudo<{ set: (v: ReferenceOption) => void }>('administrador').set(ADMIN);
  }

  it('manda el tipo elegido, que no se hereda de la madre', () => {
    // Una red puede tener un hospital y una farmacia: suponer el tipo de la
    // madre sería adivinar, y el contrato lo exige por eso.
    completar();
    crudo<{ set: (v: string) => void }>('tipo').set('PHARMACY');
    crudo<{ set: (v: ReferenceOption) => void }>('pais').set(PAIS);
    crudo<{ set: (v: ReferenceOption) => void }>('jurisdiccion').set(JURISDICCION);
    interno<() => void>('submit')();

    const pedido = http.expectOne(`/tenants/${TENANT_ID}/child-tenants`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.headers.get('X-Tenant-Id')).toBe(TENANT_ID);
    expect(pedido.request.body).toEqual({
      code: 'FILIAL-NORTE',
      legalName: 'Filial Norte S.R.L.',
      adminUserId: 'u-1',
      tenantType: 'PHARMACY',
      countryConceptId: 'c-bo',
      jurisdictionConceptId: 'c-jur-bo',
    });

    pedido.flush(RESPUESTA);
  });

  it('un tipo territorial sin país ni jurisdicción no se envía', () => {
    // El backend responde 422 nombrando cuáles faltan; la pantalla lo evita.
    completar();
    crudo<{ set: (v: string) => void }>('tipo').set('HOSPITAL');
    interno<() => void>('submit')();

    http.expectNone(`/tenants/${TENANT_ID}/child-tenants`);
    // Y la pantalla marca qué falta, en vez de quedarse muda.
    expect(crudo<() => boolean>('paisFaltante').call(fixture.componentInstance)).toBe(true);
  });

  it('un tipo no territorial no manda país ni jurisdicción', () => {
    completar();
    crudo<{ set: (v: string) => void }>('tipo').set('PAYER');
    interno<() => void>('submit')();

    const pedido = http.expectOne(`/tenants/${TENANT_ID}/child-tenants`);
    expect(pedido.request.body).toEqual({
      code: 'FILIAL-NORTE',
      legalName: 'Filial Norte S.R.L.',
      adminUserId: 'u-1',
      tenantType: 'PAYER',
    });

    pedido.flush(RESPUESTA);
  });

  it('sin administrador elegido no llama al backend', () => {
    interno<{ setValue: (v: unknown) => void }>('form').setValue({
      code: 'FILIAL-NORTE',
      legalName: 'Filial Norte S.R.L.',
    });
    crudo<{ set: (v: string) => void }>('tipo').set('PAYER');
    interno<() => void>('submit')();

    http.expectNone(`/tenants/${TENANT_ID}/child-tenants`);
    expect(crudo<() => boolean>('adminFaltante').call(fixture.componentInstance)).toBe(true);
  });
});
