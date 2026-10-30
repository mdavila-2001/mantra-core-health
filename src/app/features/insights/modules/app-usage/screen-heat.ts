import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { heatLevel } from '../../charts/chart-math';
import { IGNORED_SHARE, type ScreenHeat } from '../../domain/app-usage';

/**
 * Mapa de calor de toques sobre una pantalla de la app. Cada zona se pinta con
 * la escala `--heat-*` y dice su porcentaje en texto; las zonas por debajo del
 * 2 % de los toques se marcan como «ignoradas». Debajo, la profundidad de
 * desplazamiento: cuántas sesiones llegan a cada tramo de la pantalla.
 */
@Component({
  selector: 'ins-screen-heat',
  templateUrl: './screen-heat.html',
  styleUrl: './screen-heat.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScreenHeatMap {
  readonly screen = input.required<ScreenHeat>();
  protected readonly ignoredBelow = IGNORED_SHARE;

  protected readonly zones = computed(() => {
    const zones = this.screen().zones;
    const max = Math.max(...zones.map((z) => z.taps));
    const min = Math.min(...zones.map((z) => z.taps));
    return zones.map((z) => ({ ...z, level: heatLevel(z.taps, min, max), ignored: z.taps < IGNORED_SHARE }));
  });
  protected readonly ranked = computed(() => [...this.zones()].sort((a, b) => b.taps - a.taps));
  protected readonly ignoredList = computed(() => this.zones().filter((z) => z.ignored));
  protected readonly scroll = computed(() => this.screen().scroll.map((pct, i) => ({ from: i * 10, pct })));
  protected fmt(n: number): string { return n.toFixed(1).replace('.', ','); }
}
