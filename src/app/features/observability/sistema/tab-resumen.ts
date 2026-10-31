import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';

import { ObservabilityClient } from '@core/data-access/observability/observability.client';
import type { ObsSummary, ObsTimeseries, ObsWindowQuery } from '@core/data-access/observability/observability.types';
import { dataOf, empty } from '@core/view-state/view-state';
import { KpiTile } from '@features/reporting/components/kpi-tile/kpi-tile';
import { ChartPanel } from '@shared/components/organisms/chart-panel';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { ObservabilityContextStore } from '../state/observability-context.store';
import { atrasoDeFrescura, WidgetState } from '../state/widget-state';
import { kpisResumen, specSolicitudes } from './obs-mappers';

/**
 * Resumen: ¿está bien el sistema? Seis tarjetas (la tasa de 5xx es la cifra héroe) y las solicitudes en el
 * tiempo apiladas por resultado. Cada bloque tiene su propio estado: si uno falla los demás siguen vivos.
 */
@Component({
  selector: 'app-obs-tab-resumen',
  imports: [ViewStateHost, KpiTile, ChartPanel],
  templateUrl: './tab-resumen.html',
  styleUrls: ['./tab-layout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObsTabResumen {
  private readonly api = inject(ObservabilityClient);
  protected readonly store = inject(ObservabilityContextStore);

  protected readonly resumen = new WidgetState<ObsSummary>();
  protected readonly serie = new WidgetState<ObsTimeseries>();

  protected readonly kpis = computed(() => {
    const d = dataOf(this.resumen.state());
    return d === null ? [] : kpisResumen(d);
  });
  protected readonly specSerie = computed(() => {
    const d = dataOf(this.serie.state());
    return d === null ? null : specSolicitudes(d, this.store.zona());
  });

  constructor() {
    effect(() => {
      const q = this.store.consulta();
      this.store.version();
      untracked(() => this.cargar(q));
    });
  }

  protected cargar(q: ObsWindowQuery = this.store.consulta()): void {
    this.resumen.cargar(this.api.summary(q), {
      alRecibir: (s) => this.store.publicarFrescura(s.freshness),
      vacio: (s) =>
        s.kpis.requests.value === null
          ? empty(
              { label: 'Amplíe el rango o confirme que la medición está encendida en la API (OBSERVABILITY_ENABLED).' },
              'Ninguna instancia de la API reportó datos en esta ventana.',
            )
          : s.kpis.requests.value === 0
            ? empty({ label: 'Pruebe con un rango más amplio.' }, 'Todavía no hay peticiones medidas en esta ventana.')
            : null,
      atrasado: (s) => atrasoDeFrescura(s.freshness),
    });
    this.serie.cargar(this.api.timeseries({ ...q, metric: 'requests', groupBy: 'status_class' }), {
      vacio: (t) =>
        t.series.every((s) => s.points.length === 0)
          ? empty({ label: 'Pruebe con un rango más amplio.' }, 'No hay peticiones medidas en esta ventana.')
          : null,
      atrasado: (t) => atrasoDeFrescura(t.freshness),
    });
  }
}
