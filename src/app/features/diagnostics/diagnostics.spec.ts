import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Diagnostics } from './diagnostics';

/**
 * La cola de trabajo del laboratorio. Lo que estas pruebas fijan:
 *
 * 1. **Es la única lectura del módulo que no pide un paciente**, y por eso es la
 *    que puede ser una sección con listado propio.
 * 2. **Los estados se traducen; los uuid no se muestran.**
 * 3. **Si la terminología falla, la cola se muestra igual.** Perder los nombres
 *    es molesto; perder la lista entera porque el catálogo no respondió sería
 *    peor.
 * 4. **La cola vacía ofrece la salida real**, que no es «crear una orden» —la
 *    orden nace de acesionar un espécimen, no de un formulario—.
 */

const ORDEN = {
  id: 'wo-1',
  workOrderNumber: 'WO-0001',
  laboratoryAccessionId: 'acc-1',
  statusConceptId: 'st-pendiente',
  priorityConceptId: 'prio-rutina',
  scheduledAt: '2026-08-14T09:00:00.000Z',
};

const ETIQUETAS = {
  items: [
    {
      conceptId: 'st-pendiente',
      code: 'WO_PENDING',
      display: 'Pendiente',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'prio-rutina',
      code: 'PRIORITY_ROUTINE',
      display: 'De rutina',
      codeSystemVersionId: 'csv-1',
    },
  ],
  total: 2,
};

describe('Diagnostics', () => {
  let fixture: ComponentFixture<Diagnostics>;
  let componente: Diagnostics;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Diagnostics);
    componente = fixture.componentInstance;
  });

  afterEach(() => http.verify());

  it('lee la cola acotada, sin pedir ningún paciente', () => {
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url === '/diagnostics/work-orders');
    expect(req.request.params.get('limit')).toBe('50');
    // La cola es del tenant, no de una persona: ninguna ruta lleva paciente.
    expect(req.request.url).not.toContain('patients');

    req.flush([ORDEN]);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(ETIQUETAS);
  });

  it('traduce estado y prioridad en vez de mostrar el uuid', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/diagnostics/work-orders').flush([ORDEN]);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(ETIQUETAS);
    fixture.detectChanges();

    expect(componente['etiquetaDe']('st-pendiente')).toBe('Pendiente');
    expect(componente['etiquetaDe']('prio-rutina')).toBe('De rutina');
  });

  it('un concepto sin etiqueta cae al guion, no al uuid', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/diagnostics/work-orders').flush([ORDEN]);
    http.expectOne((r) => r.url === '/terminology/concepts').flush({ items: [], total: 0 });
    fixture.detectChanges();

    expect(componente['etiquetaDe']('st-pendiente')).toBe('—');
    expect(componente['etiquetaDe'](undefined)).toBe('—');
  });

  /** Las etiquetas no son el dato: sin ellas la cola sigue siendo la cola. */
  it('si la terminología falla, la cola se muestra igual', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/diagnostics/work-orders').flush([ORDEN]);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const state = componente['cola']();
    expect(state.status).toBe('ready');
  });

  it('la cola vacía ofrece la salida real, no «crear una orden»', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/diagnostics/work-orders').flush([]);
    fixture.detectChanges();

    const state = componente['cola']();
    expect(state.status).toBe('empty');
    if (state.status === 'empty') {
      expect(state.nextAction.route).toBe('/medical-records');
    }
  });

  it('un fallo de la cola queda como estado de error reintentable', () => {
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/diagnostics/work-orders')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(componente['cola']().status).toBe('error');

    // Y reintentar vuelve a pedir la cola.
    componente['recargar']();
    http.expectOne((r) => r.url === '/diagnostics/work-orders').flush([]);
  });
});
