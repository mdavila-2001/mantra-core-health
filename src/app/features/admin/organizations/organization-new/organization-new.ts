import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import {
  TENANT_TYPE_CODES,
  TENANT_TYPE_LABELS,
  type NewTenant,
  type TenantTypeCode,
} from '../../../../core/data-access/directory/directory.types';
import { IamClient } from '../../../../core/data-access/iam/iam.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ORGANIZATIONS_ROUTE } from '../organizations.routes';

/** Largos que declara `CreateTenantDto`. */
const MAX_CODIGO = 100;
const MAX_NOMBRE = 300;
const MAX_ZONA_HORARIA = 100;
const MAX_CODIGO_ASEGURADORA = 60;
const MAX_REGULADOR = 100;
const MAX_CODIGO_CORREDOR = 60;
const MAX_LICENCIA = 100;

/** Cuántos candidatos trae cada búsqueda del combobox de owner. */
const CANDIDATOS_POR_BUSQUEDA = 10;

/**
 * Alta de una organización raíz — vista **V04-01·F**
 * (`POST /admin/tenants`, UC-04-01). Sólo `SUPERADMIN`.
 *
 * ## El tipo manda sobre el formulario
 *
 * `PAYER` exige el bloque de aseguradora y `BROKER` el de corredor — y el
 * backend **rechaza** esos bloques en cualquier otro tipo. Por eso los
 * bloques aparecen y se validan sólo cuando el tipo elegido los pide, y al
 * enviar se manda únicamente el que corresponde.
 *
 * ## El selector de tipo usa los códigos del DTO
 *
 * TODO(IT3): poblarlo desde el servicio de `dynamic-enums` cuando exista en
 * el front. Hoy los códigos vienen de `CreateTenantDto` (`@IsIn(...)`), que
 * es el único contrato legible; el backend los resuelve al concept id.
 *
 * ## Los `*ConceptId` opcionales no se ofrecen todavía
 *
 * Entidad legal, país, jurisdicción y región de datos son selectores de
 * catálogo sin value set publicado — la misma deuda, y la misma decisión,
 * que en el alta de paciente. Queda anotado como pendiente de contrato.
 */
@Component({
  selector: 'app-organization-new',
  imports: [
    Alert,
    AnnounceOnAppear,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    ReactiveFormsModule,
    ReferenceCombobox,
    Select,
  ],
  templateUrl: './organization-new.html',
  styleUrl: './organization-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationNew {
  private readonly directory = inject(DirectoryClient);
  private readonly iam = inject(IamClient);
  private readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** El último escalón se reemplaza: desde el alta, se vuelve al listado. */
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: ORGANIZATIONS_ROUTE },
      { label: 'Nueva' },
    ];
  });

  protected readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODIGO)],
    }),
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    tradeName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_NOMBRE)],
    }),
    timeZone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_ZONA_HORARIA)],
    }),
  });

  /** Bloque de aseguradora. Se valida sólo cuando el tipo es `PAYER`. */
  protected readonly formPayer = new FormGroup({
    carrierCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODIGO_ASEGURADORA)],
    }),
    regulatorIdentifier: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_REGULADOR)],
    }),
  });

  /** Bloque de corredor. Se valida sólo cuando el tipo es `BROKER`. */
  protected readonly formBroker = new FormGroup({
    brokerCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODIGO_CORREDOR)],
    }),
    licenseNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_LICENCIA)],
    }),
  });

  /**
   * El tipo vive fuera del `FormGroup`, como la fecha en el alta de paciente:
   * el selector trabaja con el valor tipado y de él depende qué bloques
   * existen — un signal deja esa dependencia a la vista.
   */
  protected readonly tipo = signal<TenantTypeCode | null>(null);

  /** Marca que el envío ya se intentó, para mostrar los faltantes no tocados. */
  private readonly enviado = signal(false);

  protected readonly opcionesDeTipo: readonly SelectOption<TenantTypeCode>[] =
    TENANT_TYPE_CODES.map((code) => ({ value: code, label: TENANT_TYPE_LABELS[code] }));

  protected readonly esAseguradora = computed(() => this.tipo() === 'PAYER');
  protected readonly esCorredor = computed(() => this.tipo() === 'BROKER');

  protected readonly tipoFaltante = computed(() => this.enviado() && this.tipo() === null);

  /* ---- owner: se elige, nunca se tipea ---------------------------------- */

  protected readonly owner = signal<ReferenceOption | null>(null);
  protected readonly candidatosOwner = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoOwner = signal(false);

  protected readonly ownerFaltante = computed(() => this.enviado() && this.owner() === null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Sólo una cuenta SUPERADMIN puede dar de alta organizaciones.';
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
   * Si el fallo apunta al código: es el único campo con clave única global,
   * así que un `409` sólo puede venir de él.
   */
  protected readonly codigoEnConflicto = computed(() => {
    const state = this.state();
    return (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT' || issue.field === 'code')
    );
  });

  /**
   * Busca usuarios y los traduce a opciones. El `hint` distingue una cuenta
   * sin verificar: elegir de owner a alguien que nunca activó su correo es un
   * error que conviene ver antes de guardar.
   */
  protected buscarOwner(texto: string): void {
    if (texto === '') {
      this.candidatosOwner.set([]);
      return;
    }

    this.buscandoOwner.set(true);
    this.iam.searchUsers({ query: texto, limit: CANDIDATOS_POR_BUSQUEDA }).subscribe({
      next: (pagina) => {
        this.candidatosOwner.set(
          pagina.items.map((usuario) => ({
            value: usuario.id,
            label: usuario.displayName,
            ...(usuario.emailVerified ? {} : { hint: 'Correo sin verificar' }),
          })),
        );
        this.buscandoOwner.set(false);
      },
      error: () => {
        // El combobox muestra «sin resultados»; el error general de la
        // pantalla se reserva para el envío.
        this.candidatosOwner.set([]);
        this.buscandoOwner.set(false);
      },
    });
  }

  protected cambiarTipo(tipo: TenantTypeCode | null): void {
    this.tipo.set(tipo);
  }

  protected submit(): void {
    if (this.enviando()) {
      return;
    }

    this.enviado.set(true);

    if (!this.puedeEnviar()) {
      this.form.markAllAsTouched();
      this.formPayer.markAllAsTouched();
      this.formBroker.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.directory.createTenant(this.datos()).subscribe({
      next: (creada) => {
        this.state.set(ready(null));
        this.toast.success(
          `«${creada.legalName}» quedó registrada y pendiente de verificación.`,
          'Organización creada',
        );
        // Al listado: la verificación que sigue es de otro rol y otra pantalla.
        void this.router.navigateByUrl(ORGANIZATIONS_ROUTE);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected cancelar(): void {
    void this.router.navigateByUrl(ORGANIZATIONS_ROUTE);
  }

  private puedeEnviar(): boolean {
    if (this.form.invalid || this.tipo() === null || this.owner() === null) {
      return false;
    }
    if (this.esAseguradora() && this.formPayer.invalid) {
      return false;
    }
    return !(this.esCorredor() && this.formBroker.invalid);
  }

  /**
   * El cuerpo de la petición. Los opcionales vacíos no se mandan, y de los
   * bloques por tipo viaja **sólo** el que el tipo exige: el backend rechaza
   * un bloque `payer` en una farmacia.
   */
  private datos(): NewTenant {
    const { code, legalName, tradeName, timeZone } = this.form.getRawValue();
    // `puedeEnviar` ya garantizó ambos; el `?? ''` de abajo nunca corre y sólo
    // le consta al compilador.
    const tipo = this.tipo() ?? 'PROVIDER';
    const owner = this.owner();

    return {
      code: code.trim(),
      legalName: legalName.trim(),
      ownerUserId: owner?.value ?? '',
      tenantType: tipo,
      ...(tradeName.trim() === '' ? {} : { tradeName: tradeName.trim() }),
      ...(timeZone.trim() === '' ? {} : { timeZone: timeZone.trim() }),
      ...(tipo === 'PAYER' ? { payer: this.formPayer.getRawValue() } : {}),
      ...(tipo === 'BROKER' ? { broker: this.formBroker.getRawValue() } : {}),
    };
  }
}
