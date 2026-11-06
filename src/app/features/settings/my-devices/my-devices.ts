import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { AccountSecurityClient } from '../../../core/data-access/iam/account-security.client';
import type { MyDevice } from '../../../core/data-access/iam/iam-new-device';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { LoadingState } from '../../../shared/components/molecules/loading-state/loading-state';
import { DeviceVerify } from './device-verify';

type Load = 'loading' | 'error' | 'ready';

/**
 * «Ajustes › Dispositivos»: where the account signed in from (`GET /iam/me/devices`), and the
 * way to verify one with the code mailed to the account's verified address.
 *
 * The API owns the list and the trust flag; after verifying, the list is read again instead of
 * patched locally, so what the screen shows is what was persisted.
 */
@Component({
  selector: 'app-my-devices',
  imports: [Alert, AppButton, Badge, DeviceVerify, LoadingState, NavIcon],
  templateUrl: './my-devices.html',
  styleUrl: './my-devices.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyDevices implements OnInit {
  private readonly security = inject(AccountSecurityClient);

  protected readonly load = signal<Load>('loading');
  protected readonly devices = signal<readonly MyDevice[]>([]);
  /** Device whose code form is open. */
  protected readonly verifying = signal<string | null>(null);
  protected readonly loadedAt = signal<Date | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.load.set('loading');
    this.security.listMyDevices().subscribe({
      next: (devices) => {
        this.devices.set(devices);
        this.loadedAt.set(new Date());
        this.load.set('ready');
      },
      error: () => this.load.set('error'),
    });
  }

  protected verified(): void {
    this.verifying.set(null);
    this.reload();
  }

  /**
   * A phone for a mobile platform, a screen for everything else. The platform the API declares
   * wins; without it, the name it composed («Chrome en iOS») still says which one it is.
   */
  protected iconOf(device: MyDevice): NavIconName {
    if (device.platform === 'IOS' || device.platform === 'ANDROID') {
      return 'phone';
    }
    return /\b(ios|ipados|iphone|ipad|android)\b/i.test(device.name) ? 'phone' : 'monitor';
  }

  protected when(date: Date | undefined): string {
    return date === undefined
      ? 'sin registro'
      : date.toLocaleString('es-BO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
