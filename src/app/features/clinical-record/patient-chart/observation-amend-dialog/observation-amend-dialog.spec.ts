import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ObservationAmendDialog } from './observation-amend-dialog';

/**
 * Enmendar una medición (UC-08-04, BR-14). Lo que estas pruebas fijan:
 *
 * 1. **La nota es obligatoria** y el valor también: sin alguna de las dos no se
 *    pega al servidor y el campo dice qué falta.
 * 2. **Lo que viaja es el contrato**: `PATCH .../amend` con la nota y un solo
 *    camino de valor (el número gana sobre el texto).
 * 3. **Un rechazo del servidor se muestra sin perder lo escrito.**
 */
describe('ObservationAmendDialog', () => {
  let fixture: ComponentFixture<ObservationAmendDialog>;
  let componente: ObservationAmendDialog;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ObservationAmendDialog);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('observationId', 'obs-1');
    fixture.componentRef.setInput('nombre', 'Presión sistólica');
    fixture.componentRef.setInput('valorActual', '128 mmHg');
    fixture.detectChanges();
    // El selector de unidad pide su catálogo al montar.
    http.match((r) => r.url === '/system-context/dynamic-enums').forEach((r) => r.flush({}, { status: 404, statusText: 'x' }));
  });

  afterEach(() => http.verify());

  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  function enviar(): void {
    (componente as unknown as { enviar: () => void }).enviar();
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('muestra contra qué valor se corrige', () => {
    expect(texto()).toContain('128 mmHg');
  });

  it('sin nota no manda: marca el campo y lo dice', () => {
    señal<string | number | null>('valorNumerico').set('120');

    enviar();

    http.expectNone((r) => r.url.includes('/amend'));
    expect(texto()).toContain('Explicá el motivo de la corrección');
  });

  it('sin valor no manda', () => {
    señal<string>('nota').set('Error de tipeo al cargar');

    enviar();

    http.expectNone((r) => r.url.includes('/amend'));
    expect(texto()).toContain('Ingresá el valor corregido');
  });

  it('manda la nota y el número, y avisa que se enmendó', () => {
    let enmendada = 0;
    componente.amended.subscribe(() => (enmendada += 1));
    señal<string | number | null>('valorNumerico').set('120,5');
    señal<string>('nota').set('Error de tipeo al cargar');

    enviar();

    const req = http.expectOne('/clinical/observations/obs-1/amend');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ note: 'Error de tipeo al cargar', quantityValue: 120.5 });
    req.flush({
      id: 'obs-1',
      patientProfileId: 'p-1',
      status: 'AMENDED',
      componentIds: [],
      rowVersion: 2,
      createdAt: '2026-09-26T10:00:00.000Z',
    });

    expect(enmendada).toBe(1);
  });

  it('sin número manda el texto, y nunca los dos caminos', () => {
    señal<string>('valorEnPalabras').set('Ruidos rítmicos, sin soplos');
    señal<string>('nota').set('Se corrige la descripción');

    enviar();

    const req = http.expectOne('/clinical/observations/obs-1/amend');
    expect(req.request.body).toEqual({
      note: 'Se corrige la descripción',
      valueText: 'Ruidos rítmicos, sin soplos',
    });
    req.flush({ id: 'obs-1', patientProfileId: 'p-1', status: 'AMENDED', componentIds: [], rowVersion: 2, createdAt: '2026-09-26T10:00:00.000Z' });
  });

  it('un 409 del servidor se muestra y conserva lo escrito', () => {
    señal<string | number | null>('valorNumerico').set('120');
    señal<string>('nota').set('Error de tipeo al cargar');

    enviar();

    http
      .expectOne('/clinical/observations/obs-1/amend')
      .flush(
        { statusCode: 409, code: 'CONCURRENCY_CONFLICT', message: 'La observación fue modificada por otra sesión.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(texto()).toContain('modificada por otra sesión');
    expect(señal<string>('nota')()).toBe('Error de tipeo al cargar');
  });
});
