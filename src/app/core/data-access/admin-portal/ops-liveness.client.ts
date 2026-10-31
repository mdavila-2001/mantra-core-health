import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { InstancesLiveness } from './ops-liveness.types';

/** Sonda de vida de instancias (`/admin/ops/instances/liveness`): sólo lectura. */
@Injectable({ providedIn: 'root' })
export class OpsLivenessClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  liveness(): Observable<InstancesLiveness> {
    return this.http.get<InstancesLiveness>(apiUrl(this.baseUrl, '/admin/ops/instances/liveness'));
  }
}
