import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { sinNulos, type ConNulos } from '../wire';
import type {
  ReceivedService,
  ReceivedServicesPage,
  ReceivedServiceType,
} from './received-services.types';

type WireService = Omit<ReceivedService, 'type' | 'performedAt'> & {
  readonly type: string;
  readonly performedAt: string;
};

type WirePage = Omit<ReceivedServicesPage, 'items'> & {
  readonly items: readonly ConNulos<WireService>[];
};

const KNOWN_TYPES: readonly ReceivedServiceType[] = ['INTERVENTION', 'VACCINATION'];

/**
 * Los servicios que el paciente recibió: intervenciones médicas realizadas y vacunas.
 *
 * Una sola lectura: `GET /clinical/patients/:patientProfileId/received-services`.
 * La política de acceso es la del resumen de la historia (titular, representante,
 * quien atiende con turno o acceso autorizado); el cliente no autoriza nada.
 */
@Injectable({ providedIn: 'root' })
export class ReceivedServicesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Los servicios del paciente, el más reciente primero. */
  list(patientProfileId: string, limit?: number): Observable<ReceivedServicesPage> {
    const params = limit === undefined ? undefined : new HttpParams().set('limit', String(limit));
    return this.http
      .get<WirePage>(
        apiUrl(this.baseUrl, `/clinical/patients/${encodeURIComponent(patientProfileId)}/received-services`),
        { params },
      )
      .pipe(map((page) => ({ ...page, items: page.items.map(toService) })));
  }
}

function toService(wire: ConNulos<WireService>): ReceivedService {
  // El servidor omite los opcionales vacíos, pero un `null` no puede llegar a la
  // vista: `new Date(null)` es 1970 y `!== undefined` daría `true`.
  const { cost, type, performedAt, ...rest } = wire;
  return {
    ...sinNulos<Omit<WireService, 'cost' | 'type' | 'performedAt'>>(rest),
    type: (KNOWN_TYPES as readonly (string | null)[]).includes(type) ? (type as ReceivedServiceType) : 'OTHER',
    performedAt: new Date(performedAt as string),
    cost: cost ?? null,
  };
}
