import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChartSpec } from '@core/data-access/reporting/reporting.types';
import { ChartPanel } from './chart-panel';

const INFO = {
  definicion: 'Ingreso reconocido por plan.',
  formula: 'Σ ingreso del periodo',
  fuente: 'payments.subscriptions',
  frescura: 'Cada hora',
  salvedades: ['Datos de EJEMPLO'],
};

const SPEC: ChartSpec = {
  id: 'ingreso-por-plan',
  titulo: 'Ingreso por plan',
  unidad: { tipo: 'moneda', moneda: 'BOB' },
  datos: {
    tipo: 'cartesiano',
    categorias: ['Básico', 'Pro'],
    series: [{ nombre: 'Ingreso', valores: [100, 250], forma: 'barra' }],
  },
  resumenAccesible: 'El plan Pro aporta más ingreso que el Básico.',
  filtro: { dimension: 'plan' },
  info: INFO,
  velas: null,
  velasMotivo: 'El ingreso es un flujo que se suma, no un saldo.',
};

/**
 * El gráfico se dibuja con ECharts; aquí se prueba el menú «Más» del panel, que
 * es lo que un lector de teclado y un usuario de ratón tocan primero. Regresión:
 * `#botonMenu` está sobre un `app-button`, y sin `read: ElementRef` el `viewChild`
 * devolvía el componente y «Ver en grande» lanzaba al enfocar el botón.
 */
describe('ChartPanel · menú Más', () => {
  beforeEach(() => {
    // jsdom no trae `ResizeObserver`, que `ngx-echarts` exige para ajustar el lienzo.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function mount() {
    const fixture = TestBed.createComponent(ChartPanel);
    fixture.componentRef.setInput('spec', SPEC);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const byId = (id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    const item = (name: string) =>
      Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((e) => e.textContent?.includes(name));
    return { fixture, root, byId, item };
  }

  async function openMenu(m: Awaited<ReturnType<typeof mount>>) {
    m.byId('chart-more')?.click();
    await m.fixture.whenStable();
  }

  it('abre el menú con las tres opciones', async () => {
    const m = await mount();
    await openMenu(m);
    expect(m.byId('chart-more')?.getAttribute('aria-expanded')).toBe('true');
    expect(m.item('Ver en grande')).toBeTruthy();
    expect(m.item('Ver datos en tabla')).toBeTruthy();
    expect(m.item('Exportar CSV')).toBeTruthy();
  });

  it('«Ver en grande» cierra el menú y abre el diálogo sin lanzar', async () => {
    const m = await mount();
    await openMenu(m);
    expect(() => m.item('Ver en grande')?.click()).not.toThrow();
    await m.fixture.whenStable();
    expect(m.root.querySelector('[role="menu"]')).toBeNull();
    expect(m.root.querySelector('app-content-dialog')).not.toBeNull();
    expect(m.byId('chart-more')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('«Ver datos en tabla» muestra la tabla de respaldo y luego ofrece ocultarla', async () => {
    const m = await mount();
    await openMenu(m);
    expect(() => m.item('Ver datos en tabla')?.click()).not.toThrow();
    await m.fixture.whenStable();
    expect(m.root.querySelector('table')).not.toBeNull();
    await openMenu(m);
    expect(m.item('Ocultar la tabla de datos')).toBeTruthy();
  });

  it('Escape cierra el menú', async () => {
    const m = await mount();
    await openMenu(m);
    m.root
      .querySelector('[role="menu"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await m.fixture.whenStable();
    expect(m.root.querySelector('[role="menu"]')).toBeNull();
  });
});
