import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HealthContextClient } from './health-context.client';
import type { ResolvedContext, ScheduleCreated } from './health-context.types';

/**
 * Lo que fijan estas pruebas:
 *
 * 1. **La resolución manda exactamente tres parámetros.** Uno de más sería
 *    ruido, y uno de menos termina en un 404 que parece «no existe» cuando en
 *    realidad faltó la clave.
 * 2. **`stale` viaja tal cual.** Es lo que convierte esta lectura en el primer
 *    S7 real del producto: una versión caducada se devuelve marcada, no se
 *    oculta, y la pantalla tiene que poder distinguirlo.
 * 3. **Los puntajes siguen siendo texto** (`@IsNumberString` en el backend).
 * 4. **Los opcionales que llegan `null` desaparecen**: `observedAt: null` por
 *    `new Date()` daría 1970.
 */

const PAIS = '11111111-1111-4111-8111-111111111111';
const DOMINIO = '22222222-2222-4222-8222-222222222222';

const RESUELTO = {
  contextId: 'ctx-1',
  versionId: 'ver-1',
  versionNumber: 3,
  contextPayloadJson: { poblacion: 47_000_000 },
  observedAt: '2026-07-01T00:00:00.000Z',
  expiresAt: '2026-12-31T00:00:00.000Z',
  stale: false,
  facts: [
    {
      id: 'f-1',
      factKey: 'poblacion.total',
      valueType: 'number',
      valueJson: 47_000_000,
      metricConceptId: null,
      unitConceptId: null,
      confidenceScore: '0.98',
      evidenceObservationIds: ['obs-1', 'obs-2'],
    },
  ],
};

describe('HealthContextClient', () => {
  let client: HealthContextClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(HealthContextClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('resolveContext', () => {
    it('pide los tres parámetros obligatorios y ninguno más', () => {
      client
        .resolveContext({ country: PAIS, domain: DOMINIO, key: 'cobertura.publica' })
        .subscribe();

      const req = http.expectOne((r) => r.url === '/health-context/contexts/resolve');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().sort((a, b) => a.localeCompare(b))).toEqual([
        'country',
        'domain',
        'key',
      ]);
      expect(req.request.params.get('country')).toBe(PAIS);
      expect(req.request.params.get('domain')).toBe(DOMINIO);
      expect(req.request.params.get('key')).toBe('cobertura.publica');

      req.flush(RESUELTO);
    });

    it('convierte las dos marcas de tiempo y conserva el puntaje como texto', () => {
      let resuelto: ResolvedContext | undefined;
      client
        .resolveContext({ country: PAIS, domain: DOMINIO, key: 'k' })
        .subscribe((c) => (resuelto = c));

      http.expectOne((r) => r.url === '/health-context/contexts/resolve').flush(RESUELTO);

      expect(resuelto?.observedAt).toBeInstanceOf(Date);
      expect(resuelto?.expiresAt).toBeInstanceOf(Date);
      expect(resuelto?.facts[0]?.confidenceScore).toBe('0.98');
      expect(typeof resuelto?.facts[0]?.confidenceScore).toBe('string');
      expect(resuelto?.facts[0]?.evidenceObservationIds).toEqual(['obs-1', 'obs-2']);
    });

    it('los opcionales del hecho que llegan null desaparecen, no quedan en null', () => {
      let resuelto: ResolvedContext | undefined;
      client
        .resolveContext({ country: PAIS, domain: DOMINIO, key: 'k' })
        .subscribe((c) => (resuelto = c));

      http.expectOne((r) => r.url === '/health-context/contexts/resolve').flush(RESUELTO);

      const hecho = resuelto?.facts[0];
      expect(hecho?.metricConceptId).toBeUndefined();
      expect('metricConceptId' in (hecho ?? {})).toBe(false);
    });

    it('una versión caducada llega marcada, no se oculta ni falla', () => {
      let resuelto: ResolvedContext | undefined;
      client
        .resolveContext({ country: PAIS, domain: DOMINIO, key: 'k' })
        .subscribe((c) => (resuelto = c));

      http
        .expectOne((r) => r.url === '/health-context/contexts/resolve')
        .flush({ ...RESUELTO, stale: true });

      expect(resuelto?.stale).toBe(true);
      expect(resuelto?.versionNumber).toBe(3);
    });

    it('sin observedAt no inventa 1970', () => {
      let resuelto: ResolvedContext | undefined;
      client
        .resolveContext({ country: PAIS, domain: DOMINIO, key: 'k' })
        .subscribe((c) => (resuelto = c));

      http
        .expectOne((r) => r.url === '/health-context/contexts/resolve')
        .flush({ ...RESUELTO, observedAt: null, expiresAt: null });

      expect(resuelto?.observedAt).toBeUndefined();
      expect(resuelto?.expiresAt).toBeUndefined();
    });

    it('un contexto sin hechos no rompe nada', () => {
      let resuelto: ResolvedContext | undefined;
      client
        .resolveContext({ country: PAIS, domain: DOMINIO, key: 'k' })
        .subscribe((c) => (resuelto = c));

      http
        .expectOne((r) => r.url === '/health-context/contexts/resolve')
        .flush({ ...RESUELTO, facts: [] });

      expect(resuelto?.facts).toEqual([]);
    });
  });

  describe('comandos', () => {
    it('la agenda convierte nextRunAt, y lo omite si no vino', () => {
      let agenda: ScheduleCreated | undefined;
      client
        .createSchedule({ countryConceptId: PAIS, agentId: 'a-1', scheduleExpression: '0 3 * * *' })
        .subscribe((s) => (agenda = s));

      const req = http.expectOne('/health-context/schedules');
      expect(req.request.method).toBe('POST');
      req.flush({
        id: 'sch-1',
        agentId: 'a-1',
        statusConceptId: 'concept-active',
        nextRunAt: '2026-08-12T03:00:00.000Z',
      });

      expect(agenda?.nextRunAt).toBeInstanceOf(Date);

      client
        .createSchedule({ countryConceptId: PAIS, agentId: 'a-2', scheduleExpression: '0 4 * * *' })
        .subscribe((s) => (agenda = s));

      http.expectOne('/health-context/schedules').flush({
        id: 'sch-2',
        agentId: 'a-2',
        statusConceptId: 'concept-active',
        nextRunAt: null,
      });

      expect(agenda?.nextRunAt).toBeUndefined();
    });

    it('la corrida idempotente informa si la clave ya existía', () => {
      client
        .startCollectionRun({ idempotencyKey: 'run-2026-08-11', trigger: 'MANUAL', agentId: 'a-1' })
        .subscribe();

      const req = http.expectOne('/health-context/collection-runs');
      expect(req.request.body).toEqual({
        idempotencyKey: 'run-2026-08-11',
        trigger: 'MANUAL',
        agentId: 'a-1',
      });
      req.flush({ id: 'run-1', statusConceptId: 'concept-running', duplicate: true });
    });

    it('publicar no manda cuerpo útil pero sí un objeto: null sería un 400', () => {
      client.publishVersion('ver-1').subscribe();

      const req = http.expectOne('/health-context/versions/ver-1/publish');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({
        id: 'ver-1',
        versionNumber: 4,
        statusConceptId: 'concept-published',
        countryHealthContextId: 'ctx-1',
      });
    });

    it('los contadores de una corrida cerrada llegan como texto: son bigint', () => {
      client.finishCollectionRun('run-1', { outcome: 'PARTIAL' }).subscribe((cierre) => {
        expect(cierre.observationsRead).toBe('9007199254740993');
        expect(typeof cierre.observationsAccepted).toBe('string');
      });

      http.expectOne('/health-context/collection-runs/run-1/finish').flush({
        id: 'run-1',
        statusConceptId: 'concept-partial',
        observationsRead: '9007199254740993',
        observationsAccepted: '12',
        observationsRejected: '3',
        sourceCount: 2,
      });
    });

    it('las rutas con identificador lo escapan', () => {
      client
        .recordObservation('a/b', { sourceId: 's', contentHash: 'h', status: 'ACCEPTED' })
        .subscribe();

      // Sin escapar, la barra abriría un segmento más y la petición no llegaría
      // a ninguna ruta declarada.
      const req = http.expectOne('/health-context/collection-runs/a%2Fb/observations');
      expect(req.request.url).toContain('a%2Fb');

      req.flush({ id: 'o-1', statusConceptId: 'c', duplicate: false });
    });
  });
});
