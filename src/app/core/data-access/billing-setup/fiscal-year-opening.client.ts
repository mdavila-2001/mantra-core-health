import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { CreateFiscalYear, FiscalPeriodInput, OpenedFiscalYear } from './fiscal-year-opening.types';

/**
 * Abre el ejercicio fiscal de una práctica (`POST /accounting/fiscal-years`).
 *
 * Vive aparte de `AccountingClient`, que ya pasó su techo de líneas. Quién
 * puede abrirlo lo decide la API: la administración de la práctica o el médico
 * titular de su consultorio propio; cualquier otro recibe 403.
 */
@Injectable({ providedIn: 'root' })
export class FiscalYearOpeningClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  openFiscalYear(body: CreateFiscalYear): Observable<OpenedFiscalYear> {
    return this.http.post<OpenedFiscalYear>(apiUrl(this.baseUrl, '/accounting/fiscal-years'), body);
  }
}

/**
 * El ejercicio calendario de un año, con sus doce meses: `FY2026`, del 1 de
 * enero al 31 de diciembre, y un período por mes (`2026-01`…`2026-12`).
 *
 * Las fechas se arman como texto, sin pasar por `Date`: un ejercicio no tiene
 * hora ni zona, y `Date` las correría un día en America/La_Paz.
 */
export function calendarFiscalYear(practiceId: string, year: number): CreateFiscalYear {
  const periods: FiscalPeriodInput[] = [];
  for (let month = 1; month <= 12; month++) {
    const mm = String(month).padStart(2, '0');
    periods.push({
      code: `${year}-${mm}`,
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-${String(daysInMonth(year, month)).padStart(2, '0')}`,
    });
  }
  return {
    practiceId,
    code: `FY${year}`,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    periods,
  };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
