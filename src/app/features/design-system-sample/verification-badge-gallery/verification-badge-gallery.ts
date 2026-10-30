import { ChangeDetectionStrategy, Component } from '@angular/core';

import { VERIFICATION_STATUSES } from '../../../core/verification/verification-status';
import { VerificationBadge } from '../../../shared/components/atoms/verification-badge/verification-badge';
import { VERIFICATION_BADGE_SIZES } from '../../../shared/components/atoms/verification-badge/verification-badge.types';

/**
 * La insignia de verificación en la hoja de componentes: los cinco estados, las
 * dos variantes y los tres tamaños junto a un nombre. Es sólo lectura; el estado
 * lo decide la API, y acá se fija a mano para poder verlos todos.
 */
@Component({
  selector: 'app-verification-badge-gallery',
  imports: [VerificationBadge],
  templateUrl: './verification-badge-gallery.html',
  styleUrl: './verification-badge-gallery.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationBadgeGallery {
  protected readonly verificationStatuses = VERIFICATION_STATUSES;
  protected readonly verificationSizes = VERIFICATION_BADGE_SIZES;
}
