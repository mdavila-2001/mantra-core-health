import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CHART_QUESTIONS, type ChartType, type VizRecommendation } from '../domain/insights.types';
import type { ChartOption } from '../domain/viz-recommender';

/**
 * Selector de visualización con inteligencia.
 *
 * La opción recomendada va primero y es la que está elegida por defecto; dice
 * POR QUÉ se recomienda. La persona puede cambiarla: si elige otra, el sistema
 * lo respeta y le recuerda cuál era la recomendación. Las opciones que no
 * responden bien a la métrica quedan desactivadas con su motivo escrito, no
 * escondidas.
 */
@Component({
  selector: 'app-ins-chart-picker',
  templateUrl: './chart-picker.html',
  styleUrl: './chart-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartPicker {
  readonly options = input.required<readonly ChartOption[]>();
  readonly value = input.required<ChartType>();
  readonly recommendation = input.required<VizRecommendation>();
  readonly picked = output<ChartType>();

  protected readonly questions = CHART_QUESTIONS;
  protected readonly isRecommended = computed(() => this.value() === this.recommendation().recommended);
  protected readonly current = computed(() => this.options().find((o) => o.chart === this.value()));

  protected pick(option: ChartOption): void {
    if (option.available) this.picked.emit(option.chart);
  }

  protected useRecommended(): void {
    this.picked.emit(this.recommendation().recommended);
  }

  protected onKey(event: KeyboardEvent): void {
    const enabled = this.options().filter((o) => o.available);
    const index = enabled.findIndex((o) => o.chart === this.value());
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step || index < 0) return;
    event.preventDefault();
    const next = enabled[(index + step + enabled.length) % enabled.length];
    if (next) this.picked.emit(next.chart);
  }
}
