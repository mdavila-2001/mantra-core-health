import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GrantForm } from './grant-form';

const DELEGACION = '77777777-7777-7777-7777-777777777777';

describe('GrantForm', () => {
  let fixture: ComponentFixture<GrantForm>;
  let component: GrantForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrantForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GrantForm);
    component = fixture.componentInstance;
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

  /**
   * El formulario entero, ahora en un solo grupo.
   *
   * El propósito, la vigencia y el tipo de recurso vivían en señales sueltas
   * mientras la plantilla los dibujaba a mano; con el motor de formularios todo
   * escribe en el mismo `FormGroup`, así que la prueba lo llena igual que lo
   * llenaría una persona.
   */
  function completar(valores: Record<string, unknown> = {}) {
    interno<{
      patchValue: (v: Record<string, unknown>) => void;
    }>('form').patchValue({ delegationId: DELEGACION, ...valores });
  }

  it('sin propósito o sin vencimiento, el envío ni se intenta', () => {
    completar();
    interno<() => void>('submit')();

    completar({ purpose: 'TREATMENT' });
    interno<() => void>('submit')();
    // Sigue faltando `validTo`: `http.verify()` comprueba que nada viajó.
  });

  it('el grant viaja con propósito y vencimiento ISO, sin claves de más', () => {
    completar({
      purpose: 'TREATMENT',
      validTo: new Date('2026-09-01T08:00:00.000Z'),
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/practitioner-delegates/${DELEGACION}/grants`);
    expect(req.request.body).toEqual({
      purpose: 'TREATMENT',
      validTo: '2026-09-01T08:00:00.000Z',
    });

    req.flush({ id: 'g-1', status: 'c-uuid', createdAt: '2026-08-07T12:00:00.000Z' });
    expect(interno<() => { id: string } | null>('created')()?.id).toBe('g-1');
  });

  it('el tipo de recurso solo entra si es uno del contrato', () => {
    // El grupo admite cualquier texto —lo escribe el motor desde las opciones
    // que se le declararon—, así que la comprobación contra el contrato sigue
    // haciéndose al armar el cuerpo, que es donde importa.
    completar({
      purpose: 'TREATMENT',
      validTo: new Date('2026-09-01T08:00:00.000Z'),
      resourceType: 'LAB_ORDER',
    });
    interno<() => void>('submit')();
    const ajeno = http.expectOne(`/practitioner-delegates/${DELEGACION}/grants`);
    expect(ajeno.request.body).not.toHaveProperty('resourceType');
    ajeno.flush({ id: 'g-1', status: 'c', createdAt: '2026-08-07T12:00:00.000Z' });

    completar({ resourceType: 'PRESCRIPTION' });
    interno<() => void>('submit')();
    const valido = http.expectOne(`/practitioner-delegates/${DELEGACION}/grants`);
    expect(valido.request.body).toMatchObject({ resourceType: 'PRESCRIPTION' });
    valido.flush({ id: 'g-2', status: 'c', createdAt: '2026-08-07T12:00:00.000Z' });
  });
});
