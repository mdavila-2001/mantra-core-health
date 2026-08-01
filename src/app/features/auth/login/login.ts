import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { TENANT_SELECTION_ROUTE } from '../../../core/auth/auth.guard';
import type { LoginCredentials } from '../../../core/data-access/iam/iam.types';
import {
  loading,
  offline,
  ready,
  unexpectedError,
  validation,
} from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';

/** A dónde se entra tras iniciar sesión con la organización ya resuelta. */
const HOME_ROUTE = '/';

/**
 * Pantalla de inicio de sesión.
 *
 * **Un solo campo de identificador.** El backend acepta correo *o* documento y
 * nunca ambos (`LoginDto` valida el correo sólo cuando no vino documento), así
 * que pedir dos campos obligaría a la persona a saber cuál le toca. Se detecta
 * por la arroba, que es la misma regla que usaría cualquiera al mirarlo.
 *
 * No hay enlace de «olvidé mi contraseña»: **la API no tiene ese endpoint**
 * todavía. Un enlace que no lleva a ningún lado es peor que su ausencia.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, AppButton, Input, FormField, Alert],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    identifier: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    mfaCode: new FormControl('', { nonNullable: true }),
  });

  /**
   * Estado del envío, en los términos del M34. Arranca en `ready` sin datos
   * porque el formulario ya está utilizable: no hay nada que esperar todavía.
   */
  readonly state = signal<ViewState<null>>(ready(null));

  readonly isSubmitting = computed(() => this.state().status === 'loading');

  /**
   * El campo de MFA aparece sólo cuando el backend lo pide. No se muestra de
   * entrada porque la mayoría de las cuentas no lo tienen y un campo vacío
   * obligatorio en apariencia confunde.
   */
  readonly needsMfa = signal(false);

  readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues[0]?.message ?? null;
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message ?? 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.auth.login(this.credentials()).subscribe({
      next: () => this.goAfterLogin(),
      error: (error: unknown) => this.state.set(this.toState(error)),
    });
  }

  /**
   * La arroba decide si el identificador es correo o documento. El backend
   * exige uno u otro, así que hay que elegir antes de mandar.
   */
  private credentials(): LoginCredentials {
    const { identifier, password, mfaCode } = this.form.getRawValue();
    const trimmed = identifier.trim();
    const mfa = mfaCode.trim() === '' ? {} : { mfaCode: mfaCode.trim() };

    return trimmed.includes('@')
      ? { kind: 'email', email: trimmed, password, ...mfa }
      : { kind: 'nationalId', nationalId: trimmed, password, ...mfa };
  }

  /** Con más de una organización hay que elegir antes de entrar. */
  private goAfterLogin(): void {
    this.state.set(ready(null));
    void this.router.navigateByUrl(
      this.auth.needsTenantSelection() ? TENANT_SELECTION_ROUTE : HOME_ROUTE,
    );
  }

  /**
   * Traduce el fallo a un estado del M34.
   *
   * Es un mapeo mínimo y deliberado: cubre lo que un login puede devolver y
   * nada más. El mapeo completo de errores es la tarjeta 17, que espera el
   * catálogo de formas reales de la API — inventarlas acá sería adivinar.
   */
  private toState(error: unknown): ViewState<null> {
    if (!(error instanceof HttpErrorResponse)) {
      return unexpectedError('sin-id', 'Ocurrió un error inesperado.');
    }

    // Status 0 es «la petición no llegó»: sin conexión o servidor caído.
    if (error.status === 0) {
      return offline();
    }

    if (error.status === 401) {
      this.needsMfa.set(this.mentionsMfa(error));
      return validation([
        {
          message: this.needsMfa()
            ? 'Ingresá el código de verificación de tu aplicación.'
            : 'Las credenciales no son válidas.',
        },
      ]);
    }

    if (error.status === 423 || error.status === 403) {
      return validation([{ message: 'La cuenta está bloqueada. Contactá a tu administrador.' }]);
    }

    if (error.status === 429) {
      return validation([{ message: 'Demasiados intentos. Esperá un momento y reintentá.' }], 60);
    }

    return unexpectedError(
      error.headers.get('x-request-id') ?? 'sin-id',
      'No pudimos completar el inicio de sesión.',
    );
  }

  /**
   * Heurística provisional hasta que llegue el catálogo de errores: si la
   * respuesta menciona MFA, se ofrece el campo. Queda anotado como TODO para
   * reemplazarlo por el campo exacto que declare el catálogo.
   */
  private mentionsMfa(error: HttpErrorResponse): boolean {
    const body: unknown = error.error;
    const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
    return /mfa|factor|otp/i.test(text);
  }
}
