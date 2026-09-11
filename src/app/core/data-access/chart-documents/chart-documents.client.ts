import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { ChartDocumentRegistration, NewChartDocument } from './chart-documents.types';

/** Lo que viaja por el cable: el instante llega como texto ISO. */
interface WireDocumentRegistration {
  readonly id: string;
  readonly statusConceptId: string;
  readonly fileCount: number;
  readonly createdAt: string;
}

/**
 * Cliente del **documento del expediente** (`chart.document_records`, UC-15-09).
 *
 * Mismo caso que el plan de cuidados: la ruta existía desde siempre y la
 * pestaña «Documentos» del expediente sólo sabía listar. El papel que la
 * persona trae en la mano —un laboratorio de afuera, una placa de otro
 * centro— no tenía por dónde entrar a la historia.
 *
 * La lectura sigue siendo de `ClinicalClient.getChart`: el alta devuelve el
 * identificador y quien lo llama relee, en vez de pintar la fila de memoria.
 */
@Injectable({ providedIn: 'root' })
export class ChartDocumentsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /charts/documents` (UC-15-09) — registra el documento.
   *
   * @param documento - Paciente, custodio, título y lo que se sepa del papel.
   * @returns El documento recién creado y cuántos archivos quedaron ligados.
   */
  createDocument(documento: NewChartDocument): Observable<ChartDocumentRegistration> {
    return this.http
      .post<WireDocumentRegistration>(this.url('/charts/documents'), sinAusentes({ ...documento }))
      .pipe(map((body) => ({ ...body, createdAt: new Date(body.createdAt) })));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** El backend valida con `forbidNonWhitelisted`: una clave en `undefined` se omite. */
function sinAusentes<T extends object>(valor: T): Partial<T> {
  return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== undefined)) as Partial<T>;
}
