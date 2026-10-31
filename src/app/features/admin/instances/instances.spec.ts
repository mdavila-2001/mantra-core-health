import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Instance, InstanceLiveness } from '../../../core/data-access/admin-portal/ops-liveness.types';
import type { OpsTools, Tool } from '../../../core/data-access/admin-portal/ops-tools.types';
import { Instances, INTERVALO_DE_REFRESCO_MS } from './instances';
import { estadoVivo, haceCuanto, queDice } from './instances-labels';

const AHORA = new Date('2026-10-31T12:00:00.000Z');

function instancia(sobrescribir: Partial<Instance> = {}): Instance {
  return {
    id: 'worker-messaging',
    label: 'Mensajería',
    type: 'WORKER',
    required: true,
    state: 'VIVA',
    lastHeartbeatAt: '2026-10-31T11:59:55.000Z',
    ageSeconds: 5,
    thresholdSeconds: 60,
    cause: 'OK',
    causeDetail: 'Último latido hace 5 s.',
    evidence: { source: 'heartbeat', reportedStatus: 'running', startedAt: '2026-10-31T08:00:00.000Z', latencyMs: null },
    ...sobrescribir,
  };
}

function sonda(sobrescribir: Partial<InstanceLiveness> = {}): InstanceLiveness {
  const instances = sobrescribir.instances ?? [
    instancia(),
    instancia({ id: 'worker-billing', label: 'Facturación', state: 'DEGRADADA', ageSeconds: 42, cause: 'HEARTBEAT_LATE', causeDetail: 'Llegó tarde.' }),
    instancia({ id: 'worker-notifications', label: 'Notificaciones', state: 'CAIDA', ageSeconds: 1380, cause: 'HEARTBEAT_EXPIRED', causeDetail: 'Venció hace 23 min.' }),
    instancia({ id: 'clamav', label: 'ClamAV', type: 'SERVICE', required: false, state: 'SIN_DATO', lastHeartbeatAt: null, ageSeconds: null, thresholdSeconds: null, cause: 'NOT_PROBED', causeDetail: 'No se sondea.', evidence: { source: 'none', reportedStatus: null, startedAt: null, latencyMs: null } }),
  ];
  return {
    modelVersion: 'instance-liveness/v1',
    evaluatedAt: AHORA.toISOString(),
    overall: 'CRITICO',
    summary: { VIVA: 1, DEGRADADA: 1, CAIDA: 1, SIN_DATO: 1, total: 4 },
    heartbeatStore: { status: 'up', reason: null },
    thresholds: { workerHeartbeatIntervalSeconds: 15, degradedAfterSeconds: 30, downAfterSeconds: 60, dependencyLatencyDegradedMs: 1000, dependencyProbeTimeoutMs: 3000, clockToleranceSeconds: 5 },
    notMeasured: ['replicasOfApi', 'processInternals'],
    ...sobrescribir,
    instances,
  };
}

function herramienta(sobrescribir: Partial<Tool> = {}): Tool {
  return {
    code: 'postgresql',
    name: 'PostgreSQL',
    kind: 'DATABASE',
    provider: 'PostgreSQL 16',
    purpose: 'Base principal.',
    isCritical: true,
    status: 'ACTIVE',
    binding: 'real',
    isConfigured: true,
    missingEnvVars: [],
    requiredEnvVars: ['DATABASE_URL'],
    checkType: 'LIVE',
    isHealthy: true,
    healthMessage: 'SELECT 1 respondió en 4 ms.',
    latencyMs: 4,
    checkedAt: AHORA.toISOString(),
    ownerTeam: 'plataforma',
    failureImpact: 'Nada funciona.',
    fallback: 'Ninguno.',
    ...sobrescribir,
  };
}

function herramientas(tools: readonly Tool[] = [
  herramienta(),
  herramienta({ code: 'smtp', name: 'Correo saliente', kind: 'MAIL', isHealthy: false, healthMessage: 'Conexión rechazada.', failureImpact: 'Nadie recibe correos.' }),
  herramienta({ code: 'opensearch', name: 'OpenSearch', kind: 'SEARCH', isCritical: false, isHealthy: false, healthMessage: 'Devolvió 503.', fallback: 'SQL.' }),
  herramienta({ code: 'openai', name: 'OpenAI', kind: 'AI', isCritical: false, checkType: 'CONFIGURATION', isHealthy: null, isConfigured: false, missingEnvVars: ['OPENAI_API_KEY'], healthMessage: 'Falta la clave.', binding: 'mock' }),
  herramienta({ code: 'ga4', name: 'Google Analytics 4', kind: 'ANALYTICS', isCritical: false, status: 'PLANNED', checkType: 'NOT_APPLICABLE', isHealthy: null, healthMessage: 'Planeada.', binding: 'none' }),
]): OpsTools {
  return {
    modelVersion: 'ops-tools/v1',
    evaluatedAt: AHORA.toISOString(),
    summary: {
      total: tools.length,
      healthy: tools.filter((t) => t.isHealthy === true).length,
      down: tools.filter((t) => t.isHealthy === false).length,
      noProbe: tools.filter((t) => t.isHealthy === null && t.checkType !== 'NOT_APPLICABLE').length,
      notApplicable: tools.filter((t) => t.isHealthy === null && t.checkType === 'NOT_APPLICABLE').length,
      critical: tools.filter((t) => t.isCritical).length,
    },
    tools,
  };
}

describe('etiquetas de instancias y herramientas (funciones puras)', () => {
  it('el estado vivo sale sólo de isHealthy y checkType, nunca de status', () => {
    expect(estadoVivo({ isHealthy: true, checkType: 'LIVE' })).toBe('UP');
    expect(estadoVivo({ isHealthy: false, checkType: 'LIVE' })).toBe('DOWN');
    expect(estadoVivo({ isHealthy: null, checkType: 'NOT_APPLICABLE' })).toBe('NOT_APPLICABLE');
    expect(estadoVivo({ isHealthy: null, checkType: 'CONFIGURATION' })).toBe('NO_PROBE');
    expect(estadoVivo({ isHealthy: null, checkType: 'LIVE' })).toBe('NO_PROBE');
  });

  it('«Qué dice» agrega las variables que faltan al mensaje íntegro', () => {
    expect(queDice({ healthMessage: 'Falta la clave.', missingEnvVars: ['A', 'B'] })).toBe('Falta la clave. Faltan: A, B.');
    expect(queDice({ healthMessage: 'Todo bien.', missingEnvVars: [] })).toBe('Todo bien.');
  });

  it('la antigüedad se dice en palabras', () => {
    expect(haceCuanto(null)).toBe('nunca');
    expect(haceCuanto(5)).toBe('hace 5 s');
    expect(haceCuanto(1380)).toBe('hace 23 min');
    expect(haceCuanto(7300)).toBe('hace 2 h');
  });
});

describe('Instances', () => {
  let fixture: ComponentFixture<Instances>;
  let http: HttpTestingController;

  const liveness = (r: { url: string }) => r.url === '/admin/ops/instances/liveness';
  const tools = (r: { url: string }) => r.url === '/admin/ops/tools';
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const q = <T extends Element>(selector: string) => (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  const qa = (selector: string) => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));
  const componente = () =>
    fixture.componentInstance as unknown as {
      pestana: { set(i: number): void };
      criticidad: { set(v: string): void };
      filtroVivo: { set(v: string): void };
    };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    await TestBed.configureTestingModule({
      imports: [Instances],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Instances);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.useRealTimers();
  });

  function responder(s: InstanceLiveness = sonda(), h: OpsTools = herramientas()): void {
    http.expectOne(liveness).flush(s);
    http.expectOne(tools).flush(h);
    fixture.detectChanges();
  }

  function abrirPestana(indice: number): void {
    componente().pestana.set(indice);
    fixture.detectChanges();
  }

  it('pide la sonda y las herramientas al abrir, con GET y sin parámetros', () => {
    const s = http.expectOne(liveness);
    expect(s.request.method).toBe('GET');
    const h = http.expectOne(tools);
    expect(h.request.method).toBe('GET');
    s.flush(sonda());
    h.flush(herramientas());
  });

  it('muestra el veredicto general, los contadores y la antigüedad del dato', () => {
    responder();
    expect(q('[data-testid="instances-overall"]')!.textContent).toContain('Crítico');
    expect(q('[data-testid="instances-count-viva"]')!.textContent).toContain('1 vivas');
    expect(q('[data-testid="instances-count-caida"]')!.textContent).toContain('1 caídas');
    expect(q('[data-testid="instances-count-sin-dato"]')!.textContent).toContain('1 sin dato');
    expect(q('[data-testid="instances-evaluated"]')!.textContent).toContain('hace 0 s');
  });

  it('con veredicto CRÍTICO muestra el banner con las caídas y su causa', () => {
    responder();
    const banner = q('[data-testid="instances-banner-critico"]')!.textContent!;
    expect(banner).toContain('Notificaciones');
    expect(banner).toContain('Venció hace 23 min.');
  });

  it('sin veredicto CRÍTICO no hay banner', () => {
    responder(sonda({ overall: 'ATENCION', instances: [instancia()] }));
    expect(q('[data-testid="instances-banner-critico"]')).toBeNull();
  });

  it('cada estado es un chip con texto, y la causa va en lenguaje llano', () => {
    responder();
    const tabla = q('[data-testid="instances-table"]')!.textContent!;
    for (const chip of ['Viva', 'Degradada', 'Caída', 'Sin dato']) expect(tabla).toContain(chip);
    expect(tabla).toContain('Hace demasiado que no late');
    expect(tabla).toContain('No se la sondea desde la API.');
    expect(tabla).toContain('sin latido');
  });

  it('con el almacén de latidos caído lo explica: «sin dato» no es «caída»', () => {
    responder(sonda({ heartbeatStore: { status: 'down', reason: 'STORE_UNAVAILABLE' } }));
    const aviso = q('[data-testid="instances-store-caido"]')!.textContent!;
    expect(aviso).toContain('Redis');
    expect(aviso).toContain('STORE_UNAVAILABLE');
  });

  it('lista lo que la sonda no mide, con nombre legible', () => {
    responder();
    const lista = q('[data-testid="instances-not-measured"]')!.textContent!;
    expect(lista).toContain('Réplicas de la API');
    expect(lista).toContain('Memoria, CPU y colas internas');
  });

  it('sin instancias registradas dice por qué, no pinta una tabla vacía', () => {
    responder(sonda({ instances: [] }));
    expect(q('[data-testid="instances-overall"]')).toBeNull();
    expect(texto()).toContain('La sonda no tiene instancias registradas que vigilar.');
  });

  it('un dato más viejo que dos refrescos se declara atrasado (S7) con su fecha', () => {
    responder(sonda({ evaluatedAt: new Date(AHORA.getTime() - 5 * 60_000).toISOString() }));
    expect(texto()).toContain('Está viendo datos que pueden estar atrasados');
    expect(q('[data-testid="instances-evaluated"]')!.textContent).toContain('hace 5 min');
  });

  it('un error de la API muestra el error con reintento y no deja números', () => {
    http.expectOne(liveness).flush({ statusCode: 500, code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Internal Server Error' });
    http.expectOne(tools).flush(herramientas());
    fixture.detectChanges();
    expect(q('[data-testid="instances-overall"]')).toBeNull();
    expect(q('[data-testid="instances-table"]')).toBeNull();
  });

  it('la pestaña de herramientas trae los contadores al estilo Atlas y el banner de caídas críticas', () => {
    responder();
    abrirPestana(1);
    expect(q('[data-testid="tools-count-up"]')!.textContent).toContain('1 operativas');
    expect(q('[data-testid="tools-count-down"]')!.textContent).toContain('2 caídas');
    expect(q('[data-testid="tools-count-no-probe"]')!.textContent).toContain('1 sin chequeo en vivo');
    expect(q('[data-testid="tools-count-na"]')!.textContent).toContain('1 no aplican');
    const critico = q('[data-testid="tools-banner-critico"]')!.textContent!;
    expect(critico).toContain('Correo saliente');
    expect(critico).not.toContain('OpenSearch');
    expect(q('[data-testid="tools-banner-no-critico"]')!.textContent).toContain('OpenSearch');
  });

  it('el estado en vivo sale sólo de isHealthy: lo no chequeado nunca se pinta como caído', () => {
    responder();
    abrirPestana(1);
    const tabla = q('[data-testid="tools-table"]')!.textContent!;
    expect(tabla).toContain('Operativa');
    expect(tabla).toContain('Sin chequeo en vivo');
    expect(tabla).toContain('No aplica');
    expect(tabla).toContain('Faltan: OPENAI_API_KEY');
    expect(tabla).toContain('Planeada');
    expect(qa('[data-testid="tools-table"] app-badge').filter((b) => b.textContent?.trim() === 'Caída')).toHaveLength(2);
  });

  it('filtra por criticidad y por estado vivo, y sin coincidencias dice cómo salir', () => {
    responder();
    abrirPestana(1);
    componente().criticidad.set('criticas');
    fixture.detectChanges();
    let tabla = q('[data-testid="tools-table"]')!.textContent!;
    expect(tabla).toContain('postgresql');
    expect(tabla).not.toContain('opensearch');
    componente().filtroVivo.set('NOT_APPLICABLE');
    fixture.detectChanges();
    expect(texto()).toContain('Ninguna herramienta coincide con los filtros.');
    componente().criticidad.set('no-criticas');
    fixture.detectChanges();
    tabla = q('[data-testid="tools-table"]')!.textContent!;
    expect(tabla).toContain('ga4');
    expect(tabla).not.toContain('postgresql');
  });

  it('se vuelve a pedir solo cada 30 s y «Actualizar» pide de inmediato', () => {
    responder();
    vi.advanceTimersByTime(INTERVALO_DE_REFRESCO_MS);
    responder();
    (q('[data-testid="instances-refresh"]') as HTMLButtonElement).click();
    responder();
    fixture.destroy();
    vi.advanceTimersByTime(INTERVALO_DE_REFRESCO_MS * 2);
    http.expectNone(liveness);
    http.expectNone(tools);
  });
});

describe('Instances con movimiento reducido', () => {
  it('no se refresca sola: queda el botón «Actualizar»', async () => {
    vi.useFakeTimers();
    const original = window.matchMedia;
    window.matchMedia = ((consulta: string) =>
      ({ matches: consulta.includes('prefers-reduced-motion'), media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList) as typeof window.matchMedia;
    try {
      await TestBed.configureTestingModule({
        imports: [Instances],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      }).compileComponents();
      const http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(Instances);
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/admin/ops/instances/liveness').flush(sonda());
      http.expectOne((r) => r.url === '/admin/ops/tools').flush(herramientas());
      vi.advanceTimersByTime(INTERVALO_DE_REFRESCO_MS * 3);
      http.expectNone((r) => r.url === '/admin/ops/instances/liveness');
      http.verify();
    } finally {
      window.matchMedia = original;
      vi.useRealTimers();
    }
  });
});
