import type { PuntoGeo } from './pin-mapa.types';

const RADIO_TERRESTRE_KM = 6371;

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

/**
 * Distancia en línea recta entre dos puntos (fórmula de haversine), en km.
 *
 * Es la distancia que la regla PAC-MED-005 permite prometer: «en línea
 * recta, no de recorrido» — la ruta real depende de un servicio externo que
 * no existe. Quien la muestre debe rotularla así.
 */
export function distanciaEnLineaRectaKm(desde: PuntoGeo, hasta: PuntoGeo): number {
  const deltaLat = aRadianes(hasta.lat - desde.lat);
  const deltaLng = aRadianes(hasta.lng - desde.lng);
  const cuerda =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(aRadianes(desde.lat)) * Math.cos(aRadianes(hasta.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * RADIO_TERRESTRE_KM * Math.asin(Math.sqrt(cuerda));
}

/**
 * Los puntos ordenados del más cercano al más lejano respecto del origen.
 * No muta la entrada; entre equidistantes conserva el orden recibido.
 */
export function ordenarPorCercania<T extends PuntoGeo>(
  origen: PuntoGeo,
  puntos: readonly T[],
): readonly T[] {
  return [...puntos].sort(
    (a, b) => distanciaEnLineaRectaKm(origen, a) - distanciaEnLineaRectaKm(origen, b),
  );
}
