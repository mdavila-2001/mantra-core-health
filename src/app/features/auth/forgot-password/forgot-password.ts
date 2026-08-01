import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LOGIN_PATH } from '../../../core/auth/auth.guard';
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

/**
 * Solicitud de restablecimiento de contraseña (UC-01-13).
 *
 * ## Esta pantalla no puede decir si la cuenta existe
 *
 * Y no es una limitación: es el punto. El backend responde **202 y el mismo mensaje siempre**,
 * exista o no el correo, porque un «no encontramos esa dirección» convertiría un formulario público
 * en un oráculo de qué personas tienen cuenta en una plataforma de salud.
 *
 * De ahí sale la regla que gobierna el código de abajo: **el resultado exitoso no se interpreta.**
 * No se cuenta, no se ramifica, no se completa con un «revisá tu bandeja si estás registrado». Se
 * muestra el mensaje que vino y se deja de preguntar. Cualquier cosa que la pantalla agregue por su
 * cuenta corre el riesgo de filtrar justo lo que el backend se cuidó de no decir.
 *
 * ## Un solo campo, no la unión del login
 *
 * El backend acepta `identifier` sin distinguir correo de documento. Acá tampoco se pregunta:
 * como la respuesta es idéntica en los dos casos, hacer elegir sería un clic que no cambia nada.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [Alert, AppButton, AuthLayout, FormField, Input, Link, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  private readonly iam = inject(IamClient);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly loginPath = LOGIN_PATH;

  protected readonly form = this.formBuilder.nonNullable.group({
    identifier: this.formBuilder.nonNullable.control('', Validators.required),
  });

  protected readonly isSubmitting = signal(false);

  /** El mensaje que devolvió la API, tal cual. `null` mientras no se haya enviado nada. */
  protected readonly sentMessage = signal<string | null>(null);

  protected readonly failure = signal<ViewState<never> | null>(null);

  protected readonly failureMessages = computed<readonly string[]>(() => {
    const state = this.failure();
    if (state === null) {
      return [];
    }
    if (isValidation(state)) {
      return state.issues.map((issue) =>
        // El 429 de esta ruta es especialmente probable: son 5 por minuto porque cada solicitud
        // manda un correo. Conviene decir qué hacer, no solo que falló.
        state.retryAfterSeconds === undefined
          ? issue.message
          : `${issue.message} Reintentá en ${state.retryAfterSeconds} segundos.`,
      );
    }
    if (state.status === 'offline') {
      return ['No se pudo contactar al servidor. Revisá tu conexión y volvé a intentar.'];
    }
    if (state.status === 'error') {
      return [`${state.message ?? 'Error inesperado.'} (referencia: ${state.requestId})`];
    }
    return ['No se pudo enviar la solicitud.'];
  });

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting.set(true);
    this.failure.set(null);

    this.iam
      .requestPasswordReset({ identifier: this.form.getRawValue().identifier.trim() })
      .subscribe({
        next: (respuesta) => {
          this.isSubmitting.set(false);
          // Se muestra el mensaje del backend sin agregarle nada. Ver la nota de la clase.
          this.sentMessage.set(respuesta.message);
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.failure.set(viewStateFromHttpError<never>(error));
        },
      });
  }
}
