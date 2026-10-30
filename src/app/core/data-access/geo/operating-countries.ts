import { InjectionToken } from '@angular/core';

/**
 * Los países donde se opera hoy, en ISO 3166-1 alfa-2.
 *
 * El mapa de las altas sirve para cualquier punto del planeta: la API devuelve
 * el país y sus niveles administrativos (nivel 1, 2, 3 y distrito) para
 * cualquier país. Lo que todavía es sólo de Bolivia es **dónde se opera**, y
 * esa decisión vive acá y no repartida en recuadros de coordenadas: sumar un
 * país es sumar su código (y su catálogo de divisiones, ver el ADR de
 * direcciones multipaís en la API), no tocar el selector.
 */
export const OPERATING_COUNTRIES = new InjectionToken<readonly string[]>('OPERATING_COUNTRIES', {
  providedIn: 'root',
  factory: () => ['BO'],
});

/** El nombre con el que se dice cada país habilitado en los avisos. */
export const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  BO: 'Bolivia',
};

/** «Bolivia», «Bolivia y Perú», «Bolivia, Perú y Chile». */
export function joinCountryNames(codigos: readonly string[]): string {
  const nombres = codigos.map((c) => COUNTRY_NAMES[c] ?? c);
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}
