import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { formatAxis, formatChange, formatValue } from '../domain/format';
import type { MetricUnit } from '../domain/insights.types';
import { areaPath, linePath, linear, niceTicks, type XY } from './chart-math';
import { seriesVar, trackWidth, type Band, type LineSeries, type RefLine } from './chart.types';

const MARGIN = { top: 14, right: 12, bottom: 30, left: 52 } as const;
const LABEL_GAP = 13;
const DASH: Readonly<Record<number, string>> = { 1: '', 2: '7 3', 3: '2 3', 4: '10 3 2 3', 5: '4 4', 6: '1 4' };

interface DrawnSeries {
  readonly id: string;
  readonly label: string;
  readonly color: number;
  readonly d: string;
  readonly area: string;
  readonly dash: string;
  readonly last: XY | null;
  readonly lastValue: number | null;
}

interface EndLabel {
  readonly key: string;
  readonly text: string;
  readonly y: number;
  readonly kind: string;
  readonly color: number;
}

/**
 * Pregunta que responde: «¿cómo está evolucionando?».
 *
 * Los `null` son huecos. Benchmark, objetivo y umbrales se dibujan sobre el
 * mismo eje y se rotulan directamente (no solo por color). Arrastrar sobre el
 * gráfico hace zoom; las flechas del teclado recorren los puntos.
 */
@Component({
  selector: 'ins-line-chart',
  templateUrl: './line-chart.html',
  styleUrl: './line-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ins-chart' },
})
export class LineChart {
  readonly labels = input.required<readonly string[]>();
  readonly series = input.required<readonly LineSeries[]>();
  readonly unit = input.required<MetricUnit>();
  readonly refs = input<readonly RefLine[]>([]);
  readonly band = input<Band | null>(null);
  /** Valores del periodo anterior, alineados por posición, como fantasma punteado. */
  readonly compare = input<readonly (number | null)[] | null>(null);
  readonly compareLabel = input('Periodo anterior');
  readonly area = input(false);
  readonly height = input(280);
  readonly ariaLabel = input.required<string>();

  protected readonly width = trackWidth();
  protected readonly sv = seriesVar;
  protected readonly hover = signal<number | null>(null);
  protected readonly hidden = signal<ReadonlySet<string>>(new Set());
  protected readonly zoom = signal<readonly [number, number] | null>(null);
  protected readonly dragFrom = signal<number | null>(null);
  protected readonly dragTo = signal<number | null>(null);

  protected readonly margin = computed(() => ({ ...MARGIN, right: this.width() < 520 ? 12 : 120 }));
  protected readonly span = computed<readonly [number, number]>(() => this.zoom() ?? [0, Math.max(0, this.labels().length - 1)]);
  protected readonly count = computed(() => this.span()[1] - this.span()[0] + 1);
  protected readonly plotW = computed(() => this.width() - this.margin().left - this.margin().right);
  protected readonly plotH = computed(() => this.height() - MARGIN.top - MARGIN.bottom);

  protected readonly visibleSeries = computed(() => this.series().filter((s) => !this.hidden().has(s.id)));

  /** Ejes: las marcas se calculan UNA vez y el dominio es de la primera a la última. */
  protected readonly yTicks = computed(() => {
    const [a, b] = this.span();
    const all: number[] = [];
    for (const s of this.visibleSeries()) for (const v of s.values.slice(a, b + 1)) if (v !== null) all.push(v);
    for (const v of this.compare()?.slice(a, b + 1) ?? []) if (v !== null) all.push(v);
    for (const r of this.refs()) all.push(r.value);
    const band = this.band();
    if (band) all.push(band.low, band.high);
    if (all.length === 0) return [0, 1];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.08 || Math.abs(max) * 0.1 || 1;
    return niceTicks(Math.max(min >= 0 ? 0 : min - pad, min - pad * 3), max + pad, 5);
  });
  protected readonly yDomain = computed<readonly [number, number]>(() => [this.yTicks()[0] ?? 0, this.yTicks()[this.yTicks().length - 1] ?? 1]);
  protected readonly yScale = computed(() => linear(this.yDomain()[0], this.yDomain()[1], MARGIN.top + this.plotH(), MARGIN.top));

  protected xAt(index: number): number {
    const [a] = this.span();
    const n = this.count();
    return this.margin().left + (n <= 1 ? this.plotW() / 2 : ((index - a) / (n - 1)) * this.plotW());
  }

  protected readonly xTicks = computed(() => {
    const [a, b] = this.span();
    const maxTicks = Math.max(2, Math.floor(this.plotW() / 74));
    const step = Math.max(1, Math.ceil(this.count() / maxTicks));
    const out: number[] = [];
    for (let i = a; i <= b; i += step) out.push(i);
    return out;
  });

  private pointsOf(values: readonly (number | null)[]): (XY | null)[] {
    const [a, b] = this.span();
    const y = this.yScale();
    return values.slice(a, b + 1).map((v, i) => (v === null ? null : { x: this.xAt(a + i), y: y(v) }));
  }

  protected readonly drawn = computed<readonly DrawnSeries[]>(() =>
    this.visibleSeries().map((s) => {
      const pts = this.pointsOf(s.values);
      const baseline = MARGIN.top + this.plotH();
      const last = [...pts].reverse().find((p) => p !== null) ?? null;
      const lastValue = [...s.values.slice(this.span()[0], this.span()[1] + 1)].reverse().find((v) => v !== null) ?? null;
      return {
        id: s.id,
        label: s.label,
        color: s.color,
        d: linePath(pts),
        area: this.area() ? areaPath(pts, baseline) : '',
        dash: s.dashed ? '6 3' : DASH[s.color] ?? '',
        last,
        lastValue,
      };
    }),
  );

  protected readonly ghost = computed(() => {
    const c = this.compare();
    return c ? linePath(this.pointsOf(c)) : '';
  });

  protected readonly refDrawn = computed(() =>
    this.refs().map((r) => ({ ...r, y: this.yScale()(r.value) })),
  );

  protected readonly bandRect = computed(() => {
    const band = this.band();
    if (!band) return null;
    const y = this.yScale();
    return { y: y(band.high), h: Math.max(0, y(band.low) - y(band.high)), label: band.label };
  });

  /** Etiquetas directas al final de cada línea, separadas para que no se pisen. */
  protected readonly endLabels = computed<readonly EndLabel[]>(() => {
    if (this.width() < 520) return [];
    const raw: EndLabel[] = [
      ...this.drawn().filter((s) => s.last).map((s) => ({ key: s.id, text: s.label, y: s.last!.y, kind: 'series', color: s.color })),
      ...this.refDrawn().map((r) => ({ key: r.id, text: r.label, y: r.y, kind: r.kind, color: 0 })),
    ].sort((a, b) => a.y - b.y);
    let prev = -Infinity;
    return raw.map((l) => {
      const y = Math.max(l.y, prev + LABEL_GAP);
      prev = y;
      return { ...l, y };
    });
  });

  protected readonly hoverInfo = computed(() => {
    const i = this.hover();
    if (i === null) return null;
    const unit = this.unit();
    const rows = this.visibleSeries().map((s) => ({ id: s.id, label: s.label, color: s.color, value: formatValue(s.values[i] ?? null, unit) }));
    const primary = this.visibleSeries()[0]?.values[i] ?? null;
    const refs = this.refs().map((r) => ({
      id: r.id,
      label: r.label,
      value: formatValue(r.value, unit),
      delta: primary !== null && r.value !== 0 ? formatChange((primary - r.value) / r.value) : null,
    }));
    const prev = this.compare()?.[i] ?? null;
    const first = this.visibleSeries()[0]?.values[i] ?? null;
    return {
      index: i,
      label: this.labels()[i] ?? '',
      rows,
      refs,
      previous: this.compare() ? { label: this.compareLabel(), value: formatValue(prev, unit), delta: prev !== null && prev !== 0 && first !== null ? formatChange((first - prev) / prev) : null } : null,
      x: this.xAt(i),
    };
  });

  protected readonly tipLeft = computed(() => {
    const info = this.hoverInfo();
    if (!info) return 0;
    const w = this.width();
    return info.x > w * 0.6 ? Math.max(8, info.x - 216) : Math.min(w - 216, info.x + 14);
  });

  protected readonly tableRows = computed(() => {
    const [a, b] = this.span();
    return this.labels().slice(a, b + 1).map((label, i) => [label, ...this.series().map((s) => formatValue(s.values[a + i] ?? null, this.unit()))]);
  });

  protected axis(value: number): string {
    return formatAxis(value, this.unit());
  }

  protected toggle(id: string): void {
    const next = new Set(this.hidden());
    if (next.has(id)) next.delete(id);
    else if (this.series().length - next.size > 1) next.add(id);
    this.hidden.set(next);
  }

  private indexAt(event: PointerEvent): number {
    const svg = event.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * this.width();
    const [a, b] = this.span();
    const n = this.count();
    const ratio = n <= 1 ? 0 : (x - this.margin().left) / this.plotW();
    return Math.min(b, Math.max(a, a + Math.round(ratio * (n - 1))));
  }

  protected onMove(event: PointerEvent): void {
    const i = this.indexAt(event);
    this.hover.set(i);
    if (this.dragFrom() !== null) this.dragTo.set(i);
  }

  protected onDown(event: PointerEvent): void {
    this.dragFrom.set(this.indexAt(event));
    this.dragTo.set(null);
  }

  protected onUp(event: PointerEvent): void {
    const from = this.dragFrom();
    const to = this.indexAt(event);
    this.dragFrom.set(null);
    this.dragTo.set(null);
    if (from !== null && Math.abs(to - from) >= 3) this.zoom.set([Math.min(from, to), Math.max(from, to)]);
  }

  protected resetZoom(): void {
    this.zoom.set(null);
  }

  protected onKey(event: KeyboardEvent): void {
    const [a, b] = this.span();
    const current = this.hover() ?? a - 1;
    if (event.key === 'ArrowRight') this.hover.set(Math.min(b, current + 1));
    else if (event.key === 'ArrowLeft') this.hover.set(Math.max(a, current <= a ? a : current - 1));
    else if (event.key === 'Escape') this.hover.set(null);
    else return;
    event.preventDefault();
  }

  protected readonly dragRect = computed(() => {
    const from = this.dragFrom();
    const to = this.dragTo();
    if (from === null || to === null) return null;
    const x1 = this.xAt(Math.min(from, to));
    const x2 = this.xAt(Math.max(from, to));
    return { x: x1, w: x2 - x1 };
  });
}
