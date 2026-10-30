import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ReportingClient } from '@core/data-access/reporting/reporting.client';
import type {
  ContextoReporte,
  PestanaReporte,
  VerticalReporte,
} from '@core/data-access/reporting/reporting.types';
import { ReportContextStore } from '../../state/report-context.store';
import { CommercialDashboard } from './commercial-dashboard';

function pestana(tab: VerticalReporte, overrides: Partial<PestanaReporte> = {}): PestanaReporte {
  return {
    pestana: tab,
    generadoEn: new Date().toISOString(),
    origen: 'ejemplo',
    kpis: [{ id: `${tab}-k`, titulo: `KPI de ${tab}`, valor: 10, unidad: { tipo: 'numero' }, variacionPct: 1, info: null, infoMotivo: 'x' }],
    graficos: [],
    tablas: [],
    ...overrides,
  };
}

type Call = readonly [VerticalReporte, ContextoReporte];

async function mount(
  url: string,
  respond: (tab: VerticalReporte, ctx: ContextoReporte) => Observable<PestanaReporte> = (tab) => of(pestana(tab)),
) {
  const calls: Call[] = [];
  const client = {
    pestana: vi.fn((tab: VerticalReporte, ctx: ContextoReporte) => {
      calls.push([tab, ctx]);
      return respond(tab, ctx);
    }),
  };
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: 'reports/commercial/:pestana', component: CommercialDashboard }]),
      { provide: ReportingClient, useValue: client },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl(url, CommercialDashboard);
  await harness.fixture.whenStable();
  const root = harness.routeNativeElement as HTMLElement;
  const store = TestBed.inject(ReportContextStore);
  return { harness, root, calls, client, store, component };
}

describe('CommercialDashboard', () => {
  it('abre la pestaña que dice la URL y pide los datos con el contexto actual', async () => {
    const { root, calls, store } = await mount('/reports/commercial/suscripciones');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe('suscripciones');
    expect(calls[0]?.[1]).toEqual(store.contexto());
    expect(root.querySelector('h1')?.textContent).toContain('Dashboard comercial');
    expect(root.textContent).toContain('KPI de suscripciones');
    expect(root.querySelector('[data-testid="tab-suscripciones"]')?.getAttribute('aria-current')).toBe('page');
    expect(root.querySelector('[data-testid="tab-resumen"]')?.getAttribute('aria-current')).toBeNull();
  });

  it('ofrece las siete verticales como enlaces con su propia URL', async () => {
    const { root } = await mount('/reports/commercial/resumen');
    const links = Array.from(root.querySelectorAll('nav a.cd__tab')) as HTMLAnchorElement[];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/reports/commercial/resumen',
      '/reports/commercial/suscripciones',
      '/reports/commercial/publicidad',
      '/reports/commercial/comisiones',
      '/reports/commercial/cobros',
      '/reports/commercial/adquisicion',
      '/reports/commercial/calidad',
    ]);
  });

  it('navegar a otra pestaña cambia la URL, la pestaña activa y los datos', async () => {
    const { harness, root, calls } = await mount('/reports/commercial/resumen');
    await harness.navigateByUrl('/reports/commercial/cobros');
    await harness.fixture.whenStable();
    expect(calls.map((c) => c[0])).toEqual(['resumen', 'cobros']);
    expect(root.querySelector('[data-testid="tab-cobros"]')?.getAttribute('aria-current')).toBe('page');
    expect(root.textContent).toContain('KPI de cobros');
  });

  it('una pestaña que no existe dice «no encontrado» y no pide nada', async () => {
    const { root, calls } = await mount('/reports/commercial/inventada');
    expect(calls).toHaveLength(0);
    expect(root.textContent).toContain('No encontramos lo que busca');
  });

  describe('sello de datos de ejemplo', () => {
    it('se ve cuando el origen es «ejemplo»', async () => {
      const { root } = await mount('/reports/commercial/resumen');
      expect(root.querySelector('[data-testid="sample-seal"]')?.textContent).toContain('DATOS DE EJEMPLO');
    });

    it('no se pone sobre datos que no lo son', async () => {
      const { root } = await mount('/reports/commercial/resumen', (tab) => of(pestana(tab, { origen: 'api' })));
      expect(root.querySelector('[data-testid="sample-seal"]')).toBeNull();
    });
  });

  describe('datos atrasados (S7)', () => {
    const hoursAgo = (h: number): string => new Date(Date.now() - h * 3_600_000).toISOString();

    it('un reporte generado hace más de un día se muestra atrasado, con su antigüedad y con los datos a la vista', async () => {
      const { root } = await mount('/reports/commercial/resumen', (tab) => of(pestana(tab, { generadoEn: hoursAgo(72) })));
      const text = root.textContent ?? '';
      expect(text).toContain('Está viendo datos atrasados');
      // Se lee como advertencia (no como un aviso informativo más) y con la antigüedad a la vista.
      expect(root.querySelector('[data-testid="dashboard-stale"]')?.getAttribute('tone')).toBe('warning');
      expect(text).toContain('Información al');
      expect(root.querySelector('[data-testid="tab-view"]')).not.toBeNull();
      expect(Array.from(root.querySelectorAll('button')).some((b) => b.textContent?.includes('Actualizar'))).toBe(true);
    });

    it('uno reciente se presenta como vigente', async () => {
      const { root } = await mount('/reports/commercial/resumen', (tab) => of(pestana(tab, { generadoEn: hoursAgo(1) })));
      expect(root.textContent).not.toContain('datos atrasados');
    });

    it('una fecha ilegible no lo marca atrasado: sin fecha no se inventa una antigüedad', async () => {
      const { root } = await mount('/reports/commercial/resumen', (tab) => of(pestana(tab, { generadoEn: 'ayer' })));
      expect(root.textContent).not.toContain('datos atrasados');
    });
  });

  describe('publicidad', () => {
    it('destaca «Módulo en diseño» aunque el servidor no lo avise', async () => {
      const { root } = await mount('/reports/commercial/publicidad');
      const banner = root.querySelector('[data-testid="design-banner"]');
      expect(banner?.textContent).toContain('Módulo en diseño');
      expect(banner?.textContent).toContain('gestor de anuncios');
    });

    it('usa el aviso del servidor sin repetirlo en la lista de avisos', async () => {
      const { root } = await mount('/reports/commercial/publicidad', (tab) =>
        of(pestana(tab, { avisos: ['Módulo en diseño: el modelo de pauteo cambiará.', 'Otro aviso.'] })),
      );
      expect(root.querySelector('[data-testid="design-banner"]')?.textContent).toContain('el modelo de pauteo cambiará');
      const notices = Array.from(root.querySelectorAll('[data-testid="tab-notice"]')).map((n) => n.textContent ?? '');
      expect(notices).toHaveLength(1);
      expect(notices[0]).toContain('Otro aviso.');
    });

    it('las demás pestañas no llevan el banner', async () => {
      const { root } = await mount('/reports/commercial/cobros');
      expect(root.querySelector('[data-testid="design-banner"]')).toBeNull();
    });
  });

  describe('cambios de contexto', () => {
    it('recalcula cuando cambia el periodo, la moneda o un filtro', async () => {
      const { harness, calls, store } = await mount('/reports/commercial/resumen');
      store.periodo.set('90d');
      await harness.fixture.whenStable();
      store.moneda.set('USD');
      await harness.fixture.whenStable();
      store.alternarFiltro({ dimension: 'plan', valor: 'Pro' });
      await harness.fixture.whenStable();

      expect(calls).toHaveLength(4);
      expect(calls[1]?.[1].periodo).toBe('90d');
      expect(calls[2]?.[1].moneda).toBe('USD');
      expect(calls[3]?.[1].filtros).toEqual([{ dimension: 'plan', valor: 'Pro' }]);
    });

    it('cancela la petición vieja: una respuesta lenta no pisa a la nueva', async () => {
      const first = new Subject<PestanaReporte>();
      let n = 0;
      const { harness, root, store } = await mount('/reports/commercial/resumen', (tab) =>
        ++n === 1 ? first : of(pestana(tab, { kpis: [{ id: 'nuevo', titulo: 'Cifra nueva', valor: 1, unidad: { tipo: 'numero' }, variacionPct: null, info: null, infoMotivo: 'x' }] })),
      );
      expect(first.observed).toBe(true);

      store.periodo.set('7d');
      await harness.fixture.whenStable();
      expect(first.observed).toBe(false);

      // Llega tarde: nadie la escucha.
      first.next(pestana('resumen'));
      await harness.fixture.whenStable();
      expect(root.textContent).toContain('Cifra nueva');
    });

    it('conserva los datos a la vista mientras recalcula, con aviso', async () => {
      const second = new Subject<PestanaReporte>();
      let n = 0;
      const { harness, root, store } = await mount('/reports/commercial/resumen', (tab) => (++n === 1 ? of(pestana(tab)) : second));
      expect(root.textContent).toContain('KPI de resumen');

      store.periodo.set('12m');
      await harness.fixture.whenStable();
      expect(root.querySelector('[data-testid="refreshing"]')).not.toBeNull();
      expect(root.querySelector('[data-testid="dashboard-loading"]')).toBeNull();
      expect(root.textContent).toContain('KPI de resumen');

      second.next(pestana('resumen'));
      await harness.fixture.whenStable();
      expect(root.querySelector('[data-testid="refreshing"]')).toBeNull();
    });
  });

  describe('estados', () => {
    it('muestra el esqueleto mientras la primera carga está en curso', async () => {
      const { root } = await mount('/reports/commercial/resumen', () => new Subject<PestanaReporte>());
      expect(root.querySelector('[data-testid="dashboard-loading"]')).not.toBeNull();
    });

    it('un error sin datos previos explica, trae código de soporte y reintenta', async () => {
      let n = 0;
      const { harness, root } = await mount('/reports/commercial/resumen', (tab) =>
        ++n === 1
          ? throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'INTERNAL', message: 'x', correlationId: 'req-9' } }))
          : of(pestana(tab)),
      );
      expect(root.textContent).toContain('req-9');
      const retry = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar')) as HTMLButtonElement;
      retry.click();
      await harness.fixture.whenStable();
      expect(root.textContent).toContain('KPI de resumen');
    });

    it('si falla una recarga y ya había datos, los muestra como atrasados con su antigüedad', async () => {
      let n = 0;
      const { harness, root, store } = await mount('/reports/commercial/resumen', (tab) =>
        ++n === 1 ? of(pestana(tab)) : throwError(() => new HttpErrorResponse({ status: 0 })),
      );
      store.periodo.set('7d');
      await harness.fixture.whenStable();
      expect(root.textContent).toContain('Está viendo datos atrasados');
      expect(root.textContent).toContain('KPI de resumen');
      expect(root.textContent).toMatch(/Información al \d{2}\/\d{2}\/\d{4}/);
      // Cambió el periodo y la recarga falló: esas cifras son del periodo anterior y la pantalla lo dice.
      expect(root.querySelector('[data-testid="dashboard-stale-filters"]')?.textContent).toContain('filtros anteriores');
    });

    it('si falla un reintento con los mismos filtros, las cifras atrasadas no se rotulan como de otros filtros', async () => {
      let n = 0;
      const { harness, root, component } = await mount('/reports/commercial/resumen', (tab) =>
        ++n === 1 ? of(pestana(tab)) : throwError(() => new HttpErrorResponse({ status: 0 })),
      );
      expect(root.querySelector('[data-testid="dashboard-stale"]')).toBeNull();
      (component as unknown as { reload(): void }).reload();
      await harness.fixture.whenStable();
      expect(root.querySelector('[data-testid="dashboard-stale"]')).not.toBeNull();
      expect(root.querySelector('[data-testid="dashboard-stale-filters"]')).toBeNull();
    });

    it('un 403 no deja un muro: dice a quién pedir acceso y ofrece volver al inicio', async () => {
      const { root } = await mount('/reports/commercial/resumen', () =>
        throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'FORBIDDEN', message: 'Su rol no puede ver este reporte.' } })),
      );
      expect(root.textContent).toContain('Pida acceso a quien administra su organización');
      expect(Array.from(root.querySelectorAll('a')).some((a) => a.textContent?.includes('Volver al inicio'))).toBe(true);
    });

    it('sin cifras para el filtro, orienta y ofrece limpiar los filtros', async () => {
      const { harness, root, store } = await mount('/reports/commercial/resumen', (tab) =>
        of(pestana(tab, { kpis: [], graficos: [], tablas: [] })),
      );
      store.alternarFiltro({ dimension: 'ciudad', valor: 'Sucre' });
      await harness.fixture.whenStable();
      const empty = root.querySelector('[data-testid="dashboard-empty"]');
      expect(empty?.textContent).toContain('Sin datos para mostrar');
      const clear = Array.from(empty?.querySelectorAll('button') ?? []).find((b) => b.textContent?.includes('Limpiar filtros'));
      clear?.click();
      await harness.fixture.whenStable();
      expect(store.filtros()).toEqual([]);
    });
  });
});
