import type {
  Coordinates,
  LocalityFromPoint,
} from './map-location-picker/map-location-picker';

/**
 * Lo que cada formulario hace con lo que `app-map-location-picker` deduce del
 * punto (pedido del cliente del 26/10/2026: la persona sólo marca el punto;
 * calle, zona y municipio salen de él y no se escriben a mano).
 *
 * Vive aparte del selector porque es del lado de quien lo monta: el selector
 * avisa lo deducido de **cualquier** punto, confirmado o no, y cada formulario
 * guarda sólo lo del punto que la persona confirmó.
 */

/** Si dos puntos son el mismo lugar (los dos `null` también cuentan). */
export function samePoint(a: Coordinates | null, b: Coordinates | null): boolean {
  if (a === null || b === null) return a === b;
  return a.lat === b.lat && a.lng === b.lng;
}

/**
 * Lo deducido, sólo si es del punto confirmado; si no, `null`.
 *
 * El selector emite lo deducido apenas se pone el pin, antes de confirmarlo.
 * Volcar eso en el formulario guardaría la calle de un punto que la persona
 * todavía no dio por bueno —o que ya descartó—.
 */
export function confirmedLocality(
  localidad: LocalityFromPoint | null,
  confirmado: Coordinates | null,
): LocalityFromPoint | null {
  return localidad !== null && confirmado !== null && samePoint(localidad.punto, confirmado)
    ? localidad
    : null;
}

/**
 * Una línea de dirección **que nunca queda vacía**, para los guardados que no
 * mandan la dirección si no tiene texto.
 *
 * La calle, si el geocodificador la dio; si no, la zona y el lugar; y si
 * tampoco, el punto mismo. Nunca una calle inventada: «Punto GPS -17.78330,
 * -63.18210» dice exactamente lo que se sabe.
 */
export function addressLineFromPoint(localidad: LocalityFromPoint, lugar?: string | null): string {
  if (localidad.calle) return localidad.calle;
  const zonaYLugar = [localidad.zona, lugar]
    .map((parte) => parte?.trim() ?? '')
    .filter((parte) => parte !== '')
    .join(', ');
  if (zonaYLugar !== '') return zonaYLugar;
  return `Punto GPS ${localidad.punto.lat.toFixed(5)}, ${localidad.punto.lng.toFixed(5)}`;
}
