import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { AccountSecurityClient } from '../../../core/data-access/iam/account-security.client';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import {
  cleanDeviceCode,
  DEVICE_CONFIRM_FAILURE_TEXT,
  deviceConfirmFailureOf,
  isDeviceCodeShape,
} from '../../shell-layout/new-device-banner/new-device-code';

/**
 * Verifies one device with the 8-digit code mailed to the account
 * (`POST /iam/me/devices/:id/confirm-code`, then `…/confirm` with the code).
 */
@Component({
  selector: 'app-device-verify',
  imports: [AppButton, FormField, Input],
  templateUrl: './device-verify.html',
  styleUrl: './my-devices.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceVerify {
  private readonly security = inject(AccountSecurityClient);

  readonly deviceId = input.required<string>();
  readonly verified = output<void>();
  readonly cancelled = output<void>();

  protected readonly sentTo = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly busy = signal(false);
  protected readonly code = signal('');
  protected readonly tried = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected send(): void {
    if (this.sending()) return;
    this.sending.set(true);
    this.failure.set(null);
    this.security.requestDeviceCode(this.deviceId()).subscribe({
      next: (result) => {
        this.sending.set(false);
        // `sent: false`: it was already trusted, nothing left to verify.
        if (!result.sent) return this.verified.emit();
        this.sentTo.set(result.sentTo ?? 'su correo');
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.failure.set(DEVICE_CONFIRM_FAILURE_TEXT[deviceConfirmFailureOf(error)]);
      },
    });
  }

  protected confirm(): void {
    this.tried.set(true);
    if (this.busy() || !isDeviceCodeShape(this.code())) return;
    this.busy.set(true);
    this.failure.set(null);
    this.security.confirmDevice(this.deviceId(), cleanDeviceCode(this.code())).subscribe({
      next: () => this.verified.emit(),
      error: (error: unknown) => {
        this.busy.set(false);
        const reason = deviceConfirmFailureOf(error);
        this.failure.set(DEVICE_CONFIRM_FAILURE_TEXT[reason]);
        if (reason === 'CODE_INVALID') {
          this.code.set('');
          this.tried.set(false);
        }
      },
    });
  }

  protected codeMissing(): boolean {
    return this.tried() && !isDeviceCodeShape(this.code());
  }
}
