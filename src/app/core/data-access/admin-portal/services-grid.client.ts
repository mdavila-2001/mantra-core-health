import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { LabServicePage, LabServiceStatus } from '../lab-portal/lab-portal.types';
import type { CatalogProductPage } from '../pharmacy/pharmacy.types';
import { queryParams } from './admin-portal.wire';
import type { AdminCatalogPage, AdminServiceItem, ServiceScopes } from './catalog-editor.types';
import type { ServicesGridPage, ServicesGridTone } from './services-grid.types';

/** Rows requested per tab. The pharmacy endpoint caps `limit` at 50. */
export const SERVICES_GRID_LIMIT = 50;

const LAB_STATUS: Readonly<Record<LabServiceStatus, { label: string; tone: ServicesGridTone }>> = {
  PUBLISHED: { label: 'Publicado', tone: 'success' },
  DRAFT: { label: 'Borrador', tone: 'warning' },
  WITHDRAWN: { label: 'Retirado', tone: 'secondary' },
};

/**
 * Read-only client of the services grid. It only issues GETs against endpoints
 * that already exist and flattens each answer into the same row shape, so the
 * screen never needs to know which API a tab came from. Authorization is the
 * API's: a 403 reaches the screen as a ViewState, nothing is hidden here.
 */
@Injectable({ providedIn: 'root' })
export class ServicesGridClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /admin/catalogs/services` (+ `/scopes` to name the organization type). */
  doctor(): Observable<ServicesGridPage> {
    return forkJoin({
      page: this.http.get<AdminCatalogPage<AdminServiceItem>>(this.url('/admin/catalogs/services'), {
        params: queryParams({ limit: SERVICES_GRID_LIMIT }),
      }),
      scopes: this.http.get<ServiceScopes>(this.url('/admin/catalogs/services/scopes')),
    }).pipe(
      map(({ page, scopes }) => {
        const typeOf = new Map(scopes.types.map((t) => [t.conceptId, t.display]));
        return {
          truncated: page.nextCursor !== null,
          rows: page.items.map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            group: typeOf.get(s.practiceTypeConceptId) ?? 'Tipo no declarado',
            price: s.defaultPrice,
            statusLabel: s.isActive ? 'Activo' : 'Inactivo',
            statusTone: s.isActive ? ('success' as const) : ('secondary' as const),
          })),
        };
      }),
    );
  }

  /** `GET /diagnostics/lab/services`. */
  laboratory(): Observable<ServicesGridPage> {
    return this.http.get<LabServicePage>(this.url('/diagnostics/lab/services')).pipe(
      map((page) => ({
        truncated: false,
        rows: page.items.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          group: s.kind === 'MODALITY' ? 'Modalidad' : 'Estudio',
          price: s.price,
          statusLabel: LAB_STATUS[s.status].label,
          statusTone: LAB_STATUS[s.status].tone,
        })),
      })),
    );
  }

  /** `GET /pharmacy/catalog-products` — the universal medicine registry. It carries no price. */
  pharmacy(): Observable<ServicesGridPage> {
    return this.http
      .get<CatalogProductPage>(this.url('/pharmacy/catalog-products'), {
        params: queryParams({ limit: SERVICES_GRID_LIMIT }),
      })
      .pipe(
        map((page) => ({
          truncated: page.truncated,
          rows: page.items.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.display,
            group: [p.dosageForm, p.strengthText].filter((x): x is string => !!x).join(' · ') || '—',
            price: null,
            statusLabel: p.selectable ? 'Vigente' : 'No vigente',
            statusTone: p.selectable ? ('success' as const) : ('warning' as const),
          })),
        })),
      );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
