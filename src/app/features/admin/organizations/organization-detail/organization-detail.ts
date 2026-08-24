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
import { catchError, forkJoin, map, of } from 'rxjs';

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
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type {
  ViewState,
  ViewStateNextAction,
} from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
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

/** Membresías por página. El backend aplica 50 por omisión y admite hasta 200. */
const TAMANO_DE_PAGINA = 25;

/**
 * Variante del badge por **código** de concepto. Mismo criterio que el
 * listado: el código es lo estable, la etiqueta es presentación. Lo que no
 * figura se pinta `info` — estado desconocido no es estado roto.
 */
const VARIANTE_POR_CODIGO: Readonly<Record<string, BadgeVariant>> = {
  TENANT_ACTIVE: 'success',
  DIR_TENANT_PENDING: 'warning',
  DIR_TENANT_SUSPENDED: 'error',
  TENANT_VERIFIED: 'success',
  DIR_TENANT_UNVERIFIED: 'warning',
  DIR_BRANCH_ACTIVE: 'success',
  DIR_BRANCH_CLOSED: 'secondary',
  DIR_MEMBERSHIP_ACTIVE: 'success',
  DIR_MEMBERSHIP_ENDED: 'secondary',
  DIR_MEMBERSHIP_SUSPENDED: 'error',
};

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
 * ## Dos de los tres endpoints no paginan
 *
 * `/branches` y `/branch-assignments` devuelven `{ items, count }` plano: sin
 * cursor y sin total separado. Prometer «Siguientes» sobre eso sería mentir, y
 * por eso esas dos tablas van sin pie de paginación. Membresías sí pagina por
 * cursor, y sólo ella lo lleva.
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
  imports: [AppButtonLink, Badge, DataTable, DatePipe, PageHeader, RouterLink, Tab, Tabs],
  templateUrl: './organization-detail.html',
  styleUrl: './organization-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationDetail {
  private readonly directory = inject(DirectoryClient);
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
  protected readonly sucursales = signal<ViewState<readonly BranchListItem[]>>(loading());
  protected readonly membresias = signal<ViewState<readonly MembershipListItem[]>>(loading());
  protected readonly hijas = signal<ViewState<readonly TenantListItem[]>>(loading());

  /** Etiquetas de todos los conceptos de la ficha, resueltas de una vez. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

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

  constructor() {
    // El id viaja en la ruta: navegar de una organización a otra sin desmontar
    // el componente tiene que recargar las cuatro lecturas.
    effect(() => {
      this.tenantId();
      untracked(() => this.cargar());
    });
  }

  protected recargar(): void {
    this.cargar();
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

  private cargar(): void {
    const id = this.tenantId();
    if (id === '') {
      return;
    }

    this.organizacion.set(loading());
    this.sucursales.set(loading());
    this.membresias.set(loading());
    this.hijas.set(loading());

    // Cada rama trae su propio fallo envuelto: una lectura caída deja su
    // pestaña en error y no arrastra a las otras tres.
    forkJoin({
      ficha: this.directory.getTenant(id).pipe(catchError((error: unknown) => of({ error }))),
      sucursales: this.directory
        .listBranches(id)
        .pipe(catchError((error: unknown) => of({ error }))),
      membresias: this.directory
        .listMemberships(id, { limit: TAMANO_DE_PAGINA })
        .pipe(catchError((error: unknown) => of({ error }))),
      hijas: this.directory
        .listChildTenants(id, { limit: TAMANO_DE_PAGINA })
        .pipe(catchError((error: unknown) => of({ error }))),
    }).subscribe(({ ficha, sucursales, membresias, hijas }) => {
      this.organizacion.set(
        esFallo(ficha) ? errorToViewState<TenantListItem>(ficha.error) : ready(ficha),
      );

      this.sucursales.set(
        esFallo(sucursales)
          ? errorToViewState<readonly BranchListItem[]>(sucursales.error)
          : estadoDeLista(
              sucursales.items,
              { label: 'Nueva sucursal', route: branchNewRoute(id) },
              'Una sucursal es cada lugar físico donde esta organización atiende. Sin al menos una no hay dónde agendar ni a qué sede asignar a la plantilla.',
            ),
      );

      this.membresias.set(
        esFallo(membresias)
          ? errorToViewState<readonly MembershipListItem[]>(membresias.error)
          : estadoDeLista(
              membresias.items,
              { label: 'Sumar a alguien', route: membershipNewRoute(id) },
              'La plantilla es quién trabaja acá y con qué rol. Mientras esté vacía, sólo quien creó la organización puede entrar.',
            ),
      );

      this.hijas.set(
        esFallo(hijas)
          ? errorToViewState<readonly TenantListItem[]>(hijas.error)
          : estadoDeLista(
              hijas.items,
              { label: 'Nueva sub-organización', route: childOrganizationNewRoute(id) },
              'Una sub-organización es una unidad con identidad propia dentro de esta —una red de farmacias, un instituto—. La mayoría de las organizaciones no tiene ninguna, y está bien así.',
            ),
      );

      // Una sola lectura de terminología para toda la ficha: los concept ids
      // de las cuatro respuestas juntos, no uno por fila ni uno por pestaña.
      // Si el catálogo falla, las columnas degradan a «—» y nada más.
      const conceptos = conceptosDe({
        ...(esFallo(ficha) ? {} : { ficha }),
        ...(esFallo(sucursales) ? {} : { sucursales: sucursales.items }),
        ...(esFallo(membresias) ? {} : { membresias: membresias.items }),
        ...(esFallo(hijas) ? {} : { hijas: hijas.items }),
      });
      if (conceptos.length === 0) {
        return;
      }
      this.terminology
        .readConceptLabels(conceptos)
        .pipe(catchError(() => of<ConceptLabels>(new Map())))
        .subscribe((etiquetas) => this.etiquetas.set(etiquetas));
    });
  }
}

/** Una rama del `forkJoin` que se resolvió con fallo en vez de con datos. */
interface Fallo {
  readonly error: unknown;
}

function esFallo(valor: object): valor is Fallo {
  return 'error' in valor;
}

/**
 * De la lista al estado. El vacío lleva su propio texto y su propia salida:
 * «no hay sucursales» y «no hay sub-organizaciones» son situaciones distintas,
 * y la tercera —una organización sin sub-organizaciones— es lo normal, no una
 * carencia. Decirlo evita que alguien crea que le falta cargar algo.
 */
function estadoDeLista<T>(
  items: readonly T[],
  accion: ViewStateNextAction,
  mensaje: string,
): ViewState<readonly T[]> {
  return items.length === 0 ? empty(accion, mensaje) : ready(items);
}

/**
 * Los concept ids únicos de toda la ficha, para resolverlos en una sola
 * llamada. `Set` porque el mismo estado se repite en casi todas las filas.
 */
function conceptosDe(fuentes: {
  readonly ficha?: TenantListItem;
  readonly sucursales?: readonly BranchListItem[];
  readonly membresias?: readonly MembershipListItem[];
  readonly hijas?: readonly TenantListItem[];
}): readonly string[] {
  const ids = new Set<string>();
  const agregar = (id: string | undefined): void => {
    if (id !== undefined) {
      ids.add(id);
    }
  };

  if (fuentes.ficha !== undefined) {
    agregar(fuentes.ficha.tenantTypeConceptId);
    agregar(fuentes.ficha.statusConceptId);
    agregar(fuentes.ficha.verificationStatusConceptId);
  }
  for (const sucursal of fuentes.sucursales ?? []) {
    agregar(sucursal.branchTypeConceptId);
    agregar(sucursal.statusConceptId);
  }
  for (const membresia of fuentes.membresias ?? []) {
    agregar(membresia.tenantRoleConceptId);
    agregar(membresia.statusConceptId);
    agregar(membresia.accessScopeConceptId);
  }
  for (const hija of fuentes.hijas ?? []) {
    agregar(hija.statusConceptId);
  }

  return [...ids];
}
