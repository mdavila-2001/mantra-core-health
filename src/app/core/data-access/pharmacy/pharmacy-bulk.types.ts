/* ============================================================================
    Carga masiva del catálogo de la farmacia (FAR-05).

    `POST /pharmacies/:pharmacyId/{categories|products|prices|sites}/bulk` con
    `{ mode, dryRun?, rows }`. La API acepta de 1 a 1000 filas por pedido, pero
    el cuerpo JSON no puede pasar de 1 MB: el front manda lotes de
    {@link BULK_BATCH_SIZE} filas, en serie, y une los resultados.
    ========================================================================== */

/** Qué se carga: la última parte de la ruta antes de `/bulk`. */
export type BulkEntity = 'categories' | 'products' | 'prices' | 'sites';

/**
 * `CREATE` rechaza una clave que ya existe; `UPDATE`, una que no existe;
 * `UPSERT` acepta las dos.
 */
export type BulkMode = 'CREATE' | 'UPDATE' | 'UPSERT';

/** Qué pasó (o pasaría, con `dryRun`) con una fila. */
export type BulkOutcome = 'CREATED' | 'UPDATED' | 'REJECTED' | 'UNCHANGED';

/** Por qué se rechazó una fila. `message` viene en castellano y se muestra tal cual. */
export interface BulkRowError {
  /** El campo de la fila, o `row` si el problema es la fila entera. */
  readonly field: string;
  /** Código estable: `REQUIRED`, `DUPLICATE_IN_FILE`, `ALREADY_EXISTS`, `NOT_FOUND`… */
  readonly reason: string;
  readonly message?: string;
}

/** El resultado de una fila. `row` cuenta desde 1, en el orden en que se mandaron. */
export interface BulkRowResult {
  readonly row: number;
  readonly outcome: BulkOutcome;
  /** El registro creado o cambiado; sólo sin `dryRun`. */
  readonly id?: string;
  /** Sólo con `REJECTED`. */
  readonly errors?: readonly BulkRowError[];
}

export interface BulkRequest<Row extends object = object> {
  readonly mode: BulkMode;
  /** Con `true` el servidor no escribe nada y responde lo que habría pasado. */
  readonly dryRun?: boolean;
  readonly rows: readonly Row[];
}

export interface BulkResponse {
  readonly dryRun: boolean;
  readonly results: readonly BulkRowResult[];
}

/**
 * Cómo va una carga en lotes: se emite al volver cada lote, con los
 * resultados acumulados y `row` ya corrido al número de fila de toda la carga.
 */
export interface BulkProgress extends BulkResponse {
  /** Cuántas filas tiene la carga entera. */
  readonly total: number;
}

/** Fila de categorías: la clave es el nombre sin mayúsculas ni tildes. */
export interface BulkCategoryRow {
  readonly name: string;
}

/** Fila de precios: el precio de venta vigente de un producto por su código. */
export interface BulkPriceRow {
  readonly productCode: string;
  readonly unitPrice: number | string;
}

/**
 * Fila de sucursales. Se crean como **sedes de venta** de la farmacia (las de
 * «Horario y turnos» y «Dónde comprar»), no como sucursales de la organización.
 */
export interface BulkSiteRow {
  readonly code: string;
  readonly name: string;
  readonly addressLines?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly pickupAvailable?: boolean;
  readonly homeDeliveryAvailable?: boolean;
}

/** Fila de productos: los campos del alta (o del cambio) con su `productCode`. */
export type BulkProductRow = { readonly productCode: string } & Readonly<Record<string, unknown>>;

/** Filas por pedido: 250 productos con descripción larga no llegan al tope de 1 MB. */
export const BULK_BATCH_SIZE = 250;

/** Tope de filas de un pedido según la API. */
export const BULK_MAX_ROWS = 1000;
