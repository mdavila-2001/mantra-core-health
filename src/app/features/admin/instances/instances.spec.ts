import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import type { DevicesBreakdown } from '../../../core/data-access/admin-portal/analytics-devices.types';
import type {
  InstancesLiveness,
  LivenessInstance,
} from '../../../core/data-access/admin-portal/ops-liveness.types';
import type { OpsToolsOverview } from '../../../core/data-access/admin-portal/ops-tools.types';
import { herramientasSimuladas } from '../../../core/mock/handlers/ops-tools.handlers';
import { vidaSimulada } from '../../../core/mock/handlers/ops-liveness.handlers';
import { Instances } from './instances';

/* Los datos de estas pruebas son los del simulador (sintéticos y declarados) o
   están armados a mano para un caso límite. Ninguno es una medición. */

const AHORA = new Date('2026-10-30T12:00:00.000Z');
const VENTANA = {
  from: '2026-10-23T12:00:00.000Z',
  to: '2026-10-30T12:00:00.000Z',
  interval: 'day' as const,
  timezone: 'UTC' as const,
  portal: null,
};

function dispositivos(sobrescribir: Partial<DevicesBreakdown> = {}): DevicesBreakdown {
  return {
    window: VENTANA,
    totals: { contexts: 200, bots: 12 },
    byDeviceType: [
      { code: 'DESKTOP', label: 'Escritorio', contexts: 120 },
      { code: 'MOBILE', label: 'Móvil', contexts: 70 },
      { code: 'UNSPECIFIED', label: 'UNSPECIFIED', contexts: 10 },
    ],
    byOsFamily: [{ code: 'WINDOWS', label: 'Windows', contexts: 150 }],
    byBrowserFamily: [{ code: 'CHROME', label: 'Chrome', contexts: 180 }],
    byAppVersion: [{ code: '2.4.1', label: '2.4.1', contexts: 50 }],
    lastContextAt: '2026-10-30T11:58:00.000Z',
    notMeasured: [{ metric: 'botsExcluded', reason: 'Los bots se cuentan aparte.' }],
    ...sobrescribir,
  };
}

function vida(
  instances: readonly LivenessInstance[],
  overall: InstancesLiveness['overall'],
): InstancesLiveness {
  return { ...vidaSimulada(AHORA), overall, instances, notMeasured: [] };
}

function instancia(
  sobrescribir: Partial<LivenessInstance> & Pick<LivenessInstance, 'id' | 'state'>,
): LivenessInstance {
  return {
    type: 'worker',
    required: true,
    lastHeartbeatAt: null,
    ageSeconds: null,
    thresholdSeconds: 60,
    cause: null,
    evidence: 'SIMULADO · prueba',
    ...sobrescribir,
  };
}

describe('Instances (Instancias y herramientas)', () => {
  let fixture: ComponentFixture<Instances>;
  let http: HttpTestingController;

  const esVida = (r: { url: string }) => r.url === '/admin/ops/instances/liveness';
  const esHerramientas = (r: { url: string }) => r.url === '/admin/ops/tools';
  const esDispositivos = (r: { url: string }) => r.url === '/admin/analytics/devices';
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const q = <T extends Element>(selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  const yo = () =>
    fixture.componentInstance as unknown as Record<string, { set(v: unknown): void }> & {
      cambiarPortal(p: string | null): void;
      cambiarRango(r: string): void;
    };

  async function crear(pestana?: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Instances],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...(pestana
          ? [
              {
                provide: ActivatedRoute,
                useValue: { snapshot: { queryParamMap: convertToParamMap({ pestana }) } },
              },
            ]
          : []),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Instances);
    fixture.detectChanges();
  }

  function responder(
    v: InstancesLiveness = vidaSimulada(AHORA),
    h: OpsToolsOverview = herramientasSimuladas(AHORA),
    d: DevicesBreakdown = dispositivos(),
  ): void {
    http.expectOne(esVida).flush(v);
    http.expectOne(esHerramientas).flush(h);
    http.expectOne(esDispositivos).flush(d);
    fixture.detectChanges();
  }

  function abrirPestana(indice: number): void {
    yo()['pestana']!.set(indice);
    fixture.detectChanges();
  }

  afterEach(() => http.verify({ ignoreCancelled: true }));

  describe('pedidos', () => {
    beforeEach(() => crear());

    it('pide las tres lecturas por su cuenta; dispositivos con los últimos 7 días y sin portal', () => {
      const d = http.expectOne(esDispositivos);
      expect(d.request.params.get('portal')).toBeNull();
      const desde = new Date(d.request.params.get('from')!).getTime();
      const hasta = new Date(d.request.params.get('to')!).getTime();
      expect(Math.round((hasta - desde) / 3_600_000)).toBe(7 * 24);
      http.expectOne(esVida).flush(vidaSimulada(AHORA));
      http.expectOne(esHerramientas).flush(herramientasSimuladas(AHORA));
      d.flush(dispositivos());
    });

    it('«Actualizar» vuelve a pedir las tres', () => {
      responder();
      (q('[data-testid="instances-refresh"]') as HTMLButtonElement).click();
      http.expectOne(esVida).flush(vidaSimulada(AHORA));
      http.expectOne(esHerramientas).flush(herramientasSimuladas(AHORA));
      http.expectOne(esDispositivos).flush(dispositivos());
    });

    it('un 403 en una lectura no apaga a las otras dos', () => {
      http.expectOne(esVida).flush(vidaSimulada(AHORA));
      http.expectOne(esHerramientas).flush(herramientasSimuladas(AHORA));
      http
        .expectOne(esDispositivos)
        .flush(
          { statusCode: 403, code: 'FORBIDDEN', message: 'x' },
          { status: 403, statusText: 'Forbidden' },
        );
      fixture.detectChanges();
      expect(q('[data-testid="instances-overall"]')).not.toBeNull();
      abrirPestana(2);
      expect(q('[data-testid="devices-totals"]')).toBeNull();
      expect(texto()).not.toContain('Contextos de cliente');
    });

    it('un error en la sonda no deja un estado general a la vista', () => {
      http
        .expectOne(esVida)
        .flush(
          { statusCode: 500, code: 'INTERNAL', message: 'x' },
          { status: 500, statusText: 'Internal Server Error' },
        );
      http.expectOne(esHerramientas).flush(herramientasSimuladas(AHORA));
      http.expectOne(esDispositivos).flush(dispositivos());
      fixture.detectChanges();
      expect(q('[data-testid="instances-overall"]')).toBeNull();
      expect(q('[data-testid="instances-table"]')).toBeNull();
      expect(texto()).not.toMatch(/Todas las instancias requeridas/);
    });
  });

  describe('pestaña Instancias', () => {
    beforeEach(() => crear());

    it('muestra los cuatro estados con su palabra, lo más grave primero', () => {
      responder();
      const tabla = q('[data-testid="instances-table"]')!.textContent!;
      for (const palabra of ['Caída', 'Degradada', 'Sin dato', 'Viva'])
        expect(tabla).toContain(palabra);
      expect(tabla.indexOf('worker-workflow')).toBeLessThan(tabla.indexOf('worker-scheduling'));
      expect(tabla.indexOf('worker-scheduling')).toBeLessThan(tabla.indexOf('worker-messaging'));
      // El sin dato cuenta como «Nunca», no como una edad.
      expect(tabla).toContain('Nunca');
      expect(tabla).toContain('hace 3 min 34 s');
      expect(tabla).toContain('Latido vencido');
      expect(tabla).toContain('Opcional');
    });

    it('con una requerida caída el aviso es de error y nombra el significado de «caída»', () => {
      responder();
      expect(q('[data-testid="instances-overall"]')!.getAttribute('data-estado')).toBe('CAIDA');
      expect(q('[data-testid="instances-overall"]')!.textContent).toContain('Caída');
      const aviso = q('[data-testid="instances-overall-alert"]')!.textContent!;
      expect(aviso).toContain('Hay instancias requeridas caídas');
      expect(aviso).toContain('no que se haya observado el proceso detenido');
    });

    it('sin evidencia dice «sin dato» y jamás «todo bien» ni «viva»', () => {
      responder(
        vida(
          [
            instancia({ id: 'worker-a', state: 'SIN_DATO', cause: 'NEVER_SEEN' }),
            instancia({ id: 'worker-b', state: 'SIN_DATO', cause: 'STORE_UNAVAILABLE' }),
          ],
          'SIN_DATO',
        ),
      );
      expect(q('[data-testid="instances-overall"]')!.textContent).toContain('Sin dato');
      expect(q('[data-testid="instances-overall-alert"]')!.textContent).toContain(
        'Sin datos: no se sabe si las instancias viven',
      );
      expect(texto()).not.toContain('Todas las instancias requeridas');
      const conteos = q('[data-testid="instances-counts"]')!.textContent!;
      expect(conteos).toMatch(/Vivas\s*0/);
      expect(q('[data-testid="instances-table"]')!.textContent).toContain(
        'No se pudo leer el registro de latidos',
      );
    });

    it('«viva» sólo cuando todas las requeridas lo están, y aun así aclara qué significa', () => {
      responder(
        vida(
          [
            instancia({
              id: 'worker-a',
              state: 'VIVA',
              ageSeconds: 4,
              lastHeartbeatAt: AHORA.toISOString(),
            }),
            instancia({
              id: 'worker-opcional',
              state: 'SIN_DATO',
              required: false,
              cause: 'NEVER_SEEN',
            }),
          ],
          'VIVA',
        ),
      );
      const aviso = q('[data-testid="instances-overall-alert"]')!.textContent!;
      expect(aviso).toContain('Todas las instancias requeridas tienen evidencia fresca');
      expect(aviso).toContain('No garantiza que todo funcione');
    });

    it('declara los umbrales que usa el servidor y lo que no se mide', () => {
      responder();
      const umbrales = q('[data-testid="instances-thresholds"]')!.textContent!;
      expect(umbrales).toContain('cada 15 s');
      expect(umbrales).toContain('30 s');
      expect(umbrales).toContain('60 s');
      expect(q('[data-testid="instances-not-measured"]')!.textContent).toContain('minio');
      expect(q('[data-testid="instances-evaluated"]')!.textContent).toContain('reloj de la API');
    });

    it('un código de causa que la pantalla no conoce se muestra tal cual', () => {
      responder(
        vida(
          [
            instancia({
              id: 'worker-a',
              state: 'DEGRADADA',
              cause: 'CAUSA_NUEVA_DEL_SERVIDOR',
              ageSeconds: 40,
            }),
          ],
          'DEGRADADA',
        ),
      );
      expect(q('[data-testid="instances-table"]')!.textContent).toContain(
        'CAUSA_NUEVA_DEL_SERVIDOR',
      );
    });

    it('filtra por estado y por tipo; sin coincidencias lo dice y ofrece quitar los filtros', () => {
      responder();
      yo()['estado']!.set('CAIDA');
      fixture.detectChanges();
      const tabla = q('[data-testid="instances-table"]')!.textContent!;
      expect(tabla).toContain('worker-workflow');
      expect(tabla).not.toContain('worker-messaging');

      yo()['tipo']!.set('database');
      fixture.detectChanges();
      expect(texto()).toContain('Ninguna instancia coincide con los filtros elegidos.');
      expect(texto()).toContain('Quitar filtros');

      yo()['estado']!.set(null);
      fixture.detectChanges();
      const bases = q('[data-testid="instances-table"]')!.textContent!;
      expect(bases).toContain('postgresql');
      expect(bases).not.toContain('worker-messaging');
    });

    it('sin ninguna instancia declarada no pinta ceros contentos: dice que no hay nada que evaluar', () => {
      responder(vida([], 'SIN_DATO'));
      expect(texto()).toContain('no hay nada que evaluar, y eso no significa que todo esté bien');
    });
  });

  describe('pestaña Herramientas', () => {
    beforeEach(async () => {
      await crear();
      responder();
      abrirPestana(1);
    });

    const tabla = () => q('[data-testid="tools-table"]')!.textContent!;

    it('las críticas van primero y cada salud dice cómo se comprobó', () => {
      const t = tabla();
      // Crítica que no responde ... antes que una no crítica.
      expect(t.indexOf('SIAT')).toBeLessThan(t.indexOf('OpenSearch'));
      expect(t.indexOf('PostgreSQL')).toBeLessThan(t.indexOf('OpenSearch'));
      expect(t).toContain('Responde');
      expect(t).toContain('No responde');
      expect(t).toContain('Sonda en vivo');
      expect(t).toContain('Sólo revisa la configuración');
    });

    it('«Configurada» no se confunde con «Responde»: sólo la sonda en vivo gana el verde', () => {
      const t = tabla();
      expect(t).toContain('Configurada (no probada)');
      expect(t).toContain('Configuración incompleta');
      expect(t).toContain('Sin sondear');
      // Correo de Google: OK por configuración → no figura como «Responde».
      const fila = t.split('▼').find((f) => f.includes('Correo de Google'))!;
      expect(fila).toContain('Configurada (no probada)');
      expect(fila).not.toContain('Responde');
    });

    it('muestra las variables que faltan por NOMBRE, nunca un valor', () => {
      const t = tabla();
      expect(t).toContain('SIAT_NIT');
      expect(t).toContain('VAPID_PRIVATE_KEY');
      expect(t).not.toMatch(/=|https?:\/\//);
    });

    it('avisa que no todas las críticas están comprobadas, y cuenta lo que no se sondeó', () => {
      const aviso = q('[data-testid="tools-critical-alert"]')!.textContent!;
      expect(aviso).toContain('Sólo');
      expect(aviso).toContain('sonda en vivo');
      expect(q('[data-testid="tools-counts"]')!.textContent).toContain('Sin sondear');
    });

    it('filtra por criticidad y por salud', () => {
      yo()['criticidad']!.set('no-criticas');
      fixture.detectChanges();
      expect(tabla()).toContain('OpenSearch');
      expect(tabla()).not.toContain('PostgreSQL');

      yo()['criticidad']!.set('todas');
      yo()['salud']!.set('Configuración incompleta');
      fixture.detectChanges();
      expect(tabla()).toContain('SIAT');
      expect(tabla()).not.toContain('PostgreSQL');

      yo()['salud']!.set('Responde');
      yo()['criticidad']!.set('no-criticas');
      fixture.detectChanges();
      expect(texto()).toContain('Ninguna herramienta coincide con los filtros elegidos.');
    });

    it('declara lo que no mide', () => {
      expect(q('[data-testid="tools-not-measured"]')!.textContent).toContain(
        'no se envió ningún correo de prueba',
      );
    });
  });

  describe('pestaña Dispositivos', () => {
    beforeEach(async () => {
      await crear();
      responder();
      abrirPestana(2);
    });

    it('muestra la cifra escrita en cada barra, su parte del total y «Sin informar»', () => {
      const tipo = q('[data-testid="devices-tipo"]')!.textContent!;
      expect(tipo).toContain('Escritorio');
      expect(tipo).toContain('120 · 60 %');
      expect(tipo).toContain('Sin informar');
      expect(tipo).not.toContain('UNSPECIFIED');
      for (const id of ['so', 'navegador', 'version'])
        expect(q(`[data-testid="devices-${id}"]`)).not.toBeNull();
      expect(q('[data-testid="devices-version"]')!.textContent).toContain('2.4.1');
    });

    it('los bots van aparte y no entran en los desgloses', () => {
      expect(q('[data-testid="devices-totals"]')!.textContent).toMatch(/Bots \(aparte\)\s*12/);
      expect(q('[data-testid="devices-tipo"]')!.textContent).not.toMatch(/[Bb]ot/);
    });

    it('cambiar de portal o de ventana vuelve a pedir con ese parámetro', () => {
      yo().cambiarPortal('MOBILE');
      const m = http.expectOne(esDispositivos);
      expect(m.request.params.get('portal')).toBe('MOBILE');
      m.flush(dispositivos({ window: { ...VENTANA, portal: 'MOBILE' } }));

      yo().cambiarRango('30d');
      const r = http.expectOne(esDispositivos);
      const dias =
        (new Date(r.request.params.get('to')!).getTime() -
          new Date(r.request.params.get('from')!).getTime()) /
        86_400_000;
      expect(Math.round(dias)).toBe(30);
      expect(r.request.params.get('portal')).toBe('MOBILE');
      r.flush(dispositivos());
    });

    it('sin contextos en la ventana lo dice y no dibuja barras', () => {
      yo().cambiarRango('24h');
      http
        .expectOne(esDispositivos)
        .flush(
          dispositivos({
            totals: { contexts: 0, bots: 0 },
            byDeviceType: [],
            byOsFamily: [],
            byBrowserFamily: [],
            byAppVersion: [],
            lastContextAt: null,
          }),
        );
      fixture.detectChanges();
      expect(texto()).toContain('Todavía no hay contextos de cliente medidos en esta ventana.');
      expect(q('[data-testid="devices-tipo"]')).toBeNull();
    });
  });

  it('`?pestana=1` abre directamente «Herramientas» (el enlace de la portada)', async () => {
    await crear('1');
    responder();
    expect(q('[data-testid="tools-table"]')).not.toBeNull();
  });

  it('un `?pestana` inválido cae en la primera pestaña', async () => {
    await crear('9');
    responder();
    expect(q('[data-testid="instances-table"]')).not.toBeNull();
  });
});
