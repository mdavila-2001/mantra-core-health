import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';

/**
 * Loading placeholder shaped like the sheet: summary, figures, tab strip and a
 * row of cards. Three loose bars made the page jump when the real one arrived.
 */
@Component({
  selector: 'app-lab-sheet-skeleton',
  imports: [Skeleton],
  templateUrl: './sheet-skeleton.html',
  styleUrl: './sheet-skeleton.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabSheetSkeleton {}
