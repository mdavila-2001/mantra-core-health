import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  CreatedOrganizationPractice,
  NewOrganizationPractice,
} from './practice-onboarding.types';

/**
 * Cliente del alta de la práctica de una organización.
 *
 * Es el paso que le falta a un centro médico registrado con
 * `register-organization` para tener dónde colgar su catálogo y aparecer en la
 * búsqueda por cercanía: una vez **verificada**, la organización abre su
 * práctica con la primera sede. Va aparte de `PracticeSitesClient`, que es de
 * la afiliación y de las órdenes.
 */
@Injectable({
  providedIn: 'root',
})
export class PracticeOnboardingClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /tenants/:tenantId/practices` — abre la práctica y su primera sede.
   *
   * La API decide quién puede: sólo quien administra **esa** organización
   * (403 si no), y sólo si ya está verificada (422 si no). Dos prácticas con
   * el mismo nombre responden 409. Este cliente no prejuzga nada de eso.
   *
   * @param tenantId - La organización activa.
   * @param practice - Nombre de la práctica y datos de la sede.
   * @returns Los identificadores de la práctica y de la sede creadas.
   */
  createPractice(
    tenantId: string,
    practice: NewOrganizationPractice,
  ): Observable<CreatedOrganizationPractice> {
    return this.http.post<CreatedOrganizationPractice>(
      this.url(`/tenants/${encodeURIComponent(tenantId)}/practices`),
      {
        name: practice.name,
        site: {
          name: practice.site.name,
          addressText: practice.site.addressText,
          latitude: practice.site.latitude,
          longitude: practice.site.longitude,
          ...(practice.site.cityText === undefined ? {} : { cityText: practice.site.cityText }),
        },
      },
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
