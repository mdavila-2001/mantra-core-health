import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TenantBindingForm } from './tenant-binding-form';

const PROVEEDOR = '17171717-1717-1717-1717-171717171717';
const ORGANIZACION = '18181818-1818-1818-1818-181818181818';
const ROL = '19191919-1919-1919-1919-191919191919';

const VINCULADO = {
  id: 'b-1',
  providerId: PROVEEDOR,
  tenantId: ORGANIZACION,
  isEnabled: true,
  updated: false,
};

describe('TenantBindingForm', () => {
  let fixture: ComponentFixture<TenantBindingForm>;
  let component: TenantBindingForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantBindingForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantBindingForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') return valor as T;
    const esSenal = 'set' in valor || 'update' in valor || 'asReadonly' in valor;
    return (esSenal ? valor : valor.bind(component)) as T;
  }

  function formulario(): { patchValue: (v: object) => void } {
    return interno<{ patchValue: (v: object) => void }>('form');
  }

  it('sin los dos identificadores no viaja nada', () => {
    formulario().patchValue({ providerId: PROVEEDOR });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });

  it('el cuerpo mínimo lleva los tres interruptores explícitos, con sus defaults', () => {
    formulario().patchValue({ providerId: PROVEEDOR, tenantId: ORGANIZACION });

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/tenant-bindings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      providerId: PROVEEDOR,
      tenantId: ORGANIZACION,
      isEnabled: true,
      autoProvision: false,
      justInTimeProvisioning: false,
    });

    req.flush(VINCULADO);
    expect(interno<() => { id: string } | null>('bound')()?.id).toBe('b-1');
  });

  it('apagar el vínculo y prender el aprovisionamiento viajan como decisión explícita', () => {
    formulario().patchValue({
      providerId: PROVEEDOR,
      tenantId: ORGANIZACION,
      isEnabled: false,
      autoProvision: true,
      justInTimeProvisioning: true,
      defaultRoleConceptId: ROL,
      allowedEmailDomains: 'clinica.example, hospital.example',
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/tenant-bindings');
    expect(req.request.body).toEqual({
      providerId: PROVEEDOR,
      tenantId: ORGANIZACION,
      isEnabled: false,
      autoProvision: true,
      justInTimeProvisioning: true,
      defaultRoleConceptId: ROL,
      allowedEmailDomains: 'clinica.example, hospital.example',
    });

    req.flush({ ...VINCULADO, isEnabled: false, updated: true });
    expect(interno<() => { updated: boolean } | null>('bound')()?.updated).toBe(true);
  });
});
