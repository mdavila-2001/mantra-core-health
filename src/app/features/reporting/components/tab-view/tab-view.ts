import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import type {
  ChartSpec,
  ComparacionReporte,
  PestanaReporte,
  TablaReporte,
} from '@core/data-access/reporting/reporting.types';
import { nextControlId } from '@shared/forms/form-control.context';
import { Alert } from '@shared/components/molecules/alert/alert';
import { ChartPanel } from '@shared/components/organisms/chart-panel';
import { ReportContextStore } from '../../state/report-context.store';
import { KpiTile } from '../kpi-tile/kpi-tile';
import { ReportTable } from './report-table';
import { orphanCharts } from './tab-layout';

interface TabSection {
  readonly title: string | null;
  readonly description: string | null;
  readonly charts: readonly ChartSpec[];
  readonly tables: readonly TablaReporte[];
  /** Gráficos de media columna que quedarían solos en su fila y pasan a ancho completo. */
  readonly stretched: ReadonlySet<string>;
}

function withLayout(section: Omit<TabSection, 'stretched'>): TabSection {
  return { ...section, stretched: orphanCharts(section.charts) };
}

const COMPARISON_TEXT: Readonly<Record<ComparacionReporte, string | null>> = {
  ninguna: null,
  'periodo-anterior': 'frente al periodo anterior',
  'mismo-periodo-ano-anterior': 'frente al mismo periodo del año pasado',
};

/**
 * El cuerpo de una pestaña del dashboard comercial: avisos, tarjetas de
 * indicadores, gráficos y tablas de detalle.
 *
 * Es presentacional: recibe una `PestanaReporte` ya cargada y no sabe de HTTP.
 * Lo único que toca es el almacén del contexto, para (a) resaltar en cada
 * gráfico el elemento que está filtrado y (b) pasarle el clic al almacén, que
 * decide si el filtro se activa, cambia o se quita.
 *
 * Si la pestaña trae `secciones` se respeta su orden y sus títulos; lo que
 * ninguna sección nombra no se pierde: va al final, bajo «Más detalle».
 */
@Component({
  selector: 'app-tab-view',
  imports: [Alert, ChartPanel, KpiTile, ReportTable],
  templateUrl: './tab-view.html',
  styleUrl: './tab-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabView {
  protected readonly store = inject(ReportContextStore);

  readonly data = input.required<PestanaReporte>();
  protected readonly ids = nextControlId('tv');
  /**
   * Los avisos del servidor, sin el que solo repite «Datos de EJEMPLO»: el sello de la cabecera ya lo dice
   * en todas las pestañas, y un segundo banner igual no añade nada.
   */
  protected readonly notices = computed(() =>
    (this.data().avisos ?? []).filter((aviso) => !/^datos de ejemplo\.?$/i.test(aviso.trim())),
  );
  protected readonly comparison = computed(() => COMPARISON_TEXT[this.store.comparar()]);

  protected readonly sections = computed<readonly TabSection[]>(() => {
    const { graficos, tablas, secciones } = this.data();
    if (secciones === undefined || secciones.length === 0) {
      return [
        withLayout({ title: 'Gráficos', description: null, charts: graficos, tables: [] }),
        withLayout({ title: 'Tablas de detalle', description: null, charts: [], tables: tablas }),
      ].filter((s) => s.charts.length > 0 || s.tables.length > 0);
    }
    const chartsById = new Map(graficos.map((g) => [g.id, g]));
    const tablesById = new Map(tablas.map((t) => [t.id, t]));
    const used = new Set<string>();
    const result: TabSection[] = secciones.map((section) => {
      const charts = (section.graficos ?? []).flatMap((id) => chartsById.get(id) ?? []);
      const tables = (section.tablas ?? []).flatMap((id) => tablesById.get(id) ?? []);
      [...charts, ...tables].forEach((item) => used.add(item.id));
      return withLayout({ title: section.titulo, description: section.descripcion ?? null, charts, tables });
    });
    const leftoverCharts = graficos.filter((g) => !used.has(g.id));
    const leftoverTables = tablas.filter((t) => !used.has(t.id));
    if (leftoverCharts.length > 0 || leftoverTables.length > 0) {
      result.push(withLayout({ title: 'Más detalle', description: null, charts: leftoverCharts, tables: leftoverTables }));
    }
    return result.filter((s) => s.charts.length > 0 || s.tables.length > 0);
  });
}
