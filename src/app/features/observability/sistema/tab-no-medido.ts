import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';

import { ObservabilityClient } from '@core/data-access/observability/observability.client';
import type { ObsCoverage, ObsWindowQuery } from '@core/data-access/observability/observability.types';
import { dataOf } from '@core/view-state/view-state';
import { Alert } from '@shared/components/molecules/alert/alert';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { ObservabilityContextStore } from '../state/observability-context.store';
import { atrasoDeFrescura, WidgetState } from '../state/widget-state';
import { fechaHoraCompleta, textoEntero } from './obs-format';

/** Nombre legible de cada limitación que declara la API; una desconocida se muestra con su nombre técnico (no se oculta). */
const NOMBRES: Readonly<Record<string, string>> = {
  rejectedBeforeApi: 'Rechazado antes de llegar a la API',
  healthchecksExcluded: 'Sondas de salud, documentación y métricas',
  percentilesEstimated: 'Percentiles estimados',
  errorSampling: 'Muestreo de eventos de error',
  sqlOnlyOrm: 'SQL fuera del ORM',
  workers: 'Workers y tareas programadas',
  dependencies: 'Dependencias (base, caché, almacenamiento…)',
  slo: 'Objetivos de servicio (SLO)',
  lastMinuteNotFlushed: 'Último ciclo sin volcar',
  affectedActors: 'Personas afectadas por un error',
  observability: 'Medición apagada en esta instancia',
  moduleAttribution: 'Atribución de operaciones a módulos',
};

/** No medido: lo que el panel NO ve, y si la propia medición está sana. «No medido» no es cero. */
@Component({
  selector: 'app-obs-tab-no-medido',
  imports: [ViewStateHost, Alert],
  templateUrl: './tab-no-medido.html',
  styleUrls: ['./tab-layout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObsTabNoMedido {
  private readonly api = inject(ObservabilityClient);
  protected readonly store = inject(ObservabilityContextStore);
  protected readonly cobertura = new WidgetState<ObsCoverage>();
  protected readonly datos = computed(() => dataOf(this.cobertura.state()));
  protected readonly nombre = (metric: string): string => NOMBRES[metric] ?? metric;
  protected readonly entero = textoEntero;
  protected readonly fecha = (iso: string | null): string => fechaHoraCompleta(iso, this.store.zona());
  protected readonly si = (v: boolean): string => (v ? 'Encendido' : 'Apagado');

  constructor() {
    effect(() => {
      const q = this.store.consulta();
      this.store.version();
      untracked(() => this.cargar(q));
    });
  }

  protected cargar(q: ObsWindowQuery = this.store.consulta()): void {
    this.cobertura.cargar(this.api.coverage({ ...q, interval: undefined }), {
      alRecibir: (c) => this.store.publicarFrescura(c.freshness),
      atrasado: (c) => atrasoDeFrescura(c.freshness),
    });
  }
}
