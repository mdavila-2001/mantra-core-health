import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { CORREO_CON_DOMINIO } from '../../../core/data-access/iam/strict-email';
import { SupportStaffClient } from '../../../core/data-access/support-staff/support-staff.client';
import type { SupportStaffRegistration } from '../../../core/data-access/support-staff/support-staff.types';
import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import { joinNames } from '../../../core/profession/additional-names';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Link } from '../../../shared/components/atoms/link/link';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { CustomField } from '../../../shared/components/organisms/paginated-form/custom-field';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginateFields } from '../../../shared/forms/paginated/paginate-fields';
import { InlineNameFields } from '../shared-registration/inline-name-fields/inline-name-fields';
import { nameGroup } from '../shared-registration/name-fields/person-name';
import { identityDocumentValidators } from '../shared-registration/national-id';
import { MESSAGE_SHORT_PASSWORD, passwordValidators } from '../shared-registration/password-policy';
import { RegistrationBadge } from '../shared-registration/registration-badge';
import { registrationErrorToViewState } from '../shared-registration/registration-errors';

/** `Date` → `YYYY-MM-DD`, como lo espera el DTO. */
function fechaIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Edad mínima para trabajar como personal de apoyo. */
const EDAD_MINIMA = 18;

/** Hace `EDAD_MINIMA` años: la fecha de nacimiento más reciente que se acepta. */
function fechaMaximaDeNacimiento(hoy = new Date()): Date {
  return new Date(hoy.getFullYear() - EDAD_MINIMA, hoy.getMonth(), hoy.getDate());
}

/**
 * **Alta de secretaria** (personal de apoyo): `/auth/register/support-staff`.
 *
 * Está armada **con las piezas del alta de paciente**, no con una copia: el mismo
 * bloque de nombre (`nameGroup` + `app-inline-name-fields`), el mismo documento
 * con su departamento emisor (`identityDocumentValidators`, catálogo
 * `VS_BO_DEPARTMENT`), el mismo correo estricto, el mismo celular por país y la
 * misma política de contraseña, servidos por el mismo motor de páginas
 * (`app-paginated-form`) dentro de la misma tarjeta (`app-auth-split`). Lo que
 * el alta de paciente pregunta por ser paciente —domicilio en el mapa, seguros,
 * contacto de emergencia— no se pregunta acá.
 *
 * ## Qué crea y qué no
 *
 * Crea **la cuenta** con el rol `SUPPORT_STAFF`, y nada más: nadie es
 * secretaria de un hospital por declararlo. Lo que ve sale de sus vínculos, y
 * cada vínculo nace de una solicitud aceptada: el hospital o el doctor la
 * invitan por su documento y ella acepta, o ella pide y el hospital o el doctor
 * acepta (`/my-support`).
 */
@Component({
  selector: 'app-register-support-staff',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    AuthSplit,
    CustomField,
    InlineNameFields,
    Link,
    PaginatedForm,
    RegistrationBadge,
    RouterLink,
  ],
  templateUrl: './register-support-staff.html',
  styleUrls: ['../shared-registration/registration.css', './register-support-staff.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterSupportStaff {
  private readonly client = inject(SupportStaffClient);
  private readonly departamentos = inject(BoDepartmentsCatalog);
  private readonly router = inject(Router);

  protected readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);
  protected readonly catalogoCaido = signal(false);

  protected readonly form = new FormGroup({
    personName: nameGroup(true),
    nationalId: new FormControl('', { nonNullable: true, validators: [...identityDocumentValidators] }),
    issuerAdministrativeAreaConceptId: new FormControl<string | null>(null, {
      validators: [Validators.required],
    }),
    birthDate: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.pattern(CORREO_CON_DOMINIO)],
    }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, telefonoCompleto] }),
    password: new FormControl('', { nonNullable: true, validators: [...passwordValidators] }),
  });

  protected readonly paginas = computed(() =>
    paginateFields([
      {
        titulo: 'Identidad',
        clave: 'identity',
        icon: 'people',
        hint: 'Como figura en su documento: la organización que la sume la va a verificar.',
        campos: [
          { key: 'personName', label: '', control: 'custom', mensajeDeError: 'Ingrese su primer nombre y su apellido paterno.' },
          {
            key: 'birthDate',
            label: 'Fecha de nacimiento',
            hint: 'Tiene que ser mayor de edad.',
            control: 'date',
            required: true,
            maxDate: fechaMaximaDeNacimiento(),
            minDate: new Date(1910, 0, 1),
            mensajeDeError: 'Ingrese su fecha de nacimiento (mayor de 18 años).',
            ancho: 'mitad',
          },
        ],
      },
      {
        titulo: 'Documento',
        clave: 'document',
        icon: 'patients',
        hint: 'Con su documento va a iniciar sesión.',
        campos: [
          {
            key: 'nationalId',
            label: 'Documento de identidad',
            hint: 'Sin el complemento.',
            control: 'text',
            required: true,
            autocomplete: 'username',
            placeholder: '1234567',
            testId: 'alta-apoyo-documento',
            soloAlfanumerico: true,
            icono: 'patients',
            ancho: 'mitad',
            mensajeDeError: 'Ingrese su documento: solo letras y números, sin espacios.',
          },
          this.catalogoCaido()
            ? {
                key: 'issuerAdministrativeAreaConceptId',
                label: 'Departamento de emisión',
                control: 'custom',
                required: true,
                ancho: 'completo',
                mensajeDeError: 'Elija el departamento que expidió su cédula.',
              }
            : {
                key: 'issuerAdministrativeAreaConceptId',
                label: 'Departamento de emisión',
                hint: 'El «SC», «LP»... de su cédula.',
                control: 'select',
                required: true,
                options: this.opcionesDepartamento(),
                placeholder: 'Elija el departamento',
                testId: 'alta-apoyo-departamento',
                icono: 'pin',
                ancho: 'mitad',
                mensajeDeError: 'Elija el departamento que expidió su cédula.',
              },
        ],
      },
      {
        titulo: 'Contacto y acceso',
        clave: 'access',
        icon: 'lock',
        hint: 'Por acá le llegan los avisos de la organización y recupera su cuenta.',
        campos: [
          {
            key: 'email',
            label: 'Correo electrónico',
            control: 'email',
            required: true,
            autocomplete: 'email',
            placeholder: 'correo@ejemplo.com',
            testId: 'alta-apoyo-correo',
            icono: 'mail',
            ancho: 'mitad',
            mensajeDeError: 'Ingrese un correo válido.',
          },
          {
            key: 'phone',
            label: 'Su celular',
            hint: 'Elija el país si su número no es de Bolivia.',
            control: 'tel',
            required: true,
            autocomplete: 'tel',
            testId: 'alta-apoyo-telefono',
            ancho: 'mitad',
            mensajeDeError: 'Ingrese un número completo para el país elegido.',
          },
          {
            key: 'password',
            label: 'Contraseña',
            hint: 'Al menos 8 caracteres.',
            control: 'password',
            required: true,
            autocomplete: 'new-password',
            placeholder: 'Su contraseña',
            testId: 'alta-apoyo-password',
            icono: 'lock',
            mensajeDeError: MESSAGE_SHORT_PASSWORD,
          },
        ],
      },
    ]),
  );

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');
  /** Si la cuenta ya quedó creada: el formulario deja lugar a la confirmación. */
  protected readonly creada = signal(false);

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') return state.issues[0]?.message ?? null;
    if (state.status === 'offline') return 'No pudimos conectarnos. Revise su conexión y reintente.';
    if (state.status === 'error') return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    return null;
  });

  constructor() {
    this.cargarDepartamentos();
  }

  protected cargarDepartamentos(): void {
    this.departamentos.listar().subscribe({
      next: (opciones) => {
        this.catalogoCaido.set(false);
        this.opcionesDepartamento.set(opciones.map((o) => ({ value: o.conceptId, label: o.display })));
      },
      error: () => {
        this.opcionesDepartamento.set([]);
        this.catalogoCaido.set(true);
      },
    });
  }

  protected submit(): void {
    if (this.isSubmitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.state.set(loading());
    this.client.registerSupportStaff(this.datos()).subscribe({
      next: () => {
        this.state.set(ready(null));
        this.creada.set(true);
      },
      error: (error: unknown) => this.state.set(registrationErrorToViewState(error, 'patient')),
    });
  }

  protected irALogin(): void {
    void this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/my-support' } });
  }

  private datos(): SupportStaffRegistration {
    const valor = this.form.getRawValue();
    const nombre = valor.personName;
    return {
      name: nombre.name.trim(),
      // Sin columna para el tercer nombre ni los agregados: se pliegan en
      // `middleName`, igual que en el alta de paciente.
      middleName: joinNames([nombre.middleName, nombre.thirdName, ...nombre.extraNames]),
      lastName: nombre.lastName.trim(),
      motherLastName: nombre.motherLastName.trim(),
      nationalId: valor.nationalId.trim(),
      issuerAdministrativeAreaConceptId: valor.issuerAdministrativeAreaConceptId ?? '',
      birthDate: fechaIso(valor.birthDate ?? new Date()),
      email: valor.email.trim(),
      phone: valor.phone,
      password: valor.password,
    };
  }
}
