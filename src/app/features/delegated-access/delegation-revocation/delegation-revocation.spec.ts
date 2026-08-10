import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DelegationRevocation } from './delegation-revocation';

const DELEGACION = '44444444-4444-4444-4444-444444444444';

describe('DelegationRevocation', () => {
  let fixture: ComponentFixture<DelegationRevocation>;
  let component: DelegationRevocation;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DelegationRevocation],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DelegationRevocation);
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

  it('sin un identificador con forma de UUID, no revoca nada', () => {
    interno<{ setValue: (v: { delegationId: string }) => void }>('form').setValue({
      delegationId: 'cualquier-cosa',
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('sin motivo, el cuerpo va vacío: no se inventa una clave con texto vacío', () => {
    interno<{ setValue: (v: { delegationId: string }) => void }>('form').setValue({
      delegationId: DELEGACION,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/practitioner-delegates/${DELEGACION}/revoke`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({ ok: true });
    expect(interno<() => string | null>('revoked')()).toBe(DELEGACION);
  });

  it('el motivo viaja recortado, para la auditoría', () => {
    interno<{ setValue: (v: { delegationId: string }) => void }>('form').setValue({
      delegationId: DELEGACION,
    });
    interno<{ set: (v: string) => void }>('reason').set('  licencia prolongada  ');

    interno<() => void>('submit')();

    const req = http.expectOne(`/practitioner-delegates/${DELEGACION}/revoke`);
    expect(req.request.body).toEqual({ reason: 'licencia prolongada' });

    req.flush({ ok: true });
  });
});
