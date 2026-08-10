import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { IdentityUnlinkForm } from './identity-unlink-form';

const IDENTIDAD = '21212121-2121-2121-2121-212121212121';

const DESVINCULADA = {
  id: IDENTIDAD,
  stateConceptId: 'revocada-uuid',
  attemptId: 'a-3',
};

describe('IdentityUnlinkForm', () => {
  let fixture: ComponentFixture<IdentityUnlinkForm>;
  let component: IdentityUnlinkForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentityUnlinkForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(IdentityUnlinkForm);
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

  it('desvincula contra la identidad pegada, con el motivo como único cuerpo', () => {
    formulario().patchValue({
      identityId: IDENTIDAD,
      reason: 'La cuenta del proveedor fue comprometida.',
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/auth-providers/federated-identities/${IDENTIDAD}/unlink`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'La cuenta del proveedor fue comprometida.' });

    req.flush(DESVINCULADA);
    expect(interno<() => { attemptId: string } | null>('unlinked')()?.attemptId).toBe('a-3');
  });

  it('sin identidad no viaja nada: desvincular exige decir cuál', () => {
    formulario().patchValue({ reason: 'Motivo sin destino.' });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });

  it('sin motivo no viaja nada: la auditoría lo exige', () => {
    formulario().patchValue({ identityId: IDENTIDAD });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
