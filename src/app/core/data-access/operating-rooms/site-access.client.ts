import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** Una asignación de unidad o espacio del actor dentro de la sede. */
export interface SiteAccessGrant {
  readonly scope: 'UNIT' | 'SPACE';
  readonly role: string;
  readonly clinicalUnitId: string | null;
  readonly careSpaceId: string | null;
  readonly actions: readonly string[];
}

/** Una sede donde el actor tiene algún rol de infraestructura (`InfraAccessSiteDto`). */
export interface SiteAccess {
  readonly siteId: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly timeZone: string | null;
  readonly roles: readonly string[];
  readonly globalRoles: readonly string[];
  /** Acciones permitidas sobre la sede entera (`f4.or.read`, `f5e.tariff.write`…). */
  readonly actions: readonly string[];
  readonly grants: readonly SiteAccessGrant[];
}

/** `GET /practice/infrastructure-access/me` (`InfraAccessMeDto`). */
export interface InfrastructureAccessMe {
  readonly userId: string;
  readonly tenantId: string;
  readonly sites: readonly SiteAccess[];
}

/**
 * Las sedes del actor **según la API**: el reflejo por sede de §0.3 que usan
 * las pantallas de F4/F5 para elegir sede y atenuar lo que no puede hacer.
 *
 * No autoriza: cada petición vuelve a pasar por el evaluador de la API. Es la
 * misma lectura que usa internación (W-F2F3); al integrar las dos ramas queda
 * un solo cliente (desvío anotado).
 */
@Injectable({ providedIn: 'root' })
export class SiteAccessClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getAccess(): Observable<InfrastructureAccessMe> {
    return this.http.get<InfrastructureAccessMe>(apiUrl(this.baseUrl, '/practice/infrastructure-access/me'));
  }
}
