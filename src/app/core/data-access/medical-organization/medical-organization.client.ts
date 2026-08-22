import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  MedicalOrganizationConsole,
  PracticeSummary,
} from './medical-organization.types';

/**
 * Cliente de la consola de organización médica — módulo 14 (`practice`).
 *
 * ## Por qué una carpeta propia y no una llamada más en `practice-sites`
 *
 * `practice-sites` responde una pregunta de atención —«¿dónde atiende este
 * profesional?»— y cuelga de `/practitioners/:id/sites`. Esta responde una
 * pregunta de administración —«¿cómo está armada esta organización?»— y cuelga
 * de `/practices/:id/organization`. Son dos lecturas distintas del mismo
 * módulo, con distinto ámbito y distinto consumidor; meterlas en el mismo
 * cliente obligaría a las pantallas de agenda a arrastrar los tipos del legajo.
 *
 * ## Dos llamadas y no una
 *
 * `GET /practices` responde «qué organizaciones administro» y
 * `GET /practices/:id/organization`, «cómo está armada ésta». La primera es lo
 * que permite elegir; sin ella habría que conocer el uuid de memoria, que es
 * exactamente el defecto que este carril viene a cerrar.
 */
@Injectable({ providedIn: 'root' })
export class MedicalOrganizationClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /practices` — las prácticas activas del tenant.
   *
   * Una lista vacía es un estado normal —un tenant sin práctica dada de alta—
   * y quien la reciba tiene que decirlo como tal, no como un fallo.
   *
   * @returns Las prácticas que se pueden administrar.
   */
  listPractices(): Observable<readonly PracticeSummary[]> {
    return this.http.get<readonly PracticeSummary[]>(this.url('/practices'));
  }

  /**
   * `GET /practices/:practiceId/organization` — el árbol completo.
   *
   * Sedes, áreas, infraestructura, servicios, plantilla, documentación legal e
   * inventario en una sola respuesta. Una práctica de otro tenant responde 404,
   * igual que una inexistente.
   *
   * @param practiceId - Organización que se administra.
   * @returns Su consola completa.
   */
  getConsole(practiceId: string): Observable<MedicalOrganizationConsole> {
    return this.http.get<MedicalOrganizationConsole>(
      this.url(`/practices/${encodeURIComponent(practiceId)}/organization`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
