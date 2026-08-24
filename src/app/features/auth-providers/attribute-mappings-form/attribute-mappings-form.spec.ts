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

  /**
   * Avanza a la página que proyecta el editor de mapeos.
   *
   * El editor **no existe** mientras se contesta la primera página: es un campo
   * `custom` dentro de la segunda. Se llega como llegaría una persona —dando el
   * proveedor y pulsando «Siguiente»—, que es también lo que comprueba que el
   * motor no deja pasar sin él.
   */
  function irAlEditor(): void {
    formulario().patchValue({ providerId: PROVEEDOR });
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '[data-testid="paginated-form-continuar"]',
      ) as HTMLButtonElement | null
    )?.click();
    fixture.detectChanges();
  }

  function editor(): { filas: { at: (i: number) => { patchValue: (v: object) => void } } } {
    const encontrado = (
      component as unknown as {
        editor: () => { filas: { at: (i: number) => { patchValue: (v: object) => void } } } | undefined;
      }
    ).editor();
    if (encontrado === undefined) {
      throw new Error('el editor de mapeos todavía no está en pantalla: falta irAlEditor()');
    }
    return encontrado;
  }

  it('sin proveedor no viaja nada, y el editor ni se muestra', () => {
    // La primera página pide el proveedor y no deja pasar sin él, así que el
    // editor de mapeos no llega a existir.
    (
      fixture.nativeElement.querySelector(
        '[data-testid="paginated-form-continuar"]',
      ) as HTMLButtonElement | null
    )?.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('app-attribute-mappings-editor'),
    ).toBeNull();

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });

  it('el reemplazo viaja por PUT con los interruptores explícitos de cada fila', () => {
    irAlEditor();
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
    irAlEditor();
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
