/** Un mes del ejercicio que se abre, tal como lo pide `POST /accounting/fiscal-years`. */
export interface FiscalPeriodInput {
  readonly code: string;
  /** `yyyy-MM-dd`. */
  readonly startDate: string;
  /** `yyyy-MM-dd`. */
  readonly endDate: string;
}

/** Cuerpo de `POST /accounting/fiscal-years` (`CreateFiscalYearDto` de la API). */
export interface CreateFiscalYear {
  readonly practiceId: string;
  /** Único por práctica, p. ej. `FY2026`. */
  readonly code: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly periods: readonly FiscalPeriodInput[];
}

/** Respuesta de `POST /accounting/fiscal-years` (`FiscalYearResponseDto`). */
export interface OpenedFiscalYear {
  readonly id: string;
  readonly code: string;
  readonly status: string;
  readonly periodIds: readonly string[];
}
