import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { LastPosition } from './last-position';

const SUJETO = '7a0f6bd4-1c1e-4c8a-9c2a-1a2b3c4d5e6f';
const OTRO_SUJETO = '8b1e7ce5-2d2f-4d9b-8d3b-2b3c4d5e6f70';

const POSICION = {
  pingId: 'ping-1',
  trackedSubjectId: SUJETO,
  latitude: '-34.60376500',
  longitude: '-58.38159200',
  accuracyM: '12.50',
  capturedAt: '2026-08-11T10:15:00.000Z',
  recordedAt: '2026-08-11T10:15:03.000Z',
};

/**
 * V13-02: la única lectura del M13.
 *
 * Lo que fijan estas pruebas:
 *
 * 1. **Sin identificador no se toca la red** y el estado es S3 con acción, no
 *    un esqueleto: no hay nada en camino que justifique insinuar contenido.
 * 2. **Las coordenadas se muestran enteras.** Es el assert que impide que
 *    alguien las pase por `Number` y pierda los decimales del backend.
 * 3. **El 404 lleva a algún lado.** Sus dos causas —sujeto inexistente y sujeto
 *    sin posiciones— se muestran igual, para no revelar si el identificador es
 *    real, así que la salida tiene que servir para las dos.
 * 4. **Cambiar de sujeto recarga.** Es la razón de leer `paramMap` y no
 *    `snapshot`: el router reutiliza el componente.
 */
describe('LastPosition', () => {
  let fixture: ComponentFixture<LastPosition>;
  let componente: LastPosition;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  async function montar(iniciales: Record<string, string>): Promise<void> {
    params = new BehaviorSubject(convertToParamMap(iniciales));

    await TestBed.configureTestingModule({
      imports: [LastPosition],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LastPosition);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  function estado(): ViewState<unknown> {
    return (componente as unknown as Record<'state', () => ViewState<unknown>>).state();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('sin identificador en la ruta no pide nada y ofrece una salida', async () => {
    await montar({});

    const vacio = estado();
    expect(vacio.status).toBe('empty');
    if (vacio.status !== 'empty') return;
    expect(vacio.nextAction.route).toBe('/administration/geolocation/subjects/new');
    // `http.verify()` del afterEach ya prueba que no salió ninguna petición.
  });

  it('con identificador pide la última posición y la muestra sin convertir', async () => {
    await montar({ trackedSubjectId: SUJETO });

    const req = http.expectOne(`/geo/tracked-subjects/${SUJETO}/last-position`);
    expect(req.request.method).toBe('GET');
    req.flush(POSICION);
    fixture.detectChanges();

    expect(estado().status).toBe('ready');
    // El assert que impide el casteo: con `Number` sería «-34.603765».
    expect(texto()).toContain('-34.60376500');
    expect(texto()).toContain('-58.38159200');
    expect(texto()).toContain('12.50');
  });

  it('lo que el backend no manda se dice, no se inventa', async () => {
    await montar({ trackedSubjectId: SUJETO });

    http
      .expectOne(`/geo/tracked-subjects/${SUJETO}/last-position`)
      .flush({ ...POSICION, accuracyM: null, capturedAt: null });
    fixture.detectChanges();

    // Sin `maybeDate`, `capturedAt: null` se pintaría como 1 de enero de 1970.
    expect(texto()).not.toContain('1970');
    expect(texto()).toContain('Sin dato');
  });

  it('el 404 no revela cuál de sus dos causas fue, y ofrece registrar posiciones', async () => {
    await montar({ trackedSubjectId: SUJETO });

    http.expectOne(`/geo/tracked-subjects/${SUJETO}/last-position`).flush(
      {
        code: 'NOT_FOUND',
        message: 'El sujeto no tiene posiciones registradas',
        timestamp: 't',
        path: '/p',
      },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    const noEncontrado = estado();
    expect(noEncontrado.status).toBe('not-found');
    if (noEncontrado.status !== 'not-found') return;
    expect(noEncontrado.nextAction?.route).toBe('/administration/geolocation/subjects/pings');
    // El mensaje del backend distingue las dos causas; la pantalla no.
    expect(texto()).not.toContain('no tiene posiciones registradas');
  });

  it('un 403 se muestra como prohibido, no como inexistente', async () => {
    await montar({ trackedSubjectId: SUJETO });

    http.expectOne(`/geo/tracked-subjects/${SUJETO}/last-position`).flush(
      { code: 'FORBIDDEN', message: 'Rol insuficiente para la operación', timestamp: 't', path: '/p' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(estado().status).toBe('forbidden');
  });

  it('cambiar de sujeto en la ruta vuelve a pedir: por eso se lee paramMap y no snapshot', async () => {
    await montar({ trackedSubjectId: SUJETO });
    http.expectOne(`/geo/tracked-subjects/${SUJETO}/last-position`).flush(POSICION);

    params.next(convertToParamMap({ trackedSubjectId: OTRO_SUJETO }));

    const segunda = http.expectOne(`/geo/tracked-subjects/${OTRO_SUJETO}/last-position`);
    expect(segunda.request.method).toBe('GET');
    segunda.flush({ ...POSICION, trackedSubjectId: OTRO_SUJETO });

    expect(estado().status).toBe('ready');
  });
});
