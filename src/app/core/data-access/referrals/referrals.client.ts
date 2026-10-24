import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { NewReferral, ReferralCreated } from './referrals.types';

/**
 * Derivaciones: el médico recomienda a la persona que consulte con otro
 * profesional.
 *
 * La derivación **no reserva nada**: la API le avisa a la persona en su
 * campana, con un enlace a la ficha del profesional recomendado, y ahí reserva
 * con la reserva de siempre. Elegir otro profesional de la misma especialidad
 * sigue siendo posible.
 */
@Injectable({ providedIn: 'root' })
export class ReferralsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /referrals` — emite la derivación. 404 si el encuentro no es de esa
   * persona o de la organización de quien deriva; 409 si ya existe una
   * equivalente.
   */
  create(body: NewReferral): Observable<ReferralCreated> {
    return this.http.post<ReferralCreated>(this.url('/referrals'), body);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
