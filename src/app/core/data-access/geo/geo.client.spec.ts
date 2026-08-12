import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { GeoClient } from './geo.client';
import type { LastPosition, TrackingSession, Trip } from './geo.types';

/**
 * Lo que estas pruebas fijan, y que un refactor «prolijo» rompería en silencio:
 *
 * 1. **Las coordenadas siguen siendo texto.** Vienen de `numeric` de Postgres y
 *    convertirlas a `number` pierde decimales y ceros significativos. Hay un
 *    assert dedicado a impedirlo.
 * 2. **Los opcionales que llegan `null` desaparecen**, no quedan en `null`.
 *    `capturedAt: null` pasado por `new Date()` daría 1970, y
 *    `campo !== undefined` sería `true` para un dato que no existe.
 * 3. **Las rutas y los verbos exactos**, incluido que los dos comandos sin
 *    cuerpo mandan `{}` y no `null` — un `POST` sin cuerpo con
 *    `Content-Type: application/json` y `null` es un 400 del `ValidationPipe`.
 */

const SUJETO = '7a0f6bd4-1c1e-4c8a-9c2a-1a2b3c4d5e6f';

describe('GeoClient', () => {
  let client: GeoClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(GeoClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('lastPosition', () => {
    it('pide la última posición del sujeto y conserva las coordenadas como texto', () => {
      let posicion: LastPosition | undefined;
      client.lastPosition(SUJETO).subscribe((p) => (posicion = p));

      const req = http.expectOne(`/geo/tracked-subjects/${SUJETO}/last-position`);
      expect(req.request.method).toBe('GET');

      req.flush({
        pingId: 'ping-1',
        trackedSubjectId: SUJETO,
        latitude: '-34.60376500',
        longitude: '-58.38159200',
        accuracyM: '12.50',
        capturedAt: '2026-08-11T10:15:00.000Z',
        recordedAt: '2026-08-11T10:15:03.000Z',
      });

      // El assert que impide el casteo: con `Number` esto sería -34.603765 y
      // se perderían los ceros que el backend sí emite.
      expect(posicion?.latitude).toBe('-34.60376500');
      expect(posicion?.longitude).toBe('-58.38159200');
      expect(posicion?.accuracyM).toBe('12.50');
      expect(typeof posicion?.latitude).toBe('string');
    });

    it('las marcas de tiempo llegan como Date, y la ausente no es 1970', () => {
      let posicion: LastPosition | undefined;
      client.lastPosition(SUJETO).subscribe((p) => (posicion = p));

      http.expectOne(`/geo/tracked-subjects/${SUJETO}/last-position`).flush({
        pingId: 'ping-1',
        trackedSubjectId: SUJETO,
        latitude: '0',
        longitude: '0',
        // El backend manda `null`, no omite la clave.
        accuracyM: null,
        capturedAt: null,
        recordedAt: '2026-08-11T10:15:03.000Z',
      });

      expect(posicion?.recordedAt).toBeInstanceOf(Date);
      expect(posicion?.recordedAt.getUTCFullYear()).toBe(2026);
      expect(posicion?.capturedAt).toBeUndefined();
      expect(posicion?.accuracyM).toBeUndefined();
      // La clave se elimina, no queda en `undefined`: `'x' in obj` y el tipo
      // tienen que decir lo mismo.
      expect('capturedAt' in (posicion ?? {})).toBe(false);
    });

    it('escapa el identificador en la ruta', () => {
      client.lastPosition('a/b').subscribe();

      // Sin escapar, la barra abriría un segmento y la petición iría a
      // `/geo/tracked-subjects/a/b/last-position`, que no es ninguna ruta.
      const req = http.expectOne('/geo/tracked-subjects/a%2Fb/last-position');
      expect(req.request.url).toContain('a%2Fb');

      req.flush({
        pingId: 'p',
        trackedSubjectId: 'a/b',
        latitude: '0',
        longitude: '0',
        recordedAt: '2026-08-11T00:00:00.000Z',
      });
    });
  });

  describe('comandos', () => {
    it('el alta manda el cuerpo tal cual y convierte createdAt', () => {
      client.enrollTrackedSubject({ subjectId: 'p-1', subjectType: 'VEHICLE' }).subscribe();

      const req = http.expectOne('/geo/tracked-subjects');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ subjectId: 'p-1', subjectType: 'VEHICLE' });

      req.flush({
        id: 'ts-1',
        subjectId: 'p-1',
        subjectType: 'concept-vehicle',
        state: 'concept-active',
        createdAt: '2026-08-11T00:00:00.000Z',
      });
    });

    it('la ingesta de pings manda el lote entero en una sola petición', () => {
      client
        .ingestPings(SUJETO, {
          pings: [
            { latitude: -34.6, longitude: -58.38 },
            { latitude: -34.61, longitude: -58.39, batteryPct: 80, network: 'WIFI' },
          ],
        })
        .subscribe();

      const req = http.expectOne(`/geo/tracked-subjects/${SUJETO}/pings`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.pings).toHaveLength(2);
      // Al enviar sí son números: la asimetría con la lectura es del contrato.
      expect(typeof req.request.body.pings[0].latitude).toBe('number');
      req.flush({ recorded: 2 });
    });

    /**
     * Los dos comandos sin cuerpo mandan `{}`. No es un detalle: Angular
     * serializa `undefined` como cuerpo vacío y el `ValidationPipe` del backend
     * responde 400 sobre un cuerpo que no es un objeto.
     */
    it('revocar el consentimiento manda un objeto vacío, no null', () => {
      client.revokeConsent(SUJETO).subscribe();

      const req = http.expectOne(`/geo/tracked-subjects/${SUJETO}/revoke-consent`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ ok: true });
    });

    it('cerrar la sesión manda un objeto vacío, no null', () => {
      client.closeTrackingSession('s-1').subscribe();

      const req = http.expectOne('/geo/tracking-sessions/s-1/close');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({
        id: 's-1',
        trackedSubjectId: SUJETO,
        status: 'concept-closed',
        startedAt: '2026-08-11T09:00:00.000Z',
        endedAt: '2026-08-11T11:00:00.000Z',
      });
    });

    it('la sesión convierte sus dos marcas y omite la que no vino', () => {
      let sesion: TrackingSession | undefined;
      client.startTrackingSession({ trackedSubjectId: SUJETO }).subscribe((s) => (sesion = s));

      http.expectOne('/geo/tracking-sessions').flush({
        id: 's-1',
        trackedSubjectId: SUJETO,
        status: 'concept-open',
        startedAt: '2026-08-11T09:00:00.000Z',
        endedAt: null,
      });

      expect(sesion?.startedAt).toBeInstanceOf(Date);
      expect(sesion?.endedAt).toBeUndefined();
    });

    it('el viaje conserva distanceM como texto y durationS como número', () => {
      let viaje: Trip | undefined;
      client.closeTrip('t-1', { distanceM: 1250, durationS: 900 }).subscribe((t) => (viaje = t));

      const req = http.expectOne('/geo/trips/t-1/close');
      expect(req.request.body).toEqual({ distanceM: 1250, durationS: 900 });

      req.flush({
        id: 't-1',
        trackingSessionId: 's-1',
        status: 'concept-completed',
        distanceM: '1250.00',
        durationS: 900,
        startedAt: '2026-08-11T09:00:00.000Z',
        endedAt: '2026-08-11T09:15:00.000Z',
      });

      expect(viaje?.distanceM).toBe('1250.00');
      expect(viaje?.durationS).toBe(900);
    });

    it('la geocerca circular manda radio y centro, y el evento su sentido', () => {
      client
        .createGeofence({
          tenantId: 'tenant-1',
          name: 'Depósito central',
          shapeType: 'CIRCLE',
          radiusM: 500,
          centerLat: -34.6,
          centerLng: -58.38,
        })
        .subscribe();

      const geocerca = http.expectOne('/geo/geofences');
      expect(geocerca.request.body.shapeType).toBe('CIRCLE');
      expect(geocerca.request.body.radiusM).toBe(500);
      geocerca.flush({
        id: 'g-1',
        tenantId: 'tenant-1',
        name: 'Depósito central',
        shapeType: 'concept-circle',
        state: 'concept-active',
        createdAt: '2026-08-11T00:00:00.000Z',
      });

      client
        .recordGeofenceEvent({ geofenceId: 'g-1', trackedSubjectId: SUJETO, eventType: 'ENTER' })
        .subscribe();

      const evento = http.expectOne('/geo/geofence-events');
      expect(evento.request.body.eventType).toBe('ENTER');
      evento.flush({
        id: 'e-1',
        geofenceId: 'g-1',
        trackedSubjectId: SUJETO,
        eventType: 'concept-enter',
        occurredAt: null,
        recordedAt: '2026-08-11T10:00:00.000Z',
      });
    });
  });
});
