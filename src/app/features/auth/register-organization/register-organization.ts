import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import type { OrganizationRegistration } from '../../../core/data-access/iam/iam.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';

/** Mínimos que exigen los DTO del backend. */
const MIN_PASSWORD = 8;

/** Largos que declara el bloque `organization` de `RegisterOrganizationDto`. */
const MAX_CODIGO = 100;
const MAX_NOMBRE = 300;
const MAX_ZONA_HORARIA = 100;

/** Largos del bloque `payer`, iguales a los del alta administrativa. */
const MAX_CARRIER_CODE = 60;
const MAX_NIT = 100;
const MAX_SIGLA = 20;
const MAX_DIRECCION = 300;

/** Mismo patrón que el DTO del backend para el código único del tenant. */
const CODIGO_VALIDO = /^[A-Za-z0-9._-]+$/;

/**
 * Registro público de una organización aseguradora
 * (`POST /iam/auth/register-organization`).
 *
 * ## Por qué es una pantalla propia y no un tercer tipo del alta de `RegisterPatient`
 *
 * Ahí los dos formularios comparten un mismo endpoint de auto-registro de
 * *personas*. Acá el sujeto que se crea es una **organización** —con su
 * propio usuario owner adentro—, y el endpoint es otro
 * (`register-organization`, no `register-patient` ni `register-practitioner`).
 * Mezclarlo como una tercera pestaña habría forzado a los dos formularios de
 * persona a convivir con un bloque de datos de empresa que no les concierne.
 *
 * ## El tipo de tenant es fijo
 *
 * A diferencia del alta administrativa (`OrganizationNew`), que ofrece los
 * diez tipos de `TENANT_TYPE_CODES`, acá no hay nada que elegir: esta
 * pantalla sólo da de alta aseguradoras, así que el cliente manda
 * `tenantType: 'PAYER'` fijo y el bloque `payer` **siempre** viaja completo.
 *
 * ## NIT reusa `regulatorIdentifier`
 *
 * No es una columna nueva del backend: es el mismo campo que ya exige el
 * alta administrativa de aseguradoras, sólo que acá se etiqueta «NIT» porque
 * es como lo conoce quien se registra.
 */
@Component({
  selector: 'app-register-organization',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AppButton,
    Input,
    Link,
    FormField,
    Alert,
    AuthSplit,
    AnnounceOnAppear,
  ],
  templateUrl: './register-organization.html',
  styleUrl: './register-organization.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterOrganization {
  private readonly iam = inject(IamClient);
  private readonly router = inject(Router);

  protected readonly claim = 'Gestioná tu aseguradora en un solo lugar';
  protected readonly tagline =
    'Sumate a la red de salud y conectá con miles de pacientes y prestadores.';

  readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(MAX_CODIGO),
        Validators.pattern(CODIGO_VALIDO),
      ],
    }),
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    tradeName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_NOMBRE)],
    }),
    sigla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_SIGLA)],
    }),
    regulatorIdentifier: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NIT)],
    }),
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_DIRECCION)],
    }),
    carrierCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CARRIER_CODE)],
    }),
    timeZone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_ZONA_HORARIA)],
    }),
    // Datos del owner. El nombre va en sus cuatro partes, igual que en el
    // resto de las altas: el backend compone con ellas el nombre que muestra.
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    middleName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    motherLastName: new FormControl('', { nonNullable: true }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
  });

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');

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
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.iam.registerOrganization(this.datos()).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.verificationSent.set(resultado.emailVerificationSent);
        this.registered.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /**
   * Lleva al login en vez de iniciar sesión sola.
   *
   * El endpoint devuelve los identificadores del tenant y del owner, no
   * tokens: entrar automáticamente exigiría un segundo viaje con las
   * credenciales recién escritas.
   */
  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  private datos(): OrganizationRegistration {
    const raw = this.form.getRawValue();
    const tradeName = raw.tradeName.trim();
    const timeZone = raw.timeZone.trim();
    const segundoNombre = raw.middleName.trim();
    const apellidoMaterno = raw.motherLastName.trim();

    return {
      code: raw.code.trim(),
      legalName: raw.legalName.trim(),
      ...(tradeName === '' ? {} : { tradeName }),
      ...(timeZone === '' ? {} : { timeZone }),
      payer: {
        carrierCode: raw.carrierCode.trim(),
        regulatorIdentifier: raw.regulatorIdentifier.trim(),
        sigla: raw.sigla.trim(),
        address: raw.address.trim(),
      },
      owner: {
        email: raw.email.trim(),
        password: raw.password,
        name: raw.name.trim(),
        lastName: raw.lastName.trim(),
        ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
        ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      },
    };
  }
}
