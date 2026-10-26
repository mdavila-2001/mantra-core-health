import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { GlossaryNeighbor } from '@core/data-access/terminology/terminology.types';
import { Tooltip } from '../../atoms/tooltip/tooltip';
import { neighborEvidenceView } from './relation-evidence.logic';

/**
 * La evidencia de una relación del glosario (TAREA-41 F5.1): barra de fuerza
 * con la frecuencia en palabras y el sello de la fuente.
 *
 * ```html
 * <app-relation-evidence [neighbor]="vecino" />
 * ```
 *
 * La barra es decorativa (`aria-hidden`): lo que se lee son las palabras. El
 * sello es enfocable para que su globo de ayuda —qué fuentes respaldan ese
 * nivel— también se abra con el teclado. Si el vecino no trae evidencia, no
 * pinta nada.
 */
@Component({
  selector: 'app-relation-evidence',
  imports: [Tooltip],
  templateUrl: './relation-evidence.html',
  styleUrl: './relation-evidence.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelationEvidence {
  readonly neighbor = input.required<GlossaryNeighbor>();

  protected readonly evidence = computed(() => neighborEvidenceView(this.neighbor()));
}
