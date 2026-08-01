import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import type { PatientRegistration } from '../../../core/data-access/iam/iam.types';
import { loading, offline, ready, unexpectedError, validation } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';

/** Mínimo que exige el backend (`RegisterPatientDto`). */
const MIN_PASSWORD = 8;
const MIN_DOCUMENTO = 4;

/** Sólo letras, dígitos, punto y guion — el mismo `@Matches` del backend. */
const DOCUMENTO_VALIDO = /^[A-Za-z0-9.\-]+$/;

/**
 * Auto-registro de paciente.
 *
 * El identificador de la cuenta es el **documento**, no el correo: así lo define
 * `register-patient`. El correo es opcional y **no condiciona el acceso** — si
 * se aporta, el backend encola una verificación que puede quedar pendiente para
 * siempre sin que eso impida entrar.
 *
 * No hay ningún selector de terminología: los `*_concept_id` del contrato son
 * opcionales, así que esta pantalla **no depende** del endpoint de value sets
 * que todavía falta.
 */
@Component({
  selector: 'app-register-patient',
  imports: [ReactiveFormsModule, AppButton, Input, FormField, Alert],
  templateUrl: './register-patient.html',
  styleUrl: './register-patient.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPatient {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
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

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');

  /** Se muestra tras registrar, antes de mandar al login. */
  readonly registered = signal(false);
  readonly verificationSent = signal(false);

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

    this.auth.registerPatient(this.registration()).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.verificationSent.set(resultado.emailVerificationSent);
        this.registered.set(true);
      },
      error: (error: unknown) => this.state.set(this.toState(error)),
    });
  }

  /**
   * Lleva al login en vez de iniciar sesión sola.
   *
   * El backend devuelve los identificadores del perfil, **no tokens**, así que
   * entrar automáticamente exigiría un segundo viaje con las credenciales que
   * la persona acaba de escribir. Mandarla al login es más honesto y además le
   * confirma que su documento y su contraseña funcionan.
   */
  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  private registration(): PatientRegistration {
    const { nationalId, displayName, password, email } = this.form.getRawValue();
    const correo = email.trim();

    return {
      nationalId: nationalId.trim(),
      displayName: displayName.trim(),
      password,
      // Ausente si no se completó: el backend valida con `forbidNonWhitelisted`
      // y un correo vacío no es lo mismo que no mandar el campo.
      ...(correo === '' ? {} : { email: correo }),
    };
  }

  private toState(error: unknown): ViewState<null> {
    if (!(error instanceof HttpErrorResponse)) {
      return unexpectedError('sin-id', 'Ocurrió un error inesperado.');
    }

    if (error.status === 0) {
      return offline();
    }

    // 409 es el documento ya registrado; 400 son las validaciones del DTO.
    if (error.status === 409) {
      return validation([
        { field: 'nationalId', message: 'Ya existe una cuenta con ese documento.' },
      ]);
    }

    if (error.status === 400) {
      return validation([{ message: 'Revisá los datos: alguno no cumple el formato esperado.' }]);
    }

    if (error.status === 429) {
      return validation([{ message: 'Demasiados intentos. Esperá un momento y reintentá.' }], 60);
    }

    return unexpectedError(
      error.headers.get('x-request-id') ?? 'sin-id',
      'No pudimos completar el registro.',
    );
  }
}
