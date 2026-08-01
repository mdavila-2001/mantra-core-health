import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  FORGOT_PASSWORD_PATH,
  HOME_PATH,
  RETURN_URL_PARAM,
  TENANT_SELECTION_PATH,
} from '../../../core/auth/auth.guard';
import { AuthService } from '../../../core/auth/auth.service';
import type { LoginCredentials } from '../../../core/data-access/iam/iam.types';
import { viewStateFromHttpError } from '../../../core/http/api-error';
import { isValidation } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Radio } from '../../../shared/components/atoms/radio/radio';
import { RadioGroup } from '../../../shared/components/atoms/radio-group/radio-group';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AuthLayout } from '../../../shared/components/organisms/auth-layout/auth-layout';

/** Con qué identificador se entra. La API acepta uno u otro, nunca los dos. */
type IdentifierKind = 'email' | 'nationalId';

/**
 * Pantalla de ingreso (J9 · tarjeta 19).
 *
 * ## Por qué el identificador se elige y no se adivina
 *
 * El backend acepta correo **o** documento de identidad, y `LoginCredentials` lo modela como una
 * unión discriminada justamente porque mandar los dos es un 400. Se podría inferir cuál es cuál
 * mirando si el texto tiene arroba, y sería un error: un documento mal tipeado con arroba se
 * mandaría como correo, la API respondería «credenciales inválidas» y la persona no tendría manera
 * de entender por qué. Un par de radios cuesta un clic y elimina la clase entera de problema.
 *
 * ## Los errores salen de la API, no de acá
 *
 * El fallo se traduce con `viewStateFromHttpError`, que ramifica sobre el `code` estable de la API.
 * Este componente **no redacta mensajes de error**: muestra el que vino. Inventar textos propios
 * («usuario o contraseña incorrectos») los desincroniza del backend en cuanto cambie una regla.
 *
 * ## Adónde va después de entrar
 *
 * Tres destinos, en este orden: la organización si hay que elegirla, la ruta que la persona pidió
 * antes de que la mandaran acá (`?volverA=`), o el panel. La ruta de retorno se valida antes de
 * usarla — ver {@link safeReturnUrl}.
 */
@Component({
  selector: 'app-login',
  imports: [
    Alert,
    AppButton,
    AuthLayout,
    FormField,
    Input,
    Link,
    Radio,
    RadioGroup,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    identifierKind: this.formBuilder.nonNullable.control<IdentifierKind>('email'),
    identifier: this.formBuilder.nonNullable.control('', Validators.required),
    password: this.formBuilder.nonNullable.control('', Validators.required),
  });

  protected readonly forgotPasswordPath = FORGOT_PASSWORD_PATH;

  protected readonly isSubmitting = signal(false);

  /** Resultado del último intento. `null` mientras no se haya enviado nada. */
  protected readonly failure = signal<ViewState<never> | null>(null);

  /** Lo que el aviso muestra: una línea por problema que la API haya reportado. */
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
    if (state.status === 'forbidden') {
      return [state.message ?? 'Esta cuenta no puede iniciar sesión.'];
    }
    return ['No se pudo iniciar sesión.'];
  });

  /**
   * Con qué identificador se está entrando, como señal.
   *
   * `toSignal` sobre `valueChanges` y **no** `computed(() => control.value)`: los formularios
   * reactivos no son señales, así que un `computed` que lea `.value` se calcula una sola vez y
   * nunca se entera de que la persona cambió de radio. La etiqueta se quedaría en «Correo
   * electrónico» para siempre.
   */
  private readonly identifierKind = toSignal(this.form.controls.identifierKind.valueChanges, {
    initialValue: this.form.controls.identifierKind.value,
  });

  protected readonly usesEmail = computed(() => this.identifierKind() === 'email');

  protected readonly identifierLabel = computed(() =>
    this.usesEmail() ? 'Correo electrónico' : 'Documento de identidad',
  );

  protected readonly identifierType = computed(() => (this.usesEmail() ? 'email' : 'text'));

  protected readonly identifierHint = computed(() =>
    this.usesEmail()
      ? 'El correo con el que se dio de alta tu cuenta.'
      : 'El número de documento con el que te registraste.',
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // `markAllAsTouched` antes de salir: sin esto, enviar el formulario vacío no muestra ningún
    // error porque ningún control fue tocado todavía.
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting.set(true);
    this.failure.set(null);

    this.auth.login(this.credentials()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigateByUrl(this.destination());
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.failure.set(viewStateFromHttpError<never>(error));
      },
    });
  }

  /**
   * Arma la unión discriminada. El `kind` no es decorativo: es lo que hace que el cliente mande un
   * solo identificador, que es lo único que la API acepta.
   */
  private credentials(): LoginCredentials {
    const { identifierKind, identifier, password } = this.form.getRawValue();
    const trimmed = identifier.trim();

    return identifierKind === 'email'
      ? { kind: 'email', email: trimmed, password }
      : { kind: 'nationalId', nationalId: trimmed, password };
  }

  private destination(): string {
    if (this.auth.needsTenantSelection()) {
      return TENANT_SELECTION_PATH;
    }
    return this.safeReturnUrl() ?? HOME_PATH;
  }

  /**
   * La ruta de retorno del parámetro, si es segura.
   *
   * Se aceptan **solo rutas internas que empiecen con una barra**. Sin esa comprobación, un enlace
   * con `?volverA=https://sitio-ajeno.example` convierte esta pantalla en un redirector abierto: se
   * la manda a alguien por correo, entra con sus credenciales de verdad y termina en una copia del
   * login que le pide volver a escribirlas.
   *
   * `//otro-sitio.example` se rechaza por lo mismo: empieza con barra pero el navegador lo lee como
   * URL con el protocolo actual.
   */
  private safeReturnUrl(): string | null {
    const requested = this.route.snapshot.queryParamMap.get(RETURN_URL_PARAM);

    if (requested === null || !requested.startsWith('/') || requested.startsWith('//')) {
      return null;
    }
    return requested;
  }
}
