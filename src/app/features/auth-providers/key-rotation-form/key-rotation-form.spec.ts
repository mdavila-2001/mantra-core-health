import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { KeyRotationForm } from './key-rotation-form';

const PROVEEDOR = '12121212-1212-1212-1212-121212121212';

describe('KeyRotationForm', () => {
  let fixture: ComponentFixture<KeyRotationForm>;
  let component: KeyRotationForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyRotationForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(KeyRotationForm);
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

  function cargarClave(): void {
    formulario().patchValue({ providerId: PROVEEDOR });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ keyId: 'k-2', algorithm: 'RS256', publicKey: 'pem' });
  }

  it('gracia 0 viaja: es la rotación de emergencia, no una omisión', () => {
    cargarClave();
    formulario().patchValue({ graceHours: 0 });

    interno<() => void>('submit')();

    const req = http.expectOne(
      `/auth-providers/identity-providers/${PROVEEDOR}/signing-keys/rotate`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      keyId: 'k-2',
      algorithm: 'RS256',
      publicKey: 'pem',
      graceHours: 0,
    });

    req.flush({ newKeyId: 'k-uuid', retiringCount: 1 });
  });

  it('sin gracia cargada la clave `graceHours` no viaja y el backend decide', () => {
    cargarClave();

    interno<() => void>('submit')();

    const req = http.expectOne(
      `/auth-providers/identity-providers/${PROVEEDOR}/signing-keys/rotate`,
    );
    expect(req.request.body).toEqual({ keyId: 'k-2', algorithm: 'RS256', publicKey: 'pem' });

    req.flush({ newKeyId: 'k-uuid', retiringCount: 2, graceUntil: '2026-08-08T12:00:00.000Z' });
    expect(interno<() => { graceUntil?: Date } | null>('rotated')()?.graceUntil).toBeInstanceOf(
      Date,
    );
  });

  it('una gracia fuera del contrato (0–720) frena el envío', () => {
    cargarClave();
    formulario().patchValue({ graceHours: 800 });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
