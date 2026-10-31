import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { OpsToolsOverview } from './ops-tools.types';

/** Herramientas de la plataforma (`/admin/ops/tools`): sólo lectura. */
@Injectable({ providedIn: 'root' })
export class OpsToolsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  tools(): Observable<OpsToolsOverview> {
    return this.http.get<OpsToolsOverview>(apiUrl(this.baseUrl, '/admin/ops/tools'));
  }
}
