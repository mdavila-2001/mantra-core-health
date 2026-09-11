import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { CarePlanRegistration, NewCarePlan } from './chart-care-plans.types';

/** Lo que viaja por el cable: el instante llega como texto ISO. */
interface WireCarePlanRegistration {
  readonly id: string;
  readonly statusConceptId: string;
  readonly activityCount: number;
  readonly createdAt: string;
}

/**
 * Cliente del **plan de cuidados** (`chart.care_plans`, UC-15-10).
 *
 * El módulo tenía la ruta y ninguna pantalla la usaba: el expediente listaba
 * los planes que venían del seed y el botón para crear uno no existía en
 * ninguna parte. Esto es esa mitad, igual que `ChartNotesClient` lo fue para la
 * nota narrativa.
 *
 * La lectura no vive acá sino en `ClinicalClient.getChart`, que trae la
 * historia entera —notas, planes y documentos— en una sola llamada. Un `GET`
 * propio acá sería una segunda versión de la misma lista.
 *
 * ## Las fechas del plan son fechas, no instantes
 *
 * `startDate` y `endDate` viajan como `YYYY-MM-DD` porque así las declara el
 * DTO (`@IsDateString` sobre `format: 'date'`). Mandar un ISO completo
 * guardaría una hora que nadie eligió y que cambiaría de día según el huso.
 */
@Injectable({ providedIn: 'root' })
export class ChartCarePlansClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /charts/care-plans` (UC-15-10) — abre el plan con sus actividades.
   *
   * @param plan - Paciente, meta, vigencia y los pasos iniciales.
   * @returns El plan recién creado y cuántas actividades entraron.
   */
  createCarePlan(plan: NewCarePlan): Observable<CarePlanRegistration> {
    return this.http
      .post<WireCarePlanRegistration>(this.url('/charts/care-plans'), sinAusentes({
        ...plan,
        startDate: diaDe(plan.startDate),
        endDate: diaDe(plan.endDate),
        activities:
          plan.activities === undefined
            ? undefined
            : plan.activities.map((actividad) =>
                sinAusentes({
                  ...actividad,
                  scheduledAt: actividad.scheduledAt?.toISOString(),
                }),
              ),
      }))
      .pipe(map((body) => ({ ...body, createdAt: new Date(body.createdAt) })));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * La fecha en `YYYY-MM-DD`, **en el día local** y no en UTC.
 *
 * `toISOString().slice(0, 10)` habría movido al día anterior todo lo elegido
 * después de las 20:00 en Bolivia, que es cuando se cargan la mitad de los
 * planes de una tarde de consultorio.
 */
function diaDe(fecha: Date | undefined): string | undefined {
  if (fecha === undefined) {
    return undefined;
  }
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const dia = `${fecha.getDate()}`.padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** El backend valida con `forbidNonWhitelisted`: una clave en `undefined` se omite. */
function sinAusentes<T extends object>(valor: T): Partial<T> {
  return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== undefined)) as Partial<T>;
}
