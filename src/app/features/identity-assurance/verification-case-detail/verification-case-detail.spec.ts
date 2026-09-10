import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { resolverEstadosDeCaso } from '../../../../testing/case-status';
import { VerificationCaseDetail } from './verification-case-detail';

const CASE_REJECTED = '05c426b8-86f5-5709-a939-d6baa864fd21';

/**
 * V27-01·D: la ficha de un caso propio. Fija que el `caseId` sale de la ruta
 * —y que sin él la pantalla no toca la red—, y que el estado llega como sello
 * en palabras, no como UUID.
 */
describe('VerificationCaseDetail', () => {
  let fixture: ComponentFixture<VerificationCaseDetail>;
  let component: VerificationCaseDetail;
  let http: HttpTestingController;

  async function montar(params: Record<string, string>): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [VerificationCaseDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(params)) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VerificationCaseDetail);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    // El sello del caso sale de terminología; ver `resolverEstadosDeCaso`.
    resolverEstadosDeCaso(http);
  }

  afterEach(() => {
    http.verify();
  });

  function estado(): ViewState<unknown> {
    return (component as unknown as Record<'state', () => ViewState<unknown>>).state();
  }

  it('consulta el caso de la ruta y presenta el estado en palabras', async () => {
    await montar({ caseId: 'caso-9' });

    const req = http.expectOne('/identity/me/verification-cases/caso-9');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'caso-9', status: CASE_REJECTED, openedAt: '2026-07-31T12:00:00.000Z' });

    expect(estado().status).toBe('ready');
    const sello = (
      component as unknown as Record<'estado', () => { variant: string; label: string }>
    ).estado();
    expect(sello.label).toBe('Rechazado');
    expect(sello.variant).toBe('rejected');
  });

  it('sin caseId en la ruta no toca la red: no encontrado con vuelta al listado', async () => {
    await montar({});

    const ausente = estado();
    expect(ausente.status).toBe('not-found');
    if (ausente.status !== 'not-found') return;
    expect(ausente.nextAction?.route).toBe('/my-account/identity');
    // `http.verify()` del afterEach comprueba que no salió ninguna petición.
  });

  it('un caso que el backend no entrega no queda como listo', async () => {
    await montar({ caseId: 'ajeno-1' });

    http
      .expectOne('/identity/me/verification-cases/ajeno-1')
      .flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });

    expect(estado().status).not.toBe('ready');
  });
});
