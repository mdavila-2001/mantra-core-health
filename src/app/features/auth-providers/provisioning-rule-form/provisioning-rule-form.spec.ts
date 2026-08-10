import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProvisioningRuleForm } from './provisioning-rule-form';

const PROVEEDOR = '14141414-1414-1414-1414-141414141414';
const ROL = '15151515-1515-1515-1515-151515151515';
const ORGANIZACION = '16161616-1616-1616-1616-161616161616';

const CREADA = {
  id: 'r-1',
  priority: 1,
  effectConceptId: 'efecto-uuid',
  isActive: true,
};

describe('ProvisioningRuleForm', () => {
  let fixture: ComponentFixture<ProvisioningRuleForm>;
  let component: ProvisioningRuleForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProvisioningRuleForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProvisioningRuleForm);
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

  it('sin efecto elegido no viaja nada: es una decisión que nadie toma por el usuario', () => {
    formulario().patchValue({ providerId: PROVEEDOR, priority: 1 });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });

  it('el cuerpo mínimo lleva prioridad y efecto, nada más', () => {
    formulario().patchValue({ providerId: PROVEEDOR, priority: 10 });
    interno<(v: unknown) => void>('elegirEfecto')('DENY');

    interno<() => void>('submit')();

    const req = http.expectOne(
      `/auth-providers/identity-providers/${PROVEEDOR}/provisioning-rules`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ priority: 10, effect: 'DENY' });

    req.flush(CREADA);
    expect(interno<() => { id: string } | null>('created')()?.id).toBe('r-1');
  });

  it('la prioridad arranca en 1: cero frena sin gastar la petición', () => {
    formulario().patchValue({ providerId: PROVEEDOR, priority: 0 });
    interno<(v: unknown) => void>('elegirEfecto')('ALLOW');

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });

  it('la condición rota frena; corregida, viaja parseada junto con las asignaciones', () => {
    formulario().patchValue({
      providerId: PROVEEDOR,
      priority: 5,
      conditionJson: '{rota',
      assignRoleConceptId: ROL,
      assignTenantId: ORGANIZACION,
    });
    interno<(v: unknown) => void>('elegirEfecto')('ALLOW');

    interno<() => void>('submit')();
    http.expectNone(`/auth-providers/identity-providers/${PROVEEDOR}/provisioning-rules`);

    formulario().patchValue({ conditionJson: '{"hd": "clinica.example"}' });
    interno<() => void>('submit')();

    const req = http.expectOne(
      `/auth-providers/identity-providers/${PROVEEDOR}/provisioning-rules`,
    );
    expect(req.request.body).toEqual({
      priority: 5,
      conditionJson: { hd: 'clinica.example' },
      effect: 'ALLOW',
      assignRoleConceptId: ROL,
      assignTenantId: ORGANIZACION,
    });

    req.flush(CREADA);
  });
});
