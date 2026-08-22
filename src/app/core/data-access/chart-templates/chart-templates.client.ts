import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AssignTemplateInput,
  ChartTemplate,
  ChartTemplateAssignment,
  CreateChartTemplateInput,
} from './chart-templates.types';

/**
 * Cliente de `chart.specialty_chart_templates`: crear, listar y leer las
 * plantillas de chart por especialidad.
 *
 * El módulo ya tenía `POST /charts/templates/:id/assignments` (UC-15-12, que
 * **asigna** una plantilla existente); este cliente cubre las tres operaciones
 * que faltaban para poder decir «estas son las plantillas por especialidad»
 * desde el frontend — carril 2, punto 1 del reclamo.
 */
@Injectable({
  providedIn: 'root',
})
export class ChartTemplatesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /charts/templates?specialtyId=` — lista las plantillas, opcionalmente
   * acotadas a una especialidad.
   */
  listTemplates(specialtyConceptId?: string): Observable<readonly ChartTemplate[]> {
    // Parámetro a parámetro y no con un objeto: el backend valida con
    // `forbidNonWhitelisted`, así que un opcional presente en `undefined`
    // viajaría como clave declarada y la petición volvería con 400.
    let params = new HttpParams();
    if (specialtyConceptId !== undefined) {
      params = params.set('specialtyId', specialtyConceptId);
    }
    return this.http.get<readonly ChartTemplate[]>(this.url('/charts/templates'), { params });
  }

  /** `GET /charts/templates/:id` — el esquema completo de una plantilla. */
  getTemplate(id: string): Observable<ChartTemplate> {
    return this.http.get<ChartTemplate>(this.url(`/charts/templates/${encodeURIComponent(id)}`));
  }

  /** `POST /charts/templates` — crea una plantilla con su esquema de campos. */
  createTemplate(input: CreateChartTemplateInput): Observable<ChartTemplate> {
    return this.http.post<ChartTemplate>(this.url('/charts/templates'), input);
  }

  /**
   * `POST /charts/templates/:id/assignments` — pone una plantilla en uso
   * (UC-15-12).
   *
   * El endpoint existía desde antes que este cliente y no tenía envoltorio
   * porque no había ninguna plantilla que asignar: la lista arrancaba vacía.
   * Con el catálogo de formularios estándar sembrado (carril R2-5), «usar esta
   * plantilla tal cual» es exactamente esta llamada.
   */
  assignTemplate(
    templateId: string,
    input: AssignTemplateInput = {},
  ): Observable<ChartTemplateAssignment> {
    return this.http.post<ChartTemplateAssignment>(
      this.url(`/charts/templates/${encodeURIComponent(templateId)}/assignments`),
      input,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
