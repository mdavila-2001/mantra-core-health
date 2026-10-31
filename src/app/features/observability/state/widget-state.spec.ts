import { HttpErrorResponse } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { empty } from '@core/view-state/view-state';
import { atrasoDeFrescura, WidgetState } from './widget-state';

function crear<T>(): WidgetState<T> {
  return runInInjectionContext(TestBed.inject(Injector), () => new WidgetState<T>());
}

describe('WidgetState', () => {
  it('empieza en S2 y pasa a ready con los datos', () => {
    const w = crear<number>();
    const fuente = new Subject<number>();
    expect(w.state().status).toBe('loading');
    w.cargar(fuente);
    fuente.next(7);
    expect(w.state()).toEqual({ status: 'ready', data: 7 });
  });

  it('al volver a pedir CONSERVA los datos (refrescando) en vez de volver al esqueleto', () => {
    const w = crear<number>();
    const a = new Subject<number>();
    w.cargar(a);
    a.next(1);
    const b = new Subject<number>();
    w.cargar(b);
    expect(w.state().status).toBe('ready');
    expect(w.refrescando()).toBe(true);
    b.next(2);
    expect(w.refrescando()).toBe(false);
    expect(w.state()).toEqual({ status: 'ready', data: 2 });
  });

  it('una petición nueva cancela la anterior: la última gana', () => {
    const w = crear<number>();
    const a = new Subject<number>();
    const b = new Subject<number>();
    w.cargar(a);
    w.cargar(b);
    a.next(1);
    expect(w.state().status).toBe('loading');
    b.next(2);
    expect(w.state()).toEqual({ status: 'ready', data: 2 });
  });

  it('un vacío con próxima acción gana sobre ready (S3)', () => {
    const w = crear<number[]>();
    const f = new Subject<number[]>();
    w.cargar(f, { vacio: (d) => (d.length === 0 ? empty({ label: 'Amplíe el rango' }, 'Nada') : null) });
    f.next([]);
    expect(w.state()).toMatchObject({ status: 'empty', nextAction: { label: 'Amplíe el rango' } });
  });

  it('datos atrasados son S7 con la antigüedad (asOf)', () => {
    const w = crear<number>();
    const f = new Subject<number>();
    const desde = new Date('2026-10-31T10:00:00.000Z');
    w.cargar(f, { atrasado: () => desde });
    f.next(1);
    expect(w.state()).toEqual({ status: 'stale', data: 1, asOf: desde });
  });

  it('un 403 es S5 (sin permiso), no un vacío ni un error genérico', () => {
    const w = crear<number>();
    const f = new Subject<number>();
    w.cargar(f);
    f.error(new HttpErrorResponse({ status: 403, error: { code: 'FORBIDDEN', message: 'No' } }));
    expect(w.state().status).toBe('forbidden');
  });

  it('un 500 es S9 con el requestId que mandó la API', () => {
    const w = crear<number>();
    const f = new Subject<number>();
    w.cargar(f);
    f.error(new HttpErrorResponse({ status: 500, error: { code: 'INTERNAL', message: 'x', correlationId: 'req-123' } }));
    const s = w.state();
    expect(s.status).toBe('error');
    expect(s.status === 'error' ? s.requestId : '').toBe('req-123');
  });
});

describe('atrasoDeFrescura', () => {
  it('al día (≤ 180 s) no es S7; pasado el umbral sí, con la fecha del último volcado', () => {
    expect(atrasoDeFrescura({ lastFlushAt: '2026-10-31T10:00:00.000Z', lagSeconds: 60 })).toBeNull();
    expect(atrasoDeFrescura({ lastFlushAt: '2026-10-31T10:00:00.000Z', lagSeconds: 600 })?.toISOString()).toBe('2026-10-31T10:00:00.000Z');
    expect(atrasoDeFrescura({ lastFlushAt: null, lagSeconds: null })).toBeNull();
  });
});
