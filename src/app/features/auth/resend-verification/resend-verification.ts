import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';

/** Largos que exige `ResendVerificationDto`. */
const MIN_IDENTIFICADOR = 3;
const MAX_IDENTIFICADOR = 320;

/**
 * Reenviar el enlace de verificación del correo — vista **V01-14**
 * (`POST /iam/auth/resend-verification`).
 *
 * ## Se pide el identificador, no el correo de destino
 *
 * La razón la escribe el propio DTO del backend: dejar elegir a dónde se manda
 * el enlace convertiría este formulario en **un modo de enviar el token de una
 * cuenta ajena a una bandeja propia**. Se pide con qué inicia sesión la
 * persona; a dónde se manda lo decide el servidor.
 *
 * ## La respuesta no confirma ni desmiente
 *
 * El backend devuelve **siempre el mismo mensaje**, exista o no la cuenta, y la
 * pantalla lo respeta: mostrar «ese correo no está registrado» permitiría
 * averiguar quién tiene cuenta probando direcciones. Es la misma decisión que
 * ya toma la recuperación de contraseña.
 *
 * Por eso el estado de éxito **no dice «te lo mandamos»** —eso afirmaría que la
 * cuenta existe— sino «si la cuenta existe, va en camino».
 */
@Component({
  selector: 'app-resend-verification',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormField,
    Input,
    Link,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './resend-verification.html',
  styleUrl: './resend-verification.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResendVerification {
  private readonly iam = inject(IamClient);

  protected readonly form = new FormGroup({
    identifier: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(MIN_IDENTIFICADOR),
        Validators.maxLength(MAX_IDENTIFICADOR),
      ],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly done = signal(false);

  /**
   * El endpoint está limitado a 5 intentos por minuto. Cuando el servidor lo
   * dice, se muestra la espera en vez de un «error» que invita a insistir.
   */
  protected readonly esperaEnSegundos = computed<number | null>(() => {
    const state = this.state();
    return state.status === 'validation' ? (state.retryAfterSeconds ?? null) : null;
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (this.esperaEnSegundos() !== null) {
      return null;
    }
    if (state.status === 'validation') {
      return state.issues[0]?.message ?? null;
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.iam.resendVerification(this.form.getRawValue().identifier.trim()).subscribe({
      next: () => {
        this.state.set(ready(null));
        this.done.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /** Vuelve al formulario para probar con otro identificador. */
  protected otroIntento(): void {
    this.form.reset();
    this.done.set(false);
    this.state.set(ready(null));
  }
}
