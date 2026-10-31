import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { OpsTools } from './ops-tools.types';

/** Herramientas de la plataforma (`/admin/ops/tools`): la lista completa, sólo lectura. */
@Injectable({ providedIn: 'root' })
export class OpsToolsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  tools(): Observable<OpsTools> {
    return this.http.get<OpsTools>(this.url('/admin/ops/tools'));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
