import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { MfaReauth } from '../../../core/data-access/iam/mfa.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { cleanCode, isCodeShape } from './mfa-code';
import type { ReauthMode } from './mfa-reauth';

/**
 * El paso de **reautenticación** antes de dar de alta o quitar un método de segundo paso: la persona prueba que es
 * ella con su contraseña actual o —si ya tiene un método activo— con el código de su aplicación.
 *
 * Solo recoge la prueba y la entrega: **no** la guarda ni la manda a ningún lado que no sea quien lo usa (la
 * contraseña no queda en una señal más de lo que dura el envío). Quien lo usa llama a la API, que decide.
 */
@Component({
  selector: 'app-mfa-reauth-form',
  imports: [Alert, AppButton, FormField, Input],
  templateUrl: './mfa-reauth-form.html',
  styleUrl: './mfa-reauth-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaReauthForm {
  /** Qué se está confirmando, para el título: «Para activar un método nuevo» / «Para quitar este método». */
  readonly reason = input.required<string>();
  /** Si la cuenta ya tiene un método activo, se puede probar con su código. */
  readonly canUseCode = input(false);
  readonly busy = input(false);
  readonly failure = input<string | null>(null);
  readonly submitLabel = input('Continuar');
  /** Prefijo de los `data-testid`: la pantalla usa dos de estos formularios y no se pisan. */
  readonly prefix = input('reauth');

  readonly proven = output<MfaReauth>();
  readonly cancelled = output<void>();

  protected readonly mode = signal<ReauthMode>('PASSWORD');
  protected readonly password = signal('');
  protected readonly code = signal('');
  protected readonly tried = signal(false);

  protected readonly missing = computed(() => (this.mode() === 'PASSWORD' ? this.password().trim() === '' : !isCodeShape(this.code())));

  protected setMode(mode: ReauthMode): void {
    this.mode.set(mode);
    this.tried.set(false);
  }

  protected submit(): void {
    this.tried.set(true);
    if (this.busy() || this.missing()) return;
    if (this.mode() === 'PASSWORD') {
      this.proven.emit({ currentPassword: this.password() });
      // No se conserva: si hay que volver a probar, se vuelve a escribir.
      this.password.set('');
    } else {
      this.proven.emit({ mfaCode: cleanCode(this.code()) });
      this.code.set('');
    }
  }
}
