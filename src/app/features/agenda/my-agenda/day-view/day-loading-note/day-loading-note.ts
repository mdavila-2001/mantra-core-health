import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Spinner } from '../../../../../shared/components/atoms/spinner/spinner';

/**
 * A short "loading" row above the day line, for a day that already draws
 * something (visits, blocks) but whose slots have not arrived: without it the
 * day would look complete. The container is focusable (`tabindex="-1"`) so
 * the keyboard focus can wait there. The announcement to screen readers is
 * the day summary's, hence the decorative spinner.
 */
@Component({
  selector: 'app-day-loading-note',
  imports: [Spinner],
  template: `
    <div class="nota" data-testid="dia-cargando" tabindex="-1">
      <app-spinner size="sm" [decorative]="true" />
      <p>Cargando los horarios de este día…</p>
    </div>
  `,
  styleUrl: './day-loading-note.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayLoadingNote {}
