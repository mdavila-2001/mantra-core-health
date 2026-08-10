import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CheckResultForm } from './check-result-form';

const CHECK = '11111111-1111-1111-1111-111111111111';

describe('CheckResultForm', () => {
  let fixture: ComponentFixture<CheckResultForm>;
  let component: CheckResultForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckResultForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckResultForm);
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

  it('el veredicto solo viaja con el check pegado; el cuerpo mínimo es una clave', () => {
    formulario().patchValue({ checkId: CHECK });
    interno<(valor: unknown) => void>('elegirVeredicto')('MATCH');

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/checks/${CHECK}/results`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ result: 'MATCH' });

    req.flush({
      id: 're-1',
      resultVersion: 1,
      result: 'MATCH',
      checkStatus: 'estado-uuid',
    });
    expect(interno<() => { resultVersion: number } | null>('recorded')()?.resultVersion).toBe(1);
  });

  it('la discrepancia lleva el puntaje como texto y los códigos como lista', () => {
    formulario().patchValue({
      checkId: CHECK,
      matchScore: '0.42',
      discrepancyCodes: ' DOB_MISMATCH , NAME_PARTIAL ,',
      sourceResponseHash: 'a1b2c3',
    });
    interno<(valor: unknown) => void>('elegirVeredicto')('NO_MATCH');

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/checks/${CHECK}/results`);
    expect(req.request.body).toEqual({
      result: 'NO_MATCH',
      matchScore: '0.42',
      discrepancyCodes: ['DOB_MISMATCH', 'NAME_PARTIAL'],
      sourceResponseHash: 'a1b2c3',
    });

    req.flush({
      id: 're-2',
      resultVersion: 1,
      result: 'NO_MATCH',
      checkStatus: 'estado-uuid',
      caseStatus: 'caso-cerrado-uuid',
    });
    expect(interno<() => { caseStatus?: string } | null>('recorded')()?.caseStatus).toBe(
      'caso-cerrado-uuid',
    );
  });

  it('sin veredicto elegido, o con un puntaje que no es número, nada viaja', () => {
    // Check válido pero sin veredicto: la radio arranca sin elegir.
    formulario().patchValue({ checkId: CHECK });
    interno<() => void>('submit')();

    // Veredicto elegido pero puntaje no numérico: el pattern lo frena.
    formulario().patchValue({ matchScore: 'alto' });
    interno<(valor: unknown) => void>('elegirVeredicto')('MATCH');
    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
