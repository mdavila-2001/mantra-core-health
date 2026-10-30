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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, type Observable } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type {
  BranchListItem,
  MembershipListItem,
  MyOrganization,
  TenantListItem,
} from '../../../../core/data-access/directory/directory.types';
import { IamClient } from '../../../../core/data-access/iam/iam.client';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type {
  ConceptLabels,
  ValueSetOption,
} from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { rolesAlcanzan } from '../../../../core/navigation/navigation.types';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type {
  ViewState,
  ViewStateNextAction,
} from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { BranchBulkImport } from '../../../../shared/components/organisms/branch-bulk-import/branch-bulk-import';
import type { BranchDraft } from '../../../../shared/utils/branch-import/branch-import';
import { createBranchesInSeries } from '../../../organization/organization-branches/create-branches-in-series';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { historialDeCursor } from '../../../../shared/components/organisms/data-table/cursor-history';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  ORGANIZATIONS_ROUTE,
  branchNewRoute,
  childOrganizationNewRoute,
  membershipNewRoute,
  organizationVerifyRoute,
} from '../organizations.routes';
import { BranchAssignmentDialog } from './branch-assignment-dialog/branch-assignment-dialog';

/** Filas por página. El backend aplica 50 por omisión y admite hasta 200. */
const TAMANO_DE_PAGINA = 25;

/**
 * Las pestañas de la ficha, en orden, por su nombre en `?tab=`.
 *
 * Con nombre y no con índice: el alta de membresía manda acá con
 * `?tab=plantilla` cuando falta asignar la sede, y un índice se rompe en
 * silencio el día que alguien reordena las pestañas.
 */
export const PESTANAS_DE_LA_FICHA = ['sucursales', 'plantilla', 'sub-organizaciones'] as const;

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
 * obligatorio **no es un filtro**: es el ámbito de la pantalla. Van en UNA
 * tarjeta con pestañas (`composition-rules.md` §5), con la ficha compacta
 * arriba, sin repetir la organización como columna.
 *
 * ## Los nueve estados de la organización
 *
 * La ficha entera cuelga de `GET /tenants/{id}` a través de
 * `app-view-state-host`: un `403` (no pertenecés) es S5, un `404` es S6 —sin
 * un solo dato del recurso—, y S8/S9 ofrecen reintentar con el código de
 * soporte. Antes la plantilla sólo distinguía `ready` y `error`, y todo lo
 * demás caía en «Cargando…» para siempre.
 *
 * ## Paginación
 *
 * `/branches` devuelve `{ items, count }` plano y no pagina. Membresías y
 * sub-organizaciones sí, por cursor: cada una lleva su propio historial
 * (`historialDeCursor`) y su pie de «Anterior / Siguiente».
 *
 * ## Quién ve qué acción
 *
 * La API es la autoridad. Las lecturas las abre a cualquier miembro; sucursales
 * y plantilla las escribe OWNER/ADMIN de la organización o la plataforma
 * (`TenantAdministrationService.assertCanAdminister`), y las sub-organizaciones
 * sólo `SECURITY_ADMIN`. La ficha ofrece cada acción a quien la API se la va a
 * aceptar —el `canAdminister` de `GET /tenants/me`—, para no poner una puerta
 * que va a estar cerrada. Ocultarla no protege nada.
 */
@Component({
  selector: 'app-organization-detail',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    BranchAssignmentDialog,
    BranchBulkImport,
    Card,
    DataTable,
    DatePipe,
    Link,
    PageHeader,
    RouterLink,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './organization-detail.html',
  styleUrl: './organization-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationDetail {
  private readonly directory = inject(DirectoryClient);
  private readonly iam = inject(IamClient);
  private readonly toasts = inject(ToastService);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  /**
   * La organización que se está mirando, leída del segmento `:tenantId`.
   *
   * Por `paramMap` y no por `input.required`: el router de esta aplicación no
   * declara `withComponentInputBinding()`.
   */
  protected readonly tenantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('tenantId') ?? '')),
    { initialValue: '' },
  );

  /** La pestaña abierta, de `?tab=`. Sin parámetro (o con uno que no existe), la primera. */
  protected readonly pestana = toSignal(
    this.route.queryParamMap.pipe(map((params) => indiceDePestana(params.get('tab')))),
    { initialValue: 0 },
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
  private readonly celdaAccionesMembresia =
    viewChild.required<TemplateRef<{ $implicit: MembershipListItem }>>('celdaAccionesMembresia');

  private readonly celdaHija =
    viewChild.required<TemplateRef<{ $implicit: TenantListItem }>>('celdaHija');
  private readonly celdaEstadoHija =
    viewChild.required<TemplateRef<{ $implicit: TenantListItem }>>('celdaEstadoHija');

  protected readonly organizacion = signal<ViewState<TenantListItem>>(loading());
  protected readonly sucursales = signal<ViewState<readonly BranchListItem[]>>(loading());
  protected readonly membresias = signal<ViewState<readonly MembershipListItem[]>>(loading());
  protected readonly hijas = signal<ViewState<readonly TenantListItem[]>>(loading());

  private readonly paginadoMembresias = historialDeCursor();
  protected readonly cursorMembresias = this.paginadoMembresias.cursor;
  private readonly paginadoHijas = historialDeCursor();
  protected readonly cursorHijas = this.paginadoHijas.cursor;

  /** Etiquetas de los conceptos ya vistos, acumuladas entre páginas. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /**
   * Nombre de cada persona de la plantilla por su `userId`. `null` es «no se
   * pudo resolver» (la ficha de cuenta exige `SECURITY_ADMIN`): se muestra como
   * tal, nunca el uuid.
   */
  private readonly nombres = signal<ReadonlyMap<string, string | null>>(new Map());

  /** La organización vista desde `GET /tenants/me`: trae `canAdminister`. */
  private readonly miOrganizacion = signal<MyOrganization | null>(null);

  /** La persona de la plantilla a la que se le está asignando sede. */
  protected readonly asignandoA = signal<MembershipListItem | null>(null);

  private readonly esPlataforma = computed(() =>
    rolesAlcanzan(['SECURITY_ADMIN'], this.session.roles()),
  );

  /**
   * Si la sesión administra esta organización: plataforma, o OWNER/ADMIN de
   * ella según la propia API. Decide qué acciones se ofrecen, no qué se puede.
   */
  protected readonly puedeAdministrar = computed(
    () => this.esPlataforma() || this.miOrganizacion()?.canAdminister === true,
  );

  /** `POST /tenants/{id}/child-tenants` sigue pidiendo `SECURITY_ADMIN`. */
  protected readonly puedeCrearHijas = this.esPlataforma;

  /** El listado de organizaciones es de plataforma: a otro no se lo ofrece. */
  protected readonly ofreceListado = this.esPlataforma;

  protected readonly fichaLista = computed(() => this.organizacion().status === 'ready');

  protected readonly rutaDeSucursal = computed(() => branchNewRoute(this.tenantId()));
  protected readonly rutaDeMembresia = computed(() => membershipNewRoute(this.tenantId()));
  protected readonly rutaDeHija = computed(() => childOrganizationNewRoute(this.tenantId()));

  /** Hay a qué sede asignar: sin sucursales, la acción de la fila no se ofrece. */
  protected readonly sucursalesCargadas = computed<readonly BranchListItem[]>(() => {
    const estado = this.sucursales();
    return estado.status === 'ready' ? estado.data : [];
  });

  private readonly nombreDeSucursal = computed<ReadonlyMap<string, string>>(
    () => new Map(this.sucursalesCargadas().map((sucursal) => [sucursal.id, sucursal.name])),
  );

  /**
   * Lo que pintan las tablas. El vacío (S3) exige una próxima acción; a quien
   * no puede ejecutarla se le dice a quién pedírsela, en vez de un enlace a
   * una pantalla que le va a responder 403. Es `computed` porque el permiso
   * (`GET /tenants/me`) puede llegar después que la lista.
   */
  protected readonly vistaDeSucursales = computed(() =>
    conAccionPosible(this.sucursales(), this.puedeAdministrar()),
  );
  protected readonly vistaDeMembresias = computed(() =>
    conAccionPosible(this.membresias(), this.puedeAdministrar()),
  );
  protected readonly vistaDeHijas = computed(() =>
    conAccionPosible(this.hijas(), this.puedeCrearHijas()),
  );

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
      ...(this.puedeAdministrar() && this.sucursalesCargadas().length > 0
        ? [
            {
              key: 'acciones',
              header: 'Acciones',
              priority: 1,
              align: 'end' as const,
              sticky: 'end' as const,
              cell: this.celdaAccionesMembresia(),
            },
          ]
        : []),
    ],
  );

  protected readonly columnasDeHija = computed<readonly ColumnDef<TenantListItem>[]>(() => [
    { key: 'legalName', header: 'Sub-organización', priority: 1, cell: this.celdaHija() },
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'statusConceptId', header: 'Estado', priority: 1, cell: this.celdaEstadoHija() },
  ]);

  protected readonly porId = (row: { readonly id: string }): string => row.id;

  /** Nombre de la fila para el lector de pantalla: la persona, nunca el uuid. */
  protected readonly nombreDeFila = (row: MembershipListItem): string => this.personaDe(row.userId);

  /**
   * A dónde lleva el botón de verificar: sólo mientras la organización está
   * sin verificar y a quien puede hacerlo. `rolesAlcanzan`, no un `includes`
   * propio: el comodín `SUPERADMIN` tiene que pasar igual que en el menú.
   */
  protected readonly rutaDeVerificacion = computed<string | null>(() => {
    const ficha = this.organizacion();
    if (ficha.status !== 'ready' || !this.esPlataforma()) {
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
    // el componente tiene que recargar todo y olvidar las páginas visitadas.
    effect(() => {
      this.tenantId();
      untracked(() => {
        this.paginadoMembresias.reiniciar();
        this.paginadoHijas.reiniciar();
        this.cargar();
      });
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  protected cambiarPestana(indice: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: PESTANAS_DE_LA_FICHA[indice] ?? PESTANAS_DE_LA_FICHA[0] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected moverMembresias(cursor: string): void {
    this.paginadoMembresias.mover(cursor);
    this.cargarMembresias(this.tenantId());
  }

  protected moverHijas(cursor: string): void {
    this.paginadoHijas.mover(cursor);
    this.cargarHijas(this.tenantId());
  }

  protected abrirAsignacion(membresia: MembershipListItem): void {
    this.asignandoA.set(membresia);
  }

  protected cerrarAsignacion(): void {
    this.asignandoA.set(null);
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
   * Quién es la persona de una membresía. La propia sesión se reconoce sin
   * preguntar; el resto sale de `GET /iam/users/:id`. Mientras no llega, o si
   * la API no lo deja leer, se dice eso —el uuid no le dice nada a nadie—.
   */
  protected personaDe(userId: string): string {
    if (userId === this.session.userId()) {
      return this.session.displayName() ?? 'Usted';
    }
    const nombre = this.nombres().get(userId);
    if (nombre === undefined) return 'Buscando el nombre…';
    return nombre ?? 'Nombre no disponible';
  }

  protected esLaSesion(userId: string): boolean {
    return userId === this.session.userId();
  }

  private cargar(): void {
    const id = this.tenantId();
    if (id === '') {
      return;
    }

    this.organizacion.set(loading());
    this.sucursales.set(loading());

    forkJoin({
      ficha: conFallo(this.directory.getTenant(id)),
      sucursales: conFallo(this.directory.listBranches(id)),
    }).subscribe(({ ficha, sucursales }) => {
      this.organizacion.set(
        esFallo(ficha) ? this.estadoDeFallo<TenantListItem>(ficha.error) : ready(ficha),
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
      this.resolverEtiquetas([
        ...(esFallo(ficha)
          ? []
          : [ficha.tenantTypeConceptId, ficha.statusConceptId, ficha.verificationStatusConceptId]),
        ...(esFallo(sucursales)
          ? []
          : sucursales.items.flatMap((s) => [s.branchTypeConceptId, s.statusConceptId])),
      ]);
    });

    this.cargarMembresias(id);
    this.cargarHijas(id);
    this.cargarMiRol(id);
  }

  private cargarMembresias(id: string): void {
    this.membresias.set(loading());
    const cursor = this.paginadoMembresias.actual();
    this.directory
      .listMemberships(id, {
        limit: TAMANO_DE_PAGINA,
        ...(cursor === undefined ? {} : { cursor }),
      })
      .subscribe({
        next: (pagina) => {
          this.paginadoMembresias.llego(pagina.nextCursor);
          this.membresias.set(
            cursor === undefined
              ? estadoDeLista(
                  pagina.items,
                  { label: 'Sumar a alguien', route: membershipNewRoute(id) },
                  'La plantilla es quién trabaja acá y con qué rol. Mientras esté vacía, sólo quien creó la organización puede entrar.',
                )
              : ready(pagina.items),
          );
          this.resolverNombres(pagina.items.map((m) => m.userId));
          this.resolverEtiquetas(
            pagina.items.flatMap((m) => [
              m.tenantRoleConceptId,
              m.statusConceptId,
              m.accessScopeConceptId,
            ]),
          );
        },
        error: (error: unknown) => {
          this.paginadoMembresias.llego(null);
          this.membresias.set(errorToViewState<readonly MembershipListItem[]>(error));
        },
      });
  }

  private cargarHijas(id: string): void {
    this.hijas.set(loading());
    const cursor = this.paginadoHijas.actual();
    this.directory
      .listChildTenants(id, {
        limit: TAMANO_DE_PAGINA,
        ...(cursor === undefined ? {} : { cursor }),
      })
      .subscribe({
        next: (pagina) => {
          this.paginadoHijas.llego(pagina.nextCursor);
          this.hijas.set(
            cursor === undefined
              ? estadoDeLista(
                  pagina.items,
                  { label: 'Nueva sub-organización', route: childOrganizationNewRoute(id) },
                  'Una sub-organización es una unidad con identidad propia dentro de esta —una red de farmacias, un instituto—. La mayoría de las organizaciones no tiene ninguna, y está bien así.',
                )
              : ready(pagina.items),
          );
          this.resolverEtiquetas(pagina.items.map((h) => h.statusConceptId));
        },
        error: (error: unknown) => {
          this.paginadoHijas.llego(null);
          this.hijas.set(errorToViewState<readonly TenantListItem[]>(error));
        },
      });
  }

  /**
   * `canAdminister` de la propia API. La plataforma no lo necesita, así que no
   * se pide. Si la lectura falla, la ficha sigue: sólo no ofrece las altas, y
   * la API sigue siendo quien decide.
   */
  private cargarMiRol(id: string): void {
    this.miOrganizacion.set(null);
    if (this.esPlataforma()) return;
    this.directory
      .listMyOrganizations()
      .pipe(catchError(() => of<readonly MyOrganization[]>([])))
      .subscribe((items) => this.miOrganizacion.set(items.find((o) => o.id === id) ?? null));
  }

  /** Nombres de la página vigente, de a uno y sólo los que faltan. */
  private resolverNombres(userIds: readonly string[]): void {
    const conocidos = this.nombres();
    const faltan = [...new Set(userIds)].filter(
      (id) => !conocidos.has(id) && id !== this.session.userId(),
    );
    if (faltan.length === 0) return;

    // Sin `SECURITY_ADMIN` la API responde 403 a cada una: se marca «no
    // disponible» de entrada en vez de gastar una petición por fila.
    if (!this.esPlataforma()) {
      this.nombres.update((previo) => new Map([...previo, ...faltan.map((id) => [id, null] as const)]));
      return;
    }

    forkJoin(
      faltan.map((id) =>
        this.iam.getUser(id).pipe(
          map((usuario) => [id, usuario.displayName] as const),
          catchError(() => of([id, null] as const)),
        ),
      ),
    ).subscribe((pares) => this.nombres.update((previo) => new Map([...previo, ...pares])));
  }

  /** Una sola lectura de terminología por tanda, sólo con lo que no se conoce. */
  private resolverEtiquetas(ids: readonly (string | undefined)[]): void {
    const conocidas = this.etiquetas();
    const faltan = [...new Set(ids)].filter(
      (id): id is string => id !== undefined && !conocidas.has(id),
    );
    if (faltan.length === 0) return;
    // Si el catálogo falla, las columnas degradan a «—» y nada más.
    this.terminology
      .readConceptLabels(faltan)
      .pipe(catchError(() => of<ConceptLabels>(new Map())))
      .subscribe((nuevas) => this.etiquetas.update((previas) => new Map([...previas, ...nuevas])));
  }

  /**
   * S6 con salida: volver al listado si la sesión lo puede ver. Sin dato del
   * recurso —el texto lo fija `ViewStateHost` y es el mismo exista o no—.
   */
  private estadoDeFallo<T>(error: unknown): ViewState<T> {
    const estado = errorToViewState<T>(error);
    if (estado.status === 'not-found' && this.ofreceListado()) {
      return { status: 'not-found', nextAction: { label: 'Volver al listado', route: ORGANIZATIONS_ROUTE } };
    }
    return estado;
  }
}

/** Una rama del `forkJoin` que se resolvió con fallo en vez de con datos. */
interface Fallo {
  readonly error: unknown;
}

function conFallo<T extends object>(fuente: Observable<T>): Observable<T | Fallo> {
  return fuente.pipe(catchError((error: unknown) => of<Fallo>({ error })));
}

function esFallo(valor: object): valor is Fallo {
  return 'error' in valor;
}

function conAccionPosible<T>(estado: ViewState<T>, puede: boolean): ViewState<T> {
  return estado.status === 'empty' && !puede
    ? { ...estado, nextAction: { label: 'Pídaselo a quien administra la organización' } }
    : estado;
}

function indiceDePestana(nombre: string | null): number {
  const indice = PESTANAS_DE_LA_FICHA.indexOf(nombre as (typeof PESTANAS_DE_LA_FICHA)[number]);
  return indice === -1 ? 0 : indice;
}

/**
 * De la lista al estado. El vacío lleva su propio texto y su propia salida:
 * «no hay sucursales» y «no hay sub-organizaciones» son situaciones distintas,
 * y la tercera —una organización sin sub-organizaciones— es lo normal.
 */
function estadoDeLista<T>(
  items: readonly T[],
  accion: ViewStateNextAction,
  mensaje: string,
): ViewState<readonly T[]> {
  return items.length === 0 ? empty(accion, mensaje) : ready(items);
}
