import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type {
  LabCatalogItem,
  LabSuggestedPrice,
} from '../../../../core/data-access/lab-portal/lab-import.types';
import { withDisplayCurrency } from '../../../../core/money/display-currency';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';

/**
 * One análisis of the study catalog: LOINC, specimen, suggested price and its
 * components, each with its own suggested price. Presentational: selecting it
 * is the container's job.
 */
@Component({
  selector: 'app-lab-catalog-item',
  imports: [Badge, Checkbox],
  templateUrl: './lab-catalog-item.html',
  styleUrl: './lab-catalog-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabCatalogItemCard {
  readonly item = input.required<LabCatalogItem>();
  readonly selected = input(false);
  /** Its section (Hematología), shown because cards are grouped by sample type. */
  readonly section = input<string | null>(null);
  readonly toggled = output<void>();

  /** The amount in Bs, or «Sin precio sugerido» for a component without one. */
  protected priceOf(price: LabSuggestedPrice | null): string {
    return price === null ? 'Sin precio sugerido' : withDisplayCurrency(price.priceBs);
  }
}
