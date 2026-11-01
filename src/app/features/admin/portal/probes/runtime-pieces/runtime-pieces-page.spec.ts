import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it } from 'vitest';

import type {
  DiscoveryReport,
  RuntimeFinding,
  RuntimeInstance,
  RuntimePiece,
  RuntimePiecesPage as Respuesta,
} from '../../../../../core/data-access/admin-portal/runtime-pieces.types';
import {
  PIECE_KINDS,
  PIECE_STATES,
} from '../../../../../core/data-access/admin-portal/runtime-pieces.types';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { PORTAL_RUNTIME_PIECES_ROUTES } from './runtime-pieces.routes';
import { RuntimePiecesPage } from './runtime-pieces-page';

const PANTALLA = '/superadmin/portal/systems/runtime-pieces';
const LISTA = '/admin/ops/runtime-pieces';

const pieza = (over: Partial<RuntimePiece> = {}): RuntimePiece => ({
  id: 'rtp.job.messaging.outbox-relay',
  kind: 'JOB_PROGRAMADO',
  name: 'messaging/outbox-relay',
  module: 'messaging',
  hosts: ['worker-messaging'],
  state: 'VIVA',
  cause: 'HOST_ALIVE',
  causeDetail: 'vive en worker-messaging: latido fresco hace 5 s',
  evidenceLevel: 'ANFITRION',
  instanceState: 'VIVA',
  inCode: true,
  wired: true,
  required: true,
  evidence: { file: 'src/worker/jobs/messaging/outbox-relay.job.ts', line: 49 },
  schedule: { type: 'interval', intervalMs: 5000, cron: null, raw: 'RELAY_INTERVAL_MS' },
  enable: {
    how: 'dentro de worker-messaging; sin interruptor propio',
    envVars: ['MESSAGING_QUEUE_CODES'],
    launchers: [],
  },
  heartbeat: { mode: 'INHERITED', instanceId: 'worker-messaging' },
  attributes: {},
  registry: {
    present: true,
    active: true,
    provenance: {
      source: 'descubrimiento-estatico',
      evidence: 'src/x.ts:1',
      discoveredAt: '2026-10-30',
      fingerprint: 'abc',
      kind: 'JOB_PROGRAMADO',
      heartbeat: 'INHERITED:worker-messaging',
    },
    stale: false,
  },
  ...over,
});

const instancia = (over: Partial<RuntimeInstance> = {}): RuntimeInstance => ({
  id: 'worker-billing',
  label: 'Facturación',
  type: 'WORKER',
  required: true,
  state: 'CAIDA',
  cause: 'HEARTBEAT_EXPIRED',
  causeDetail: 'sin latido desde hace 300 s (umbral 60 s)',
  lastHeartbeatAt: '2026-10-31T11:55:00.000Z',
  ageSeconds: 300,
  startedAt: null,
  reportedStatus: 'running',
  pieceCount: 3,
  piecesByKind: { PROCESO: 1, JOB_PROGRAMADO: 2 },
  ...over,
});

const hallazgo = (over: Partial<RuntimeFinding> = {}): RuntimeFinding => ({
  id: 'SIN_LATIDO_REQUERIDA:rtp.proceso.worker-billing',
  rule: 'SIN_LATIDO_REQUERIDA',
  severity: 'ALTA',
  pieceId: 'rtp.proceso.worker-billing',
  message: 'Worker billing es requerida y no se oye.',
  ...over,
});

function respuesta(over: Partial<Respuesta> = {}): Respuesta {
  const data = over.data ?? [
    pieza(),
    pieza({
      id: 'rtp.proceso.worker-billing',
      kind: 'PROCESO',
      name: 'Worker billing',
      state: 'SIN_LATIDO',
      cause: 'HEARTBEAT_EXPIRED',
      causeDetail: 'sin latido desde hace 300 s',
      evidenceLevel: 'NINGUNO',
      schedule: null,
    }),
    pieza({
      id: 'rtp.job.nueva',
      name: 'x/nueva',
      state: 'NO_REGISTRADA',
      cause: 'NOT_IN_REGISTRY',
      evidenceLevel: 'NINGUNO',
      registry: { present: false, active: null, provenance: null, stale: null },
    }),
  ];
  const byState = Object.fromEntries(
    PIECE_STATES.map((e) => [e, data.filter((p) => p.state === e).length]),
  ) as Respuesta['summary']['byState'];
  const byKind = Object.fromEntries(
    PIECE_KINDS.map((k) => [k, data.filter((p) => p.kind === k).length]),
  ) as Respuesta['summary']['byKind'];
  return {
    data,
    meta: { page: 1, pageSize: 25, total: data.length, totalPages: 1 },
    evaluatedAt: new Date().toISOString(),
    summary: { total: data.length, byState, byKind },
    scan: {
      available: true,
      source: 'live',
      generatedAt: null,
      reason: null,
      filesRead: 100,
      warnings: [],
    },
    heartbeatStore: { status: 'up', reason: null },
    thresholds: {
      workerHeartbeatIntervalSeconds: 15,
      degradedAfterSeconds: 30,
      downAfterSeconds: 60,
    },
    instances: [instancia()],
    findings: [hallazgo()],
    notMeasured: ['REPLICAS: varias réplicas de un mismo worker no se distinguen'],
    ...over,
  };
}

const informe = (over: Partial<DiscoveryReport> = {}): DiscoveryReport => ({
  dryRun: true,
  discoveredAt: '2026-10-31',
  scanned: 3,
  created: 1,
  updated: 0,
  unchanged: 2,
  orphans: 0,
  conflicts: 0,
  createdIds: ['rtp.job.nueva'],
  updatedIds: [],
  orphanIds: [],
  conflictIds: [],
  warnings: [],
  ...over,
});

describe('la ruta de las piezas en ejecución', () => {
  it('está declarada con su dirección y su título', () => {
    expect(PORTAL_RUNTIME_PIECES_ROUTES).toHaveLength(1);
    expect(PORTAL_RUNTIME_PIECES_ROUTES[0].path).toBe('systems/runtime-pieces');
    expect(String(PORTAL_RUNTIME_PIECES_ROUTES[0].title)).toContain('Piezas en ejecución');
  });
});

describe('RuntimePiecesPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmar = true;
  let preguntas = 0;

  async function abrir(url = PANTALLA): Promise<void> {
    confirmar = true;
    preguntas = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'superadmin/portal/systems/runtime-pieces', component: RuntimePiecesPage },
        ]),
        {
          provide: DialogService,
          useValue: {
            confirm: () => {
              preguntas += 1;
              return Promise.resolve(confirmar);
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, RuntimePiecesPage);
  }

  const el = () => harness.routeNativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';
  const q = <T extends Element>(selector: string) => el().querySelector<T>(selector);
  const lista = () => http.expectOne((r) => r.url === LISTA);
  const descubrir = () => http.expectOne((r) => r.url === `${LISTA}/discover`);
  const componente = () =>
    harness.routeDebugElement!.componentInstance as unknown as {
      irAPagina(c: string): void;
      elegirPestana(i: number): void;
    };
  const responderLista = (r: Respuesta = respuesta()): void => {
    lista().flush(r);
    harness.detectChanges();
  };
  const boton = (id: string) => q<HTMLButtonElement>(`[data-testid="${id}"]`)!;
  const pulsar = async (id: string) => {
    boton(id).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
  };

  afterEach(() => http.verify());

  it('pide la primera página con GET y sin más filtros que la paginación', async () => {
    await abrir();
    const req = lista();
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize']);
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush(respuesta());
  });

  it('mientras llega el dato no pinta cifras (S2)', async () => {
    await abrir();
    harness.detectChanges();
    expect(q('[data-testid="rp-summary"]')).toBeNull();
    lista().flush(respuesta());
  });

  it('muestra el conteo por estado, la antigüedad y cada pieza con su evidencia y su causa', async () => {
    await abrir();
    responderLista();
    for (const estado of PIECE_STATES)
      expect(q(`[data-testid="rp-count-${estado}"]`)).not.toBeNull();
    expect(q('[data-testid="rp-count-VIVA"]')!.textContent).toContain('Viva: 1');
    expect(q('[data-testid="rp-count-NO_REGISTRADA"]')!.textContent).toContain('No registrada: 1');
    expect(q('[data-testid="rp-evaluated"]')!.textContent).toContain('3 piezas en total');
    expect(q('[data-testid="rp-evaluated"]')!.textContent).toContain('hace 0 s');
    const tabla = q('[data-testid="rp-pieces-table"]')!.textContent!;
    expect(tabla).toContain('messaging/outbox-relay');
    expect(tabla).toContain('src/worker/jobs/messaging/outbox-relay.job.ts:49');
    expect(tabla).toContain('cada 5 s');
    expect(tabla).toContain('Corre en worker-messaging');
    expect(tabla).toContain('Variables: MESSAGING_QUEUE_CODES');
    expect(tabla).toContain('Sólo se ve su proceso anfitrión');
    expect(tabla).toContain('Fuera del registro');
  });

  it('cada estado es un chip con texto; «sin latido» y «no registrada» no se confunden', async () => {
    await abrir();
    responderLista();
    const tabla = q('[data-testid="rp-pieces-table"]')!.textContent!;
    for (const chip of ['Viva', 'Sin latido', 'No registrada']) expect(tabla).toContain(chip);
    expect(tabla).toContain('Existe en el código y no está en el registro de herramientas.');
  });

  it('dice de dónde se leyó el código: en vivo, o el manifiesto que se generó al compilar', async () => {
    await abrir();
    responderLista();
    expect(q('[data-testid="rp-source"]')!.textContent).toContain(
      'código fuente leído en el momento',
    );
  });

  it('con el manifiesto de compilación lo dice con su fecha, para que no se lea como el código de hoy', async () => {
    await abrir();
    responderLista(
      respuesta({
        scan: {
          available: true,
          source: 'manifest',
          generatedAt: '2026-10-30T12:00:00.000Z',
          reason: null,
          filesRead: 100,
          warnings: [],
        },
      }),
    );
    const fuente = q('[data-testid="rp-source"]')!.textContent!;
    expect(fuente).toContain('manifiesto generado al compilar');
    expect(fuente).toContain('30/10/2026');
  });

  it('lo que no se mide se declara aparte, con su texto y sin el código', async () => {
    await abrir();
    responderLista();
    const aviso = q('[data-testid="rp-not-measured"]')!.textContent!;
    expect(aviso).toContain('varias réplicas de un mismo worker no se distinguen');
    expect(aviso).not.toContain('REPLICAS:');
  });

  it('descarta de la URL lo que la API rechazaría y manda lo válido', async () => {
    await abrir(
      `${PANTALLA}?state=SIN_LATIDO&kind=NADA&q=outbox&host=worker-a&withFindings=true&page=2`,
    );
    const req = lista();
    expect(req.request.params.get('state')).toBe('SIN_LATIDO');
    expect(req.request.params.has('kind')).toBe(false);
    expect(req.request.params.get('q')).toBe('outbox');
    expect(req.request.params.get('host')).toBe('worker-a');
    expect(req.request.params.get('withFindings')).toBe('true');
    expect(req.request.params.get('page')).toBe('2');
    req.flush(respuesta({ data: [] }));
  });

  it('con filtros y sin resultados el vacío dice por qué y ofrece quitarlos (S3)', async () => {
    await abrir(`${PANTALLA}?state=HUERFANA`);
    responderLista(respuesta({ data: [] }));
    expect(texto()).toContain('Ninguna pieza coincide con los filtros elegidos.');
    expect(texto()).toContain('Quitar los filtros');
  });

  it('sin código fuente lo dice y no pinta una tabla vacía muda', async () => {
    await abrir();
    responderLista(
      respuesta({
        data: [],
        scan: {
          available: false,
          source: 'live',
          generatedAt: null,
          reason: 'No hay código fuente (src/) en la raíz.',
          filesRead: 0,
          warnings: [],
        },
      }),
    );
    expect(q('[data-testid="rp-scan-unavailable"]')!.textContent).toContain(
      'no se puede detectar lo que falta en el registro ni lo que quedó huérfano',
    );
    expect(texto()).toContain(
      'Este despliegue no trae el código fuente, así que no hay piezas que descubrir aquí.',
    );
  });

  it('con el almacén de latidos caído lo explica: «sin latido» no es «caída»', async () => {
    await abrir();
    responderLista(respuesta({ heartbeatStore: { status: 'down', reason: 'STORE_UNAVAILABLE' } }));
    const aviso = q('[data-testid="rp-store-down"]')!.textContent!;
    expect(aviso).toContain('Redis');
    expect(aviso).toContain('STORE_UNAVAILABLE');
  });

  it('un dato más viejo que dos refrescos se declara atrasado (S7)', async () => {
    await abrir();
    responderLista(respuesta({ evaluatedAt: new Date(Date.now() - 5 * 60_000).toISOString() }));
    expect(texto()).toContain('Está viendo datos que pueden estar atrasados');
    expect(q('[data-testid="rp-evaluated"]')!.textContent).toContain('hace 5 min');
  });

  it('un error de la API no deja números ni tablas (S9) y permite reintentar', async () => {
    await abrir();
    lista().flush(
      { statusCode: 500, code: 'INTERNAL', message: 'x' },
      { status: 500, statusText: 'Internal Server Error' },
    );
    harness.detectChanges();
    expect(q('[data-testid="rp-summary"]')).toBeNull();
    expect(q('[data-testid="rp-pieces-table"]')).toBeNull();
  });

  it('los avisos del escáner (argumentos sin resolver) se muestran', async () => {
    await abrir();
    responderLista(
      respuesta({
        scan: {
          available: true,
          source: 'live',
          generatedAt: null,
          reason: null,
          filesRead: 10,
          warnings: ['src/x.ts:3: no se resolvió el argumento "foo" de @Interval'],
        },
      }),
    );
    expect(q('[data-testid="rp-scan-warnings"]')!.textContent).toContain(
      'no se resolvió el argumento "foo"',
    );
  });

  it('paginar cambia la página en la URL y vuelve a pedir esa página', async () => {
    await abrir();
    responderLista(respuesta({ meta: { page: 1, pageSize: 25, total: 60, totalPages: 3 } }));
    componente().irAPagina('2');
    await harness.fixture.whenStable();
    expect(lista().request.params.get('page')).toBe('2');
  });

  describe('pestañas', () => {
    it('Instancias: el estado es el de la sonda y dice qué aloja cada una', async () => {
      await abrir(`${PANTALLA}?vista=instancias`);
      responderLista();
      const tabla = q('[data-testid="rp-instances-table"]')!.textContent!;
      expect(tabla).toContain('Facturación');
      expect(tabla).toContain('Caída');
      expect(tabla).toContain('sin latido desde hace 300 s');
      expect(tabla).toContain('3 piezas');
      expect(tabla).toContain('Proceso: 1');
      expect(tabla).toContain('Tarea programada: 2');
      expect(q('[data-testid="rp-pieces-table"]')).toBeNull();
    });

    it('Hallazgos: gravedad, regla en palabras y el id de la pieza', async () => {
      await abrir(`${PANTALLA}?vista=hallazgos`);
      responderLista();
      const tabla = q('[data-testid="rp-findings-table"]')!.textContent!;
      expect(tabla).toContain('Alta');
      expect(tabla).toContain('Proceso requerido sin latido');
      expect(tabla).toContain('rtp.proceso.worker-billing');
    });

    it('Hallazgos sin ninguno no afirma «todo bien»: remite a lo que no se mide', async () => {
      await abrir(`${PANTALLA}?vista=hallazgos`);
      responderLista(respuesta({ findings: [] }));
      expect(texto()).toContain('Sin hallazgos');
      expect(texto()).toContain('No se mide');
    });

    it('«Ver la pieza» filtra la pestaña de piezas por esa pieza', async () => {
      await abrir(`${PANTALLA}?vista=hallazgos`);
      responderLista();
      await pulsar('rp-see-rtp.proceso.worker-billing');
      const req = lista();
      expect(req.request.params.get('q')).toBe('rtp.proceso.worker-billing');
      req.flush(respuesta());
    });

    it('cambiar de pestaña no vuelve a pedir el listado, y se ve en la dirección', async () => {
      await abrir();
      responderLista();
      expect(q('[data-testid="rp-instances-table"]')).toBeNull();
      componente().elegirPestana(1);
      await harness.fixture.whenStable();
      harness.detectChanges();
      http.expectNone((r) => r.url === LISTA);
      expect(q('[data-testid="rp-instances-table"]')).not.toBeNull();
      expect(TestBed.inject(Router).url).toContain('vista=instancias');
    });
  });

  describe('descubrir', () => {
    it('simular pide dryRun, cuenta lo que haría y no recarga nada', async () => {
      await abrir();
      responderLista();
      await pulsar('rp-simulate');
      const req = descubrir();
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ dryRun: true });
      req.flush(informe());
      harness.detectChanges();
      expect(preguntas).toBe(0);
      expect(q('[data-testid="rp-notice"]')!.textContent).toContain(
        'Simulación, no se escribió nada',
      );
      http.expectNone((r) => r.url === LISTA);
    });

    it('descubrir y registrar pide confirmación; si se cancela no se manda nada', async () => {
      await abrir();
      responderLista();
      confirmar = false;
      await pulsar('rp-discover');
      expect(preguntas).toBe(1);
      http.expectNone((r) => r.url === `${LISTA}/discover`);
    });

    it('confirmado, escribe, cuenta lo que cambió y vuelve a leer el listado', async () => {
      await abrir();
      responderLista();
      await pulsar('rp-discover');
      const req = descubrir();
      expect(req.request.body).toEqual({ dryRun: false });
      req.flush(informe({ dryRun: false, created: 1 }));
      harness.detectChanges();
      expect(q('[data-testid="rp-notice"]')!.textContent).toContain('Se registraron 1 pieza');
      responderLista(respuesta());
    });

    it('mientras corre no se puede lanzar otra vez (sin doble envío)', async () => {
      await abrir();
      responderLista();
      await pulsar('rp-simulate');
      harness.detectChanges();
      expect(boton('rp-simulate').getAttribute('aria-disabled')).toBe('true');
      expect(boton('rp-discover').getAttribute('aria-disabled')).toBe('true');
      boton('rp-simulate').click();
      boton('rp-discover').click();
      await harness.fixture.whenStable();
      descubrir().flush(informe());
      harness.detectChanges();
      expect(boton('rp-simulate').getAttribute('aria-disabled')).toBe('false');
    });

    it('un 403 se explica con palabras y no se muestra el cuerpo del servidor', async () => {
      await abrir();
      responderLista();
      await pulsar('rp-simulate');
      descubrir().flush(
        { statusCode: 403, code: 'FORBIDDEN', message: 'detalle interno' },
        { status: 403, statusText: 'Forbidden' },
      );
      harness.detectChanges();
      const aviso = q('[data-testid="rp-notice"]')!.textContent!;
      expect(aviso).toContain('no registrarlas');
      expect(aviso).not.toContain('detalle interno');
    });

    it('sin código fuente en el despliegue (409) lo dice', async () => {
      await abrir();
      responderLista();
      await pulsar('rp-simulate');
      descubrir().flush(
        {
          statusCode: 409,
          code: 'CONFLICT',
          reason: 'RUNTIME_PIECES_SOURCE_UNAVAILABLE',
          message: 'x',
        },
        { status: 409, statusText: 'Conflict' },
      );
      harness.detectChanges();
      expect(q('[data-testid="rp-notice"]')!.textContent).toContain('no trae el código fuente');
    });
  });
});
