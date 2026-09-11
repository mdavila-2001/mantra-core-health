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
import { IamClient } from '../../../../core/data-access/iam/iam.client';
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
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { CampoPersonalizado } from '../../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../../shared/components/organisms/paginated-form/paginated-form';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { paginarCampos } from '../../../../shared/forms/paginated/paginar-campos';
import { ORGANIZATIONS_ROUTE, organizationDetailRoute } from '../organizations.routes';

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
    CampoPersonalizado,
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
  private readonly iam = inject(IamClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

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
  });

  protected readonly tipo = toSignal(this.form.controls.tipo.valueChanges, {
    initialValue: this.form.controls.tipo.value,
  });
  private readonly enviado = signal(false);

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
    paginarCampos([
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
              ? 'Ya existe una organización con este código. Probá con otro.'
              : 'Escribí el código de la sub-organización.',
          },
          {
            key: 'legalName',
            label: 'Razón social',
            control: 'text' as const,
            required: true,
            testId: 'alta-filial-razon',
            mensajeDeError: 'Escribí la razón social (hasta 300 caracteres).',
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
            placeholder: 'Elegí un tipo',
            mensajeDeError: 'Elegí el tipo de la sub-organización.',
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
                  hint: 'Buscá por nombre; el código acompaña para distinguir homónimos.',
                  control: 'custom' as const,
                  required: true,
                },
                {
                  key: 'jurisdiccion',
                  label: 'Jurisdicción',
                  hint: 'La jurisdicción regulatoria, por ejemplo «Bolivia · JUR_BO».',
                  control: 'custom' as const,
                  required: true,
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
            hint: 'Buscá por nombre o correo y elegí de la lista.',
            control: 'custom' as const,
            required: true,
          },
        ],
      },
    ]),
  );

  protected readonly esTerritorial = computed(() => {
    const tipo = this.tipo();
    return tipo !== null && TERRITORIAL_TENANT_TYPES.includes(tipo);
  });

  protected readonly tipoFaltante = computed(() => this.enviado() && this.tipo() === null);

  /* ---- administrador de la filial: se elige, nunca se tipea -------------- */

  protected readonly administrador = signal<ReferenceOption | null>(null);
  protected readonly candidatosAdmin = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoAdmin = signal(false);

  protected readonly adminFaltante = computed(
    () => this.enviado() && this.administrador() === null,
  );

  /* ---- país y jurisdicción: obligatorios para los tipos territoriales ---- */

  protected readonly pais = signal<ReferenceOption | null>(null);
  protected readonly candidatosPais = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoPais = signal(false);

  protected readonly jurisdiccion = signal<ReferenceOption | null>(null);
  protected readonly candidatosJurisdiccion = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoJurisdiccion = signal(false);

  protected readonly paisFaltante = computed(
    () => this.enviado() && this.esTerritorial() && this.pais() === null,
  );
  protected readonly jurisdiccionFaltante = computed(
    () => this.enviado() && this.esTerritorial() && this.jurisdiccion() === null,
  );

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message || 'Necesitás administración de seguridad para crear una filial.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  /** El código es único global: un `409` sólo puede venir de él. */
  protected readonly codigoEnConflicto = computed(() => {
    const state = this.state();
    return (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT' || issue.field === 'code')
    );
  });

  protected buscarAdministrador(texto: string): void {
    if (texto === '') {
      this.candidatosAdmin.set([]);
      return;
    }

    this.buscandoAdmin.set(true);
    this.iam.searchUsers({ query: texto, limit: CANDIDATOS_POR_BUSQUEDA }).subscribe({
      next: (pagina) => {
        this.candidatosAdmin.set(
          pagina.items.map((usuario) => ({
            value: usuario.id,
            label: usuario.displayName,
            ...(usuario.emailVerified ? {} : { hint: 'Correo sin verificar' }),
          })),
        );
        this.buscandoAdmin.set(false);
      },
      error: () => {
        this.candidatosAdmin.set([]);
        this.buscandoAdmin.set(false);
      },
    });
  }

  protected buscarPais(texto: string): void {
    this.buscarConcepto(texto, this.candidatosPais, this.buscandoPais);
  }

  protected buscarJurisdiccion(texto: string): void {
    this.buscarConcepto(texto, this.candidatosJurisdiccion, this.buscandoJurisdiccion);
  }

  /**
   * Busca conceptos y los traduce a opciones, con el código como pista.
   *
   * @param texto - Lo que se escribió en el buscador.
   * @param destino - Dónde dejar los candidatos.
   * @param cargando - Bandera de búsqueda en curso.
   */
  private buscarConcepto(
    texto: string,
    destino: { set: (opciones: readonly ReferenceOption[]) => void },
    cargando: { set: (valor: boolean) => void },
  ): void {
    if (texto === '') {
      destino.set([]);
      return;
    }

    cargando.set(true);
    this.terminology.searchConcepts({ query: texto, limit: CANDIDATOS_POR_BUSQUEDA }).subscribe({
      next: (pagina) => {
        destino.set(
          pagina.items.map((concepto) => ({
            value: concepto.conceptId,
            label: concepto.display,
            hint: concepto.code,
          })),
        );
        cargando.set(false);
      },
      error: () => {
        destino.set([]);
        cargando.set(false);
      },
    });
  }

  protected submit(): void {
    if (this.enviando()) {
      return;
    }

    this.enviado.set(true);

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
