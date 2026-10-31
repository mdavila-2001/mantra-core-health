import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { InstanceLiveness } from './ops-liveness.types';

/** Sonda de vida de las instancias (`/admin/ops/instances/liveness`): sólo lectura. */
@Injectable({ providedIn: 'root' })
export class OpsLivenessClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  liveness(): Observable<InstanceLiveness> {
    return this.http.get<InstanceLiveness>(this.url('/admin/ops/instances/liveness'));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
