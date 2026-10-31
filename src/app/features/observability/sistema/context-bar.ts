import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AppButton } from '@shared/components/atoms/button/button';
import { SegmentedControl } from '@shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '@shared/components/molecules/segmented-control/segmented-control.types';
import { ObservabilityContextStore, type RangoObs } from '../state/observability-context.store';
import { fechaHora, hace, ZONA_ETIQUETA, type ZonaHoraria } from './obs-format';

const RANGOS: readonly SegmentedOption<RangoObs>[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
];

const ZONAS: readonly SegmentedOption<ZonaHoraria>[] = [
  { value: 'America/La_Paz', label: 'La Paz' },
  { value: 'UTC', label: 'UTC' },
];

/**
 * Una sola fila encima de todo el panel: rango, zona horaria, frescura del dato y «Actualizar». Ninguna
 * pestaña tiene su propio rango (si lo necesitara, sería otro tablero).
 */
@Component({
  selector: 'app-obs-context-bar',
  imports: [SegmentedControl, AppButton],
  templateUrl: './context-bar.html',
  styleUrl: './context-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObsContextBar {
  protected readonly store = inject(ObservabilityContextStore);
  protected readonly rangos = RANGOS;
  protected readonly zonas = ZONAS;
  /** Reloj propio para «hace 3 min»: se refresca al actualizar, no cada segundo. */
  protected readonly reloj = signal(new Date());

  protected readonly zonaTexto = computed(() => ZONA_ETIQUETA[this.store.zona()]);
  protected readonly ayudaRango = computed(() =>
    this.store.rango() === 'hoy'
      ? this.store.zona() === 'UTC'
        ? '«Hoy» empieza a las 00:00 UTC (las 20:00 del día anterior en La Paz).'
        : '«Hoy» empieza a las 00:00 de La Paz (04:00 UTC).'
      : 'Los intervalos se cortan en la zona elegida.',
  );
  protected readonly frescura = computed(() => {
    const f = this.store.frescura();
    if (f === null) return { texto: 'Esperando el primer dato…', estado: 'espera' as const };
    if (f.lastFlushAt === null) return { texto: 'Sin dato volcado en esta ventana', estado: 'sin-dato' as const };
    const zona = this.store.zona();
    return {
      texto: `Último dato volcado ${fechaHora(f.lastFlushAt, zona)} (${zona === 'UTC' ? 'UTC' : 'La Paz'}) · ${hace(f.lastFlushAt, this.reloj())}`,
      estado: (f.lagSeconds ?? 0) > 180 ? ('atrasado' as const) : ('al-dia' as const),
    };
  });
  protected readonly perdidos = computed(() => this.store.frescura()?.droppedFlushes ?? 0);

  protected actualizar(): void {
    this.reloj.set(new Date());
    this.store.actualizar();
  }
}
