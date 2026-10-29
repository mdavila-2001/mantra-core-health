import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { COLOR_MODE_LABEL, type ColorMode, type StateVisual } from '../../../../core/floor-plan/state-visuals';
import { PlanGlyphIcon } from '../../atoms/plan-glyph/plan-glyph-icon';

export interface LegendItem {
  readonly visual: StateVisual;
  readonly count: number;
}

/**
 * Leyenda del plano (CONTRATO-PLANO §5.2 y §5.4): lista con recuentos que además
 * es un **filtro**. Pulsar un valor lo oculta o lo atenúa en el plano. Cada valor
 * trae su muestra (color + patrón), glifo y texto: nunca solo color.
 */
@Component({
  selector: 'app-plan-legend',
  imports: [PlanGlyphIcon],
  templateUrl: './plan-legend.html',
  styleUrl: './plan-legend.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'plan-legend' },
})
export class PlanLegend {
  readonly mode = input.required<ColorMode>();
  readonly items = input.required<readonly LegendItem[]>();
  readonly hiddenKeys = input<ReadonlySet<string>>(new Set());
  /** Mensaje cuando el modo no tiene valores (Ninguno) o el rol no ve estado. */
  readonly note = input<string | null>(null);

  readonly toggled = output<string>();

  protected readonly title = computed(() => COLOR_MODE_LABEL[this.mode()]);
  protected readonly total = computed(() => this.items().reduce((sum, item) => sum + item.count, 0));
}
