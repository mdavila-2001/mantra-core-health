import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from './admin-portal.wire';
import type { MoneyQuery, MoneyReport } from './analytics-money.types';

/** Dinero por módulo (`/admin/analytics/money`): sólo lectura de agregados. */
@Injectable({ providedIn: 'root' })
export class AnalyticsMoneyClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  money(query: MoneyQuery = {}): Observable<MoneyReport> {
    return this.http.get<MoneyReport>(apiUrl(this.baseUrl, '/admin/analytics/money'), {
      params: queryParams({ ...query }),
    });
  }
}
