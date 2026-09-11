import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import type { OrganizationRegistration } from '../../../core/data-access/iam/iam.types';
import { LegalEntityTypesCatalog } from '../../../core/data-access/system-context/legal-entity-types.service';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type { DynamicEnumOption } from '../../../core/data-access/system-context/system-context.types';
import { Link } from '../../../shared/components/atoms/link/link';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
 *
 * ## Tipo societario y país de constitución (subtarea 1.1)
 *
 * El registro de procesos pide que el tipo societario se **elija de una
 * lista cerrada**, «para tener DATA de cuántos proveedores tenemos con SRL,
 * UNIPERSONAL y S.A.». `incorporationCountry` es un campo **sólo de la
 * interfaz**: filtra qué figuras ofrece el selector de tipo societario, pero
 * no viaja al backend — un `PAYER` no es territorial (no exige
 * `countryConceptId`, ver `TERRITORIAL_TENANT_TYPES`), y el backend deriva el
 * país de constitución del propio `legalEntityType` elegido
 * (`countryConceptForLegalEntityType`). Cambiar de país recalcula las
 * opciones del tipo societario y limpia la elección si dejó de pertenecer a
 * la lista nueva — mismo patrón que el título profesional y sus
 * especialidades en `RegisterPractitioner`.
 */
@Component({
  selector: 'app-register-organization',
  imports: [
    RouterLink,
    Link,
    Alert,
    AuthSplit,
    AnnounceOnAppear,
    PaginatedForm,
  ],
  templateUrl: './register-organization.html',
  styleUrl: './register-organization.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterOrganization {
  private readonly iam = inject(IamClient);
  private readonly router = inject(Router);
  private readonly legalEntityTypes = inject(LegalEntityTypesCatalog);

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
    // País de constitución y tipo societario (subtarea 1.1). El país nunca
    // viaja al backend: sólo filtra qué figuras ofrece el segundo campo. Ver
    // el JSDoc de la clase.
    incorporationCountry: new FormControl('BO', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    legalEntityType: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
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

  /** Las opciones crudas del catálogo, sin filtrar por país. */
  private readonly opcionesTipoSocietarioCrudas = signal<readonly DynamicEnumOption[]>([]);
  protected readonly catalogoTipoSocietarioCaido = signal(false);

  /** Los cinco países que ofrece el diccionario, Bolivia primero. */
  protected readonly opcionesPaisSocietario: readonly SelectOption<string>[] =
    this.legalEntityTypes.paises();

  /** Las formas societarias del país elegido, ya traducidas. */
  protected readonly opcionesTipoSocietario = computed<readonly SelectOption<string>[]>(() =>
    this.legalEntityTypes.opcionesPorPais(
      this.opcionesTipoSocietarioCrudas(),
      this.incorporationCountryElegido(),
    ),
  );

  /**
   * El país elegido, **como señal**.
   *
   * Duplica el valor del `FormControl` a propósito: `opcionesTipoSocietario`
   * es un `computed`, y un `computed` sólo se recalcula cuando cambia una
   * SEÑAL que leyó — el valor de un `FormControl` no lo despierta. Mismo
   * patrón que `tituloProfesionalElegido` en `RegisterPractitioner`.
   */
  private readonly incorporationCountryElegido = signal('BO');

  /**
   * El alta, servida de a una página.
   *
   * Catorce campos en una pantalla es lo que hace abandonar un registro a la
   * mitad, y este es el alta pública de una aseguradora: quien la abre no tiene
   * ninguna obligación de terminarla. Las tres secciones son las que ya
   * separaban visualmente el formulario —la empresa, su identificación ante la
   * plataforma, y la cuenta de quien la administra—; el motor las parte en
   * páginas de cuatro conservando el nombre.
   *
   * `computed`, y no una constante: las opciones del tipo societario cambian
   * con el país elegido (subtarea 1.1).
   */
  protected readonly paginas = computed(() =>
    paginarCampos([
      {
        titulo: 'La empresa',
        hint: 'Cómo se llama y qué figura jurídica tiene.',
        campos: [
          {
            key: 'legalName',
            label: 'Nombre de la empresa',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-nombre',
            mensajeDeError: 'Escribí el nombre de la empresa.',
          },
          {
            key: 'incorporationCountry',
            label: 'País de constitución',
            hint: 'Determina qué figuras societarias se pueden elegir.',
            control: 'select' as const,
            options: this.opcionesPaisSocietario,
            required: true,
            testId: 'registro-organizacion-pais',
            mensajeDeError: 'Elegí el país de constitución.',
          },
          {
            key: 'legalEntityType',
            label: 'Tipo societario',
            hint: 'La figura jurídica con la que está constituida la empresa.',
            control: 'select' as const,
            options: this.opcionesTipoSocietario(),
            required: true,
            testId: 'registro-organizacion-tipo-societario',
            mensajeDeError: 'Elegí el tipo societario.',
          },
          {
            key: 'tradeName',
            label: 'Nombre comercial (opcional)',
            hint: 'Con el que la conocen los afiliados. Es el que se ve en el directorio.',
            control: 'text' as const,
            testId: 'registro-organizacion-comercial',
          },
        ],
      },
      {
        titulo: 'Cómo se la identifica',
        hint: 'El código y la sigla con los que aparece en la plataforma.',
        campos: [
          {
            key: 'code',
            label: 'Código',
            hint: 'Identificador único en toda la plataforma.',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-codigo',
            mensajeDeError: 'Escribí un código: letras, números, punto, guion o guion bajo.',
          },
          {
            key: 'sigla',
            label: 'Sigla',
            hint: 'Las pocas letras con las que se la nombra en tablas y comprobantes.',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-sigla',
            mensajeDeError: 'Escribí la sigla (hasta 20 caracteres).',
          },
          {
            key: 'carrierCode',
            label: 'Código de aseguradora',
            hint: 'El código interno con el que la plataforma la identifica.',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-carrier',
            mensajeDeError: 'Escribí el código de aseguradora (hasta 60 caracteres).',
          },
          {
            key: 'timeZone',
            label: 'Zona horaria (opcional)',
            hint: 'Formato IANA, por ejemplo America/La_Paz.',
            control: 'text' as const,
            testId: 'registro-organizacion-zona',
            mensajeDeError: 'La zona horaria no puede superar los 100 caracteres.',
          },
        ],
      },
      {
        titulo: 'Datos de la aseguradora',
        hint: 'Lo que la plataforma necesita para facturarle y ubicarla.',
        campos: [
          {
            key: 'regulatorIdentifier',
            label: 'NIT',
            hint: 'El número de identificación tributaria, para la facturación.',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-nit',
            mensajeDeError: 'Escribí el NIT de la empresa.',
          },
          {
            key: 'address',
            label: 'Dirección',
            hint: 'La de la casa matriz. Las de cada sucursal se cargan después.',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-direccion',
            mensajeDeError: 'Escribí la dirección (hasta 300 caracteres).',
          },
        ],
      },
      {
        titulo: 'Tu cuenta',
        hint: 'Quien administra la aseguradora en la plataforma.',
        campos: [
        {
          key: 'name',
          label: 'Nombre',
          control: 'text' as const,
          required: true,
          autocomplete: 'given-name',
          testId: 'registro-organizacion-owner-nombre',
          mensajeDeError: 'Ingresá tu nombre.',
        },
        {
          key: 'middleName',
          label: 'Segundo nombre (opcional)',
          control: 'text' as const,
          autocomplete: 'additional-name',
          testId: 'registro-organizacion-owner-segundo-nombre',
        },
        {
          key: 'lastName',
          label: 'Apellido paterno',
          control: 'text' as const,
          required: true,
          autocomplete: 'family-name',
          testId: 'registro-organizacion-owner-apellido-paterno',
          mensajeDeError: 'Ingresá tu apellido paterno.',
        },
        {
          key: 'motherLastName',
          label: 'Apellido materno (opcional)',
          control: 'text' as const,
          autocomplete: 'family-name',
          testId: 'registro-organizacion-owner-apellido-materno',
        },
        {
          key: 'email',
          label: 'Correo',
          hint: 'Con este correo vas a iniciar sesión.',
          control: 'email' as const,
          required: true,
          autocomplete: 'username',
          testId: 'registro-organizacion-owner-correo',
          mensajeDeError: 'Ingresá un correo válido.',
        },
        {
          key: 'password',
          label: 'Contraseña',
          hint: 'Al menos 8 caracteres.',
          control: 'password' as const,
          required: true,
          autocomplete: 'new-password',
          testId: 'registro-organizacion-owner-password',
          mensajeDeError: 'La contraseña necesita al menos 8 caracteres.',
        },
      ],
    },
    ]),
  );

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

  constructor() {
    this.cargarTipoSocietario();
    this.acomodarPaisYTipoSocietario();
  }

  /**
   * Trae el catálogo de tipos societarios (subtarea 1.1).
   *
   * Un fallo no bloquea el registro visualmente —el campo sigue siendo
   * obligatorio, pero no hay nada que romper si el catálogo tarda—: se avisa
   * con `catalogoTipoSocietarioCaido` para que la pantalla pueda ofrecer
   * reintentar, mismo criterio que el resto de los catálogos del registro.
   */
  protected cargarTipoSocietario(): void {
    this.legalEntityTypes.listar().subscribe({
      next: (opciones) => {
        this.catalogoTipoSocietarioCaido.set(false);
        this.opcionesTipoSocietarioCrudas.set(opciones);
      },
      error: () => {
        this.opcionesTipoSocietarioCrudas.set([]);
        this.catalogoTipoSocietarioCaido.set(true);
      },
    });
  }

  /** Reintenta la lectura del catálogo. Ver `reintentarDepartamentos` en `RegisterPractitioner`. */
  protected reintentarTipoSocietario(): void {
    this.legalEntityTypes.olvidar();
    this.cargarTipoSocietario();
  }

  /**
   * Cambiar el país recalcula las opciones del tipo societario y limpia la
   * elección si dejó de pertenecer a la lista nueva — un desplegable con un
   * valor que no está entre sus opciones muestra un vacío que miente. Se
   * llama desde el constructor: `takeUntilDestroyed` pide contexto de
   * inyección.
   */
  private acomodarPaisYTipoSocietario(): void {
    const pais = this.form.controls.incorporationCountry;
    const tipoSocietario = this.form.controls.legalEntityType;
    pais.valueChanges.pipe(takeUntilDestroyed()).subscribe((valor) => {
      this.incorporationCountryElegido.set(valor);

      const validos = new Set(this.opcionesTipoSocietario().map((o) => o.value));
      if (tipoSocietario.value !== '' && !validos.has(tipoSocietario.value)) {
        tipoSocietario.setValue('');
      }
    });
  }

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
      legalEntityType: raw.legalEntityType,
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
