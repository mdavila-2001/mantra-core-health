import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type {
  BranchListItem,
  MembershipListItem,
  TenantListItem,
} from '../../../../core/data-access/directory/directory.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type {
  ConceptLabels,
  ValueSetOption,
} from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, hasData, loading, ready, stale } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { BranchBulkImport } from '../../../../shared/components/organisms/branch-bulk-import/branch-bulk-import';
import type { BranchDraft } from '../../../../shared/utils/branch-import/branch-import';
import { createBranchesInSeries } from '../../../organization/organization-branches/create-branches-in-series';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { Card } from '../../../../shared/components/molecules/card/card';
import { historialDeCursor } from '../../../../shared/components/organisms/data-table/cursor-history';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { SessionStore } from '../../../../core/auth/session.store';
import { rolesAlcanzan } from '../../../../core/navigation/navigation.types';
import {
  ORGANIZATIONS_ROUTE,
  branchNewRoute,
  childOrganizationNewRoute,
  membershipNewRoute,
  organizationVerifyRoute,
} from '../organizations.routes';
import { LoadingState } from '../../../../shared/components/molecules/loading-state/loading-state';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { crearResolvedorDeNombres } from '../person-names';
import {
  VARIANTE_POR_CODIGO,
  conceptosDe,
  esFallo,
  estadoDeLista,
} from './organization-detail.support';

/** Filas por página de la plantilla y de las sub-organizaciones. El backend aplica 50 por omisión y admite hasta 200. */
const TAMANO_DE_PAGINA = 25;

const PESTANA_SUCURSALES = 0;
const PESTANA_PLANTILLA = 1;
const PESTANA_HIJAS = 2;

/**
 * Ficha de una organización — vistas **V04-06·L** (sucursales), **V04-02·L**
 * (membresías) y **V04-07·L** (organizaciones hijas) de `SALUD/Vistas/V04
 * directory`, reunidas en las tres pestañas de un mismo registro.
 *
 * ## Por qué las tres viven en una pantalla y no en tres
 *
 * Los tres endpoints exigen el mismo `tenantId` en la ruta. Un parámetro
 * obligatorio **no es un filtro**: es el ámbito de la pantalla. Las tres listas
 * son del mismo registro, así que abren con su ficha compacta arriba y se
 * reparten en pestañas — no repiten la organización como columna ni la piden
 * de nuevo en una barra de filtros.
 *
 * ## Qué pagina y qué no
 *
 * `/branches` devuelve `{ items, count }` plano: sin cursor y sin total
 * separado. Prometer «Siguientes» sobre eso sería mentir, y por eso esa tabla
 * va sin pie de paginación. **Membresías y sub-organizaciones sí paginan por
 * cursor**, y cada una lleva el suyo (`historialDeCursor`): antes sólo se leía
 * la primera página de 25 y el resto de la plantilla no existía para la
 * pantalla, sin aviso.
 *
 * ## Los nueve estados de la ficha
 *
 * La cabecera de la organización pasa por `app-view-state-host`, que los
 * dibuja una sola vez para todo el proyecto. Antes sólo distinguía listo y
 * error, y un 403, un 404 o un corte de red caían en el `@default`: se veía
 * «Cargando…» para siempre. Con la ficha sin datos no se dibujan las pestañas:
 * las tres listas cuelgan del mismo `tenantId` y fallarían igual.
 *
 * Recargar con la ficha a la vista no la borra: si la relectura falla por
 * red o por error, se conserva lo que había como **S7** con la hora de la
 * última lectura buena, en vez de tirar datos válidos por un corte.
 *
 * ## Las lecturas no piden rol global
 *
 * Cuelgan de `/tenants/{id}`, no de `/admin/tenants`: basta pertenecer a la
 * organización. Quien no pertenece recibe `403` y un tenant inexistente
 * responde `404`, para que el código de error no sirva para sondear qué
 * identificadores existen. Los dos casos caen en el estado de error de la
 * pantalla con su mensaje propio.
 *
 * ## Las tres cargan juntas, y ninguna tumba a las otras
 *
 * Un `forkJoin` con `catchError` por rama: si la organización responde pero sus
 * membresías fallan, se ve la ficha con dos pestañas cargadas y una en error.
 * Encadenarlas dejaría la pantalla en blanco por el fallo de la tercera.
 */
@Component({
  selector: 'app-organization-detail',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    BranchBulkImport,
    Card,
    DataTable,
    DatePipe,
    Link,
    PageHeader,
    RouterLink,
    Tab,
    Tabs,
    LoadingState,
    ViewStateHost,
  ],
  templateUrl: './organization-detail.html',
  styleUrl: './organization-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationDetail {
  private readonly directory = inject(DirectoryClient);
  private readonly toasts = inject(ToastService);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionStore);

  /**
   * La organización que se está mirando, leída del segmento `:tenantId`.
   *
   * Por `paramMap` y no por `input.required`: el router de esta aplicación no
   * declara `withComponentInputBinding()`, así que un `input` de ruta nunca se
   * llenaría y la pantalla quedaría en blanco sin decir por qué. Es el mismo
   * camino que usa la ficha de paciente.
   */
  protected readonly tenantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('tenantId') ?? '')),
    { initialValue: '' },
  );

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly rutaDelListado = ORGANIZATIONS_ROUTE;

  private readonly celdaSucursal =
    viewChild.required<TemplateRef<{ $implicit: BranchListItem }>>('celdaSucursal');
  private readonly celdaEstadoSucursal =
    viewChild.required<TemplateRef<{ $implicit: BranchListItem }>>('celdaEstadoSucursal');
  private readonly celdaTipoSucursal =
    viewChild.required<TemplateRef<{ $implicit: BranchListItem }>>('celdaTipoSucursal');
  private readonly celdaAltaSucursal =
    viewChild.required<TemplateRef<{ $implicit: BranchListItem }>>('celdaAltaSucursal');

  private readonly celdaPersona =
    viewChild.required<TemplateRef<{ $implicit: MembershipListItem }>>('celdaPersona');
  private readonly celdaRol =
    viewChild.required<TemplateRef<{ $implicit: MembershipListItem }>>('celdaRol');
  private readonly celdaEstadoMembresia =
    viewChild.required<TemplateRef<{ $implicit: MembershipListItem }>>('celdaEstadoMembresia');
  private readonly celdaSede =
    viewChild.required<TemplateRef<{ $implicit: MembershipListItem }>>('celdaSede');
  private readonly celdaVigencia =
    viewChild.required<TemplateRef<{ $implicit: MembershipListItem }>>('celdaVigencia');

  private readonly celdaHija =
    viewChild.required<TemplateRef<{ $implicit: TenantListItem }>>('celdaHija');
  private readonly celdaEstadoHija =
    viewChild.required<TemplateRef<{ $implicit: TenantListItem }>>('celdaEstadoHija');

  protected readonly organizacion = signal<ViewState<TenantListItem>>(loading());
  /** La última ficha que llegó bien, y cuándo: lo que se conserva como S7 si la relectura falla. */
  private ultimaFicha: { readonly datos: TenantListItem; readonly en: Date } | null = null;
  protected readonly sucursales = signal<ViewState<readonly BranchListItem[]>>(loading());
  protected readonly membresias = signal<ViewState<readonly MembershipListItem[]>>(loading());
  protected readonly hijas = signal<ViewState<readonly TenantListItem[]>>(loading());

  /** Etiquetas de los conceptos de la ficha, acumuladas: cada página trae las suyas. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /** Pestaña abierta: gobierna cuál es la acción principal de la cabecera. */
  protected readonly pestana = signal(PESTANA_SUCURSALES);

  /** Cursor de cada lista que pagina. Una por pestaña: moverse en una no toca la otra. */
  private readonly paginadoDePlantilla = historialDeCursor();
  private readonly paginadoDeHijas = historialDeCursor();
  protected readonly cursorDePlantilla = this.paginadoDePlantilla.cursor;
  protected readonly cursorDeHijas = this.paginadoDeHijas.cursor;

  /** El nombre de cada cuenta de la plantilla, cuando la API deja leerlo. */
  private readonly personas = crearResolvedorDeNombres();

  /** La ficha ya tiene datos: es lo que habilita las pestañas y las acciones. */
  protected readonly fichaConDatos = computed(() => hasData(this.organizacion()));

  /**
   * La acción principal de la cabecera: la de la pestaña que se está mirando.
   *
   * Antes «Nueva sucursal», «Sumar a alguien» y «Nueva sub-organización» sólo
   * existían como salida del estado vacío: con una sola sucursal cargada no
   * quedaba ningún camino para crear la segunda. La acción principal va en la
   * ranura `page-actions`, presente en todos los anchos, y cambia con la pestaña.
   */
  protected readonly accionPrincipal = computed<{ label: string; route: string } | null>(() => {
    const ficha = dataOf(this.organizacion());
    if (ficha === null) {
      return null;
    }
    switch (this.pestana()) {
      case PESTANA_PLANTILLA:
        return { label: 'Sumar a alguien', route: membershipNewRoute(ficha.id) };
      case PESTANA_HIJAS:
        return { label: 'Nueva sub-organización', route: childOrganizationNewRoute(ficha.id) };
      default:
        return { label: 'Nueva sucursal', route: branchNewRoute(ficha.id) };
    }
  });

  /**
   * Nombre de cada sucursal por su id. Las asignaciones y las membresías
   * devuelven `branchId` crudo, y un uuid no le dice nada a nadie: la
   * resolución es trabajo del frontend, que ya tiene las sucursales cargadas.
   */
  private readonly nombreDeSucursal = computed<ReadonlyMap<string, string>>(() => {
    const estado = this.sucursales();
    if (estado.status !== 'ready') {
      return new Map();
    }
    return new Map(estado.data.map((sucursal) => [sucursal.id, sucursal.name]));
  });

  protected readonly columnasDeSucursal = computed<readonly ColumnDef<BranchListItem>[]>(() => [
    { key: 'name', header: 'Sucursal', priority: 1, cell: this.celdaSucursal() },
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'branchTypeConceptId', header: 'Tipo', priority: 2, cell: this.celdaTipoSucursal() },
    {
      key: 'statusConceptId',
      header: 'Estado',
      priority: 1,
      cell: this.celdaEstadoSucursal(),
    },
    { key: 'createdAt', header: 'Alta', priority: 2, cell: this.celdaAltaSucursal() },
  ]);

  protected readonly columnasDeMembresia = computed<readonly ColumnDef<MembershipListItem>[]>(
    () => [
      { key: 'userId', header: 'Persona', priority: 1, cell: this.celdaPersona() },
      { key: 'tenantRoleConceptId', header: 'Rol', priority: 1, cell: this.celdaRol() },
      {
        key: 'statusConceptId',
        header: 'Estado',
        priority: 1,
        cell: this.celdaEstadoMembresia(),
      },
      { key: 'primaryBranchId', header: 'Sucursal principal', priority: 2, cell: this.celdaSede() },
      { key: 'startDate', header: 'Vigencia', priority: 2, cell: this.celdaVigencia() },
    ],
  );

  protected readonly columnasDeHija = computed<readonly ColumnDef<TenantListItem>[]>(() => [
    { key: 'legalName', header: 'Sub-organización', priority: 1, cell: this.celdaHija() },
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'statusConceptId', header: 'Estado', priority: 1, cell: this.celdaEstadoHija() },
  ]);

  protected readonly porId = (row: { readonly id: string }): string => row.id;

  /* --- carga de sucursales en lote ---------------------------------------- */

  private readonly cargaEnLote = viewChild(BranchBulkImport);
  protected readonly cargaEnLoteAbierta = signal(false);
  protected readonly creandoLote = signal(false);
  /** Las que la API rechazó en el último lote, con su motivo. */
  protected readonly rechazosDelLote = signal<readonly { nombre: string; motivo: string }[]>([]);

  /** Se ofrece con la lista a la vista: sin ella no hay contra qué detectar repetidas. */
  protected readonly puedeSubirEnLote = computed(() => {
    const estado = this.sucursales().status;
    return estado === 'ready' || estado === 'empty';
  });

  protected readonly nombresDeSucursales = computed(() => {
    const estado = this.sucursales();
    return estado.status === 'ready' ? estado.data.map((sucursal) => sucursal.name) : [];
  });

  protected abrirCargaEnLote(): void {
    this.rechazosDelLote.set([]);
    this.cargaEnLoteAbierta.set(true);
  }

  /**
   * Crea las sucursales del archivo **una por una**, en su orden.
   *
   * No hay alta masiva en la API (`POST /tenants/{id}/branches` es de a una), y
   * en serie —no en paralelo— porque el código es único por organización: dos
   * altas simultáneas con el mismo código derivado se pisarían. Una que falla
   * no frena a las demás; al final se dice cuáles no entraron y por qué.
   */
  protected crearSucursalesEnLote(lote: readonly BranchDraft[]): void {
    const tenantId = this.tenantId();
    if (tenantId === '' || this.creandoLote() || lote.length === 0) {
      return;
    }
    const estado = this.sucursales();
    const codigosTomados = estado.status === 'ready' ? estado.data.map((sucursal) => sucursal.code) : [];

    this.creandoLote.set(true);
    this.rechazosDelLote.set([]);
    createBranchesInSeries(this.directory, tenantId, lote, codigosTomados).subscribe(
      ({ created: creadas, rejected, unsavedNotice }) => {
        this.creandoLote.set(false);
        if (unsavedNotice !== null) this.toasts.warning(unsavedNotice);
        if (creadas > 0) {
          this.toasts.success(
            creadas === 1
              ? 'Se creó 1 sucursal.'
              : `Se crearon ${creadas} sucursales.`,
            'Sucursales cargadas',
          );
        }
        this.rechazosDelLote.set(rejected.map(({ name, reason }) => ({ nombre: name, motivo: reason })));
        this.cargaEnLote()?.close();
        this.cargar();
      },
    );
  }

  constructor() {
    // El id viaja en la ruta: navegar de una organización a otra sin desmontar
    // el componente tiene que recargar las cuatro lecturas.
    effect(() => {
      this.tenantId();
      untracked(() => this.cargar());
    });
  }

  /**
   * Reintento y «Actualizar»: relee todo. Con la ficha a la vista no la
   * borra mientras carga (ver el comentario de clase sobre S7).
   */
  protected recargar(): void {
    this.cargar({ conservarFicha: this.ultimaFicha !== null });
  }

  /** Reintento de una sola lista: no vuelve a pedir la ficha ni la otra pestaña. */
  protected recargarPlantilla(): void {
    this.cargarMembresias();
  }

  protected recargarHijas(): void {
    this.cargarHijas();
  }

  protected moverPlantilla(cursor: string): void {
    this.paginadoDePlantilla.mover(cursor);
    this.cargarMembresias();
  }

  protected moverHijas(cursor: string): void {
    this.paginadoDeHijas.mover(cursor);
    this.cargarHijas();
  }

  /** El nombre de la cuenta, si la API dejó leerlo. */
  protected nombreDe(userId: string): string | undefined {
    return this.personas.nombres().get(userId);
  }

  /** La etiqueta de un concepto, si el catálogo la conoce. */
  protected etiquetaDe(conceptId: string | undefined): ValueSetOption | undefined {
    return conceptId === undefined ? undefined : this.etiquetas().get(conceptId);
  }

  protected varianteDe(conceptId: string): BadgeVariant {
    const opcion = this.etiquetaDe(conceptId);
    return (opcion && VARIANTE_POR_CODIGO[opcion.code]) ?? 'info';
  }

  protected sucursalDe(branchId: string | undefined): string | undefined {
    return branchId === undefined ? undefined : this.nombreDeSucursal().get(branchId);
  }

  /**
   * A dónde lleva el botón de verificar.
   *
   * Se ofrece sólo mientras la organización está sin verificar y a quien puede
   * hacerlo. `rolesAlcanzan` y no un `includes` propio: el comodín `SUPERADMIN`
   * tiene que pasar igual que en el menú, y duplicar la regla es cómo las dos
   * lecturas terminan diciendo cosas distintas.
   *
   * Devuelve `null` en vez de un booleano aparte porque la plantilla necesita
   * la ruta, y dos señales que hay que leer juntas son una sola.
   */
  protected readonly rutaDeVerificacion = computed<string | null>(() => {
    const ficha = this.organizacion();
    if (ficha.status !== 'ready') {
      return null;
    }
    if (!rolesAlcanzan(['SECURITY_ADMIN'], this.session.roles())) {
      return null;
    }
    const verificacion = this.etiquetaDe(ficha.data.verificationStatusConceptId);
    // Sin etiqueta el catálogo no respondió: no se ofrece una acción cuyo
    // sentido no se puede afirmar.
    if (verificacion === undefined || verificacion.code === 'TENANT_VERIFIED') {
      return null;
    }
    return organizationVerifyRoute(ficha.data.id);
  });

  private cargar(opciones: { conservarFicha?: boolean } = {}): void {
    const id = this.tenantId();
    if (id === '') {
      return;
    }

    if (opciones.conservarFicha !== true) {
      this.ultimaFicha = null;
      this.organizacion.set(loading());
    }
    this.sucursales.set(loading());
    this.paginadoDePlantilla.reiniciar();
    this.paginadoDeHijas.reiniciar();

    // Cada lectura falla por su cuenta: una caída deja su pestaña en error y no
    // arrastra a las demás. Las tres listas no esperan a la ficha.
    this.directory.getTenant(id).subscribe({
      next: (ficha) => {
        this.ultimaFicha = { datos: ficha, en: new Date() };
        this.organizacion.set(ready(ficha));
        this.resolverEtiquetas(
          conceptosDe({ ficha }),
        );
      },
      error: (error: unknown) => {
        const estado = errorToViewState<TenantListItem>(error);
        const previa = this.ultimaFicha;
        // Un corte al releer no tira datos que eran buenos: se conservan,
        // con la hora de la última lectura (S7). Un 403/404 sí los quita —ya
        // no se puede afirmar que sigan siendo visibles—.
        const conservable = estado.status === 'offline' || estado.status === 'error';
        this.organizacion.set(
          previa !== null && conservable ? stale(previa.datos, previa.en) : estado,
        );
      },
    });

    this.directory
      .listBranches(id)
      .pipe(catchError((error: unknown) => of({ error })))
      .subscribe((sucursales) => {
        this.sucursales.set(
          esFallo(sucursales)
            ? errorToViewState<readonly BranchListItem[]>(sucursales.error)
            : estadoDeLista(
                sucursales.items,
                { label: 'Nueva sucursal', route: branchNewRoute(id) },
                'Una sucursal es cada lugar físico donde esta organización atiende. Sin al menos una no hay dónde agendar ni a qué sede asignar a la plantilla.',
              ),
        );
        if (!esFallo(sucursales)) {
          this.resolverEtiquetas(conceptosDe({ sucursales: sucursales.items }));
        }
      });

    this.cargarMembresias();
    this.cargarHijas();
  }

  /** Una página de la plantilla, con el cursor vigente. */
  private cargarMembresias(): void {
    const id = this.tenantId();
    if (id === '') {
      return;
    }
    const cursor = this.paginadoDePlantilla.actual();
    this.membresias.set(loading());
    this.directory
      .listMemberships(id, {
        limit: TAMANO_DE_PAGINA,
        ...(cursor === undefined ? {} : { cursor }),
      })
      .pipe(catchError((error: unknown) => of({ error })))
      .subscribe((membresias) => {
        if (esFallo(membresias)) {
          // Un fallo deja el historial donde estaba: reintentar repite esta página.
          this.paginadoDePlantilla.llego(null);
          this.membresias.set(errorToViewState<readonly MembershipListItem[]>(membresias.error));
          return;
        }
        this.paginadoDePlantilla.llego(membresias.nextCursor);
        this.membresias.set(
          estadoDeLista(
            membresias.items,
            { label: 'Sumar a alguien', route: membershipNewRoute(id) },
            'La plantilla es quién trabaja acá y con qué rol. Mientras esté vacía, sólo quien creó la organización puede entrar.',
          ),
        );
        this.resolverEtiquetas(conceptosDe({ membresias: membresias.items }));
        this.personas.resolver(membresias.items.map((membresia) => membresia.userId));
      });
  }

  /** Una página de las sub-organizaciones, con el cursor vigente. */
  private cargarHijas(): void {
    const id = this.tenantId();
    if (id === '') {
      return;
    }
    const cursor = this.paginadoDeHijas.actual();
    this.hijas.set(loading());
    this.directory
      .listChildTenants(id, {
        limit: TAMANO_DE_PAGINA,
        ...(cursor === undefined ? {} : { cursor }),
      })
      .pipe(catchError((error: unknown) => of({ error })))
      .subscribe((hijas) => {
        if (esFallo(hijas)) {
          this.paginadoDeHijas.llego(null);
          this.hijas.set(errorToViewState<readonly TenantListItem[]>(hijas.error));
          return;
        }
        this.paginadoDeHijas.llego(hijas.nextCursor);
        this.hijas.set(
          estadoDeLista(
            hijas.items,
            { label: 'Nueva sub-organización', route: childOrganizationNewRoute(id) },
            'Una sub-organización es una unidad con identidad propia dentro de esta —una red de farmacias, un instituto—. La mayoría de las organizaciones no tiene ninguna, y está bien así.',
          ),
        );
        this.resolverEtiquetas(conceptosDe({ hijas: hijas.items }));
      });
  }

  /**
   * Suma las etiquetas de unos concept ids a las que ya hay. Una lectura por
   * tanda de ids nuevos, no una por fila; si el catálogo falla, las columnas
   * degradan a «—» y nada más.
   */
  private resolverEtiquetas(conceptos: readonly string[]): void {
    const nuevos = conceptos.filter((concepto) => !this.etiquetas().has(concepto));
    if (nuevos.length === 0) {
      return;
    }
    this.terminology
      .readConceptLabels(nuevos)
      .pipe(catchError(() => of<ConceptLabels>(new Map())))
      .subscribe((etiquetas) =>
        this.etiquetas.update((actuales) => new Map([...actuales, ...etiquetas])),
      );
  }
}

