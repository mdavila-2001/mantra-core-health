import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { PermissionSetForm } from './permission-set-form';

const PERMISO = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

/** base64url sobre UTF-8, como el token real (ver `shell-layout.spec.ts`). */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('PermissionSetForm', () => {
  let fixture: ComponentFixture<PermissionSetForm>;
  let component: PermissionSetForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionSetForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] }),
      refreshToken: 'r',
    });

    fixture = TestBed.createComponent(PermissionSetForm);
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

  function completarIdentidad() {
    interno<{ patchValue: (v: Record<string, string>) => void }>('form').patchValue({
      code: 'GUARDIA',
      name: 'Set de guardia',
    });
  }

  function completarItem() {
    const editor = (
      component as unknown as { editor: () => { filas: { at: (i: number) => { patchValue: (v: object) => void } } } }
    ).editor();
    editor.filas.at(0).patchValue({ permissionId: PERMISO });
  }

  it('con una sola organización en el token, queda elegida sola', () => {
    expect(interno<() => string | null>('tenantId')()).toBe('t-1');
  });

  it('sin código, nombre o ítems válidos, no se publica nada', () => {
    interno<() => void>('submit')();

    completarIdentidad();
    interno<() => void>('submit')();
    // El ítem sigue vacío: `http.verify()` comprueba que nada viajó.
  });

  it('lo mínimo viaja con la organización, la identidad y su único ítem', () => {
    completarIdentidad();
    completarItem();

    interno<() => void>('submit')();

    const req = http.expectOne('/delegated-permission-sets');
    expect(req.request.method).toBe('POST');
    // Sin tipo ni descripción elegidos, esas claves no aparecen.
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      code: 'GUARDIA',
      name: 'Set de guardia',
      items: [{ permissionId: PERMISO, requiresStepUpAuthentication: false }],
    });

    req.flush({ id: 'v-1', versionNumber: 1, itemCount: 1 });
    expect(interno<() => { versionNumber: number } | null>('published')()?.versionNumber).toBe(1);
  });

  it('el tipo de delegado elegido viaja; uno fuera del contrato no entra', () => {
    interno<(v: unknown) => void>('elegirTipo')('STAFF');
    expect(interno<() => string | null>('delegateType')()).toBeNull();

    completarIdentidad();
    completarItem();
    interno<(v: unknown) => void>('elegirTipo')('NURSE');

    interno<() => void>('submit')();

    const req = http.expectOne('/delegated-permission-sets');
    expect((req.request.body as Record<string, unknown>)['delegateType']).toBe('NURSE');

    req.flush({ id: 'v-1', versionNumber: 1, itemCount: 1 });
  });
});
