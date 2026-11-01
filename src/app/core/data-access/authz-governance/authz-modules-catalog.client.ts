import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { queryParams } from '../admin-portal/admin-portal.wire';
import { API_BASE_URL, apiUrl } from '../api';
import type { ModulesCatalog, ModulesCatalogQuery } from './authz-modules-catalog.types';

type CatalogBody = Omit<ModulesCatalog, 'generatedAt'> & { readonly generatedAt: string };

/**
 * Cliente del catálogo RBAC por módulo (`GET /authz/catalog/modules`, sólo lectura).
 *
 * Editar los permisos de un rol sigue siendo `AuthzGovernanceClient.setRolePermissions`
 * (`PUT /authz/roles/:id/permissions`); aquí sólo se lee.
 */
@Injectable({ providedIn: 'root' })
export class AuthzModulesCatalogClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Por módulo: permisos por recurso y acción, roles que los tienen y huecos detectados. */
  modules(query: ModulesCatalogQuery = {}): Observable<ModulesCatalog> {
    return this.http
      .get<CatalogBody>(apiUrl(this.baseUrl, '/authz/catalog/modules'), {
        params: queryParams({ ...query }),
      })
      .pipe(map((body) => ({ ...body, generatedAt: new Date(body.generatedAt) })));
  }
}
