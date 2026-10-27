import { ChangeDetectionStrategy, Component, computed, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormControl,
  FormGroup,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map, switchMap, type Observable } from 'rxjs';

import { LegalEntityTypesCatalog } from '../../../core/data-access/system-context/legal-entity-types.service';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import {
  isMedicalOrganizationType,
  type MedicalOrganizationType,
} from '../../../core/data-access/directory/directory.types';
import {
  MedicalCenterRegistrationClient,
  type MedicalCenterRegistration,
} from '../../../core/data-access/iam/medical-center-registration.client';
import { readApiError } from '../../../core/http/api-error';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Link } from '../../../shared/components/atoms/link/link';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginateFields } from '../../../shared/forms/paginated/paginate-fields';
import {
  MESSAGE_SHORT_PASSWORD,
  MIN_CHARACTERS_PASSWORD,
  passwordValidators,
} from '../shared-registration/password-policy';
import { medicalCenterCodeFromName } from './medical-center-code';
import {
  DESTINO_TIPO_DE_ORGANIZACION,
  medicalOrganizationTypeOptions,
} from './medical-organization-types';
import { RegistrationBadge } from '../shared-registration/registration-badge';

/** Dónde se leen el país y la jurisdicción: los mismos catálogos públicos del alta de laboratorio. */
const DESTINO_PAIS = 'directory.tenants.country_concept_id';
const DESTINO_JURISDICCION = 'profiles.jurisdiction_authorizations.jurisdiction_concept_id';

/** Los códigos estables de esos conceptos. */
const COUNTRY_CODE = 'BO';
const JURISDICTION_CODE = 'JURISDICTION_NATIONAL';

/** Lo que dice la pantalla cuando un catálogo no sirve. */
const AVISO_CATALOGO = 'No pudimos cargar los catálogos del alta. Revise su conexión y vuelva a enviar.';

const MAX_LEGAL_NAME = 300;
const MAX_EMAIL = 320;
const MAX_NAME = 200;

/**
 * El valor del control tiene que ser una de las opciones que la pantalla
 * ofrece **ahora**.
 *
 * Las opciones llegan del catálogo después de pintar: si traen menos tipos que
 * los que había —una API sin `CLINIC`—, un valor ya elegido quedaría puesto
 * en el formulario sin una opción que lo muestre, y saldría igual a la red para
 * volver con un 400. Vacío no es asunto de este validador: lo dice `required`.
 *
 * @param opciones - Lee las opciones vigentes; se consulta en cada validación.
 */
export function entreLasOpciones(opciones: () => readonly SelectOption<string>[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor: unknown = control.value;
    if (valor === '' || valor === null) return null;
    return opciones().some((opcion) => opcion.value === valor) ? null : { notOffered: true };
  };
}

/** Un error de la API, en castellano y sin tecnicismos. */
export function signupErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === AVISO_CATALOGO) {
    return AVISO_CATALOGO;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No pudimos conectarnos. Revise su conexión e intente de nuevo.';
    }
    if (error.status === 409) {
      return 'Ya existe una cuenta con ese correo o una organización con ese nombre. Pruebe con otros datos.';
    }
    if (error.status === 400 || error.status === 422) {
      return readApiError(error)?.message ?? 'Revise los datos del formulario.';
    }
  }
  return 'No pudimos completar el registro. Intente de nuevo en unos segundos.';
}

/**
 * **Alta de una organización médica** (CM-11): un hospital, una clínica, un
 * consultorio, un centro de enfermería u otra institución de salud crea su
 * cuenta.
 *
 * ## Qué manda y por qué así
 *
 * `POST /iam/auth/register-organization` con el `tenantType` que eligió quien
 * la registra (`HOSPITAL`, `CLINIC`, `MEDICAL_OFFICE`, `NURSING` o
 * `HEALTH_OTHER`). Las opciones salen del catálogo público `tenant-type`,
 * filtradas a esos cinco (ver `medicalOrganizationTypeOptions`). Los cinco son
 * territoriales, así que la API exige país y jurisdicción; se leen de los
 * catálogos públicos y se resuelven **por código**, igual que el alta del
 * laboratorio.
 *
 * El código de la organización no se pide: sale de la razón social.
 *
 * ## Qué pasa después
 *
 * La organización nace **pendiente de verificación**. Hasta que la plataforma
 * la verifique no puede abrir su práctica ni su primera sede
 * (`medical-center-setup`), y la pantalla de éxito se lo dice.
 */
@Component({
  selector: 'app-register-medical-center',
  imports: [RegistrationBadge, Alert, AnnounceOnAppear, AppButton, AuthSplit, Link, PaginatedForm, RouterLink],
  templateUrl: './register-medical-center.html',
  styleUrls: ['../shared-registration/registration.css', './register-medical-center.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterMedicalCenter {
  private readonly client = inject(MedicalCenterRegistrationClient);
  private readonly context = inject(SystemContextClient);
  private readonly legalEntityTypes = inject(LegalEntityTypesCatalog);
  private readonly router = inject(Router);

  protected readonly claim = 'Sume su organización médica a la red';
  protected readonly tagline =
    'Publique sus procedimientos y afilie a sus médicos para que los pacientes lo encuentren.';

  /**
   * Los tipos de institución que la API publica, de los cinco médicos.
   *
   * Arranca con la lista de respaldo —los cinco—: con un catálogo lento, un
   * desplegable obligatorio vacío pedía «Elija el tipo de institución.» sin
   * nada que elegir. Cuando el catálogo responde se queda con los que publica, y
   * `ofrecerTipos` vacía lo elegido si dejó de ofrecerse.
   */
  private readonly tiposDeOrganizacion = signal<readonly SelectOption<MedicalOrganizationType>[]>(
    medicalOrganizationTypeOptions(null),
  );

  readonly form = new FormGroup({
    tenantType: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, entreLasOpciones(() => untracked(this.tiposDeOrganizacion))],
    }),
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_LEGAL_NAME)],
    }),
    legalEntityType: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    ownerName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NAME)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(MAX_EMAIL)],
    }),
    password: new FormControl('', { nonNullable: true, validators: [...passwordValidators] }),
  });

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly registered = signal(false);
  protected readonly verificationSent = signal(false);

  /** Los tipos societarios de Bolivia, del mismo catálogo que las demás altas. */
  private readonly tiposSocietarios = signal<readonly SelectOption<string>[]>([]);

  /**
   * Dos páginas, de a cuatro campos como tope: la organización y la cuenta de
   * quien la administra. `computed` porque los catálogos de tipos llegan
   * después de que la pantalla se arma.
   */
  protected readonly paginas = computed(() =>
    paginateFields([
      {
        titulo: 'La organización',
        hint: 'Qué tipo de institución es, cómo se llama y qué figura jurídica tiene.',
        // Los tres campos comparten un renglón, como la página de la cuenta:
        // el tipo de institución es un desplegable, igual que el societario.
        disposicion: 'tres-columnas' as const,
        campos: [
          {
            key: 'tenantType',
            label: 'Tipo de institución',
            control: 'select' as const,
            options: this.tiposDeOrganizacion(),
            required: true,
            testId: 'medical-center-signup-tenant-type',
            mensajeDeError: 'Elija el tipo de institución.',
          },
          {
            key: 'legalName',
            label: 'Razón social',
            control: 'text' as const,
            required: true,
            hint: `Hasta ${MAX_LEGAL_NAME} caracteres.`,
            testId: 'medical-center-signup-legal-name',
            // Sólo el vacío lleva mensaje propio: el tope de 300 lo dice el
            // motor con su número, que es lo que la persona necesita leer.
            mensajeSiFalta: 'Escriba la razón social de la organización.',
          },
          {
            key: 'legalEntityType',
            label: 'Tipo societario',
            hint: 'La figura jurídica con la que está constituida la organización.',
            control: 'select' as const,
            options: this.tiposSocietarios(),
            required: true,
            testId: 'medical-center-signup-legal-entity-type',
            valorEnDosRenglones: true,
            mensajeDeError: 'Elija el tipo societario.',
          },
        ],
      },
      {
        titulo: 'Su cuenta',
        hint: 'Quien administra la organización. Con estos datos inicia sesión.',
        disposicion: 'tres-columnas' as const,
        campos: [
          {
            key: 'ownerName',
            label: 'Su nombre',
            control: 'text' as const,
            required: true,
            autocomplete: 'name',
            testId: 'medical-center-signup-owner-name',
            mensajeDeError: 'Escriba su nombre.',
          },
          {
            key: 'email',
            label: 'Correo',
            control: 'email' as const,
            required: true,
            autocomplete: 'email',
            testId: 'medical-center-signup-email',
            mensajeDeError: 'Escriba un correo válido.',
          },
          {
            key: 'password',
            label: 'Contraseña',
            control: 'password' as const,
            required: true,
            autocomplete: 'new-password',
            hint: `Mínimo ${MIN_CHARACTERS_PASSWORD} caracteres.`,
            testId: 'medical-center-signup-password',
            mensajeDeError: MESSAGE_SHORT_PASSWORD,
          },
        ],
      },
    ]),
  );

  constructor() {
    this.context.dynamicEnum(DESTINO_TIPO_DE_ORGANIZACION).subscribe({
      next: (catalogo) => this.ofrecerTipos(medicalOrganizationTypeOptions(catalogo)),
      error: () => this.ofrecerTipos(medicalOrganizationTypeOptions(null)),
    });
    this.legalEntityTypes.listar().subscribe({
      next: (opciones) =>
        this.tiposSocietarios.set(this.legalEntityTypes.opcionesPorPais(opciones, 'BO')),
      // Sin catálogo el servicio ofrece las figuras de su diccionario: un
      // desplegable vacío dejaba el alta sin poder terminarse.
      error: () => this.tiposSocietarios.set(this.legalEntityTypes.opcionesPorPais([], 'BO')),
    });
  }

  submit(): void {
    if (this.isSubmitting()) return;
    const tipo = this.form.controls.tenantType.value;
    if (this.form.invalid || !isMedicalOrganizationType(tipo)) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.catalogos()
      .pipe(switchMap((ids) => this.client.register(this.datos(tipo, ids))))
      .subscribe({
        next: (resultado) => {
          this.isSubmitting.set(false);
          this.verificationSent.set(resultado.emailVerificationSent);
          this.registered.set(true);
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(signupErrorMessage(error));
        },
      });
  }

  /**
   * Publica las opciones del tipo y revalida lo elegido contra ellas.
   *
   * Un valor que dejó de ofrecerse se vacía: la persona vuelve a ver el
   * desplegable sin elegir —y, si ya lo había tocado, con «Elija el tipo de institución.»—
   * en vez de un valor invisible que la API rechazaría.
   */
  private ofrecerTipos(opciones: readonly SelectOption<MedicalOrganizationType>[]): void {
    this.tiposDeOrganizacion.set(opciones);
    const tipo = this.form.controls.tenantType;
    if (tipo.value !== '' && !opciones.some((opcion) => opcion.value === tipo.value)) {
      tipo.setValue('');
    }
    tipo.updateValueAndValidity();
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  /** Lee los dos catálogos y resuelve los ids por código. Un fallo corta con el aviso. */
  private catalogos(): Observable<{ pais: string; jurisdiccion: string }> {
    const byCode = (destino: string, codigo: string) =>
      this.context.dynamicEnum(destino).pipe(
        map((enumeracion) => {
          const id = enumeracion.options.find((opcion) => opcion.code === codigo)?.conceptId;
          if (id === undefined) throw new Error(AVISO_CATALOGO);
          return id;
        }),
      );
    return forkJoin({
      pais: byCode(DESTINO_PAIS, COUNTRY_CODE),
      jurisdiccion: byCode(DESTINO_JURISDICCION, JURISDICTION_CODE),
    });
  }

  private datos(
    tipo: MedicalOrganizationType,
    ids: { pais: string; jurisdiccion: string },
  ): MedicalCenterRegistration {
    const f = this.form.getRawValue();
    return {
      code: medicalCenterCodeFromName(f.legalName),
      tenantType: tipo,
      legalName: f.legalName.trim(),
      legalEntityType: f.legalEntityType,
      countryConceptId: ids.pais,
      jurisdictionConceptId: ids.jurisdiccion,
      owner: {
        email: f.email.trim(),
        password: f.password,
        displayName: f.ownerName.trim(),
      },
    };
  }
}
