import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from './admin-portal.wire';
import type {
  Arbol,
  BusquedaQuery,
  DerivaCatalogo,
  Grafo,
  HallazgoDetalle,
  HallazgoResumen,
  Linaje,
  LinajeTabla,
  MapaFila,
  OperacionDetalle,
  OperacionResumen,
  OperacionesQuery,
  PortalPage,
  PortalVersion,
  ProcesoDetalle,
  ProcesoResumen,
  ProcesosQuery,
  TablaFicha,
  TablaResumen,
  TablasQuery,
  TerminoGlosario,
} from './portal.types';

/**
 * Cliente del inventario del portal (`/admin/portal/*`). Sólo lectura: lo que el
 * servidor sirve es lo que `tools/inventario` detectó, y esta capa no lo recalcula.
 */
@Injectable({ providedIn: 'root' })
export class PortalClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  version(): Observable<PortalVersion> {
    return this.get<PortalVersion>('/admin/portal/version');
  }

  listOperations(query: OperacionesQuery = {}): Observable<PortalPage<OperacionResumen>> {
    return this.get('/admin/portal/operaciones', { ...query });
  }

  getOperation(id: string): Observable<OperacionDetalle> {
    return this.get(`/admin/portal/operaciones/${encodeURIComponent(id)}`);
  }

  getOperationTree(id: string): Observable<Arbol> {
    return this.get(`/admin/portal/operaciones/${encodeURIComponent(id)}/arbol`);
  }

  listProcesses(query: ProcesosQuery = {}): Observable<PortalPage<ProcesoResumen>> {
    return this.get('/admin/portal/flujos', { ...query });
  }

  getProcess(codigo: string): Observable<ProcesoDetalle> {
    return this.get(`/admin/portal/flujos/${encodeURIComponent(codigo)}`);
  }

  getProcessGraph(codigo: string): Observable<Grafo> {
    return this.get(`/admin/portal/flujos/${encodeURIComponent(codigo)}/grafo`);
  }

  routeMap(query: OperacionesQuery = {}): Observable<PortalPage<MapaFila>> {
    return this.get('/admin/portal/flujos/mapa', { ...query });
  }

  listFindings(): Observable<readonly HallazgoResumen[]> {
    return this.get('/admin/portal/flujos/hallazgos');
  }

  getFinding(
    id: string,
    page: { cursor?: string; limit?: number } = {},
  ): Observable<HallazgoDetalle> {
    return this.get(`/admin/portal/flujos/hallazgos/${encodeURIComponent(id)}`, page);
  }

  listTables(query: TablasQuery = {}): Observable<PortalPage<TablaResumen>> {
    return this.get('/admin/portal/catalogo/tablas', { ...query });
  }

  getTable(schema: string, tabla: string): Observable<TablaFicha> {
    return this.get(
      `/admin/portal/catalogo/tablas/${encodeURIComponent(schema)}/${encodeURIComponent(tabla)}`,
    );
  }

  catalogDrift(): Observable<DerivaCatalogo> {
    return this.get('/admin/portal/catalogo/deriva');
  }

  lineage(): Observable<Linaje> {
    return this.get('/admin/portal/linaje');
  }

  tableLineage(schema: string, tabla: string): Observable<LinajeTabla> {
    return this.get(
      `/admin/portal/linaje/tablas/${encodeURIComponent(schema)}/${encodeURIComponent(tabla)}`,
    );
  }

  glossary(query: BusquedaQuery = {}): Observable<PortalPage<TerminoGlosario>> {
    return this.get('/admin/portal/glosario', { ...query });
  }

  private get<T>(path: string, query: Record<string, unknown> = {}): Observable<T> {
    return this.http.get<T>(apiUrl(this.baseUrl, path), {
      params: queryParams(query as Record<string, string | number | boolean | undefined | null>),
    });
  }
}
