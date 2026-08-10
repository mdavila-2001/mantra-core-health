import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SigningKeyForm } from './signing-key-form';

const PROVEEDOR = '12121212-1212-1212-1212-121212121212';

describe('SigningKeyForm', () => {
  let fixture: ComponentFixture<SigningKeyForm>;
  let component: SigningKeyForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SigningKeyForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SigningKeyForm);
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

  function campos(): { form: { patchValue: (v: object) => void } } {
    return (component as unknown as { campos: () => { form: { patchValue: (v: object) => void } } })
      .campos();
  }

  it('sin proveedor o con la clave incompleta no viaja nada', () => {
    interno<() => void>('submit')();

    interno<{ patchValue: (v: object) => void }>('form').patchValue({ providerId: PROVEEDOR });
    interno<() => void>('submit')();
    // La clave sigue vacía: `http.verify()` comprueba que nada salió.
  });

  it('la clave viaja al proveedor de la ruta con el cuerpo exacto', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ providerId: PROVEEDOR });
    campos().form.patchValue({ keyId: 'k-1', algorithm: 'RS256', publicKey: 'pem' });

    interno<() => void>('submit')();

    const req = http.expectOne(`/auth-providers/identity-providers/${PROVEEDOR}/signing-keys`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ keyId: 'k-1', algorithm: 'RS256', publicKey: 'pem' });

    req.flush({ id: 'sk-1', keyId: 'k-1', stateConceptId: 'estado-uuid' });
    expect(interno<() => { keyId: string } | null>('published')()?.keyId).toBe('k-1');
  });
});
