import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { MedicamentoDelRegistro } from '@core/data-access/public-marketplace/public-marketplace.types';

/**
 * «En el registro sanitario oficial»: what matches the search in the
 * official registries (AGEMED, CIMA, INVIMA, ANVISA), whether or not a
 * pharmacy of the network sells it. Presentational; hidden when empty.
 */
@Component({
  selector: 'app-official-medicines',
  templateUrl: './official-medicines.html',
  styleUrl: './official-medicines.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficialMedicines {
  readonly products = input.required<readonly MedicamentoDelRegistro[]>();
}
