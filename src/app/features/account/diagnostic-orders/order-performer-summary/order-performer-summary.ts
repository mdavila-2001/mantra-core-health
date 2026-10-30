import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { PerformerSelectionCode } from '../../../../core/data-access/diagnostics/service-request-performer.types';
import { orderPerformerText } from './order-performer-text';

/**
 * Quién hace el procedimiento, según el médico, visto por el paciente: el modo, la
 * sede que sugirió (por su nombre) y el aviso de que es una recomendación.
 *
 * Sin modo no pinta nada: una orden vieja, o una API que todavía no trae el campo,
 * no se completa con una suposición.
 */
@Component({
  selector: 'app-order-performer-summary',
  templateUrl: './order-performer-summary.html',
  styleUrl: './order-performer-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderPerformerSummary {
  /** El modo resuelto desde el código del concepto, o `null` si la orden no lo trae. */
  readonly mode = input<PerformerSelectionCode | null>(null);
  /** El nombre de la sede sugerida; nunca su uuid. */
  readonly siteName = input<string | null>(null);

  protected readonly text = computed(() => {
    const mode = this.mode();
    return mode === null ? null : orderPerformerText(mode, this.siteName());
  });
}
