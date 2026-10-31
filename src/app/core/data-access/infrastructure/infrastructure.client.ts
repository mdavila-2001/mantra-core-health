import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { normalizarBloqueos } from './infrastructure.rules';
import type {
  BulkCreateCareSpacesRequest,
  BulkCreateCareSpacesResult,
  CareSpaceDetail,
  CareSpaceHistoryEntry,
  ClinicalUnitNode,
  CreateCareSpaceRequest,
  CreateSiteLicenseRequest,
  DeclareCapacityRequest,
  DeclaredCapacity,
  ImportResult,
  ImportRow,
  InfrastructureCatalog,
  LifecycleRequest,
  RetireCheck,
  SiteCapacity,
  SiteLicense,
  SiteStructure,
  SiteSummary,
  SpaceUnitAssignment,
  UnitAssignmentRequest,
  UpdateCareSpaceRequest,
  UpdateRegulatoryRequest,
  UpdateSiteLicenseRequest,
} from './infrastructure.types';

/**
 * Cliente de la infraestructura hospitalaria — franja F1, módulo `practice`.
 *
 * ## Por qué una carpeta propia y no más métodos en `medical-organization`
 *
 * La consola lee **una** respuesta grande (`/practices/:id/organization`) para
 * siete listas de sólo lectura. Esto es otra cosa: el árbol físico y el
 * organizativo de **un establecimiento**, con escritura, concurrencia y reglas.
 * Mezclarlos obligaría a la consola a arrastrar todo el contrato de F1.
 *
 * ## Concurrencia
 *
 * `PATCH`, `move` y `lifecycle` mandan `If-Match: <rowVersion>` (§3). Si otra
 * persona cambió el espacio en el medio, la API responde 412 y la pantalla lo
 * muestra como S4 («alguien lo cambió, recargá»), nunca lo pisa.
 *
 * ## La autoridad es la API
 *
 * Un espacio de otro tenant responde **404**, igual que uno inexistente: este
 * cliente no distingue los dos casos porque la API tampoco.
 */
@Injectable({ providedIn: 'root' })
export class InfrastructureClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /practice/infrastructure-catalog` — formas, funciones, reglas y conceptos. */
  getCatalog(): Observable<InfrastructureCatalog> {
    return this.http.get<InfrastructureCatalog>(this.url('/practice/infrastructure-catalog'));
  }

  /** `GET /sites/:siteId/structure` — los dos árboles planos y sus vínculos. */
  getStructure(siteId: string): Observable<SiteStructure> {
    return this.http.get<SiteStructure>(this.url(`/sites/${enc(siteId)}/structure`));
  }

  /** `GET /care-spaces/:id`. */
  getCareSpace(id: string): Observable<CareSpaceDetail> {
    return this.http.get<CareSpaceDetail>(this.url(`/care-spaces/${enc(id)}`));
  }

  /**
   * `GET /care-spaces/:id/history`.
   *
   * Desvío anotado: el contrato no declara esta lectura (ver
   * `CareSpaceHistoryEntry`).
   */
  getCareSpaceHistory(id: string): Observable<readonly CareSpaceHistoryEntry[]> {
    return this.http.get<readonly CareSpaceHistoryEntry[]>(this.url(`/care-spaces/${enc(id)}/history`));
  }

  /** `POST /sites/:siteId/care-spaces` → 201 con el detalle. */
  createCareSpace(siteId: string, body: CreateCareSpaceRequest): Observable<CareSpaceDetail> {
    return this.http.post<CareSpaceDetail>(this.url(`/sites/${enc(siteId)}/care-spaces`), body);
  }

  /** `POST /sites/:siteId/care-spaces/bulk` — todo o nada. */
  bulkCreateCareSpaces(
    siteId: string,
    body: BulkCreateCareSpacesRequest,
  ): Observable<BulkCreateCareSpacesResult> {
    return this.http.post<BulkCreateCareSpacesResult>(
      this.url(`/sites/${enc(siteId)}/care-spaces/bulk`),
      body,
    );
  }

  /**
   * `POST /sites/:siteId/care-spaces/import?dryRun=…`.
   *
   * @param dryRun - `true` valida sin escribir; `false` escribe todo o nada.
   */
  importCareSpaces(siteId: string, rows: readonly ImportRow[], dryRun: boolean): Observable<ImportResult> {
    return this.http.post<ImportResult>(
      this.url(`/sites/${enc(siteId)}/care-spaces/import`),
      { rows },
      { params: new HttpParams().set('dryRun', String(dryRun)) },
    );
  }

  /** `PATCH /care-spaces/:id` con `If-Match`. */
  updateCareSpace(id: string, rowVersion: number, body: UpdateCareSpaceRequest): Observable<CareSpaceDetail> {
    return this.http.patch<CareSpaceDetail>(this.url(`/care-spaces/${enc(id)}`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `POST /care-spaces/:id/move` con `If-Match`. `null` lo deja en la raíz. */
  moveCareSpace(id: string, rowVersion: number, parentSpaceId: string | null): Observable<CareSpaceDetail> {
    return this.http.post<CareSpaceDetail>(
      this.url(`/care-spaces/${enc(id)}/move`),
      { parentSpaceId },
      { headers: ifMatch(rowVersion) },
    );
  }

  /** `POST /care-spaces/:id/lifecycle` con `If-Match`. */
  changeLifecycle(id: string, rowVersion: number, body: LifecycleRequest): Observable<CareSpaceDetail> {
    return this.http.post<CareSpaceDetail>(this.url(`/care-spaces/${enc(id)}/lifecycle`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `GET /care-spaces/:id/retire-check` — los bloqueos antes de confirmar. */
  retireCheck(id: string): Observable<RetireCheck> {
    return this.http
      .get<RetireCheck>(this.url(`/care-spaces/${enc(id)}/retire-check`))
      .pipe(map((r) => ({ blockers: normalizarBloqueos(r?.blockers) })));
  }

  /** `POST /care-spaces/:id/unit-assignments`. */
  assignUnit(id: string, body: UnitAssignmentRequest): Observable<SpaceUnitAssignment> {
    return this.http.post<SpaceUnitAssignment>(this.url(`/care-spaces/${enc(id)}/unit-assignments`), body);
  }

  /** `DELETE /care-spaces/:id/unit-assignments/:assignmentId`. */
  unassignUnit(id: string, assignmentId: string): Observable<void> {
    return this.http.delete<void>(
      this.url(`/care-spaces/${enc(id)}/unit-assignments/${enc(assignmentId)}`),
    );
  }

  /** `GET /sites/:siteId/clinical-units`. */
  listClinicalUnits(siteId: string): Observable<readonly ClinicalUnitNode[]> {
    return this.http.get<readonly ClinicalUnitNode[]>(this.url(`/sites/${enc(siteId)}/clinical-units`));
  }

  /** `GET /clinical-units/:id`. */
  getClinicalUnit(id: string): Observable<ClinicalUnitNode> {
    return this.http.get<ClinicalUnitNode>(this.url(`/clinical-units/${enc(id)}`));
  }

  /** `PATCH /clinical-units/:id` con `If-Match`. */
  updateClinicalUnit(
    id: string,
    rowVersion: number,
    body: Partial<Pick<ClinicalUnitNode, 'name' | 'description' | 'responsibleUserId'>>,
  ): Observable<ClinicalUnitNode> {
    return this.http.patch<ClinicalUnitNode>(this.url(`/clinical-units/${enc(id)}`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `POST /clinical-units/:id/lifecycle` con `If-Match`. */
  changeClinicalUnitLifecycle(id: string, rowVersion: number, body: LifecycleRequest): Observable<ClinicalUnitNode> {
    return this.http.post<ClinicalUnitNode>(this.url(`/clinical-units/${enc(id)}/lifecycle`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `PATCH /sites/:siteId/regulatory` — 409 `TYPOLOGY_CONFLICT` si la tipología no cuadra. */
  updateRegulatory(siteId: string, body: UpdateRegulatoryRequest): Observable<SiteSummary> {
    return this.http.patch<SiteSummary>(this.url(`/sites/${enc(siteId)}/regulatory`), body);
  }

  /** `GET /sites/:siteId/licenses`. */
  listLicenses(siteId: string): Observable<readonly SiteLicense[]> {
    return this.http.get<readonly SiteLicense[]>(this.url(`/sites/${enc(siteId)}/licenses`));
  }

  /** `POST /sites/:siteId/licenses`. */
  createLicense(siteId: string, body: CreateSiteLicenseRequest): Observable<SiteLicense> {
    return this.http.post<SiteLicense>(this.url(`/sites/${enc(siteId)}/licenses`), body);
  }

  /** `PATCH /site-licenses/:id`. */
  updateLicense(id: string, body: UpdateSiteLicenseRequest): Observable<SiteLicense> {
    return this.http.patch<SiteLicense>(this.url(`/site-licenses/${enc(id)}`), body);
  }

  /** `GET /sites/:siteId/capacity` — declarada vs. derivada, con brechas. */
  getCapacity(siteId: string): Observable<SiteCapacity> {
    return this.http.get<SiteCapacity>(this.url(`/sites/${enc(siteId)}/capacity`));
  }

  /** `POST /sites/:siteId/declared-capacities`. */
  declareCapacity(siteId: string, body: DeclareCapacityRequest): Observable<DeclaredCapacity> {
    return this.http.post<DeclaredCapacity>(this.url(`/sites/${enc(siteId)}/declared-capacities`), body);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function enc(valor: string): string {
  return encodeURIComponent(valor);
}

function ifMatch(rowVersion: number): HttpHeaders {
  return new HttpHeaders({ 'If-Match': String(rowVersion) });
}
