import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { IamClient } from '../../../core/data-access/iam/iam.client';
import type {
  PatientRegistration,
  PractitionerRegistration,
} from '../../../core/data-access/iam/iam.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Radio } from '@shared/components/molecules/radio/radio';
import { RadioGroup } from '@shared/components/molecules/radio-group/radio-group';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';

/** Mínimos que exigen los DTO del backend. */
const MIN_PASSWORD = 8;
const MIN_DOCUMENTO = 4;

/** Sólo letras, dígitos, punto y guion — el mismo `@Matches` del backend. */
const DOCUMENTO_VALIDO = /^[A-Za-z0-9.-]+$/;

/** Quién se está registrando. Define qué endpoint y qué campos. */
type TipoCuenta = 'paciente' | 'profesional';

/**
 * Registro público, para los dos perfiles que la API permite dar de alta sin
 * intervención de un administrador.
 *
 * Son **dos altas distintas**, no una con campos extra:
 *
 * - El **paciente** entra con su documento; el correo es opcional y no
 *   condiciona el acceso.
 * - El **profesional** entra con su correo, y necesita matrícula y número de
 *   colegio: sin habilitación comprobable no hay alta.
 *
 * Por eso hay dos formularios en vez de uno condicional: los campos
 * obligatorios no se solapan y mezclarlos obligaría a validar «obligatorio si
 * el tipo es…», que es de donde salen los formularios que mienten.
 */
@Component({
  selector: 'app-register-patient',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AppButton,
    Input,
    Link,
    Radio,
    RadioGroup,
    FormField,
    Alert,
    AuthSplit, AnnounceOnAppear],
  templateUrl: './register-patient.html',
  styleUrl: './register-patient.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPatient {
  private readonly auth = inject(AuthService);
  private readonly iam = inject(IamClient);
  private readonly router = inject(Router);

  readonly tipo = signal<TipoCuenta>('paciente');

  readonly formPaciente = new FormGroup({
    nationalId: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(MIN_DOCUMENTO),
        Validators.pattern(DOCUMENTO_VALIDO),
      ],
    }),
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
  });

  readonly formProfesional = new FormGroup({
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
    licenseNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    credentialNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    professionalTitle: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
  });

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');

  readonly registered = signal(false);
  readonly verificationSent = signal(false);

  /** Con qué va a iniciar sesión, para decírselo en la confirmación. */
  readonly accessHint = computed(() =>
    this.tipo() === 'paciente' ? 'tu documento' : 'tu correo',
  );

  /**
   * El titular de la columna de marca cambia con el tipo elegido.
   *
   * El diseño original es solo de profesional —«Potencia tu práctica médica»—,
   * pero esta pantalla sirve a los dos perfiles: prometerle eso a alguien que
   * se registra como paciente sería hablarle de otra cosa.
   */
  readonly claim = computed(() =>
    this.tipo() === 'paciente' ? 'Tu salud, en un solo lugar' : 'Potenciá tu práctica médica',
  );

  readonly tagline = computed(() =>
    this.tipo() === 'paciente'
      ? 'Llevá tu historia clínica, tus turnos y tus estudios siempre con vos.'
      : 'Sumate a la red de salud más grande de Bolivia y conectá con miles de pacientes.',
  );

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

  /**
   * Cambiar de tipo limpia el error anterior: era de otro formulario.
   *
   * Acepta `null` porque el grupo de radios modela «sin elección»; se cae a
   * paciente, que es el caso mayoritario.
   */
  cambiarTipo(tipo: string | null): void {
    this.tipo.set(tipo === 'profesional' ? 'profesional' : 'paciente');
    this.state.set(ready(null));
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    return this.tipo() === 'paciente' ? this.submitPaciente() : this.submitProfesional();
  }

  /**
   * Lleva al login en vez de iniciar sesión sola.
   *
   * Ninguno de los dos endpoints devuelve tokens —devuelven los identificadores
   * del perfil—, así que entrar automáticamente exigiría un segundo viaje con
   * las credenciales recién escritas.
   */
  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  private submitPaciente(): void {
    if (this.formPaciente.invalid) {
      this.formPaciente.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.auth.registerPatient(this.datosPaciente()).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.verificationSent.set(resultado.emailVerificationSent);
        this.registered.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  private submitProfesional(): void {
    if (this.formProfesional.invalid) {
      this.formProfesional.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.iam.registerPractitioner(this.datosProfesional()).subscribe({
      next: () => {
        this.state.set(ready(null));
        // El alta de profesional no encola verificación de correo.
        this.verificationSent.set(false);
        this.registered.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  private datosPaciente(): PatientRegistration {
    const { nationalId, displayName, password, email } = this.formPaciente.getRawValue();
    const correo = email.trim();

    return {
      nationalId: nationalId.trim(),
      displayName: displayName.trim(),
      password,
      // Ausente si no se completó: `forbidNonWhitelisted` rechaza lo que sobra,
      // y una cadena vacía no es lo mismo que la ausencia del campo.
      ...(correo === '' ? {} : { email: correo }),
    };
  }

  private datosProfesional(): PractitionerRegistration {
    const raw = this.formProfesional.getRawValue();
    const titulo = raw.professionalTitle.trim();
    const telefono = raw.phone.trim();

    return {
      email: raw.email.trim(),
      password: raw.password,
      displayName: raw.displayName.trim(),
      licenseNumber: raw.licenseNumber.trim(),
      credentialNumber: raw.credentialNumber.trim(),
      ...(titulo === '' ? {} : { professionalTitle: titulo }),
      ...(telefono === '' ? {} : { phone: telefono }),
    };
  }
}
