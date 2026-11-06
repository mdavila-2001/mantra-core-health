import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { NewDeviceAlert } from '../../../core/auth/new-device-alert';
import { SessionStore } from '../../../core/auth/session.store';
import { UxConsent } from '../../../core/observability/consent/ux-consent.service';
import { UxConsentNotice } from '../../ux-consent/ux-consent-notice';
import { DeniedTenantsBanner } from '../denied-tenants-banner/denied-tenants-banner';
import { WebPushOffer } from '../web-push-offer/web-push-offer';

/**
 * The optional notices of the private area, in the flow above the content and in a
 * fixed order: denied organizations, usage-measurement consent, push offer. The
 * new-device security notice stays in the shell itself, eager, right above these.
 *
 * The push offer waits while any other notice (the new-device one included) is up:
 * never two calls to action at once. The shell loads this component as its own chunk
 * (`@defer (on immediate)`): none of these is needed to paint the first screen.
 */
@Component({
  selector: 'app-shell-notices',
  imports: [DeniedTenantsBanner, UxConsentNotice, WebPushOffer],
  templateUrl: './shell-notices.html',
  styleUrl: './shell-notices.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellNotices {
  private readonly newDevice = inject(NewDeviceAlert);
  private readonly session = inject(SessionStore);
  private readonly consent = inject(UxConsent);

  /** Denied organizations hold it for the whole session (their banner can be dismissed but not undone). */
  protected readonly pushHeld = computed(
    () =>
      this.newDevice.notice() !== null ||
      this.session.deniedTenants().length > 0 ||
      this.consent.avisoVisible(),
  );
}
