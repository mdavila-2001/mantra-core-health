import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { ESTADOS_DE_CASO, resolverEstadosDeCaso } from '../../../../testing/case-status';
import { VerificationCases } from './verification-cases';

/** UUID real del catálogo: determinista, no inventado. */
const CASE_VERIFIED = ESTADOS_DE_CASO.CASE_VERIFIED;

interface FilaVisible {
  readonly id: string;
  readonly statusVariant: string;
  readonly statusLabel: string;
  readonly openedAt: Date | null;
}

/**
 * V27-01: la tabla de casos propios. Lo que estas pruebas fijan es el mapeo
 * DTO → fila (estado como etiqueta, no como UUID crudo) y que el vacío no es
 * un callejón: ofrece ir a verificarse.
 */
describe('VerificationCases', () => {
  let fixture: ComponentFixture<VerificationCases>;
  let component: VerificationCases;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerificationCases],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(VerificationCases);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    // La pantalla resuelve los estados contra terminología: sin responder esa
    // búsqueda, las etiquetas quedan en neutro y `verify()` protesta.
    resolverEstadosDeCaso(http);
  });

  afterEach(() => {
    http.verify();
  });

  function estado(): ViewState<readonly FilaVisible[]> {
    return (
      component as unknown as Record<'state', () => ViewState<readonly FilaVisible[]>>
    ).state();
  }

  function recargar(): void {
    (component as unknown as { cargar: () => void }).cargar.bind(component)();
  }

  it('pide los casos propios al montarse y traduce el estado a palabras', () => {
    const req = http.expectOne('/identity/me/verification-cases');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'caso-1', status: CASE_VERIFIED, openedAt: '2026-07-31T12:00:00.000Z' }]);

    const listo = estado();
    expect(listo.status).toBe('ready');
    if (listo.status !== 'ready') return;

    const fila = listo.data[0];
    expect(fila.statusLabel).toBe('Aprobado');
    expect(fila.statusVariant).toBe('success');
    expect(fila.openedAt).toBeInstanceOf(Date);
  });

  it('un estado que esta versión no conoce queda en neutro, no rompe', () => {
    http
      .expectOne('/identity/me/verification-cases')
      .flush([{ id: 'caso-2', status: 'uuid-que-no-existe' }]);

    const listo = estado();
    expect(listo.status).toBe('ready');
    if (listo.status !== 'ready') return;

    expect(listo.data[0].statusLabel).toBe('Desconocido');
    expect(listo.data[0].statusVariant).toBe('secondary');
  });

  it('sin casos, el vacío ofrece ir a verificar la identidad', () => {
    http.expectOne('/identity/me/verification-cases').flush([]);

    const vacio = estado();
    expect(vacio.status).toBe('empty');
    if (vacio.status !== 'empty') return;

    // La próxima acción es la puerta de la pantalla que abre casos.
    expect(vacio.nextAction.route).toBe('/identidad/verificar');
  });

  it('el error no queda como listo, y reintentar vuelve a pedir', () => {
    http
      .expectOne('/identity/me/verification-cases')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });

    expect(estado().status).not.toBe('ready');

    recargar();
    http.expectOne('/identity/me/verification-cases').flush([]);
    expect(estado().status).toBe('empty');
  });
});
