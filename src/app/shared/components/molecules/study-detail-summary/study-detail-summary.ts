import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type {
  ServiceRequestComponent,
  ServiceRequestImaging,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import { CardDetailPanel } from '../card-detail-panel/card-detail-panel';
import { studyDetailRows } from './study-detail-summary.logic';

/**
 * El resumen de lo que se pidió de un estudio, con su detalle completo a un
 * clic. Un solo componente para el centro que recibe la orden, el paciente que
 * la ve y el histórico del médico.
 *
 * ```html
 * <app-study-detail-summary
 *   heading="Hemograma completo"
 *   [summary]="order.summary"
 *   [specimen]="order.detail?.specimenTypeDisplay"
 *   [components]="order.detail?.components"
 *   [componentsSpecified]="order.detail?.componentsSpecified"
 *   [imaging]="order.detail?.imaging"
 * />
 * ```
 *
 * ## Entradas (todas puras; ninguna pide datos)
 *
 * - `heading` — título del panel (el nombre del estudio). Requerido.
 * - `summary` — la línea corta, ya armada por el servidor («3 componentes»,
 *   «Mano · Izquierda · sin contraste»). `null`/vacío: no se dibuja la línea.
 * - `specimen` — nombre legible de la muestra.
 * - `components` + `componentsSpecified` — `false` sin componentes = «Estudio
 *   completo, sin detalle».
 * - `imaging` — modalidad, región, lateralidad y contraste (con `imaging` no se
 *   listan componentes).
 * - `triggerLabel` — nombre accesible del botón del panel.
 *
 * Si no hay ninguna fila de detalle el botón no se dibuja: no se ofrece un
 * panel vacío. El panel es `app-card-detail-panel`: clic, Escape cierra, no
 * empuja a sus vecinos.
 */
@Component({
  selector: 'app-study-detail-summary',
  imports: [CardDetailPanel],
  templateUrl: './study-detail-summary.html',
  styleUrl: './study-detail-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyDetailSummary {
  readonly heading = input.required<string>();
  readonly summary = input<string | null | undefined>(null);
  readonly specimen = input<string | null | undefined>(null);
  readonly components = input<readonly ServiceRequestComponent[] | null | undefined>(null);
  readonly componentsSpecified = input<boolean | undefined>(true);
  readonly imaging = input<ServiceRequestImaging | null | undefined>(null);
  readonly triggerLabel = input('Ver el detalle del estudio');

  protected readonly rows = computed(() =>
    studyDetailRows({
      specimen: this.specimen(),
      components: this.components(),
      componentsSpecified: this.componentsSpecified(),
      imaging: this.imaging(),
    }),
  );
}
