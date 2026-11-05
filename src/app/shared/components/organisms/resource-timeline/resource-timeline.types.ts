/* ============================================================================
    Contratos de `app-resource-timeline`: filas = recursos (salas, equipos),
    eje horario, segmentos. El organismo no sabe de quirófanos: recibe las filas
    y los segmentos ya armados (composition-rules §3).
    ========================================================================== */

import type { Tone } from '../../tone/tone.types';

/** Un recurso: una fila de la línea de tiempo. */
export interface TimelineRow {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

/**
 * Qué es un segmento:
 * - `band`: tiempo asignado de fondo (un bloque), detrás de todo;
 * - `item`: lo que ocupa el recurso (un caso), con su margen reservado
 *   (`reservedStart`/`reservedEnd`) sombreado alrededor;
 * - `released`: tiempo devuelto (bloque liberado), rayado.
 */
export type TimelineSegmentKind = 'band' | 'item' | 'released';

export interface TimelineSegment {
  readonly id: string;
  readonly rowId: string;
  readonly kind: TimelineSegmentKind;
  /** ISO-8601. */
  readonly start: string;
  readonly end: string;
  /** Margen antes/después del ítem (preparación y limpieza). */
  readonly reservedStart?: string;
  readonly reservedEnd?: string;
  readonly label: string;
  /** Lo que lee el lector de pantalla y la lista alternativa. */
  readonly detail: string;
  readonly tone?: Tone;
  /** Ruta interna: el segmento es un enlace. */
  readonly route?: string;
}
