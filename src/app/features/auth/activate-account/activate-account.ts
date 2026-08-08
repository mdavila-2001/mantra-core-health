import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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

/** Mínimo y máximo que exige `ActivateAccountDto`. */
const MIN_PASSWORD = 8;
const MAX_TOKEN = 500;

/**
 * Activar una cuenta creada por otra persona — vista **V01-08**
 * (`POST /iam/auth/activate`).
 *
 * ## Por qué existe esta pantalla: había un flujo roto
 *
 * El alta asistida (`/iam/users/assisted-registration`, C-18) crea la cuenta de
 * alguien que no puede registrarse solo y devuelve un **token de activación de
 * un solo uso**. La pantalla de alta lo muestra, dice cuándo vence y pide
 * entregarlo por un canal seguro.
 *
 * **Y hasta ahora no había ningún lugar donde usarlo.** El cliente tenía el
 * método desde hacía tiempo y ningún componente lo llamaba; la ruta no existía.
 * Dábamos de alta a una persona, le entregábamos una llave y no había puerta.
 *
 * ## Nadie fija la contraseña de otro
 *
 * Ese es el punto de todo el mecanismo, y por eso el alta asistida **no** manda
 * contraseña: la elige su titular acá, cuando activa. Es la diferencia con
 * `POST /iam/users`, que sí fija una clave desde afuera y por eso su pantalla
 * advierte que hay que entregarla por un canal seguro y pedir que la cambien.
 *
 * ## El token puede venir por la URL o escribirse
 *
 * Por la URL cuando alguien manda el enlace armado; a mano cuando el token se
 * entregó por teléfono o en papel, que es el caso que el alta asistida
 * contempla. Las dos formas tienen que funcionar: obligar a construir una URL a
 * mano sería devolverle el problema a quien menos herramientas tiene.
 */
@Component({
  selector: 'app-activate-account',
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
  templateUrl: './activate-account.html',
  styleUrl: './activate-account.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivateAccount {
  private readonly iam = inject(IamClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** El token del enlace, si vino por ahí. Vacío obliga a escribirlo. */
  private readonly tokenDeLaUrl = this.route.snapshot.queryParamMap.get('token') ?? '';

  /** Si el token llegó por la URL, el campo no se muestra: ya está resuelto. */
  protected readonly tokenEnLaUrl = this.tokenDeLaUrl.trim() !== '';

  protected readonly form = new FormGroup({
    activationToken: new FormControl(this.tokenDeLaUrl, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_TOKEN)],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly done = signal(false);

  /**
   * Si el fallo es del token: vencido, ya usado o inexistente.
   *
   * Se separa del error general porque la salida es distinta — con un token
   * malo no sirve reintentar, hay que pedir uno nuevo a quien creó la cuenta —
   * y porque un token de un solo uso **puede haberse consumido en un intento
   * anterior**, que es un caso que la persona no tiene forma de adivinar.
   */
  protected readonly tokenInvalido = computed(() => {
    const state = this.state();
    return (
      state.status === 'not-found' ||
      (state.status === 'validation' &&
        state.issues.some((issue) => issue.code === 'CONFLICT' || issue.code === 'PRECONDITION_FAILED'))
    );
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (this.tokenInvalido()) {
      return null;
    }
    if (state.status === 'validation') {
      return state.issues[0]?.message ?? null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Este código no habilita a activar la cuenta.';
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

    const { activationToken, newPassword } = this.form.getRawValue();

    this.iam.activate({ activationToken: activationToken.trim(), newPassword }).subscribe({
      next: () => {
        this.state.set(ready(null));
        this.done.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }
}
