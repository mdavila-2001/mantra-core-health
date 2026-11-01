import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import {
  TENANT_TYPE_CODES,
  TENANT_TYPE_LABELS,
  TERRITORIAL_TENANT_TYPES,
  type NewChildTenant,
  type TenantTypeCode,
} from '../../../../core/data-access/directory/directory.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { unavailableMessageOf } from '../../../../core/data-access/simulator-only';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { CustomField } from '../../../../shared/components/organisms/paginated-form/custom-field';
import { PaginatedForm } from '../../../../shared/components/organisms/paginated-form/paginated-form';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { paginateFields } from '../../../../shared/forms/paginated/paginate-fields';
import { searchConceptOptions } from '../concept-search';
import { crearBuscadorDePersonas } from '../people-search';
import { ORGANIZATIONS_ROUTE, organizationDetailRoute } from '../organizations.routes';
import { errorMessageOf } from '../../../../shared/forms/form-support';

/** S6 del envío: la organización de la ruta no está (o no se puede ver). */
const ORGANIZACION_NO_ENCONTRADA =
  'No encontramos esta organización: puede que ya no exista. Vuelva al listado de organizaciones.';

/** Largos que declara `CreateChildTenantDto`. */
const MAX_CODIGO = 100;
const MAX_NOMBRE = 300;

/** Cuántos candidatos trae cada búsqueda de referencia. */
const CANDIDATOS_POR_BUSQUEDA = 10;

/**
 * Alta de una sub-organización — vista **V04-07·F**
 * (`POST /tenants/{id}/child-tenants`, UC-04-03). Pide `SECURITY_ADMIN`.
 *
 * ## El tipo no se hereda
 *
 * El contrato lo exige a propósito: una filial puede ser de otra clase que su
 * madre —una red con un hospital y una farmacia—, así que suponerlo sería
 * adivinar. Las mismas reglas del alta raíz siguen valiendo: los tipos
 * territoriales exigen país y jurisdicción.
 *
 * ## La madre tiene que estar activa
 *
 * El backend lo hace cumplir. Una organización pendiente de verificación no
 * puede tener filiales todavía, y el `422` lo dice.
 */
@Component({
  selector: 'app-child-organization-new',
  imports: [
    Alert,
    AnnounceOnAppear,
    CustomField,
    PageHeader,
    PaginatedForm,
    ReferenceCombobox,
  ],
  templateUrl: './child-organization-new.html',
  styleUrl: './child-organization-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChildOrganizationNew {
  private readonly directory = inject(DirectoryClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Si ya se avisó que la búsqueda de personas no está en la API. */
  private busquedaNoDisponibleAvisada = false;

  /**
   * «Sin resultados» mentiría si la búsqueda no existe en la API (informe B,
   * §2): se dice qué falta, una sola vez y no en cada tecla.
   */
  private avisarBusquedaNoDisponible(error: unknown): void {
    const aviso = unavailableMessageOf(error);
    if (aviso === null || this.busquedaNoDisponibleAvisada) return;
    this.busquedaNoDisponibleAvisada = true;
    this.toast.warning(aviso);
  }

  /**
   * La organización madre, del segmento `:tenantId`.
   *
   * Del `paramMap` y no con `input()`: el router no declara
   * `withComponentInputBinding()`. Mismo mecanismo que la ficha.
   */
  protected readonly tenantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('tenantId') ?? '')),
    { initialValue: '' },
  );

  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'Organizaciones', routerLink: ORGANIZATIONS_ROUTE },
    { label: 'Organización', routerLink: organizationDetailRoute(this.tenantId()) },
    { label: 'Nueva sub-organización' },
  ]);

  protected readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODIGO)],
    }),
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    /**
     * El tipo pasó de una señal suelta a un control del grupo: el motor de
     * formularios paginados lee y valida **del grupo**, así que lo que quede
     * afuera no entra en ninguna página. De este control dependen además las
     * páginas que existen —país y jurisdicción sólo para los territoriales—.
     */
    tipo: new FormControl<TenantTypeCode | null>(null, {
      validators: [Validators.required],
    }),

    /*
     * Lo que se elige en un buscador vive también en el grupo, por la misma
     * razón que el tipo: el motor valida un campo `custom` cuando el grupo
     * tiene un control con su `key`. Como señales sueltas, «Dónde opera» se
     * daba por completa sin jurisdicción y «Crear sub-organización» no hacía
     * nada, sin petición ni mensaje. País y jurisdicción se apagan en los
     * tipos que no son territoriales.
     */
    pais: new FormControl<ReferenceOption | null>(null, { validators: [Validators.required] }),
    jurisdiccion: new FormControl<ReferenceOption | null>(null, {
      validators: [Validators.required],
    }),
    administrador: new FormControl<ReferenceOption | null>(null, {
      validators: [Validators.required],
    }),
  });

  protected readonly tipo = toSignal(this.form.controls.tipo.valueChanges, {
    initialValue: this.form.controls.tipo.value,
  });

  constructor() {
    // `valueChanges` y no un `effect`: el cambio de tipo tiene que apagar o
    // encender país y jurisdicción antes de cualquier envío, no en la cola.
    this.form.controls.tipo.valueChanges.subscribe((tipo) => this.applyTenantType(tipo));
    this.applyTenantType(this.form.controls.tipo.value);
  }

  /** Enciende país y jurisdicción sólo para los tipos territoriales. */
  private applyTenantType(tipo: TenantTypeCode | null): void {
    const territorial = tipo !== null && TERRITORIAL_TENANT_TYPES.includes(tipo);
    for (const control of [this.form.controls.pais, this.form.controls.jurisdiccion]) {
      if (territorial) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
  }

  protected readonly opcionesDeTipo: readonly SelectOption<TenantTypeCode>[] =
    TENANT_TYPE_CODES.map((code) => ({ value: code, label: TENANT_TYPE_LABELS[code] }));

  /**
   * Las páginas del alta. Las de país y jurisdicción **existen sólo si el tipo
   * es territorial**, que es la misma condición que antes envolvía a esos dos
   * campos en la plantilla: el motor no las dibuja porque no están, en vez de
   * dibujarlas y esconderlas.
   *
   * Los tres buscadores van como `custom`: son comboboxes contra la API, no
   * controles de texto.
   */
  protected readonly paginas = computed(() =>
    paginateFields([
      {
        titulo: 'Identificación',
        hint: 'Con qué se la encuentra en la plataforma.',
        campos: [
          {
            key: 'code',
            label: 'Código',
            control: 'text' as const,
            required: true,
            testId: 'alta-filial-codigo',
            mensajeDeError: this.codigoEnConflicto()
              ? 'Ya existe una organización con este código. Pruebe con otro.'
              : 'Escriba el código de la sub-organización.',
          },
          {
            key: 'legalName',
            label: 'Razón social',
            control: 'text' as const,
            required: true,
            testId: 'alta-filial-razon',
            mensajeDeError: 'Escriba la razón social (hasta 300 caracteres).',
          },
        ],
      },
      {
        titulo: 'Clasificación',
        hint: 'No se hereda de la organización madre: una red puede tener un hospital y una farmacia.',
        campos: [
          {
            key: 'tipo',
            label: 'Tipo',
            control: 'select' as const,
            required: true,
            options: this.opcionesDeTipo,
            placeholder: 'Elija un tipo',
            mensajeDeError: 'Elija el tipo de la sub-organización.',
          },
        ],
      },
      ...(this.esTerritorial()
        ? [
            {
              titulo: 'Dónde opera',
              hint: 'El backend lo exige para este tipo: determina bajo qué regulador presta atención.',
              campos: [
                {
                  key: 'pais',
                  label: 'País',
                  hint: 'Busque por nombre; el código acompaña para distinguir homónimos.',
                  control: 'custom' as const,
                  required: true,
                  mensajeDeError: 'Elija el país donde opera la sub-organización.',
                },
                {
                  key: 'jurisdiccion',
                  label: 'Jurisdicción',
                  hint: 'La jurisdicción regulatoria, por ejemplo «Bolivia · JUR_BO».',
                  control: 'custom' as const,
                  required: true,
                  mensajeDeError:
                    'Elija la jurisdicción: sin ella este tipo de organización no se puede registrar.',
                },
              ],
            },
          ]
        : []),
      {
        titulo: 'Quién la administra',
        hint: 'La cuenta tiene que existir. Queda como administradora de la sub-organización.',
        campos: [
          {
            key: 'administrador',
            label: 'Administrador',
            hint: 'Busque por nombre o correo y elija de la lista.',
            control: 'custom' as const,
            required: true,
            mensajeDeError: 'Elija la cuenta que va a administrarla.',
          },
        ],
      },
    ]),
  );

  protected readonly esTerritorial = computed(() => {
    const tipo = this.tipo();
    return tipo !== null && TERRITORIAL_TENANT_TYPES.includes(tipo);
  });


  /* ---- administrador de la filial: se elige, nunca se tipea -------------- */

  protected readonly administrador = toSignal(this.form.controls.administrador.valueChanges, {
    initialValue: this.form.controls.administrador.value,
  });
  /** La búsqueda del administrador: errores distintos del vacío y la última tecla manda. */
  protected readonly administradores = crearBuscadorDePersonas(CANDIDATOS_POR_BUSQUEDA);


  /* ---- país y jurisdicción: obligatorios para los tipos territoriales ---- */

  protected readonly pais = toSignal(this.form.controls.pais.valueChanges, {
    initialValue: this.form.controls.pais.value,
  });
  protected readonly candidatosPais = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoPais = signal(false);

  protected readonly jurisdiccion = toSignal(this.form.controls.jurisdiccion.valueChanges, {
    initialValue: this.form.controls.jurisdiccion.value,
  });
  protected readonly candidatosJurisdiccion = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoJurisdiccion = signal(false);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  /**
   * El mensaje del fallo del envío, con el criterio común (`errorMessageOf`).
   * Antes cada alta repetía su propia copia, y las cinco olvidaban el `404`:
   * el formulario quedaba mudo cuando la organización ya no existía.
   */
  protected readonly errorMessage = computed<string | null>(() =>
    errorMessageOf(
      this.state(),
      'Necesita administración de seguridad para crear una filial.',
      ORGANIZACION_NO_ENCONTRADA,
    ),
  );

  /** El código es único global: un `409` sólo puede venir de él. */
  protected readonly codigoEnConflicto = computed(() => {
    const state = this.state();
    return (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT' || issue.field === 'code')
    );
  });

  protected buscarPais(texto: string): void {
    searchConceptOptions(
      this.terminology,
      texto,
      CANDIDATOS_POR_BUSQUEDA,
      this.candidatosPais,
      this.buscandoPais,
    );
  }

  protected buscarJurisdiccion(texto: string): void {
    searchConceptOptions(
      this.terminology,
      texto,
      CANDIDATOS_POR_BUSQUEDA,
      this.candidatosJurisdiccion,
      this.buscandoJurisdiccion,
    );
  }

  protected submit(): void {
    if (this.enviando()) {
      return;
    }

    if (!this.puedeEnviar()) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.directory.createChildTenant(this.tenantId(), this.datos()).subscribe({
      next: (filial) => {
        this.state.set(ready(null));
        this.toast.success(
          `«${filial.legalName}» quedó registrada como sub-organización.`,
          'Sub-organización creada',
        );
        void this.router.navigateByUrl(organizationDetailRoute(this.tenantId()));
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected cancelar(): void {
    void this.router.navigateByUrl(organizationDetailRoute(this.tenantId()));
  }

  private puedeEnviar(): boolean {
    if (this.form.invalid || this.tipo() === null || this.administrador() === null) {
      return false;
    }
    return !(this.esTerritorial() && (this.pais() === null || this.jurisdiccion() === null));
  }

  /** El cuerpo de la petición; país y jurisdicción sólo si el tipo los exige. */
  private datos(): NewChildTenant {
    const { code, legalName } = this.form.getRawValue();
    // `puedeEnviar` ya garantizó tipo y administrador; los respaldos de abajo
    // nunca corren y sólo le constan al compilador.
    const tipo = this.tipo() ?? 'PROVIDER';
    const administrador = this.administrador();
    const territorial = this.esTerritorial();
    const pais = this.pais();
    const jurisdiccion = this.jurisdiccion();

    return {
      code: code.trim(),
      legalName: legalName.trim(),
      adminUserId: administrador?.value ?? '',
      tenantType: tipo,
      ...(territorial && pais !== null ? { countryConceptId: pais.value } : {}),
      ...(territorial && jurisdiccion !== null
        ? { jurisdictionConceptId: jurisdiccion.value }
        : {}),
    };
  }
}
