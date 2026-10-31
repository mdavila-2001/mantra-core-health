import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { linePath, linear } from '../charts/chart-math';

/** Línea mínima de contexto (sin ejes): da forma a la tendencia dentro de una tarjeta. */
@Component({
  selector: 'app-ins-spark',
  template: `@if (path(); as d) {
    <svg class="sp" [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="none" aria-hidden="true">
      <path class="sp__area" [attr.d]="area()" />
      <path class="sp__line" [attr.d]="d" />
    </svg>
  }`,
  styles: `
    :host { display: block; inline-size: 100%; }
    .sp { display: block; inline-size: 100%; block-size: 34px; overflow: visible; }
    .sp__line { fill: none; stroke: var(--brand-primary); stroke-width: 1.75; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .sp__area { fill: color-mix(in srgb, var(--brand-primary) 12%, transparent); stroke: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sparkline {
  readonly values = input.required<readonly (number | null)[]>();
  protected readonly w = 120;
  protected readonly h = 34;

  private readonly pts = computed(() => {
    const real = this.values().filter((v): v is number => v !== null);
    if (real.length < 2) return null;
    const min = Math.min(...real);
    const max = Math.max(...real);
    const x = linear(0, this.values().length - 1, 1, this.w - 1);
    const y = linear(min, max === min ? min + 1 : max, this.h - 3, 3);
    return this.values().map((v, i) => (v === null ? null : { x: x(i), y: y(v) }));
  });

  protected readonly path = computed(() => (this.pts() ? linePath(this.pts()!) : ''));
  protected readonly area = computed(() => {
    const d = this.path();
    return d ? `${d}L${this.w - 1},${this.h}L1,${this.h}Z` : '';
  });
}
