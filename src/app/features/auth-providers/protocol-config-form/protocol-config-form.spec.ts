import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProtocolConfigForm } from './protocol-config-form';

const PROVEEDOR = '12121212-1212-1212-1212-121212121212';

const CONFIGURADA = {
  id: 'c-1',
  providerId: PROVEEDOR,
  environmentConceptId: 'entorno-uuid',
  replaced: false,
  importedKeyIds: [],
};

describe('ProtocolConfigForm', () => {
  let fixture: ComponentFixture<ProtocolConfigForm>;
  let component: ProtocolConfigForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProtocolConfigForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProtocolConfigForm);
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

  function editor(): {
    filas: { at: (i: number) => { patchValue: (v: object) => void } };
    agregarFila: () => void;
  } {
    return (component as unknown as { editor: () => never }).editor();
  }

  it('sin entorno elegido no viaja nada: es lo único obligatorio del cuerpo', () => {
    formulario().patchValue({ providerId: PROVEEDOR });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });

  it('el cuerpo mínimo lleva el entorno y el PKCE explícito, nada más', () => {
    formulario().patchValue({ providerId: PROVEEDOR });
    interno<(v: unknown) => void>('elegirEntorno')('PRODUCTION');

    interno<() => void>('submit')();

    const req = http.expectOne(`/auth-providers/identity-providers/${PROVEEDOR}/protocol-configs`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ environment: 'PRODUCTION', pkceRequired: true });

    req.flush(CONFIGURADA);
    expect(interno<() => { id: string } | null>('configured')()?.id).toBe('c-1');
  });

  it('la configuración adicional exige un objeto JSON: rota frena, objeto viaja parseado', () => {
    formulario().patchValue({ providerId: PROVEEDOR, extraConfigJson: '{rota' });
    interno<(v: unknown) => void>('elegirEntorno')('STAGING');

    interno<() => void>('submit')();
    http.expectNone(`/auth-providers/identity-providers/${PROVEEDOR}/protocol-configs`);

    formulario().patchValue({ extraConfigJson: '{"prompt": "login"}' });
    interno<() => void>('submit')();

    const req = http.expectOne(`/auth-providers/identity-providers/${PROVEEDOR}/protocol-configs`);
    expect(req.request.body).toEqual({
      environment: 'STAGING',
      pkceRequired: true,
      extraConfigJson: { prompt: 'login' },
    });

    req.flush(CONFIGURADA);
  });

  it('una clave del JWKS incompleta frena; completa, viaja con el resto del cuerpo', () => {
    formulario().patchValue({
      providerId: PROVEEDOR,
      jwksUri: 'https://idp.example/jwks',
      pkceRequired: false,
    });
    interno<(v: unknown) => void>('elegirEntorno')('PRODUCTION');
    editor().agregarFila();
    editor().filas.at(0).patchValue({ keyId: 'k-1' });

    interno<() => void>('submit')();
    http.expectNone(`/auth-providers/identity-providers/${PROVEEDOR}/protocol-configs`);

    editor().filas.at(0).patchValue({ algorithm: 'RS256', publicKey: 'pem' });
    interno<() => void>('submit')();

    const req = http.expectOne(`/auth-providers/identity-providers/${PROVEEDOR}/protocol-configs`);
    expect(req.request.body).toEqual({
      environment: 'PRODUCTION',
      jwksUri: 'https://idp.example/jwks',
      // Apagado también viaja: es una decisión explícita, no una omisión.
      pkceRequired: false,
      discoveredKeys: [{ keyId: 'k-1', algorithm: 'RS256', publicKey: 'pem' }],
    });

    req.flush({ ...CONFIGURADA, importedKeyIds: ['k-uuid'] });
  });
});
