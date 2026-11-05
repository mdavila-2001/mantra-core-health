import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { VerificationBadge } from '../../../../shared/components/atoms/verification-badge/verification-badge';
import type { VerificationStatus } from '../../../../shared/components/atoms/verification-badge/verification-badge.types';

/**
 * «Así ven su perfil sus pacientes»: the real verification badge with the
 * profile's current status, plus what each seal stands for. Presentational.
 */
@Component({
  selector: 'app-seal-preview',
  imports: [NavIcon, VerificationBadge],
  templateUrl: './seal-preview.html',
  styleUrl: './seal-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SealPreview {
  readonly status = input.required<VerificationStatus>();
}
