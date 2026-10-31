import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { EquipmentPatchResult, EquipmentResourceResult, LocatedEquipment, MwlStation, UpdateEquipmentLocation } from './equipment-location.types';

/**
 * Cliente de equipos en sala — franja F5a.
 *
 * La ubicación la valida la API: espacio del mismo tenant (404), de la misma
 * sede que la sucursal del equipo (422 `EQUIPMENT_SPACE_SITE_MISMATCH`), con
 * función que aloja equipos (422 `SPACE_CANNOT_HOST_EQUIPMENT`) y AE Title
 * único por sede (409 `AE_TITLE_TAKEN`).
 */
@Injectable({ providedIn: 'root' })
export class EquipmentLocationClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /sites/:siteId/diagnostic-equipment` — desvío anotado: la lista por sede. */
  listBySite(siteId: string): Observable<readonly LocatedEquipment[]> {
    return this.http.get<readonly LocatedEquipment[]>(this.url(`/sites/${encodeURIComponent(siteId)}/diagnostic-equipment`));
  }

  /** `GET /care-spaces/:id/equipment` — desvío anotado: la pestaña «Equipos» de la ficha. */
  listBySpace(careSpaceId: string): Observable<readonly LocatedEquipment[]> {
    return this.http.get<readonly LocatedEquipment[]>(this.url(`/care-spaces/${encodeURIComponent(careSpaceId)}/equipment`));
  }

  /** `PATCH /diagnostic-equipment/:id` — sala, AE Title y nombre de estación. */
  update(id: string, body: UpdateEquipmentLocation): Observable<EquipmentPatchResult> {
    return this.http.patch<EquipmentPatchResult>(this.url(`/diagnostic-equipment/${encodeURIComponent(id)}`), body);
  }

  /** `GET /diagnostic-equipment/:id` — el equipo con su sala (forma `LocatedEquipment`). */
  get(id: string): Observable<LocatedEquipment> {
    return this.http.get<LocatedEquipment>(this.url(`/diagnostic-equipment/${encodeURIComponent(id)}`));
  }

  /** `POST /diagnostic-equipment/:id/resource` — crea el recurso agendable; 409 si ya lo tiene. */
  createResource(id: string): Observable<EquipmentResourceResult> {
    return this.http.post<EquipmentResourceResult>(this.url(`/diagnostic-equipment/${encodeURIComponent(id)}/resource`), {});
  }

  /** `GET /diagnostic-equipment/:id/mwl-station` — lo que lee la Worklist DICOM. */
  getMwlStation(id: string): Observable<MwlStation> {
    return this.http.get<MwlStation>(this.url(`/diagnostic-equipment/${encodeURIComponent(id)}/mwl-station`));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
