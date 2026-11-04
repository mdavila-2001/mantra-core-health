import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { TarjetaDeMedicamento } from '@core/data-access/public-marketplace/public-marketplace.types';
import { SearchCorrection } from '@shared/components/molecules/search-correction/search-correction';

import { brandMatchOf, usesMatchedOf } from './search-notice.logic';

/**
 * What the showcase says about the search that produced the results:
 *
 * - the API corrected a typo → «Mostrando resultados para …» (`SearchCorrection`);
 * - the search was by what it is for → which therapeutic group, and that it
 *   is a classification, not a prescription (B-13);
 * - the search was by brand → its active ingredient.
 *
 * Presentational: the listing owns the query and the results.
 */
@Component({
  selector: 'app-vitrina-search-notice',
  imports: [SearchCorrection],
  templateUrl: './search-notice.html',
  styleUrl: './search-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VitrinaSearchNotice {
  readonly term = input.required<string>();
  readonly correctedQuery = input<string | null>(null);
  readonly medications = input.required<readonly TarjetaDeMedicamento[]>();

  /** The literal text to search, without correction. */
  readonly literalRequested = output<string>();

  protected readonly usos = computed(() => usesMatchedOf(this.medications()));
  protected readonly marca = computed(() =>
    this.usos().length > 0
      ? null
      : brandMatchOf(this.correctedQuery() ?? this.term(), this.medications()),
  );
}
