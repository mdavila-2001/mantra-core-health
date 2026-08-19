import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { TENANT_HEADER } from '../../http/auth.interceptor';
import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, sinNulos, type ConNulos } from '../wire';
import type {
  MyOrganization,
  OrganizationEdit,
  BranchAssignmentList,
  BranchAssignmentListItem,
  BranchList,
  BranchListItem,
  MembershipListItem,
  MembershipPage,
  MembershipQuery,
  NewTenant,
  TenantCreated,
  TenantListItem,
  TenantPage,
  TenantSearchQuery,
} from './directory.types';

/**
 * Cliente de `directory`: organizaciones de la plataforma y lo que hay dentro
 * de cada una.
 *
 * Dos caras con reglas distintas de acceso, y conviene no mezclarlas:
 *
 * - **Plataforma** (`/admin/tenants`) — listado global y aprovisionamiento.
 *   Pide rol global; el alta es sólo de `SUPERADMIN`.
 * - **Organización** (`/tenants/{id}/…`) — sucursales, membresías, asignaciones
 *   y sub-organizaciones. **No piden rol global**: basta pertenecer a la
 *   organización. Quien no pertenece recibe `403`, y un tenant inexistente
 *   responde `404` —no `403`— para que el error no sirva de sonda.
 */
@Injectable({
  providedIn: 'root',
})
export class DirectoryClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /admin/tenants` — una página del listado (UC-04-01, cara de lectura).
   *
   * Paginación **por cursor sobre el código**: la respuesta no trae total.
   * Busca con `?q=` sobre código, razón social y nombre comercial.
   */
  searchTenants(query: TenantSearchQuery = {}): Observable<TenantPage> {
    // Parámetro a parámetro: el backend valida con `forbidNonWhitelisted` y un
    // opcional en `undefined` viaja como clave declarada, que vuelve 400.
    let params = new HttpParams();
    if (query.query !== undefined && query.query !== '') {
      params = params.set('q', query.query);
    }
    if (query.statusConceptId !== undefined) {
      params = params.set('status', query.statusConceptId);
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<RespuestaPagina>(this.url('/admin/tenants'), { params })
      .pipe(
        map((body) => ({
          ...body,
          items: body.items.map(toTenantListItem),
        })),
      );
  }

  /**
   * `POST /admin/tenants` — aprovisiona un tenant raíz con su membership owner
   * (UC-04-01). Sólo `SUPERADMIN`.
   *
   * La organización nace `pending` y sin verificar: activarla es otra
   * operación (`/verification`), de otro rol, y no la hace esta pantalla.
   */
  createTenant(tenant: NewTenant): Observable<TenantCreated> {
    return this.http
      .post<WireTenantCreated>(this.url('/admin/tenants'), stripUndefined(tenant))
      .pipe(map(toTenantCreated));
  }

  /**
   * `GET /tenants/{id}/branches` — sucursales de la organización (UC-04-02,
   * cara de lectura).
   *
   * **No pagina**: devuelve todas en una respuesta con su `count`. La pantalla
   * no puede prometer «Siguientes» sobre esto.
   */
  listBranches(tenantId: string): Observable<BranchList> {
    return this.http
      .get<RespuestaSucursales>(this.url(`/tenants/${tenantId}/branches`), {
        headers: deLaOrganizacion(tenantId),
      })
      .pipe(
        map((body) => ({
          count: body.count,
          items: body.items.map(toBranchListItem),
        })),
      );
  }

  /**
   * `GET /tenants/{id}/memberships` — la plantilla de la organización
   * (UC-04-04, cara de lectura). Por cursor.
   */
  listMemberships(tenantId: string, query: MembershipQuery = {}): Observable<MembershipPage> {
    // Mismo cuidado que en `searchTenants`: un opcional en `undefined` viaja
    // como clave declarada y `forbidNonWhitelisted` lo devuelve 400.
    let params = new HttpParams();
    if (query.statusConceptId !== undefined) {
      params = params.set('status', query.statusConceptId);
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<RespuestaMembresias>(this.url(`/tenants/${tenantId}/memberships`), {
        params,
        headers: deLaOrganizacion(tenantId),
      })
      .pipe(
        map((body) => ({
          ...body,
          items: body.items.map(toMembershipListItem),
        })),
      );
  }

  /**
   * `GET /tenants/{id}/memberships/{mid}/branch-assignments` — a qué sucursales
   * llega una membresía (UC-04-03, cara de lectura). Tampoco pagina.
   */
  listBranchAssignments(
    tenantId: string,
    membershipId: string,
  ): Observable<BranchAssignmentList> {
    return this.http
      .get<RespuestaAsignaciones>(
        this.url(`/tenants/${tenantId}/memberships/${membershipId}/branch-assignments`),
        { headers: deLaOrganizacion(tenantId) },
      )
      .pipe(
        map((body) => ({
          count: body.count,
          items: body.items.map(toBranchAssignmentListItem),
        })),
      );
  }

  /**
   * `GET /tenants/{id}/child-tenants` — sub-organizaciones (UC-04-03, cara de
   * lectura).
   *
   * Devuelve la misma forma que el listado de plataforma, así que la tabla de
   * organizaciones se reusa tal cual.
   */
  listChildTenants(
    tenantId: string,
    query: Pick<TenantSearchQuery, 'cursor' | 'limit'> = {},
  ): Observable<TenantPage> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<RespuestaPagina>(this.url(`/tenants/${tenantId}/child-tenants`), {
        params,
        headers: deLaOrganizacion(tenantId),
      })
      .pipe(
        map((body) => ({
          ...body,
          items: body.items.map(toTenantListItem),
        })),
      );
  }

  /**
   * `GET /tenants/me` — las organizaciones del actor (TP-1).
   *
   * Es la puerta de entrada del panel de la organización: sin esto la pantalla
   * necesitaba un identificador que sólo podía sacar de la propia ficha.
   *
   * **Sin cabecera de organización a propósito**: acá todavía no se sabe de
   * cuál se habla —eso es justo lo que se está preguntando—, y el interceptor
   * pone la de la sesión si la hay. Una lista vacía es una respuesta normal:
   * quien no pertenece a ninguna organización no tiene panel, no tiene un error.
   */
  listMyOrganizations(): Observable<readonly MyOrganization[]> {
    return this.http
      .get<{ readonly items: readonly ConNulos<WireMyOrganization>[] }>(
        this.url('/tenants/me'),
      )
      .pipe(map((body) => body.items.map(toMyOrganization)));
  }

  /**
   * `PATCH /tenants/{id}` — la organización corrige sus propios datos (TP-1).
   *
   * Sólo owner o admin de esa organización; al resto la API responde 403. El
   * logo no va acá: la imagen de una organización vive en su perfil público,
   * que es la que se ve en el directorio.
   */
  updateOrganization(
    tenantId: string,
    cambios: OrganizationEdit,
  ): Observable<TenantListItem> {
    return this.http
      .patch<ConNulos<WireTenantListItem>>(
        this.url(`/tenants/${tenantId}`),
        cambios,
        { headers: deLaOrganizacion(tenantId) },
      )
      .pipe(map(toTenantListItem));
  }

  /** `GET /tenants/{id}` — la ficha completa de una organización. */
  getTenant(tenantId: string): Observable<TenantListItem> {
    return this.http
      .get<ConNulos<WireTenantListItem>>(this.url(`/tenants/${tenantId}`), {
        headers: deLaOrganizacion(tenantId),
      })
      .pipe(map(toTenantListItem));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * Declara de qué organización habla la petición.
 *
 * Las rutas `/tenants/{id}/…` las usa la plataforma para mirar una organización
 * **distinta** de la activa, y la API responde 403 si el tenant de la ruta no
 * coincide con el de la cabecera. Sin esto, la ficha de cualquier organización
 * que no sea la propia queda inservible. El interceptor respeta la cabecera ya
 * puesta y no la pisa con la de la sesión.
 */
function deLaOrganizacion(tenantId: string): HttpHeaders {
  return new HttpHeaders({ [TENANT_HEADER]: tenantId });
}

/* ---- formas de transporte -------------------------------------------------
   Las fechas llegan como texto ISO y los opcionales vacíos como `null`; se
   normaliza acá, en la frontera, como manda `wire.ts`. */

type WireTenantListItem = Omit<TenantListItem, 'createdAt'> & { readonly createdAt: string };

type WireMyOrganization = Omit<MyOrganization, 'createdAt'> & {
  readonly createdAt: string;
};

type RespuestaPagina = Omit<TenantPage, 'items'> & {
  readonly items: readonly ConNulos<WireTenantListItem>[];
};

/**
 * La respuesta del alta llama `status` y `verificationStatus` a lo que son
 * concept ids; acá se renombran para que ninguna pantalla los confunda con
 * una etiqueta.
 */
interface WireTenantCreated {
  readonly id: string;
  readonly code: string;
  readonly legalName: string;
  readonly status: string;
  readonly verificationStatus: string;
  readonly parentTenantId?: string | null;
  readonly createdAt: string;
}

type WireBranchListItem = Omit<BranchListItem, 'createdAt'> & { readonly createdAt: string };

interface RespuestaSucursales {
  readonly items: readonly ConNulos<WireBranchListItem>[];
  readonly count: number;
}

/**
 * Vigencia opcional a propósito: el contrato la declara `Date | null` y una
 * membresía sin fin es lo normal, no una anomalía. Se declara opcional acá
 * para que `sinNulos` la borre y `maybeDate` la reponga sólo si vino.
 */
type WireMembershipListItem = Omit<
  MembershipListItem,
  'startDate' | 'endDate' | 'createdAt'
> & {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly createdAt: string;
};

type RespuestaMembresias = Omit<MembershipPage, 'items'> & {
  readonly items: readonly ConNulos<WireMembershipListItem>[];
};

type WireBranchAssignmentListItem = Omit<BranchAssignmentListItem, 'createdAt'> & {
  readonly createdAt: string;
};

interface RespuestaAsignaciones {
  readonly items: readonly ConNulos<WireBranchAssignmentListItem>[];
  readonly count: number;
}

/** Una fila del listado con su fecha ya convertida. */
function toTenantListItem(item: ConNulos<WireTenantListItem>): TenantListItem {
  const limpio = sinNulos<WireTenantListItem>(item);
  return { ...limpio, createdAt: new Date(limpio.createdAt) };
}

function toBranchListItem(item: ConNulos<WireBranchListItem>): BranchListItem {
  const limpio = sinNulos<WireBranchListItem>(item);
  return { ...limpio, createdAt: new Date(limpio.createdAt) };
}

/**
 * `startDate` y `endDate` llegan como `null` explícito cuando la membresía no
 * tiene vigencia acotada. Se reponen sólo si vinieron con fecha, para que la
 * pantalla pueda distinguir «sin fin» de «no vino el dato».
 */
function toMembershipListItem(item: ConNulos<WireMembershipListItem>): MembershipListItem {
  // Las tres fechas se sacan del resto: si se dejaran en el spread volverían a
  // entrar como texto y pisarían las ya convertidas.
  const { startDate, endDate, createdAt, ...resto } = sinNulos<WireMembershipListItem>(item);
  const desde = maybeDate(startDate);
  const hasta = maybeDate(endDate);
  return {
    ...resto,
    ...(desde === undefined ? {} : { startDate: desde }),
    ...(hasta === undefined ? {} : { endDate: hasta }),
    createdAt: new Date(createdAt),
  };
}

function toBranchAssignmentListItem(
  item: ConNulos<WireBranchAssignmentListItem>,
): BranchAssignmentListItem {
  const limpio = sinNulos<WireBranchAssignmentListItem>(item);
  return { ...limpio, createdAt: new Date(limpio.createdAt) };
}

function toTenantCreated(body: WireTenantCreated): TenantCreated {
  return {
    id: body.id,
    code: body.code,
    legalName: body.legalName,
    statusConceptId: body.status,
    verificationStatusConceptId: body.verificationStatus,
    ...(body.parentTenantId == null ? {} : { parentTenantId: body.parentTenantId }),
    createdAt: new Date(body.createdAt),
  };
}

/**
 * Quita las claves sin valor antes de enviar: el backend valida con
 * `forbidNonWhitelisted` y un opcional presente en `undefined` viaja como
 * clave declarada.
 */
function stripUndefined<T extends object>(source: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  );
}

/**
 * Normaliza una organización del actor.
 *
 * Reusa la conversión de la ficha y le suma lo propio de TP-1 —el rol y el
 * permiso—: son los mismos campos más dos, y duplicar la conversión entera
 * garantizaría que un día se corrija uno solo de los dos lugares.
 */
function toMyOrganization(
  body: ConNulos<WireMyOrganization>,
): MyOrganization {
  const ficha = toTenantListItem(body);
  const limpio = sinNulos(body);
  return {
    ...ficha,
    myRoleConceptId: limpio.myRoleConceptId,
    canAdminister: limpio.canAdminister,
    isVerified: limpio.isVerified,
    timeZone: limpio.timeZone,
  };
}
