import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { ESTADOS_DE_CASO, resolverEstadosDeCaso } from '../../../../testing/case-status';
import { VerificationCases } from './verification-cases';

/** UUID real del catálogo: determinista, no inventado. */
const CASE_VERIFIED = ESTADOS_DE_CASO.CASE_VERIFIED;
const CASE_OPEN = ESTADOS_DE_CASO.CASE_OPEN;
const CASE_IN_VERIFICATION = ESTADOS_DE_CASO.CASE_IN_VERIFICATION;

interface FilaVisible {
  readonly id: string;
  readonly statusVariant: string;
  readonly statusLabel: string;
  readonly openedAt: Date | null;
  readonly typeLabel: string;
  readonly evidenceFileId: string | null;
  readonly sinVeredicto: boolean;
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
    expect(vacio.nextAction.route).toBe('/my-account/identity/verify');
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
  it('FT-32-R06/R07: sin veredicto la fila no enlaza al detalle', () => {
    http.expectOne('/identity/me/verification-cases').flush([
      { id: 'abierto', status: CASE_OPEN },
      { id: 'revisando', status: CASE_IN_VERIFICATION },
      { id: 'listo', status: CASE_VERIFIED },
    ]);
    fixture.detectChanges();

    const listo = estado();
    expect(listo.status).toBe('ready');
    if (listo.status !== 'ready') return;
    expect(listo.data.map((f) => f.sinVeredicto)).toEqual([true, true, false]);

    const html: string = fixture.nativeElement.innerHTML;
    // Los dos sin veredicto son botones; el resuelto sí enlaza.
    expect(html).toContain('case-pending-abierto');
    expect(html).toContain('case-pending-revisando');
    expect(html).not.toContain('case-pending-listo');
    expect(html).toContain('/my-account/identity/cases/listo');
  });

  it('FT-32-R06/R07: el botón abre el aviso en vez del detalle', () => {
    http
      .expectOne('/identity/me/verification-cases')
      .flush([{ id: 'abierto', status: CASE_OPEN }]);
    fixture.detectChanges();

    const componente = component as unknown as {
      avisoDe: () => { id: string } | null;
      abrirAviso: (fila: unknown) => void;
      cerrarAviso: () => void;
    };
    expect(componente.avisoDe()).toBeNull();

    const listo = estado();
    if (listo.status !== 'ready') return;
    componente.abrirAviso(listo.data[0]);
    expect(componente.avisoDe()?.id).toBe('abierto');

    componente.cerrarAviso();
    expect(componente.avisoDe()).toBeNull();
  });

  it('FT-32-R02: la evidencia se pide por su contenido y se ofrece para guardar', () => {
    http
      .expectOne('/identity/me/verification-cases')
      .flush([{ id: 'caso-9', status: CASE_VERIFIED, evidenceFileId: 'file-7' }]);
    fixture.detectChanges();

    const listo = estado();
    expect(listo.status).toBe('ready');
    if (listo.status !== 'ready') return;
    expect(listo.data[0].evidenceFileId).toBe('file-7');

    const componente = component as unknown as {
      descargarEvidencia: (fila: unknown) => void;
      descargando: () => string | null;
      errorDeDescarga: () => string | null;
    };
    componente.descargarEvidencia(listo.data[0]);
    expect(componente.descargando()).toBe('caso-9');

    const req = http.expectOne('/common/files/file-7/content');
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['x'], { type: 'text/plain' }));

    expect(componente.errorDeDescarga()).toBeNull();
  });

  it('FT-32-R02: si la evidencia falla, lo dice y no queda cargando', () => {
    http
      .expectOne('/identity/me/verification-cases')
      .flush([{ id: 'caso-9', status: CASE_VERIFIED, evidenceFileId: 'file-7' }]);
    fixture.detectChanges();

    const listo = estado();
    if (listo.status !== 'ready') return;
    const componente = component as unknown as {
      descargarEvidencia: (fila: unknown) => void;
      descargando: () => string | null;
      errorDeDescarga: () => string | null;
    };
    componente.descargarEvidencia(listo.data[0]);
    http
      .expectOne('/common/files/file-7/content')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });

    expect(componente.descargando()).toBeNull();
    expect(componente.errorDeDescarga()).not.toBeNull();
  });
});
