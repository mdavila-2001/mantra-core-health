import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { sinNulos, type ConNulos } from '../wire';
import type {
  NewTenant,
  TenantCreated,
  TenantListItem,
  TenantPage,
  TenantSearchQuery,
} from './directory.types';

/**
 * Cliente de `directory`: organizaciones de la plataforma.
 *
 * Sólo la cara de plataforma (`/admin/tenants`): listado y aprovisionamiento.
 * Las operaciones dentro de una organización —sucursales, membresías— tienen
 * sus propios endpoints bajo `/tenants/{id}` y entrarán con sus vistas.
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

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* ---- formas de transporte -------------------------------------------------
   Las fechas llegan como texto ISO y los opcionales vacíos como `null`; se
   normaliza acá, en la frontera, como manda `wire.ts`. */

type WireTenantListItem = Omit<TenantListItem, 'createdAt'> & { readonly createdAt: string };

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

/** Una fila del listado con su fecha ya convertida. */
function toTenantListItem(item: ConNulos<WireTenantListItem>): TenantListItem {
  const limpio = sinNulos<WireTenantListItem>(item);
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
