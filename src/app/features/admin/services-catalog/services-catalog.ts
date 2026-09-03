import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type {
  NewServiceCatalogItem,
  Practice,
  ServiceCatalogItem,
  ServiceCatalogPage,
} from '../../../core/data-access/services-catalog/services-catalog.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
} from '../../../shared/components/organisms/data-table/data-table.types';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Filas por página. El backend admite hasta 500 y aplica 50 por omisión. */
const TAMANO_DE_PAGINA = 25;

/** Centinela con el que la tabla pide la página anterior. */
const VOLVER = 'anterior';

/** Largos que declara `CreateServiceCatalogItemDto`. */
const MAX_CODIGO = 60;
const MAX_NOMBRE = 200;

/**
 * Catálogo maestro de servicios (punto 3 del reclamo) — `administration/services-catalog`.
 *
 * ## Por qué listado y alta viven en la misma pantalla
 *
 * A diferencia de organizaciones, el alta acá es un formulario de tres campos
 * sobre una lista que ya se está mirando: separarla en su propia ruta obligaría
 * a ir y volver para ver si el código que se va a usar ya existe. El formulario
 * se abre inline y al guardar recarga la página vigente del listado.
 *
 * ## Todo cuelga de la práctica elegida
 *
 * Igual que el mayor contable (`features/accounting/accounting.ts`): ninguna
 * lectura del catálogo responde sin `practiceId`, así que lo primero que se pide
 * es el listado de prácticas.
 *
 * ## Un médico no puede dar de alta
 *
 * El botón "Nuevo servicio" siempre se muestra —esconderlo no protege nada, la
 * autoridad es la API— pero el `POST` exige `SECURITY_ADMIN` en el backend: a
 * quien no lo tiene, el envío vuelve `FORBIDDEN` y el error se muestra igual
 * que cualquier otro fallo de envío.
 */
@Component({
  selector: 'app-services-catalog',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    Badge,
    DataTable,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    ReactiveFormsModule,
    RouterLink,
    SearchField,
    Select,
  ],
  templateUrl: './services-catalog.html',
  styleUrl: './services-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesCatalog {
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly celdaPrecio =
    viewChild.required<TemplateRef<{ $implicit: ServiceCatalogItem }>>('celdaPrecio');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: ServiceCatalogItem }>>('celdaEstado');

  /* ---- práctica ----------------------------------------------------------- */

  private readonly practicas = toSignal(
    this.catalog.listPractices().pipe(catchError(() => of<readonly Practice[]>([]))),
    { initialValue: undefined },
  );

  protected readonly opcionesDePractica = computed<readonly SelectOption<string>[]>(() =>
    (this.practicas() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  /** `linkedSignal`: al llegar el listado se preselecciona la primera práctica
   *  sin pisar la elección de quien ya tocó el selector. */
  protected readonly practicaElegida = linkedSignal<readonly Practice[] | undefined, string | null>({
    source: this.practicas,
    computation: (lista, previo) => previo?.value ?? lista?.[0]?.id ?? null,
  });

  protected cambiarPractica(practiceId: string | null): void {
    this.practicaElegida.set(practiceId);
  }

  /* ---- listado -------------------------------------------------------------*/

  protected readonly resultados = signal<ViewState<readonly ServiceCatalogItem[]>>(loading());

  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  private readonly historia = signal<readonly (string | undefined)[]>([undefined]);
  private readonly cursorSiguiente = signal<string | null>(null);

  protected readonly cursor = computed<CursorState>(() => ({
    prevCursor: this.historia().length > 1 ? VOLVER : null,
    nextCursor: this.cursorSiguiente(),
  }));

  protected readonly columnas = computed<readonly ColumnDef<ServiceCatalogItem>[]>(() => [
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'name', header: 'Servicio', priority: 1 },
    { key: 'defaultPrice', header: 'Precio de referencia', priority: 1, align: 'end', cell: this.celdaPrecio() },
    { key: 'isActive', header: 'Estado', priority: 2, cell: this.celdaEstado() },
  ]);

  protected readonly porId = (row: ServiceCatalogItem): string => row.id;
  protected readonly cargando = computed(() => this.resultados().status === 'loading');

  constructor() {
    // Un cambio de práctica o de filtro es una lista nueva: el cursor que había
    // era de la anterior y seguirlo devolvería una página del listado viejo.
    effect(() => {
      this.practicaElegida();
      this.busqueda();
      untracked(() => {
        this.historia.set([undefined]);
        this.cargar();
      });
    });
  }

  protected buscar(texto: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: texto === '' ? {} : { q: texto },
      replaceUrl: true,
    });
  }

  protected mover(cursor: string): void {
    if (cursor === VOLVER) {
      this.historia.update((visitados) => visitados.slice(0, -1));
    } else {
      this.historia.update((visitados) => [...visitados, cursor]);
    }
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    const practiceId = this.practicaElegida();
    if (practiceId === null) {
      this.cursorSiguiente.set(null);
      this.resultados.set(
        empty({ label: 'Elegir una práctica' }, 'Elegí una práctica para ver su catálogo.'),
      );
      return;
    }

    this.resultados.set(loading());
    const texto = this.busqueda();
    const cursorActual = this.historia().at(-1);

    this.catalog
      .search(practiceId, {
        limit: TAMANO_DE_PAGINA,
        ...(texto === '' ? {} : { query: texto }),
        ...(cursorActual === undefined ? {} : { cursor: cursorActual }),
      })
      .subscribe({
        next: (pagina) => {
          this.cursorSiguiente.set(pagina.nextCursor);
          this.resultados.set(this.estadoDe(pagina));
        },
        error: (error: unknown) => {
          this.cursorSiguiente.set(null);
          this.resultados.set(errorToViewState<readonly ServiceCatalogItem[]>(error));
        },
      });
  }

  private estadoDe(pagina: ServiceCatalogPage): ViewState<readonly ServiceCatalogItem[]> {
    if (pagina.items.length > 0) {
      return ready(pagina.items);
    }

    return this.busqueda() === ''
      ? empty(
          { label: 'Dar de alta un servicio' },
          'Esta práctica todavía no tiene servicios en su catálogo.',
        )
      : empty({ label: 'Ver todo el catálogo' }, `Ningún servicio coincide con «${this.busqueda()}».`);
  }

  /* ---- alta ----------------------------------------------------------------*/

  protected readonly mostrarAlta = signal(false);

  protected readonly formAlta = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODIGO)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    defaultPrice: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)],
    }),
  });

  protected readonly estadoAlta = signal<ViewState<null>>(ready(null));
  protected readonly enviandoAlta = computed(() => this.estadoAlta().status === 'loading');

  protected readonly errorAlta = computed<string | null>(() => {
    const state = this.estadoAlta();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return (
        state.message ?? 'Sólo una cuenta administradora puede dar de alta servicios del catálogo.'
      );
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected readonly codigoEnConflicto = computed(() => {
    const state = this.estadoAlta();
    return (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT' || issue.field === 'code')
    );
  });

  protected abrirAlta(): void {
    this.mostrarAlta.set(true);
  }

  protected cancelarAlta(): void {
    this.mostrarAlta.set(false);
    this.formAlta.reset({ code: '', name: '', defaultPrice: '' });
    this.estadoAlta.set(ready(null));
  }

  protected enviarAlta(): void {
    if (this.enviandoAlta()) {
      return;
    }

    const practiceId = this.practicaElegida();
    if (practiceId === null || this.formAlta.invalid) {
      this.formAlta.markAllAsTouched();
      return;
    }

    this.estadoAlta.set(loading());

    const nuevo: NewServiceCatalogItem = {
      practiceId,
      ...this.formAlta.getRawValue(),
    };

    this.catalog.create(nuevo).subscribe({
      next: (creado) => {
        this.estadoAlta.set(ready(null));
        this.toast.success(`«${creado.name}» se agregó al catálogo.`, 'Servicio creado');
        this.mostrarAlta.set(false);
        this.formAlta.reset({ code: '', name: '', defaultPrice: '' });
        this.recargar();
      },
      error: (error: unknown) => this.estadoAlta.set(errorToViewState<null>(error)),
    });
  }
}
