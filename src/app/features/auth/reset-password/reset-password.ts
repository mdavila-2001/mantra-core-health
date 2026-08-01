import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from '../../../core/auth/auth.guard';
import { IamClient } from '../../../core/data-access/iam/iam.client';
import { viewStateFromHttpError } from '../../../core/http/api-error';
import { isValidation } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AuthLayout } from '../../../shared/components/organisms/auth-layout/auth-layout';

/** Parámetro con el que llega el token desde el enlace del correo. */
export const RESET_TOKEN_PARAM = 'token';

/** Mínimo que valida el backend (`ResetPasswordDto`). Repetirlo acá evita un 400 evitable. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Elección de la contraseña nueva con el token del correo (UC-01-13).
 *
 * ## El token viene en la URL y no se muestra
 *
 * Llega como `?token=` en el enlace del correo. No se pinta en pantalla ni se ofrece pegarlo a
 * mano: es una credencial de un solo uso, y un campo de texto con el token adentro es un token que
 * queda en una captura de pantalla o en el historial de un portapapeles compartido.
 *
 * Si el enlace llega sin token —copiado a medias, o alguien entró a la ruta a mano— no se muestra
 * el formulario: no habría con qué enviarlo, y dejar escribir una contraseña para después decir
 * que faltaba el token es hacerle perder el tiempo a alguien que ya está teniendo un mal día.
 *
 * ## Cambiar la contraseña cierra todas las sesiones
 *
 * Lo hace el backend, y se le avisa a la persona: quien recupera su cuenta suele hacerlo porque
 * perdió el control de la anterior, así que enterarse de que las demás sesiones se cerraron es
 * parte de la respuesta, no un detalle técnico.
 */
@Component({
  selector: 'app-reset-password',
  imports: [Alert, AppButton, AuthLayout, FormField, Input, Link, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  private readonly iam = inject(IamClient);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly loginPath = LOGIN_PATH;
  protected readonly forgotPath = FORGOT_PASSWORD_PATH;
  protected readonly minLength = MIN_PASSWORD_LENGTH;

  /** El token del enlace. `null` si la ruta llegó sin él. */
  private readonly token = this.route.snapshot.queryParamMap.get(RESET_TOKEN_PARAM);

  protected readonly hasToken = this.token !== null && this.token !== '';

  protected readonly form = this.formBuilder.nonNullable.group({
    newPassword: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.minLength(MIN_PASSWORD_LENGTH),
    ]),
  });

  protected readonly isSubmitting = signal(false);
  protected readonly isDone = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);

  /** Cuántas sesiones cerró el cambio. Se le dice a la persona; el backend lo devuelve. */
  protected readonly revokedSessions = signal(0);

  /** Si ya se intentó enviar. Antes del primer intento no se le marca nada en rojo a nadie. */
  private readonly attempted = signal(false);

  /**
   * Lo escrito, como señal.
   *
   * `toSignal` sobre `valueChanges` y **no** `computed(() => control.invalid)`: los formularios
   * reactivos no son señales, así que un `computed` que lea `.invalid` o `.touched` se calcula una
   * sola vez y nunca se entera de nada. El mensaje de «muy corta» no aparecería al enviar ni se
   * iría al corregirla.
   */
  private readonly password = toSignal(this.form.controls.newPassword.valueChanges, {
    initialValue: this.form.controls.newPassword.value,
  });

  /** Se muestra recién tras el primer intento, y desaparece sola en cuanto la contraseña alcanza. */
  protected readonly tooShort = computed(
    () => this.attempted() && this.password().length < MIN_PASSWORD_LENGTH,
  );

  protected readonly failureMessages = computed<readonly string[]>(() => {
    const state = this.failure();
    if (state === null) {
      return [];
    }
    if (isValidation(state)) {
      return state.issues.map((issue) => issue.message);
    }
    if (state.status === 'offline') {
      return ['No se pudo contactar al servidor. Revisá tu conexión y volvé a intentar.'];
    }
    if (state.status === 'error') {
      return [`${state.message ?? 'Error inesperado.'} (referencia: ${state.requestId})`];
    }
    return ['No se pudo cambiar la contraseña.'];
  });

  protected submit(): void {
    if (this.isSubmitting() || this.token === null) {
      return;
    }

    this.attempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting.set(true);
    this.failure.set(null);

    this.iam
      .resetPassword({ token: this.token, newPassword: this.form.getRawValue().newPassword })
      .subscribe({
        next: (resultado) => {
          this.isSubmitting.set(false);
          this.revokedSessions.set(resultado.revokedSessions);
          this.isDone.set(true);
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.failure.set(viewStateFromHttpError<never>(error));
        },
      });
  }
}
