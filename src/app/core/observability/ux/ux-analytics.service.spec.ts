import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SessionStore } from '../../auth/session.store';
import type { ActivityEvent, CaptureActivityEvents } from '../../data-access/telemetry/telemetry.types';
import { UX_ANALYTICS_CONFIG, type UxAnalyticsConfig } from './ux-analytics.config';
import { normalizarRuta, nuevoUuid, UxAnalytics } from './ux-analytics.service';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

// uuid como los de la API real: `@IsUUID` rechaza el lote entero si no lo son.
const USUARIO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USUARIO_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TENANT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TOKEN = jwt({ sub: USUARIO_A, roles: [], tenants: [TENANT] });
const TOKEN_B = jwt({ sub: USUARIO_B, roles: [], tenants: [] });
const TOKEN_VENCIDO = jwt({ sub: USUARIO_A, roles: [], tenants: [TENANT], exp: 1 });
const ESQUEMA = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const URL_INGESTA = '/telemetry/activity-events';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class Pantalla {}

const CONFIG: UxAnalyticsConfig = {
  active: true,
  eventSchemaDefinitionId: ESQUEMA,
  sampleRatio: 1,
  flushIntervalMs: 10_000,
  maxBatch: 50,
  maxKeepaliveBatch: 20,
  maxBuffer: 500,
};

/**
 * El servicio contra un **doble** de la API: `HttpTestingController` responde
 * lo que promete el contrato de `POST /telemetry/activity-events`. Cubre los
 * tres niveles —respuesta correcta, bordes del lote y respuestas inválidas—;
 * la ingesta real queda para la verificación contra la API levantada.
 */
describe('UxAnalytics', () => {
  let http: HttpTestingController;
  let session: SessionStore;
  let router: Router;

  function configurar(config: Partial<UxAnalyticsConfig> = {}): UxAnalytics {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'inicio', component: Pantalla },
          { path: 'pacientes/:pacienteId', component: Pantalla },
          { path: '**', component: Pantalla },
        ]),
        { provide: UX_ANALYTICS_CONFIG, useValue: { ...CONFIG, ...config } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
    return TestBed.inject(UxAnalytics);
  }

  async function navegar(url: string): Promise<void> {
    await router.navigateByUrl(url);
  }

  function clicEn(selector: string, detail = 1): void {
    document.querySelector(selector)?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 40, clientY: 30, detail }),
    );
  }

  function lote(req: TestRequest): readonly ActivityEvent[] {
    return (req.request.body as CaptureActivityEvents).events;
  }

  function responder(req: TestRequest): void {
    const n = lote(req).length;
    req.flush({ inserted: n, skipped: 0, eventIds: lote(req).map((_, i) => `e-${i}`) }, { status: 201, statusText: 'Created' });
  }

  beforeEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '<button data-testid="abrir">Abrir la receta de Ana Pérez</button><input formcontrolname="dosis">';
  });

  afterEach(() => {
    http.verify();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function abrir(config: Partial<UxAnalyticsConfig> = {}, token = TOKEN): Promise<UxAnalytics> {
    const ux = configurar(config);
    session.start({ accessToken: token, refreshToken: 'r-1' });
    TestBed.tick();
    ux.start();
    await navegar('/inicio');
    return ux;
  }

  function ocultar(): void {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  }

  describe('nivel correcto', () => {
    it('manda la vista y el clic con la forma del contrato y sin datos de la pantalla', async () => {
      const ux = configurar();
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/pacientes/8437');
      clicEn('[data-testid="abrir"]');
      ux.enviar(false);

      const req = http.expectOne(URL_INGESTA);
      expect(req.request.method).toBe('POST');
      expect(req.request.keepalive).toBe(false);
      const eventos = lote(req);
      expect(eventos.map((e) => e.eventName)).toEqual(['pagina_vista', 'clic']);
      for (const evento of eventos) {
        expect(evento.eventSchemaDefinitionId).toBe(ESQUEMA);
        expect(evento.userId).toBe(USUARIO_A);
        expect(evento.tenantId).toBe(TENANT);
        expect(evento.routeTemplate).toBe('/pacientes/:pacienteId');
        expect(evento.sessionId).toMatch(/^[0-9a-f-]{36}$/);
      }
      expect(new Set(eventos.map((e) => e.eventIdempotencyKey)).size).toBe(2);

      const cuerpo = JSON.stringify(req.request.body);
      for (const prohibido of ['8437', 'Ana', 'Pérez', 'receta']) {
        expect(cuerpo).not.toContain(prohibido);
      }
      responder(req);
    });

    it('registra el foco de un campo sin su valor y el abandono al navegar', async () => {
      const ux = configurar();
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      const campo = document.querySelector('input')!;
      campo.value = 'Paracetamol 500';
      campo.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await navegar('/pacientes/1');
      ux.enviar(false);

      const req = http.expectOne(URL_INGESTA);
      const eventos = lote(req);
      expect(eventos.map((e) => e.eventName)).toEqual(['pagina_vista', 'campo_enfocado', 'pagina_abandonada', 'pagina_vista']);
      expect(eventos[2]?.routeTemplate).toBe('/inicio');
      expect(JSON.stringify(req.request.body)).not.toContain('Paracetamol');
      responder(req);
    });

    it('la página vista sin sesión no deja un abandono huérfano al iniciar sesión', async () => {
      const ux = configurar();
      ux.start();

      await navegar('/inicio');
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      await navegar('/pacientes/1');
      ux.enviar(false);

      const req = http.expectOne(URL_INGESTA);
      expect(lote(req).map((e) => [e.eventName, e.routeTemplate])).toEqual([['pagina_vista', '/pacientes/:pacienteId']]);
      responder(req);
    });

    it('la sesión del navegador se conserva en la pestaña', () => {
      configurar().start();

      expect(sessionStorage.getItem('mch.ux.session')).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('nivel límite', () => {
    it('al llegar a maxBatch manda sin esperar al temporizador', async () => {
      const ux = configurar({ maxBatch: 3 });
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      clicEn('[data-testid="abrir"]');
      clicEn('[data-testid="abrir"]');

      responder(http.expectOne(URL_INGESTA));
    });

    it('al ocultarse la pestaña manda con keepalive y en lotes de maxKeepaliveBatch', async () => {
      const ux = configurar({ maxKeepaliveBatch: 2 });
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      clicEn('[data-testid="abrir"]');
      clicEn('[data-testid="abrir"]');
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));

      const req = http.expectOne(URL_INGESTA);
      expect(req.request.keepalive).toBe(true);
      expect(lote(req)).toHaveLength(2);
      responder(req);
    });

    it('marca el tercer clic seguido en el mismo lugar como repetido', async () => {
      const ux = configurar();
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      clicEn('[data-testid="abrir"]');
      clicEn('[data-testid="abrir"]');
      clicEn('[data-testid="abrir"]');
      ux.enviar(false);

      const req = http.expectOne(URL_INGESTA);
      const repetido = lote(req)
        .filter((e) => e.eventName === 'clic')
        .map((e) => e.properties.find((p) => p.propertyName === 'es_clic_repetido')?.valueBoolean);
      expect(repetido).toEqual([false, false, true]);
      responder(req);
    });

    it('el lote del cierre sale aunque el del ocultamiento siga en vuelo', async () => {
      await abrir();
      clicEn('[data-testid="abrir"]');
      ocultar();
      window.dispatchEvent(new Event('pagehide'));

      const lotes = http.match(URL_INGESTA);
      expect(lotes).toHaveLength(2);
      expect(lotes.every((req) => req.request.keepalive)).toBe(true);
      expect(lote(lotes[1]!).map((e) => e.eventName)).toEqual(['pagina_abandonada']);
      lotes.forEach(responder);
    });

    it('al volver con «atrás» desde la caché del navegador reabre la página', async () => {
      const ux = await abrir();
      window.dispatchEvent(new Event('pagehide'));
      http.match(URL_INGESTA).forEach(responder);

      const vuelta = new Event('pageshow');
      Object.defineProperty(vuelta, 'persisted', { value: true });
      window.dispatchEvent(vuelta);
      clicEn('[data-testid="abrir"]');
      ux.enviar(false);

      const req = http.expectOne(URL_INGESTA);
      expect(lote(req).map((e) => e.eventName)).toEqual(['pagina_vista', 'clic']);
      responder(req);
    });

    it('una URL que ninguna ruta reconoce viaja sin sus identificadores', async () => {
      const ux = await abrir();
      await navegar('/legado/historial/9d8e7f60-1a2b-4c3d-8e9f-0a1b2c3d4e5f/8437');
      ux.enviar(false);

      const req = http.expectOne(URL_INGESTA);
      expect(lote(req).map((e) => e.routeTemplate)).toContain('/legado/historial/:id/:id');
      expect(JSON.stringify(req.request.body)).not.toMatch(/8437|9d8e7f60/);
      responder(req);
    });

    it('un clic de teclado se cuenta sin coordenadas', async () => {
      const ux = configurar();
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      clicEn('[data-testid="abrir"]', 0);
      ux.enviar(false);

      const req = http.expectOne(URL_INGESTA);
      const clicDeTeclado = lote(req).find((e) => e.eventName === 'clic')!;
      expect(clicDeTeclado.properties.some((p) => p.propertyName === 'x_doc')).toBe(false);
      responder(req);
    });
  });

  describe('nivel inválido', () => {
    it('sin sesión no manda nada', async () => {
      const ux = configurar();
      ux.start();

      await navegar('/inicio');
      clicEn('[data-testid="abrir"]');
      ux.enviar(false);

      http.expectNone(URL_INGESTA);
    });

    it('apagada no engancha ningún oyente', async () => {
      const ux = configurar({ active: false });
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      clicEn('[data-testid="abrir"]');
      ux.enviar(false);

      http.expectNone(URL_INGESTA);
    });

    it('fuera del muestreo no captura', async () => {
      const ux = configurar({ sampleRatio: 0 });
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      ux.enviar(false);

      http.expectNone(URL_INGESTA);
      expect(sessionStorage.getItem('mch.ux.sampled')).toBe('false');
    });

    it('un 400 de la API no se reintenta', async () => {
      const ux = configurar();
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      ux.enviar(false);
      http.expectOne(URL_INGESTA).flush({ code: 'VALIDATION_ERROR' }, { status: 400, statusText: 'Bad Request' });
      ux.enviar(false);

      http.expectNone(URL_INGESTA);
    });

    it('un 503 se reintenta con las mismas claves de idempotencia', async () => {
      const ux = configurar();
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      ux.enviar(false);
      const primero = http.expectOne(URL_INGESTA);
      const claves = lote(primero).map((e) => e.eventIdempotencyKey);
      primero.flush(null, { status: 503, statusText: 'Service Unavailable' });

      // Durante la espera no se insiste…
      ux.enviar(false);
      http.expectNone(URL_INGESTA);

      // …y pasada la espera sale el mismo lote.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + CONFIG.flushIntervalMs + 1);
      ux.enviar(false);
      const segundo = http.expectOne(URL_INGESTA);
      expect(lote(segundo).map((e) => e.eventIdempotencyKey)).toEqual(claves);
      responder(segundo);
    });

    it('al cerrarse la sesión descarta lo acumulado', async () => {
      const ux = configurar();
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      session.clear();
      TestBed.tick();
      session.start({ accessToken: jwt({ sub: 'u-2', roles: [], tenants: [] }), refreshToken: 'r-2' });
      TestBed.tick();
      ux.enviar(false);

      http.expectNone(URL_INGESTA);
    });

    it('no captura lo que está dentro de data-ux-ignore', async () => {
      document.body.innerHTML = '<div data-ux-ignore><button data-testid="privado">x</button></div>';
      const ux = configurar();
      session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
      TestBed.tick();
      ux.start();

      await navegar('/inicio');
      clicEn('[data-testid="privado"]');
      ux.enviar(false);

      const req = http.expectOne(URL_INGESTA);
      expect(lote(req).map((e) => e.eventName)).toEqual(['pagina_vista']);
      responder(req);
    });

    it('con el token vencido no manda nada al cerrar la pestaña', async () => {
      // El interceptor rotaría el refresh token en una petición sin keepalive
      // que la descarga corta: al volver, la API revocaría la sesión.
      const ux = await abrir({}, TOKEN_VENCIDO);
      clicEn('[data-testid="abrir"]');
      ocultar();
      window.dispatchEvent(new Event('pagehide'));

      http.expectNone(URL_INGESTA);
      // Lo capturado sigue ahí: un envío normal (con el interceptor, que primero
      // refresca) sí sale. Solo se evita el camino de la descarga.
      ux.enviar(false);
      expect(lote(http.expectOne(URL_INGESTA)).length).toBeGreaterThan(0);
    });

    it('un 404 (esquema borrado) detiene la captura de la sesión', async () => {
      const ux = await abrir();
      ux.enviar(false);
      http.expectOne(URL_INGESTA).flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });

      clicEn('[data-testid="abrir"]');
      await navegar('/pacientes/1');
      ux.enviar(false);

      http.expectNone(URL_INGESTA);
    });

    it('al cambiar de persona en la pestaña renueva la sesión y no reencola el lote de la anterior', async () => {
      const ux = await abrir();
      const sesionDeA = sessionStorage.getItem('mch.ux.session');
      ux.enviar(false);
      const deA = http.expectOne(URL_INGESTA);

      session.clear();
      TestBed.tick();
      session.start({ accessToken: TOKEN_B, refreshToken: 'r-2' });
      TestBed.tick();
      deA.flush(null, { status: 503, statusText: 'Service Unavailable' });

      expect(sessionStorage.getItem('mch.ux.session')).not.toBe(sesionDeA);
      await navegar('/pacientes/2');
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 60 * 60_000);
      ux.enviar(false);

      const deB = http.expectOne(URL_INGESTA);
      expect(lote(deB).map((e) => [e.eventName, e.userId])).toEqual([['pagina_vista', USUARIO_B]]);
      expect(lote(deB)[0]?.sessionId).not.toBe(sesionDeA);
      responder(deB);
    });
  });
});

describe('nuevoUuid', () => {
  it('sin crypto.randomUUID (HTTP en la red local) arma un uuid v4 con getRandomValues', () => {
    // Propiedad propia en `undefined`: tapa la del prototipo sin tocarla.
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const ids = new Set(Array.from({ length: 50 }, () => nuevoUuid()));
      expect(ids.size).toBe(50);
      for (const id of ids) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      }
    } finally {
      delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
  });
});

describe('normalizarRuta', () => {
  it('limpia los segmentos y deja intactos los :param', () => {
    expect(normalizarRuta('/pacientes/:pacienteId')).toBe('/pacientes/:pacienteId');
    expect(normalizarRuta('/fila-8437/x')).toBe('/fila-:id/x');
    expect(normalizarRuta('/')).toBe('/');
    // FAR-01: el `:token` que deja `sanitizeUrl` viaja tal cual, no el token.
    expect(normalizarRuta('/administration/pharmacy-orders/rx/:token')).toBe(
      '/administration/pharmacy-orders/rx/:token',
    );
  });
});
