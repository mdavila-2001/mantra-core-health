import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { formatAxis, formatChange, formatValue } from '../domain/format';
import type { MetricUnit } from '../domain/insights.types';
import { linear, niceTicks } from './chart-math';
import { seriesVar, trackWidth, type BarDatum, type RefLine } from './chart.types';

const ROW_H = 34;

interface DrawnBar {
  readonly datum: BarDatum;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly labelX: number;
  readonly labelY: number;
  readonly text: string;
  readonly tip: string;
}

/**
 * Pregunta que responde: «¿quién rinde mejor?».
 *
 * El eje siempre parte de cero: una barra truncada exagera diferencias. Un
 * elemento sin dato suficiente se dibuja como hueco rotulado, no como barra
 * de cero. Con más de 6 elementos conviene la orientación horizontal ordenada.
 */
@Component({
  selector: 'app-ins-bar-chart',
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ins-chart' },
})
export class BarChart {
  readonly data = input.required<readonly BarDatum[]>();
  readonly unit = input.required<MetricUnit>();
  readonly orientation = input<'v' | 'h'>('v');
  readonly sorted = input(true);
  readonly ref = input<RefLine | null>(null);
  readonly height = input(260);
  readonly selectedId = input<string | null>(null);
  readonly ariaLabel = input.required<string>();
  /** Si es `false` la dirección en la que «mejor» es más alto/bajo no se enfatiza. */
  readonly higherIsBetter = input(true);

  readonly picked = output<string>();

  protected readonly width = trackWidth();
  protected readonly sv = seriesVar;
  protected readonly hover = signal<string | null>(null);

  protected readonly ordered = computed(() => {
    const rows = [...this.data()];
    if (!this.sorted()) return rows;
    const sign = this.higherIsBetter() ? -1 : 1;
    return rows.sort((a, b) => {
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return sign * (a.value - b.value);
    });
  });

  protected readonly svgHeight = computed(() => (this.orientation() === 'h' ? Math.max(120, this.ordered().length * ROW_H + 44) : this.height()));

  protected readonly ticks = computed(() => {
    const values = this.ordered().map((d) => d.value ?? 0);
    const max = Math.max(...values, this.ref()?.value ?? 0, 0);
    return niceTicks(0, max * 1.08 || 1, 5);
  });
  protected readonly domainMax = computed(() => this.ticks()[this.ticks().length - 1] ?? 1);

  protected readonly horizontalLabelWidth = computed(() => (this.width() < 420 ? 96 : 150));

  protected readonly bars = computed<readonly DrawnBar[]>(() => {
    const w = this.width();
    const h = this.svgHeight();
    const unit = this.unit();
    const rows = this.ordered();
    const max = this.domainMax();
    if (this.orientation() === 'h') {
      const left = this.horizontalLabelWidth();
      const right = 72;
      const scale = linear(0, max, left, w - right);
      return rows.map((d, i) => {
        const y = 12 + i * ROW_H;
        const x2 = scale(d.value ?? 0);
        return {
          datum: d,
          x: left,
          y: y + 5,
          w: Math.max(0, x2 - left),
          h: ROW_H - 12,
          labelX: Math.max(left + 6, x2 + 6),
          labelY: y + ROW_H / 2 - 1,
          text: d.value === null ? 'Sin dato suficiente' : formatValue(d.value, unit, true),
          tip: this.tipOf(d),
        };
      });
    }
    const left = 52;
    const right = 8;
    const top = 22;
    const bottom = 46;
    const slot = (w - left - right) / Math.max(1, rows.length);
    const barW = Math.min(64, slot * 0.62);
    const y = linear(0, max, h - bottom, top);
    return rows.map((d, i) => {
      const cx = left + slot * i + slot / 2;
      const top2 = y(d.value ?? 0);
      return {
        datum: d,
        x: cx - barW / 2,
        y: top2,
        w: barW,
        h: Math.max(0, h - bottom - top2),
        labelX: cx,
        labelY: top2 - 6,
        text: d.value === null ? 'Sin dato' : formatValue(d.value, unit, true),
        tip: this.tipOf(d),
      };
    });
  });

  protected readonly refDrawn = computed(() => {
    const ref = this.ref();
    if (!ref) return null;
    const max = this.domainMax();
    if (this.orientation() === 'h') {
      const scale = linear(0, max, this.horizontalLabelWidth(), this.width() - 72);
      return { ...ref, pos: scale(ref.value) };
    }
    return { ...ref, pos: linear(0, max, this.svgHeight() - 46, 22)(ref.value) };
  });

  protected tickPos(tick: number): number {
    const max = this.domainMax();
    return this.orientation() === 'h'
      ? linear(0, max, this.horizontalLabelWidth(), this.width() - 72)(tick)
      : linear(0, max, this.svgHeight() - 46, 22)(tick);
  }

  protected axis(value: number): string {
    return formatAxis(value, this.unit());
  }

  protected slotLabel(label: string): string {
    const limit = this.orientation() === 'h' ? (this.width() < 420 ? 14 : 22) : Math.max(6, Math.floor((this.width() - 60) / Math.max(1, this.ordered().length) / 7));
    return label.length > limit ? `${label.slice(0, limit - 1)}…` : label;
  }

  private tipOf(d: BarDatum): string {
    const ref = this.ref();
    const base = `${d.label}: ${formatValue(d.value, this.unit())}`;
    const delta = ref && d.value !== null && ref.value !== 0 ? ` · ${formatChange((d.value - ref.value) / ref.value)} vs ${ref.label.toLowerCase()}` : '';
    return `${base}${delta}${d.note ? ` · ${d.note}` : ''}`;
  }

  protected readonly tableRows = computed(() => this.ordered().map((d) => [d.label, formatValue(d.value, this.unit()), d.note ?? '']));

  protected pick(id: string): void {
    this.picked.emit(id);
  }
}
