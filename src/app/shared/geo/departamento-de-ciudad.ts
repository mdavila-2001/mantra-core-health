/* ============================================================================
    De un nombre de ciudad al departamento al que pertenece.

    Lo comparten los directorios que filtran por lugar en dos pasos —primero el
    departamento en el mapa, después la ciudad en un chip—: el de clínicas, el
    de farmacias y el público de hospitales. Vivía duplicado dentro del listado
    compartido de `public-directories`, y la copia se habría separado de la
    original en cuanto alguien cambiara la forma de normalizar.
    ========================================================================== */

import type { RamaDepartamento } from '@core/data-access/terminology/bo-municipalities.service';

/**
 * Quita tildes y baja a minúsculas, para casar el nombre de ciudad que trae el
 * directorio con el del municipio del catálogo.
 *
 * Los dos vienen escritos por gente distinta —uno lo cargó la organización en
 * su ficha, el otro lo siembra terminología— y «Potosí» y «potosi» tienen que
 * ser la misma ciudad. Sin esto el mapa dejaría fuera justo a los
 * departamentos cuyo nombre lleva tilde, que son la mitad.
 */
export function normalizarLugar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * De cada ciudad publicada al `conceptId` de su departamento.
 *
 * Se arma con los municipios del catálogo, que es el dueño del dato: una tabla
 * de ciudades escrita a mano se separaría del catálogo en cuanto alguien
 * sembrara un municipio nuevo, y el directorio empezaría a esconder centros sin
 * que nadie lo notara.
 */
export function departamentoPorCiudad(
  ramas: readonly RamaDepartamento[],
): ReadonlyMap<string, string> {
  const mapa = new Map<string, string>();
  for (const rama of ramas) {
    for (const municipio of rama.municipios) {
      mapa.set(normalizarLugar(municipio.nombre), rama.conceptId);
    }
  }
  return mapa;
}
