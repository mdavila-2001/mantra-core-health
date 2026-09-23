/* ============================================================================
    Contratos de la tabla de datos.

    **Paginación por cursor**, no por página (§0.6): el M34 pide listas con
    cursor y un cursor no conoce el total, así que no hay números de página ni
    «última». `app-pagination` queda para catálogos acotados con total estable.
    ========================================================================== */

import type { TemplateRef } from '@angular/core';

/** Alineación de una columna. Las cifras van a la derecha para comparar. */
export const COLUMN_ALIGNMENTS = ['start', 'center', 'end'] as const;
export type ColumnAlignment = (typeof COLUMN_ALIGNMENTS)[number];

/**
 * Definición de una columna.
 *
 * `priority` la declara **el consumidor**, y a mano: el
 * `responsive_priority` de `read_models.frontend_view_fields` está sembrado
 * con placeholders del generador, así que leerlo daría un orden arbitrario.
 * 1 = imprescindible (nunca se pliega), 3 = detalle.
 */
export interface ColumnDef<Row> {
  /** Clave estable de la columna. Es lo que viaja al ordenar, nunca la etiqueta. */
  readonly key: string;
  readonly header: string;
  readonly priority: number;
  readonly align?: ColumnAlignment;
  readonly sortable?: boolean;
  /**
   * `'end'` fija la columna al borde final de la caja con scroll lateral. Es
   * para las acciones: una tabla más ancha que la pantalla las escondía detrás
   * de un desplazamiento que nadie descubre (propietario, 18/09/2026).
   */
  readonly sticky?: 'end';
  /** Plantilla de celda; sin ella se muestra el valor crudo de `key`. */
  readonly cell?: TemplateRef<{ $implicit: Row }>;
}

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/** Orden actual. `key` es el **código** de la columna, jamás su etiqueta. */
export interface SortState {
  readonly key: string;
  readonly direction: SortDirection;
}

/**
 * Ventana de cursor. Sin `total` a propósito: pedirlo obligaría al backend a
 * contar toda la tabla en cada página, que es justo lo que el cursor evita.
 */
export interface CursorState {
  readonly prevCursor?: string | null;
  readonly nextCursor?: string | null;
}

/** Prioridad a partir de la cual una columna se pliega al detalle en móvil. */
export const MOBILE_DETAIL_PRIORITY = 2;
