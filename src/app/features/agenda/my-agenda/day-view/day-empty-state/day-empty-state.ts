import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Spinner } from '../../../../../shared/components/atoms/spinner/spinner';
import type { DayState } from '../../day-load';

/**
 * What a day with no blocks to draw says.
 *
 * An empty day is not always a free day: while its reads are in flight
 * (`loading`) or if one failed (`error`) it claims neither "No atiende este
 * día" nor the flexible schedule. Only with everything read (`ready`) does it.
 * Screen readers hear the load from the day summary, so the spinner is
 * decorative. While loading the container is focusable (`tabindex="-1"`) so
 * the keyboard focus has somewhere to wait for the day.
 */
@Component({
  selector: 'app-day-empty-state',
  imports: [AppButton, Spinner],
  templateUrl: './day-empty-state.html',
  styleUrl: './day-empty-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayEmptyState {
  /** What the day may claim. */
  readonly state = input<DayState>('ready');

  /** The range of a flexible-hours day, or `null` if it is not one. */
  readonly flexibleSchedule = input<string | null>(null);

  /** Asked to add a booking or a busy stretch. */
  readonly create = output<void>();
}
