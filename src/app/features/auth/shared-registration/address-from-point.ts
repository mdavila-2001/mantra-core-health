import type { RamaDepartamento } from '../../../core/data-access/terminology/bo-municipalities.service';
import type { LocalityFromPoint } from './map-location-picker/map-location-picker';

/**
 * La línea de dirección que se guarda para un punto del mapa.
 *
 * Pedido del cliente (26/10/2026): la persona sólo marca el punto; la calle, el
 * municipio y la zona se deducen de él y no se escriben. Los formularios
 * siguen teniendo su control de dirección —la API la exige—, y lo llena esto
 * con lo que dedujo `app-map-location-picker`:
 *
 * 1. La calle con su barrio, si el geocodificador la encontró.
 * 2. Si no hay calle (el mapa no la tiene, o el proveedor no respondió), la
 *    zona y el municipio que sí se dedujeron.
 * 3. Si tampoco hay eso, el punto mismo: «Punto GPS -17.78330, -63.18210».
 *
 * **Nunca se inventa una calle.** Lo de los pasos 2 y 3 dice lo que se sabe,
 * y no deja el control vacío: es invisible para la persona, y un obligatorio
 * vacío que no se ve frenaría el alta sin decir dónde.
 *
 * @param maximo El largo que admite el control; la línea se corta ahí para no
 *   dejar un `maxLength` inválido que tampoco se vería.
 */
export function addressFromPoint(
  localidad: LocalityFromPoint,
  municipio: string | null = null,
  maximo?: number,
): string {
  const linea =
    localidad.calle?.trim() ||
    [localidad.zona, municipio].filter((parte) => !!parte?.trim()).join(', ') ||
    pointLabel(localidad.punto);
  return maximo === undefined ? linea : linea.slice(0, maximo);
}

/** «Punto GPS -17.78330, -63.18210»: cinco decimales, un metro. */
export function pointLabel(punto: { readonly lat: number; readonly lng: number }): string {
  return `Punto GPS ${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)}`;
}

/** El nombre del municipio de `VS_BO_MUNICIPALITY` por su `conceptId`, o `null`. */
export function municipalityName(
  ramas: readonly RamaDepartamento[],
  conceptId: string | null,
): string | null {
  if (conceptId === null) return null;
  for (const rama of ramas) {
    const municipio = rama.municipios.find((m) => m.conceptId === conceptId);
    if (municipio !== undefined) return municipio.nombre;
  }
  return null;
}
