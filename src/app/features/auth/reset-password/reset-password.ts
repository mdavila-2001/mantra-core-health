import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';

/** Mínimo que exige `ResetPasswordDto`. */
const MIN_PASSWORD = 8;

/**
 * Fijar la contraseña nueva con el token del correo.
 *
 * El token viaja por la barra de direcciones, así que la pantalla funciona sin
 * sesión: quien olvidó su contraseña justamente no puede entrar.
 */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, AppButton, Input, Link, FormField, NavIcon, Alert, AnnounceOnAppear],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  private readonly iam = inject(IamClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  /** Sin token no hay nada que hacer: el enlace del correo llegó incompleto. */
  readonly hasToken = this.token.trim() !== '';

  readonly form = new FormGroup({
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
  });

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');

  readonly done = signal(false);

  /**
   * Sesiones que se cerraron al cambiar la contraseña.
   *
   * Se muestra porque es información de seguridad que la persona quiere ver: si
   * cambió la clave porque sospechaba de un acceso ajeno, saber que se cerraron
   * tres sesiones le confirma que sirvió.
   */
  readonly revokedSessions = signal(0);

  readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
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

  submit(): void {
    if (this.form.invalid || this.isSubmitting() || !this.hasToken) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.iam
      .resetPassword({ token: this.token, newPassword: this.form.getRawValue().newPassword })
      .subscribe({
        next: (resultado) => {
          this.state.set(ready(null));
          this.revokedSessions.set(resultado.revokedSessions);
          this.done.set(true);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }
}
