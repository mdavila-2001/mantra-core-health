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
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type {
  TenantListItem,
  TenantPage,
} from '../../../../core/data-access/directory/directory.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type {
  ConceptLabels,
  ValueSetOption,
} from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
} from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ORGANIZATIONS_ROUTE, ORGANIZATION_NEW_ROUTE } from '../organizations.routes';

/** Filas por página. El backend admite hasta 200 y aplica 50 por omisión. */
const TAMANO_DE_PAGINA = 25;

/**
 * Centinela con el que la tabla pide la página anterior. El contrato solo
 * entrega `nextCursor`; el camino de vuelta lo recuerda la pantalla.
 */
const VOLVER = 'anterior';

/**
 * Variante del badge por **código** de concepto, que es lo estable — la
 * etiqueta es metadato de presentación y puede cambiar sin aviso. Un código
 * que no figura acá se pinta `info`: estado desconocido no es estado roto.
 */
const VARIANTE_POR_CODIGO: Readonly<Record<string, BadgeVariant>> = {
  TENANT_ACTIVE: 'success',
  DIR_TENANT_PENDING: 'warning',
  DIR_TENANT_SUSPENDED: 'error',
  TENANT_VERIFIED: 'success',
  DIR_TENANT_UNVERIFIED: 'warning',
};

/**
 * Listado de organizaciones — vista **V04-01·L** de `SALUD/Vistas/V04
 * directory` (`GET /admin/tenants`, UC-04-01 cara de lectura).
 *
 * ## Las columnas son las del endpoint, no las de la entidad
 *
 * La ficha deriva de `directory.tenants` columnas que la fila real no trae
 * (forma jurídica, país, moneda): el listado devuelve «lo justo para pintar
 * la tabla y decidir a cuál entrar», dice su contrato. Se pinta lo que llega.
 *
 * ## Los `*ConceptId` se resuelven en bloque
 *
 * Tipo, estado y verificación son concept ids, y un uuid no le dice nada a
 * nadie. Se resuelven con **una** lectura de terminología por página —los ids
 * distintos de las 25 filas juntos—, no una por fila. Si el catálogo falla,
 * la columna degrada a «—»: el fallo de una etiqueta no puede tumbar la tabla.
 *
 * ## La búsqueda vive en la URL
 *
 * `?q=` y no un signal interno: el enlace se comparte con el filtro puesto,
 * «atrás» lo deshace, y el vacío por filtro ofrece una salida real.
 */
@Component({
  selector: 'app-organization-list',
  imports: [AppButtonLink, Badge, DataTable, DatePipe, PageHeader, RouterLink, SearchField],
  templateUrl: './organization-list.html',
  styleUrl: './organization-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationList {
  private readonly directory = inject(DirectoryClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly rutaDeAlta = ORGANIZATION_NEW_ROUTE;

  private readonly celdaOrganizacion =
    viewChild.required<TemplateRef<{ $implicit: TenantListItem }>>('celdaOrganizacion');
  private readonly celdaTipo =
    viewChild.required<TemplateRef<{ $implicit: TenantListItem }>>('celdaTipo');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: TenantListItem }>>('celdaEstado');
  private readonly celdaVerificacion =
    viewChild.required<TemplateRef<{ $implicit: TenantListItem }>>('celdaVerificacion');
  private readonly celdaAlta =
    viewChild.required<TemplateRef<{ $implicit: TenantListItem }>>('celdaAlta');

  protected readonly listado = signal<ViewState<readonly TenantListItem[]>>(loading());

  /** Etiquetas de los conceptos de la página vigente, por su identificador. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /** El filtro vigente, leído de la URL. Vacío es «sin filtro». */
  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  /** Los cursores ya visitados, en orden: el camino de vuelta. */
  private readonly historia = signal<readonly (string | undefined)[]>([undefined]);

  private readonly cursorSiguiente = signal<string | null>(null);

  protected readonly cursor = computed<CursorState>(() => ({
    prevCursor: this.historia().length > 1 ? VOLVER : null,
    nextCursor: this.cursorSiguiente(),
  }));

  /** `priority` 1 nunca se pliega; en móvil las 2 caen a la fila de detalle. */
  protected readonly columnas = computed<readonly ColumnDef<TenantListItem>[]>(() => [
    { key: 'legalName', header: 'Organización', priority: 1, cell: this.celdaOrganizacion() },
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'tenantTypeConceptId', header: 'Tipo', priority: 1, cell: this.celdaTipo() },
    { key: 'statusConceptId', header: 'Estado', priority: 2, cell: this.celdaEstado() },
    {
      key: 'verificationStatusConceptId',
      header: 'Verificación',
      priority: 2,
      cell: this.celdaVerificacion(),
    },
    { key: 'createdAt', header: 'Alta', priority: 2, cell: this.celdaAlta() },
  ]);

  protected readonly porId = (row: TenantListItem): string => row.id;

  protected readonly cargando = computed(() => this.listado().status === 'loading');

  constructor() {
    // Un cambio de filtro es una lista nueva: el cursor que había era de la
    // anterior y seguirlo devolvería una página del listado viejo.
    effect(() => {
      this.busqueda();
      untracked(() => {
        this.historia.set([undefined]);
        this.cargar();
      });
    });
  }

  /** La búsqueda se publica en la URL; el efecto de arriba hace el resto. */
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

  /** Reintento de S8/S9: repite la página en la que quedó, no la primera. */
  protected recargar(): void {
    this.cargar();
  }

  /** La etiqueta de un concepto de la página, si el catálogo la conoce. */
  protected etiquetaDe(conceptId: string): ValueSetOption | undefined {
    return this.etiquetas().get(conceptId);
  }

  protected varianteDe(conceptId: string): BadgeVariant {
    const opcion = this.etiquetaDe(conceptId);
    return (opcion && VARIANTE_POR_CODIGO[opcion.code]) ?? 'info';
  }

  private cargar(): void {
    this.listado.set(loading());

    const texto = this.busqueda();
    const cursorActual = this.historia().at(-1);

    this.directory
      .searchTenants({
        limit: TAMANO_DE_PAGINA,
        ...(texto === '' ? {} : { query: texto }),
        ...(cursorActual === undefined ? {} : { cursor: cursorActual }),
      })
      .pipe(
        switchMap((pagina) =>
          forkJoin({
            pagina: of(pagina),
            // El fallo del catálogo degrada tres columnas a «—»; no puede
            // tumbar la tabla que muestra las organizaciones reales.
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(pagina.items))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ pagina, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.cursorSiguiente.set(pagina.nextCursor);
          this.listado.set(this.estadoDe(pagina));
        },
        error: (error: unknown) => {
          this.cursorSiguiente.set(null);
          this.listado.set(errorToViewState<readonly TenantListItem[]>(error));
        },
      });
  }

  /**
   * De la página al estado. El vacío distingue «todavía no hay organizaciones»
   * de «ninguna coincide con lo buscado»: la salida correcta es distinta.
   */
  private estadoDe(pagina: TenantPage): ViewState<readonly TenantListItem[]> {
    if (pagina.items.length > 0) {
      return ready(pagina.items);
    }

    return this.busqueda() === ''
      ? empty(
          { label: 'Registrar una organización', route: ORGANIZATION_NEW_ROUTE },
          'Todavía no hay organizaciones registradas en la plataforma.',
        )
      : empty(
          { label: 'Ver todas las organizaciones', route: ORGANIZATIONS_ROUTE },
          `Ninguna organización coincide con «${this.busqueda()}».`,
        );
  }
}

/** Los concept ids distintos de una página, para resolverlos en una lectura. */
function conceptosDe(items: readonly TenantListItem[]): readonly string[] {
  return [
    ...new Set(
      items.flatMap((item) => [
        item.tenantTypeConceptId,
        item.statusConceptId,
        item.verificationStatusConceptId,
      ]),
    ),
  ];
}
