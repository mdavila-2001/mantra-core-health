import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { MyPromotionsResponseDto } from './promotions.dto';

/**
 * Las promociones del paciente, contra el contrato real (B-REAL-13).
 *
 * Una sola lectura: `GET /promotions/me`, sin parámetros. El titular sale del
 * token y el tenant del contexto, así que ningún dato de la persona viaja en
 * la URL.
 */
@Injectable({ providedIn: 'root' })
export class PromotionsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /promotions/me` — las automáticas vigentes del tenant y las de cupón
   * para las que el titular tiene un cupón personal (con su código).
   */
  listMine(): Observable<MyPromotionsResponseDto> {
    return this.http.get<MyPromotionsResponseDto>(apiUrl(this.baseUrl, '/promotions/me'));
  }
}
