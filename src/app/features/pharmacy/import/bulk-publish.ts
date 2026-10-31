import { HttpErrorResponse } from '@angular/common/http';
import { map, type Observable } from 'rxjs';

import type { PharmacyBulkClient } from '../../../core/data-access/pharmacy/pharmacy-bulk.client';
import type {
  BulkMode,
  BulkOutcome,
  BulkProductRow,
  BulkRowResult,
} from '../../../core/data-access/pharmacy/pharmacy-bulk.types';
import type { PharmacyProductDraft } from '../../../core/data-access/pharmacy/pharmacy.types';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import {
  draftChanges,
  type LoadMode,
  type ProductFields,
  type ReviewedRow,
} from '../catalog-rules/catalog.rules';
import { pharmacyErrorMessage } from '../pharmacy-error-message';

/* ============================================================================
    De las filas revisadas de una importación a la carga masiva de la API
    (`POST /pharmacies/:id/{entity}/bulk`), y de su respuesta a lo que la
    pantalla muestra por línea del archivo.

    Sin Angular: lo usan el asistente de productos y la importación de
    categorías, precios y sucursales, y un spec lo prueba sin TestBed.
    ========================================================================== */

/** Una fila del archivo que pasó la revisión local. */
export type ReadyRow = Extract<ReviewedRow, { readonly lista: true }>;

/** El modo del asistente, con el nombre que tiene en la API. */
export const BULK_MODE_OF: Readonly<Record<LoadMode, BulkMode>> = {
  CREAR_Y_ACTUALIZAR: 'UPSERT',
  SOLO_CREAR: 'CREATE',
  SOLO_ACTUALIZAR: 'UPDATE',
};

/** Qué le pasó a una fila del archivo: lo que dijo el servidor, o por qué no se mandó. */
export type RowOutcome = BulkOutcome | 'NOT_SENT' | 'PENDING';

export const OUTCOME_BADGE: Readonly<Record<RowOutcome, { variant: BadgeVariant; label: string }>> = {
  CREATED: { variant: 'success', label: 'Creado' },
  UPDATED: { variant: 'info', label: 'Actualizado' },
  UNCHANGED: { variant: 'secondary', label: 'Sin cambios' },
  REJECTED: { variant: 'error', label: 'Rechazado' },
  NOT_SENT: { variant: 'warning', label: 'No enviada' },
  PENDING: { variant: 'secondary', label: 'Sin enviar' },
};

/** El resultado del servidor, llevado a la línea del archivo. */
export interface FileRowResult {
  /** La línea del archivo (el encabezado es la 1). */
  readonly number: number;
  readonly outcome: BulkOutcome;
  /** Por qué se rechazó; vacío si no se rechazó. */
  readonly message: string;
}

/** Una fila para las tablas de vista previa y de resultado. */
export interface ResultRow {
  readonly number: number;
  readonly code: string;
  readonly name: string;
  readonly outcome: RowOutcome;
  readonly message: string;
}

/** Cuántas filas terminaron (o terminarían) en cada resultado. */
export interface OutcomeCounts {
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejected: number;
}

/**
 * La fila de productos que viaja a la API.
 *
 * Un alta va con los campos del alta, sin los vacíos (un `''` pasaría la
 * validación y se guardaría como marca vacía). Un cambio va con
 * `draftChanges(…, false)`: lo vacío de la planilla **no** borra lo que el
 * producto ya tiene, y no lleva lo que sólo admite el alta (código de barras,
 * cadena de frío), que el DTO del cambio rechazaría.
 */
export function productBulkRow(row: ReadyRow): BulkProductRow {
  if (row.accion === 'ACTUALIZAR') {
    const { medicationName } = row.borrador;
    return {
      productCode: row.borrador.productCode,
      ...draftChanges(row.borrador, false),
      // El medicamento por su nombre lo resuelve el servidor; vacío no desvincula.
      ...(medicationName === undefined ? {} : { medicationName }),
    };
  }
  return withoutEmptyValues(row.borrador);
}

/**
 * Manda las filas listas de productos en lotes de 250, en serie, y emite al
 * volver cada lote los resultados acumulados, ya con la línea del archivo.
 */
export function sendProducts(
  client: PharmacyBulkClient,
  pharmacyId: string,
  mode: LoadMode,
  rows: readonly ReadyRow[],
  options: { readonly dryRun?: boolean; readonly proceed?: () => boolean } = {},
): Observable<readonly FileRowResult[]> {
  const lines = rows.map((row) => row.numero);
  return client
    .chunked(
      pharmacyId,
      'products',
      {
        mode: BULK_MODE_OF[mode],
        ...(options.dryRun ? { dryRun: true } : {}),
        rows: rows.map(productBulkRow),
      },
      options.proceed === undefined ? {} : { proceed: options.proceed },
    )
    .pipe(map((progress) => toFileRows(lines, progress.results)));
}

/** Los resultados del servidor con la línea del archivo de cada fila mandada. */
export function toFileRows(
  lines: readonly number[],
  results: readonly BulkRowResult[],
): FileRowResult[] {
  return results.map((result) => ({
    number: lines[result.row - 1] ?? result.row,
    outcome: result.outcome,
    message: result.outcome === 'REJECTED' ? bulkRowMessage(result) : bulkRowWarnings(result),
  }));
}

/** Los avisos de una fila que se carga igual; vacío si no tiene ninguno. */
export function bulkRowWarnings(result: BulkRowResult): string {
  return (result.warnings ?? [])
    .map((warning) => warning.message ?? REASON_TEXT[warning.reason] ?? warning.reason)
    .join(' ');
}

/**
 * Por qué el servidor rechazó una fila. El `message` de la API ya viene en
 * castellano; sin él se dice el campo y el código del motivo.
 */
export function bulkRowMessage(result: BulkRowResult): string {
  const messages = (result.errors ?? []).map(
    (error) => error.message ?? REASON_TEXT[error.reason] ?? `${error.field}: ${error.reason}`,
  );
  return messages.join(' ') || 'El servidor rechazó la fila.';
}

const REASON_TEXT: Readonly<Record<string, string>> = {
  REQUIRED: 'Falta un dato obligatorio.',
  DUPLICATE_IN_FILE: 'La clave aparece más de una vez en el archivo.',
  ALREADY_EXISTS: 'Ya existe: eligió sólo crear.',
  NOT_FOUND: 'No existe: eligió sólo actualizar.',
  PRODUCT_NOT_FOUND: 'No hay un producto con ese código en su catálogo.',
  PRODUCT_RETIRED: 'El producto de ese código está retirado.',
  MEDICATION_NOT_FOUND: 'Ese medicamento no está en el catálogo con que se receta.',
  MEDICATION_NOT_LINKED: 'Pide receta y no tiene medicamento vinculado: ninguna receta lo encuentra.',
};

export function countOutcomes(results: readonly FileRowResult[]): OutcomeCounts {
  const count = (outcome: BulkOutcome): number =>
    results.filter((result) => result.outcome === outcome).length;
  return {
    created: count('CREATED'),
    updated: count('UPDATED'),
    unchanged: count('UNCHANGED'),
    rejected: count('REJECTED'),
  };
}

/**
 * El texto de un fallo que **no** es de una fila y corta la carga: el
 * permiso, la farmacia no activa, la red o un lote de más de 1 MB.
 */
export function bulkFailureMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 413) {
    return 'El servidor rechazó el envío por tamaño: un lote pasó de 1 MB. Divida el archivo en partes más chicas.';
  }
  return pharmacyErrorMessage(error, 'No se pudo completar la carga.');
}

/**
 * Una fila por línea del archivo de productos, con lo que pasó con ella: lo
 * que contestó el servidor, «no enviada» si la revisión local la frenó, o
 * «sin enviar» si la carga se cortó antes de llegar a ella.
 */
export function productResultRows(
  reviewed: readonly ReviewedRow[],
  results: readonly FileRowResult[],
): ResultRow[] {
  const byLine = new Map(results.map((result) => [result.number, result] as const));
  return reviewed.map((row): ResultRow => {
    if (!row.lista) {
      const base = { number: row.numero, code: row.campos.codigo.trim(), name: nameOfFields(row.campos) };
      return { ...base, outcome: 'NOT_SENT', message: row.errores.join(' ') };
    }
    const base = { number: row.numero, code: row.borrador.productCode, name: draftName(row.borrador) };
    const result = byLine.get(row.numero);
    return result === undefined
      ? { ...base, outcome: 'PENDING', message: 'No se envió: la carga se detuvo antes.' }
      : { ...base, outcome: result.outcome, message: result.message };
  });
}

export function draftName(draft: PharmacyProductDraft): string {
  return draft.brandName ?? draft.genericName ?? draft.productCode;
}

export function nameOfFields(fields: ProductFields): string {
  return fields.marca.trim() || fields.generico.trim() || '—';
}

/** El alta sin sus opcionales vacíos: `IsOptional` deja pasar un `''` y se guardaría vacío. */
function withoutEmptyValues(draft: PharmacyProductDraft): BulkProductRow {
  return Object.fromEntries(
    Object.entries(draft).filter(
      ([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0),
    ),
  ) as BulkProductRow;
}
