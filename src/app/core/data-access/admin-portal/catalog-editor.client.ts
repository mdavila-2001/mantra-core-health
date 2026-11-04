import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from './admin-portal.wire';
import type {
  AdminCatalogPage,
  AdminGlossaryTerm,
  AdminServiceItem,
  CreateGlossaryTermInput,
  CreateServiceInput,
  GlossaryAudience,
  GlossaryListQuery,
  GlossaryToggleInput,
  ServiceListQuery,
  ServiceScopes,
  UpdateGlossaryTermInput,
  UpdateServiceInput,
} from './catalog-editor.types';

/**
 * Catálogos globales editables (`/admin/catalogs/services` y `/glossary`).
 *
 * - La organización la pone el interceptor con `X-Tenant-Id`; un servicio de
 *   otra organización responde 404, igual que uno inexistente.
 * - Toda edición viaja con `expectedRowVersion`; un 409 significa «otra persona
 *   lo cambió» y no se pisa nada.
 * - La autoridad es la API: ocultar un botón en la pantalla no protege nada.
 */
@Injectable({ providedIn: 'root' })
export class CatalogEditorClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* -- Servicios ------------------------------------------------------- */

  /** Tipos de organización, prácticas y monedas con las que se arma el editor. */
  serviceScopes(): Observable<ServiceScopes> {
    return this.http.get<ServiceScopes>(this.url('/admin/catalogs/services/scopes'));
  }

  listServices(query: ServiceListQuery = {}): Observable<AdminCatalogPage<AdminServiceItem>> {
    return this.http.get<AdminCatalogPage<AdminServiceItem>>(this.url('/admin/catalogs/services'), {
      params: queryParams({ ...query }),
    });
  }

  getService(id: string): Observable<AdminServiceItem> {
    return this.http.get<AdminServiceItem>(this.url(`/admin/catalogs/services/${encodeURIComponent(id)}`));
  }

  createService(input: CreateServiceInput): Observable<AdminServiceItem> {
    return this.http.post<AdminServiceItem>(this.url('/admin/catalogs/services'), input);
  }

  updateService(id: string, input: UpdateServiceInput): Observable<AdminServiceItem> {
    return this.http.patch<AdminServiceItem>(this.url(`/admin/catalogs/services/${encodeURIComponent(id)}`), input);
  }

  deactivateService(id: string, expectedRowVersion: number): Observable<AdminServiceItem> {
    return this.http.post<AdminServiceItem>(this.url(`/admin/catalogs/services/${encodeURIComponent(id)}/deactivate`), {
      expectedRowVersion,
    });
  }

  reactivateService(id: string, expectedRowVersion: number): Observable<AdminServiceItem> {
    return this.http.post<AdminServiceItem>(this.url(`/admin/catalogs/services/${encodeURIComponent(id)}/reactivate`), {
      expectedRowVersion,
    });
  }

  /* -- Glosario -------------------------------------------------------- */

  listGlossary(query: GlossaryListQuery): Observable<AdminCatalogPage<AdminGlossaryTerm>> {
    return this.http.get<AdminCatalogPage<AdminGlossaryTerm>>(this.url('/admin/catalogs/glossary'), {
      params: queryParams({ ...query }),
    });
  }

  getGlossaryTerm(conceptId: string, audience: GlossaryAudience): Observable<AdminGlossaryTerm> {
    return this.http.get<AdminGlossaryTerm>(this.url(`/admin/catalogs/glossary/${encodeURIComponent(conceptId)}`), {
      params: queryParams({ audience }),
    });
  }

  createGlossaryTerm(input: CreateGlossaryTermInput): Observable<AdminGlossaryTerm> {
    return this.http.post<AdminGlossaryTerm>(this.url('/admin/catalogs/glossary'), input);
  }

  updateGlossaryTerm(conceptId: string, input: UpdateGlossaryTermInput): Observable<AdminGlossaryTerm> {
    return this.http.patch<AdminGlossaryTerm>(this.url(`/admin/catalogs/glossary/${encodeURIComponent(conceptId)}`), input);
  }

  deactivateGlossaryTerm(conceptId: string, input: GlossaryToggleInput): Observable<AdminGlossaryTerm> {
    return this.http.post<AdminGlossaryTerm>(
      this.url(`/admin/catalogs/glossary/${encodeURIComponent(conceptId)}/deactivate`),
      input,
    );
  }

  reactivateGlossaryTerm(conceptId: string, input: GlossaryToggleInput): Observable<AdminGlossaryTerm> {
    return this.http.post<AdminGlossaryTerm>(
      this.url(`/admin/catalogs/glossary/${encodeURIComponent(conceptId)}/reactivate`),
      input,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
