/* ============================================================================
    Puntos de toma de muestra — franja F5b (`CONTRATO-F2-F5.md` §F5b): espacios
    con función `SAMPLE_COLLECTION` ligados a la unidad de laboratorio.
    ========================================================================== */

/** Un espacio, como lo nombra la pantalla: código, nombre y ruta. */
export interface CollectionPointRef {
  readonly careSpaceId: string;
  readonly code: string;
  readonly name: string;
}

/** Una fila de `GET /sites/:siteId/sample-collection-points` (sólo activos y disponibles). */
export interface SampleCollectionPoint {
  readonly careSpace: { readonly id: string; readonly code: string; readonly name: string; readonly path: string };
  readonly unit: { readonly id: string; readonly name: string } | null;
  /** Horario de atención, si la sede lo declara. */
  readonly hours: string | null;
}

/**
 * Clave que el DTO publicado de la orden todavía no declara (F5b): el cliente
 * **sí** la manda a la API real; se borra al regenerar el contrato.
 */
export const SERVICE_REQUEST_COLLECTION_POINT_PENDING_KEYS = ['suggestedCareSpaceId'] as const;
