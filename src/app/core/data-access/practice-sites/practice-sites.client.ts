import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { PracticeSitePage } from './practice-sites.types';

/**
 * Cliente de los **consultorios** de `practice` (M14).
 *
 * ## Por qué existe esta carpeta y no una llamada más en `scheduling`
 *
 * El backend modela sedes desde siempre (`practice.practice_sites`,
 * `GET /practices/:practiceId/sites`) y el frontend no tenía **ningún** cliente
 * para ellas: `grep -rln "practice/sites" src/app/core/data-access` daba cero.
 * El resultado era que el sistema sabía *cuándo* atiende un profesional y no
 * *dónde*, y un turno sin dirección obliga a averiguarla por fuera —que es
 * justo lo que el sistema existe para evitar—.
 *
 * ## Se pide por profesional, no por práctica
 *
 * `GET /practices/:practiceId/sites` responde otra pregunta —«¿qué sedes tiene
 * esta organización?»— y para hacerla hay que saber primero en qué práctica
 * trabaja el profesional, que es lo que se está preguntando. Por eso el
 * endpoint que consume este cliente cuelga de `/practitioners/:profileId/sites`.
 *
 * ## La agenda ya no necesita este cliente para lo suyo
 *
 * `GET /scheduling/resources` trae la sede resuelta en cada recurso, así que la
 * agenda no encadena una petición por profesional. Este cliente es para las
 * pantallas que preguntan por una persona concreta —el perfil, la ficha del
 * profesional— donde no hay agenda de por medio.
 */
@Injectable({
  providedIn: 'root',
})
export class PracticeSitesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /practitioners/:profileId/sites` — dónde atiende el profesional.
   *
   * Sale de sus asignaciones de rol vigentes, la principal primero. Una lista
   * vacía es un estado normal: quien la reciba tiene que decirlo como «no tiene
   * consultorio registrado», nunca como un fallo.
   *
   * @param practitionerProfileId - Profesional consultado.
   * @returns Sus consultorios, con nombre y dirección.
   */
  listSitesOfPractitioner(practitionerProfileId: string): Observable<PracticeSitePage> {
    return this.http.get<PracticeSitePage>(
      this.url(`/practitioners/${encodeURIComponent(practitionerProfileId)}/sites`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
