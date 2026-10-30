import { DestroyRef, ElementRef, afterNextRender, inject, signal, type Signal } from '@angular/core';

import type { MetricUnit } from '../domain/insights.types';

/** Un punto de una serie: `null` es un hueco (dato no medido), nunca cero. */
export interface LineSeries {
  readonly id: string;
  readonly label: string;
  readonly values: readonly (number | null)[];
  /** Índice de color 1–6 en la paleta de series. */
  readonly color: number;
  readonly dashed?: boolean;
}

export type RefKind = 'benchmark' | 'target' | 'alert' | 'critical' | 'history';

export interface RefLine {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly kind: RefKind;
}

export interface Band {
  readonly low: number;
  readonly high: number;
  readonly label: string;
}

export interface ChartTable {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface ChartCommon {
  readonly unit: MetricUnit;
}

export interface BarDatum {
  readonly id: string;
  readonly label: string;
  /** `null` = sin dato suficiente: se dibuja como hueco rotulado. */
  readonly value: number | null;
  readonly note?: string;
  readonly color?: number;
}

export interface StackSegment {
  readonly id: string;
  readonly label: string;
  readonly color: number;
}

export interface StackRow {
  readonly id: string;
  readonly label: string;
  readonly values: Readonly<Record<string, number>>;
}

export const REF_LABELS: Readonly<Record<RefKind, string>> = {
  benchmark: 'Benchmark',
  target: 'Objetivo',
  alert: 'Umbral de alerta',
  critical: 'Umbral crítico',
  history: 'Promedio histórico',
};

/**
 * Ancho disponible del host. Se mide con `ResizeObserver` después del primer
 * render del navegador; bajo SSR queda el valor por omisión y no se toca `window`.
 * Debe llamarse en un contexto de inyección (inicializador de campo).
 */
export function trackWidth(fallback = 640): Signal<number> {
  const host = inject<ElementRef<HTMLElement>>(ElementRef);
  const destroyRef = inject(DestroyRef);
  const width = signal(fallback);
  afterNextRender(() => {
    const element = host.nativeElement;
    const initial = Math.round(element.getBoundingClientRect().width);
    if (initial > 0) width.set(initial);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) width.set(next);
    });
    observer.observe(element);
    destroyRef.onDestroy(() => observer.disconnect());
  });
  return width.asReadonly();
}

/** Color de una serie (1–6) como referencia a su token; las hojas no ven concatenaciones. */
export function seriesVar(index: number): string {
  return `var(--ins-s${index})`;
}
