import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SetVersionForm } from './set-version-form';

const SET = '12121212-1212-1212-1212-121212121212';
const PERMISO_A = '34343434-3434-3434-3434-343434343434';
const PERMISO_B = '56565656-5656-5656-5656-565656565656';

describe('SetVersionForm', () => {
  let fixture: ComponentFixture<SetVersionForm>;
  let component: SetVersionForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetVersionForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SetVersionForm);
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

  function editor(): {
    filas: { at: (i: number) => { patchValue: (v: object) => void } };
    agregarFila: () => void;
  } {
    return (component as unknown as { editor: () => never }).editor();
  }

  it('sin el set o sin un ítem válido, no se publica nada', () => {
    interno<() => void>('submit')();

    interno<{ patchValue: (v: { setId: string }) => void }>('form').patchValue({ setId: SET });
    interno<() => void>('submit')();
    // El ítem sigue vacío: `http.verify()` comprueba que nada viajó.
  });

  it('la versión viaja con la lista completa de ítems, en orden', () => {
    interno<{ patchValue: (v: { setId: string }) => void }>('form').patchValue({ setId: SET });
    editor().filas.at(0).patchValue({ permissionId: PERMISO_A });
    editor().agregarFila();
    editor().filas.at(1).patchValue({
      permissionId: PERMISO_B,
      requiresStepUpAuthentication: true,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/delegated-permission-sets/${SET}/versions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      items: [
        { permissionId: PERMISO_A, requiresStepUpAuthentication: false },
        { permissionId: PERMISO_B, requiresStepUpAuthentication: true },
      ],
    });

    req.flush({ id: 'v-2', versionNumber: 2, itemCount: 2 });
    expect(interno<() => { versionNumber: number } | null>('published')()?.versionNumber).toBe(2);
  });
});
