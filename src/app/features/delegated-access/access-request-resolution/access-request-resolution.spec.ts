import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AccessRequestResolution } from './access-request-resolution';

const SOLICITUD = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

describe('AccessRequestResolution', () => {
  let fixture: ComponentFixture<AccessRequestResolution>;
  let component: AccessRequestResolution;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessRequestResolution],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AccessRequestResolution);
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

  function conSolicitud() {
    interno<{ patchValue: (v: Record<string, string>) => void }>('form').patchValue({
      requestId: SOLICITUD,
    });
  }

  it('sin decisión, no se resuelve nada', () => {
    conSolicitud();
    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('una denegación viaja sola: el alcance cargado no acompaña porque no hay grant', () => {
    conSolicitud();
    interno<(v: unknown) => void>('elegirProposito')('TREATMENT');
    interno<(v: unknown) => void>('elegirDecision')('DENIED');

    interno<() => void>('submit')();

    const req = http.expectOne(`/access-requests/${SOLICITUD}/decision`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'DENIED' });

    req.flush({ requestId: SOLICITUD, decision: 'DENIED' });
    expect(interno<() => { grantId?: string } | null>('resolved')()?.grantId).toBeUndefined();
  });

  it('una aprobación lleva el alcance elegido y devuelve el grant emitido', () => {
    conSolicitud();
    interno<(v: unknown) => void>('elegirDecision')('APPROVED');
    interno<(v: unknown) => void>('elegirProposito')('TREATMENT');
    interno<{ set: (v: Date | null) => void }>('validTo').set(
      new Date('2026-09-30T18:00:00.000Z'),
    );

    interno<() => void>('submit')();

    const req = http.expectOne(`/access-requests/${SOLICITUD}/decision`);
    expect(req.request.body).toEqual({
      decision: 'APPROVED',
      purpose: 'TREATMENT',
      validTo: '2026-09-30T18:00:00.000Z',
    });

    req.flush({ requestId: SOLICITUD, decision: 'APPROVED', grantId: 'g-9' });
    expect(interno<() => { grantId?: string } | null>('resolved')()?.grantId).toBe('g-9');
  });

  it('una decisión fuera del contrato no entra', () => {
    interno<(v: unknown) => void>('elegirDecision')('MAYBE');
    expect(interno<() => string | null>('decision')()).toBeNull();
  });
});
