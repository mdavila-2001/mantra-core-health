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

  function completarDelegacion() {
    interno<{
      setValue: (v: Record<string, string>) => void;
    }>('form').setValue({ delegationId: DELEGACION, patientProfileId: '', encounterId: '' });
  }

  it('sin propósito o sin vencimiento, el envío ni se intenta', () => {
    completarDelegacion();
    expect(interno<() => boolean>('faltanObligatorios')()).toBe(true);

    interno<() => void>('submit')();

    interno<(v: unknown) => void>('elegirProposito')('TREATMENT');
    interno<() => void>('submit')();
    // Sigue faltando `validTo`: `http.verify()` comprueba que nada viajó.
  });

  it('el grant viaja con propósito y vencimiento ISO, sin claves de más', () => {
    completarDelegacion();
    interno<(v: unknown) => void>('elegirProposito')('TREATMENT');
    interno<{ set: (v: Date | null) => void }>('validTo').set(
      new Date('2026-09-01T08:00:00.000Z'),
    );

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
    interno<(v: unknown) => void>('elegirRecurso')('LAB_ORDER');
    expect(interno<() => string | null>('resourceType')()).toBeNull();

    interno<(v: unknown) => void>('elegirRecurso')('PRESCRIPTION');
    expect(interno<() => string | null>('resourceType')()).toBe('PRESCRIPTION');
  });
});
