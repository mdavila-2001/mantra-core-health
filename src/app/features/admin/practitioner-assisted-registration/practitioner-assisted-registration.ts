import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AssistedPractitionerClient } from '../../../core/data-access/iam/assisted-practitioner.client';
import type {
  AssistedPractitionerRegistration,
  AssistedPractitionerResult,
} from '../../../core/data-access/iam/assisted-practitioner.types';
import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { joinNames } from '../../../core/profession/additional-names';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Link } from '../../../shared/components/atoms/link/link';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { Card } from '../../../shared/components/molecules/card/card';
import {
  CheckboxGroup,
  type OpcionDeCasilla,
} from '../../../shared/components/molecules/checkbox-group/checkbox-group';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { BackLink } from '../../../shared/components/atoms/back-link/back-link';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { InlineNameFields } from '../../auth/shared-registration/inline-name-fields/inline-name-fields';
import { nameGroup } from '../../auth/shared-registration/name-fields/person-name';

/** Largos que exige `RegisterPractitionerDto` en el backend. */
const MAX_MOTIVO = 500;
const MAX_ESPECIALIDADES = 4;

/** El rol con el que el médico queda operativo; el resto se asigna después. */
const ROL_CLINICO = 'CLINICIAN';

/** Las pestañas, en orden; el índice es el que usa `app-tabs`. */
const PESTANAS = ['Médico', 'Documento y matrícula', 'Habilitación y motivo'] as const;

/**
 * Alta de un médico por el administrador de seguridad
 * (`POST /iam/users/assisted-practitioner-registration`).
 *
 * ## Es la contraparte de `AssistedRegistration` (paciente)
 *
 * **Nadie fija la contraseña de otro.** La API devuelve un código de activación
 * de un solo uso y es el médico quien elige su clave en `/auth/activate`. La
 * vista de resultado existe para resolver ese momento: mostrar el código una
 * sola vez, decir cuándo vence y por dónde se usa.
 *
 * ## Lo que NO hace esta alta
 *
 * **No verifica la matrícula.** La licencia nace `PENDING`: verificarla es otra
 * decisión (con documentos) y otro endpoint. La pantalla lo dice en el
 * resultado para que nadie crea que «dado de alta» es «habilitado para
 * recetar».
 *
 * ## Forma
 *
 * Una sola tarjeta centrada con tres pestañas (regla del cliente, composition-
 * rules §5) y un único envío fuera de ellas. `app-tab` no dibuja el panel
 * cerrado, pero los `FormControl` viven en el grupo y por eso no se pierde lo
 * escrito al cambiar de pestaña; al enviar con errores, salta a la primera
 * pestaña que tiene alguno.
 *
 * El rol `CLINICIAN` viene marcado —sin el rol el médico no puede operar— y
 * la casilla es visible y desmarcable: el default no se esconde.
 */
@Component({
  selector: 'app-practitioner-assisted-registration',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    Card,
    CheckboxGroup,
    DatePipe,
    FormField,
    FormSection,
    InlineNameFields,
    Input,
    Link,
    NavIcon,
    BackLink,
    PageHeader,
    ReactiveFormsModule,
    RouterLink,
    Select,
    Tab,
    Tabs,
    Textarea,
    Tooltip,
  ],
  templateUrl: './practitioner-assisted-registration.html',
  styleUrl: './practitioner-assisted-registration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerAssistedRegistration implements OnInit {
  private readonly client = inject(AssistedPractitionerClient);
  private readonly navigation = inject(NavigationService);

  /** A dónde sale el botón «Volver». */
  protected readonly rutaVolver = '/administration/users';
  private readonly departamentos = inject(BoDepartmentsCatalog);
  private readonly catalogoEspecialidades = inject(MedicalSpecialtiesCatalog);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** El último escalón enlaza con Usuarios y se suma el de esta pantalla. */
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: '/administration/users' },
      { label: 'Registrar médico' },
    ];
  });

  protected readonly MAX_MOTIVO = MAX_MOTIVO;
  protected readonly MAX_ESPECIALIDADES = MAX_ESPECIALIDADES;
  protected readonly pestanas = PESTANAS;
  protected readonly pestana = signal(0);

  protected readonly opcionesRol: readonly OpcionDeCasilla[] = [
    { value: ROL_CLINICO, label: 'Profesional asistencial (CLINICIAN)' },
  ];

  protected readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);
  protected readonly opcionesEspecialidad = signal<readonly SelectOption<string>[]>([]);

  /**
   * Las especialidades elegidas, una casilla por cada una (`''` = sin elegir).
   * Fuera del `FormGroup` por lo mismo que en el registro del médico: el valor
   * es un `conceptId` que el selector resuelve solo. Hasta {@link MAX_ESPECIALIDADES}.
   */
  protected readonly especialidades = signal<readonly string[]>([]);
  protected readonly catalogoDepartamentosCaido = signal(false);
  protected readonly catalogoEspecialidadesCaido = signal(false);

  protected readonly form = new FormGroup({
    doctorName: nameGroup(true),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    nationalId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    issuerDepartment: new FormControl<string | null>(null, [Validators.required]),
    licenseNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    clinicalRoles: new FormControl<readonly string[]>([ROL_CLINICO], { nonNullable: true }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_MOTIVO)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  /** El resultado con el código, o `null` mientras el formulario sigue abierto. */
  protected readonly result = signal<AssistedPractitionerResult | null>(null);
  protected readonly copied = signal(false);

  /** Mensajes del servidor anclados a un campo, por nombre de campo de la API. */
  private readonly issues = computed(() => {
    const state = this.state();
    return state.status === 'validation' ? state.issues : [];
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      // Los que tienen campo se muestran junto a su campo; acá sólo los generales.
      const generales = state.issues.filter((issue) => issue.field === undefined);
      return generales.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'No tiene permiso para registrar médicos.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revise su conexión y reintente.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  ngOnInit(): void {
    if (this.isBrowser) {
      this.cargarCatalogos();
    }
  }

  protected cargarCatalogos(): void {
    this.departamentos.listar().subscribe({
      next: (opciones) => {
        this.catalogoDepartamentosCaido.set(false);
        this.opcionesDepartamento.set(
          opciones.map((o) => ({ value: o.conceptId, label: o.display })),
        );
      },
      error: () => {
        this.opcionesDepartamento.set([]);
        this.catalogoDepartamentosCaido.set(true);
      },
    });
    this.catalogoEspecialidades.listar().subscribe({
      next: (opciones) => {
        this.catalogoEspecialidadesCaido.set(false);
        this.opcionesEspecialidad.set(
          opciones.map((o) => ({ value: o.conceptId, label: o.display })),
        );
      },
      error: () => {
        this.opcionesEspecialidad.set([]);
        this.catalogoEspecialidadesCaido.set(true);
      },
    });
  }

  protected agregarEspecialidad(): void {
    if (this.especialidades().length < MAX_ESPECIALIDADES) {
      this.especialidades.update((actuales) => [...actuales, '']);
    }
  }

  protected elegirEspecialidad(indice: number, valor: string | null): void {
    this.especialidades.update((actuales) =>
      actuales.map((actual, i) => (i === indice ? (valor ?? '') : actual)),
    );
  }

  protected quitarEspecialidad(indice: number): void {
    this.especialidades.update((actuales) => actuales.filter((_, i) => i !== indice));
  }

  /** Mensaje del servidor para un campo de la API, o vacío. */
  protected issueOf(...campos: readonly string[]): string {
    return this.issues().find((i) => i.field !== undefined && campos.includes(i.field))?.message ?? '';
  }

  /** Error de un control: el del servidor si lo hay; si no, el de validación local. */
  protected errorOf(
    control: AbstractControl,
    mensaje: string,
    ...camposApi: readonly string[]
  ): string {
    const servidor = this.issueOf(...camposApi);
    if (servidor !== '') {
      return servidor;
    }
    return control.touched && control.invalid ? mensaje : '';
  }

  protected submit(): void {
    if (this.enviando()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.pestana.set(this.primeraPestanaInvalida());
      return;
    }

    this.state.set(loading());
    this.client.register(this.datos()).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.result.set(resultado);
      },
      error: (error: unknown) => {
        const estado = errorToViewState<null>(error);
        this.state.set(estado);
        // Datos preservados: sólo se lleva a quien lee a la pestaña del campo señalado.
        if (estado.status === 'validation') {
          this.pestana.set(this.pestanaDeIssue(estado.issues.map((i) => i.field)));
        }
      },
    });
  }

  protected async copiarToken(): Promise<void> {
    const token = this.result()?.activationToken;
    if (token === undefined || !this.isBrowser || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      this.copied.set(true);
    } catch {
      // El código queda a la vista: copiar es comodidad, verlo es el requisito.
    }
  }

  /** Deja la pantalla lista para otra alta y saca el código de la vista. */
  protected altaNueva(): void {
    this.form.controls.doctorName.controls.extraNames.clear();
    this.form.reset({ clinicalRoles: [ROL_CLINICO] });
    this.especialidades.set([]);
    this.result.set(null);
    this.copied.set(false);
    this.pestana.set(0);
    this.state.set(ready(null));
  }

  private primeraPestanaInvalida(): number {
    const c = this.form.controls;
    if (c.doctorName.invalid || c.email.invalid) return 0;
    if (c.nationalId.invalid || c.issuerDepartment.invalid || c.licenseNumber.invalid) return 1;
    return 2;
  }

  private pestanaDeIssue(campos: readonly (string | undefined)[]): number {
    const primero = campos.find((c) => c !== undefined);
    switch (primero) {
      case 'email':
      case 'name':
      case 'middleName':
      case 'lastName':
      case 'motherLastName':
        return 0;
      case 'nationalId':
      case 'issuerAdministrativeAreaConceptId':
      case 'licenseNumber':
      case 'specialtyConceptIds':
        return 1;
      case 'clinicalRoles':
      case 'reason':
        return 2;
      default:
        return this.pestana();
    }
  }

  private datos(): AssistedPractitionerRegistration {
    const raw = this.form.getRawValue();
    const nombre = raw.doctorName;
    // Sin columna para tercer nombre ni agregados: se pliegan en `middleName`.
    const segundoNombre = joinNames([nombre.middleName, nombre.thirdName, ...nombre.extraNames]);
    const apellidoMaterno = nombre.motherLastName.trim();
    // Sin casillas vacías ni repetidas: el contrato las toma como conceptos distintos.
    const elegidas = [...new Set(this.especialidades().filter((id) => id !== ''))];

    return {
      email: raw.email.trim(),
      name: nombre.name.trim(),
      lastName: nombre.lastName.trim(),
      ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
      ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      licenseNumber: raw.licenseNumber.trim(),
      nationalId: raw.nationalId.trim(),
      issuerAdministrativeAreaConceptId: raw.issuerDepartment ?? '',
      ...(elegidas.length === 0 ? {} : { specialtyConceptIds: elegidas }),
      ...(raw.clinicalRoles.length === 0 ? {} : { clinicalRoles: raw.clinicalRoles }),
      reason: raw.reason.trim(),
    };
  }
}
