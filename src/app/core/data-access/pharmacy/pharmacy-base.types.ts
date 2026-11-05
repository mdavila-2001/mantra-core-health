/**
 * Los dos tipos de base que comparten `pharmacy.types.ts` y
 * `pharmacy-availability.types.ts`. Viven en un archivo hoja para que la
 * disponibilidad no tenga que importar de quien la reexporta (eso era un ciclo
 * que `check-architecture` rechaza). `pharmacy.types.ts` los reexporta, así que
 * sus consumidores no cambian de import.
 */

/** Un concepto ya resuelto a su forma legible. */
export interface PharmacyConcept {
  readonly code: string;
  readonly display: string;
}

/** Un punto WGS84 desde donde medir distancias. */
export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}
