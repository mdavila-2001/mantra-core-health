import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import type { CreatedUser, InitialRole, NewUser } from '../../../core/data-access/iam/iam.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';

/** Mínimo que exige `CreateUserDto` en el backend. */
const MIN_PASSWORD = 8;

/** El mismo `@Matches` del backend: dígitos, espacios, paréntesis, `+` y guion. */
const TELEFONO_VALIDO = /^[+]?[0-9 ()-]{6,}$/;

/**
 * Alta de una cuenta hecha por un administrador (`POST /iam/users`, UC-01-01).
 *
 * Es **la única de las tres altas que fija una contraseña desde afuera**. Por eso
 * la pantalla lo dice en voz alta: quien la crea tiene que entregarla por un
 * canal seguro y el titular debería cambiarla. Las otras dos vías —el
 * autorregistro y el alta asistida— hacen que la clave la elija su dueño, que es
 * siempre preferible.
 *
 * ## Por qué no hay orquestación ni reanudación
 *
 * El plan de J3 preveía encadenar perfil → cuenta → vínculo con reanudación. El
 * backend no lo necesita: esta alta es **una sola petición** y el registro CTI
 * es atómico por invariante del modelo (regla 11 de la v4.0.7) — padre e hija en
 * la misma transacción. Encadenar llamadas acá reintroduciría justamente el
 * estado intermedio que el modelo prohíbe.
 *
 * Lo que sí puede duplicar es el **doble envío**, y de eso se ocupa
 * `app-form-actions`: ignora el segundo click además de deshabilitar el botón.
 */
@Component({
  selector: 'app-user-registration',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Radio,
    RadioGroup,
  ],
  templateUrl: './user-registration.html',
  styleUrl: './user-registration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserRegistration {
  private readonly iam = inject(IamClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly form = new FormGroup({
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(TELEFONO_VALIDO)],
    }),
  });

  /**
   * El rol inicial vive fuera del `FormGroup` porque el grupo de radios modela
   * «sin elección» con `null` y acá siempre hay uno: la ausencia de elección es
   * `USER`, que es con lo que completa el backend.
   */
  protected readonly initialRole = signal<InitialRole>('USER');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  /** La cuenta recién creada, o `null` mientras el formulario sigue abierto. */
  protected readonly created = signal<CreatedUser | null>(null);

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'No tenés permiso para dar de alta cuentas.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      // El identificador es lo único que conecta este fallo con los registros
      // del servidor: va siempre, aunque el mensaje sea genérico.
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected cambiarRol(rol: string | null): void {
    this.initialRole.set(rol === 'SECURITY_ADMIN' ? 'SECURITY_ADMIN' : 'USER');
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.iam.createUser(this.datos()).subscribe({
      next: (usuario) => {
        this.state.set(ready(null));
        this.created.set(usuario);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /**
   * Deja la pantalla lista para otra alta.
   *
   * Se limpia todo, incluida la contraseña: dejarla cargada haría que la
   * siguiente cuenta naciera con la clave de la anterior sin que nadie lo note.
   */
  protected altaNueva(): void {
    this.form.reset();
    this.initialRole.set('USER');
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewUser {
    const { displayName, email, password, phone } = this.form.getRawValue();
    const telefono = phone.trim();

    return {
      displayName: displayName.trim(),
      email: email.trim(),
      password,
      // Ausente si no se completó: el backend valida con `forbidNonWhitelisted`
      // y una cadena vacía no es lo mismo que la ausencia del campo.
      ...(telefono === '' ? {} : { phone: telefono }),
      ...(this.initialRole() === 'USER' ? {} : { initialRole: this.initialRole() }),
    };
  }
}
