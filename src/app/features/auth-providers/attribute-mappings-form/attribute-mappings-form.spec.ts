import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AttributeMappingsForm } from './attribute-mappings-form';

const PROVEEDOR = '13131313-1313-1313-1313-131313131313';

const FIJADO = {
  providerId: PROVEEDOR,
  mappingIds: ['m-1'],
  removed: 2,
  identifierClaim: 'sub',
};

describe('AttributeMappingsForm', () => {
  let fixture: ComponentFixture<AttributeMappingsForm>;
  let component: AttributeMappingsForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttributeMappingsForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AttributeMappingsForm);
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

  function editor(): { filas: { at: (i: number) => { patchValue: (v: object) => void } } } {
    return (component as unknown as { editor: () => never }).editor();
  }

  it('sin proveedor no viaja nada: un solo intento marca los dos bloques', () => {
    editor().filas.at(0).patchValue({ sourceClaim: 'sub', targetAttribute: 'external_subject' });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });

  it('el reemplazo viaja por PUT con los interruptores explícitos de cada fila', () => {
    formulario().patchValue({ providerId: PROVEEDOR });
    editor().filas.at(0).patchValue({
      sourceClaim: 'sub',
      targetAttribute: 'external_subject',
      isIdentifier: true,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(
      `/auth-providers/identity-providers/${PROVEEDOR}/attribute-mappings`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      mappings: [
        {
          sourceClaim: 'sub',
          targetAttribute: 'external_subject',
          isIdentifier: true,
          required: false,
        },
      ],
    });

    req.flush(FIJADO);
    expect(interno<() => { identifierClaim: string } | null>('applied')()?.identifierClaim).toBe(
      'sub',
    );
  });

  it('una fila con la transformación rota frena; corregida, viaja parseada', () => {
    formulario().patchValue({ providerId: PROVEEDOR });
    editor().filas.at(0).patchValue({
      sourceClaim: 'email',
      targetAttribute: 'contact_email',
      transformJson: '{rota',
    });

    interno<() => void>('submit')();
    http.expectNone(`/auth-providers/identity-providers/${PROVEEDOR}/attribute-mappings`);

    editor().filas.at(0).patchValue({ transformJson: '{"lowercase": true}' });
    interno<() => void>('submit')();

    const req = http.expectOne(
      `/auth-providers/identity-providers/${PROVEEDOR}/attribute-mappings`,
    );
    expect(req.request.body).toEqual({
      mappings: [
        {
          sourceClaim: 'email',
          targetAttribute: 'contact_email',
          isIdentifier: false,
          required: false,
          transformJson: { lowercase: true },
        },
      ],
    });

    req.flush(FIJADO);
  });
});
