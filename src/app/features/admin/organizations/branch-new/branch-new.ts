import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type {
  BranchTypeCode,
  NewBranch,
} from '../../../../core/data-access/directory/directory.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ORGANIZATIONS_ROUTE, organizationDetailRoute } from '../organizations.routes';

/** Largos que declara `CreateBranchDto`. */
const MAX_CODIGO = 100;
const MAX_NOMBRE = 300;
const MAX_ZONA_HORARIA = 100;

/** Rango de coordenadas que valida el backend. */
const LATITUD_MINIMA = -90;
const LATITUD_MAXIMA = 90;
const LONGITUD_MINIMA = -180;
const LONGITUD_MAXIMA = 180;

/** Etiquetas visibles de los dos tipos de sede del contrato. */
const ETIQUETAS_DE_TIPO: Readonly<Record<BranchTypeCode, string>> = {
  CLINIC: 'Clínica',
  OFFICE: 'Consultorio',
};

/**
 * Alta de una sucursal — vista **V04-06·F**
 * (`POST /tenants/{id}/branches`, UC-04-04).
 *
 * ## Por qué es el primer paso después del alta de la organización
 *
 * Una organización sin sucursales no tiene dónde agendar ni a qué sede asignar
 * a su gente: existe en el directorio y no puede operar. Por eso la ficha la
 * ofrece desde su estado vacío y el recorrido de puesta en marcha la pide antes
 * que la plantilla.
 *
 * ## El tipo viaja como código, no como concept id
 *
 * `CreateBranchDto` lo acota a dos literales y los traduce el backend, así que
 * el desplegable es fijo y la pantalla no consulta terminología. Es la misma
 * decisión que el tipo de organización en el alta, y por el mismo motivo: con
 * `BranchTypeCode` el compilador garantiza que pantalla y contrato hablan de lo
 * mismo.
 *
 * ## Las coordenadas van juntas o no van
 *
 * El backend acepta cada una por separado, pero media coordenada no ubica nada
 * —una latitud sin longitud es una línea alrededor del planeta—, así que la
 * pantalla exige el par completo. Es una regla de la vista, no del contrato.
 */
@Component({
  selector: 'app-branch-new',
  imports: [
    Alert,
    AnnounceOnAppear,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    ReactiveFormsModule,
    Select,
  ],
  templateUrl: './branch-new.html',
  styleUrl: './branch-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchNew {
  private readonly directory = inject(DirectoryClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /**
   * La organización a la que se le abre la sede, leída del segmento
   * `:tenantId`.
   *
   * Se lee del `paramMap` y no con `input()`: el router de esta aplicación no
   * declara `withComponentInputBinding()`, así que un input de ruta nunca se
   * poblaría. Mismo mecanismo que la ficha.
   */
  protected readonly tenantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('tenantId') ?? '')),
    { initialValue: '' },
  );

  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'Organizaciones', routerLink: ORGANIZATIONS_ROUTE },
    { label: 'Organización', routerLink: organizationDetailRoute(this.tenantId()) },
    { label: 'Nueva sucursal' },
  ]);

  protected readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODIGO)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    timeZone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_ZONA_HORARIA)],
    }),
    latitude: new FormControl<number | null>(null, {
      validators: [Validators.min(LATITUD_MINIMA), Validators.max(LATITUD_MAXIMA)],
    }),
    longitude: new FormControl<number | null>(null, {
      validators: [Validators.min(LONGITUD_MINIMA), Validators.max(LONGITUD_MAXIMA)],
    }),
  });

  /**
   * El tipo vive fuera del `FormGroup`, como en el alta de organización: el
   * selector trabaja con el valor tipado, no con el texto del control.
   */
  protected readonly tipo = signal<BranchTypeCode | null>(null);

  protected readonly opcionesDeTipo: readonly SelectOption<BranchTypeCode>[] = (
    Object.keys(ETIQUETAS_DE_TIPO) as BranchTypeCode[]
  ).map((code) => ({ value: code, label: ETIQUETAS_DE_TIPO[code] }));

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  /**
   * El valor del formulario como señal.
   *
   * `getRawValue()` no es reactivo: un `computed` que lo lea se calcula una vez
   * y no vuelve a invalidarse nunca, así que la regla de las coordenadas se
   * evaluaba sobre el formulario vacío para siempre. Las derivaciones cuelgan
   * de acá.
   */
  private readonly valor = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Una sola de las dos coordenadas: el par está a medias. */
  protected readonly coordenadaIncompleta = computed(() => {
    const { latitude, longitude } = this.valor();
    return (latitude == null) !== (longitude == null);
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message || 'Necesitás pertenecer a esta organización para abrir una sede.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  /** El código es único dentro de la organización: un `409` sólo viene de él. */
  protected readonly codigoEnConflicto = computed(() => {
    const state = this.state();
    return (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT' || issue.field === 'code')
    );
  });

  protected cambiarTipo(tipo: BranchTypeCode | null): void {
    this.tipo.set(tipo);
  }

  protected submit(): void {
    if (this.enviando()) {
      return;
    }

    if (this.form.invalid || this.coordenadaIncompleta()) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.directory.createBranch(this.tenantId(), this.datos()).subscribe({
      next: (sucursal) => {
        this.state.set(ready(null));
        this.toast.success(`«${sucursal.name}» ya es una sede de la organización.`, 'Sede abierta');
        void this.router.navigateByUrl(organizationDetailRoute(this.tenantId()));
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected cancelar(): void {
    void this.router.navigateByUrl(organizationDetailRoute(this.tenantId()));
  }

  /** El cuerpo de la petición; los opcionales vacíos no se mandan. */
  private datos(): NewBranch {
    const { code, name, timeZone, latitude, longitude } = this.form.getRawValue();
    const tipo = this.tipo();

    return {
      code: code.trim(),
      name: name.trim(),
      ...(tipo === null ? {} : { branchType: tipo }),
      ...(timeZone.trim() === '' ? {} : { timeZone: timeZone.trim() }),
      ...(latitude === null || longitude === null ? {} : { latitude, longitude }),
    };
  }
}
