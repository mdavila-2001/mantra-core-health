import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { WebPushClient } from '../../../core/data-access/notifications/web-push.client';
import { WEB_PUSH_NOTICES, WebPushService, type WebPushOutcome } from '../../../core/notifications/web-push.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';

/**
 * One-time, dismissible offer of browser push in the private area, for any account
 * the API lets subscribe (`GET /notifications/web-push/config` is for USER and
 * MESSAGING_ADMIN; anyone else gets a 403 and no offer).
 *
 * On each sign-in it also runs `resync`: logout unsubscribes the browser for the
 * next person on a shared device, and this is where push comes back for the same
 * person (and where someone else's leftover subscription is removed).
 *
 * The permission prompt only opens from the «Activar avisos» click (user gesture).
 * `held` (from `ShellNotices`) keeps it hidden while another notice is showing.
 * Styles are the one-time-notice styles of the usage-consent notice, shared on purpose.
 */
@Component({
  selector: 'app-web-push-offer',
  imports: [Alert, AppButton, AppButtonLink, RouterLink],
  templateUrl: './web-push-offer.html',
  styleUrl: '../../ux-consent/ux-consent-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Marks that this sign-in's decision (resync, offer or not) is done: lets a browser
  // test assert «no offer» on a condition instead of a timeout.
  host: { '[attr.data-ready]': 'ready() || null' },
})
export class WebPushOffer {
  private readonly session = inject(SessionStore);
  private readonly client = inject(WebPushClient);
  protected readonly webPush = inject(WebPushService);

  /** Another notice is up: wait. */
  readonly held = input(false);

  protected readonly offering = signal(false);
  protected readonly ready = signal(false);
  /** Why activation did not work; while set, the only actions are «Entendido» (and Settings when blocked). */
  protected readonly failure = signal<Exclude<WebPushOutcome, 'enabled'> | null>(null);
  protected readonly notices = WEB_PUSH_NOTICES;

  constructor() {
    inject(DestroyRef).onDestroy(this.webPush.watchWorker());
    effect(() => {
      const userId = this.session.userId();
      untracked(() => {
        this.offering.set(false);
        this.failure.set(null);
        this.ready.set(false);
        if (userId !== null) void this.prepare(userId).finally(() => this.ready.set(true));
      });
    });
  }

  protected async activate(): Promise<void> {
    this.webPush.markOffered();
    const outcome = await this.webPush.enable();
    if (outcome === 'enabled') this.offering.set(false);
    else this.failure.set(outcome);
  }

  protected dismiss(): void {
    this.webPush.markOffered();
    this.offering.set(false);
  }

  private async prepare(userId: string): Promise<void> {
    await this.webPush.refresh();
    await this.webPush.resync();
    if (!this.webPush.canOffer()) return;
    try {
      const config = await firstValueFrom(this.client.config());
      // The session may have changed while the config was in flight.
      if (config.enabled && this.session.userId() === userId) this.offering.set(true);
    } catch {
      /* without the server config there is nothing to offer */
    }
  }
}
