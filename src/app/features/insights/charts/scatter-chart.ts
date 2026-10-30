import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { formatAxis, formatValue } from '../domain/format';
import type { MetricUnit } from '../domain/insights.types';
import { linear, niceTicks, regression, trendIsSound } from './chart-math';
import { trackWidth } from './chart.types';

export interface ScatterPoint {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly group?: string;
  readonly color?: number;
}

/**
 * Pregunta que responde: «¿existe relación entre estas dos variables?».
 *
 * La línea de tendencia solo se dibuja si la estadística la sostiene: al menos
 * 10 puntos y |r| ≥ 0,30. Con menos, se dice por qué no hay línea. Y aun con
 * línea, una correlación no es una causa: el pie del gráfico lo recuerda.
 */
@Component({
  selector: 'ins-scatter-chart',
  templateUrl: './scatter-chart.html',
  styleUrl: './scatter-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ins-chart' },
})
export class ScatterChart {
  readonly points = input.required<readonly ScatterPoint[]>();
  readonly xUnit = input.required<MetricUnit>();
  readonly yUnit = input.required<MetricUnit>();
  readonly xLabel = input.required<string>();
  readonly yLabel = input.required<string>();
  readonly height = input(300);
  readonly ariaLabel = input.required<string>();

  protected readonly width = trackWidth();
  protected readonly hover = signal<string | null>(null);

  protected readonly margin = { top: 12, right: 16, bottom: 44, left: 58 } as const;

  protected readonly reg = computed(() => regression(this.points().map((p) => p.x), this.points().map((p) => p.y)));
  protected readonly sound = computed(() => trendIsSound(this.reg()));

  private readonly xs = computed(() => this.points().map((p) => p.x));
  private readonly ys = computed(() => this.points().map((p) => p.y));

  protected readonly xTicks = computed(() => niceTicks(Math.min(...this.xs(), 0) , Math.max(...this.xs(), 1), 5));
  protected readonly yTicks = computed(() => niceTicks(Math.min(...this.ys(), 0), Math.max(...this.ys(), 1), 5));

  private readonly sx = computed(() => linear(this.xTicks()[0] ?? 0, this.xTicks()[this.xTicks().length - 1] ?? 1, this.margin.left, this.width() - this.margin.right));
  private readonly sy = computed(() => linear(this.yTicks()[0] ?? 0, this.yTicks()[this.yTicks().length - 1] ?? 1, this.height() - this.margin.bottom, this.margin.top));

  protected readonly dots = computed(() =>
    this.points().map((p) => ({ ...p, cx: this.sx()(p.x), cy: this.sy()(p.y), tip: `${p.label}: ${this.xLabel()} ${formatValue(p.x, this.xUnit())} · ${this.yLabel()} ${formatValue(p.y, this.yUnit())}` })),
  );

  protected readonly trend = computed(() => {
    const reg = this.reg();
    if (!reg || !this.sound()) return null;
    const x0 = this.xTicks()[0] ?? 0;
    const x1 = this.xTicks()[this.xTicks().length - 1] ?? 1;
    return { x1: this.sx()(x0), y1: this.sy()(reg.slope * x0 + reg.intercept), x2: this.sx()(x1), y2: this.sy()(reg.slope * x1 + reg.intercept) };
  });

  protected readonly verdict = computed(() => {
    const reg = this.reg();
    if (!reg) return 'Faltan puntos para evaluar una relación.';
    const strength = Math.abs(reg.r) >= 0.7 ? 'fuerte' : Math.abs(reg.r) >= 0.4 ? 'moderada' : 'débil';
    const sign = reg.r >= 0 ? 'positiva' : 'negativa';
    if (!this.sound()) {
      return reg.n < 10
        ? `Solo ${reg.n} puntos: no alcanzan para dibujar una tendencia.`
        : `Relación ${strength} (r = ${reg.r.toFixed(2).replace('.', ',')}): demasiado débil para trazar una tendencia.`;
    }
    return `Relación ${strength} y ${sign} (r = ${reg.r.toFixed(2).replace('.', ',')}, R² = ${reg.r2.toFixed(2).replace('.', ',')}, n = ${reg.n}). Correlación no es causalidad.`;
  });

  protected axisX(v: number): string { return formatAxis(v, this.xUnit()); }
  protected axisY(v: number): string { return formatAxis(v, this.yUnit()); }
  protected px(v: number): number { return this.sx()(v); }
  protected py(v: number): number { return this.sy()(v); }

  protected readonly hovered = computed(() => this.dots().find((d) => d.id === this.hover()) ?? null);
}
