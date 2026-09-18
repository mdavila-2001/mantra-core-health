import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  NewQuotation,
  Quotation,
  QuotationListItem,
} from './quotations.types';

/**
 * Cliente de `quotations` (FT-24): cotizaciones de un servicio del catálogo,
 * con su plan de pagos flexible, sin interés. El cronograma lo arma el
 * formulario (ver `flexible-payment-plan.ts`) y viaja entero en el alta.
 *
 * Sigue el mismo patrón que `ServicesCatalogClient`: `HttpClient` inyectado,
 * `API_BASE_URL` para la raíz, y un cuerpo tipado por método en vez de un
 * objeto genérico. A diferencia de otros clientes del repo, acá **no hay
 * conversión de fechas**: viajan como `YYYY-MM-DD` en los dos sentidos —el
 * contrato asumido de FT-24, en desarrollo en paralelo del lado del backend—,
 * y es el formulario quien las convierte a `Date` para el `app-date-picker`.
 *
 * El backend real puede ajustar detalles menores del contrato una vez
 * integrado; este cliente asume la forma descrita en la tarea FT-24.
 */
@Injectable({ providedIn: 'root' })
export class QuotationsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /quotations` — guarda la cotización con el plan de pagos elegido. */
  createQuotation(quotation: NewQuotation): Observable<Quotation> {
    return this.http.post<Quotation>(this.url('/quotations'), quotation);
  }

  /** `GET /quotations/:id` — una cotización ya guardada, con sus cuotas. */
  getQuotation(id: string): Observable<Quotation> {
    return this.http.get<Quotation>(this.url(`/quotations/${encodeURIComponent(id)}`));
  }

  /**
   * `GET /quotations?patientProfileId=` — las cotizaciones de un paciente,
   * en resumen.
   */
  listQuotationsByPatient(patientProfileId: string): Observable<readonly QuotationListItem[]> {
    const params = new HttpParams().set('patientProfileId', patientProfileId);
    return this.http.get<readonly QuotationListItem[]>(this.url('/quotations'), { params });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
