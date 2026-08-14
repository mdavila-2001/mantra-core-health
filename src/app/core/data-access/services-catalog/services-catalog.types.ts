/** Tipos de la vista para `services-catalog`. Se mapean desde los DTOs, no son ellos. */

/** Una práctica de la organización — la misma forma que expone `GET /practices`. */
export interface Practice {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/**
 * Un servicio del catálogo maestro de una práctica.
 *
 * `defaultPrice` es sólo referencia: el precio que de verdad se cotiza lo pone
 * cada doctor al armar el presupuesto, nunca este valor a ciegas.
 */
export interface ServiceCatalogItem {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly serviceConceptId?: string;
  readonly defaultPrice: string;
  readonly currencyConceptId?: string;
  readonly taxCodeId?: string;
  readonly incomeAccountId?: string;
  readonly isActive: boolean;
}

/**
 * Una página del catálogo de servicios.
 *
 * `nextCursor` es **opaco**: se reenvía tal cual y no se interpreta. La API no
 * publica su forma justamente para poder cambiar las columnas de orden sin
 * romper a nadie.
 */
export interface ServiceCatalogPage {
  readonly items: readonly ServiceCatalogItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Parámetros de la búsqueda paginada del catálogo. */
export interface ServiceCatalogQuery {
  /** Texto libre sobre código o nombre. */
  readonly query?: string;
  /** Filtra por servicios activos (`true`) o inactivos (`false`). */
  readonly isActive?: boolean;
  /** Cursor devuelto por la página anterior. */
  readonly cursor?: string;
  /** Servicios por página; la API usa 50 por defecto. */
  readonly limit?: number;
}

/** Cuerpo de la alta de un servicio nuevo en el catálogo. */
export interface NewServiceCatalogItem {
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly defaultPrice: string;
  readonly serviceConceptId?: string;
  readonly currencyConceptId?: string;
  readonly taxCodeId?: string;
  readonly incomeAccountId?: string;
  readonly isActive?: boolean;
}
