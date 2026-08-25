import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { NewAddress, RegisteredAddress } from './common.types';

/** Cliente de `common/addresses`: la dirección postal de una persona u organización. */
@Injectable({ providedIn: 'root' })
export class AddressesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /common/addresses` (UC-02-04). Registra una dirección.
   *
   * No hay edición: es el mismo criterio que la especialidad y la matrícula
   * del perfil profesional — se agrega de nuevo si cambió, no se corrige.
   */
  create(direccion: NewAddress): Observable<RegisteredAddress> {
    return this.http.post<RegisteredAddress>(this.url('/common/addresses'), {
      ownerType: direccion.ownerType,
      ownerId: direccion.ownerId,
      lines: direccion.lines,
      ...(direccion.city === undefined ? {} : { city: direccion.city }),
      ...(direccion.administrativeAreaConceptId === undefined
        ? {}
        : { administrativeAreaConceptId: direccion.administrativeAreaConceptId }),
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
