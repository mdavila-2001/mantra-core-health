import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { ModalityCode } from '../../../../core/data-access/diagnostic-units/modalidades';

/**
 * Marketplace-style thumbnail of a catalog device: the manufacturer photo when
 * the catalog has one (`src`), otherwise a line illustration of its kind of
 * equipment. Purely decorative: the row already names the device.
 */
@Component({
  selector: 'app-equipment-thumb',
  templateUrl: './equipment-thumb.html',
  styleUrl: './equipment-thumb.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentThumb {
  /** `null`: lab analyzer. */
  readonly kind = input.required<ModalityCode | null>();
  /** Product photo URL; falls back to the illustration when absent or empty. */
  readonly src = input<string | null>(null);
}
