import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AddUnitAssignmentRequest,
  BulkCreateRequest,
  BulkCreateResult,
  CareSpaceDetail,
  CreateCareSpaceRequest,
  DeclaredCapacityInput,
  ImportResult,
  ImportRow,
  InfrastructureCatalog,
  LicenseInput,
  LifecycleRequest,
  MoveCareSpaceRequest,
  RegulatoryUpdateRequest,
  RetireCheck,
  SiteCapacity,
  SiteLicense,
  SiteStructure,
  SiteSummary,
  SpaceHistory,
  SpaceUnitAssignment,
  UpdateCareSpaceRequest,
} from './infrastructure.types';

/**
 * Cliente de la **infraestructura hospitalaria** — franja F1, módulo 14
 * (`practice`). Un método por fila de la tabla del §3 de `CONTRATO-F0-F1.md`.
 *
 * ## Por qué una carpeta propia
 *
 * `medical-organization` responde «cómo está armada la organización» con una
 * sola lectura de solo lectura (`GET /practices/:id/organization`). Esto es la
 * escritura de la estructura: otro ámbito (el establecimiento, `siteId`), otros
 * verbos y otro ritmo de cambio. Mezclarlos obligaría a la consola de siempre a
 * arrastrar los tipos del árbol de N niveles.
 *
 * ## `If-Match`
 *
 * Toda mutación de un recurso existente lleva `If-Match: <rowVersion>` (INV-15):
 * `PATCH`, `move`, `lifecycle` y las dos de regulatorio/habilitación. Con la
 * versión vieja la API responde 412 y la pantalla pide recargar. Una creación
 * no lo lleva: no hay nada contra qué comparar.
 *
 * ## Lo que este cliente NO decide
 *
 * Qué formas caben bajo qué padre, qué funciones admite una tipología, qué
 * bloquea una clausura: todo eso lo valida la API en cada llamada. La pantalla
 * lo usa sólo para ofrecer menos opciones inválidas.
 */
@Injectable({ providedIn: 'root' })
export class InfrastructureClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /practice/infrastructure-catalog` — formas, funciones, reglas y conceptos. */
  getCatalog(): Observable<InfrastructureCatalog> {
    return this.http.get<InfrastructureCatalog>(this.url('/practice/infrastructure-catalog'));
  }

  /** `GET /sites/:siteId/structure` — árbol plano con `parentId`; el cliente arma el árbol. */
  getStructure(siteId: string): Observable<SiteStructure> {
    return this.http.get<SiteStructure>(this.url(`/sites/${enc(siteId)}/structure`));
  }

  /** `GET /care-spaces/:id` — la ficha de un espacio. */
  getCareSpace(id: string): Observable<CareSpaceDetail> {
    return this.http.get<CareSpaceDetail>(this.url(`/care-spaces/${enc(id)}`));
  }

  /** `GET /care-spaces/:id/history` — PROPUESTA, no contratada (ver `SpaceHistory`). */
  getHistory(id: string): Observable<SpaceHistory> {
    return this.http.get<SpaceHistory>(this.url(`/care-spaces/${enc(id)}/history`));
  }

  /** `POST /sites/:siteId/care-spaces` — 201 con la ficha. 409 `SPACE_CODE_TAKEN` si el código se usó. */
  createCareSpace(siteId: string, body: CreateCareSpaceRequest): Observable<CareSpaceDetail> {
    return this.http.post<CareSpaceDetail>(this.url(`/sites/${enc(siteId)}/care-spaces`), body);
  }

  /** `POST /sites/:siteId/care-spaces/bulk` — todo o nada, máx. 200. */
  createBulk(siteId: string, body: BulkCreateRequest): Observable<BulkCreateResult> {
    return this.http.post<BulkCreateResult>(this.url(`/sites/${enc(siteId)}/care-spaces/bulk`), body);
  }

  /**
   * `POST /sites/:siteId/care-spaces/import?dryRun=…` — el CSV ya parseado.
   *
   * Con `dryRun: true` la API valida todo y no escribe nada; con `false`
   * revalida y crea todo o nada. Se manda **el mismo arreglo** las dos veces.
   */
  importSpaces(siteId: string, rows: readonly ImportRow[], dryRun: boolean): Observable<ImportResult> {
    return this.http.post<ImportResult>(
      this.url(`/sites/${enc(siteId)}/care-spaces/import`),
      { rows },
      { params: new HttpParams().set('dryRun', dryRun ? 'true' : 'false') },
    );
  }

  /** `PATCH /care-spaces/:id` con `If-Match`. 422 `SPACE_IMMUTABLE_FIELD` si toca código/forma de un activo. */
  updateCareSpace(id: string, rowVersion: number, body: UpdateCareSpaceRequest): Observable<CareSpaceDetail> {
    return this.http.patch<CareSpaceDetail>(this.url(`/care-spaces/${enc(id)}`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `POST /care-spaces/:id/move` con `If-Match`. 422 `SPACE_CYCLE` si cuelga de un descendiente. */
  moveCareSpace(id: string, rowVersion: number, body: MoveCareSpaceRequest): Observable<CareSpaceDetail> {
    return this.http.post<CareSpaceDetail>(this.url(`/care-spaces/${enc(id)}/move`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /**
   * `POST /care-spaces/:id/lifecycle` con `If-Match`.
   *
   * `suspend` y `retire` exigen `reason`. `retire` puede responder 409
   * `SPACE_RETIRE_BLOCKED` con la lista de bloqueos.
   */
  changeLifecycle(id: string, rowVersion: number, body: LifecycleRequest): Observable<CareSpaceDetail> {
    return this.http.post<CareSpaceDetail>(this.url(`/care-spaces/${enc(id)}/lifecycle`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `GET /care-spaces/:id/retire-check` — los bloqueos, antes de confirmar. */
  retireCheck(id: string): Observable<RetireCheck> {
    return this.http.get<RetireCheck>(this.url(`/care-spaces/${enc(id)}/retire-check`));
  }

  /** `POST /care-spaces/:id/unit-assignments` — un solo OWNER vigente. */
  addUnitAssignment(id: string, body: AddUnitAssignmentRequest): Observable<SpaceUnitAssignment> {
    return this.http.post<SpaceUnitAssignment>(this.url(`/care-spaces/${enc(id)}/unit-assignments`), body);
  }

  /** `DELETE /care-spaces/:id/unit-assignments/:assignmentId` — cierra la vigencia; no borra. */
  closeUnitAssignment(id: string, assignmentId: string): Observable<void> {
    return this.http.delete<void>(
      this.url(`/care-spaces/${enc(id)}/unit-assignments/${enc(assignmentId)}`),
    );
  }

  /**
   * `PATCH /sites/:siteId/regulatory` con `If-Match`. Cambiar la tipología puede
   * dar 409 `TYPOLOGY_CONFLICT` con la lista de espacios que la incumplen.
   * SUPUESTO F1: responde el `SiteSummary` actualizado.
   */
  updateRegulatory(siteId: string, rowVersion: number, body: RegulatoryUpdateRequest): Observable<SiteSummary> {
    return this.http.patch<SiteSummary>(this.url(`/sites/${enc(siteId)}/regulatory`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `GET /sites/:siteId/licenses` — el estado «vencida» ya viene calculado. */
  listLicenses(siteId: string): Observable<readonly SiteLicense[]> {
    return this.http.get<readonly SiteLicense[]>(this.url(`/sites/${enc(siteId)}/licenses`));
  }

  /** `POST /sites/:siteId/licenses`. */
  createLicense(siteId: string, body: LicenseInput): Observable<SiteLicense> {
    return this.http.post<SiteLicense>(this.url(`/sites/${enc(siteId)}/licenses`), body);
  }

  /** `PATCH /site-licenses/:id` con `If-Match`. */
  updateLicense(id: string, rowVersion: number, body: Partial<LicenseInput>): Observable<SiteLicense> {
    return this.http.patch<SiteLicense>(this.url(`/site-licenses/${enc(id)}`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `GET /sites/:siteId/capacity` — declarada, derivada y brechas. La derivada nunca se escribe. */
  getCapacity(siteId: string): Observable<SiteCapacity> {
    return this.http.get<SiteCapacity>(this.url(`/sites/${enc(siteId)}/capacity`));
  }

  /**
   * `POST /sites/:siteId/declared-capacities` — agrega una declaración con vigencia; no sobrescribe.
   * El contrato no dice qué responde: la pantalla no lo lee y vuelve a pedir `getCapacity`.
   */
  declareCapacity(siteId: string, body: DeclaredCapacityInput): Observable<unknown> {
    return this.http.post<unknown>(this.url(`/sites/${enc(siteId)}/declared-capacities`), body);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function ifMatch(rowVersion: number): HttpHeaders {
  return new HttpHeaders({ 'If-Match': String(rowVersion) });
}
