import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { DevicesBreakdown } from '../../../core/data-access/admin-portal/analytics-devices.types';
import type { InstancesLiveness } from '../../../core/data-access/admin-portal/ops-liveness.types';
import type { OpsToolsOverview } from '../../../core/data-access/admin-portal/ops-tools.types';
import { vidaSimulada } from '../../../core/mock/handlers/ops-liveness.handlers';
import { herramientasSimuladas } from '../../../core/mock/handlers/ops-tools.handlers';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { PlatformHome } from './platform-home';

/* Datos sintéticos del simulador o armados a mano para un caso límite: ninguno
   es una medición. Las demás tarjetas (API, preparación, incidentes…) no son
   el objeto de esta prueba: sus pedidos se contestan con un error y se verifica
   que NO apagan a las nuevas. */

const AHORA = new Date('2026-10-30T12:00:00.000Z');
const ERROR_500 = { status: 500, statusText: 'Internal Server Error' };

function dispositivos(sobrescribir: Partial<DevicesBreakdown> = {}): DevicesBreakdown {
  return {
    window: { from: '2026-10-23T12:00:00.000Z', to: '2026-10-30T12:00:00.000Z' },
    totals: { contexts: 200, bots: 12 },
    byDeviceType: [
      { code: 'MOBILE', label: 'Móvil', contexts: 70 },
      { code: 'DESKTOP', label: 'Escritorio', contexts: 120 },
      { code: 'UNSPECIFIED', label: 'UNSPECIFIED', contexts: 10 },
    ],
    byOsFamily: [],
    byBrowserFamily: [],
    byAppVersion: [],
    lastContextAt: '2026-10-30T11:58:00.000Z',
    notMeasured: [],
    ...sobrescribir,
  };
}

describe('PlatformHome · tarjetas de instancias, herramientas y dispositivos', () => {
  let fixture: ComponentFixture<PlatformHome>;
  let http: HttpTestingController;

  const esVida = (r: { url: string }) => r.url === '/admin/ops/instances/liveness';
  const esHerramientas = (r: { url: string }) => r.url === '/admin/ops/tools';
  const esDispositivos = (r: { url: string }) => r.url === '/admin/analytics/devices';
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const q = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector(selector);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlatformHome],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: NavigationService,
          useValue: {
            visibleSections: () => [
              { path: 'superadmin/instances' },
              { path: 'superadmin/observability' },
            ],
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlatformHome);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  /** Contesta las tres nuevas con lo dado y el resto con un 500 (no son el objeto de la prueba). */
  function responder(
    v: InstancesLiveness | 'error' = vidaSimulada(AHORA),
    h: OpsToolsOverview | 'error' = herramientasSimuladas(AHORA),
    d: DevicesBreakdown | 'error' = dispositivos(),
  ): void {
    const enviar = (req: ReturnType<typeof http.expectOne>, cuerpo: unknown) =>
      cuerpo === 'error'
        ? req.flush({ statusCode: 500, code: 'INTERNAL', message: 'x' }, ERROR_500)
        : req.flush(cuerpo as object);
    enviar(http.expectOne(esVida), v);
    enviar(http.expectOne(esHerramientas), h);
    enviar(http.expectOne(esDispositivos), d);
    for (const req of http.match(() => true))
      req.flush({ statusCode: 500, code: 'INTERNAL', message: 'x' }, ERROR_500);
    fixture.detectChanges();
  }

  it('pide dispositivos con los últimos 7 días', () => {
    const d = http.expectOne(esDispositivos);
    const dias =
      (new Date(d.request.params.get('to')!).getTime() -
        new Date(d.request.params.get('from')!).getTime()) /
      86_400_000;
    expect(Math.round(dias)).toBe(7);
    d.flush(dispositivos());
    for (const req of http.match(() => true)) req.flush({}, ERROR_500);
  });

  it('Instancias: estado general con su palabra y el conteo por estado', () => {
    responder();
    expect(q('[data-testid="centro-instancias"]')!.textContent).toContain('Caída');
    expect(q('[data-testid="centro-instancias"]')!.getAttribute('data-estado')).toBe('CAIDA');
    const conteo = q('[data-testid="centro-instancias-conteo"]')!.textContent!;
    for (const palabra of ['Vivas', 'Degradadas', 'Caídas', 'Sin dato'])
      expect(conteo).toContain(palabra);
    expect(q('[data-testid="centro-instancias-lectura"]')!.textContent).toContain(
      'Hay instancias requeridas caídas',
    );
  });

  it('Instancias: SIN_DATO no se lee como «todo bien»', () => {
    responder({ ...vidaSimulada(AHORA), overall: 'SIN_DATO', instances: [] });
    const tarjeta = q('[data-testid="centro-instancias"]')!.textContent!;
    expect(tarjeta).toContain('Sin dato');
    expect(q('[data-testid="centro-instancias-lectura"]')!.textContent).toContain(
      'no se sabe si las instancias viven',
    );
    expect(texto()).not.toContain('Todas las instancias requeridas');
  });

  it('Instancias: si la lectura falla no queda ningún estado a la vista', () => {
    responder('error');
    expect(q('[data-testid="centro-instancias"]')).toBeNull();
    // Las otras dos tarjetas nuevas siguen vivas.
    expect(q('[data-testid="centro-herramientas"]')).not.toBeNull();
    expect(q('[data-testid="centro-dispositivos"]')).not.toBeNull();
  });

  it('Herramientas críticas: cuenta por cómo se comprobó y avisa de las que no tienen sonda', () => {
    responder();
    const cifras = q('[data-testid="centro-herramientas"]')!.textContent!;
    for (const palabra of [
      'Críticas',
      'Responden',
      'No responden',
      'Configuración incompleta',
      'Sin sondear',
    ])
      expect(cifras).toContain(palabra);
    expect(q('[data-testid="centro-herramientas-nota"]')!.textContent).toMatch(
      /Sólo 2 de 6 críticas respondieron a una sonda en vivo/,
    );
  });

  it('Herramientas críticas: sin ninguna crítica declarada no pinta «0 fallas» como buena noticia', () => {
    responder(vidaSimulada(AHORA), {
      ...herramientasSimuladas(AHORA),
      items: herramientasSimuladas(AHORA).items.filter((t) => !t.isCritical),
    });
    expect(q('[data-testid="centro-herramientas"]')).toBeNull();
    expect(q('[data-testid="centro-herramientas-vacio"]')!.textContent).toContain(
      'no significa que todo esté bien',
    );
  });

  it('Herramientas críticas: un error propio no apaga a Instancias ni a Dispositivos', () => {
    responder(vidaSimulada(AHORA), 'error');
    expect(q('[data-testid="centro-herramientas"]')).toBeNull();
    expect(q('[data-testid="centro-instancias"]')).not.toBeNull();
    expect(q('[data-testid="centro-dispositivos"]')).not.toBeNull();
  });

  it('Dispositivos: contextos, bots aparte y los tipos más frecuentes en orden', () => {
    responder();
    const cifras = q('[data-testid="centro-dispositivos"]')!.textContent!;
    expect(cifras).toContain('200');
    expect(cifras).toMatch(/Bots \(aparte\)\s*12/);
    const texto2 = texto();
    expect(texto2.indexOf('Escritorio')).toBeLessThan(texto2.indexOf('Móvil'));
    expect(texto2).toContain('Sin informar');
    expect(texto2).not.toContain('UNSPECIFIED');
  });

  it('Dispositivos: sin contextos lo dice en vez de mostrar ceros', () => {
    responder(
      vidaSimulada(AHORA),
      herramientasSimuladas(AHORA),
      dispositivos({ totals: { contexts: 0, bots: 0 }, byDeviceType: [], lastContextAt: null }),
    );
    expect(q('[data-testid="centro-dispositivos"]')).toBeNull();
    expect(q('[data-testid="centro-dispositivos-vacio"]')!.textContent).toContain(
      'Todavía no hay contextos',
    );
  });

  it('la puerta «Instancias y herramientas» aparece en «Uso y rendimiento» cuando la sesión puede abrirla', () => {
    responder();
    const enlaces = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-testid="platform-home-portales"] a',
      ),
    );
    const destino = enlaces.find((a) => a.textContent?.trim() === 'Instancias y herramientas');
    expect(destino?.getAttribute('href')).toBe('/superadmin/instances');
  });
});
