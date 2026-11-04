import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AppButton } from '../../atoms/button/button';

/**
 * «Did you mean» notice for a search that the API corrected.
 *
 * ```html
 * <app-search-correction original="ibopofeno" corrected="ibuprofeno"
 *                        (literalRequested)="buscarTalCual($event)" />
 * ```
 *
 * The API already searched the corrected text: this says so and offers to
 * search what was typed instead. It is a `status`, not an alert: nothing went
 * wrong, the results on screen are the ones it describes.
 */
@Component({
  selector: 'app-search-correction',
  imports: [AppButton],
  templateUrl: './search-correction.html',
  styleUrl: './search-correction.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'search-correction', role: 'status', 'aria-live': 'polite' },
})
export class SearchCorrection {
  /** What the person typed. */
  readonly original = input.required<string>();
  /** What the API actually searched. */
  readonly corrected = input.required<string>();

  /** Emits the original text when the person asks to search it literally. */
  readonly literalRequested = output<string>();
}
