import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NewDeviceAlert } from '../../../core/auth/new-device-alert';
import { AccountSecurityClient } from '../../../core/data-access/iam/account-security.client';
import { Input } from '../../../shared/components/atoms/input/input';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { cleanDeviceCode, DEVICE_CONFIRM_FAILURE_TEXT, deviceConfirmFailureOf, isDeviceCodeShape } from './new-device-code';

/**
 * **Aviso de dispositivo nuevo**, a la vista tras iniciar sesión cuando la API
 * lo indica (política de sesión `newDeviceAlert` de la organización).
 *
 * Dos respuestas, ninguna más: «Fui yo» reconoce el dispositivo y el aviso no
 * vuelve a salir por él —pero **solo con prueba**: el aviso lo ve quien inicia sesión, que puede ser quien no
 * debe, así que confirmar desde el propio dispositivo exige el código de 8 dígitos que se manda al correo
 * verificado (a menos que se confirme desde otra sesión en un dispositivo de confianza)—; «No fui yo, cerrar otras sesiones» le pide a la API
 * (`POST /iam/me/devices/:id/not-me`) que cierre todas las otras sesiones de la
 * cuenta y manda a cambiar la contraseña. El aviso no
 * se puede ignorar sin responder más que con «Más tarde», que lo oculta hasta
 * la próxima entrada: no hay un botón de cerrar que parezca resolverlo.
 *
 * Es presentación: nada de esto abre ni cierra una sesión por su cuenta, lo
 * hace la API cuando se le pide.
 */
@Component({
  selector: 'app-new-device-banner',
  imports: [Alert, AppButton, AppButtonLink, FormField, Input, RouterLink],
  templateUrl: './new-device-banner.html',
  styleUrl: './new-device-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewDeviceBanner {
  private readonly alert = inject(NewDeviceAlert);
  private readonly security = inject(AccountSecurityClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly notice = this.alert.notice;
  protected readonly busy = signal(false);
  /** Lo que se hizo con «No fui yo»: se queda a la vista hasta que la persona lo lea. */
  protected readonly closedOthers = signal<number | null>(null);
  protected readonly failure = signal<string | null>(null);

  /** El paso del código: se abre cuando la API dice que hace falta (`DEVICE_CONFIRM_CODE_REQUIRED`). */
  protected readonly askingCode = signal(false);
  /** A qué dirección (enmascarada) salió el código, una vez pedido. */
  protected readonly sentTo = signal<string | null>(null);
  protected readonly requestingCode = signal(false);
  protected readonly code = signal('');
  protected readonly codeTried = signal(false);

  protected readonly when = computed(() => {
    const aviso = this.notice();
    return aviso === null
      ? ''
      : aviso.occurredAt.toLocaleString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  });

  /** «Fui yo»: se intenta sin código (vale si hay otra sesión en un dispositivo de confianza); si la API lo pide, se abre el paso del código. */
  protected itWasMe(): void {
    const aviso = this.notice();
    if (aviso === null || this.busy()) return;
    this.busy.set(true);
    this.failure.set(null);
    this.security.confirmDevice(aviso.deviceId).subscribe({
      next: () => this.confirmed(),
      error: (error: unknown) => {
        this.busy.set(false);
        if (deviceConfirmFailureOf(error) === 'CODE_REQUIRED') {
          this.askingCode.set(true);
          return;
        }
        this.failure.set(DEVICE_CONFIRM_FAILURE_TEXT[deviceConfirmFailureOf(error)]);
      },
    });
  }

  /** `POST …/confirm-code`: el código sale al correo verificado; se muestra la dirección enmascarada. */
  protected sendCode(): void {
    const aviso = this.notice();
    if (aviso === null || this.requestingCode()) return;
    this.requestingCode.set(true);
    this.failure.set(null);
    this.security.requestDeviceCode(aviso.deviceId).subscribe({
      next: (enviado) => {
        this.requestingCode.set(false);
        this.sentTo.set(enviado.sent ? (enviado.sentTo ?? 'su correo') : null);
        // `sent: false` es que el dispositivo ya era de confianza: no queda nada que confirmar.
        if (!enviado.sent) this.confirmed();
      },
      error: (error: unknown) => {
        this.requestingCode.set(false);
        this.failure.set(DEVICE_CONFIRM_FAILURE_TEXT[deviceConfirmFailureOf(error)]);
      },
    });
  }

  /** `POST …/confirm` con el código escrito. */
  protected confirmWithCode(): void {
    const aviso = this.notice();
    this.codeTried.set(true);
    if (aviso === null || this.busy() || !isDeviceCodeShape(this.code())) return;
    this.busy.set(true);
    this.failure.set(null);
    this.security.confirmDevice(aviso.deviceId, cleanDeviceCode(this.code())).subscribe({
      next: () => this.confirmed(),
      error: (error: unknown) => {
        this.busy.set(false);
        this.failure.set(DEVICE_CONFIRM_FAILURE_TEXT[deviceConfirmFailureOf(error)]);
        if (deviceConfirmFailureOf(error) === 'CODE_INVALID') this.code.set('');
      },
    });
  }

  protected cancelCode(): void {
    this.askingCode.set(false);
    this.sentTo.set(null);
    this.code.set('');
    this.codeTried.set(false);
    this.failure.set(null);
  }

  protected codeMissing(): boolean {
    return this.codeTried() && !isDeviceCodeShape(this.code());
  }

  private confirmed(): void {
    this.busy.set(false);
    this.cancelCode();
    this.alert.dismiss();
    this.toasts.success('Listo, reconocimos este dispositivo.');
  }

  protected async itWasNotMe(): Promise<void> {
    const aviso = this.notice();
    if (aviso === null || this.busy()) return;
    const confirmed = await this.dialogs.confirm({
      title: 'Cerrar las otras sesiones',
      message:
        'Se cierran todas las sesiones de su cuenta menos esta, en cualquier otro dispositivo. Después le conviene cambiar su contraseña.',
      confirmLabel: 'Cerrar otras sesiones',
      destructive: true,
    });
    if (!confirmed) return;
    this.busy.set(true);
    this.failure.set(null);
    this.security.reportDeviceNotMe(aviso.deviceId).subscribe({
      next: ({ revokedSessions }) => {
        this.busy.set(false);
        this.closedOthers.set(revokedSessions);
      },
      error: () => {
        this.busy.set(false);
        this.failure.set('No pudimos cerrar las otras sesiones. Vuelva a intentarlo.');
      },
    });
  }

  protected later(): void {
    this.cancelCode();
    this.closedOthers.set(null);
    this.alert.dismiss();
  }
}
