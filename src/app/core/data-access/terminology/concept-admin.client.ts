import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { ValueSetExpansionPage, ValueSetOption } from './terminology.types';

/** Un miembro de un conjunto de valores con las propiedades que la API publica. */
export interface ConceptWithProperties extends ValueSetOption {
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface ConceptExpansionPage extends Omit<ValueSetExpansionPage, 'items'> {
  readonly items: readonly ConceptWithProperties[];
}

/**
 * Escrituras de catálogo que exige `SECURITY_ADMIN`: propiedades de un concepto
 * (la imagen entre ellas) y su retiro. La lectura va por `TerminologyClient`.
 */
@Injectable({ providedIn: 'root' })
export class ConceptAdminClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Una página de la expansión vigente, con `properties` de cada miembro. */
  readExpansion(valueSetId: string, cursor?: string, limit = 100): Observable<ConceptExpansionPage> {
    let params = new HttpParams().set('includeProperties', 'true').set('limit', String(limit));
    if (cursor !== undefined) params = params.set('cursor', cursor);
    return this.http.get<ConceptExpansionPage>(
      apiUrl(this.baseUrl, `/terminology/value-sets/${encodeURIComponent(valueSetId)}/$expand`),
      { params },
    );
  }

  setProperty(conceptId: string, propertyCode: string, valueJson: unknown): Observable<unknown> {
    return this.http.post(apiUrl(this.baseUrl, `/terminology/concepts/${encodeURIComponent(conceptId)}/properties`), {
      properties: [{ propertyCode, valueJson, dataType: 'string' }],
    });
  }

  deprecate(conceptId: string): Observable<unknown> {
    return this.http.post(apiUrl(this.baseUrl, `/terminology/concepts/${encodeURIComponent(conceptId)}/$deprecate`), {});
  }
}
