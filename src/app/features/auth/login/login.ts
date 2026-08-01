import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { TENANT_SELECTION_ROUTE } from '../../../core/auth/auth.guard';
import type { LoginCredentials } from '../../../core/data-access/iam/iam.types';
import { loading, ready, validation } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';

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
  imports: [ReactiveFormsModule, RouterLink, AppButton, Input, Link, FormField, Alert, AuthSplit],
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
   * El campo de MFA está siempre visible y rotulado como opcional.
   *
   * `LoginDto` acepta `mfaCode`, pero **el backend no emite ninguna señal** de
   * cuándo hace falta: no hay código de error propio en el catálogo ni mención
   * de MFA en el servicio de login. Antes esto se resolvía olfateando el texto
   * de la respuesta, que era adivinar. Mostrarlo siempre como opcional no
   * inventa nada y quien tenga segundo factor puede completarlo.
   *
   * TODO: cuando el backend declare el caso, ocultarlo hasta que lo pida.
   */

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
   * Traduce el fallo con el mapeo compartido del catálogo, con **una sola
   * excepción propia del login**.
   *
   * En cualquier otra pantalla un `UNAUTHENTICATED` significa que la sesión se
   * venció, y el interceptor ya se encargó de cerrarla. Acá significa que las
   * credenciales que la persona acaba de escribir no sirven, que es un mensaje
   * distinto y accionable.
   */
  private toState(error: unknown): ViewState<null> {
    if (error instanceof HttpErrorResponse) {
      const body = readApiError(error);
      if (body?.code === 'UNAUTHENTICATED') {
        return validation([{ message: 'Las credenciales no son válidas.', code: body.code }]);
      }
    }

    return errorToViewState<null>(error);
  }
}
