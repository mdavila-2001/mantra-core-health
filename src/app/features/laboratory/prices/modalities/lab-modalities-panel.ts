import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { LabService } from '../../../../core/data-access/lab-portal/lab-portal.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';

/**
 * The modalities the unit declared when it signed up (`MODALITY_*`). The
 * public directory reads them as "this center does X-rays"; they are not
 * sellable studies and carry no price, so the panel says what to load instead.
 */
@Component({
  selector: 'app-lab-modalities-panel',
  imports: [Alert, AppButton, Badge],
  templateUrl: './lab-modalities-panel.html',
  styleUrl: './lab-modalities-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabModalitiesPanel {
  readonly modalities = input.required<readonly LabService[]>();
  readonly importRequested = output<void>();
}
