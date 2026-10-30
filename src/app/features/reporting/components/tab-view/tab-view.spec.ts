import { Component, input, output, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';

import { formatearValor } from '@core/data-access/reporting/reporting-format';
import type {
  ChartSpec,
  FiltroActivo,
  PestanaReporte,
  TablaReporte,
} from '@core/data-access/reporting/reporting.types';
import { ChartPanel } from '@shared/components/organisms/chart-panel';
import { ReportContextStore } from '../../state/report-context.store';
import { TabView } from './tab-view';

/**
 * El gráfico real dibuja con ECharts, que necesita un lienzo con medidas; aquí se
 * prueba lo que es de `TabView`: qué grafico va dónde y que el clic llega al almacén.
 * El contrato del gráfico se prueba junto a `ChartPanel`.
 */
@Component({ selector: 'app-chart-panel', template: '<span data-testid="stub-chart">{{ spec().titulo }}</span>' })
class StubChartPanel {
  readonly spec = input.required<ChartSpec>();
  readonly seleccion = input<string | null>(null);
  readonly filtroCambia = output<FiltroActivo>();
}

const INFO = { definicion: 'd', formula: 'f', fuente: 's', frescura: 'x' };

function chart(id: string, overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    id,
    titulo: `Gráfico ${id}`,
    unidad: { tipo: 'numero' },
    datos: { tipo: 'cartesiano', categorias: ['A', 'B'], series: [{ nombre: 'S', valores: [1, 2], forma: 'barra' }] },
    resumenAccesible: 'Resumen',
    filtro: { dimension: 'plan' },
    info: INFO,
    velas: null,
    velasMotivo: 'No es un saldo.',
    ...overrides,
  };
}

const TABLE: TablaReporte = {
  id: 'top',
  titulo: 'Mayores clientes',
  columnas: [
    { clave: 'nombre', etiqueta: 'Cliente' },
    { clave: 'monto', etiqueta: 'Monto', alinear: 'der' },
    { clave: 'cuota', etiqueta: 'Cuota' },
  ],
  filas: [
    { nombre: 'Clínica Ejemplo', monto: 1200.5, cuota: 3 },
    { nombre: 'Doctor Ejemplo', monto: null, cuota: 4 },
  ],
  info: INFO,
};

function data(overrides: Partial<PestanaReporte> = {}): PestanaReporte {
  return {
    pestana: 'resumen',
    generadoEn: '2026-10-30T10:00:00Z',
    origen: 'ejemplo',
    kpis: [
      { id: 'k1', titulo: 'MRR', valor: 100, unidad: { tipo: 'numero' }, variacionPct: 1, info: INFO },
      { id: 'k2', titulo: 'Churn', valor: null, unidad: { tipo: 'porcentaje' }, variacionPct: null, info: null, infoMotivo: 'x' },
    ],
    graficos: [chart('g1'), chart('g2', { ancho: 'completo' })],
    tablas: [TABLE],
    ...overrides,
  };
}

function mount(pestana: PestanaReporte) {
  const fixture = TestBed.createComponent(TabView);
  fixture.componentRef.setInput('data', pestana);
  return fixture;
}

describe('TabView', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    TestBed.overrideComponent(TabView, { remove: { imports: [ChartPanel] }, add: { imports: [StubChartPanel] } });
  });

  it('renderiza KPIs, gráficos y tablas', async () => {
    const fixture = mount(data());
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('app-kpi-tile')).toHaveLength(2);
    expect(root.querySelectorAll('app-chart-panel')).toHaveLength(2);
    expect(root.querySelectorAll('app-report-table')).toHaveLength(1);
    expect(root.textContent).toContain('Mayores clientes');
  });

  it('un gráfico de ancho completo ocupa toda la fila', async () => {
    // Dos de media columna y uno completo: ninguno queda huérfano, así que solo el completo ocupa la fila.
    const fixture = mount(data({ graficos: [chart('g1'), chart('g2', { ancho: 'completo' }), chart('g3')] }));
    await fixture.whenStable();
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.tv__cell');
    expect(cells[0]?.classList.contains('tv__cell--full')).toBe(false);
    expect(cells[1]?.classList.contains('tv__cell--full')).toBe(true);
    expect(cells[2]?.classList.contains('tv__cell--full')).toBe(false);
  });

  it('un gráfico de media columna que quedaría solo en su fila pasa a ancho completo', async () => {
    const fixture = mount(data({ graficos: [chart('g1'), chart('g2', { ancho: 'completo' })] }));
    await fixture.whenStable();
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.tv__cell');
    expect(cells[0]?.classList.contains('tv__cell--full')).toBe(true);
  });

  it('no repite «Datos de EJEMPLO» como aviso: el sello de la cabecera ya lo dice', async () => {
    const fixture = mount(data({ avisos: ['Datos de EJEMPLO'] }));
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="tab-notice"]')).toBeNull();
  });

  it('varios avisos van en un solo bloque con lista, no apilados', async () => {
    const fixture = mount(data({ avisos: ['Primero.', 'Segundo.', 'Datos de EJEMPLO'] }));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[data-testid="tab-notice"]')).toHaveLength(1);
    expect(Array.from(root.querySelectorAll('[data-testid="tab-notice-item"]')).map((e) => e.textContent?.trim())).toEqual(['Primero.', 'Segundo.']);
  });

  it('muestra los avisos del servidor', async () => {
    const fixture = mount(data({ avisos: ['Datos de EJEMPLO para la maqueta.'] }));
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="tab-notice"]')?.textContent).toContain(
      'Datos de EJEMPLO',
    );
  });

  it('el clic de un gráfico llega al almacén y un segundo clic en el mismo valor lo quita', async () => {
    const store = TestBed.inject(ReportContextStore);
    const fixture = mount(data());
    await fixture.whenStable();
    const panel = fixture.debugElement.query(By.directive(StubChartPanel));
    const click: FiltroActivo = { dimension: 'plan', valor: 'Pro' };

    panel.triggerEventHandler('filtroCambia', click);
    expect(store.filtros()).toEqual([click]);

    panel.triggerEventHandler('filtroCambia', click);
    expect(store.filtros()).toEqual([]);
  });

  it('le pasa a cada gráfico el valor filtrado de SU dimensión para resaltarlo', async () => {
    const store = TestBed.inject(ReportContextStore);
    store.alternarFiltro({ dimension: 'plan', valor: 'Pro' });
    const fixture = mount(data({ graficos: [chart('g1'), chart('g2', { filtro: { dimension: 'ciudad' } }), chart('g3', { filtro: null, filtroMotivo: 'x' })] }));
    await fixture.whenStable();
    const selections = fixture.debugElement.queryAll(By.directive(StubChartPanel)).map((d) => (d.componentInstance as StubChartPanel).seleccion());
    expect(selections).toEqual(['Pro', null, null]);
  });

  it('respeta las secciones y no pierde lo que ninguna nombra', async () => {
    const fixture = mount(
      data({
        secciones: [{ titulo: 'Ingresos', graficos: ['g2'], tablas: [] }],
      }),
    );
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const headings = Array.from(root.querySelectorAll('h2')).map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Indicadores clave', 'Ingresos', 'Más detalle']);
    // g1 y la tabla no estaban en ninguna sección: van al final.
    expect(root.querySelectorAll('app-chart-panel')).toHaveLength(2);
    expect(root.querySelectorAll('app-report-table')).toHaveLength(1);
  });

  describe('tabla de detalle', () => {
    it('escribe «Sin dato» para null y alinea los números a la derecha', async () => {
      const fixture = mount(data());
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const rows = root.querySelectorAll('tbody tr');
      const missing = rows[1]?.querySelectorAll('td')[0] as HTMLElement;
      expect(missing.textContent?.trim()).toBe('Sin dato');
      expect(missing.classList.contains('rt__num')).toBe(true);
      // `cuota` no declara alineación pero solo trae números: también va a la derecha.
      expect((rows[0]?.querySelectorAll('td')[1] as HTMLElement).classList.contains('rt__num')).toBe(true);
      // El nombre es texto: a la izquierda.
      expect((rows[0]?.querySelector('th') as HTMLElement).classList.contains('rt__num')).toBe(false);
    });

    it('tiene su botón «Cómo se calcula»', async () => {
      const fixture = mount(data());
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      (root.querySelector('[data-testid="table-how"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(root.querySelector('app-report-table [data-testid="calc-info"]')).not.toBeNull();
    });

    it('formatea con su unidad el número de una columna con `unidad` y deja el texto tal cual', async () => {
      const table: TablaReporte = {
        ...TABLE,
        columnas: [
          { clave: 'nombre', etiqueta: 'Cliente' },
          { clave: 'monto', etiqueta: 'Monto', unidad: { tipo: 'moneda', moneda: 'BOB' } },
        ],
        filas: [
          { nombre: 'A', monto: 1200.5 },
          { nombre: 'B', monto: 'Bs 99,00' },
          { nombre: 'C', monto: null },
        ],
      };
      const fixture = mount(data({ tablas: [table] }));
      await fixture.whenStable();
      const cells = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody td')).map((c) => c.textContent?.trim());
      expect(cells).toEqual([formatearValor(1200.5, { tipo: 'moneda', moneda: 'BOB' }), 'Bs 99,00', 'Sin dato']);
    });

    it('ordena los números como números y deja «Sin dato» siempre al final', async () => {
      const table: TablaReporte = {
        ...TABLE,
        columnas: [
          { clave: 'nombre', etiqueta: 'Cliente' },
          { clave: 'monto', etiqueta: 'Monto', alinear: 'der' },
        ],
        filas: [
          { nombre: 'diez', monto: 10 },
          { nombre: 'nueve', monto: 9 },
          { nombre: 'vacío', monto: null },
          { nombre: 'cien', monto: 100 },
        ],
      };
      const fixture = mount(data({ tablas: [table] }));
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const names = () => Array.from(root.querySelectorAll('tbody th')).map((c) => c.textContent?.trim());
      const sortButton = root.querySelector('[data-testid="sort-monto"]') as HTMLButtonElement;
      const header = sortButton.closest('th') as HTMLElement;
      expect(header.getAttribute('aria-sort')).toBe('none');

      sortButton.click();
      await fixture.whenStable();
      expect(names()).toEqual(['nueve', 'diez', 'cien', 'vacío']);
      expect(header.getAttribute('aria-sort')).toBe('ascending');

      sortButton.click();
      await fixture.whenStable();
      expect(names()).toEqual(['cien', 'diez', 'nueve', 'vacío']);
      expect(header.getAttribute('aria-sort')).toBe('descending');

      sortButton.click();
      await fixture.whenStable();
      expect(names()).toEqual(['diez', 'nueve', 'vacío', 'cien']);
      expect(header.getAttribute('aria-sort')).toBe('none');
    });

    it('una tabla sin filas explica qué hacer en vez de quedar vacía', async () => {
      const fixture = mount(data({ tablas: [{ ...TABLE, filas: [] }] }));
      await fixture.whenStable();
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="table-empty"]')?.textContent).toContain('Quite un filtro');
    });
  });
});
